import type { IncomingMessage, ServerResponse } from 'node:http';

export interface Relay {
  handle(req: IncomingMessage, res: ServerResponse, next?: () => void): void;
  close(): void;
}

export function createRelay(): Relay;
