// De "controller": verbindt de knoppen, de kaart en de state.

import type { Cell } from '../coords';
import { formatCell } from '../coords';
import { GUTTER, createMapView, mapExtent, renderMap, renderMoving, type MapView } from '../render';
import { S } from '../render/svg';
import { renderPaths, updateBadge } from '../render/tokens';
import { conditionLabel, effectiveSpeed, speedZeroBy } from '../conditions';
import { visibleTokens } from '../fog';
import type { LightMode } from '../light';
import { getLightMode, setLightMode } from '../render/light';
import { clearTerrainCache, insideOf } from '../terrain';
import { applyPatch } from '../patch';
import { isOverSpeed, leftReach, pathCost, pathLength, positionsText, squaresToMeters } from '../rules';
import { planSummary } from '../print/layout';
import { buildPrint, printPlans, waitForImages, type PrintOptions } from '../print/sheets';
import { parseJsonLenient, parseMapText } from '../schema';
import { createState, getPath, getToken, moveToken, newTurn, toggleDoor, type MapState } from '../state';
import { TEST_MAP, TEST_PATCH, TEST_VILLAGE } from '../testmap';
import { getSfeer, setSfeer, sfeerNames } from '../tiles';
import { SIDE } from '../tiles/palette';
import { copyText } from './clipboard';
import { attachDrag } from './drag';
import { readMapFromHash } from './hash';
import {
  loadLight, loadPrint, loadSfeer, loadState, loadTheme, savePrint, saveLight, saveSfeer, saveState, saveTheme,
  type Theme,
} from './storage';

/** Wat het meldingenpaneel toont (van een kaart of van een patch). */
interface Messages {
  errors: string[];
  warnings: string[];
  notes: string[];
}

const MIN_CELL_PX = 16;
/** Hoeveel stappen je terug kan (F15). */
const UNDO_MAX = 50;
const SIDE_NL = { player: 'speler', enemy: 'vijand', npc: 'npc' } as const;
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
  /** Undo-stapel (F15): vorige toestanden, met een korte beschrijving van wat erna gebeurde. */
  private history: { state: MapState; label: string }[] = [];
  /** Printinstellingen (F16), bewaard tussen sessies. */
  private printOpts: PrintOptions = loadPrint();

  private readonly view: MapView = createMapView();
  private readonly scroller = $<HTMLElement>('map-scroller');
  private readonly status = $<HTMLElement>('status');
  private readonly messages = $<HTMLElement>('messages');
  private readonly dialog = $<HTMLDialogElement>('load-dialog');
  private readonly input = $<HTMLTextAreaElement>('map-input');
  private readonly dialogErrors = $<HTMLElement>('dialog-errors');
  private readonly toast = $<HTMLElement>('toast');
  private readonly printDialog = $<HTMLDialogElement>('print-dialog');
  private readonly printRoot = $<HTMLElement>('print-root');

  start(): void {
    this.scroller.appendChild(this.view.svg);
    this.bindButtons();
    this.applyTheme(loadTheme());
    this.initSfeer();
    this.applyLight(loadLight());

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

    // Tik op een deur: open of dicht (niet op slot).
    this.view.svg.addEventListener('click', (e) => {
      const el = (e.target as Element).closest?.('[data-door]');
      if (!el || !this.state) return;
      const id = el.getAttribute('data-door')!;
      const next = toggleDoor(this.state, id);
      if (next === this.state) {
        const d = this.state.map.doors.find((x) => x.id === id);
        if (d?.state === 'locked') this.showToast('Deze deur is op slot. Alleen de DM kan ze openen.');
        return;
      }
      const what = `deur ${id} ${next.doorNotes?.[id] === 'open' ? 'open' : 'dicht'}`;
      this.remember(what);
      this.state = next;
      renderMap(this.view, this.state, this.selectedId);
      this.renderStatus();
      this.save();
      this.showToast(`${what[0].toUpperCase()}${what.slice(1)}.`);
    });

    // Ctrl+Z (of Cmd+Z op een Mac): ongedaan maken, behalve als je in het tekstvak typt.
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT')) return;
        e.preventDefault();
        this.undo();
      }
    });

    // Ctrl+P zonder de knop: dan bouwen we de bladen nog snel met de bewaarde instellingen.
    window.addEventListener('beforeprint', () => {
      if (!this.printRoot.childElementCount) this.buildPrintSheets();
    });
    window.addEventListener('afterprint', () => this.printRoot.replaceChildren());

    window.addEventListener('hashchange', () => this.loadFromHash());
    window.addEventListener('resize', () => this.applyZoom());

    // Eerst de bewaarde kaart terugzetten, daarna pas de hash: zo kan een
    // patch in de hash (#b64=...) op de bewaarde kaart toegepast worden.
    const saved = loadState();
    if (saved) this.setState(saved.state, saved.source, true);
    this.updateUndoButton();
    if (!this.loadFromHash() && !saved) this.openDialog();
  }

  // ------------------------------------------------------------ laden

  /** Kaart of patch uit de URL-hash. Zelfde kaart als nu geladen? Dan houden we de posities. */
  private loadFromHash(): boolean {
    const text = readMapFromHash(location.hash);
    if (!text) return false;
    if (this.state && this.source === text) return true;
    return this.loadText(text);
  }

  /** Kaart of patch laden. Geeft true als het gelukt is (eventueel met fouten). */
  private loadText(text: string): boolean {
    const json = parseJsonLenient(text);
    if (json.ok && isPatch(json.value)) return this.loadPatch(json.value);

    const res = parseMapText(text);
    this.showMessages(res, 'Kaart');
    if (!res.map) {
      this.dialogErrors.replaceChildren(...res.errors.map((e) => line(e, 'error')));
      return false;
    }
    this.dialogErrors.replaceChildren();
    // Nieuwe kaart: de undo-stapel hoort bij de oude kaart.
    this.history = [];
    this.updateUndoButton();
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

  /** F9: een patch toepassen op de geladen kaart. */
  private loadPatch(value: unknown): boolean {
    if (!this.state) {
      this.dialogErrors.replaceChildren(line('Dit is een patch. Laad eerst de kaart, en plak de patch daarna.', 'error'));
      return false;
    }
    const res = applyPatch(this.state, value);
    if (res.duplicate) {
      this.dialogErrors.replaceChildren();
      this.showToast('Deze patch is al toegepast. Niets veranderd.');
      return true;
    }
    if (!res.applied) {
      this.dialogErrors.replaceChildren(...res.errors.map((e) => line(e, 'error')));
      return false;
    }
    this.dialogErrors.replaceChildren();
    this.remember('patch');
    this.state = res.state;
    if (this.selectedId && !getToken(this.state, this.selectedId)) this.selectedId = null;
    renderMap(this.view, this.state, this.selectedId); // alles: deuren en mist kunnen veranderd zijn
    this.renderStatus();
    this.save();
    this.showMessages({ errors: res.errors, warnings: res.warnings, notes: [] }, 'Patch');
    this.showToast(res.changes.length ? `Patch: ${res.changes.join(', ')}` : 'Patch: niets veranderd.', 4000);
    return true;
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
    if (el && token) updateBadge(el, token, pathCost(temp.map, token, path));
    this.renderStatus(temp, id);
  }

  private commit(id: string, path: Cell[]): void {
    if (!this.state) return;
    this.remember(`${getToken(this.state, id)?.name ?? id} verplaatst`);
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
      this.remember('nieuwe beurt');
      this.state = newTurn(this.state);
      this.redrawMoving();
      this.save();
      this.showToast('Nieuwe beurt: tellers op 0.');
    });
    $('btn-undo').addEventListener('click', () => this.undo());
    this.bindPrint();
    $('btn-light').addEventListener('click', () => {
      const order: LightMode[] = ['auto', 'aan', 'uit'];
      const next = order[(order.indexOf(getLightMode()) + 1) % order.length];
      this.applyLight(next);
      saveLight(next);
      if (this.state) renderMap(this.view, this.state, this.selectedId);
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
    $('btn-testvillage').addEventListener('click', () => {
      this.input.value = TEST_VILLAGE;
      if (this.loadText(TEST_VILLAGE)) this.dialog.close();
    });
    $('btn-testpatch').addEventListener('click', () => {
      this.input.value = TEST_PATCH;
      if (this.loadText(TEST_PATCH)) this.dialog.close();
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
      this.remember(`nieuwe beurt voor ${getToken(this.state, btn.dataset.reset!)?.name ?? btn.dataset.reset}`);
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
    // Wie in de mist staat, komt er niet in (anders verklapt de app iets).
    const map = this.state.map;
    const text = positionsText(visibleTokens(map), this.state.doorNotes, (t) => insideOf(map, t));
    if (await copyText(text)) {
      this.showToast(`Gekopieerd: ${text}`);
    } else {
      // Laatste redmiddel: toon de tekst zodat je hem zelf kunt selecteren.
      window.prompt('Kopiëren lukte niet automatisch. Selecteer en kopieer:', text);
    }
  }

  // ------------------------------------------------------------ afdrukken (F16)

  private bindPrint(): void {
    const paper = $<HTMLSelectElement>('print-paper');
    const orient = $<HTMLSelectElement>('print-orientation');
    const tokens = $<HTMLInputElement>('print-tokens');
    const ink = $<HTMLInputElement>('print-ink');
    const hidden = $<HTMLInputElement>('print-hidden');
    const fill = () => {
      paper.value = this.printOpts.paper;
      orient.value = this.printOpts.orientation;
      tokens.checked = this.printOpts.tokens;
      ink.checked = this.printOpts.inkSaver;
      hidden.checked = this.printOpts.hiddenSheets;
    };
    const read = () => {
      this.printOpts = {
        paper: paper.value === 'A3' ? 'A3' : 'A4',
        orientation: orient.value as PrintOptions['orientation'],
        tokens: tokens.checked,
        inkSaver: ink.checked,
        hiddenSheets: hidden.checked,
      };
      savePrint(this.printOpts);
      this.updatePrintSummary();
    };
    for (const el of [paper, orient, tokens, ink, hidden]) el.addEventListener('change', read);

    $('btn-print').addEventListener('click', () => {
      if (!this.state) return this.showToast('Laad eerst een kaart.');
      fill();
      this.updatePrintSummary();
      this.printDialog.showModal();
    });
    $('btn-print-go').addEventListener('click', () => void this.print());
  }

  private updatePrintSummary(): void {
    const out = $('print-summary');
    if (!this.state) return void (out.textContent = '');
    const map = this.state.map;
    const plans = printPlans(map, this.printOpts);
    let text = planSummary(plans.main, { c0: 0, r0: 0, cols: map.cols, rows: map.rows });
    const extra = plans.hidden.reduce((n, p) => n + p.sheets.length, 0);
    if (this.printOpts.hiddenSheets) {
      text += plans.hidden.length
        ? `, + ${extra} ${extra === 1 ? 'blad' : 'bladen'} voor ${plans.hidden.length} verborgen ${plans.hidden.length === 1 ? 'kamer' : 'kamers'}`
        : ' (geen verborgen kamers op deze kaart)';
    }
    out.textContent = `${text}.`;
  }

  /** De bladen opbouwen en de papiergrootte doorgeven aan de browser (@page). */
  private buildPrintSheets(): boolean {
    if (!this.state) {
      this.printRoot.replaceChildren();
      return false;
    }
    const { pageW, pageH } = buildPrint(this.printRoot, this.state, this.printOpts);
    let style = document.getElementById('print-page-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'print-page-style';
      document.head.appendChild(style);
    }
    style.textContent = `@page { size: ${pageW}mm ${pageH}mm; margin: 0; }`;
    return true;
  }

  private async print(): Promise<void> {
    if (!this.buildPrintSheets()) return this.showToast('Laad eerst een kaart.');
    this.printDialog.close();
    this.showToast('Afbeeldingen laden voor de print…', 6000);
    await waitForImages(this.printRoot);
    this.toast.hidden = true;
    window.print();
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

  /** Sfeer-knop: alleen zichtbaar als er een Forgotten Adventures-index is. */
  private initSfeer(): void {
    const names = sfeerNames();
    const btn = $<HTMLButtonElement>('btn-sfeer');
    if (!names.length) return;
    const saved = loadSfeer();
    if (saved && names.includes(saved)) setSfeer(saved);
    btn.hidden = false;
    btn.textContent = `Sfeer: ${getSfeer()}`;
    btn.addEventListener('click', () => {
      const next = names[(names.indexOf(getSfeer()) + 1) % names.length];
      setSfeer(next);
      saveSfeer(next);
      clearTerrainCache(); // props kunnen een andere grootte hebben
      btn.textContent = `Sfeer: ${next}`;
      if (this.state) renderMap(this.view, this.state, this.selectedId);
    });
  }

  // ------------------------------------------------------------ undo (F15)

  /** Bewaar de huidige toestand vóór een wijziging. `label` = wat er nu gaat gebeuren. */
  private remember(label: string): void {
    if (!this.state) return;
    this.history.push({ state: this.state, label });
    if (this.history.length > UNDO_MAX) this.history.shift();
    this.updateUndoButton();
  }

  private undo(): void {
    const last = this.history.pop();
    this.updateUndoButton();
    if (!last) return this.showToast('Niets om ongedaan te maken.');
    this.state = last.state;
    if (this.selectedId && !getToken(this.state, this.selectedId)) this.selectedId = null;
    // Alles opnieuw: deuren, mist en licht kunnen terug veranderd zijn.
    renderMap(this.view, this.state, this.selectedId);
    this.renderStatus();
    this.save();
    this.showToast(`Ongedaan: ${last.label}.`);
  }

  private updateUndoButton(): void {
    const btn = $<HTMLButtonElement>('btn-undo');
    btn.disabled = this.history.length === 0;
    btn.title = this.history.length
      ? `Ongedaan maken: ${this.history[this.history.length - 1].label} (Ctrl+Z)`
      : 'Niets om ongedaan te maken';
  }

  private applyLight(m: LightMode): void {
    setLightMode(m);
    const btn = $('btn-light');
    btn.textContent = `Licht: ${m}`;
    btn.title = m === 'auto'
      ? 'Donker zodra de DM lichtbronnen in de kaart zet'
      : m === 'aan' ? 'Altijd donker met licht rond de bronnen' : 'Geen donker en geen licht (dag)';
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
      const path = getPath(state, t.id);
      const used = pathCost(state.map, t, path);
      const dist = pathLength(path);
      const over = isOverSpeed(t, used);
      const speedNum = effectiveSpeed(t);
      const li = document.createElement('li');
      li.className = `${over ? 'over' : ''}${t.id === (activeId ?? this.selectedId) ? ' active' : ''}`;
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = SIDE[t.side];
      const name = document.createElement('span');
      name.className = 'name';
      const conds = t.conditions?.length ? ` (${t.conditions.map(conditionLabel).join(', ')})` : '';
      const inside = insideOf(state.map, t);
      name.textContent = `${t.name} · ${formatCell(t.cell)}${inside ? ` (in ${inside})` : ''}${conds}`;
      const move = document.createElement('span');
      move.className = 'move';
      const speed = speedNum !== undefined ? `/${speedNum}` : '';
      const parts = [`${used}${speed} vakjes · ${squaresToMeters(used)}`];
      if (used !== dist) parts.push(`${dist} ver, ${used - dist} extra`);
      const zero = speedZeroBy(t);
      if (zero) parts.push(`speed 0 (${conditionLabel(zero)})`);
      if (over && speedNum !== undefined && !zero) parts.push(`${used - speedNum} te veel!`);
      const left = leftReach(state.map, t, path);
      if (left.length) parts.push(`verlaat ${left.join(', ')}: opportunity attack?`);
      move.textContent = parts.join(' · ');
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'small';
      reset.dataset.reset = t.id;
      reset.textContent = 'Beurt ↺';
      reset.title = `Nieuwe beurt voor ${t.name}`;
      li.append(dot, name, move, reset);
      return li;
    });
    const others = visibleTokens(state.map).length - rows.length;
    const ul = document.createElement('ul');
    ul.append(...rows);
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = rows.length
      ? `Sleep een blauw token. Terugslepen telt terug.${others ? ` ${others} andere token(s) bewegen via de DM.` : ''}`
      : 'Geen speler-tokens op deze kaart.';
    const sel = this.selectedId ? getToken(state, this.selectedId) : undefined;
    const info: HTMLElement[] = [];
    if (sel && sel.side !== 'player') {
      const p = document.createElement('p');
      p.className = 'selected-info';
      const conds = sel.conditions?.length ? ` · ${sel.conditions.map(conditionLabel).join(', ')}` : '';
      p.textContent = `${sel.name} · ${SIDE_NL[sel.side]} · ${formatCell(sel.cell)}${conds}`;
      info.push(p);
    }
    this.status.replaceChildren(ul, ...info, hint);
  }

  private showMessages(res: Messages, what: 'Kaart' | 'Patch'): void {
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
    summary.textContent = `${what}: ${parts.join(', ')}`;
    const ul = document.createElement('ul');
    ul.append(...items);
    details.append(summary, ul);
    this.messages.replaceChildren(details);
  }

  private showToast(text: string, ms = 2500): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), ms);
  }
}

function isPatch(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as { type?: unknown }).type === 'patch';
}

function line(text: string, cls: string): HTMLLIElement {
  const li = document.createElement('li');
  li.className = cls;
  li.textContent = text;
  return li;
}
