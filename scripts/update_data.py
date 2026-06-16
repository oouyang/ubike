#!/usr/bin/env python3
"""
Update stocks_data.js and bwibbu_data.js for tw-stock-guide.html.

Fetches:
  - FinMind API → full TWSE/TPEx/Emerging stock universe → stocks_data.js
  - TWSE OpenAPI BWIBBU_ALL → PE / dividend yield / PB ratio → bwibbu_data.js

Run periodically (cron / launchd) to keep data fresh.
  $ python3 update_data.py

Output files are written to the script's own directory by default, or to
OUTPUT_DIR if that env var is set.
"""

from __future__ import annotations
import json
import os
import sys
import re
import urllib.error
import urllib.request
from datetime import date, datetime

# ETF dividend yield enrichment via Yahoo Finance (optional dependency)
try:
    from etf_yield import get_etf_yields

    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", SCRIPT_DIR)

USER_AGENT = "tw-stock-guide/1.0"

TIMEOUT = 30

TODAY = date.today().strftime("%Y-%m-%d")


# ── helpers ──────────────────────────────────────────────────────────

def fetch_json(url: str, label: str) -> list:
    """Fetch a JSON endpoint and return the parsed result."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode())
        print(f"  ✓ {label}: {len(data) if isinstance(data, list) else 'OK'} entries")
        return data
    except urllib.error.HTTPError as e:
        print(f"  ✗ {label}: HTTP {e.code} {e.reason}", file=sys.stderr)
        raise
    except urllib.error.URLError as e:
        print(f"  ✗ {label}: {e.reason}", file=sys.stderr)
        raise
    except json.JSONDecodeError as e:
        print(f"  ✗ {label}: invalid JSON — {e}", file=sys.stderr)
        raise


def write_js(path: str, var_name: str, data: list | dict, extra_note: str = "") -> int:
    """Write data as `window.<var_name> = ...` JS file. Returns byte count."""
    note = f"Fetched: {TODAY}"
    if extra_note:
        note += f" | {extra_note}"

    lines = [
        f"// Auto-generated from {var_name.replace('_', ' / ')}",
        f"// {note}",
        f"window.{var_name} = ",
    ]
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    lines.append(body)
    lines.append(";\n")

    payload = "\n".join(lines)
    with open(path, "w", encoding="utf-8") as f:
        f.write(payload)
    return len(payload.encode())


# ── stocks_data.js ───────────────────────────────────────────────────

FINMIND_URL = "https://api.finmindtrade.com/api/v4/data"
FINMIND_PARAMS = "?dataset=TaiwanStockInfo&token="


def fetch_stocks() -> list[dict]:
    """Fetch and normalise the FinMind TaiwanStockInfo dataset."""
    url = FINMIND_URL + FINMIND_PARAMS
    raw = fetch_json(url, "FinMind TaiwanStockInfo")

    records = raw.get("data", raw) if isinstance(raw, dict) else raw
    if not isinstance(records, list):
        print(f"  ! unexpected response shape, expected list", file=sys.stderr)
        return []

    seen = set()
    result = []
    for r in records:
        stock_id = (r.get("stock_id") or "").strip()
        name = (r.get("stock_name") or "").strip()
        industry = (r.get("industry_category") or "").strip()
        market = (r.get("type") or r.get("market") or "").strip().lower()

        if not stock_id or not name:
            continue

        # Normalise market labels
        market_map = {
            "twse": "twse",
            "tse": "twse",
            "上市": "twse",
            "tpex": "tpex",
            "otc": "tpex",
            "上櫃": "tpex",
            "emerging": "emerging",
            "興櫃": "emerging",
        }
        market = market_map.get(market, market)

        # Skip pure index entries
        if industry in ("Index", "大盤", "所有證券"):
            continue

        key = stock_id
        if key not in seen:
            seen.add(key)
            result.append({
                "id": stock_id,
                "name": name,
                "industry": industry,
                "market": market,
            })

    print(f"  → {len(result)} unique stocks after dedup")
    return result


# ── bwibbu_data.js ───────────────────────────────────────────────────

BWIBBU_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL"


def fetch_bwibbu() -> list[dict]:
    """Fetch PE / dividend yield / PB ratio from TWSE OpenAPI."""
    raw = fetch_json(BWIBBU_URL, "TWSE BWIBBU_ALL")

    if not isinstance(raw, list):
        print(f"  ! unexpected BWIBBU shape", file=sys.stderr)
        return []

    # Keep only relevant fields, normalise
    result = []
    for r in raw:
        code = (r.get("Code") or "").strip()
        if not code:
            continue
        result.append({
            "Code": code,
            "PEratio": (r.get("PEratio") or "").strip() or "",
            "DividendYield": (r.get("DividendYield") or "").strip() or "",
            "PBratio": (r.get("PBratio") or "").strip() or "",
        })

    filled = sum(1 for r in result if r["PEratio"])
    print(f"  → {len(result)} entries ({filled} with PE ratio)")
    return result


# ── TPEX bond ETF close price enrichment ──────────────────────────────

TPEX_QUOTE_URL = "https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json"


def fetch_tpex_daily_quotes() -> dict[str, str]:
    """Fetch TPEX daily close quotes, return {code: close_price}."""
    raw = fetch_json(TPEX_QUOTE_URL, "TPEX daily quotes")
    if not isinstance(raw, dict):
        print("  ! unexpected TPEX response shape (not dict)", file=sys.stderr)
        return {}
    if raw.get("stat") != "ok":
        print(f"  ! TPEX stat != ok: {raw.get('stat')}", file=sys.stderr)
        return {}
    tables = raw.get("tables") or []
    if not tables:
        return {}
    first = tables[0]
    if not isinstance(first, dict):
        return {}
    data_list = first.get("data") or []
    code_index: dict[str, str] = {}
    for row in data_list:
        if isinstance(row, list) and len(row) >= 3:
            code = (row[0] or "").strip()
            close = (row[2] or "").strip()
            if code and close:
                code_index[code] = close
    print(f"  → {len(code_index)} securities in TPEX quotes")
    return code_index


def _enrich_bond_etf_prices(
    bwibbu: list[dict], stocks: list[dict], tpex_quotes: dict[str, str]
) -> int:
    """Append bond ETF close prices from TPEX quotes into BWIBBU list.

    TPEX daily close quotes include ALL TPEX securities (stocks + ETFs).
    This looks up bond ETFs (code ending with B) and adds their close
    price to bwibbu_data so the front end can display it.
    """
    bond_etf_codes = {
        s["id"] for s in stocks
        if s["id"].endswith("B") and "ETF" in s.get("industry", "")
    }
    existing = {e["Code"] for e in bwibbu}
    added = 0
    for code in sorted(bond_etf_codes):
        if code in existing:
            continue
        price = tpex_quotes.get(code)
        if price:
            bwibbu.append({
                "Code": code,
                "PEratio": "",
                "DividendYield": "",
                "PBratio": "",
                "ClosePrice": price,
            })
            added += 1
    print(f"  ~ bond ETF price enrichment: {added} added"
          f" ({len(bond_etf_codes) - added} not found in TPEX quotes)")
    return added


# ── ETF yield enrichment ──────────────────────────────────────────────

def _get_etf_codes(stocks: list[dict]) -> list[str]:
    """Extract equity ETF codes suitable for Yahoo Finance dividend queries.

    Filters out bond ETFs (code ends with B), leveraged/inverse (L/R),
    and commodities — these either lack dividend data on Yahoo or are
    irrelevant for dividend yield tracking.
    """
    etf_keywords = ("ETF", "etf", "指數股票型基金")
    candidates = [
        s for s in stocks
        if any(kw in s.get("industry", "") for kw in etf_keywords)
    ]
    result = []
    for s in candidates:
        code = s["id"]
        # Skip bond ETFs (code ends with B), leveraged/inverse (L/R suffix),
        # commodities (U), and notes (T suffix)
        if code[-1] in ("B", "L", "R", "U", "T"):
            continue
        # Skip short-dated / money-market ETFs (5-character codes like 00632R
        # are already caught by R above; double-check)
        if len(code) >= 5 and code[-1] in ("R",):
            continue
        result.append(code)
    return result


def _enrich_etf_yields(
    bwibbu: list[dict], etf_codes: list[str]
) -> tuple[int, int]:
    """Append Yahoo Finance trailing dividend yields for ETFs into BWIBBU list.

    BWIBBU (TWSE OpenAPI) does not cover ETFs, so we append new entries
    for every ETF code where Yahoo Finance returns valid data.

    Returns (added_count, failed_count).
    """
    yahoo = get_etf_yields(etf_codes)
    existing = {e["Code"] for e in bwibbu}
    added = 0
    failed = 0
    for code in etf_codes:
        if code in existing:
            continue  # already in BWIBBU, skip (rare for ETFs)
        yd = yahoo.get(code)
        if yd and yd.get("yield") is not None:
            bwibbu.append({
                "Code": code,
                "PEratio": "",
                "DividendYield": str(yd["yield"]),
                "PBratio": "",
            })
            added += 1
        else:
            failed += 1
    return added, failed


# ── cache busting ────────────────────────────────────────────────────

HTML_PATH = os.path.join(SCRIPT_DIR, "tw-stock-guide.html")
_CACHE_BUST_PLACEHOLDER = "__CACHE_BUST__"


def _bust_html_cache():
    """Replace cache-bust placeholder in <script src> tags with a timestamp."""
    path = HTML_PATH
    if not os.path.exists(path):
        print(f"  ! {path} not found, skipping cache bust", file=sys.stderr)
        return

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    if _CACHE_BUST_PLACEHOLDER not in html:
        return  # nothing to replace

    html = html.replace(_CACHE_BUST_PLACEHOLDER, ts)
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  ~ cache bust: v={ts}")


# ── main ─────────────────────────────────────────────────────────────

def main():
    print(f"[{TODAY}] Updating stock data files in {OUTPUT_DIR}")
    print()

    errors = 0
    etf_codes: list[str] = []

    # 1. stocks_data.js
    print("── stocks_data.js ──")
    try:
        stocks = fetch_stocks()
        if stocks:
            etf_codes = _get_etf_codes(stocks)
            path = os.path.join(OUTPUT_DIR, "stocks_data.js")
            n_bytes = write_js(path, "STOCK_DATA", stocks)
            print(f"  ✓ wrote {n_bytes / 1024:.0f} KB to {path}")
            print(f"    {len(stocks)} entries, "
                  f"{sum(1 for s in stocks if s['market'] == 'twse')} TWSE, "
                  f"{sum(1 for s in stocks if s['market'] == 'tpex')} TPEx, "
                  f"{sum(1 for s in stocks if s['market'] == 'emerging')} Emerging")
            print(f"    {len(etf_codes)} ETFs detected")
        else:
            print("  ! no stocks fetched, skipping write", file=sys.stderr)
            errors += 1
    except Exception as e:
        print(f"  ✗ failed: {e}", file=sys.stderr)
        errors += 1

    print()

    # 2. bwibbu_data.js
    print("── bwibbu_data.js ──")
    extra_note = ""
    try:
        bwibbu = fetch_bwibbu()
        if bwibbu:
            # Enrich bond ETF close prices from TPEX daily quotes FIRST
            # (fast API, runs before the slow yfinance queries)
            try:
                tpex_quotes = fetch_tpex_daily_quotes()
                if tpex_quotes:
                    bond_added = _enrich_bond_etf_prices(bwibbu, stocks, tpex_quotes)
                    if bond_added:
                        extra_note = f"Bond ETF prices from TPEX ({bond_added} ETFs)"
            except Exception as e:
                print(f"  ! TPEX bond ETF price enrichment failed: {e}", file=sys.stderr)

            # Enrich ETF yields via Yahoo Finance if available
            if HAS_YFINANCE and etf_codes:
                try:
                    added, failed = _enrich_etf_yields(bwibbu, etf_codes)
                    print(f"  ~ ETF yield enrichment: {added} added, {failed} skipped/failed")
                    yf_note = f"ETF dividend yields from Yahoo Finance ({added} ETFs)"
                    extra_note = (extra_note + " | " + yf_note) if extra_note else yf_note
                except Exception as e:
                    print(f"  ! ETF yield enrichment failed: {e}", file=sys.stderr)

            path = os.path.join(OUTPUT_DIR, "bwibbu_data.js")
            n_bytes = write_js(path, "BWIBBU_DATA", bwibbu, extra_note=extra_note)
            print(f"  ✓ wrote {n_bytes / 1024:.0f} KB to {path}")
        else:
            print("  ! no BWIBBU data fetched, skipping write", file=sys.stderr)
            errors += 1
    except Exception as e:
        print(f"  ✗ failed: {e}", file=sys.stderr)
        errors += 1

    print()

    # 3. cache bust HTML
    print("── cache bust ──")
    try:
        _bust_html_cache()
    except Exception as e:
        print(f"  ! failed: {e}", file=sys.stderr)

    print()
    if errors:
        print(f"Done with {errors} error(s).")
        sys.exit(1)
    else:
        print("All files updated successfully.")
        sys.exit(0)


if __name__ == "__main__":
    main()
