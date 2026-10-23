// Kopiëren naar het klembord.
// Let op: navigator.clipboard werkt alleen op https of localhost ("secure context").
// Test je op je telefoon via http://192.168.x.x, dan valt de app terug op een
// oudere methode, en als ook die faalt tonen we de tekst om zelf te kopiëren.

export async function copyText(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* val terug */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
