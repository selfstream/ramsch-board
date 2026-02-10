const START_SCORE = 7;
const MAX_HINT = 20;

const state = {
  playerCount: 4,
  players: [],
  history: []
};

const board = document.getElementById("board");
const playerCountSelect = document.getElementById("playerCount");
const newRoundBtn = document.getElementById("newRoundBtn");
const undoBtn = document.getElementById("undoBtn");
const cardTemplate = document.getElementById("playerCardTemplate");

function createPlayer(index, previous = null) {
  return {
    id: index + 1,
    name: `Spieler ${index + 1}`,
    score: previous?.score ?? START_SCORE,
    bolla: previous?.bolla ?? 0
  };
}

function initPlayers(count, preserve = true) {
  const oldById = new Map(state.players.map((player) => [player.id, player]));
  state.players = Array.from({ length: count }, (_, index) => {
    const existing = preserve ? oldById.get(index + 1) : null;
    return createPlayer(index, existing);
  });
}

function cloneStateSnapshot() {
  return {
    playerCount: state.playerCount,
    players: state.players.map((player) => ({ ...player }))
  };
}

function restoreSnapshot(snapshot) {
  state.playerCount = snapshot.playerCount;
  playerCountSelect.value = String(snapshot.playerCount);
  state.players = snapshot.players.map((player) => ({ ...player }));
  render();
}

function recordHistory() {
  state.history.push(cloneStateSnapshot());
  if (state.history.length > 200) {
    state.history.shift();
  }
  updateUndoState();
}

function undo() {
  const snapshot = state.history.pop();
  if (!snapshot) return;
  restoreSnapshot(snapshot);
  updateUndoState();
}

function updateUndoState() {
  undoBtn.disabled = state.history.length === 0;
}

function chalkLine(svg, x1, y1, x2, y2) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", "#f5f5f5");
  line.setAttribute("stroke-linecap", "round");

  const strokeWidth = 4.2 + Math.random() * 1.7;
  line.setAttribute("stroke-width", strokeWidth.toFixed(2));
  line.setAttribute("opacity", (0.86 + Math.random() * 0.14).toFixed(2));

  svg.append(line);
}

function renderTally(svg, score) {
  svg.innerHTML = "";

  const groups = Math.floor(score / 5);
  const remainder = score % 5;

  const groupSpace = 48;
  let baseX = 18;
  const baseY = 22;
  const barHeight = 82;

  for (let g = 0; g < groups; g += 1) {
    const groupStartX = baseX + g * groupSpace;

    for (let i = 0; i < 4; i += 1) {
      const jitterX = (Math.random() - 0.5) * 2.4;
      const jitterTop = (Math.random() - 0.5) * 4;
      const jitterBottom = (Math.random() - 0.5) * 4;
      chalkLine(
        svg,
        groupStartX + i * 9 + jitterX,
        baseY + jitterTop,
        groupStartX + i * 9 + jitterX,
        baseY + barHeight + jitterBottom
      );
    }

    chalkLine(
      svg,
      groupStartX - 5 + (Math.random() - 0.5) * 3,
      baseY + barHeight - 8 + (Math.random() - 0.5) * 3,
      groupStartX + 31 + (Math.random() - 0.5) * 3,
      baseY + 8 + (Math.random() - 0.5) * 3
    );
  }

  const remStartX = baseX + groups * groupSpace;
  for (let i = 0; i < remainder; i += 1) {
    const jitterX = (Math.random() - 0.5) * 2.4;
    const jitterTop = (Math.random() - 0.5) * 4;
    const jitterBottom = (Math.random() - 0.5) * 4;
    chalkLine(
      svg,
      remStartX + i * 10 + jitterX,
      baseY + jitterTop,
      remStartX + i * 10 + jitterX,
      baseY + barHeight + jitterBottom
    );
  }
}

function bollaDots(count) {
  return Array.from({ length: count }, () => '<span class="bolla-dot" aria-hidden="true"></span>').join("");
}

function changeScore(playerId, delta) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return;

  recordHistory();

  player.score = Math.max(0, player.score + delta);

  if (player.score === 0) {
    player.bolla += 1;
    for (const p of state.players) {
      p.score = START_SCORE;
    }
  }

  render();
}

function resetRound() {
  recordHistory();
  for (const player of state.players) {
    player.score = START_SCORE;
  }
  render();
}

function renderCard(player) {
  const cardFragment = cardTemplate.content.cloneNode(true);
  const card = cardFragment.querySelector(".player-card");

  card.querySelector(".player-name").textContent = player.name;

  const scoreLabel = card.querySelector(".numeric-score");
  scoreLabel.textContent = `${player.score} Punkte${player.score > MAX_HINT ? " (hoch)" : ""}`;

  const bollaDotsEl = card.querySelector(".bolla-dots");
  bollaDotsEl.innerHTML = bollaDots(player.bolla);
  card.querySelector(".bolla-count").textContent = `(${player.bolla})`;

  const svg = card.querySelector(".chalk-score");
  renderTally(svg, player.score);

  card.querySelector(".minus-btn").addEventListener("click", () => changeScore(player.id, -1));
  card.querySelector(".plus-btn").addEventListener("click", () => changeScore(player.id, +1));

  return cardFragment;
}

function render() {
  board.textContent = "";
  board.classList.remove("layout-2", "layout-3", "layout-4");
  board.classList.add(`layout-${state.playerCount}`);

  for (const player of state.players) {
    board.append(renderCard(player));
  }
}

function setPlayerCount(count) {
  if (count === state.playerCount) return;
  recordHistory();
  state.playerCount = count;
  initPlayers(count, true);
  render();
}

playerCountSelect.addEventListener("change", (event) => {
  setPlayerCount(Number(event.target.value));
});

newRoundBtn.addEventListener("click", resetRound);
undoBtn.addEventListener("click", undo);

initPlayers(state.playerCount, false);
render();
updateUndoState();
