import { loadTeams } from "./api.js";
import { createGameState, ejecutarTurno, getActivePokemon, replaceFaintedPokemon, resolveNextAction, resolveRound } from "./battle.js";
import { actualizarInterfaz, hideChoices, hideGameOverScreen, playBattleAnimations, showChoices, showFightOptions, showLoading, showMainActions } from "./ui.js";

export let gameState = null;
let visibleActions = [];
let autoRunActive = false;

function showScreen(screenId) {
  ["menu-screen", "trainer-screen", "settings-screen"].forEach((id) => {
    document.getElementById(id).classList.toggle("is-hidden", id !== screenId);
  });
}

function bindMenuEvents() {
  document.getElementById("open-trainer-select").addEventListener("click", () => showScreen("trainer-screen"));
  document.getElementById("open-settings").addEventListener("click", () => showScreen("settings-screen"));
  document.querySelectorAll("[data-screen='menu']").forEach((button) => {
    button.addEventListener("click", () => showScreen("menu-screen"));
  });
  document.getElementById("font-size-setting").addEventListener("input", (event) => {
    document.documentElement.style.setProperty("--type-scale", event.target.value);
  });
  document.querySelectorAll(".palette-option").forEach((button) => {
    button.addEventListener("click", () => {
      document.body.dataset.palette = button.dataset.palette;
      document.querySelectorAll(".palette-option").forEach((option) => {
        const selected = option === button;
        option.classList.toggle("is-selected", selected);
        option.setAttribute("aria-pressed", String(selected));
      });
    });
  });
  [["trainer-one", "one"], ["trainer-two", "two"]].forEach(([selectId, avatarId]) => {
    const select = document.getElementById(selectId);
    select.addEventListener("change", () => updateTrainerAvatar(select, avatarId));
  });
  document.getElementById("start-battle").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await initializeGame([
        document.getElementById("trainer-one").value,
        document.getElementById("trainer-two").value
      ]);
    } finally {
      button.disabled = false;
    }
  });
}

function updateTrainerAvatar(select, avatarId) {
  const avatar = document.querySelector(`[data-avatar="${avatarId}"]`);
  const trainer = select.value;
  const avatarStyles = {
    Red: ["R", "trainer-avatar-red"],
    Misty: ["M", "trainer-avatar-misty"],
    Brock: ["B", "trainer-avatar-brock"],
    Leaf: ["L", "trainer-avatar-leaf"]
  };
  const [initial, className] = avatarStyles[trainer];
  avatar.textContent = initial;
  avatar.className = `trainer-avatar ${className}`;
}

function showValidationError(message) {
  document.getElementById("action-hint").textContent = message;
}

function returnToMenu() {
  gameState = null;
  visibleActions = [];
  hideGameOverScreen();
  showLoading(false);
  document.getElementById("battle-layout").classList.add("is-hidden");
  document.getElementById("error-notice").classList.add("is-hidden");
  document.querySelector(".footer-note").classList.add("is-hidden");
  showScreen("menu-screen");
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function runAutomaticFlow() {
  if (autoRunActive) return;
  autoRunActive = true;
  try {
    while (gameState && gameState.phase !== "finished") {
      if (gameState.phase === "handoff") {
        await wait(1200);
        if (gameState.phase !== "handoff") continue;
        gameState.phase = "choose";
        gameState.lastMessage = gameState.currentTurn === 1
          ? `${gameState.trainerNames[1]}, elige tu acción.`
          : `Ronda ${gameState.round}: ${gameState.trainerNames[0]}, elige tu acción.`;
        actualizarInterfaz(gameState);
      } else if (gameState.phase === "resolving") {
        await wait(1100);
        if (gameState.phase !== "resolving") continue;
        if (!resolveNextAction(gameState)) {
          actualizarInterfaz(gameState);
          continue;
        }
        gameState.isAnimating = gameState.animationEvents.length > 0;
        actualizarInterfaz(gameState);
        if (gameState.isAnimating) {
          await playBattleAnimations(gameState.animationEvents);
          gameState.isAnimating = false;
        }
        actualizarInterfaz(gameState);
      } else if (gameState.phase === "forced-switch") {
        visibleActions = await showChoices(gameState, "switch");
        break;
      } else if (gameState.phase === "messages") {
        await wait(1300);
        if (gameState.phase !== "messages") continue;
        if (gameState.messageQueue.length) {
          gameState.lastMessage = gameState.messageQueue.shift();
        } else {
          gameState.phase = gameState.winner === null ? "handoff" : "finished";
          if (gameState.winner === null) {
            gameState.round += 1;
            gameState.currentTurn = 0;
            gameState.lastMessage = `Ronda ${gameState.round} lista.`;
          }
        }
        actualizarInterfaz(gameState);
      } else {
        break;
      }
    }
  } finally {
    autoRunActive = false;
  }
}

async function commitAction(action) {
  const result = ejecutarTurno(gameState, gameState.currentTurn, action);
  if (!result.ok) {
    showValidationError(result.message);
    return;
  }
  await hideChoices();
  showMainActions();
  if (gameState.phase === "resolving") resolveRound(gameState);
  actualizarInterfaz(gameState);
  runAutomaticFlow();
}

async function handleMainAction(type) {
  const player = gameState.currentTurn;
  const pokemon = getActivePokemon(gameState, player);
  if (type === "fight") {
    if (pokemon.hpActual <= 0) {
      showValidationError("Este Pokémon está debilitado; elige otro de tu equipo.");
      return;
    }
    visibleActions = showFightOptions(gameState);
    return;
  }
  if (type === "flee") {
    await commitAction({ type });
    return;
  }
  visibleActions = await showChoices(gameState, type);
}

function bindEvents() {
  document.getElementById("restart-game").addEventListener("click", async (event) => {
    if (!gameState) return;
    const trainerNames = [...gameState.trainerNames];
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await initializeGame(trainerNames);
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById("return-to-menu").addEventListener("click", returnToMenu);

  document.getElementById("action-panel").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action='back']");
    if (!button || gameState.phase !== "choose") return;
    visibleActions = [];
    showMainActions();
  });

  document.getElementById("main-actions").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button || gameState.phase !== "choose") return;
    if (button.dataset.action === "attack") {
      const action = visibleActions[Number(button.dataset.choice)];
      if (action) await commitAction(action);
      return;
    }
    if (button.dataset.action === "back") {
      visibleActions = [];
      showMainActions();
      return;
    }
    await handleMainAction(button.dataset.action);
  });

  document.getElementById("selection-modal").addEventListener("click", async (event) => {
    const modal = document.getElementById("selection-modal");
    const forcedSwitch = modal.dataset.forcedSwitch === "true";
    if (event.target.id === "selection-modal" || event.target.closest("#selection-close,#selection-cancel")) {
      if (forcedSwitch) return;
      if (event.target.closest("#selection-cancel") && modal.dataset.choiceType === "potion-target") {
        visibleActions = await showChoices(gameState, "potion");
        return;
      }
      visibleActions = [];
      await hideChoices();
      if (gameState.phase === "choose") actualizarInterfaz(gameState);
      return;
    }
    const button = event.target.closest("[data-choice]");
    if (!button || button.disabled) return;
    const action = visibleActions[Number(button.dataset.choice)];
    if (!action) return;
    if (action.type === "potion-select") {
      visibleActions = await showChoices(gameState, "potion-target", action.potionType);
      return;
    }
    if (forcedSwitch) {
      const result = replaceFaintedPokemon(gameState, action.teamIndex);
      if (!result.ok) {
        showValidationError(result.message);
        return;
      }
      visibleActions = [];
      await hideChoices();
      actualizarInterfaz(gameState);
      runAutomaticFlow();
      return;
    }
    await commitAction(action);
  });

  document.addEventListener("keydown", async (event) => {
    if (event.key === "Escape" && !document.getElementById("selection-modal").classList.contains("is-hidden")) {
      if (document.getElementById("selection-modal").dataset.forcedSwitch === "true") return;
      visibleActions = [];
      await hideChoices();
      if (gameState.phase === "choose") actualizarInterfaz(gameState);
    }
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
      arena.classList.add("intro-complete");
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

async function initializeGame(trainerNames) {
  hideGameOverScreen();
  showScreen(null);
  document.getElementById("battle-layout").classList.remove("is-hidden");
  document.querySelector(".footer-note").classList.remove("is-hidden");
  document.getElementById("error-notice").classList.add("is-hidden");
  showLoading(true);
  try {
    const teams = await loadTeams();
    gameState = createGameState(teams, trainerNames);
    document.getElementById("intro-trainer-one").textContent = trainerNames[0];
    document.getElementById("intro-trainer-two").textContent = trainerNames[1];
    actualizarInterfaz(gameState);
    await playIntro();
    gameState.phase = "handoff";
    gameState.lastMessage = `¡Los Pokémon están listos! Comienza ${trainerNames[0]}.`;
    actualizarInterfaz(gameState);
    runAutomaticFlow();
  } catch (error) {
    document.getElementById("error-notice").textContent = `No se pudo iniciar la partida: ${error.message}`;
    document.getElementById("error-notice").classList.remove("is-hidden");
    document.getElementById("battle-message").textContent = "No se pudieron preparar los equipos. Recarga la página para volver a intentar.";
    console.error("Error al iniciar la batalla:", error);
  } finally {
    showLoading(false);
  }
}

function initializeApp() {
  bindMenuEvents();
  bindEvents();
  updateTrainerAvatar(document.getElementById("trainer-one"), "one");
  updateTrainerAvatar(document.getElementById("trainer-two"), "two");
}

initializeApp();
