// Een kaart meegeven via de URL-hash (het deel na #). Twee vormen:
//   https://.../#map=<JSON, url-encoded>
//   https://.../#b64=<JSON in base64url>   (korter en veiliger in chat-links)
// De hash wordt nooit naar een server gestuurd: alles blijft in de browser.

export function readMapFromHash(hash: string): string | null {
  const h = hash.replace(/^#/, '');
  if (!h) return null;
  try {
    if (h.startsWith('map=')) return decodeURIComponent(h.slice(4));
    if (h.startsWith('b64=')) return decodeBase64Url(h.slice(4));
    const text = decodeURIComponent(h);
    return text.trim().startsWith('{') ? text : null;
  } catch {
    return null;
  }
}

function decodeBase64Url(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
