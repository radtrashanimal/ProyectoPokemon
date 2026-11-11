import { getActivePokemon } from "./battle.js";

const TYPE_LABELS = {
  normal: "Normal", fire: "Fuego", water: "Agua", electric: "Eléctrico", grass: "Planta",
  ice: "Hielo", fighting: "Lucha", poison: "Veneno", ground: "Tierra", flying: "Volador",
  psychic: "Psíquico", bug: "Bicho", rock: "Roca", ghost: "Fantasma", dragon: "Dragón",
  dark: "Siniestro", steel: "Acero", fairy: "Hada"
};
const element = (id) => document.getElementById(id);
const displayedHp = new Map();

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
  const canContinue = ["handoff", "resolving", "messages"].includes(gameState.phase);
  element("action-panel").classList.toggle("is-hidden", gameState.phase !== "choose");
  element("continue-button").classList.toggle("is-hidden", !canContinue);
  element("continue-button").disabled = gameState.isAnimating;
  if (gameState.phase === "resolving") {
    const nextAction = gameState.roundActions[0];
    element("continue-button").textContent = nextAction
      ? `Resolver acción de Entrenador ${nextAction.player + 1}`
      : "Finalizar ronda";
  } else if (gameState.phase === "messages") {
    element("continue-button").textContent = "Finalizar ronda";
  } else {
    element("continue-button").textContent = gameState.currentTurn === 1
      ? "Pasar al Entrenador 2"
      : "Empezar siguiente ronda";
  }
  if (gameState.phase === "choose") {
    element("turn-owner").textContent = `Entrenador ${gameState.currentTurn + 1}`;
    element("action-hint").textContent = `Pokémon activo: ${getActivePokemon(gameState, gameState.currentTurn).name}`;
  }
}

export function showChoices(gameState, type) {
  const panel = element("choice-panel");
  const player = gameState.currentTurn;
  const team = gameState.teams[player];
  let choices = [];
  if (type === "fight") {
    const moves = getActivePokemon(gameState, player).movimientos;
    choices = moves.map((move, index) => ({
      label: move.name,
      detail: `${TYPE_LABELS[move.type] ?? move.type} · PP ${move.ppActual}/${move.pp}`,
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
    choices = team.map((pokemon, index) => ({
      label: pokemon.name, detail: pokemon.hpActual > 0 ? `${pokemon.hpActual}/${pokemon.stats.hp} PS` : "Debilitado",
      disabled: pokemon.hpActual <= 0 || index === gameState.activePokemon[player],
      action: { type: "switch", teamIndex: index }
    }));
  } else if (type === "potion") {
    const pokemon = getActivePokemon(gameState, player);
    choices = [{
      label: "Poción", detail: `${gameState.potions[player]} disponibles · restaura hasta 30 PS`,
      disabled: gameState.potions[player] <= 0 || pokemon.hpActual >= pokemon.stats.hp,
      action: { type: "potion" }
    }];
  }
  panel.innerHTML = choices.map((choice, index) =>
    `<button type="button" class="button is-light choice-button" data-choice="${index}" ${choice.disabled ? "disabled" : ""}><span>${choice.label}</span><span class="move-detail">${choice.detail}</span></button>`
  ).join("") + '<button type="button" class="button choice-back-button" data-choice-back>← Volver a acciones</button>';
  panel.classList.remove("is-hidden");
  element("main-actions").classList.add("is-hidden");
  element("action-hint").textContent = "Selecciona una opción.";
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

export function hideChoices() {
  element("choice-panel").classList.add("is-hidden");
  element("choice-panel").innerHTML = "";
  element("main-actions").classList.remove("is-hidden");
}

export function showLoading(isLoading) {
  element("loading").classList.toggle("is-hidden", !isLoading);
}

export function showApiFallbackNotice(names) {
  const notice = element("error-notice");
  if (!names.length) {
    notice.classList.add("is-hidden");
    return;
  }
  notice.textContent = `Se usaron datos de respaldo para: ${names.join(", ")}.`;
  notice.classList.remove("is-hidden");
}
