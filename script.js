const SIZE = 8;
const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

const boardEl = document.getElementById("board");
const messageEl = document.getElementById("message");
const currentPlayerEl = document.getElementById("current-player");
const blackCountEl = document.getElementById("black-count");
const whiteCountEl = document.getElementById("white-count");
const resetButton = document.getElementById("reset");

const playerNames = {
  B: "Black",
  W: "White",
};

let board = [];
let currentPlayer = "B";
let validMoves = new Map();
let gameOver = false;
let message = "";

function createInitialBoard() {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  const mid = SIZE / 2;
  grid[mid - 1][mid - 1] = "W";
  grid[mid][mid] = "W";
  grid[mid - 1][mid] = "B";
  grid[mid][mid - 1] = "B";
  return grid;
}

function buildBoardUI() {
  boardEl.innerHTML = "";
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", handleCellClick);
      boardEl.appendChild(cell);
    }
  }
}

function initGame() {
  board = createInitialBoard();
  currentPlayer = "B";
  validMoves = new Map();
  gameOver = false;
  message = "";
  prepareTurn("B");
  render();
}

function handleCellClick(event) {
  if (gameOver) {
    return;
  }
  const cell = event.currentTarget;
  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const key = `${row},${col}`;
  const flips = validMoves.get(key);
  if (!flips) {
    return;
  }
  applyMove(row, col, flips);
  prepareTurn(getOpponent(currentPlayer));
  render();
}

function applyMove(row, col, flips) {
  board[row][col] = currentPlayer;
  flips.forEach(([r, c]) => {
    board[r][c] = currentPlayer;
  });
}

function getOpponent(player) {
  return player === "B" ? "W" : "B";
}

function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

function getFlipsForMove(player, row, col) {
  if (board[row][col] !== null) {
    return [];
  }
  const opponent = getOpponent(player);
  const flips = [];
  for (const [dRow, dCol] of DIRS) {
    let r = row + dRow;
    let c = col + dCol;
    const line = [];
    while (inBounds(r, c) && board[r][c] === opponent) {
      line.push([r, c]);
      r += dRow;
      c += dCol;
    }
    if (line.length > 0 && inBounds(r, c) && board[r][c] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

function getValidMovesFor(player) {
  const moves = new Map();
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] !== null) {
        continue;
      }
      const flips = getFlipsForMove(player, row, col);
      if (flips.length > 0) {
        moves.set(`${row},${col}`, flips);
      }
    }
  }
  return moves;
}

function countPieces() {
  let black = 0;
  let white = 0;
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if (board[row][col] === "B") {
        black += 1;
      } else if (board[row][col] === "W") {
        white += 1;
      }
    }
  }
  return { black, white };
}

function playerName(player) {
  return playerNames[player] || "Unknown";
}

function prepareTurn(nextPlayer) {
  gameOver = false;
  const nextMoves = getValidMovesFor(nextPlayer);
  if (nextMoves.size > 0) {
    currentPlayer = nextPlayer;
    validMoves = nextMoves;
    message = `${playerName(currentPlayer)} to move.`;
    return;
  }

  const other = getOpponent(nextPlayer);
  const otherMoves = getValidMovesFor(other);
  if (otherMoves.size > 0) {
    currentPlayer = other;
    validMoves = otherMoves;
    message = `Pass: ${playerName(nextPlayer)} has no valid moves.`;
    return;
  }

  currentPlayer = nextPlayer;
  validMoves = new Map();
  gameOver = true;
  const counts = countPieces();
  let outcome = "Draw.";
  if (counts.black > counts.white) {
    outcome = "Black wins.";
  } else if (counts.white > counts.black) {
    outcome = "White wins.";
  }
  message = `Game over. Black ${counts.black} - White ${counts.white}. ${outcome}`;
}

function buildCellLabel(row, col, value, isValid) {
  const base = `Row ${row + 1} Column ${col + 1}`;
  if (value === "B") {
    return `${base}, Black`;
  }
  if (value === "W") {
    return `${base}, White`;
  }
  if (isValid && !gameOver) {
    return `${base}, empty, valid move`;
  }
  return `${base}, empty`;
}

function render() {
  const counts = countPieces();
  blackCountEl.textContent = counts.black;
  whiteCountEl.textContent = counts.white;
  currentPlayerEl.textContent = playerName(currentPlayer);
  messageEl.textContent = message;
  boardEl.classList.toggle("is-over", gameOver);
  boardEl.setAttribute("aria-disabled", gameOver ? "true" : "false");

  const cells = boardEl.querySelectorAll(".cell");
  cells.forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const value = board[row][col];
    const key = `${row},${col}`;
    const isValid = validMoves.has(key);

    cell.classList.remove("black", "white", "valid");
    if (value === "B") {
      cell.classList.add("black");
    } else if (value === "W") {
      cell.classList.add("white");
    }
    if (!gameOver && isValid) {
      cell.classList.add("valid");
    }
    cell.setAttribute("aria-label", buildCellLabel(row, col, value, isValid));
  });
}

buildBoardUI();
initGame();
resetButton.addEventListener("click", initGame);
