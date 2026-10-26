// Patches toepassen (F9).
//
// Een patch is een kleine wijziging die de DM tijdens het spel stuurt:
// tokens verplaatsen, toevoegen of weghalen, deuren openen, regio's tonen.
//
//   applyPatch(state, json) -> { state, errors, warnings, changes }
//
// Net als bij de kaart: elk item wordt APART gecontroleerd. Een fout item
// wordt overgeslagen met een melding, de rest van de patch wordt toegepast.
// Alleen een patch voor een andere kaart wordt helemaal geweigerd.
//
// De functie is "puur": ze verandert de oude state niet, maar geeft een nieuwe
// terug. Daardoor kan undo (M3) later gewoon de oude state terugzetten.

import { z } from 'zod';
import { conditionLabel } from './conditions';
import { type Cell, cellInBounds, formatCell, parseCell } from './coords';
import { type DoorItem, type DoorState, MAP_VERSION, type TokenItem, issuesToText } from './schema';
import type { MapState } from './state';

export interface PatchResult {
  /** De nieuwe state. Bij een geweigerde patch: de oude, onveranderd. */
  state: MapState;
  /** false = niets gedaan (andere kaart, kapotte patch of al toegepast). */
  applied: boolean;
  /** true = deze patch werd al eens toegepast. */
  duplicate: boolean;
  errors: string[];
  warnings: string[];
  /** Korte beschrijving per wijziging, bv. "T1 → C3". */
  changes: string[];
}

// ---------------------------------------------------------------- schema's

const HeaderSchema = z.object({
  type: z.literal('patch'),
  version: z.number().int(),
  map: z.string().min(1),
});

const AddSchema = z.object({
  name: z.string().min(1).optional(),
  side: z.enum(['player', 'enemy', 'npc']),
  cell: z.string(),
  size: z.union([z.literal(1), z.literal(2)]).default(1),
  speed: z.number().positive().optional(),
  conditions: z.array(z.string()).optional(),
});

const TokenPatchSchema = z.object({
  cell: z.string().optional(),
  remove: z.boolean().optional(),
  add: AddSchema.optional(),
  conditions: z.array(z.string()).optional(),
});

const DoorPatchSchema = z.object({
  state: z.enum(['open', 'closed', 'locked']),
});

const DOOR_NL: Record<DoorState, string> = { open: 'open', closed: 'dicht', locked: 'op slot' };

// ---------------------------------------------------------------- vingerafdruk

/** JSON met gesorteerde sleutels: zelfde inhoud = zelfde tekst, ook met andere spaties of volgorde. */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

/** Korte hash (FNV-1a, 32 bit) van de patch. Genoeg om "al gezien" te herkennen. */
export function patchFingerprint(input: unknown): string {
  let h = 0x811c9dc5;
  for (const ch of stableStringify(input)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------- toepassen

export function applyPatch(state: MapState, input: unknown): PatchResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const changes: string[] = [];
  const refuse = (msg: string): PatchResult => ({
    state, applied: false, duplicate: false, errors: [msg], warnings, changes,
  });

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return refuse('De patch moet een JSON-object zijn: { "type": "patch", ... }');
  }
  const obj = input as Record<string, unknown>;
  const head = HeaderSchema.safeParse(obj);
  if (!head.success) {
    return { ...refuse(''), errors: issuesToText('', head.error, obj) };
  }
  const { version, map: mapName } = head.data;
  const { map } = state;
  if (mapName.trim().toLowerCase() !== map.name.trim().toLowerCase()) {
    return refuse(`Deze patch is voor de kaart "${mapName}", maar de geladen kaart is "${map.name}". Niets veranderd.`);
  }
  if (version !== MAP_VERSION) {
    warnings.push(`version ${version}: deze app kent versie ${MAP_VERSION}. Ik probeer het toch.`);
  }

  const fingerprint = patchFingerprint(obj);
  if (state.patches.includes(fingerprint)) {
    return { state, applied: false, duplicate: true, errors, warnings, changes };
  }

  // Werkkopieën: we bouwen de nieuwe kaart stap voor stap op.
  let tokens: TokenItem[] = map.tokens;
  let doors: DoorItem[] = map.doors;
  let regions = map.regions;
  const paths = { ...state.paths };

  /** Een object { "id": {...} } ophalen; ontbrekend = leeg. */
  const record = (key: string): [string, unknown][] => {
    const v = obj[key];
    if (v === undefined || v === null) return [];
    if (typeof v !== 'object' || Array.isArray(v)) {
      errors.push(`${key}: verwacht een object { "id": { ... } }`);
      return [];
    }
    return Object.entries(v as Record<string, unknown>);
  };

  /** Vakje lezen en controleren of een token van `size` er past. */
  const cellOf = (text: string, where: string, size: number): Cell | null => {
    const cell = parseCell(text);
    if (!cell) {
      errors.push(`${where}: onbekend vakje "${text}"`);
      return null;
    }
    if (!cellInBounds(cell, map.cols, map.rows, size)) {
      const extra = size > 1 ? ` (token van ${size}×${size})` : '';
      errors.push(`${where}: "${formatCell(cell)}" ligt buiten de kaart (${map.cols}×${map.rows})${extra}`);
      return null;
    }
    return cell;
  };

  // --- tokens
  for (const [id, raw] of record('tokens')) {
    const where = `tokens.${id}`;
    const res = TokenPatchSchema.safeParse(raw);
    if (!res.success) {
      errors.push(...issuesToText(where, res.error, raw));
      continue;
    }
    const p = res.data;
    const existing = tokens.find((t) => t.id === id);

    if (p.remove) {
      if (!existing) {
        errors.push(`${where}: onbekend token, kan het niet weghalen`);
        continue;
      }
      tokens = tokens.filter((t) => t.id !== id);
      delete paths[id];
      changes.push(`${existing.name} weg`);
      continue;
    }

    if (p.add) {
      if (existing) {
        errors.push(`${where}.add: token "${id}" bestaat al`);
        continue;
      }
      const a = p.add;
      const cell = cellOf(a.cell, `${where}.add.cell`, a.size);
      if (!cell) continue;
      const conditions = p.conditions ?? a.conditions;
      const token: TokenItem = {
        id, name: a.name ?? id, side: a.side, cell, size: a.size, speed: a.speed,
        ...(conditions ? { conditions } : {}),
      };
      tokens = [...tokens, token];
      paths[id] = [cell];
      changes.push(`${token.name} erbij op ${formatCell(cell)}`);
      continue;
    }

    if (!existing) {
      errors.push(`${where}: onbekend token "${id}" (gebruik "add" voor een nieuw token)`);
      continue;
    }
    let updated = existing;
    if (p.cell !== undefined) {
      const cell = cellOf(p.cell, `${where}.cell`, existing.size);
      if (cell) {
        updated = { ...updated, cell };
        // De DM verplaatst: telt niet mee voor de beweging van deze beurt.
        paths[id] = [cell];
        changes.push(`${existing.name} → ${formatCell(cell)}`);
      }
    }
    if (p.conditions !== undefined) {
      updated = { ...updated, conditions: p.conditions };
      changes.push(`${existing.name}: ${p.conditions.length ? p.conditions.map(conditionLabel).join(', ') : 'geen condities'}`);
    }
    if (p.cell === undefined && p.conditions === undefined) {
      warnings.push(`${where}: niets te doen (verwacht "cell", "conditions", "add" of "remove")`);
    }
    if (updated !== existing) tokens = tokens.map((t) => (t.id === id ? updated : t));
  }

  // --- doors
  for (const [id, raw] of record('doors')) {
    const where = `doors.${id}`;
    const res = DoorPatchSchema.safeParse(raw);
    if (!res.success) {
      errors.push(...issuesToText(where, res.error, raw));
      continue;
    }
    if (!doors.some((d) => d.id === id)) {
      errors.push(`${where}: onbekende deur "${id}"`);
      continue;
    }
    const next = res.data.state;
    doors = doors.map((d) => (d.id === id ? { ...d, state: next } : d));
    changes.push(`deur ${id} ${DOOR_NL[next]}`);
  }

  // --- reveal
  const reveal = obj.reveal;
  if (reveal !== undefined && reveal !== null) {
    if (!Array.isArray(reveal)) {
      errors.push('reveal: verwacht een lijst [ "id", ... ]');
    } else {
      reveal.forEach((id, i) => {
        const where = `reveal[${i}]`;
        if (typeof id !== 'string') return void errors.push(`${where}: verwacht tekst (de id van een regio)`);
        const region = regions.find((g) => g.id === id);
        if (!region) return void errors.push(`${where}: onbekende regio "${id}"`);
        if (!region.hidden) return;
        regions = regions.map((g) => (g.id === id ? { ...g, hidden: false } : g));
        changes.push(`${id} zichtbaar`);
      });
    }
  }

  return {
    state: {
      map: { ...map, tokens, doors, regions },
      paths,
      patches: [...state.patches, fingerprint],
    },
    applied: true,
    duplicate: false,
    errors,
    warnings,
    changes,
  };
}
