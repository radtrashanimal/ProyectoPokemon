const FALLBACK_DATA = {
  pikachu: { name: "pikachu", types: ["electric"], stats: { hp: 35, attack: 55, defense: 40, speed: 90 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/25.png" },
  charmander: { name: "charmander", types: ["fire"], stats: { hp: 39, attack: 52, defense: 43, speed: 65 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/4.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/4.png" },
  squirtle: { name: "squirtle", types: ["water"], stats: { hp: 44, attack: 48, defense: 65, speed: 43 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/7.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/7.png" },
  bulbasaur: { name: "bulbasaur", types: ["grass", "poison"], stats: { hp: 45, attack: 49, defense: 49, speed: 45 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/1.png" },
  eevee: { name: "eevee", types: ["normal"], stats: { hp: 55, attack: 55, defense: 50, speed: 55 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/133.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/133.png" },
  gengar: { name: "gengar", types: ["ghost", "poison"], stats: { hp: 60, attack: 65, defense: 60, speed: 110 }, sprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/94.png", backSprite: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/94.png" }
};

const MOVE_POOL = [
  { name: "Placaje", type: "normal", power: 40, accuracy: 100, pp: 35 },
  { name: "Ataque rápido", type: "normal", power: 40, accuracy: 100, pp: 30 },
  { name: "Golpe elemental", type: null, power: 55, accuracy: 95, pp: 20 },
  { name: "Impacto", type: null, power: 65, accuracy: 90, pp: 15 }
];

function calculateStat(base, level, isHp = false) {
  return isHp
    ? Math.floor(((2 * base + 31) * level) / 100) + level + 10
    : Math.floor(((2 * base + 31) * level) / 100) + 5;
}

function createPokemon(name, level, types, stats, sprite, isFallback = false) {
  const movimientos = MOVE_POOL.map((move, index) => ({ ...move, type: move.type ?? types[index % types.length] }));
  return {
    name, level, types, stats, hpActual: stats.hp, sprite, backSprite: sprite,
    isFallback,
    movimientos: movimientos.map((move) => ({ ...move, ppActual: move.pp }))
  };
}

function fallbackPokemon(name, level) {
  const data = FALLBACK_DATA[name.toLowerCase()] ?? FALLBACK_DATA.pikachu;
  const stats = Object.fromEntries(
    Object.entries(data.stats).map(([key, value]) => [key, calculateStat(value, level, key === "hp")])
  );
  const pokemon = createPokemon(data.name, level, data.types, stats, data.sprite, true);
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
    const pokemon = createPokemon(data.name, level, types, stats,
      data.sprites.front_default ?? fallback?.sprite ?? "", false);
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
  const roster = ["pikachu", "charmander", "squirtle", "bulbasaur", "eevee", "gengar"];
  const loaded = await Promise.all(roster.map((name) => fetchPokemon(name)));
  return [loaded.slice(0, 3), loaded.slice(3)];
}
