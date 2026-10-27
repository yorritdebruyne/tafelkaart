// Het "doorgeefluik" voor de tafel (F17): telefoons en tv blijven gelijk.
//
// Geen WebSocket-bibliotheek nodig: we gebruiken twee gewone HTTP-dingen.
//   GET  /tafel/events?c=<id>   blijft open (Server-Sent Events): de server stuurt hierlangs
//                               elk bericht door, als regels "data: {...}".
//   POST /tafel/send?c=<id>     een toestel stuurt één bericht (JSON).
//   GET  /tafel/ping            bestaat het doorgeefluik? (op GitHub Pages niet)
//
// Het luik begrijpt de kaart zelf niet. Het onthoudt alleen:
//   - de laatste volledige toestand ("state"-bericht),
//   - alle stappen daarna (verplaatsen, deur, beurt, patch),
// zodat een toestel dat later verbindt (of opnieuw verbindt) meteen gelijk loopt.
// Elk bericht gaat naar alle ANDERE toestellen (de zender heeft het zelf al gedaan).
//
// Zoals een groepschat: de server bewaart de geschiedenis sinds de laatste "samenvatting".

/** Berichten die de toestand veranderen en dus onthouden worden. */
const OPS = new Set(['move', 'door', 'turn', 'patch']);
/** Live-berichten (vinger beweegt): doorsturen, niet onthouden. */
const LIVE = new Set(['drag', 'drag-end']);
const MAX_BODY = 4 * 1024 * 1024;
const MAX_OPS = 5000;
const KEEPALIVE_MS = 20000;

/**
 * Maakt een middleware (zoals in Express/Connect): (req, res, next).
 * @returns {{ handle: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next?: () => void) => void, close: () => void }}
 */
export function createRelay() {
  /** @type {Map<string, import('node:http').ServerResponse>} */
  const clients = new Map();
  /** @type {object | null} */
  let snapshot = null;
  /** @type {object[]} */
  let ops = [];
  let seq = 0;

  const write = (res, msg) => res.write(`data: ${JSON.stringify(msg)}\n\n`);
  const broadcast = (msg, except) => {
    for (const [id, res] of clients) if (id !== except) write(res, msg);
  };
  const announce = () => broadcast({ kind: 'clients', n: clients.size });

  const timer = setInterval(() => {
    for (const res of clients.values()) res.write(': ping\n\n'); // houdt de verbinding open
  }, KEEPALIVE_MS);
  timer.unref?.();

  function events(req, res, id) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n'); // de browser probeert na 2 s opnieuw als de lijn wegvalt
    clients.get(id)?.end(); // zelfde toestel opnieuw verbonden
    clients.set(id, res);
    write(res, { kind: 'init', snapshot, ops, clients: clients.size });
    announce();
    req.on('close', () => {
      if (clients.get(id) === res) clients.delete(id);
      announce();
    });
  }

  function send(req, res, id) {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        res.statusCode = 413;
        res.end('te groot');
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (res.writableEnded) return;
      let msg;
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.statusCode = 400;
        return res.end('geen JSON');
      }
      if (!msg || typeof msg !== 'object' || typeof msg.kind !== 'string') {
        res.statusCode = 400;
        return res.end('geen bericht');
      }
      msg = { ...msg, from: id, seq: ++seq };
      if (msg.kind === 'state') {
        snapshot = msg;
        ops = [];
      } else if (OPS.has(msg.kind)) {
        ops.push(msg);
        if (ops.length > MAX_OPS) ops.shift();
      } else if (!LIVE.has(msg.kind)) {
        res.statusCode = 400;
        return res.end('onbekend bericht');
      }
      broadcast(msg, id);
      res.statusCode = 204;
      res.end();
    });
  }

  function handle(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://x');
    if (!url.pathname.startsWith('/tafel/')) return next ? next() : void ((res.statusCode = 404), res.end());
    res.setHeader('Cache-Control', 'no-store');
    const id = (url.searchParams.get('c') ?? '').slice(0, 64);
    if (url.pathname === '/tafel/ping' && req.method === 'GET') {
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ ok: true, clients: clients.size }));
    }
    if (!/^[\w-]{4,64}$/.test(id)) {
      res.statusCode = 400;
      return res.end('ontbrekende c=<id>');
    }
    if (url.pathname === '/tafel/events' && req.method === 'GET') return events(req, res, id);
    if (url.pathname === '/tafel/send' && req.method === 'POST') return send(req, res, id);
    res.statusCode = 404;
    res.end();
  }

  return {
    handle,
    close() {
      clearInterval(timer);
      for (const res of clients.values()) res.end();
      clients.clear();
    },
  };
}
