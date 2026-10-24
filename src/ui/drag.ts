// Slepen van speler-tokens, met muis én touch.
//
// "Pointer events" zijn één API voor muis, vinger en pen. Het verloop:
//   pointerdown op een token  -> slepen start, we "vangen" de pointer (capture),
//   pointermove               -> token volgt de vinger, weg wordt bijgewerkt per vakje,
//   pointerup                 -> token klikt vast op het laatste vakje dat het mocht bereiken.
//
// Muren en dichte deuren houden het token tegen, en je kan niet eindigen op een
// ander token (zie movement.ts). Het blauwe vierkant toont waar je uitkomt.
//
// Tijdens het slepen passen we alleen de transform van dat ene token aan
// (en de stippellijn). De rest van de kaart blijft staan: zo blijft het vlot.

import { type Cell, cellInBounds, sameCell } from '../coords';
import { S, svgEl } from '../render/svg';
import { type Blockers, buildBlockers, canStep, landingIndex, stepsBetween } from '../movement';
import { extendPath } from '../rules';
import { getPath, getToken, type MapState } from '../state';

export interface DragHost {
  svg: SVGSVGElement;
  scroller: HTMLElement;
  overlay: SVGGElement;
  getState(): MapState | null;
  tokenEl(id: string): SVGGElement | undefined;
  /** Tijdens het slepen, telkens het token een nieuw vakje bereikt. */
  onPreview(id: string, path: Cell[]): void;
  /** Bij loslaten na echt slepen. */
  onCommit(id: string, path: Cell[]): void;
  /** Tik zonder te slepen (op eender welk token). */
  onTap(id: string): void;
  /** Slepen afgebroken (bv. telefoon-melding): terug naar vorige toestand. */
  onCancel(): void;
}

interface DragState {
  id: string;
  pointerId: number;
  size: number;
  grabDx: number;
  grabDy: number;
  startX: number;
  startY: number;
  moved: boolean;
  path: Cell[];
  blockers: Blockers;
  /** Index in `path` waar het token uitkomt (laatste vakje zonder ander token). */
  landing: number;
}

const TAP_SLOP_PX = 6;
const EDGE_PX = 36;
const EDGE_SPEED = 14;

export function attachDrag(host: DragHost): void {
  const { svg } = host;
  let drag: DragState | null = null;
  let target: SVGRectElement | null = null;

  const tokenIdAt = (t: EventTarget | null): string | null => {
    const el = (t as Element | null)?.closest?.('[data-token]');
    return el ? el.getAttribute('data-token') : null;
  };

  /** Schermcoördinaten (pixels) -> SVG-eenheden. Houdt rekening met zoom en scroll. */
  const toSvg = (e: PointerEvent) => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // Op iOS scrolt de pagina anders mee als je een token sleept.
  svg.addEventListener('touchstart', (e) => {
    const id = tokenIdAt(e.target);
    const state = host.getState();
    if (id && state && getToken(state, id)?.side === 'player') e.preventDefault();
  }, { passive: false });

  svg.addEventListener('pointerdown', (e) => {
    if (drag || e.button > 0) return;
    const id = tokenIdAt(e.target);
    const state = host.getState();
    if (!id || !state) return;
    const token = getToken(state, id);
    if (!token) return;
    if (token.side !== 'player') {
      host.onTap(id); // vijanden en npc's bewegen alleen via JSON (F6)
      return;
    }
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const p = toSvg(e);
    drag = {
      id,
      pointerId: e.pointerId,
      size: token.size,
      grabDx: p.x - token.cell.c * S,
      grabDy: p.y - token.cell.r * S,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      path: getPath(state, id),
      blockers: buildBlockers(state.map),
      landing: 0,
    };
    drag.landing = drag.path.length - 1;
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const state = host.getState();
    const el = host.tokenEl(drag.id);
    if (!state || !el) return;

    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < TAP_SLOP_PX) return;
      drag.moved = true;
      el.parentNode?.appendChild(el); // bovenop leggen
      el.classList.add('dragging');
      target = svgEl('rect', { width: drag.size * S, height: drag.size * S, class: 'drop-target' }, host.overlay);
    }

    const p = toSvg(e);
    const x = p.x - drag.grabDx;
    const y = p.y - drag.grabDy;
    el.setAttribute('transform', `translate(${x} ${y})`);

    // Snap: het vakje waar de linkerbovenhoek het dichtst bij ligt, binnen de kaart.
    const { cols, rows } = state.map;
    const cell: Cell = {
      c: clamp(Math.round(x / S), 0, cols - drag.size),
      r: clamp(Math.round(y / S), 0, rows - drag.size),
    };
    const last = drag.path[drag.path.length - 1];
    if (cellInBounds(cell, cols, rows, drag.size) && !sameCell(cell, last)) {
      // Stap voor stap naar het nieuwe vakje; stop bij een muur of dichte deur.
      let at = last;
      for (const step of stepsBetween(last, cell)) {
        if (!canStep(drag.blockers, at, step, drag.size)) break;
        drag.path = extendPath(drag.path, step);
        at = step;
      }
      drag.landing = landingIndex(state.map, drag.path, drag.size, drag.id);
      host.onPreview(drag.id, drag.path.slice(0, drag.landing + 1));
    }
    const land = drag.path[drag.landing];
    target?.setAttribute('x', String(land.c * S));
    target?.setAttribute('y', String(land.r * S));

    autoScroll(host.scroller, e);
  });

  const finish = (e: PointerEvent, cancelled: boolean) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    target?.remove();
    target = null;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (cancelled) host.onCancel();
    else if (d.moved) host.onCommit(d.id, d.path.slice(0, d.landing + 1));
    else host.onTap(d.id);
  };
  svg.addEventListener('pointerup', (e) => finish(e, false));
  svg.addEventListener('pointercancel', (e) => finish(e, true));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Sleep je tegen de rand van het kaartvenster, dan schuift de kaart mee. */
function autoScroll(scroller: HTMLElement, e: PointerEvent): void {
  const r = scroller.getBoundingClientRect();
  if (e.clientX < r.left + EDGE_PX) scroller.scrollLeft -= EDGE_SPEED;
  else if (e.clientX > r.right - EDGE_PX) scroller.scrollLeft += EDGE_SPEED;
  if (e.clientY < r.top + EDGE_PX) scroller.scrollTop -= EDGE_SPEED;
  else if (e.clientY > r.bottom - EDGE_PX) scroller.scrollTop += EDGE_SPEED;
}
