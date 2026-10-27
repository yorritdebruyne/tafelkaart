import { createServer, request } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createRelay } from './tafel-relay.js';

// Test van het doorgeefluik met een echte HTTP-server op een vrije poort.
// (Gewoon JavaScript, zoals het luik zelf.)

describe('doorgeefluik (scripts/tafel-relay.js)', () => {
  let server;
  let relay;

  afterEach(async () => {
    relay?.close();
    await new Promise((r) => server?.close(r));
  });

  async function start() {
    relay = createRelay();
    server = createServer((req, res) => relay.handle(req, res));
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    return `http://127.0.0.1:${server.address().port}`;
  }

  /** Een "toestel": luistert op /tafel/events en verzamelt de berichten. */
  function listen(base, id) {
    const got = [];
    let buf = '';
    const req = request(`${base}/tafel/events?c=${id}`, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          for (const line of block.split('\n')) if (line.startsWith('data: ')) got.push(JSON.parse(line.slice(6)));
        }
      });
    });
    req.end();
    return { got, close: () => req.destroy() };
  }

  const post = (base, id, msg) =>
    fetch(`${base}/tafel/send?c=${id}`, { method: 'POST', body: JSON.stringify(msg) });
  const until = async (fn) => {
    for (let i = 0; i < 100 && !fn(); i++) await new Promise((r) => setTimeout(r, 10));
    expect(fn()).toBe(true);
  };

  it('stuurt berichten naar de andere toestellen, niet terug naar de zender', async () => {
    const base = await start();
    expect(await (await fetch(`${base}/tafel/ping`)).json()).toMatchObject({ ok: true });
    const a = listen(base, 'toestel-a');
    const b = listen(base, 'toestel-b');
    await until(() => a.got.some((m) => m.kind === 'clients' && m.n === 2));
    expect((await post(base, 'toestel-a', { kind: 'move', id: 'Ak', path: [] })).status).toBe(204);
    await until(() => b.got.some((m) => m.kind === 'move'));
    expect(b.got.find((m) => m.kind === 'move')).toMatchObject({ from: 'toestel-a', id: 'Ak' });
    expect(a.got.some((m) => m.kind === 'move')).toBe(false);
    a.close();
    b.close();
  });

  it('een later toestel krijgt de laatste toestand en de stappen erna (niet de sleep-berichten)', async () => {
    const base = await start();
    await post(base, 'toestel-a', { kind: 'move', id: 'oud', path: [] }); // vóór de toestand: vergeten
    await post(base, 'toestel-a', { kind: 'state', source: '{}', state: { x: 1 } });
    await post(base, 'toestel-a', { kind: 'drag', id: 'Ak', path: [] });
    await post(base, 'toestel-a', { kind: 'door', id: 'd1', state: 'open' });
    const c = listen(base, 'toestel-c');
    await until(() => c.got.some((m) => m.kind === 'init'));
    const init = c.got.find((m) => m.kind === 'init');
    expect(init.snapshot).toMatchObject({ kind: 'state', state: { x: 1 } });
    expect(init.ops.map((o) => o.kind)).toEqual(['door']);
    c.close();
  });

  it('onthoudt licht en sfeer ("look"), ook na een nieuwe kaart', async () => {
    const base = await start();
    await post(base, 'toestel-a', { kind: 'look', light: 'aan', sfeer: 'verlaten' });
    await post(base, 'toestel-a', { kind: 'state', source: '{}', state: { x: 2 } });
    const c = listen(base, 'toestel-c');
    await until(() => c.got.some((m) => m.kind === 'init'));
    expect(c.got.find((m) => m.kind === 'init').look).toMatchObject({ light: 'aan', sfeer: 'verlaten' });
    c.close();
  });

  it('weigert rommel', async () => {
    const base = await start();
    expect((await post(base, 'toestel-a', 'geen object')).status).toBe(400);
    expect((await post(base, 'toestel-a', { kind: 'wis-alles' })).status).toBe(400);
    expect((await fetch(`${base}/tafel/send`, { method: 'POST', body: '{}' })).status).toBe(400);
    expect((await fetch(`${base}/iets-anders`)).status).toBe(404);
  });
});
