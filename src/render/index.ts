// De kaart als één <svg> met een <g> (groep) per laag.
// Volgorde = tekenvolgorde: wat later komt, ligt bovenop.
// Speler-tokens liggen boven de mist: je ziet altijd waar je eigen personage staat.
// Lagen die nog leeg zijn (terrain, light) vullen we in M3.

import type { MapState } from '../state';
import { renderFloor } from './floor';
import { renderFog } from './fog';
import { renderGrid, renderLabels } from './grid';
import { renderProps } from './props';
import { SHADOW, TOKEN } from '../tiles/palette';
import { renderDecor } from './decor';
import { S, svgEl } from './svg';
import { renderPaths, renderTokens } from './tokens';
import { renderWalls } from './walls';

export const LAYERS = [
  'labels', 'floor', 'decor', 'grid', 'terrain', 'props', 'walls', 'light', 'path', 'tokens', 'fog', 'players', 'overlay',
] as const;
export type LayerName = (typeof LAYERS)[number];

/** Marge voor de coördinaten (letters/cijfers). */
export const GUTTER = S * 0.6;
const PAD = 4;

export interface MapView {
  svg: SVGSVGElement;
  layers: Record<LayerName, SVGGElement>;
  tokenEls: Map<string, SVGGElement>;
}

export function createMapView(): MapView {
  const svg = svgEl('svg', { class: 'map', role: 'img', 'aria-label': 'Kaart' });
  // Gedeelde definities: schaduw (filter) en de binnenkant van tokens (kleurverloop).
  const defs = svgEl('defs', {}, svg);
  const shadow = svgEl('filter', { id: 'shadow', x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
  svgEl('feDropShadow', {
    dx: SHADOW.dx * S, dy: SHADOW.dy * S, stdDeviation: SHADOW.blur * S,
    'flood-color': '#000', 'flood-opacity': SHADOW.opacity,
  }, shadow);
  const grad = svgEl('radialGradient', { id: 'token-fill', cx: '40%', cy: '35%', r: '70%' }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': TOKEN.innerLight }, grad);
  svgEl('stop', { offset: '100%', 'stop-color': TOKEN.inner }, grad);

  const layers = {} as Record<LayerName, SVGGElement>;
  for (const name of LAYERS) layers[name] = svgEl('g', { class: `layer layer-${name}` }, svg);
  if (SHADOW.on) {
    // Eén filter per laag (niet per prop): goedkoper om te tekenen.
    layers.props.setAttribute('filter', 'url(#shadow)');
    layers.walls.setAttribute('filter', 'url(#shadow)');
  }
  return { svg, layers, tokenEls: new Map() };
}

/** Breedte en hoogte van de hele svg in SVG-eenheden (incl. marge). */
export function mapExtent(state: MapState) {
  return {
    width: state.map.cols * S + GUTTER + PAD,
    height: state.map.rows * S + GUTTER + PAD,
  };
}

/** Alles opnieuw tekenen (na het laden van een kaart). */
export function renderMap(view: MapView, state: MapState, selectedId: string | null): void {
  const { map } = state;
  const { width, height } = mapExtent(state);
  view.svg.setAttribute('viewBox', `${-GUTTER} ${-GUTTER} ${width} ${height}`);
  renderLabels(view.layers.labels, map, GUTTER);
  renderFloor(view.layers.floor, map);
  renderDecor(view.layers.decor, map);
  renderGrid(view.layers.grid, map);
  renderProps(view.layers.props, map);
  renderWalls(view.layers.walls, map);
  renderFog(view.layers.fog, map);
  renderMoving(view, state, selectedId);
}

/** Alleen wat verandert als tokens bewegen: wegen en tokens. */
export function renderMoving(view: MapView, state: MapState, selectedId: string | null): void {
  renderPaths(view.layers.path, state);
  view.tokenEls = renderTokens(view.layers.tokens, view.layers.players, state, selectedId);
}
