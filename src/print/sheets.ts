// Printmodus (F16): de bladen opbouwen die de browser afdrukt.
//
// Hoe het werkt:
//   1. We tekenen de kaart nog één keer, met de gewone render-functies, in een onzichtbare
//      "master"-svg (zonder licht, zonder sleepwegen, eventueel zonder tokens).
//   2. Per blad maken we een <svg> zo groot als het papier, in millimeter. Daarin staat een
//      venster (een geneste <svg> met een viewBox) dat precies het stuk kaart van dat blad
//      toont. Dat venster verwijst met <use> naar de master: zo staat de kaart maar één keer
//      in het geheugen, ook bij 9 bladen.
//   3. Rond het venster: letters en cijfers, snijtekens op de hoeken en een voettekst.
//
// Een vakje is 64 SVG-eenheden in de master en 25 mm op papier: dat regelt de viewBox.

import { colToLetters, formatCell } from '../coords';
import { createMapView, renderMap } from '../render';
import { onFogEdge } from '../render/fog';
import { getLightMode, setLightMode } from '../render/light';
import { S, svgEl } from '../render/svg';
import { renderDoor } from '../render/walls';
import type { MapData } from '../schema';
import { createState, type MapState } from '../state';
import {
  CELL_MM, FOOTER_MM, LABEL_MM, MARGIN_MM, type Range, type Sheet, type SheetPlan,
  mapOrigin, planSheets,
} from './layout';
import type { PrintOptions } from './options';

export { DEFAULT_PRINT, type PrintOptions } from './options';

/** Hoeveel bladen het wordt, zonder iets te tekenen (voor de dialoog). */
export function printPlans(map: MapData, opts: PrintOptions): { main: SheetPlan; hidden: SheetPlan[] } {
  const main = planSheets({ c0: 0, r0: 0, cols: map.cols, rows: map.rows }, opts.paper, opts.orientation);
  const hidden = opts.hiddenSheets
    ? hiddenRanges(map).map((r) => planSheets(r, opts.paper, opts.orientation))
    : [];
  return { main, hidden };
}

function hiddenRanges(map: MapData): Range[] {
  return map.regions
    .filter((g) => g.hidden)
    .map((g) => ({ c0: g.rect.c1, r0: g.rect.r1, cols: g.rect.c2 - g.rect.c1 + 1, rows: g.rect.r2 - g.rect.r1 + 1 }));
}

/** Alle bladen in `root` zetten. Geeft de @page-grootte terug (in mm). */
export function buildPrint(root: HTMLElement, state: MapState, opts: PrintOptions): { pageW: number; pageH: number } {
  root.replaceChildren();
  const map = state.map;
  const plans = printPlans(map, opts);

  // Hoofdkaart: verborgen kamers blijven verborgen (als blanco vakjes).
  const mainMaster = renderMaster(root, map, opts, 'pm', opts.tokens);
  const total = plans.main.sheets.length + plans.hidden.reduce((n, p) => n + p.sheets.length, 0);
  let page = 0;
  for (const sheet of plans.main.sheets) {
    page++;
    const footer = `${map.name} · blad ${page}/${total} · rij ${sheet.row + 1}, kolom ${sheet.col + 1} · ${rangeText(sheet)}`
      + (page === 1 ? ' · controle: 4 vakjes = 10 cm' : '');
    root.appendChild(buildSheet(plans.main, sheet, mainMaster, footer));
  }

  // Verborgen kamers: dezelfde kaart, maar met de mist weg. Nooit tokens (die zouden iets verklappen).
  if (plans.hidden.length) {
    const revealed: MapData = { ...map, regions: map.regions.map((g) => ({ ...g, hidden: false })) };
    const hiddenMaster = renderMaster(root, revealed, opts, 'ph', false);
    plans.hidden.forEach((plan, k) => {
      for (const sheet of plan.sheets) {
        page++;
        const part = plan.sheets.length > 1 ? `, deel ${sheet.index + 1}/${plan.sheets.length}` : '';
        const footer = `${map.name} · blad ${page}/${total} · VERBORGEN KAMER ${k + 1}${part} · ${rangeText(sheet)}`
          + ' · pas bekijken als de DM ze toont';
        root.appendChild(buildSheet(plan, sheet, hiddenMaster, footer));
      }
    });
  }
  return { pageW: plans.main.pageW, pageH: plans.main.pageH };
}

// ------------------------------------------------------------------ master

/** De kaart één keer tekenen voor de print. Geeft de id van de groep om naar te verwijzen. */
function renderMaster(root: HTMLElement, map: MapData, opts: PrintOptions, prefix: string, withTokens: boolean): string {
  const printMap: MapData = { ...map, tokens: withTokens ? map.tokens : [] };
  // Een frisse state: geen sleepwegen, geen geselecteerd token.
  const state = createState(printMap);
  const view = createMapView();

  // Licht nooit afdrukken (veel inkt, en op tafel heb je echt licht).
  const mode = getLightMode();
  setLightMode('uit');
  try {
    renderMap(view, state, null);
  } finally {
    setLightMode(mode);
  }

  const L = view.layers;
  for (const name of ['labels', 'path', 'overlay', 'light'] as const) L[name].replaceChildren();
  // Geen sleep-badges ("0/6") op papier.
  for (const el of view.svg.querySelectorAll('.badge')) el.remove();
  renderPrintFog(L.fog, map);

  if (opts.inkSaver) {
    L.floor.setAttribute('opacity', '0.4');
    L.decor.replaceChildren();
    L.props.removeAttribute('filter');
    L.walls.removeAttribute('filter');
  }

  // Alles in één groep met een id, zodat elk blad er met <use> naar kan verwijzen.
  // Eerst de id's van de kaart een voorvoegsel geven, daarna pas de groep een id.
  prefixIds(view.svg, prefix);
  const id = `${prefix}-map`;
  const group = svgEl('g', { id });
  group.append(...view.svg.childNodes);
  view.svg.appendChild(group);
  view.svg.setAttribute('class', 'print-master');
  view.svg.setAttribute('aria-hidden', 'true');
  view.svg.removeAttribute('viewBox');
  root.appendChild(view.svg);
  return id;
}

/**
 * Verborgen kamers op papier: wit met een licht grid, zodat je er later het aparte blad
 * op kan leggen. Deuren op de rand van de mist blijven zichtbaar (zoals op het scherm).
 */
function renderPrintFog(g: SVGGElement, map: MapData): void {
  g.replaceChildren();
  const hidden = map.regions.filter((r) => r.hidden);
  if (!hidden.length) return;
  for (const r of hidden) {
    const { c1, r1, c2, r2 } = r.rect;
    const x = c1 * S, y = r1 * S, w = (c2 - c1 + 1) * S, h = (r2 - r1 + 1) * S;
    svgEl('rect', { x, y, width: w, height: h, class: 'print-hidden' }, g);
    let d = '';
    for (let c = c1; c <= c2 + 1; c++) d += `M${c * S} ${y}V${y + h}`;
    for (let rr = r1; rr <= r2 + 1; rr++) d += `M${x} ${rr * S}H${x + w}`;
    svgEl('path', { d, class: 'grid-lines' }, g);
  }
  for (const d of map.doors) if (onFogEdge(map, d)) renderDoor(g, d, map.name);
}

/**
 * Zet `prefix-` voor elke id en pas de verwijzingen (url(#...)) aan. Anders botsen de
 * id's met die van de kaart op het scherm (bv. twee keer "floor-map-clip").
 */
export function prefixIds(svg: SVGSVGElement, prefix: string): void {
  const ids = new Set<string>();
  for (const el of svg.querySelectorAll('[id]')) {
    ids.add(el.id);
    el.id = `${prefix}-${el.id}`;
  }
  const re = /url\(#([^)]+)\)/g;
  for (const el of svg.querySelectorAll('*')) {
    for (const attr of ['fill', 'stroke', 'clip-path', 'mask', 'filter']) {
      const v = el.getAttribute(attr);
      if (v && v.includes('url(#')) {
        el.setAttribute(attr, v.replace(re, (m, id: string) => (ids.has(id) ? `url(#${prefix}-${id})` : m)));
      }
    }
  }
}

// ------------------------------------------------------------------ één blad

const MARK_GAP = 1.5; // mm tussen de kaart en het snijteken
const MARK_LEN = 4; // mm
const FOOTER_FONT = 2.3; // mm

function buildSheet(plan: SheetPlan, sheet: Sheet, masterId: string, footer: string): HTMLElement {
  const div = document.createElement('div');
  div.className = 'print-sheet';
  div.style.width = `${plan.pageW}mm`;
  // Iets minder dan het blad: anders kan een afrondingsfout een leeg blad toevoegen.
  div.style.height = `${plan.pageH - 0.5}mm`;

  // Het hele blad in millimeter: viewBox "0 0 210 297" -> 1 eenheid = 1 mm.
  const svg = svgEl('svg', {
    class: 'print-page',
    width: `${plan.pageW}mm`,
    height: `${plan.pageH}mm`,
    viewBox: `0 0 ${plan.pageW} ${plan.pageH}`,
  });
  div.appendChild(svg);

  const { x, y } = mapOrigin(plan, sheet);
  const w = sheet.cols * CELL_MM;
  const h = sheet.rows * CELL_MM;

  // Het venster op de kaart.
  const win = svgEl('svg', {
    x, y, width: w, height: h,
    viewBox: `${sheet.c0 * S} ${sheet.r0 * S} ${sheet.cols * S} ${sheet.rows * S}`,
    overflow: 'hidden',
  }, svg);
  svgEl('use', { href: `#${masterId}` }, win);
  svgEl('rect', { x, y, width: w, height: h, class: 'print-border' }, svg);

  // Coördinaten: letters boven, cijfers links.
  for (let c = 0; c < sheet.cols; c++) {
    const t = svgEl('text', { x: x + (c + 0.5) * CELL_MM, y: y - LABEL_MM / 2, class: 'print-label' }, svg);
    t.textContent = colToLetters(sheet.c0 + c);
  }
  for (let r = 0; r < sheet.rows; r++) {
    const t = svgEl('text', { x: x - LABEL_MM / 2, y: y + (r + 0.5) * CELL_MM, class: 'print-label' }, svg);
    t.textContent = String(sheet.r0 + r + 1);
  }

  // Snijtekens: op elke hoek een kort streepje in het verlengde van de rand.
  let d = '';
  for (const cx of [x, x + w]) {
    for (const cy of [y, y + h]) {
      const sx = cx === x ? -1 : 1;
      const sy = cy === y ? -1 : 1;
      d += `M${cx + sx * MARK_GAP} ${cy}h${sx * MARK_LEN}`;
      d += `M${cx} ${cy + sy * MARK_GAP}v${sy * MARK_LEN}`;
    }
  }
  svgEl('path', { d, class: 'print-marks' }, svg);

  // Voettekst + een mini-plattegrond van de bladen (welk blad waar ligt).
  const fy = y + h + FOOTER_MM * 0.62;
  const cell = Math.min(2.4, (FOOTER_MM - 1.5) / plan.down);
  const miniW = plan.sheets.length > 1 ? plan.across * cell + 2 : 0;
  // Begin naast het snijteken; is de tekst te lang voor een smal blad, schuif dan naar links.
  const estW = footer.length * FOOTER_FONT * 0.55;
  const fx = Math.max(MARGIN_MM, Math.min(x + MARK_GAP + MARK_LEN + 1, plan.pageW - MARGIN_MM - miniW - estW));
  const text = svgEl('text', { x: fx, y: fy, class: 'print-footer', 'font-size': FOOTER_FONT }, svg);
  text.textContent = footer;
  if (plan.sheets.length > 1) {
    const mx = plan.pageW - MARGIN_MM - plan.across * cell;
    const my = y + h + 1.2;
    for (const s of plan.sheets) {
      svgEl('rect', {
        x: mx + s.col * cell, y: my + s.row * cell, width: cell, height: cell,
        class: s.index === sheet.index ? 'print-mini here' : 'print-mini',
      }, svg);
    }
  }
  return div;
}

function rangeText(r: Range): string {
  return `${formatCell({ c: r.c0, r: r.r0 })}–${formatCell({ c: r.c0 + r.cols - 1, r: r.r0 + r.rows - 1 })}`;
}

/** Wacht (kort) tot de afbeeldingen van de print geladen zijn, anders blijven ze leeg op papier. */
export async function waitForImages(root: HTMLElement, timeoutMs = 6000): Promise<void> {
  const urls = new Set<string>();
  for (const img of root.querySelectorAll('image')) {
    const href = img.getAttribute('href');
    if (href) urls.add(href);
  }
  const loads = [...urls].map((u) => {
    const im = new Image();
    im.src = u;
    return im.decode().catch(() => undefined);
  });
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, timeoutMs))]);
}
