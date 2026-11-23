import { getActivePokemon, POTION_TYPES } from "./battle.js";

const TYPE_LABELS = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico", grass: "Planta",
  ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador",
  psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón",
  dark: "Siniestro", steel: "Acero", fairy: "Hada"
};
const element = (id) => document.getElementById(id);
const displayedHp = new Map();
let typeOverlayTimeout = 0;
let gameOverTransitionActive = false;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const TRANSITION_DURATION = 420;

function showTypeOverlay(type) {
  const overlay = element("type-overlay");
  overlay.dataset.type = type;
  overlay.classList.remove("is-active");
  window.clearTimeout(typeOverlayTimeout);
  void overlay.offsetWidth;
  overlay.classList.add("is-active");
  typeOverlayTimeout = window.setTimeout(() => {
    overlay.classList.remove("is-active");
    delete overlay.dataset.type;
  }, type === "water" ? 1600 : 625);
}

async function showGameOverScreen(gameState) {
  if (gameState.winner === null) return;
  const screen = element("game-over-screen");
  if (!screen.classList.contains("is-hidden") || gameOverTransitionActive) return;
  gameOverTransitionActive = true;
  const winner = gameState.winner;
  const team = gameState.teams[winner];
  const activeIndex = gameState.activePokemon[winner];
  const lineup = [
    team[activeIndex],
    ...team.filter((pokemon, index) => index !== activeIndex)
      .sort((first, second) => Number(second.hpActual > 0) - Number(first.hpActual > 0))
  ].slice(0, 3);
  element("winner-title").textContent = `¡Entrenador ${gameState.trainerNames[winner]} ganó la partida!`;
  element("winner-team").innerHTML = lineup.map((pokemon) => `
    <article class="winner-pokemon">
      <img src="${escapeHtml(pokemon.sprite)}" alt="">
      <span>${escapeHtml(pokemon.name)}</span>
    </article>
  `).join("");
  const transition = element("screen-transition");
  transition.className = "screen-transition transition-white game-over-transition";
  transition.setAttribute("aria-hidden", "false");
  await nextFrame();
  transition.classList.add("is-visible");
  await waitForTransition();
  screen.classList.remove("is-hidden");
  screen.setAttribute("aria-hidden", "false");
  await nextFrame();
  transition.classList.remove("is-visible");
  await waitForTransition();
  transition.className = "screen-transition";
  transition.setAttribute("aria-hidden", "true");
  gameOverTransitionActive = false;
  element("restart-game").focus();
}

export function hideGameOverScreen() {
  const screen = element("game-over-screen");
  screen.classList.add("is-hidden");
  screen.setAttribute("aria-hidden", "true");
  gameOverTransitionActive = false;
  const transition = element("screen-transition");
  transition.className = "screen-transition";
  transition.setAttribute("aria-hidden", "true");
}

function waitForTransition() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, TRANSITION_DURATION));
}

function nextFrame() {
  return new Promise((resolve) => window.setTimeout(resolve, 16));
}

function updateHpBar(bar, percentage) {
  const previous = displayedHp.get(bar.id);
  const previousValue = typeof previous === "number" ? previous : previous?.value;
  if (previousValue === undefined || Math.abs(previousValue - percentage) < .1) {
    if (previous && typeof previous === "object") cancelAnimationFrame(previous.frame);
    bar.value = percentage;
    displayedHp.set(bar.id, percentage);
    return;
  }

  if (previous && typeof previous === "object") cancelAnimationFrame(previous.frame);
  const animation = { value: previousValue, frame: 0 };
  displayedHp.set(bar.id, animation);
  const start = performance.now();
  const update = (now) => {
    if (displayedHp.get(bar.id) !== animation) return;
    const progress = Math.min(1, (now - start) / 975);
    animation.value = previousValue + (percentage - previousValue) * progress;
    bar.value = animation.value;
    if (progress < 1) {
      animation.frame = requestAnimationFrame(update);
    } else {
      displayedHp.set(bar.id, percentage);
    }
  };
  animation.frame = requestAnimationFrame(update);
}

function updatePokemonPanel(gameState, player) {
  const pokemon = getActivePokemon(gameState, player);
  const side = player === 0 ? "player" : "opponent";
  element(`${side}-trainer`).textContent = gameState.trainerNames[player];
  element(`${side}-name`).textContent = pokemon.name;
  element(`${side}-level`).textContent = `Nv. ${pokemon.level}`;
  element(`${side}-hp-text`).textContent = `${pokemon.hpActual} / ${pokemon.stats.hp} PS`;
  const percentage = Math.max(0, (pokemon.hpActual / pokemon.stats.hp) * 100);
  const bar = element(`${side}-hp-bar`);
  updateHpBar(bar, percentage);
  bar.classList.toggle("is-warning", percentage <= 50 && percentage > 20);
  bar.classList.toggle("is-danger", percentage <= 20);
  bar.classList.toggle("is-success", percentage > 50);
  const sprite = element(`${side}-sprite`);
  const isSwitchingPokemon = sprite.alt && sprite.alt !== pokemon.name;
  sprite.src = player === 0 ? pokemon.backSprite ?? pokemon.sprite : pokemon.sprite;
  sprite.alt = pokemon.name;
  if (isSwitchingPokemon) {
    sprite.classList.remove("is-switch-entering");
    void sprite.offsetWidth;
    const onSwitchAnimationEnd = (event) => {
      if (event.animationName !== "pokemon-switch-enter") return;
      sprite.removeEventListener("animationend", onSwitchAnimationEnd);
      window.clearTimeout(switchAnimationTimeout);
      sprite.classList.remove("is-switch-entering");
    };
    sprite.addEventListener("animationend", onSwitchAnimationEnd);
    const switchAnimationTimeout = window.setTimeout(() => {
      sprite.removeEventListener("animationend", onSwitchAnimationEnd);
      sprite.classList.remove("is-switch-entering");
    }, 900);
    sprite.classList.add("is-switch-entering");
  }
  sprite.classList.toggle("is-fainted", pokemon.hpActual <= 0);
  element(`${side}-types`).innerHTML = pokemon.types
    .map((type) => `<span class="tag is-info is-light">${TYPE_LABELS[type] ?? type}</span>`).join("");
}

function renderCurrentPokemonCard(gameState, player) {
  const pokemon = getActivePokemon(gameState, player);
  const hpPercentage = Math.max(0, (pokemon.hpActual / pokemon.stats.hp) * 100);
  return `<article class="switch-current-card"><img src="${escapeHtml(pokemon.sprite)}" alt=""><div><p class="switch-trainer">${escapeHtml(gameState.trainerNames[player])}</p><h3>${escapeHtml(pokemon.name)}</h3><span>Nv. ${pokemon.level} · ${escapeHtml(pokemon.types.map((entry) => TYPE_LABELS[entry] ?? entry).join(" / "))}</span><div class="switch-hp-bar"><span style="width:${hpPercentage}%"></span></div><p>${pokemon.hpActual <= 0 ? "Debilitado" : `${pokemon.hpActual} / ${pokemon.stats.hp} PS`}</p></div></article>`;
}

export function actualizarInterfaz(gameState) {
  updatePokemonPanel(gameState, 1);
  updatePokemonPanel(gameState, 0);
  const potionCounts = (inventory) => `Pociones: ${inventory.basic} · Medianas: ${inventory.medium} · Grandes: ${inventory.large}`;
  element("potion-count-1").textContent = `${gameState.trainerNames[0]}: ${potionCounts(gameState.potions[0])}`;
  element("potion-count-2").textContent = `${gameState.trainerNames[1]}: ${potionCounts(gameState.potions[1])}`;
  element("battle-message").textContent = gameState.lastMessage;
  element("phase-label").textContent = gameState.phase === "finished" ? "Fin de partida" : `Ronda ${gameState.round}`;
  element("action-panel").classList.toggle("is-hidden", gameState.phase !== "choose");
  element("battle-layout").classList.toggle("awaiting-action", gameState.phase !== "choose");
  element("player-side").classList.toggle("is-current-turn", gameState.phase === "choose" && gameState.currentTurn === 0);
  element("opponent-side").classList.toggle("is-current-turn", gameState.phase === "choose" && gameState.currentTurn === 1);
  if (gameState.phase === "finished") void showGameOverScreen(gameState);
  if (gameState.phase === "choose") {
    element("turn-owner").textContent = gameState.trainerNames[gameState.currentTurn];
    element("action-hint").textContent = `Pokémon activo: ${getActivePokemon(gameState, gameState.currentTurn).name}`;
  }
}

export function showFightOptions(gameState) {
  const pokemon = getActivePokemon(gameState, gameState.currentTurn);
  const panel = element("main-actions");
  let actions = pokemon.movimientos.map((move, moveIndex) => ({
    disabled: !Number.isInteger(move.ppActual) || move.ppActual <= 0,
    action: { type: "fight", moveIndex }
  }));

  if (pokemon.movimientos.every((move) => !Number.isInteger(move.ppActual) || move.ppActual <= 0)) {
    actions.push({
      disabled: false,
      action: { type: "struggle" }
    });
  }

  const allMovesDepleted = pokemon.movimientos.every((move) => !Number.isInteger(move.ppActual) || move.ppActual <= 0);
  const moveButtons = allMovesDepleted ? "" : pokemon.movimientos.map((move, moveIndex) => `
    <button class="button action-button move-button" type="button"
      data-action="attack" data-choice="${moveIndex}"
      ${actions[moveIndex].disabled ? "disabled" : ""}>
      <span>${escapeHtml(move.name)}</span>
      <small>${TYPE_LABELS[move.type] ?? move.type} · ${move.power} · PP ${move.ppActual}/${move.pp}</small>
    </button>
  `).join("");

  const struggleButton = actions.length > pokemon.movimientos.length ? `
    <button class="button action-button move-button" type="button"
      data-action="attack" data-choice="${pokemon.movimientos.length}">
      <span>Forcejeo</span>
      <small>Normal · Poder 50 · sin límite de PP</small>
    </button>
  ` : "";

  panel.innerHTML = `${moveButtons}${struggleButton}`;
  element("action-hint").textContent = `Ataques de ${pokemon.name}`;
  element("action-hint").insertAdjacentHTML("afterend",
    '<button class="button fight-back-button" type="button" data-action="back">Volver</button>');

  return actions.map(({ action }) => action);
}

export function showMainActions() {
  element("action-panel").querySelector(".fight-back-button")?.remove();
  element("main-actions").innerHTML = `
    <button class="button action-button fight-button" data-action="fight">⚔️ <span>Luchar</span></button>
    <button class="button action-button bag-button" data-action="potion">🧪 <span>Mochila</span></button>
    <button class="button action-button team-button" data-action="switch">🔁 <span>Pokémon</span></button>
    <button class="button action-button flee-button" data-action="flee">🏳️ <span>Huir</span></button>`;
  element("action-hint").textContent = "Elige tu acción.";
}

export async function showChoices(gameState, type, potionType) {
  const panel = element("choice-panel");
  const modal = element("selection-modal");
  const isForcedSwitch = gameState.phase === "forced-switch";
  const player = isForcedSwitch ? gameState.pendingSwitchPlayer : gameState.currentTurn;
  const team = gameState.teams[player];
  const closeButton = element("selection-close");
  const cancelButton = element("selection-cancel");
  let choices = [];
  let title = "";
  const usesBattleMenu = type === "switch" || type === "potion" || type === "potion-target";
  modal.classList.toggle("switch-menu", usesBattleMenu);
  modal.dataset.choiceType = type;
  modal.dataset.forcedSwitch = String(type === "switch" && isForcedSwitch);
  closeButton.classList.toggle("is-hidden", type === "switch" && isForcedSwitch);
  cancelButton.disabled = type === "switch" && isForcedSwitch;
  cancelButton.textContent = type === "potion-target"
    ? "Volver a pociones"
    : type === "switch" ? "Cancelar" : "Volver a acciones";
  element("switch-current").innerHTML = "";
  if (type === "fight") {
    title = `Ataques de ${getActivePokemon(gameState, player).name}`;
    const moves = getActivePokemon(gameState, player).movimientos;
    choices = moves.map((move, index) => ({
      label: move.name,
      detail: `${TYPE_LABELS[move.type] ?? move.type} · Poder ${move.power} · PP ${move.ppActual}/${move.pp}`,
      disabled: !Number.isInteger(move.ppActual) || move.ppActual <= 0,
      action: { type: "fight", moveIndex: index }
    }));
    if (moves.every((move) => !Number.isInteger(move.ppActual) || move.ppActual <= 0)) {
      choices.push({
        label: "Forcejeo",
        detail: "Normal · Poder 50 · sin límite de PP",
        action: { type: "struggle" }
      });
    }
  } else if (type === "switch") {
    title = `Equipo de ${gameState.trainerNames[player]}`;
    choices = team.map((pokemon, index) => ({ pokemon, index }))
      .filter(({ index }) => index !== gameState.activePokemon[player])
      .map(({ pokemon, index }) => ({
        label: pokemon.name,
        detail: `${pokemon.hpActual > 0 ? `${pokemon.hpActual}/${pokemon.stats.hp} PS` : "Debilitado"} · Nv. ${pokemon.level} · ${pokemon.types.map((entry) => TYPE_LABELS[entry] ?? entry).join(" / ")}`,
        sprite: pokemon.sprite,
        disabled: pokemon.hpActual <= 0,
        action: { type: "switch", teamIndex: index }
      }));
    element("switch-current").innerHTML = renderCurrentPokemonCard(gameState, player);
  } else if (type === "potion") {
    title = `Mochila de ${gameState.trainerNames[player]}`;
    element("switch-current").innerHTML = renderCurrentPokemonCard(gameState, player);
    const hasInjuredPokemon = team.some((pokemon) => pokemon.hpActual > 0 && pokemon.hpActual < pokemon.stats.hp);
    choices = Object.entries(POTION_TYPES).map(([typeKey, potion]) => {
      const available = gameState.potions[player][typeKey];
      return {
        label: `🧪 ${potion.name}`,
        detail: `${available} ${available === 1 ? "disponible" : "disponibles"} · cura hasta ${potion.healing} PS`,
        disabled: available <= 0 || !hasInjuredPokemon,
        action: { type: "potion-select", potionType: typeKey }
      };
    });
  } else if (type === "potion-target") {
    const potion = POTION_TYPES[potionType];
    title = `¿A quién dar ${potion.name}?`;
    element("switch-current").innerHTML = renderCurrentPokemonCard(gameState, player);
    choices = team.map((pokemon, index) => {
      const fainted = pokemon.hpActual <= 0;
      const fullHealth = pokemon.hpActual >= pokemon.stats.hp;
      const detail = fainted
        ? "Debilitado · no puede recibir pociones"
        : fullHealth
          ? `${pokemon.hpActual}/${pokemon.stats.hp} PS · PS al máximo`
          : `${pokemon.hpActual}/${pokemon.stats.hp} PS · cura hasta ${potion.healing} PS`;
      return {
        label: pokemon.name,
        detail,
        sprite: pokemon.sprite,
        disabled: fainted || fullHealth,
        action: { type: "potion", potionType, teamIndex: index }
      };
    });
  }
  panel.innerHTML = choices.map((choice, index) => {
    const sprite = choice.sprite
      ? `<img class="team-choice-sprite" src="${escapeHtml(choice.sprite)}" alt="">`
      : "";
    return `<button type="button" class="button is-light choice-button${choice.sprite ? " team-choice-button" : ""}" data-choice="${index}" ${choice.disabled ? "disabled" : ""}><span class="choice-copy"><span class="choice-label">${escapeHtml(choice.label)}</span><span class="move-detail">${escapeHtml(choice.detail)}</span></span>${sprite}</button>`;
  }).join("") + (choices.length ? "" : '<p class="empty-selection">No hay opciones disponibles.</p>');
  element("selection-title").textContent = title;
  modal.setAttribute("aria-hidden", "false");
  if (usesBattleMenu) {
    const transition = element("screen-transition");
    transition.className = "screen-transition transition-black";
    transition.setAttribute("aria-hidden", "false");
    await nextFrame();
    transition.classList.add("is-visible");
    await waitForTransition();
    modal.classList.remove("is-hidden");
    await nextFrame();
    transition.classList.remove("is-visible");
    await waitForTransition();
    transition.className = "screen-transition";
    transition.setAttribute("aria-hidden", "true");
  } else {
    modal.classList.remove("is-hidden");
  }
  element("action-hint").textContent = "Elige una opción.";
  const focusTarget = isForcedSwitch ? panel.querySelector("[data-choice]:not(:disabled)") : closeButton;
  focusTarget?.focus();
  return choices.map(({ action }) => action);
}

export function playBattleAnimations(events) {
  const attackDurations = [812.5, 1187.5, 1250, 1062.5];
  const playAnimation = (player, className, duration, animationName) => new Promise((resolve) => {
    const sprite = element(`${player === 0 ? "player" : "opponent"}-sprite`);
    const finish = () => {
      window.clearTimeout(timeout);
      sprite.removeEventListener("animationend", onAnimationEnd);
      sprite.classList.remove(className);
      resolve();
    };
    const onAnimationEnd = (event) => {
      if (event.target === sprite && event.animationName === animationName) finish();
    };
    const timeout = window.setTimeout(finish, duration + 100);
    sprite.addEventListener("animationend", onAnimationEnd);
    sprite.classList.remove(className);
    void sprite.offsetWidth;
    sprite.classList.add(className);
  });

  return events.reduce((sequence, { attacker, defender, hit, moveIndex = 0, moveType }) => {
    const attackIndex = Math.max(0, Math.min(3, moveIndex));
    const attackClass = `is-attacking-${attackIndex}`;
    const animationNames = ["attack-lunge", "attack-double-thrust", "attack-heavy-thrust", "attack-leap"];
    return sequence.then(() => {
      showTypeOverlay(moveType);
      return playAnimation(attacker, attackClass, attackDurations[attackIndex], animationNames[attackIndex]);
    })
      .then(() => hit ? playAnimation(defender, "is-hit", 812.5, "damage-impact") : undefined);
  }, Promise.resolve());
}

export async function hideChoices() {
  const modal = element("selection-modal");
  const isSwitchMenu = modal.classList.contains("switch-menu") && !modal.classList.contains("is-hidden");
  if (isSwitchMenu) {
    const transition = element("screen-transition");
    transition.className = "screen-transition transition-white";
    transition.setAttribute("aria-hidden", "false");
    await nextFrame();
    transition.classList.add("is-visible");
    await waitForTransition();
  }
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("switch-menu");
  modal.dataset.forcedSwitch = "false";
  modal.dataset.choiceType = "";
  element("choice-panel").innerHTML = "";
  element("switch-current").innerHTML = "";
  element("selection-close").classList.remove("is-hidden");
  element("selection-cancel").disabled = false;
  element("selection-cancel").textContent = "Volver a acciones";
  if (isSwitchMenu) {
    const transition = element("screen-transition");
    transition.classList.remove("is-visible");
    await waitForTransition();
    transition.className = "screen-transition";
    transition.setAttribute("aria-hidden", "true");
  }
}

export function showLoading(isLoading) {
  element("loading").classList.toggle("is-hidden", !isLoading);
}
