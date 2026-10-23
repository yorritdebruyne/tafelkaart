// ============================================================================
//  YORRIT: hier pas je de kleuren aan.
//  In M1 is elke tegel een effen kleur. In M2 komen hier echte tegels bij
//  (SVG of afbeeldingen in deze map), en deze kleuren blijven de reserve.
//
//  Een tegel-id die hier NIET staat, wordt grijs getekend met de naam erin.
//  Bestaande id's niet hernoemen: de DM gebruikt ze.
// ============================================================================

export const FLOOR: Record<string, string> = {
  wood: '#a47548',
  stone: '#8e8b86',
  cobble: '#77736c',
  dirt: '#9a7a52',
  grass: '#6e9a4a',
  sand: '#d9c48d',
  snow: '#eef2f5',
  carpet: '#8b3c3c',
  tiles: '#c8c1b1',
  'water-shallow': '#73b2d8',
  'water-deep': '#2f6b9a',
  lava: '#d8521c',
  void: '#121212',
};

export const WALL: Record<string, string> = {
  stone: '#45423f',
  wood: '#5a391c',
  brick: '#8a3a2a',
  hedge: '#2e5a28',
  cliff: '#3b3126',
  fence: '#7b5a35',
  palisade: '#4e3920',
};

export const DOOR: Record<string, string> = {
  'door-wood': '#b07a3e',
  'door-iron': '#69737d',
  gate: '#7a6544',
  portcullis: '#4a4a4a',
  window: '#a8d6f0',
  arch: '#9a948c',
};

/** Kleur per kant van een token. */
export const SIDE: Record<'player' | 'enemy' | 'npc', string> = {
  player: '#2f7fd8',
  enemy: '#d23b3b',
  npc: '#d49b15',
};

/** Kleur voor alles wat de app niet kent (F18). */
export const UNKNOWN = '#9e9e9e';
