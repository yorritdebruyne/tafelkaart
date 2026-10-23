// Kaart-JSON inlezen en controleren.
//
// Werkwijze: we controleren eerst de kop (type, version, name, cols, rows).
// Daarna elk item in elke lijst APART. Een fout item wordt overgeslagen met
// een duidelijke melding (bv. "walls[3]: onbekend punt [12, 4]"), de rest van
// de kaart wordt gewoon getekend.
//
// Zod is een bibliotheek die een object vergelijkt met een "schema" (een soort
// type-beschrijving die ook tijdens het draaien bestaat, anders dan TypeScript-types).
// Onbekende velden laat Zod standaard weg: precies wat we willen.

import { z } from 'zod';
import {
  type Cell,
  type EdgeSide,
  type Rect,
  cellInBounds,
  formatCell,
  parseArea,
  parseCell,
  rectInBounds,
} from './coords';
import { DOOR, FLOOR, WALL } from './tiles/palette';

export const MAP_VERSION = 1;

export type Side = 'player' | 'enemy' | 'npc';
export type DoorState = 'open' | 'closed' | 'locked';

export interface FloorItem { tile: string; rect: Rect; }
export interface WallItem { tile: string; points: [number, number][]; }
export interface DoorItem { id: string; tile: string; cell: Cell; side: EdgeSide; state: DoorState; }
export interface TokenItem {
  id: string;
  name: string;
  side: Side;
  /** Linkerbovenhoek van het token. */
  cell: Cell;
  size: 1 | 2;
  /** Speed in vakjes (6 = 30 ft = 9 m). */
  speed?: number;
  /** Condities (bv. "prone"), gezet via een patch. Getekend als badge in M3 (F14). */
  conditions?: string[];
}
/** Een regio voor fog of war (F11). Verborgen = bedekt met mist. */
export interface RegionItem { id: string; rect: Rect; hidden: boolean; }

export interface MapData {
  version: number;
  name: string;
  cols: number;
  rows: number;
  floor: FloorItem[];
  walls: WallItem[];
  doors: DoorItem[];
  regions: RegionItem[];
  tokens: TokenItem[];
}

export interface ParseResult {
  map: MapData | null;
  errors: string[];
  warnings: string[];
  /** Info, geen fout: bv. velden die pas in een latere mijlpaal getekend worden. */
  notes: string[];
}

// ---------------------------------------------------------------- schema's

const HeaderSchema = z.object({
  type: z.literal('map'),
  version: z.number().int(),
  name: z.string().min(1),
  cols: z.number().int().min(1).max(100),
  rows: z.number().int().min(1).max(100),
});

const FloorSchema = z.object({
  tile: z.string().min(1),
  area: z.string().optional(),
  cell: z.string().optional(),
});

const WallSchema = z.object({
  tile: z.string().min(1).default('stone'),
  path: z.array(z.tuple([z.number(), z.number()])).min(2),
});

const DoorSchema = z.object({
  id: z.string().min(1).optional(),
  tile: z.string().min(1).default('door-wood'),
  cell: z.string(),
  side: z.string(),
  state: z.enum(['open', 'closed', 'locked']).default('closed'),
});

const RegionSchema = z.object({
  id: z.string().min(1),
  area: z.string().optional(),
  cell: z.string().optional(),
  // Zonder "hidden" is een regio verborgen: anders heeft ze geen nut.
  hidden: z.boolean().default(true),
});

const TokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  side: z.enum(['player', 'enemy', 'npc']),
  cell: z.string(),
  size: z.union([z.literal(1), z.literal(2)]).default(1),
  speed: z.number().positive().optional(),
});

// "E" en "S" (Engels) aanvaarden we ook, voor het gemak.
const SIDE_ALIASES: Record<string, EdgeSide> = { N: 'N', O: 'O', E: 'O', Z: 'Z', S: 'Z', W: 'W' };

/** Velden die we al aanvaarden maar pas later tekenen. */
const LATER: Record<string, string> = {
  props: 'M2',
  terrain: 'M3',
  lights: 'M3',
};

// ---------------------------------------------------------------- foutmeldingen

const TYPE_NL: Record<string, string> = {
  string: 'tekst',
  number: 'een getal',
  int: 'een geheel getal',
  array: 'een lijst',
  object: 'een object',
  boolean: 'true of false',
  tuple: 'een punt [x, y]',
};

function joinPath(base: string, path: readonly PropertyKey[]): string {
  let s = base;
  for (const p of path) s += typeof p === 'number' ? `[${p}]` : `${s ? '.' : ''}${String(p)}`;
  return s;
}

function valueAt(obj: unknown, path: readonly PropertyKey[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<PropertyKey, unknown>)[p];
  }
  return cur;
}

function describeIssue(issue: z.core.$ZodIssue, input: unknown): string {
  if (issue.code === 'invalid_type' && valueAt(input, issue.path) === undefined) return 'ontbreekt';
  switch (issue.code) {
    case 'invalid_type':
      return `verwacht ${TYPE_NL[issue.expected] ?? issue.expected}`;
    case 'invalid_value':
      return `moet ${issue.values.map((v) => JSON.stringify(v)).join(' of ')} zijn`;
    case 'too_small':
      return issue.origin === 'array'
        ? `te weinig items (minstens ${issue.minimum})`
        : issue.origin === 'string' ? 'mag niet leeg zijn' : `te klein (minstens ${issue.minimum})`;
    case 'too_big':
      return issue.origin === 'array'
        ? `te veel items (hoogstens ${issue.maximum})`
        : `te groot (hoogstens ${issue.maximum})`;
    case 'invalid_union':
      return 'ongeldige waarde';
    default:
      return issue.message;
  }
}

export function issuesToText(base: string, error: z.ZodError, input: unknown): string[] {
  return error.issues.map((issue) => `${joinPath(base, issue.path)}: ${describeIssue(issue, input)}`);
}

// ---------------------------------------------------------------- JSON lezen

export function parseJsonLenient(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    // Misschien staat er tekst rond de JSON (bv. ```json ... ``` uit de chat).
    const i = text.indexOf('{');
    const j = text.lastIndexOf('}');
    if (i >= 0 && j > i) {
      try {
        return { ok: true, value: JSON.parse(text.slice(i, j + 1)) };
      } catch {
        /* val terug op de eerste fout */
      }
    }
    return { ok: false, error: `Geen geldige JSON: ${(e as Error).message}` };
  }
}

export function parseMapText(text: string): ParseResult {
  if (!text.trim()) return { map: null, errors: ['Het tekstvak is leeg.'], warnings: [], notes: [] };
  const json = parseJsonLenient(text);
  if (!json.ok) return { map: null, errors: [json.error], warnings: [], notes: [] };
  return parseMapObject(json.value);
}

// ---------------------------------------------------------------- kaart

export function parseMapObject(input: unknown): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];
  const fail = (msg: string): ParseResult => ({ map: null, errors: [msg], warnings, notes });

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return fail('De kaart moet een JSON-object zijn: { "type": "map", ... }');
  }
  const obj = input as Record<string, unknown>;
  if (obj.type === 'patch') {
    return fail('Dit is een patch, geen kaart. Laad eerst de kaart en plak de patch daarna.');
  }

  const head = HeaderSchema.safeParse(obj);
  if (!head.success) {
    return { map: null, errors: issuesToText('', head.error, obj), warnings, notes };
  }
  const { version, name, cols, rows } = head.data;
  if (version !== MAP_VERSION) {
    warnings.push(`version ${version}: deze app kent versie ${MAP_VERSION}. Ik probeer het toch.`);
  }

  const size = `${cols}×${rows}`;
  const unknownTiles = new Set<string>();
  const warnUnknownTile = (tile: string, where: string, known: Record<string, string>) => {
    if (known[tile] || unknownTiles.has(tile)) return;
    unknownTiles.add(tile);
    warnings.push(`${where}: onbekende tegel "${tile}", wordt grijs getekend.`);
  };

  /** Haal een lijst op; ontbrekend = lege lijst. */
  const list = (key: string): unknown[] => {
    const v = obj[key];
    if (v === undefined || v === null) return [];
    if (!Array.isArray(v)) {
      errors.push(`${key}: verwacht een lijst [ ... ]`);
      return [];
    }
    return v;
  };

  /** Lees een vakje en controleer of het op de kaart ligt. */
  const cellOf = (text: string, where: string, tokenSize = 1): Cell | null => {
    const cell = parseCell(text);
    if (!cell) {
      errors.push(`${where}: onbekend vakje "${text}"`);
      return null;
    }
    if (!cellInBounds(cell, cols, rows, tokenSize)) {
      const extra = tokenSize > 1 ? ` (token van ${tokenSize}×${tokenSize})` : '';
      errors.push(`${where}: "${formatCell(cell)}" ligt buiten de kaart (${size})${extra}`);
      return null;
    }
    return cell;
  };

  /** Lees "area" of "cell" van een item als rechthoek, binnen de kaart. */
  const rectOf = (area: string | undefined, cell: string | undefined, where: string): Rect | null => {
    const text = area ?? cell;
    if (!text) {
      errors.push(`${where}: "area" of "cell" ontbreekt`);
      return null;
    }
    const rect = parseArea(text);
    if (!rect) {
      errors.push(`${where}.${area ? 'area' : 'cell'}: onbekend gebied "${text}"`);
      return null;
    }
    if (!rectInBounds(rect, cols, rows)) {
      errors.push(`${where}: "${text}" valt (deels) buiten de kaart (${size})`);
      return null;
    }
    return rect;
  };

  // --- floor
  const floor: FloorItem[] = [];
  list('floor').forEach((raw, i) => {
    const where = `floor[${i}]`;
    const res = FloorSchema.safeParse(raw);
    if (!res.success) return void errors.push(...issuesToText(where, res.error, raw));
    const { tile, area, cell } = res.data;
    const rect = rectOf(area, cell, where);
    if (!rect) return;
    warnUnknownTile(tile, where, FLOOR);
    floor.push({ tile, rect });
  });

  // --- walls
  const walls: WallItem[] = [];
  list('walls').forEach((raw, i) => {
    const where = `walls[${i}]`;
    const res = WallSchema.safeParse(raw);
    if (!res.success) return void errors.push(...issuesToText(where, res.error, raw));
    const bad = res.data.path.find(
      ([x, y]) => !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > cols || y > rows,
    );
    if (bad) {
      return void errors.push(
        `${where}: onbekend punt [${bad[0]}, ${bad[1]}] (hoekpunten lopen van [0, 0] tot [${cols}, ${rows}])`,
      );
    }
    warnUnknownTile(res.data.tile, where, WALL);
    walls.push({ tile: res.data.tile, points: res.data.path });
  });

  // --- doors
  const doors: DoorItem[] = [];
  const doorIds = new Set<string>();
  list('doors').forEach((raw, i) => {
    const where = `doors[${i}]`;
    const res = DoorSchema.safeParse(raw);
    if (!res.success) return void errors.push(...issuesToText(where, res.error, raw));
    const side = SIDE_ALIASES[res.data.side.trim().toUpperCase()];
    if (!side) return void errors.push(`${where}.side: moet N, O, Z of W zijn (niet "${res.data.side}")`);
    const cell = cellOf(res.data.cell, `${where}.cell`);
    if (!cell) return;
    const id = res.data.id ?? `deur${i + 1}`;
    if (doorIds.has(id)) warnings.push(`${where}: id "${id}" bestaat al; patches vinden alleen de eerste.`);
    doorIds.add(id);
    warnUnknownTile(res.data.tile, where, DOOR);
    doors.push({ id, tile: res.data.tile, cell, side, state: res.data.state });
  });

  // --- regions (fog of war)
  const regions: RegionItem[] = [];
  const regionIds = new Set<string>();
  list('regions').forEach((raw, i) => {
    const where = `regions[${i}]`;
    const res = RegionSchema.safeParse(raw);
    if (!res.success) return void errors.push(...issuesToText(where, res.error, raw));
    const { id, area, cell, hidden } = res.data;
    if (regionIds.has(id)) return void errors.push(`${where}.id: "${id}" bestaat al, regio overgeslagen`);
    const rect = rectOf(area, cell, where);
    if (!rect) return;
    regionIds.add(id);
    regions.push({ id, rect, hidden });
  });

  // --- tokens
  const tokens: TokenItem[] = [];
  const tokenIds = new Set<string>();
  list('tokens').forEach((raw, i) => {
    const where = `tokens[${i}]`;
    const res = TokenSchema.safeParse(raw);
    if (!res.success) return void errors.push(...issuesToText(where, res.error, raw));
    const t = res.data;
    if (tokenIds.has(t.id)) return void errors.push(`${where}.id: "${t.id}" bestaat al, token overgeslagen`);
    const cell = cellOf(t.cell, `${where}.cell`, t.size);
    if (!cell) return;
    tokenIds.add(t.id);
    tokens.push({ id: t.id, name: t.name ?? t.id, side: t.side, cell, size: t.size, speed: t.speed });
  });

  // --- velden voor later
  const later = Object.entries(LATER)
    .filter(([key]) => Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0)
    .map(([key, when]) => `${key} (${when})`);
  if (later.length) notes.push(`Nog niet getekend, komt later: ${later.join(', ')}.`);

  return {
    map: { version, name, cols, rows, floor, walls, doors, regions, tokens },
    errors,
    warnings,
    notes,
  };
}
