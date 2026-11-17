import { getActivePokemon } from "./battle.js";

const TYPE_LABELS = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico", grass: "Planta",
  ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador",
  psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón",
  dark: "Siniestro", steel: "Acero", fairy: "Hada"
};
const element = (id) => document.getElementById(id);
const displayedHp = new Map();
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const TRANSITION_DURATION = 420;

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
    const progress = Math.min(1, (now - start) / 650);
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
  element(`${side}-trainer`).textContent = `Entrenador ${player + 1}`;
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
  sprite.src = player === 0 ? pokemon.backSprite ?? pokemon.sprite : pokemon.sprite;
  sprite.alt = pokemon.name;
  sprite.classList.toggle("is-fainted", pokemon.hpActual <= 0);
  element(`${side}-types`).innerHTML = pokemon.types
    .map((type) => `<span class="tag is-info is-light">${TYPE_LABELS[type] ?? type}</span>`).join("");
}

export function actualizarInterfaz(gameState) {
  updatePokemonPanel(gameState, 1);
  updatePokemonPanel(gameState, 0);
  element("round-indicator").textContent = `Ronda ${Math.max(1, gameState.round)}`;
  element("potion-count-1").textContent = `Entrenador 1: ${gameState.potions[0]} pociones`;
  element("potion-count-2").textContent = `Entrenador 2: ${gameState.potions[1]} pociones`;
  element("battle-message").textContent = gameState.lastMessage;
  element("phase-label").textContent = gameState.phase === "finished" ? "Fin de partida" : `Ronda ${gameState.round}`;
  element("action-panel").classList.toggle("is-hidden", gameState.phase !== "choose");
  element("battle-layout").classList.toggle("awaiting-action", gameState.phase !== "choose");
  element("player-side").classList.toggle("is-current-turn", gameState.phase === "choose" && gameState.currentTurn === 0);
  element("opponent-side").classList.toggle("is-current-turn", gameState.phase === "choose" && gameState.currentTurn === 1);
  if (gameState.phase === "choose") {
    element("turn-owner").textContent = `Entrenador ${gameState.currentTurn + 1}`;
    element("action-hint").textContent = `Pokémon activo: ${getActivePokemon(gameState, gameState.currentTurn).name}`;
  }
}

export async function showChoices(gameState, type) {
  const panel = element("choice-panel");
  const modal = element("selection-modal");
  const isForcedSwitch = gameState.phase === "forced-switch";
  const player = isForcedSwitch ? gameState.pendingSwitchPlayer : gameState.currentTurn;
  const team = gameState.teams[player];
  const closeButton = element("selection-close");
  const cancelButton = element("selection-cancel");
  let choices = [];
  let title = "";
  modal.classList.toggle("switch-menu", type === "switch");
  modal.dataset.forcedSwitch = String(type === "switch" && isForcedSwitch);
  closeButton.classList.toggle("is-hidden", type === "switch" && isForcedSwitch);
  cancelButton.disabled = type === "switch" && isForcedSwitch;
  cancelButton.textContent = type === "switch" ? "Cancelar" : "Volver a acciones";
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
    title = `Equipo del Entrenador ${player + 1}`;
    choices = team.map((pokemon, index) => ({ pokemon, index }))
      .filter(({ index }) => index !== gameState.activePokemon[player])
      .map(({ pokemon, index }) => ({
        label: pokemon.name,
        detail: `${pokemon.hpActual > 0 ? `${pokemon.hpActual}/${pokemon.stats.hp} PS` : "Debilitado"} · Nv. ${pokemon.level} · ${pokemon.types.map((entry) => TYPE_LABELS[entry] ?? entry).join(" / ")}`,
        sprite: pokemon.sprite,
        disabled: pokemon.hpActual <= 0,
        action: { type: "switch", teamIndex: index }
      }));
    const activePokemon = getActivePokemon(gameState, player);
    const hpPercentage = Math.max(0, (activePokemon.hpActual / activePokemon.stats.hp) * 100);
    element("switch-current").innerHTML = `<article class="switch-current-card"><img src="${escapeHtml(player === 0 ? activePokemon.backSprite ?? activePokemon.sprite : activePokemon.sprite)}" alt=""><div><p class="switch-trainer">Entrenador ${player + 1}</p><h3>${escapeHtml(activePokemon.name)}</h3><span>Nv. ${activePokemon.level} · ${escapeHtml(activePokemon.types.map((entry) => TYPE_LABELS[entry] ?? entry).join(" / "))}</span><div class="switch-hp-bar"><span style="width:${hpPercentage}%"></span></div><p>${activePokemon.hpActual <= 0 ? "Debilitado" : `${activePokemon.hpActual} / ${activePokemon.stats.hp} PS`}</p></div></article>`;
  } else if (type === "potion") {
    const pokemon = getActivePokemon(gameState, player);
    title = `Mochila del Entrenador ${player + 1}`;
    choices = [{
      label: "🧪 Poción",
      detail: `${gameState.potions[player]} disponibles · restaura hasta 30 PS a ${pokemon.name} (${pokemon.hpActual}/${pokemon.stats.hp} PS)`,
      disabled: gameState.potions[player] <= 0 || pokemon.hpActual >= pokemon.stats.hp,
      action: { type: "potion" }
    }];
  }
  panel.innerHTML = choices.map((choice, index) => {
    const sprite = choice.sprite
      ? `<img class="team-choice-sprite" src="${escapeHtml(choice.sprite)}" alt="">`
      : "";
    return `<button type="button" class="button is-light choice-button${choice.sprite ? " team-choice-button" : ""}" data-choice="${index}" ${choice.disabled ? "disabled" : ""}><span class="choice-copy"><span class="choice-label">${escapeHtml(choice.label)}</span><span class="move-detail">${escapeHtml(choice.detail)}</span></span>${sprite}</button>`;
  }).join("") + (choices.length ? "" : '<p class="empty-selection">No hay opciones disponibles.</p>');
  element("selection-title").textContent = title;
  modal.setAttribute("aria-hidden", "false");
  if (type === "switch") {
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
  const playAnimation = (player, className, duration) => new Promise((resolve) => {
    const sprite = element(`${player === 0 ? "player" : "opponent"}-sprite`);
    const finish = () => {
      window.clearTimeout(timeout);
      sprite.removeEventListener("animationend", onAnimationEnd);
      sprite.classList.remove(className);
      resolve();
    };
    const onAnimationEnd = (event) => {
      if (event.target === sprite) finish();
    };
    const timeout = window.setTimeout(finish, duration + 100);
    sprite.addEventListener("animationend", onAnimationEnd);
    sprite.classList.remove(className);
    void sprite.offsetWidth;
    sprite.classList.add(className);
  });

  return events.reduce(
    (sequence, { attacker, defender, hit }) => sequence
      .then(() => playAnimation(attacker, "is-attacking", 650))
      .then(() => hit ? playAnimation(defender, "is-hit", 650) : undefined),
    Promise.resolve()
  );
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

export function showApiFallbackNotice(names, moveNames = []) {
  const notice = element("error-notice");
  if (!names.length && !moveNames.length) {
    notice.classList.add("is-hidden");
    return;
  }
  const messages = [];
  if (names.length) messages.push(`Se usaron datos de respaldo para: ${names.join(", ")}.`);
  if (moveNames.length) messages.push(`Se usaron movimientos de respaldo para: ${moveNames.join(", ")}.`);
  notice.textContent = messages.join(" ");
  notice.classList.remove("is-hidden");
}
