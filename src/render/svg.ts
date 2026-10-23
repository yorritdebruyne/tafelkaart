// Kleine hulpfunctie om SVG-elementen te maken.
// SVG-elementen moeten met een "namespace" gemaakt worden, anders tekent de browser ze niet.

const NS = 'http://www.w3.org/2000/svg';

/** 1 vakje = 64 SVG-eenheden. De schermgrootte regelen we apart (zoom). */
export const S = 64;

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (parent) parent.appendChild(el);
  return el;
}
