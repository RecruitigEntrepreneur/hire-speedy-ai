/**
 * Was liegt im Rahmen? Für das Ticket: „Eingabe ‚Gehalt‘ in ‚Konditionen‘“.
 *
 * Gelesen wird die echte Seite unter dem Feedback-Fenster (elementsFromPoint
 * liefert den ganzen Stapel, unser eigener Container wird übersprungen).
 * Nur Beschriftungen, nie getippte Werte.
 */
import { labelOf } from './sessionTrail';

export interface MarkElement {
  kind: string;
  label: string;
  context: string | null;
  tour: string | null;
  inside: string[];
}

export interface ViewportBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const INTERACTIVE =
  'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="switch"], [role="combobox"], [role="option"], [role="menuitem"]';

function kindOf(el: Element): string {
  const role = el.getAttribute('role');
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || role === 'checkbox') return 'Kontrollkästchen';
    if (el.type === 'radio') return 'Auswahlknopf';
    if (['submit', 'button'].includes(el.type)) return 'Knopf';
    return 'Eingabe';
  }
  if (el instanceof HTMLTextAreaElement) return 'Textfeld';
  if (el instanceof HTMLSelectElement || role === 'combobox') return 'Auswahl';
  if (el instanceof HTMLButtonElement || role === 'button') return 'Knopf';
  if (el instanceof HTMLAnchorElement || role === 'link') return 'Link';
  if (role === 'tab') return 'Reiter';
  if (role === 'switch') return 'Schalter';
  if (role === 'option' || role === 'menuitem') return 'Menüpunkt';
  if (el instanceof HTMLImageElement || el instanceof SVGElement) return 'Bild';
  if (/^H[1-6]$/.test(el.tagName)) return 'Überschrift';
  if (el instanceof HTMLTableElement || el.closest('table')) return 'Tabelle';
  if ((el.textContent ?? '').trim().length > 0 && el.children.length === 0) return 'Text';
  return 'Bereich';
}

/** Nächste Überschrift davor im umgebenden Block: „Konditionen“, „Kritische Deals“. */
function contextOf(el: Element): string | null {
  let node: Element | null = el.parentElement;
  for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
    if (node === document.body) break;
    const headings = node.querySelectorAll('h1, h2, h3, h4, legend, [role="heading"], [data-tour]');
    for (const h of Array.from(headings)) {
      if (h === el || h.contains(el)) continue;
      // nur Überschriften, die vor dem Element stehen
      if (h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) {
        const text = labelOf(h);
        if (text) return text;
      }
    }
  }
  return null;
}

const area = (r: { width: number; height: number }) => Math.max(0, r.width) * Math.max(0, r.height);

/**
 * Das kleinste Element, das den Rahmen weitgehend abdeckt. Ein Knopf oder
 * Link darüber zählt nur, wenn er nicht viel größer ist als der Rahmen —
 * sonst stünde bei einer markierten Zeile in einer klickbaren Karte die
 * ganze Karte im Ticket.
 */
function bestElement(top: Element, box: ViewportBox): Element {
  const boxArea = Math.max(1, area(box));
  let best: Element = top;
  for (let el: Element | null = top; el && el !== document.body; el = el.parentElement) {
    best = el;
    const r = el.getBoundingClientRect();
    const overlap = area({
      width: Math.min(r.right, box.left + box.width) - Math.max(r.left, box.left),
      height: Math.min(r.bottom, box.top + box.height) - Math.max(r.top, box.top),
    });
    if (overlap >= 0.6 * boxArea) break;
  }
  const interactive = best.closest(INTERACTIVE);
  if (interactive && area(interactive.getBoundingClientRect()) <= 2.5 * boxArea) return interactive;
  return best;
}

export function describeArea(box: ViewportBox, ignore: Element | null): MarkElement | null {
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const stack = document
    .elementsFromPoint(cx, cy)
    .filter((el) => !ignore?.contains(el) && el !== document.documentElement && el !== document.body);
  const top = stack[0];
  if (!top) return null;
  const target = bestElement(top, box);

  const right = box.left + box.width;
  const bottom = box.top + box.height;
  const inside = Array.from(document.querySelectorAll(INTERACTIVE))
    .filter((el) => !ignore?.contains(el))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= box.left - 2 && r.top >= box.top - 2 && r.right <= right + 2 && r.bottom <= bottom + 2;
    })
    .slice(0, 8)
    .map((el) => `${kindOf(el)} „${labelOf(el)}“`);

  return {
    kind: kindOf(target),
    label: labelOf(target),
    context: contextOf(target),
    tour: target.closest('[data-tour]')?.getAttribute('data-tour') ?? null,
    inside,
  };
}

export function describeShort(el: MarkElement | null | undefined): string | null {
  if (!el) return null;
  return `${el.kind} „${el.label}“${el.context && el.context !== el.label ? ` in „${el.context}“` : ''}`;
}
