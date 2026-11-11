const TYPE_EFFECTIVENESS = {
  normal: { rock: .5, ghost: 0, steel: .5 },
  fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
  water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
  electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
  grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
  ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
  fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
  poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
  flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
  psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
  bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
  rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
  dragon: { dragon: 2, steel: .5, fairy: 0 },
  dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
  steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
  fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 }
};

export function createGameState(teams) {
  return {
    teams, activePokemon: [0, 0], potions: [3, 3], currentTurn: 0, round: 1,
    pendingActions: [null, null], phase: "intro", winner: null, messageQueue: [],
    roundActions: [], animationEvents: [], isAnimating: false,
    lastMessage: "¡Que comience la batalla!"
  };
}

export function getActivePokemon(gameState, player) {
  return gameState.teams[player][gameState.activePokemon[player]];
}

export function calculateTypeEffectiveness(moveType, defenderTypes) {
  return defenderTypes.reduce((multiplier, type) => multiplier * (TYPE_EFFECTIVENESS[moveType]?.[type] ?? 1), 1);
}

export function calcularDanio(attacker, defender, move, random = Math.random) {
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;
  const effectiveness = calculateTypeEffectiveness(move.type, defender.types);
  const variation = 0.85 + random() * 0.15;
  const baseDamage = Math.floor(
    (((2 * attacker.level / 5 + 2) * move.power * attacker.stats.attack / defender.stats.defense) / 50) + 2
  );
  const damage = effectiveness === 0
    ? 0
    : Math.max(1, Math.floor(baseDamage * stab * effectiveness * variation));
  return { damage, effectiveness, stab };
}

export function cambiarPokemon(gameState, player, teamIndex) {
  const candidate = gameState.teams[player][teamIndex];
  if (!candidate || candidate.hpActual <= 0 || teamIndex === gameState.activePokemon[player]) {
    return { ok: false, message: "No puedes elegir ese Pokémon." };
  }
  gameState.activePokemon[player] = teamIndex;
  return { ok: true, message: `¡${candidate.name} entra en combate!` };
}

export function usarPocion(gameState, player) {
  const pokemon = getActivePokemon(gameState, player);
  if (gameState.potions[player] <= 0) return { ok: false, message: "No quedan pociones." };
  if (pokemon.hpActual <= 0) return { ok: false, message: "Un Pokémon debilitado no puede usar una poción." };
  if (pokemon.hpActual === pokemon.stats.hp) return { ok: false, message: "Sus PS ya están al máximo." };
  const healed = Math.min(30, pokemon.stats.hp - pokemon.hpActual);
  pokemon.hpActual += healed;
  gameState.potions[player] -= 1;
  return { ok: true, message: `La poción restauró ${healed} PS a ${pokemon.name}.` };
}

function performAction(gameState, player, action) {
  const pokemon = getActivePokemon(gameState, player);
  const opponent = getActivePokemon(gameState, 1 - player);
  if (action.type === "flee") {
    gameState.winner = 1 - player;
    return `Entrenador ${player + 1} se rindió. ¡Entrenador ${2 - player} gana la batalla!`;
  }
  if (action.type === "switch") return cambiarPokemon(gameState, player, action.teamIndex).message;
  if (action.type === "potion") return usarPocion(gameState, player).message;
  if (pokemon.hpActual <= 0) return `${pokemon.name} está debilitado y no puede actuar.`;
  const isStruggle = action.type === "struggle";
  const move = isStruggle
    ? { name: "Forcejeo", type: "normal", power: 50, accuracy: 100 }
    : pokemon.movimientos[action.moveIndex];
  if (!move) return "Ese movimiento no está disponible.";
  if (!isStruggle) move.ppActual -= 1;
  const animationEvent = { attacker: player, defender: 1 - player, hit: false };
  gameState.animationEvents.push(animationEvent);
  if (Math.random() * 100 >= move.accuracy) return `¡${pokemon.name} usó ${move.name}, pero falló!`;
  const { damage, effectiveness } = calcularDanio(pokemon, opponent, move);
  animationEvent.hit = damage > 0;
  opponent.hpActual = Math.max(0, opponent.hpActual - damage);
  let message = `¡${pokemon.name} usó ${move.name}! ${opponent.name} perdió ${damage} PS.`;
  if (effectiveness > 1) message += " ¡Es supereficaz!";
  if (effectiveness > 0 && effectiveness < 1) message += " No es muy eficaz…";
  if (effectiveness === 0) message += " No tuvo efecto.";
  if (opponent.hpActual === 0) message += ` ¡${opponent.name} se debilitó!`;
  return message;
}

function findLivingPokemon(gameState, player) {
  return gameState.teams[player].findIndex((pokemon) => pokemon.hpActual > 0);
}

export function resolveRound(gameState) {
  gameState.animationEvents = [];
  gameState.roundActions = [0, 1]
    .filter((player) => gameState.pendingActions[player] !== null)
    .map((player) => {
      const action = gameState.pendingActions[player];
      const pokemon = gameState.teams[player][action.pokemonIndex];
      return { player, speed: pokemon.stats.speed, tieBreak: Math.random() };
    })
    .sort((a, b) => b.speed - a.speed || a.tieBreak - b.tieBreak);
  gameState.currentTurn = 0;
  const firstAction = gameState.roundActions[0];
  const firstPokemon = firstAction && gameState.teams[firstAction.player][gameState.pendingActions[firstAction.player].pokemonIndex];
  gameState.lastMessage = firstPokemon
    ? `Ambos entrenadores eligieron. ${firstPokemon.name} (Vel. ${firstAction.speed}) actuará primero.`
    : "La ronda terminó sin acciones.";
  gameState.phase = firstAction ? "resolving" : "messages";
}

export function resolveNextAction(gameState) {
  if (gameState.phase !== "resolving" || gameState.isAnimating) return false;
  gameState.animationEvents = [];
  const next = gameState.roundActions.shift();
  if (!next) {
    gameState.phase = gameState.winner === null ? "messages" : "finished";
    return false;
  }

  const { player } = next;
  const action = gameState.pendingActions[player];
  const selectedPokemon = gameState.teams[player][action.pokemonIndex];
  let message;

  if (gameState.activePokemon[player] !== action.pokemonIndex && action.type !== "switch") {
    message = `${selectedPokemon.name} ya no puede actuar. Su acción se cancela.`;
  } else {
    message = performAction(gameState, player, action);
    const defeated = getActivePokemon(gameState, 1 - player);
    if (gameState.winner === null && defeated.hpActual <= 0) {
      const replacementIndex = findLivingPokemon(gameState, 1 - player);
      if (replacementIndex === -1) {
        gameState.winner = player;
        gameState.roundActions = [];
        message += ` ¡Entrenador ${player + 1} gana la batalla!`;
      } else {
        gameState.activePokemon[1 - player] = replacementIndex;
        message += ` Entrenador ${2 - player} envía a ${getActivePokemon(gameState, 1 - player).name}.`;
      }
    }
  }

  gameState.pendingActions[player] = null;
  gameState.lastMessage = message;
  if (gameState.winner !== null) {
    gameState.pendingActions = [null, null];
    gameState.phase = "finished";
  } else if (gameState.roundActions.length === 0) {
    gameState.pendingActions = [null, null];
    gameState.phase = "messages";
  }
  return true;
}

export function ejecutarTurno(gameState, player, action) {
  if (gameState.phase !== "choose" || gameState.currentTurn !== player) {
    return { ok: false, message: "No es el turno de este entrenador." };
  }
  if (action.type === "switch") {
    const candidate = gameState.teams[player][action.teamIndex];
    if (!candidate || candidate.hpActual <= 0 || action.teamIndex === gameState.activePokemon[player]) {
      return { ok: false, message: "No puedes elegir ese Pokémon." };
    }
  } else if (action.type === "potion") {
    const pokemon = getActivePokemon(gameState, player);
    if (gameState.potions[player] <= 0) return { ok: false, message: "No quedan pociones." };
    if (pokemon.hpActual <= 0 || pokemon.hpActual === pokemon.stats.hp) {
      return { ok: false, message: pokemon.hpActual <= 0 ? "Un Pokémon debilitado no puede usar una poción." : "Sus PS ya están al máximo." };
    }
  } else if (action.type === "fight") {
    const move = getActivePokemon(gameState, player).movimientos[action.moveIndex];
    if (!move) {
      return { ok: false, message: "Elige un movimiento válido." };
    }
    if (!Number.isInteger(move.ppActual) || move.ppActual <= 0) {
      return { ok: false, message: "Ese movimiento ya no tiene PP." };
    }
  } else if (action.type === "struggle") {
    const hasPp = getActivePokemon(gameState, player).movimientos.some(
      (move) => Number.isInteger(move.ppActual) && move.ppActual > 0
    );
    if (hasPp) return { ok: false, message: "Todavía tienes movimientos con PP disponibles." };
  } else if (action.type !== "flee") {
    return { ok: false, message: "Acción no válida." };
  }
  gameState.pendingActions[player] = {
    ...action,
    pokemonIndex: gameState.activePokemon[player]
  };
  if (player === 0) {
    gameState.currentTurn = 1;
    gameState.phase = "handoff";
    gameState.lastMessage = "Acción elegida. Entrega el dispositivo al Entrenador 2.";
  } else {
    gameState.phase = "resolving";
  }
  return { ok: true };
}
