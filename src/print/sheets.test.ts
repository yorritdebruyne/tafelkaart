// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getLightMode, setLightMode } from '../render/light';
import { parseMapText } from '../schema';
import { createState } from '../state';
import { TEST_MAP } from '../testmap';
import { setFaIndex, setSfeer } from '../tiles';
import { DEFAULT_PRINT } from './options';
import { buildPrint } from './sheets';

describe('printbladen (F16)', () => {
  beforeEach(() => {
    setFaIndex(undefined);
    setSfeer('standaard');
    setLightMode('auto');
  });

  const stal = () => createState(parseMapText(TEST_MAP).map!);

  it('maakt 2 bladen voor de stal, elk met een venster naar de master', () => {
    const root = document.createElement('div');
    const page = buildPrint(root, stal(), DEFAULT_PRINT);
    expect(page).toEqual({ pageW: 210, pageH: 297 });
    const sheets = root.querySelectorAll('.print-sheet');
    expect(sheets).toHaveLength(2);
    const use = sheets[1].querySelector('use')!;
    expect(root.querySelector(use.getAttribute('href')!)).not.toBeNull();
    // Het tweede blad toont kolom F tot J: viewBox begint bij 5 vakjes.
    expect(use.parentElement!.getAttribute('viewBox')).toBe('320 0 320 640');
    expect(sheets[0].querySelector('.print-footer')!.textContent).toContain('controle: 4 vakjes = 10 cm');
  });

  it('drukt standaard geen tokens, geen licht en geen sleepbadges af', () => {
    const root = document.createElement('div');
    buildPrint(root, stal(), DEFAULT_PRINT);
    expect(root.querySelectorAll('.token')).toHaveLength(0);
    expect(root.querySelector('.light-dark')).toBeNull();
    expect(getLightMode()).toBe('auto'); // de instelling van het scherm blijft
    // Verborgen kamer: blanco (wit), niet de donkere mist.
    expect(root.querySelector('.print-hidden')).not.toBeNull();
    expect(root.querySelector('.fog-body')).toBeNull();
  });

  it('met tokens: wel de zichtbare tokens, maar zonder badge', () => {
    const root = document.createElement('div');
    buildPrint(root, stal(), { ...DEFAULT_PRINT, tokens: true });
    expect(root.querySelectorAll('.token').length).toBeGreaterThan(0);
    expect(root.querySelector('.badge')).toBeNull();
  });

  it('verborgen kamers op een apart blad, zonder tokens en zonder mist', () => {
    const root = document.createElement('div');
    buildPrint(root, stal(), { ...DEFAULT_PRINT, hiddenSheets: true, tokens: true });
    const sheets = root.querySelectorAll('.print-sheet');
    expect(sheets).toHaveLength(3);
    const last = sheets[2];
    expect(last.querySelector('.print-footer')!.textContent).toContain('VERBORGEN KAMER 1');
    // H6:J8 -> kolom 7, rij 5, 3 × 3 vakjes.
    expect(last.querySelector('svg svg')!.getAttribute('viewBox')).toBe('448 320 192 192');
    const master = root.querySelector(last.querySelector('use')!.getAttribute('href')!)!;
    expect(master.querySelectorAll('.token')).toHaveLength(0);
    expect(master.querySelector('.print-hidden')).toBeNull();
  });

  it('id\'s botsen niet met de kaart op het scherm', () => {
    const root = document.createElement('div');
    buildPrint(root, stal(), { ...DEFAULT_PRINT, hiddenSheets: true });
    const ids = [...root.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.every((id) => id.startsWith('pm-') || id.startsWith('ph-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // Elke url(#...) wijst naar een id die bestaat.
    for (const el of root.querySelectorAll('[fill^="url"], [clip-path], [filter], [mask]')) {
      for (const attr of ['fill', 'clip-path', 'filter', 'mask']) {
        const m = /url\(#([^)]+)\)/.exec(el.getAttribute(attr) ?? '');
        if (m) expect(ids).toContain(m[1]);
      }
    }
  });

  it('inktspaarmodus: lichtere vloer, geen versiering en geen schaduw', () => {
    const root = document.createElement('div');
    buildPrint(root, stal(), { ...DEFAULT_PRINT, inkSaver: true });
    expect(root.querySelector('.layer-floor')!.getAttribute('opacity')).toBe('0.4');
    expect(root.querySelector('.layer-decor')!.childElementCount).toBe(0);
    expect(root.querySelector('.layer-props')!.hasAttribute('filter')).toBe(false);
  });
});
