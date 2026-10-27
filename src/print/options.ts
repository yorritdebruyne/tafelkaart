// Printinstellingen (F16). Apart bestand, zodat storage.ts niet de hele tekencode hoeft te laden.

import type { OrientationChoice, Paper } from './layout';

export interface PrintOptions {
  paper: Paper;
  orientation: OrientationChoice;
  /** Tokens mee afdrukken? Standaard niet: daar staan je minis. */
  tokens: boolean;
  /** Lichtere vloeren, zonder versiering en schaduw. */
  inkSaver: boolean;
  /** Verborgen kamers op aparte bladen (om later bovenop te leggen). Anders: blanco vakjes. */
  hiddenSheets: boolean;
}

export const DEFAULT_PRINT: PrintOptions = {
  paper: 'A4', orientation: 'auto', tokens: false, inkSaver: false, hiddenSheets: false,
};
