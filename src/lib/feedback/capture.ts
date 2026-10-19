/**
 * Bild vom sichtbaren Fenster — genau das, was der Nutzer gerade sieht.
 *
 * Aufnahme aus der Seite selbst (modern-screenshot), ohne den Browser-Dialog
 * „Bildschirm teilen“: der schreckt Kunden ab. Die Bibliothek wird erst beim
 * Klick geladen, damit Dashboard und Aufnahme-Link nicht schwerer werden.
 *
 * Drei Korrekturen, damit das Bild zum Bildschirm passt:
 *   - Fensterscroll: die geklonte Seite wird um die Scrollhöhe nach oben
 *     verschoben (top statt transform, sonst rutschen fixierte Leisten mit).
 *   - Mitlaufende Kopfzeilen (position: sticky) stehen im Klon an ihrer
 *     Ursprungsstelle; sie bekommen ihren Versatz von hier mit.
 *   - Innere Scrollbereiche: restoreScrollPosition der Bibliothek.
 * Grenze: eingebettete PDFs/iframes und manche fremden Bilder bleiben leer.
 */

export interface Screenshot {
  dataUrl: string;
  /** Größe in CSS-Pixeln (= Fenster ohne Scrollleiste) */
  width: number;
  height: number;
}

const IGNORE_ATTR = 'data-feedback-ignore';
const OFFSET_ATTR = 'data-fb-offset';

/** Mitlaufende Elemente markieren, die gerade nicht an ihrer Ursprungsstelle stehen. */
function markStickyOffsets(): HTMLElement[] {
  const marked: HTMLElement[] = [];
  const candidates = document.querySelectorAll<HTMLElement>('.sticky, [style*="sticky"]');
  candidates.forEach((el) => {
    if (getComputedStyle(el).position !== 'sticky') return;
    const now = el.getBoundingClientRect();
    // Ursprungsstelle messen: kurz auf static, im selben Takt zurück — kein Flackern.
    const previous = el.style.position;
    el.style.position = 'static';
    const natural = el.getBoundingClientRect();
    el.style.position = previous;
    const dx = Math.round(now.left - natural.left);
    const dy = Math.round(now.top - natural.top);
    if (dx || dy) {
      el.setAttribute(OFFSET_ATTR, `${dx},${dy}`);
      marked.push(el);
    }
  });
  return marked;
}

function pageBackground(): string {
  for (const el of [document.body, document.documentElement]) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'transparent' && !/rgba\(0, 0, 0, 0\)/.test(bg)) return bg;
  }
  return '#ffffff';
}

export async function captureViewport(): Promise<Screenshot> {
  const { domToJpeg } = await import('modern-screenshot');

  const width = document.documentElement.clientWidth;
  const height = document.documentElement.clientHeight;
  const { scrollX, scrollY } = window;
  const marked = markStickyOffsets();

  try {
    const dataUrl = await domToJpeg(document.body, {
      width,
      height,
      scale: Math.min(window.devicePixelRatio || 1, 1.5),
      quality: 0.82,
      backgroundColor: pageBackground(),
      timeout: 8000,
      // Den geklonten Body um die Scrollhöhe nach oben schieben. Mit !important:
      // Offene Dialoge (react-remove-scroll) sperren den Body mit
      // „position: relative !important; overflow: hidden !important“, und der
      // Klon erbt davon auch overflow-block/-inline. Ohne diese Überschreibung
      // blieb das Bild bei offenem Dialog oben stehen (Live-Test 19.10.2026).
      onCloneNode: (root) => {
        if (!(root instanceof HTMLElement)) return;
        const s = root.style;
        for (const p of ['overflow', 'overflow-x', 'overflow-y', 'overflow-block', 'overflow-inline']) {
          s.setProperty(p, 'visible', 'important');
        }
        s.setProperty('position', 'relative', 'important');
        s.setProperty('inset', 'auto', 'important');
        s.setProperty('top', `${-scrollY}px`, 'important');
        s.setProperty('left', `${-scrollX}px`, 'important');
        s.setProperty('margin', '0px', 'important');
        root.removeAttribute('data-scroll-locked');
      },
      filter: (node) => !(node instanceof Element && node.hasAttribute(IGNORE_ATTR)),
      features: { restoreScrollPosition: true },
      onCloneEachNode: (cloned) => {
        if (!(cloned instanceof HTMLElement)) return;
        const offset = cloned.getAttribute(OFFSET_ATTR);
        if (!offset) return;
        const [dx, dy] = offset.split(',').map(Number);
        cloned.style.position = 'relative';
        cloned.style.left = `${dx}px`;
        cloned.style.top = `${dy}px`;
        cloned.style.right = 'auto';
        cloned.style.bottom = 'auto';
        cloned.removeAttribute(OFFSET_ATTR);
      },
    });
    return { dataUrl, width, height };
  } finally {
    marked.forEach((el) => el.removeAttribute(OFFSET_ATTR));
  }
}

export const FEEDBACK_IGNORE_ATTR = IGNORE_ATTR;
