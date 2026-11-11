import { loadTeams } from "./api.js";
import { createGameState, ejecutarTurno, getActivePokemon, resolveNextAction, resolveRound } from "./battle.js";
import { actualizarInterfaz, hideChoices, playBattleAnimations, showApiFallbackNotice, showChoices, showLoading } from "./ui.js";

export let gameState = null;
let visibleActions = [];

function showValidationError(message) {
  document.getElementById("action-hint").textContent = message;
}

async function commitAction(action) {
  const result = ejecutarTurno(gameState, gameState.currentTurn, action);
  if (!result.ok) {
    showValidationError(result.message);
    return;
  }
  hideChoices();
  if (gameState.phase === "resolving") resolveRound(gameState);
  actualizarInterfaz(gameState);
}

function handleMainAction(type) {
  const player = gameState.currentTurn;
  const pokemon = getActivePokemon(gameState, player);
  if (type === "fight" && pokemon.hpActual <= 0) {
    showValidationError("Este Pokémon está debilitado; elige otro de tu equipo.");
    return;
  }
  if (type === "flee") {
    commitAction({ type });
    return;
  }
  visibleActions = showChoices(gameState, type);
}

function bindEvents() {
  document.getElementById("continue-button").addEventListener("click", async () => {
    if (gameState.isAnimating) return;
    if (gameState.phase === "resolving") {
      if (!resolveNextAction(gameState)) {
        actualizarInterfaz(gameState);
        return;
      }
      gameState.isAnimating = gameState.animationEvents.length > 0;
      actualizarInterfaz(gameState);
      if (gameState.isAnimating) {
        await playBattleAnimations(gameState.animationEvents);
        gameState.isAnimating = false;
        actualizarInterfaz(gameState);
      }
    } else if (gameState.phase === "messages") {
      if (gameState.messageQueue.length) {
        gameState.lastMessage = gameState.messageQueue.shift();
      } else {
        gameState.phase = gameState.winner === null ? "handoff" : "finished";
        if (gameState.winner === null) {
          gameState.round += 1;
          gameState.lastMessage = `Ronda ${gameState.round} lista. Entrenador 1, prepara tu elección.`;
        }
      }
    } else if (gameState.phase === "handoff" && gameState.currentTurn === 1) {
      gameState.phase = "choose";
      gameState.lastMessage = "Entrenador 2, elige tu acción sin mirar la elección anterior.";
    } else if (gameState.phase === "handoff" && gameState.currentTurn === 0) {
      gameState.phase = "choose";
      gameState.lastMessage = `Ronda ${gameState.round}: Entrenador 1, elige tu acción.`;
    }
    hideChoices();
    actualizarInterfaz(gameState);
  });

  document.getElementById("main-actions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (button && gameState.phase === "choose") handleMainAction(button.dataset.action);
  });

  document.getElementById("choice-panel").addEventListener("click", (event) => {
    const backButton = event.target.closest("[data-choice-back]");
    if (backButton) {
      visibleActions = [];
      hideChoices();
      actualizarInterfaz(gameState);
      return;
    }
    const button = event.target.closest("[data-choice]");
    if (!button || button.disabled) return;
    const action = visibleActions[Number(button.dataset.choice)];
    if (action) commitAction(action);
  });
}

function playIntro() {
  const arena = document.querySelector(".arena");
  return new Promise((resolve) => {
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(fallbackTimer);
      arena.removeEventListener("animationend", onAnimationEnd);
      arena.classList.remove("intro-playing");
      resolve();
    };
    const onAnimationEnd = (event) => {
      if (event.target.id === "player-sprite" && event.animationName === "pokemon-enter-player") finish();
    };
    const fallbackTimer = window.setTimeout(finish, 2500);
    arena.addEventListener("animationend", onAnimationEnd);
    arena.classList.add("intro-playing");
  });
}

async function initializeGame() {
  showLoading(true);
  bindEvents();
  try {
    const teams = await loadTeams();
    gameState = createGameState(teams);
    const fallbacks = teams.flat().filter((pokemon) => pokemon.isFallback).map((pokemon) => pokemon.name);
    showApiFallbackNotice(fallbacks);
    actualizarInterfaz(gameState);
    await playIntro();
    gameState.phase = "handoff";
    gameState.lastMessage = "¡Los Pokémon están listos! Comienza el Entrenador 1.";
    actualizarInterfaz(gameState);
  } catch (error) {
    document.getElementById("error-notice").textContent = `No se pudo iniciar la partida: ${error.message}`;
    document.getElementById("error-notice").classList.remove("is-hidden");
    document.getElementById("battle-message").textContent = "No se pudieron preparar los equipos. Recarga la página para volver a intentar.";
    console.error("Error al iniciar la batalla:", error);
  } finally {
    showLoading(false);
  }
}

initializeGame();
