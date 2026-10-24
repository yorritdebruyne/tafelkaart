import { isTokenHidden } from '../fog';
import { isOverSpeed, pathLength } from '../rules';
import type { TokenItem } from '../schema';
import { getPath, type MapState } from '../state';
import { SIDE } from '../tiles/palette';
import { S, svgEl } from './svg';

/**
 * Tekent alle tokens. Geeft een Map id -> <g> terug, zodat we bij het slepen niets hoeven te zoeken.
 * Vijanden en npc's gaan in `g` (onder de mist), spelers in `players` (boven de mist).
 * Wie volledig in de mist staat, tekenen we niet: dan verraadt ook de code niets.
 */
export function renderTokens(
  g: SVGGElement,
  players: SVGGElement,
  state: MapState,
  selectedId: string | null,
): Map<string, SVGGElement> {
  g.replaceChildren();
  players.replaceChildren();
  const els = new Map<string, SVGGElement>();
  const order = { enemy: 0, npc: 1, player: 2 } as const;
  const tokens = [...state.map.tokens]
    .filter((t) => !isTokenHidden(state.map, t))
    .sort((a, b) => order[a.side] - order[b.side]);

  for (const t of tokens) {
    const parent = t.side === 'player' ? players : g;
    const el = svgEl('g', {
      transform: `translate(${t.cell.c * S} ${t.cell.r * S})`,
      class: `token token-${t.side}${t.side === 'player' ? ' draggable' : ''}${t.id === selectedId ? ' selected' : ''}`,
      'data-token': t.id,
    }, parent);
    const half = (t.size * S) / 2;
    const r = t.size * S * 0.42;
    // Schaduw (een verschoven donkere schijf: goedkoper dan een filter tijdens het slepen),
    // dan een donkere schijf met een gekleurde ring per kant, en een dunne donkere buitenrand.
    svgEl('circle', { cx: half + S * 0.04, cy: half + S * 0.07, r: r + S * 0.02, class: 'token-shadow' }, el);
    svgEl('circle', { cx: half, cy: half, r, fill: 'url(#token-fill)', stroke: SIDE[t.side], class: 'token-body' }, el);
    svgEl('circle', { cx: half, cy: half, r: r + S * 0.045, class: 'token-outline' }, el);
    const label = svgEl('text', {
      x: half,
      y: half,
      'font-size': labelSize(t),
      class: 'token-label',
    }, el);
    label.textContent = t.id;
    const title = svgEl('title', {}, el);
    title.textContent = t.name;

    if (t.side === 'player') {
      const badge = svgEl('g', { class: 'badge', transform: `translate(${t.size * S - 2} ${t.size * S - 2})` }, el);
      svgEl('rect', { x: -34, y: -18, width: 34, height: 18, rx: 6 }, badge);
      svgEl('text', { x: -17, y: -9 }, badge);
      updateBadge(el, t, pathLength(getPath(state, t.id)));
    }
    els.set(t.id, el);
  }
  return els;
}

function labelSize(t: TokenItem): number {
  const base = S * 0.32 * (t.size === 2 ? 1.6 : 1);
  return t.id.length > 3 ? (base * 3) / t.id.length : base;
}

/** Badge rechtsonder: "3/6" vakjes gebruikt. Rood boven de speed. Verborgen bij 0. */
export function updateBadge(el: SVGGElement, token: TokenItem, used: number): void {
  const badge = el.querySelector<SVGGElement>('.badge');
  if (!badge) return;
  const text = badge.querySelector('text')!;
  text.textContent = token.speed !== undefined ? `${used}/${token.speed}` : String(used);
  badge.style.display = used > 0 ? '' : 'none';
  const over = isOverSpeed(token, used);
  badge.classList.toggle('over', over);
  el.classList.toggle('over', over);
}

/** Stippellijn van de afgelegde weg sinds het begin van de beurt. */
export function renderPaths(g: SVGGElement, state: MapState): void {
  g.replaceChildren();
  for (const t of state.map.tokens) {
    if (isTokenHidden(state.map, t)) continue;
    const path = getPath(state, t.id);
    if (path.length < 2) continue;
    const half = (t.size * S) / 2;
    const points = path.map((p) => `${p.c * S + half},${p.r * S + half}`).join(' ');
    svgEl('polyline', { points, stroke: SIDE[t.side], class: 'move-path' }, g);
    const start = path[0];
    svgEl('circle', { cx: start.c * S + half, cy: start.r * S + half, r: S * 0.1, fill: SIDE[t.side], class: 'move-start' }, g);
  }
}
