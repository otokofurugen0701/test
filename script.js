const suits = [
  { key: "spades", symbol: "&spades;", color: "black" },
  { key: "hearts", symbol: "&hearts;", color: "red" },
  { key: "diamonds", symbol: "&diams;", color: "red" },
  { key: "clubs", symbol: "&clubs;", color: "black" },
];

const rankLabels = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

const stockEl = document.getElementById("stock");
const wasteEl = document.getElementById("waste");
const foundationsEl = document.getElementById("foundations");
const tableauEl = document.getElementById("tableau");
const newGameButton = document.getElementById("new-game");
const messageEl = document.getElementById("message");

let stock = [];
let waste = [];
let foundations = {};
let tableau = [];
let selected = null;

const TABLEAU_OFFSET = 24;
const DRAW_COUNT = 1;

function buildDeck() {
  const deck = [];
  suits.forEach((suit) => {
    for (let rank = 1; rank <= 13; rank += 1) {
      deck.push({
        suit: suit.key,
        rank,
        color: suit.color,
        faceUp: false,
      });
    }
  });
  return deck;
}

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function rankLabel(rank) {
  return rankLabels[rank] || String(rank);
}

function suitSymbol(suitKey) {
  const suit = suits.find((item) => item.key === suitKey);
  return suit ? suit.symbol : "";
}

function newGame() {
  const deck = buildDeck();
  shuffle(deck);

  foundations = {
    spades: [],
    hearts: [],
    diamonds: [],
    clubs: [],
  };

  tableau = Array.from({ length: 7 }, () => []);
  for (let column = 0; column < 7; column += 1) {
    for (let row = 0; row <= column; row += 1) {
      const card = deck.pop();
      card.faceUp = row === column;
      tableau[column].push(card);
    }
  }

  stock = deck.map((card) => ({ ...card, faceUp: false }));
  waste = [];
  selected = null;
  messageEl.textContent = "";
  render();
}

function getSelectedCards() {
  if (!selected) {
    return [];
  }

  if (selected.source === "waste") {
    if (!waste.length) {
      return [];
    }
    return [waste[waste.length - 1]];
  }

  if (selected.source === "tableau") {
    const column = tableau[selected.column];
    return column.slice(selected.start);
  }

  return [];
}

function isValidSequence(cards) {
  if (!cards.length) {
    return false;
  }
  for (let i = 0; i < cards.length - 1; i += 1) {
    const current = cards[i];
    const next = cards[i + 1];
    if (current.rank !== next.rank + 1) {
      return false;
    }
    if (current.color === next.color) {
      return false;
    }
  }
  return true;
}

function canPlaceOnTableau(card, targetPile) {
  if (!targetPile.length) {
    return card.rank === 13;
  }
  const top = targetPile[targetPile.length - 1];
  return top.faceUp && top.rank === card.rank + 1 && top.color !== card.color;
}

function canPlaceOnFoundation(card, targetPile) {
  if (!targetPile.length) {
    return card.rank === 1;
  }
  const top = targetPile[targetPile.length - 1];
  return top.suit === card.suit && card.rank === top.rank + 1;
}

function flipTopCardIfNeeded(columnIndex) {
  const column = tableau[columnIndex];
  if (column.length && !column[column.length - 1].faceUp) {
    column[column.length - 1].faceUp = true;
  }
}

function removeSelectedFromSource() {
  if (!selected) {
    return;
  }

  if (selected.source === "waste") {
    waste.pop();
    return;
  }

  if (selected.source === "tableau") {
    const column = tableau[selected.column];
    column.splice(selected.start, column.length - selected.start);
    flipTopCardIfNeeded(selected.column);
  }
}

function attemptMoveToTableau(columnIndex) {
  if (!selected) {
    return;
  }

  if (selected.source === "tableau" && selected.column === columnIndex) {
    return;
  }

  const movingCards = getSelectedCards();
  if (!movingCards.length) {
    return;
  }

  if (selected.source === "tableau" && !isValidSequence(movingCards)) {
    return;
  }

  const targetPile = tableau[columnIndex];
  const firstCard = movingCards[0];
  if (!canPlaceOnTableau(firstCard, targetPile)) {
    return;
  }

  removeSelectedFromSource();
  targetPile.push(...movingCards);
  selected = null;
  render();
}

function attemptMoveToFoundation(suitKey) {
  if (!selected) {
    return;
  }

  const movingCards = getSelectedCards();
  if (movingCards.length !== 1) {
    return;
  }

  const card = movingCards[0];
  if (card.suit !== suitKey) {
    return;
  }

  const targetPile = foundations[suitKey];
  if (!canPlaceOnFoundation(card, targetPile)) {
    return;
  }

  removeSelectedFromSource();
  targetPile.push(card);
  selected = null;
  render();
}

function handleStockClick() {
  if (stock.length) {
    const drawCount = Math.min(DRAW_COUNT, stock.length);
    for (let i = 0; i < drawCount; i += 1) {
      const card = stock.pop();
      card.faceUp = true;
      waste.push(card);
    }
  } else if (waste.length) {
    while (waste.length) {
      const card = waste.pop();
      card.faceUp = false;
      stock.push(card);
    }
  }
  selected = null;
  render();
}

function handleWasteClick() {
  if (!waste.length) {
    return;
  }
  if (selected && selected.source === "waste") {
    selected = null;
  } else {
    selected = { source: "waste" };
  }
  render();
}

function handleFoundationClick(event) {
  const pile = event.target.closest(".foundation");
  if (!pile) {
    return;
  }
  attemptMoveToFoundation(pile.dataset.suit);
}

function handleTableauClick(event) {
  const columnEl = event.target.closest(".column");
  if (!columnEl) {
    return;
  }
  const columnIndex = Number(columnEl.dataset.index);
  const cardEl = event.target.closest(".card");

  if (selected) {
    if (
      cardEl &&
      selected.source === "tableau" &&
      selected.column === columnIndex &&
      selected.start === Number(cardEl.dataset.index)
    ) {
      selected = null;
      render();
      return;
    }
    attemptMoveToTableau(columnIndex);
    return;
  }

  if (!cardEl) {
    return;
  }

  const cardIndex = Number(cardEl.dataset.index);
  const card = tableau[columnIndex][cardIndex];
  if (!card.faceUp) {
    return;
  }

  selected = {
    source: "tableau",
    column: columnIndex,
    start: cardIndex,
  };
  render();
}

function renderStock() {
  stockEl.innerHTML = "";
  if (!stock.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = "Reset";
    stockEl.appendChild(placeholder);
    return;
  }

  const cardEl = document.createElement("div");
  cardEl.className = "card face-down";
  stockEl.appendChild(cardEl);

  const countEl = document.createElement("div");
  countEl.className = "count";
  countEl.textContent = String(stock.length);
  stockEl.appendChild(countEl);
}

function renderWaste() {
  wasteEl.innerHTML = "";
  if (!waste.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "placeholder";
    placeholder.textContent = "Waste";
    wasteEl.appendChild(placeholder);
    return;
  }

  const topCard = waste[waste.length - 1];
  const cardEl = createCardElement(topCard);
  if (selected && selected.source === "waste") {
    cardEl.classList.add("selected");
  }
  wasteEl.appendChild(cardEl);
}

function renderFoundations() {
  foundationsEl.innerHTML = "";
  suits.forEach((suit) => {
    const pileEl = document.createElement("div");
    pileEl.className = "pile foundation";
    pileEl.dataset.suit = suit.key;
    const pile = foundations[suit.key];

    if (!pile.length) {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      placeholder.innerHTML = suit.symbol;
      pileEl.appendChild(placeholder);
    } else {
      const topCard = pile[pile.length - 1];
      const cardEl = createCardElement(topCard);
      pileEl.appendChild(cardEl);
    }

    foundationsEl.appendChild(pileEl);
  });
}

function renderTableau() {
  tableauEl.innerHTML = "";
  tableau.forEach((column, columnIndex) => {
    const columnEl = document.createElement("div");
    columnEl.className = "column";
    columnEl.dataset.index = String(columnIndex);

    if (!column.length) {
      const emptySlot = document.createElement("div");
      emptySlot.className = "empty-slot";
      columnEl.appendChild(emptySlot);
    }

    column.forEach((card, cardIndex) => {
      const cardEl = createCardElement(card, cardIndex);
      cardEl.style.top = `${cardIndex * TABLEAU_OFFSET}px`;
      cardEl.dataset.index = String(cardIndex);
      if (
        selected &&
        selected.source === "tableau" &&
        selected.column === columnIndex &&
        cardIndex >= selected.start
      ) {
        cardEl.classList.add("selected");
      }
      columnEl.appendChild(cardEl);
    });

    tableauEl.appendChild(columnEl);
  });
}

function createCardElement(card, index) {
  const cardEl = document.createElement("div");
  cardEl.className = "card";
  if (!card.faceUp) {
    cardEl.classList.add("face-down");
    return cardEl;
  }

  if (card.color === "red") {
    cardEl.classList.add("red");
  }

  const rank = rankLabel(card.rank);
  const symbol = suitSymbol(card.suit);

  cardEl.innerHTML = `
    <div class="corner top"><span class="rank">${rank}</span><span class="suit">${symbol}</span></div>
    <div class="center">${symbol}</div>
    <div class="corner bottom"><span class="rank">${rank}</span><span class="suit">${symbol}</span></div>
  `;

  if (index !== undefined) {
    cardEl.dataset.index = String(index);
  }
  return cardEl;
}

function renderMessage() {
  const isWin = suits.every((suit) => foundations[suit.key].length === 13);
  messageEl.textContent = isWin ? "You win!" : "";
}

function render() {
  renderStock();
  renderWaste();
  renderFoundations();
  renderTableau();
  renderMessage();
}

stockEl.addEventListener("click", handleStockClick);
wasteEl.addEventListener("click", handleWasteClick);
foundationsEl.addEventListener("click", handleFoundationClick);
tableauEl.addEventListener("click", handleTableauClick);
newGameButton.addEventListener("click", newGame);

newGame();
