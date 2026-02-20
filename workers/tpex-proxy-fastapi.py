"""
TPEX OTC ETF Proxy — FastAPI endpoint

Fetches OTC-listed ETF data from TPEX (Taipei Exchange) and returns
filtered ETF records (codes starting with "00"). Caches for 1 hour.

Uses the traditional TPEX web API which is more reliable than the
openapi endpoint (which has Cloudflare protection issues).

Usage:
  GET /tpex/etf-list  — All OTC ETFs with OHLCV + change
  GET /health         — Health check
"""

import logging
import time
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

app = FastAPI(title="TPEX Proxy")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Traditional web API — more reliable than openapi endpoint
TPEX_URL = (
    "https://www.tpex.org.tw/web/stock/aftertrading/"
    "daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json"
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# Simple in-memory cache
_cache: dict[str, Any] = {"data": None, "ts": 0}
CACHE_TTL = 3600  # 1 hour


async def fetch_tpex() -> dict:
    now = time.time()
    if _cache["data"] and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]

    async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
        res = await client.get(TPEX_URL)
        res.raise_for_status()
        data = res.json()

    if data.get("stat") != "ok":
        raise ValueError(f"TPEX returned stat={data.get('stat')}")

    _cache["data"] = data
    _cache["ts"] = now
    return data


def parse_etfs(data: dict) -> list[dict]:
    """Parse ETF rows from TPEX tables response.

    Row format: [code, name, close, change, open, high, low, avg,
                 volume, amount, transactions, lastBid, lastAsk,
                 issuedShares, nextUp, nextDown]
    """
    date = data.get("date", "")
    etfs = []

    for table in data.get("tables", []):
        for row in table.get("data", []):
            if not isinstance(row, list) or len(row) < 11:
                continue
            code = row[0].strip() if row[0] else ""
            if not code.startswith("00"):
                continue

            etfs.append({
                "code": code,
                "name": (row[1] or "").strip(),
                "price": (row[2] or "").strip().replace(",", ""),
                "change": (row[3] or "").strip().replace(",", ""),
                "open": (row[4] or "").strip().replace(",", ""),
                "high": (row[5] or "").strip().replace(",", ""),
                "low": (row[6] or "").strip().replace(",", ""),
                "volume": (row[8] or "").strip().replace(",", ""),
                "transactions": (row[10] or "").strip().replace(",", ""),
                "date": date,
                "source": "tpex",
            })

    return etfs


@app.get("/health")
async def health():
    return {"status": "ok", "service": "TPEX Proxy"}


@app.get("/tpex/etf-list")
async def tpex_etf_list():
    try:
        data = await fetch_tpex()
    except Exception as e:
        logger.error("TPEX fetch failed: %s", e)
        return JSONResponse(
            status_code=502,
            content={"error": "TPEX fetch failed", "message": str(e)},
        )

    etfs = parse_etfs(data)

    return {
        "count": len(etfs),
        "date": etfs[0]["date"] if etfs else "",
        "etfs": etfs,
    }
