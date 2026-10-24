// Gedeelde logica voor het FA-indexscript (Node) en de tests.
// Gewoon JavaScript, zodat Node het zonder extra stappen kan draaien.
//
// Forgotten Adventures noemt bestanden zo:  Hay_Bale_01_A1_2x1.png
//   naam_variant_<breedte>x<hoogte>.png, met 200 px per vakje.
// Vloertexturen (jpg) hebben geen grootte in de naam; die lezen we uit het bestand.

/** Pad binnen de FA-bibliotheek, zonder "Core_Mapmaking_Pack_PartX/FA_Assets/". */
export function relFromFa(path) {
  const p = path.replace(/\\/g, '/');
  const i = p.indexOf('FA_Assets/');
  return i >= 0 ? p.slice(i + 'FA_Assets/'.length) : p;
}

/** "Hay_Bale_01_A1_2x1.png" -> { w: 2, h: 1 } (in vakjes). */
export function sizeFromName(name) {
  const m = /_(\d+)x(\d+)\.(png|webp)$/i.exec(name);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
}

/** Maakt de regels uit fa-map.json klaar voor gebruik (regex één keer bouwen). */
export function compileMap(map) {
  const deny = new RegExp(map.deny, 'i');
  const rules = [];
  for (const kind of ['props', 'floor', 'walls', 'doors', 'decor']) {
    for (const [id, list] of Object.entries(map[kind] ?? {})) {
      if (id.startsWith('_')) continue;
      for (const r of list) {
        const base = {
          kind,
          id,
          dir: r.dir,
          exclude: r.exclude ? new RegExp(r.exclude, 'i') : null,
          ext: r.ext ? r.ext.toLowerCase() : null,
        };
        const part = kind === 'walls' ? 'strip' : kind === 'doors' ? (r.part ?? 'door') : undefined;
        rules.push({ ...base, match: new RegExp(r.match, 'i'), part });
        if (r.connector) rules.push({ ...base, match: new RegExp(r.connector, 'i'), part: 'connector' });
      }
    }
  }
  return { deny, rules };
}

/**
 * Bij welke tegel-id's hoort dit bestand? (Meestal 0 of 1.)
 * `rel` = pad binnen de bibliotheek, met "/".
 * Voor muren zegt `part` of het een strook ("strip") of een hoekstuk ("connector") is.
 */
export function classify(compiled, rel) {
  if (compiled.deny.test(rel)) return [];
  const slash = rel.lastIndexOf('/');
  const dir = rel.slice(0, slash);
  const file = rel.slice(slash + 1);
  const inPaths = /\/Paths?(\/|$)/i.test(dir);
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  const out = [];
  for (const r of compiled.rules) {
    if (!(dir === r.dir || dir.startsWith(r.dir + '/'))) continue;
    if (inPaths && r.kind !== 'walls') continue; // "Paths"-mappen: alleen voor muren
    if (!r.match.test(file) || (r.exclude && r.exclude.test(file))) continue;
    if ((r.kind === 'props' || r.kind === 'decor') && !sizeFromName(file)) continue;
    if (r.kind !== 'props' && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;
    if (r.ext && ext !== r.ext) continue;
    if (!out.some((o) => o.kind === r.kind && o.id === r.id && o.part === r.part)) {
      out.push(r.part ? { kind: r.kind, id: r.id, part: r.part } : { kind: r.kind, id: r.id });
    }
  }
  return out;
}

/**
 * Waar staat er echt iets in een (gedecodeerde) PNG? Als deel van de breedte en hoogte (0..1).
 * `png` = { width, height, data } met RGBA-bytes, zoals pngjs het teruggeeft.
 * Nodig om een prop tegen de muur te schuiven: FA tekent ze in het midden van hun vierkant.
 */
export function alphaBox(png, threshold = 16) {
  const { width, height, data } = png;
  let x1 = width, y1 = height, x2 = -1, y2 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        if (x < x1) x1 = x;
        if (x > x2) x2 = x;
        if (y < y1) y1 = y;
        if (y > y2) y2 = y;
      }
    }
  }
  if (x2 < 0) return null;
  const r = (v) => Math.round(v * 1000) / 1000;
  return [r(x1 / width), r(y1 / height), r((x2 + 1) / width), r((y2 + 1) / height)];
}

/** Breedte en hoogte in pixels uit de kop van een PNG- of JPG-bestand. */
export function imageSize(buf) {
  // PNG: vaste plek in de IHDR-chunk.
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPG: zoek het SOF-blok (0xFFC0..0xFFCF, behalve C4, C8, CC).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

// ---------------------------------------------------------------- index slanker maken
//
// FA heeft per soort soms duizenden varianten (puin, tafels, pilaren). We bewaren er per
// tegel-id en per grootte een handvol: eerst de beste voor elke sfeer, dan aangevuld met
// een vaste "dobbelsteen". Zo is er genoeg afwisseling, heeft elke sfeer zijn varianten,
// en blijft de bundel voor de Raspberry Pi klein (honderden MB i.p.v. bijna 2 GB).

function hashStr(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function themeScoreOf(path, theme) {
  const words = new Set(path.slice(path.lastIndexOf('/') + 1).split(/[_.]/).map((w) => w.toLowerCase()));
  let s = 0;
  for (const w of theme.prefer ?? []) if (words.has(w.toLowerCase())) s += 1;
  for (const w of theme.avoid ?? []) if (words.has(w.toLowerCase())) s -= 10;
  return s;
}

/** Zoals floorScore in src/tiles/fa.ts: de vloerfamilie van de sfeer weegt het zwaarst. */
export function floorScoreOf(path, theme, id) {
  const fam = theme.floors?.[id];
  const file = path.slice(path.lastIndexOf('/') + 1);
  return themeScoreOf(path, theme) + (fam && new RegExp(fam, 'i').test(file) ? 100 : 0);
}

/**
 * Kies hoogstens `k` items: per sfeer de `perTheme` beste, dan aanvullen in vaste volgorde.
 * `score(pad, sfeer)` zegt hoe goed een item bij een sfeer past (standaard: woorden in de naam).
 */
export function pickSome(items, pathOf, themes, k, perTheme = 2, score = themeScoreOf) {
  if (items.length <= k) return items;
  const byHash = [...items].sort((a, b) => hashStr(pathOf(a)) - hashStr(pathOf(b)));
  const chosen = new Set();
  for (const theme of Object.values(themes)) {
    const ranked = [...byHash].sort((a, b) => score(pathOf(b), theme) - score(pathOf(a), theme));
    let n = 0;
    for (const it of ranked) {
      if (n >= perTheme || chosen.size >= k) break;
      if (!chosen.has(it)) { chosen.add(it); n++; }
    }
  }
  for (const it of byHash) {
    if (chosen.size >= k) break;
    chosen.add(it);
  }
  return items.filter((it) => chosen.has(it));
}

/** Het hele index slanker maken (props per grootte, vloeren, deuren, versiering). */
export function pruneIndex(index, limits = { props: 6, floor: 9, doors: 6, decor: 24 }) {
  const themes = index.themes ?? {};
  const path = (e) => e[0];
  for (const [id, list] of Object.entries(index.props)) {
    const bySize = new Map();
    for (const e of list) {
      const key = `${e[1]}x${e[2]}`;
      if (!bySize.has(key)) bySize.set(key, []);
      bySize.get(key).push(e);
    }
    index.props[id] = [...bySize.values()].flatMap((g) => pickSome(g, path, themes, limits.props));
  }
  // Vloeren: per sfeer 3 uit de eigen familie (bv. gebarsten aarde voor "verlaten").
  for (const [id, list] of Object.entries(index.floor)) {
    index.floor[id] = pickSome(list, path, themes, limits.floor, 3, (p, theme) => floorScoreOf(p, theme, id));
  }
  for (const d of Object.values(index.doors ?? {})) d.doors = pickSome(d.doors, path, themes, limits.doors);
  for (const [id, list] of Object.entries(index.decor ?? {})) index.decor[id] = pickSome(list, (p) => p, themes, limits.decor, 0);
  return index;
}

/** Alle FA-paden die in een index voorkomen (voor de bundel). */
export function indexPaths(index) {
  const out = new Set();
  for (const list of Object.values(index.props ?? {})) for (const e of list) out.add(e[0]);
  for (const list of Object.values(index.floor ?? {})) for (const e of list) out.add(e[0]);
  for (const w of Object.values(index.walls ?? {})) for (const e of [...w.strips, ...w.connectors]) out.add(e[0]);
  for (const d of Object.values(index.doors ?? {})) for (const e of [...d.doors, ...d.frames]) out.add(e[0]);
  for (const list of Object.values(index.decor ?? {})) for (const p of list) out.add(p);
  return [...out];
}
