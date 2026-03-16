'use strict';

/**
 * Generate ALL D4-unique solvable block puzzles in compact format.
 * Output: a single string where every 6 chars encodes one puzzle's grey positions.
 * Each char is base64 (A-Z, a-z, 0-9, +, /) representing cell index 0-63.
 */

const N = 8;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Non-grey pieces sorted largest first
const PIECES = [
  { id: 'blue2',  shapes: [] },
  { id: 'blue1',  shapes: [] },
  { id: 'yel1',   shapes: [] },
  { id: 'yel2',   shapes: [] },
  { id: 'red1',   shapes: [] },
  { id: 'white1', shapes: [] },
  { id: 'red2',   shapes: [] },
  { id: 'white2', shapes: [] },
];

const BASE_SHAPES = {
  blue2:  [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3]],
  blue1:  [[0,0],[0,1],[0,2],[0,3],[0,4],[1,0],[1,1],[1,2],[1,3],[1,4]],
  yel1:   [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],
  yel2:   [[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3]],
  red1:   [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
  white1: [[0,0],[0,1],[0,2],[0,3],[0,4]],
  red2:   [[0,0],[0,1],[0,2],[0,3]],
  white2: [[0,0],[0,1],[1,0],[1,1]],
};

function getRotations(cells) {
  const seen = new Set();
  const results = [];
  let cur = cells;
  for (let r = 0; r < 4; r++) {
    const minR = Math.min(...cur.map(c => c[0]));
    const minC = Math.min(...cur.map(c => c[1]));
    const norm = cur.map(c => [c[0] - minR, c[1] - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = norm.toString();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(norm);
    }
    cur = cur.map(c => [c[1], -c[0]]);
  }
  return results;
}

for (const piece of PIECES) {
  piece.shapes = getRotations(BASE_SHAPES[piece.id]);
}

function getCanonicalKey(cells) {
  const keys = [];
  let cur = cells.map(c => [...c]);
  for (let rot = 0; rot < 4; rot++) {
    const norm = cur.map(c => [...c]).sort((a, b) => a[0] * N + a[1] - b[0] * N - b[1]);
    keys.push(norm.map(c => c[0] * N + c[1]).join(','));
    const mir = cur.map(([r, c]) => [r, N - 1 - c]).sort((a, b) => a[0] * N + a[1] - b[0] * N - b[1]);
    keys.push(mir.map(c => c[0] * N + c[1]).join(','));
    cur = cur.map(([r, c]) => [c, N - 1 - r]);
  }
  keys.sort();
  return keys[0];
}

function getD4Keys(cells) {
  const keys = new Set();
  let cur = cells.map(c => [...c]);
  for (let rot = 0; rot < 4; rot++) {
    const norm = cur.map(c => [...c]).sort((a, b) => a[0] * N + a[1] - b[0] * N - b[1]);
    keys.add(norm.map(c => c[0] * N + c[1]).join(','));
    const mir = cur.map(([r, c]) => [r, N - 1 - c]).sort((a, b) => a[0] * N + a[1] - b[0] * N - b[1]);
    keys.add(mir.map(c => c[0] * N + c[1]).join(','));
    cur = cur.map(([r, c]) => [c, N - 1 - r]);
  }
  return keys;
}

function canSolve(board) {
  let er = -1, ec = -1;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!board[r][c]) { er = r; ec = c; r = N; break; }
    }
  }
  if (er === -1) return true;

  for (let pi = 0; pi < PIECES.length; pi++) {
    const piece = PIECES[pi];
    if (piece.placed) continue;
    for (const shape of piece.shapes) {
      for (const [ar, ac] of shape) {
        const offR = er - ar;
        const offC = ec - ac;
        let fits = true;
        for (const [sr, sc] of shape) {
          const r = sr + offR, c = sc + offC;
          if (r < 0 || r >= N || c < 0 || c >= N || board[r][c]) { fits = false; break; }
        }
        if (!fits) continue;
        piece.placed = true;
        for (const [sr, sc] of shape) board[sr + offR][sc + offC] = piece.id;
        if (canSolve(board)) {
          piece.placed = false;
          for (const [sr, sc] of shape) board[sr + offR][sc + offC] = null;
          return true;
        }
        piece.placed = false;
        for (const [sr, sc] of shape) board[sr + offR][sc + offC] = null;
      }
    }
  }
  return false;
}

// Also need a solver that returns the solution (for verification)
function solve(board) {
  let er = -1, ec = -1;
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!board[r][c]) { er = r; ec = c; r = N; break; }
    }
  }
  if (er === -1) return board.map(r => [...r]);

  for (let pi = 0; pi < PIECES.length; pi++) {
    const piece = PIECES[pi];
    if (piece.placed) continue;
    for (const shape of piece.shapes) {
      for (const [ar, ac] of shape) {
        const offR = er - ar;
        const offC = ec - ac;
        let fits = true;
        for (const [sr, sc] of shape) {
          const r = sr + offR, c = sc + offC;
          if (r < 0 || r >= N || c < 0 || c >= N || board[r][c]) { fits = false; break; }
        }
        if (!fits) continue;
        piece.placed = true;
        for (const [sr, sc] of shape) board[sr + offR][sc + offC] = piece.id;
        const result = solve(board);
        if (result) {
          piece.placed = false;
          for (const [sr, sc] of shape) board[sr + offR][sc + offC] = null;
          return result;
        }
        piece.placed = false;
        for (const [sr, sc] of shape) board[sr + offR][sc + offC] = null;
      }
    }
  }
  return null;
}

// Generate all grey placements
function* greyPlacements() {
  const g2p = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N - 1; c++) g2p.push([[r, c], [r, c + 1]]);
    for (let c = 0; c < N; c++) if (r < N - 1) g2p.push([[r, c], [r + 1, c]]);
  }
  const g3p = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N - 2; c++) g3p.push([[r, c], [r, c + 1], [r, c + 2]]);
    for (let c = 0; c < N; c++) if (r < N - 2) g3p.push([[r, c], [r + 1, c], [r + 2, c]]);
  }

  for (let r1 = 0; r1 < N; r1++) {
    for (let c1 = 0; c1 < N; c1++) {
      for (const g2 of g2p) {
        if (g2.some(([r, c]) => r === r1 && c === c1)) continue;
        for (const g3 of g3p) {
          let overlap = false;
          for (const [r, c] of g3) {
            if ((r === r1 && c === c1) || g2.some(([gr, gc]) => gr === r && gc === c)) {
              overlap = true; break;
            }
          }
          if (overlap) continue;
          yield { g1: [r1, c1], g2, g3 };
        }
      }
    }
  }
}

// --- Main ---
console.error('Generating all puzzles...');

const seen = new Set();
const puzzles = [];
let tested = 0;
let lastReport = Date.now();

for (const { g1, g2, g3 } of greyPlacements()) {
  tested++;
  if (Date.now() - lastReport > 10000) {
    console.error(`  ${tested} tested, ${puzzles.length} found...`);
    lastReport = Date.now();
  }

  const greyCells = [g1, ...g2, ...g3];
  const canonKey = getCanonicalKey(greyCells);
  if (seen.has(canonKey)) continue;

  const board = Array.from({ length: N }, () => Array(N).fill(null));
  board[g1[0]][g1[1]] = 'g1';
  for (const [r, c] of g2) board[r][c] = 'g2';
  for (const [r, c] of g3) board[r][c] = 'g3';

  for (const p of PIECES) p.placed = false;

  if (canSolve(board)) {
    for (const k of getD4Keys(greyCells)) seen.add(k);
    // Encode: 6 cell indices as base64 chars
    // Order: g1(1), g2a, g2b(2), g3a, g3b, g3c(3)
    const indices = greyCells.map(([r, c]) => r * N + c);
    const encoded = indices.map(i => B64[i]).join('');
    puzzles.push(encoded);
  } else {
    seen.add(canonKey);
  }
}

console.error(`\nDone! ${puzzles.length} D4-unique solvable puzzles found.`);
console.error(`Compact string length: ${puzzles.join('').length} chars`);

// Output the compact string
console.log(puzzles.join(''));
