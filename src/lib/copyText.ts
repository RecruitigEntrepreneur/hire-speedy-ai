/**
 * Text in die Zwischenablage legen – mit Ersatzweg.
 *
 * navigator.clipboard ist in eingebetteten Browsern (z. B. dem Browser-Fenster
 * der Claude-App) oder ohne Fokus oft gesperrt. Dann versuchen wir den alten
 * Weg über ein markiertes Textfeld. Klappt beides nicht, gibt die Funktion
 * false zurück; die Oberfläche markiert dann den Text und nennt die Tasten.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // weiter mit dem Ersatzweg
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** „⌘C“ auf dem Mac, sonst „Strg+C“. */
export const copyShortcut = () =>
  (typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent) ? '⌘C' : 'Strg+C');
