// De "controller": verbindt de knoppen, de kaart en de state.

import type { Cell } from '../coords';
import { formatCell } from '../coords';
import { GUTTER, createMapView, mapExtent, renderMap, renderMoving, type MapView } from '../render';
import { S } from '../render/svg';
import { renderPaths, updateBadge } from '../render/tokens';
import { isOverSpeed, pathLength, positionsText, squaresToMeters } from '../rules';
import { type ParseResult, parseMapText } from '../schema';
import { createState, getPath, getToken, moveToken, newTurn, type MapState } from '../state';
import { TEST_MAP } from '../testmap';
import { SIDE } from '../tiles/palette';
import { copyText } from './clipboard';
import { attachDrag } from './drag';
import { readMapFromHash } from './hash';
import { loadState, loadTheme, saveState, saveTheme, type Theme } from './storage';

const MIN_CELL_PX = 16;
const MAX_CELL_PX = 200;

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} ontbreekt in index.html`);
  return el as T;
}

export class App {
  private state: MapState | null = null;
  private source = '';
  private selectedId: string | null = null;
  private cellPx = 40;
  private theme: Theme = 'auto';
  private toastTimer = 0;

  private readonly view: MapView = createMapView();
  private readonly scroller = $<HTMLElement>('map-scroller');
  private readonly status = $<HTMLElement>('status');
  private readonly messages = $<HTMLElement>('messages');
  private readonly dialog = $<HTMLDialogElement>('load-dialog');
  private readonly input = $<HTMLTextAreaElement>('map-input');
  private readonly dialogErrors = $<HTMLElement>('dialog-errors');
  private readonly toast = $<HTMLElement>('toast');

  start(): void {
    this.scroller.appendChild(this.view.svg);
    this.bindButtons();
    this.applyTheme(loadTheme());

    attachDrag({
      svg: this.view.svg,
      scroller: this.scroller,
      overlay: this.view.layers.overlay,
      getState: () => this.state,
      tokenEl: (id) => this.view.tokenEls.get(id),
      onPreview: (id, path) => this.preview(id, path),
      onCommit: (id, path) => this.commit(id, path),
      onTap: (id) => this.select(id),
      onCancel: () => this.redrawMoving(),
    });

    window.addEventListener('hashchange', () => this.loadFromHash());
    window.addEventListener('resize', () => this.applyZoom());

    if (!this.loadFromHash()) {
      const saved = loadState();
      if (saved) this.setState(saved.state, saved.source, true);
      else this.openDialog();
    }
  }

  // ------------------------------------------------------------ laden

  /** Kaart uit de URL-hash. Zelfde kaart als bewaard? Dan houden we de posities. */
  private loadFromHash(): boolean {
    const text = readMapFromHash(location.hash);
    if (!text) return false;
    const saved = loadState();
    if (saved && saved.source === text) {
      this.setState(saved.state, saved.source, true);
      return true;
    }
    return this.loadText(text);
  }

  /** Geeft true als er een kaart getekend is (eventueel met fouten). */
  private loadText(text: string): boolean {
    const res = parseMapText(text);
    this.showMessages(res);
    if (!res.map) {
      this.dialogErrors.replaceChildren(...res.errors.map((e) => line(e, 'error')));
      return false;
    }
    this.dialogErrors.replaceChildren();
    this.setState(createState(res.map), text, true);
    return true;
  }

  private setState(state: MapState, source: string, fresh: boolean): void {
    this.state = state;
    this.source = source;
    this.selectedId = null;
    $<HTMLElement>('map-name').textContent = `${state.map.name} · ${state.map.cols}×${state.map.rows}`;
    renderMap(this.view, state, this.selectedId);
    if (fresh) this.fitZoom();
    this.renderStatus();
    this.save();
  }

  private save(): void {
    if (this.state) saveState({ source: this.source, state: this.state });
  }

  // ------------------------------------------------------------ slepen

  private preview(id: string, path: Cell[]): void {
    if (!this.state) return;
    const temp = moveToken(this.state, id, path);
    renderPaths(this.view.layers.path, temp);
    const el = this.view.tokenEls.get(id);
    const token = getToken(temp, id);
    if (el && token) updateBadge(el, token, pathLength(path));
    this.renderStatus(temp, id);
  }

  private commit(id: string, path: Cell[]): void {
    if (!this.state) return;
    this.state = moveToken(this.state, id, path);
    this.selectedId = id;
    this.redrawMoving();
    this.save();
  }

  private select(id: string): void {
    this.selectedId = this.selectedId === id ? null : id;
    this.redrawMoving();
  }

  private redrawMoving(): void {
    if (!this.state) return;
    renderMoving(this.view, this.state, this.selectedId);
    this.renderStatus();
  }

  // ------------------------------------------------------------ knoppen

  private bindButtons(): void {
    $('btn-load').addEventListener('click', () => this.openDialog());
    $('btn-copy').addEventListener('click', () => void this.copyPositions());
    $('btn-turn').addEventListener('click', () => {
      if (!this.state) return;
      this.state = newTurn(this.state);
      this.redrawMoving();
      this.save();
      this.showToast('Nieuwe beurt: tellers op 0.');
    });
    $('btn-zoom-in').addEventListener('click', () => this.zoom(1.25));
    $('btn-zoom-out').addEventListener('click', () => this.zoom(1 / 1.25));
    $('btn-theme').addEventListener('click', () => {
      const next: Theme = this.theme === 'auto' ? 'light' : this.theme === 'light' ? 'dark' : 'auto';
      this.applyTheme(next);
      saveTheme(next);
    });

    $('btn-draw').addEventListener('click', () => {
      if (this.loadText(this.input.value)) this.dialog.close();
    });
    $('btn-testmap').addEventListener('click', () => {
      this.input.value = TEST_MAP;
      if (this.loadText(TEST_MAP)) this.dialog.close();
    });
    $<HTMLInputElement>('file-input').addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      this.input.value = text;
      (e.target as HTMLInputElement).value = '';
      if (this.loadText(text)) this.dialog.close();
    });

    // "Beurt ↺" per speler in de statuslijst.
    this.status.addEventListener('click', (e) => {
      const btn = (e.target as Element).closest<HTMLElement>('[data-reset]');
      if (!btn || !this.state) return;
      this.state = newTurn(this.state, btn.dataset.reset);
      this.redrawMoving();
      this.save();
    });
  }

  private openDialog(): void {
    if (!this.dialog.open) this.dialog.showModal();
  }

  private async copyPositions(): Promise<void> {
    if (!this.state) return this.showToast('Laad eerst een kaart.');
    const text = positionsText(this.state.map.tokens);
    if (await copyText(text)) {
      this.showToast(`Gekopieerd: ${text}`);
    } else {
      // Laatste redmiddel: toon de tekst zodat je hem zelf kunt selecteren.
      window.prompt('Kopiëren lukte niet automatisch. Selecteer en kopieer:', text);
    }
  }

  // ------------------------------------------------------------ zoom en thema

  /** Begingrootte: de kaart past in de breedte (en op een groot scherm ook in de hoogte). */
  private fitZoom(): void {
    if (!this.state) return;
    const { cols, rows } = this.state.map;
    const margin = GUTTER / S + 0.2;
    const availW = Math.max(200, this.scroller.clientWidth - 8);
    const availH = Math.max(300, window.innerHeight * 0.72);
    const fit = Math.min(availW / (cols + margin), availH / (rows + margin));
    this.cellPx = Math.round(Math.max(32, Math.min(120, fit)));
    this.applyZoom();
  }

  private zoom(factor: number): void {
    this.cellPx = Math.round(Math.max(MIN_CELL_PX, Math.min(MAX_CELL_PX, this.cellPx * factor)));
    this.applyZoom();
  }

  private applyZoom(): void {
    if (!this.state) return;
    const { width, height } = mapExtent(this.state);
    this.view.svg.style.width = `${(width / S) * this.cellPx}px`;
    this.view.svg.style.height = `${(height / S) * this.cellPx}px`;
  }

  private applyTheme(theme: Theme): void {
    this.theme = theme;
    if (theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    $('btn-theme').textContent = `Thema: ${theme === 'auto' ? 'auto' : theme === 'light' ? 'licht' : 'donker'}`;
  }

  // ------------------------------------------------------------ teksten

  private renderStatus(state = this.state, activeId?: string): void {
    if (!state) return this.status.replaceChildren();
    const rows = state.map.tokens.filter((t) => t.side === 'player').map((t) => {
      const used = pathLength(getPath(state, t.id));
      const over = isOverSpeed(t, used);
      const li = document.createElement('li');
      li.className = `${over ? 'over' : ''}${t.id === (activeId ?? this.selectedId) ? ' active' : ''}`;
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = SIDE[t.side];
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = `${t.name} · ${formatCell(t.cell)}`;
      const move = document.createElement('span');
      move.className = 'move';
      const speed = t.speed !== undefined ? `/${t.speed}` : '';
      move.textContent = `${used}${speed} vakjes · ${squaresToMeters(used)}${over ? ` · ${used - t.speed!} te veel!` : ''}`;
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'small';
      reset.dataset.reset = t.id;
      reset.textContent = 'Beurt ↺';
      reset.title = `Nieuwe beurt voor ${t.name}`;
      li.append(dot, name, move, reset);
      return li;
    });
    const others = state.map.tokens.length - rows.length;
    const ul = document.createElement('ul');
    ul.append(...rows);
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = rows.length
      ? `Sleep een blauw token. Terugslepen telt terug.${others ? ` ${others} andere token(s) bewegen via de DM.` : ''}`
      : 'Geen speler-tokens op deze kaart.';
    this.status.replaceChildren(ul, hint);
  }

  private showMessages(res: ParseResult): void {
    const items = [
      ...res.errors.map((e) => line(e, 'error')),
      ...res.warnings.map((w) => line(w, 'warning')),
      ...res.notes.map((n) => line(n, 'note')),
    ];
    this.messages.hidden = items.length === 0;
    if (!items.length) return this.messages.replaceChildren();
    const details = document.createElement('details');
    details.open = res.errors.length > 0;
    const summary = document.createElement('summary');
    const parts = [
      res.errors.length ? `${res.errors.length} fout(en)` : '',
      res.warnings.length ? `${res.warnings.length} waarschuwing(en)` : '',
      res.notes.length ? 'info' : '',
    ].filter(Boolean);
    summary.textContent = parts.join(', ');
    const ul = document.createElement('ul');
    ul.append(...items);
    details.append(summary, ul);
    this.messages.replaceChildren(details);
  }

  private showToast(text: string): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), 2500);
  }
}

function line(text: string, cls: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = cls;
  li.textContent = text;
  return li;
}
