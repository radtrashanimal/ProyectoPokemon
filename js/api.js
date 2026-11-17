const FALLBACK_DATA = {
  pikachu: { name: "pikachu", types: ["electric"], stats: { hp: 35, attack: 55, defense: 40, speed: 90 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png" },
  charmander: { name: "charmander", types: ["fire"], stats: { hp: 39, attack: 52, defense: 43, speed: 65 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/4.png" },
  squirtle: { name: "squirtle", types: ["water"], stats: { hp: 44, attack: 48, defense: 65, speed: 43 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/7.png" },
  bulbasaur: { name: "bulbasaur", types: ["grass", "poison"], stats: { hp: 45, attack: 49, defense: 49, speed: 45 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/1.png" },
  eevee: { name: "eevee", types: ["normal"], stats: { hp: 55, attack: 55, defense: 50, speed: 55 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/133.png" },
  gengar: { name: "gengar", types: ["ghost", "poison"], stats: { hp: 60, attack: 65, defense: 60, speed: 110 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/94.png" },
  snorlax: { name: "snorlax", types: ["normal"], stats: { hp: 160, attack: 110, defense: 65, speed: 30 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/143.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/143.png" },
  machop: { name: "machop", types: ["fighting"], stats: { hp: 70, attack: 80, defense: 50, speed: 35 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/66.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/66.png" }
};

const FALLBACK_MOVES = {
  pikachu: ["thunder-shock", "quick-attack", "thunderbolt", "iron-tail"],
  charmander: ["ember", "scratch", "flame-burst", "swift"],
  squirtle: ["water-gun", "bite", "bubble-beam", "rapid-spin"],
  bulbasaur: ["vine-whip", "tackle", "razor-leaf", "sludge-bomb"],
  eevee: ["swift", "quick-attack", "bite", "shadow-ball"],
  gengar: ["lick", "shadow-ball", "sludge-bomb", "dark-pulse"],
  snorlax: ["body-slam", "lick", "earthquake", "crunch"],
  machop: ["low-kick", "karate-chop", "rock-tomb", "brick-break"]
};
const MOVE_TRANSLATIONS = {
  "thunder-shock": "Impactrueno", "quick-attack": "Ataque rápido", thunderbolt: "Rayo",
  "iron-tail": "Cola férrea", ember: "Ascuas", scratch: "Arañazo", "flame-burst": "Pirotecnia",
  swift: "Rapidez", "water-gun": "Pistola agua", bite: "Mordisco", "bubble-beam": "Rayo burbuja",
  "rapid-spin": "Giro rápido", "vine-whip": "Látigo cepa", tackle: "Placaje", "razor-leaf": "Hoja afilada",
  "sludge-bomb": "Bomba lodo", "shadow-ball": "Bola sombra", lick: "Lengüetazo",
  "dark-pulse": "Pulso umbrío", "body-slam": "Golpe cuerpo", earthquake: "Terremoto",
  crunch: "Triturar", "low-kick": "Patada baja", "karate-chop": "Golpe karate",
  "rock-tomb": "Tumba rocas", "brick-break": "Demolición", spark: "Chispa", feint: "Amago"
};
const FALLBACK_MOVE_DATA = {
  "thunder-shock": ["electric", 40, 100, 30], "quick-attack": ["normal", 40, 100, 30],
  thunderbolt: ["electric", 90, 100, 15], "iron-tail": ["steel", 100, 75, 15],
  ember: ["fire", 40, 100, 25], scratch: ["normal", 40, 100, 35],
  "flame-burst": ["fire", 70, 100, 15], swift: ["normal", 60, 100, 20],
  "water-gun": ["water", 40, 100, 25], bite: ["dark", 60, 100, 25],
  "bubble-beam": ["water", 65, 100, 20], "rapid-spin": ["normal", 50, 100, 40],
  "vine-whip": ["grass", 45, 100, 25], tackle: ["normal", 40, 100, 35],
  "razor-leaf": ["grass", 55, 95, 25], "sludge-bomb": ["poison", 90, 100, 10],
  "shadow-ball": ["ghost", 80, 100, 15], lick: ["ghost", 30, 100, 30],
  "dark-pulse": ["dark", 80, 100, 15], "body-slam": ["normal", 85, 100, 15],
  earthquake: ["ground", 100, 100, 10], crunch: ["dark", 80, 100, 15],
  "low-kick": ["fighting", 50, 100, 20], "karate-chop": ["fighting", 50, 100, 25],
  "rock-tomb": ["rock", 60, 95, 15], "brick-break": ["fighting", 75, 100, 15]
};
const titleCase = (name) => name.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");

function calculateStat(base, level, isHp = false) {
  return isHp
    ? Math.floor(((2 * base + 31) * level) / 100) + level + 10
    : Math.floor(((2 * base + 31) * level) / 100) + 5;
}

function createPokemon(name, level, types, stats, sprite, movimientos, isFallback = false) {
  return {
    name, level, types, stats, hpActual: stats.hp, sprite, backSprite: sprite,
    isFallback, movesFallback: false,
    movimientos: movimientos.map((move) => ({ ...move, ppActual: move.pp }))
  };
}

function fallbackMoves(name) {
  return (FALLBACK_MOVES[name] ?? ["tackle", "quick-attack", "swift", "body-slam"]).map((moveName) => ({
    name: MOVE_TRANSLATIONS[moveName] ?? titleCase(moveName),
    type: FALLBACK_MOVE_DATA[moveName][0],
    power: FALLBACK_MOVE_DATA[moveName][1],
    accuracy: FALLBACK_MOVE_DATA[moveName][2],
    pp: FALLBACK_MOVE_DATA[moveName][3]
  }));
}

function selectAvailableMoves(moveEntries, level) {
  const candidates = moveEntries
    .map((entry) => {
      const versions = entry.version_group_details.filter(({ move_learn_method, level_learned_at }) =>
        move_learn_method.name === "level-up" && level_learned_at <= level);
      return versions.length ? { ...entry, isRecent: versions.some(({ version_group }) => version_group.name === "scarlet-violet") } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b.isRecent) - Number(a.isRecent));
  return [...new Map(candidates.map((entry) => [entry.move.name, entry])).values()].slice(0, 10);
}

async function fetchMoves(moveEntries, level) {
  const candidates = selectAvailableMoves(moveEntries, level);
  const loaded = await Promise.all(candidates.map(async ({ move }) => {
    const response = await fetch(move.url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`PokéAPI no pudo cargar el movimiento "${move.name}".`);
    const data = await response.json();
    if (!data.power || !data.accuracy) return null;
    return {
      name: MOVE_TRANSLATIONS[data.name] ?? titleCase(data.name),
      type: data.type.name,
      power: data.power,
      accuracy: data.accuracy,
      pp: data.pp
    };
  }));
  const usable = loaded.filter(Boolean).slice(0, 4);
  return usable.length ? usable : null;
}

function completeMoveSet(name, moves) {
  const completed = [...(moves ?? [])];
  for (const move of fallbackMoves(name)) {
    if (completed.length === 4) break;
    if (!completed.some((existing) => existing.name.toLowerCase() === move.name.toLowerCase())) {
      completed.push(move);
    }
  }
  return completed;
}

function fallbackPokemon(name, level) {
  const data = FALLBACK_DATA[name.toLowerCase()] ?? FALLBACK_DATA.pikachu;
  const stats = Object.fromEntries(
    Object.entries(data.stats).map(([key, value]) => [key, calculateStat(value, level, key === "hp")])
  );
  const pokemon = createPokemon(data.name, level, data.types, stats, data.sprite, fallbackMoves(data.name), true);
  pokemon.backSprite = data.backSprite;
  return pokemon;
}

export async function fetchPokemon(name, level = 20) {
  const normalizedName = name.trim().toLowerCase();
  try {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(normalizedName)}`, {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      throw new Error(response.status === 404
        ? `Pokémon "${normalizedName}" no encontrado (404).`
        : `PokéAPI respondió con estado ${response.status}.`);
    }
    const data = await response.json();
    const baseStats = Object.fromEntries(data.stats.map(({ stat, base_stat }) => [stat.name, base_stat]));
    const stats = {
      hp: calculateStat(baseStats.hp, level, true),
      attack: calculateStat(baseStats.attack, level),
      defense: calculateStat(baseStats.defense, level),
      speed: calculateStat(baseStats.speed, level)
    };
    const types = data.types.map(({ type }) => type.name);
    if (!types.length) throw new Error(`La respuesta de PokéAPI no contiene tipos para "${normalizedName}".`);
    const fallback = FALLBACK_DATA[normalizedName];
    let movimientos;
    let usesFallbackMoves = false;
    try {
      movimientos = await fetchMoves(data.moves, level);
    } catch (error) {
      console.warn(`No se pudieron cargar los movimientos de ${normalizedName}; se usarán movimientos de respaldo.`, error);
      usesFallbackMoves = true;
    }
    if (!movimientos || movimientos.length < 4) usesFallbackMoves = true;
    const pokemon = createPokemon(data.name, level, types, stats,
      data.sprites.front_default ?? fallback?.sprite ?? "", completeMoveSet(normalizedName, movimientos), false);
    pokemon.movesFallback = usesFallbackMoves;
    pokemon.backSprite = data.sprites.back_default ?? fallback?.backSprite ?? pokemon.sprite;
    return pokemon;
  } catch (error) {
    console.warn(`No se pudo cargar ${normalizedName} desde PokéAPI; se usará un respaldo.`, error);
    const fallback = fallbackPokemon(normalizedName, level);
    fallback.loadError = error.message;
    return fallback;
  }
}

export async function loadTeams() {
  const roster = ["pikachu", "charmander", "squirtle", "bulbasaur", "eevee", "gengar", "snorlax", "machop"];
  const loaded = await Promise.all(roster.map((name) => fetchPokemon(name)));
  return [loaded.slice(0, 4), loaded.slice(4)];
}
