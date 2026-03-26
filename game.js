/* ===== Emma's Easter Egg Hunt — Bunny Trail Puzzle ===== */

const CLUE = "GRANNYS BED";
const CLUE_LETTERS = CLUE.replace(/ /g, "").split(""); // 10 letters
const ROWS = 6;
const COLS = 6;

/*  Cell types: 0 = wall, 1 = open path, 2 = egg, 3 = start  */
const LEVEL = [
    [3, 1, 2, 1, 2, 0],
    [0, 0, 1, 2, 1, 0],
    [1, 2, 1, 0, 0, 0],
    [2, 0, 1, 2, 1, 0],
    [1, 2, 1, 0, 1, 2],
    [2, 1, 1, 2, 1, 1],
];

/* ===== State ===== */
let bunnyPos = null;       // { r, c }
let visited = [];          // Set-like 2D bool array
let path = [];             // ordered list of {r,c} for undo
let eggsCollected = 0;
let totalOpen = 0;
let stuckTimeout = null;

/* ===== DOM refs ===== */
const gridEl = document.getElementById("grid");
const clueEl = document.getElementById("clue-letters");
const undoBtn = document.getElementById("undo-btn");
const resetBtn = document.getElementById("reset-btn");
const stepCountEl = document.getElementById("step-count");
const winOverlay = document.getElementById("win-overlay");
const winClue = document.getElementById("win-clue");
const playAgainBtn = document.getElementById("play-again-btn");
const stuckToast = document.getElementById("stuck-toast");

/* ===== Init ===== */
function init() {
    bunnyPos = null;
    visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    path = [];
    eggsCollected = 0;
    totalOpen = 0;

    buildClueBar();
    buildGrid();
    updateStepCount();
    winOverlay.classList.add("hidden");
    hideStuckToast();
}

/* ===== Clue bar ===== */
function buildClueBar() {
    clueEl.innerHTML = "";
    let letterIdx = 0;
    for (const ch of CLUE) {
        if (ch === " ") {
            const spacer = document.createElement("div");
            spacer.className = "clue-space";
            clueEl.appendChild(spacer);
        } else {
            const el = document.createElement("div");
            el.className = "clue-letter";
            el.dataset.index = letterIdx;
            el.textContent = ch;
            clueEl.appendChild(el);
            letterIdx++;
        }
    }
}

function revealNextLetter() {
    const el = clueEl.querySelector(`.clue-letter[data-index="${eggsCollected}"]`);
    if (el) el.classList.add("revealed");
}

/* ===== Grid ===== */
function buildGrid() {
    gridEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const type = LEVEL[r][c];
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.r = r;
            cell.dataset.c = c;

            if (type === 0) {
                cell.classList.add("wall");
            } else {
                cell.classList.add("path");
                totalOpen++;

                if (type === 3) {
                    bunnyPos = { r, c };
                    visited[r][c] = true;
                    path.push({ r, c });
                    cell.classList.add("visited", "bunny");
                    cell.innerHTML = '<span class="emoji">&#x1F430;</span>';
                } else if (type === 2) {
                    cell.innerHTML = '<span class="emoji">&#x1F95A;</span>';
                }

                cell.addEventListener("click", () => onCellTap(r, c));
            }

            gridEl.appendChild(cell);
        }
    }
    highlightValidMoves();
}

/* ===== Tap handler ===== */
function onCellTap(r, c) {
    if (!isAdjacent(bunnyPos, r, c)) return;
    if (visited[r][c]) return;
    if (LEVEL[r][c] === 0) return;

    hideStuckToast();
    moveBunny(r, c);
}

function moveBunny(r, c) {
    const oldCell = getCellEl(bunnyPos.r, bunnyPos.c);
    oldCell.classList.remove("bunny");
    oldCell.innerHTML = "";

    visited[r][c] = true;
    path.push({ r, c });
    bunnyPos = { r, c };

    const newCell = getCellEl(r, c);
    const isEgg = LEVEL[r][c] === 2;

    if (isEgg) {
        newCell.classList.add("egg-collect");
        setTimeout(() => {
            newCell.classList.remove("egg-collect");
            newCell.innerHTML = '<span class="emoji">&#x1F430;</span>';
        }, 350);
        revealNextLetter();
        eggsCollected++;
    } else {
        newCell.innerHTML = '<span class="emoji">&#x1F430;</span>';
    }

    newCell.classList.add("visited", "bunny");
    undoBtn.disabled = false;
    updateStepCount();
    clearValidMoves();
    highlightValidMoves();

    if (path.length === totalOpen) {
        setTimeout(showWin, 400);
    } else {
        checkStuck();
    }
}

/* ===== Undo ===== */
function undo() {
    if (path.length <= 1) return;

    hideStuckToast();

    const current = path.pop();
    const curCell = getCellEl(current.r, current.c);
    curCell.classList.remove("bunny", "visited");
    curCell.innerHTML = "";
    visited[current.r][current.c] = false;

    if (LEVEL[current.r][current.c] === 2) {
        eggsCollected--;
        curCell.innerHTML = '<span class="emoji">&#x1F95A;</span>';
        unrevealLetter();
    }

    const prev = path[path.length - 1];
    bunnyPos = { r: prev.r, c: prev.c };
    const prevCell = getCellEl(prev.r, prev.c);
    prevCell.classList.add("bunny");
    prevCell.innerHTML = '<span class="emoji">&#x1F430;</span>';

    undoBtn.disabled = path.length <= 1;
    updateStepCount();
    clearValidMoves();
    highlightValidMoves();
}

function unrevealLetter() {
    const el = clueEl.querySelector(`.clue-letter[data-index="${eggsCollected}"]`);
    if (el) el.classList.remove("revealed");
}

/* ===== Valid moves ===== */
function highlightValidMoves() {
    const moves = getValidMoves(bunnyPos);
    for (const { r, c } of moves) {
        getCellEl(r, c).classList.add("valid-move");
    }
}

function clearValidMoves() {
    gridEl.querySelectorAll(".valid-move").forEach(el => el.classList.remove("valid-move"));
}

function getValidMoves(pos) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const moves = [];
    for (const [dr, dc] of dirs) {
        const nr = pos.r + dr;
        const nc = pos.c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS &&
            LEVEL[nr][nc] !== 0 && !visited[nr][nc]) {
            moves.push({ r: nr, c: nc });
        }
    }
    return moves;
}

/* ===== Stuck detection ===== */
function checkStuck() {
    const moves = getValidMoves(bunnyPos);
    if (moves.length === 0 && path.length < totalOpen) {
        showStuckToast();
    }
}

function showStuckToast() {
    stuckToast.classList.remove("hidden");
    clearTimeout(stuckTimeout);
    stuckTimeout = setTimeout(hideStuckToast, 4000);
}

function hideStuckToast() {
    stuckToast.classList.add("hidden");
    clearTimeout(stuckTimeout);
}

/* ===== Win ===== */
function showWin() {
    winClue.textContent = CLUE;
    winOverlay.classList.remove("hidden");
}

/* ===== Helpers ===== */
function isAdjacent(pos, r, c) {
    const dr = Math.abs(pos.r - r);
    const dc = Math.abs(pos.c - c);
    return (dr + dc) === 1;
}

function getCellEl(r, c) {
    return gridEl.children[r * COLS + c];
}

function updateStepCount() {
    stepCountEl.textContent = `${path.length} / ${totalOpen}`;
}

/* ===== Event listeners ===== */
undoBtn.addEventListener("click", undo);
resetBtn.addEventListener("click", init);
playAgainBtn.addEventListener("click", init);

/* ===== Go! ===== */
init();
