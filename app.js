const START_SCORE = 7;
const LONG_PRESS_MS = 450;
const LONG_PRESS_CANCEL_THRESHOLD_PX = 14;

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

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

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

function chalkLine(svg, x1, y1, x2, y2, random, strokeBase) {
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("stroke", "#f5f5f5");
  line.setAttribute("stroke-linecap", "round");

  const strokeWidth = strokeBase + random() * 1.8;
  line.setAttribute("stroke-width", strokeWidth.toFixed(2));
  line.setAttribute("opacity", (0.86 + random() * 0.14).toFixed(2));

  svg.append(line);
}

function renderTally(svg, score, seedBase) {
  svg.innerHTML = "";
  const random = seededRandom(seedBase);

  const groups = Math.floor(score / 5);
  const remainder = score % 5;

  const isSmallPhone = window.matchMedia("(max-width: 520px)").matches;
  const strokeBase = isSmallPhone ? 4.7 : 6.9;
  const groupSpace = isSmallPhone ? 54 : 70;
  const remainderSpacing = isSmallPhone ? 12 : 15;
  const crossWidth = isSmallPhone ? 32 : 42;
  const baseX = 18;
  const baseY = 9;
  const barHeight = 122;

  for (let g = 0; g < groups; g += 1) {
    const groupStartX = baseX + g * groupSpace;

    chalkLine(
      svg,
      groupStartX + (random() - 0.5) * 3,
      baseY + 6 + (random() - 0.5) * 3,
      groupStartX + crossWidth + (random() - 0.5) * 3,
      baseY + barHeight - 6 + (random() - 0.5) * 3,
      random,
      strokeBase
    );

    chalkLine(
      svg,
      groupStartX + crossWidth + (random() - 0.5) * 3,
      baseY + 6 + (random() - 0.5) * 3,
      groupStartX + (random() - 0.5) * 3,
      baseY + barHeight - 6 + (random() - 0.5) * 3,
      random,
      strokeBase
    );
  }

  const remStartX = baseX + groups * groupSpace;
  for (let i = 0; i < remainder; i += 1) {
    const jitterX = (random() - 0.5) * 2.4;
    const jitterTop = (random() - 0.5) * 4;
    const jitterBottom = (random() - 0.5) * 4;
    chalkLine(
      svg,
      remStartX + i * remainderSpacing + jitterX,
      baseY + jitterTop,
      remStartX + i * remainderSpacing + jitterX,
      baseY + barHeight + jitterBottom,
      random,
      strokeBase
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

function startNewGame() {
  const confirmed = window.confirm("Neues Spiel starten? Alle Bolla werden gelöscht und alle Spieler auf 7 Striche gesetzt.");
  if (!confirmed) return;

  recordHistory();
  for (const player of state.players) {
    player.score = START_SCORE;
    player.bolla = 0;
  }
  render();
}

function bindScoreInteractions(svg, playerId) {
  let longPressTimer = null;
  let longPressTriggered = false;
  let activePointerId = null;
  let touchFallbackActive = false;
  let pointerStartX = null;
  let pointerStartY = null;

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

  function startPress() {
    longPressTriggered = false;
    clearLongPressTimer();
    longPressTimer = window.setTimeout(() => {
      longPressTriggered = true;
      handleLongPress();
    }, LONG_PRESS_MS);
  }

  function pointerMovedTooFar(event) {
    if (pointerStartX === null || pointerStartY === null) return false;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    const distance = Math.hypot(deltaX, deltaY);
    return distance > LONG_PRESS_CANCEL_THRESHOLD_PX;
  }

  function endPress() {
    clearLongPressTimer();
    if (!longPressTriggered) {
      changeScore(playerId, -1);
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
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    svg.setPointerCapture(event.pointerId);

    startPress();
  });

  svg.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  svg.addEventListener("selectstart", (event) => {
    event.preventDefault();
  });

  svg.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    if (longPressTriggered) return;

    if (pointerMovedTooFar(event)) {
      clearLongPressTimer();
    }
  });

  svg.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    pointerStartX = null;
    pointerStartY = null;
    if (svg.hasPointerCapture(event.pointerId)) {
      svg.releasePointerCapture(event.pointerId);
    }

    endPress();
  });

  svg.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    pointerStartX = null;
    pointerStartY = null;
    clearLongPressTimer();
  });

  svg.addEventListener("lostpointercapture", (event) => {
    if (event.pointerId !== activePointerId) return;

    activePointerId = null;
    pointerStartX = null;
    pointerStartY = null;
    clearLongPressTimer();
  });


  // Fallback für Browser ohne Pointer Events (ältere iOS/Safari Versionen).
  if (!window.PointerEvent) {
    svg.addEventListener(
      "touchstart",
      (event) => {
        if (event.touches.length !== 1) return;
        touchFallbackActive = true;
        event.preventDefault();
        startPress();
      },
      { passive: false }
    );

    const finishTouchFallback = () => {
      if (!touchFallbackActive) return;
      touchFallbackActive = false;
      endPress();
    };

    svg.addEventListener("touchend", finishTouchFallback);
    svg.addEventListener("touchcancel", () => {
      touchFallbackActive = false;
      clearLongPressTimer();
    });
  }
}

function renderCard(player) {
  const cardFragment = cardTemplate.content.cloneNode(true);
  const card = cardFragment.querySelector(".player-card");

  const playerNameBtn = card.querySelector(".player-name");
  playerNameBtn.textContent = player.name;

  const bollaDotsEl = card.querySelector(".bolla-dots");
  bollaDotsEl.innerHTML = bollaDots(player.bolla);

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

newRoundBtn.addEventListener("click", startNewGame);
undoBtn.addEventListener("click", undo);
fullscreenBtn?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", updateFullscreenButton);

initPlayers(state.playerCount, false);
render();
updateUndoState();
updateFullscreenButton();
