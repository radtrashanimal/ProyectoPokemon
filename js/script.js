import { loadTeams } from "./api.js";
import { createGameState, ejecutarTurno, getActivePokemon, replaceFaintedPokemon, resolveNextAction, resolveRound } from "./battle.js";
import { actualizarInterfaz, hideChoices, hideGameOverScreen, playBattleAnimations, showChoices, showFightOptions, showLoading, showMainActions } from "./ui.js";

export let gameState = null;
let visibleActions = [];
let autoRunActive = false;
let pokemonDraftState = null;
const DRAFT_TEAM_SIZE = 4;

function showScreen(screenId) {
  ["menu-screen", "trainer-screen", "pokemon-draft-screen", "settings-screen"].forEach((id) => {
    document.getElementById(id).classList.toggle("is-hidden", id !== screenId);
  });
  document.body.classList.toggle("menu-background-active", screenId === "menu-screen" || screenId === "settings-screen");
}

function bindMenuEvents() {
  document.getElementById("open-trainer-select").addEventListener("click", () => showScreen("trainer-screen"));
  document.getElementById("open-settings").addEventListener("click", () => showScreen("settings-screen"));
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.screen));
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
  document.getElementById("open-pokemon-draft").addEventListener("click", async (event) => {
    await preparePokemonDraft(event.currentTarget);
  });
  document.getElementById("pokemon-draft-choices").addEventListener("click", (event) => {
    const button = event.target.closest("[data-pokemon-index]");
    if (button) choosePokemonForDraft(Number(button.dataset.pokemonIndex));
  });
  document.getElementById("undo-pokemon-pick").addEventListener("click", undoPokemonPick);
  document.getElementById("start-battle").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (!pokemonDraftState || pokemonDraftState.history.length !== DRAFT_TEAM_SIZE * 2) return;
    button.disabled = true;
    try {
      await initializeGame(pokemonDraftState.trainerNames, pokemonDraftState.teams);
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

function preparePokemonDraftCard(pokemon, index, currentPlayer) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pokemon-draft-choice";
  button.dataset.pokemonIndex = String(index);
  button.setAttribute("aria-label", `Elegir ${pokemon.name} para ${pokemonDraftState.trainerNames[currentPlayer]}`);
  const sprite = document.createElement("img");
  sprite.src = pokemon.sprite;
  sprite.alt = "";
  const name = document.createElement("span");
  name.textContent = pokemon.name;
  button.append(sprite, name);
  return button;
}

function renderPokemonDraftTeam(containerId, countId, team) {
  const container = document.getElementById(containerId);
  container.replaceChildren();
  for (let index = 0; index < DRAFT_TEAM_SIZE; index += 1) {
    const pokemon = team[index];
    const slot = document.createElement("div");
    slot.className = `pokemon-draft-team-slot${pokemon ? "" : " is-empty"}`;
    if (pokemon) {
      const sprite = document.createElement("img");
      sprite.src = pokemon.sprite;
      sprite.alt = "";
      const name = document.createElement("span");
      name.textContent = pokemon.name;
      slot.append(sprite, name);
    } else {
      slot.textContent = `Pokémon ${index + 1}`;
    }
    container.append(slot);
  }
  document.getElementById(countId).textContent = `${team.length}/${DRAFT_TEAM_SIZE}`;
}

function renderPokemonDraft() {
  const state = pokemonDraftState;
  const isComplete = state.history.length === DRAFT_TEAM_SIZE * 2;
  const currentPlayer = isComplete ? null : state.history.length % 2;
  const instruction = document.getElementById("pokemon-draft-turn");
  instruction.textContent = isComplete
    ? "Los equipos están completos. ¡Que comience la batalla!"
    : `Turno de ${state.trainerNames[currentPlayer]}: elige un Pokémon (${state.teams[currentPlayer].length + 1}/${DRAFT_TEAM_SIZE}).`;
  document.getElementById("draft-player-one-title").textContent = `Jugador 1 · ${state.trainerNames[0]}`;
  document.getElementById("draft-player-two-title").textContent = `Jugador 2 · ${state.trainerNames[1]}`;
  document.getElementById("pokemon-draft-remaining").textContent = `(${state.available.length})`;
  document.getElementById("pokemon-draft-choices").replaceChildren(
    ...state.available.map((pokemon, index) => preparePokemonDraftCard(pokemon, index, currentPlayer ?? 0))
  );
  renderPokemonDraftTeam("draft-team-one", "draft-player-one-count", state.teams[0]);
  renderPokemonDraftTeam("draft-team-two", "draft-player-two-count", state.teams[1]);
  document.getElementById("undo-pokemon-pick").disabled = state.history.length === 0;
  document.getElementById("start-battle").disabled = !isComplete;
}

function choosePokemonForDraft(index) {
  const state = pokemonDraftState;
  if (!state || !Number.isInteger(index) || index < 0 || index >= state.available.length
    || state.history.length >= DRAFT_TEAM_SIZE * 2) return;
  const player = state.history.length % 2;
  const [pokemon] = state.available.splice(index, 1);
  state.teams[player].push(pokemon);
  state.history.push({ player, pokemon });
  renderPokemonDraft();
}

function undoPokemonPick() {
  if (!pokemonDraftState || !pokemonDraftState.history.length) return;
  const lastPick = pokemonDraftState.history.pop();
  pokemonDraftState.teams[lastPick.player].pop();
  pokemonDraftState.available.push(lastPick.pokemon);
  renderPokemonDraft();
}

async function preparePokemonDraft(button) {
  button.disabled = true;
  showLoading(true);
  document.getElementById("error-notice").classList.add("is-hidden");
  try {
    const loadedTeams = await loadTeams();
    const available = [...new Map(loadedTeams.flat().map((pokemon) => [pokemon.name, pokemon])).values()];
    if (available.length < DRAFT_TEAM_SIZE * 2) {
      throw new Error(`Se necesitan al menos ${DRAFT_TEAM_SIZE * 2} Pokémon diferentes para armar los equipos.`);
    }
    pokemonDraftState = {
      available,
      teams: [[], []],
      history: [],
      trainerNames: [
        document.getElementById("trainer-one").value,
        document.getElementById("trainer-two").value
      ]
    };
    renderPokemonDraft();
    showScreen("pokemon-draft-screen");
  } catch (error) {
    const notice = document.getElementById("error-notice");
    notice.textContent = `No se pudo preparar la selección: ${error.message}`;
    notice.classList.remove("is-hidden");
    console.error("Error al preparar la selección de Pokémon:", error);
  } finally {
    showLoading(false);
    button.disabled = false;
  }
}

function initializeMenuBackgrounds() {
  const backgrounds = [...document.querySelectorAll(".menu-backdrop")];
  if (!backgrounds.length) return;
  let activeIndex = Math.floor(Math.random() * backgrounds.length);
  backgrounds.forEach((background, index) => {
    background.classList.toggle("is-active", index === activeIndex);
  });
  if (backgrounds.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  window.setInterval(() => {
    let nextIndex = Math.floor(Math.random() * (backgrounds.length - 1));
    if (nextIndex >= activeIndex) nextIndex += 1;
    backgrounds[activeIndex].classList.remove("is-active");
    backgrounds[nextIndex].classList.add("is-active");
    activeIndex = nextIndex;
  }, 10000);
}

function showValidationError(message) {
  document.getElementById("action-hint").textContent = message;
}

function returnToMenu() {
  gameState = null;
  visibleActions = [];
  pokemonDraftState = null;
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
    gameState.lastMessage = "¡No puedes huir de un combate contra un entrenador!";
    actualizarInterfaz(gameState);
    return;
  }
  visibleActions = await showChoices(gameState, type);
}

function bindEvents() {
  document.getElementById("restart-game").addEventListener("click", async (event) => {
    if (!gameState || gameState.winner === null) return;
    const trainerNames = [...gameState.trainerNames];
    const button = event.currentTarget;
    button.disabled = true;
    try {
      document.getElementById("trainer-one").value = trainerNames[0];
      document.getElementById("trainer-two").value = trainerNames[1];
      hideGameOverScreen();
      gameState = null;
      visibleActions = [];
      document.getElementById("battle-layout").classList.add("is-hidden");
      document.querySelector(".footer-note").classList.add("is-hidden");
      showScreen("trainer-screen");
      await preparePokemonDraft(button);
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

async function initializeGame(trainerNames, selectedTeams) {
  hideGameOverScreen();
  showScreen(null);
  document.getElementById("battle-layout").classList.remove("is-hidden");
  document.querySelector(".footer-note").classList.remove("is-hidden");
  document.getElementById("error-notice").classList.add("is-hidden");
  showLoading(true);
  try {
    const teams = selectedTeams ?? await loadTeams();
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
  initializeMenuBackgrounds();
  bindMenuEvents();
  bindEvents();
  updateTrainerAvatar(document.getElementById("trainer-one"), "one");
  updateTrainerAvatar(document.getElementById("trainer-two"), "two");
}

initializeApp();
