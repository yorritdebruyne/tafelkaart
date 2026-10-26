// Tafel-synchronisatie (F17): telefoons en tv laten dezelfde kaart zien.
//
// Praat met het doorgeefluik (scripts/tafel-relay.js) op dezelfde server als de app:
//   - EventSource = een verbinding die openblijft; de server stuurt er berichten over.
//     De browser maakt ze vanzelf opnieuw als de wifi even wegvalt.
//   - fetch POST  = zelf een bericht sturen.
// Op een server zonder doorgeefluik (bv. GitHub Pages) doet dit niets.
//
// We sturen geen hele kaart bij elke stap, maar de STAP zelf ("Ak naar E9"). Elk toestel
// voert die stap zelf uit met dezelfde functies (moveToken, applyPatch, ...). Zo kunnen
// twee spelers tegelijk slepen zonder elkaars zet te overschrijven. Alleen bij een nieuwe
// kaart en bij Ongedaan sturen we de hele toestand.

import type { Cell } from '../coords';
import type { DoorState } from '../schema';
import { applyPatch } from '../patch';
import { getToken, moveToken, newTurn, setDoorState, type MapState } from '../state';

export type SyncMessage =
  | { kind: 'state'; source: string; state: MapState }
  | { kind: 'move'; id: string; path: Cell[] }
  | { kind: 'door'; id: string; state: DoorState }
  | { kind: 'turn'; id?: string }
  | { kind: 'patch'; value: unknown }
  | { kind: 'drag'; id: string; path: Cell[] }
  | { kind: 'drag-end'; id: string };

/** Wat het doorgeefluik meestuurt: wie het stuurde en het volgnummer. */
type Received = SyncMessage & { from?: string; seq?: number };

interface Init {
  kind: 'init';
  snapshot: (Received & { kind: 'state' }) | null;
  ops: Received[];
  clients: number;
}

export interface SyncHandlers {
  /** (Opnieuw) verbonden: de laatste toestand van de tafel en de stappen erna. */
  onInit(snapshot: { source: string; state: MapState } | null, ops: SyncMessage[]): void;
  onMessage(msg: SyncMessage): void;
  /** Aantal verbonden toestellen (dit toestel inbegrepen), of 0 als de lijn weg is. */
  onClients(n: number): void;
}

export class TableSync {
  /** Willekeurige naam voor dit venster, zodat het luik ons eigen bericht niet terugstuurt. */
  readonly id = randomId();
  private source: EventSource | null = null;
  private available = false;
  connected = false;

  constructor(private readonly handlers: SyncHandlers, private readonly base = 'tafel/') {}

  /** Kijkt of er een doorgeefluik is, en verbindt dan. Geeft false als er geen is. */
  async start(): Promise<boolean> {
    try {
      const res = await fetch(`${this.base}ping`, { cache: 'no-store' });
      this.available = res.ok && (await res.json())?.ok === true;
    } catch {
      this.available = false;
    }
    if (!this.available) return false;
    const es = new EventSource(`${this.base}events?c=${this.id}`);
    this.source = es;
    es.onmessage = (e) => this.receive(e.data);
    es.onerror = () => {
      // De browser probeert zelf opnieuw; we melden alleen dat de lijn even weg is.
      if (this.connected) {
        this.connected = false;
        this.handlers.onClients(0);
      }
    };
    return true;
  }

  /** Verbinding verbreken (bv. in tests). */
  stop(): void {
    this.source?.close();
    this.source = null;
    this.connected = false;
  }

  get enabled(): boolean {
    return this.available;
  }

  send(msg: SyncMessage): void {
    if (!this.connected) return;
    void fetch(`${this.base}send?c=${this.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msg),
      keepalive: msg.kind !== 'state', // kleine berichten komen zo ook aan als de pagina sluit
    }).catch(() => undefined);
  }

  private receive(data: string): void {
    let msg: Init | Received | { kind: 'clients'; n: number };
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.kind === 'init') {
      this.connected = true;
      const init = msg as Init;
      this.handlers.onInit(
        init.snapshot ? { source: init.snapshot.source, state: init.snapshot.state } : null,
        // Ook onze eigen stappen: na een herverbinding beginnen we opnieuw vanaf de samenvatting.
        init.ops,
      );
      this.handlers.onClients(init.clients);
      return;
    }
    if (msg.kind === 'clients') return this.handlers.onClients((msg as { n: number }).n);
    if ((msg as Received).from === this.id) return;
    this.handlers.onMessage(msg as SyncMessage);
  }
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Een stap van een ander toestel uitvoeren op onze toestand. Puur (geen DOM): dezelfde
 * functies als wanneer je het zelf doet, dus elk toestel komt op hetzelfde uit.
 */
export function applySyncOp(state: MapState, msg: SyncMessage): MapState {
  switch (msg.kind) {
    case 'move':
      return getToken(state, msg.id) ? moveToken(state, msg.id, msg.path) : state;
    case 'door':
      return setDoorState(state, msg.id, msg.state);
    case 'turn':
      return newTurn(state, msg.id);
    case 'patch': {
      const res = applyPatch(state, msg.value);
      return res.applied ? res.state : state;
    }
    default:
      return state;
  }
}
