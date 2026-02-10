const START_SCORE = 7;
const LONG_PRESS_MS = 900;

const state = {
  playerCount: 4,
  players: [],
  history: []
};

const board = document.getElementById("board");
const playerCountSelect = document.getElementById("playerCount");
const newRoundBtn = document.getElementById("newRoundBtn");
const undoBtn = document.getElementById("undoBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const cardTemplate = document.getElementById("playerCardTemplate");

function createPlayer(index, previous = null) {
  return {
    id: index + 1,
    name: previous?.name ?? `Spieler ${index + 1}`,
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

function seededRandom(seed) {
  let value = seed | 0;
  return () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chalkLine(svg, x1, y1, x2, y2, random) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", "#f5f5f5");
  line.setAttribute("stroke-linecap", "round");

  const strokeWidth = 7.2 + random() * 2.4;
  line.setAttribute("stroke-width", strokeWidth.toFixed(2));
  line.setAttribute("opacity", (0.86 + random() * 0.14).toFixed(2));

  svg.append(line);
}

function renderTally(svg, score, seedBase) {
  svg.innerHTML = "";
  const random = seededRandom(seedBase);

  const groups = Math.floor(score / 5);
  const remainder = score % 5;

  const groupSpace = 64;
  const baseX = 20;
  const baseY = 12;
  const barHeight = 100;

  for (let g = 0; g < groups; g += 1) {
    const groupStartX = baseX + g * groupSpace;

    chalkLine(
      svg,
      groupStartX + (random() - 0.5) * 3,
      baseY + 6 + (random() - 0.5) * 3,
      groupStartX + 38 + (random() - 0.5) * 3,
      baseY + barHeight - 6 + (random() - 0.5) * 3,
      random
    );

    chalkLine(
      svg,
      groupStartX + 38 + (random() - 0.5) * 3,
      baseY + 6 + (random() - 0.5) * 3,
      groupStartX + (random() - 0.5) * 3,
      baseY + barHeight - 6 + (random() - 0.5) * 3,
      random
    );
  }

  const remStartX = baseX + groups * groupSpace;
  for (let i = 0; i < remainder; i += 1) {
    const jitterX = (random() - 0.5) * 2.4;
    const jitterTop = (random() - 0.5) * 4;
    const jitterBottom = (random() - 0.5) * 4;
    chalkLine(
      svg,
      remStartX + i * 14 + jitterX,
      baseY + jitterTop,
      remStartX + i * 14 + jitterX,
      baseY + barHeight + jitterBottom,
      random
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

  const playersStillInRound = state.players.filter((entry) => entry.score > 0);
  if (playersStillInRound.length <= 1) {
    const winner = playersStillInRound[0];
    if (winner) {
      winner.bolla += 1;
    }

    for (const p of state.players) {
      p.score = START_SCORE;
    }
  }

  render();
}

function renamePlayer(playerId) {
  const player = state.players.find((entry) => entry.id === playerId);
  if (!player) return;

  const nextName = window.prompt("Spielernamen eingeben:", player.name);
  if (nextName === null) return;

  const trimmedName = nextName.trim();
  if (!trimmedName) return;

  recordHistory();
  player.name = trimmedName;
  render();
}

function resetRound() {
  recordHistory();
  for (const player of state.players) {
    player.score = START_SCORE;
  }
  render();
}

function bindScoreInteractions(svg, playerId) {
  let longPressTimer = null;
  let longPressTriggered = false;
  let activePointerId = null;

  function handleLongPress() {
    const player = state.players.find((entry) => entry.id === playerId);
    if (!player) return;

    if (player.score === 0) {
      changeScore(playerId, +7);
      return;
    }

    changeScore(playerId, +2);
  }

  function clearLongPressTimer() {
    if (longPressTimer !== null) {
      window.clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

  function isPrimaryPointer(event) {
    if (event.pointerType === "mouse") {
      return event.button === 0;
    }

    return event.isPrimary;
  }

  svg.addEventListener("pointerdown", (event) => {
    if (!isPrimaryPointer(event)) return;

    event.preventDefault();

    activePointerId = event.pointerId;
    svg.setPointerCapture(event.pointerId);

    longPressTriggered = false;
    clearLongPressTimer();
    longPressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      handleLongPress();
    }, LONG_PRESS_MS);
  });

  svg.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }

    clearLongPressTimer();
    if (!longPressTriggered) {
      changeScore(playerId, -1);
    }
  });

  svg.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    clearLongPressTimer();
  });

  svg.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    clearLongPressTimer();
  });

  svg.addEventListener("contextmenu", (event) => event.preventDefault());
}

function renderCard(player) {
  const cardFragment = cardTemplate.content.cloneNode(true);
  const card = cardFragment.querySelector(".player-card");

  const playerNameBtn = card.querySelector(".player-name");
  playerNameBtn.textContent = player.name;

  const bollaDotsEl = card.querySelector(".bolla-dots");
  bollaDotsEl.innerHTML = bollaDots(player.bolla);
  card.querySelector(".bolla-count").textContent = `(${player.bolla})`;

  const svg = card.querySelector(".chalk-score");
  renderTally(svg, player.score, player.id * 1000 + player.score);

  bindScoreInteractions(svg, player.id);
  playerNameBtn.addEventListener("click", () => renamePlayer(player.id));

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

function canUseFullscreen() {
  return Boolean(document.documentElement.requestFullscreen);
}

function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function updateFullscreenButton() {
  if (!fullscreenBtn) return;

  const supported = canUseFullscreen();
  fullscreenBtn.disabled = !supported;
  if (!supported) {
    fullscreenBtn.textContent = "Vollbild nicht verfügbar";
    return;
  }

  fullscreenBtn.textContent = isFullscreenActive() ? "Vollbild beenden" : "Vollbild";
}

async function toggleFullscreen() {
  if (!canUseFullscreen()) return;

  try {
    if (isFullscreenActive()) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.error("Vollbild konnte nicht umgeschaltet werden", error);
  }
}

playerCountSelect.addEventListener("change", (event) => {
  setPlayerCount(Number(event.target.value));
});

newRoundBtn.addEventListener("click", resetRound);
undoBtn.addEventListener("click", undo);
fullscreenBtn?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenButton);

initPlayers(state.playerCount, false);
render();
updateUndoState();
updateFullscreenButton();
