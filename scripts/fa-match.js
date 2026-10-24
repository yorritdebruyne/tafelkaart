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
  for (const kind of ['props', 'floor']) {
    for (const [id, list] of Object.entries(map[kind] ?? {})) {
      for (const r of list) {
        rules.push({
          kind,
          id,
          dir: r.dir,
          match: new RegExp(r.match, 'i'),
          exclude: r.exclude ? new RegExp(r.exclude, 'i') : null,
          ext: r.ext ? r.ext.toLowerCase() : null,
        });
      }
    }
  }
  return { deny, rules };
}

/**
 * Bij welke tegel-id's hoort dit bestand? (Meestal 0 of 1.)
 * `rel` = pad binnen de bibliotheek, met "/".
 */
export function classify(compiled, rel) {
  if (compiled.deny.test(rel)) return [];
  const slash = rel.lastIndexOf('/');
  const dir = rel.slice(0, slash);
  const file = rel.slice(slash + 1);
  if (/\/Paths?(\/|$)/i.test(dir)) return [];
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  const out = [];
  for (const r of compiled.rules) {
    if (!(dir === r.dir || dir.startsWith(r.dir + '/'))) continue;
    if (!r.match.test(file) || (r.exclude && r.exclude.test(file))) continue;
    if (r.kind === 'props' && !sizeFromName(file)) continue;
    if (r.kind === 'floor' && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) continue;
    if (r.ext && ext !== r.ext) continue;
    if (!out.some((o) => o.kind === r.kind && o.id === r.id)) out.push({ kind: r.kind, id: r.id });
  }
  return out;
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
