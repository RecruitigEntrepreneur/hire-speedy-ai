/**
 * Arbeitet die echten Fenster auf der Beispiel-Bühne des Headhunter-Rundgangs so durch, wie
 * es ein Headhunter täte: Lebenslauf in die Kopfzeile ziehen, Häkchen setzen, das kurze
 * Interview ausfüllen, durch „Vorstellen“ klicken, das Nachgespräch ausfüllen. Gespeichert
 * wird nichts (lib/demoBackend.ts fängt jedes Senden ab, die Ablage spielt im Beispiel nur vor).
 * Den letzten Klick („Ich suche aktiv“, „Hochladen“, „Interview abschließen“, „Festhalten“ …)
 * macht der Headhunter selbst.
 */
import type { RecruiterTourScene } from '@/lib/recruiterTour';

export type HhFill = NonNullable<RecruiterTourScene['fill']>;

/** Was eingetragen wird: aus dem Beispiel (lib/recruiterDemoData.ts). */
export interface HhFillValues {
  /** Mindest-Fixgehalt im Nachgespräch, in Euro. */
  salary: number;
  /** Zeile „Homeoffice“ in der Empfehlung. */
  homeoffice: string;
  /** Kurzes Interview: „Warum jetzt?“ */
  whyNow: string;
  /** Name der Beispieldatei, die in die Kopfzeile gezogen wird. */
  cvFile: string;
}

export interface HhShow {
  alive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  pointerTo: (el: Element) => Promise<void>;
  /** Zeiger ohne Gleiten an eine Stelle setzen. */
  place: (x: number, y: number) => void;
  tap: () => Promise<void>;
  hidePointer: () => void;
}

const $ = <E extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<E>(sel);

/** Wert in ein Feld schreiben, das React steuert: über den eingebauten Setter, dann „input“. */
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

const checked = (el: Element | null) => el?.getAttribute('aria-checked') === 'true' || el?.getAttribute('data-state') === 'checked';
const chip = (root: ParentNode, field: string, key: string) => $<HTMLButtonElement>(`[data-field="${field}"] [data-chip="${key}"]`, root);
const chipOn = (el: HTMLElement | null) => el?.getAttribute('aria-pressed') === 'true';
const salaryText = (n: number) => n.toLocaleString('de-DE');

/** Ein Durchgang; `true`, sobald er erledigt ist (sonst nächster Versuch). */
type Pass = (values: HhFillValues) => boolean;

const capture = (sel: string) => $<HTMLElement>(`[data-tour="capture.window"] ${sel}`);
const radioOn = (el: Element | null) => el?.getAttribute('aria-checked') === 'true';
/** Kurzes Interview, erste Seite: Gehalt (mittlerer Vorschlag), ein Wechselgrund, Wechselbereitschaft. */
const quickChips = () => [
  capture('[data-dossier-field="expected_salary"] button:nth-of-type(2)'),
  capture('[data-dossier-field="change_motivation_tags"] button[aria-pressed]'),
  capture('[data-dossier-field="change_readiness"] [role="radio"]'),
];
/** Zweite Seite („Was noch fehlt“): Gesprächsart und „Warum jetzt?“. */
const gapsFields = () => ({
  type: capture('[data-tour="capture.interview"] [role="radio"]'),
  whyNow: $<HTMLTextAreaElement>('[data-tour="capture.window"] [data-tour="capture.interview"] textarea'),
});

const PASSES: Record<HhFill, Pass[]> = {
  // Nur vorgeführt: Das Hineinziehen hinterlässt nichts, das Fenster öffnet der nächste Schritt.
  cvDrag: [() => true],
  cvTicks: [() => {
    const ticks = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tour="ablage.window"] button[role="checkbox"]'));
    if (ticks.length < 3) return false;
    ticks.forEach((tick) => { if (!checked(tick)) tick.click(); });
    return true;
  }],
  quickInterview: [() => {
    if ($('[data-tour="capture.interview"]')) return true;
    const chips = quickChips();
    const save = capture('[data-tour="capture.saveRest"]') as HTMLButtonElement | null;
    if (!save || chips.some((c) => !c)) return false;
    chips.forEach((c) => { if (c && !radioOn(c) && c.getAttribute('aria-pressed') !== 'true') c.click(); });
    if (!save.disabled) save.click();
    return false;
  }, (values) => {
    const { type: kind, whyNow } = gapsFields();
    if (!kind || !whyNow) return false;
    if (!radioOn(kind)) kind.click();
    if (!whyNow.value) type(whyNow, values.whyNow);
    return true;
  }],
  activate: [() => {
    const box = $<HTMLButtonElement>('[data-tour="activation.check"]');
    if (!box) return false;
    if (!checked(box)) box.click();
    return true;
  }],
  // Passung › Kundenansicht › Abschicken, dann das Häkchen der Einwilligung.
  vorstellen: [() => {
    const consent = $<HTMLButtonElement>('[data-tour="vorstellen.consent"]');
    if (consent) { if (!checked(consent)) consent.click(); return true; }
    const next = $<HTMLButtonElement>('[data-tour="vorstellen.next"]');
    if (next && !next.disabled) next.click();
    return false;
  }],
  debrief: [(values) => {
    const root = $('[data-tour="debrief.window"]');
    const gut = root && chip(root, 'bauch', 'gut');
    const fix = root && $<HTMLInputElement>('[data-field="fixMin"]', root);
    const start = root && chip(root, 'start', 'nach_frist');
    const weiter = root && chip(root, 'weiter', 'ja');
    if (!root || !gut || !fix || !start || !weiter) return false;
    if (!chipOn(gut)) gut.click();
    if (!fix.value) type(fix, salaryText(values.salary));
    if (!chipOn(start)) start.click();
    if (!chipOn(weiter)) weiter.click();
    return true;
  }],
  recommend: [(values) => {
    const input = $<HTMLInputElement>('[data-tour="recommend.window"] input[data-rec="homeoffice"]');
    if (!input) return false;
    if (!input.value) type(input, values.homeoffice);
    return true;
  }],
  // Erst „Gespräch geführt“, dann die Antwort am Telefon: Zusage. Gemeldet wird selbst.
  offerTalked: [() => {
    if ($('[data-tour="offerAnswer.accept"]')) return true;
    const accepted = $<HTMLButtonElement>('[data-tour="offerAnswer.window"] [data-way="accepted"]');
    const talked = $<HTMLButtonElement>('[data-tour="offerAnswer.talked"]');
    if (talked && !talked.disabled) { talked.click(); return false; }
    if (accepted && !talked) accepted.click();
    return false;
  }],
};

/** Fenster, die sich beim ersten Besuch sichtbar füllen. */
export const HH_ANIMATED_FILLS: ReadonlySet<HhFill> = new Set<HhFill>(['activate', 'cvDrag', 'cvTicks', 'quickInterview', 'vorstellen', 'debrief', 'recommend', 'offerTalked']);

/** Sofort ausfüllen (Neuladen, Zurück, „Weiter“ während der Vorführung). */
export function runHhAutofill(kind: HhFill, values: HhFillValues): () => void {
  const passes = PASSES[kind];
  let atPass = 0;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    if (passes[atPass](values)) atPass += 1;
    if (atPass >= passes.length || tries > 80) window.clearInterval(timer);
  }, 150);
  return () => window.clearInterval(timer);
}

async function waitFor<E>(find: () => E | null | undefined, show: HhShow, ms = 5000): Promise<E | null> {
  for (let waited = 0; waited < ms && show.alive(); waited += 100) {
    const found = find();
    if (found) return found;
    await show.sleep(100);
  }
  return null;
}

/** Zeiger hin, antippen, dann klicken. */
async function tapOn(el: HTMLElement, show: HhShow, act: () => void = () => el.click()): Promise<boolean> {
  await show.pointerTo(el);
  await show.tap();
  if (!show.alive()) return false;
  act();
  await show.sleep(260);
  return show.alive();
}

async function typeSlow(el: HTMLInputElement | HTMLTextAreaElement, text: string, show: HhShow, perChar = 45): Promise<boolean> {
  for (let i = 1; i <= text.length; i += 1) {
    if (!show.alive()) return false;
    type(el, text.slice(0, i));
    await show.sleep(perChar);
  }
  return true;
}

const SHOWS: Record<HhFill, (values: HhFillValues, show: HhShow) => Promise<boolean>> = {
  // Ein Lebenslauf (nur ein Bild davon) wandert mit dem Zeiger in die Kopfzeile der Übersicht; die
  // Kopfzeile zeigt ihre Ablage-Fläche wie bei einer echten Datei. Hochgeladen wird nichts.
  async cvDrag(values, show) {
    const zone = await waitFor(() => $('[data-tour="dashboard.header"]'), show);
    if (!zone) return show.alive();
    // Die Karte scrollt die Kopfzeile beim Erscheinen noch zurecht: erst stillstehen lassen, dann messen.
    await show.sleep(300);
    for (let last = Number.NaN, i = 0; i < 25 && show.alive(); i += 1) {
      const top = zone.getBoundingClientRect().top;
      if (Math.abs(top - last) < 1) break;
      last = top;
      await show.sleep(120);
    }
    await show.sleep(200);
    const r = zone.getBoundingClientRect();
    const start = { x: Math.min(window.innerWidth - 260, r.left + r.width * 0.7), y: Math.min(window.innerHeight - 90, r.bottom + 220) };
    const end = { x: r.left + Math.min(r.width * 0.5, 60), y: r.top + Math.min(r.height * 0.6, 24) };
    const chip = document.createElement('div');
    chip.setAttribute('aria-hidden', 'true');
    chip.className = 'pointer-events-none fixed z-[102] flex items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 text-sm font-medium text-popover-foreground shadow-xl';
    chip.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
    chip.append(document.createTextNode(values.cvFile));
    const at = (p: { x: number; y: number }) => { chip.style.left = `${p.x + 14}px`; chip.style.top = `${p.y + 16}px`; };
    at(start);
    chip.style.opacity = '0';
    document.body.append(chip);
    const drag = (kind: 'dragenter' | 'dragleave') => {
      try {
        const data = new DataTransfer();
        data.items.add(new File([''], values.cvFile, { type: 'application/pdf' }));
        zone.dispatchEvent(new DragEvent(kind, { bubbles: true, cancelable: true, dataTransfer: data }));
      } catch { /* ohne DataTransfer (alte Browser): nur das Bild wandert */ }
    };
    try {
      show.place(start.x, start.y);
      chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
      await show.sleep(450);
      if (!show.alive()) return false;
      chip.style.transition = 'left 900ms cubic-bezier(0.4, 0, 0.2, 1), top 900ms cubic-bezier(0.4, 0, 0.2, 1)';
      at(end);
      // Der Zeiger gleitet mit (pointerTo endet am selben Punkt wie das Bild).
      void show.pointerTo(zone);
      await show.sleep(700);
      drag('dragenter');
      await show.sleep(1100);
      if (!show.alive()) return false;
      await show.tap();
      chip.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.6)' }], { duration: 260, fill: 'forwards' });
      await show.sleep(260);
      drag('dragleave');
      show.hidePointer();
      return show.alive();
    } finally {
      chip.remove();
      drag('dragleave');
    }
  },
  async cvTicks(_v, show) {
    const ticks = await waitFor(() => {
      const all = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-tour="ablage.window"] button[role="checkbox"]'));
      return all.length >= 3 ? all : null;
    }, show);
    if (!ticks) return show.alive();
    await show.sleep(400);
    for (const tick of ticks) {
      if (!checked(tick) && !(await tapOn(tick, show))) return false;
    }
    return show.alive();
  },
  // Kurzes Interview „aus dem Kopf“: drei Angaben antippen, speichern, dann Gesprächsart und
  // „Warum jetzt?“. „Interview abschließen“ klickt der Headhunter selbst.
  async quickInterview(values, show) {
    const save = await waitFor(() => capture('[data-tour="capture.saveRest"]'), show, 6000);
    if (!save) return show.alive();
    await show.sleep(400);
    for (const chip of quickChips()) {
      if (chip && !radioOn(chip) && chip.getAttribute('aria-pressed') !== 'true' && !(await tapOn(chip, show))) return false;
    }
    if (!(await tapOn(save, show))) return false;
    const fields = await waitFor(() => { const f = gapsFields(); return f.type && f.whyNow ? f : null; }, show, 4000);
    if (!fields) return show.alive();
    await show.sleep(300);
    if (!radioOn(fields.type) && !(await tapOn(fields.type!, show))) return false;
    const why = fields.whyNow!;
    if (!why.value) {
      if (!(await tapOn(why, show, () => why.focus()))) return false;
      if (!(await typeSlow(why, values.whyNow, show, 22))) return false;
      why.blur();
    }
    show.hidePointer();
    return show.alive();
  },
  async activate(_v, show) {
    const box = await waitFor(() => $<HTMLButtonElement>('[data-tour="activation.check"]'), show);
    if (!box) return show.alive();
    await show.sleep(400);
    if (!checked(box) && !(await tapOn(box, show))) return false;
    return show.alive();
  },
  async vorstellen(_v, show) {
    for (let i = 0; i < 3 && show.alive(); i += 1) {
      const consent = $<HTMLButtonElement>('[data-tour="vorstellen.consent"]');
      if (consent) {
        if (!checked(consent) && !(await tapOn(consent, show))) return false;
        return show.alive();
      }
      const next = await waitFor(() => {
        const b = $<HTMLButtonElement>('[data-tour="vorstellen.next"]');
        return b && !b.disabled ? b : null;
      }, show, 6000);
      if (!next) return show.alive();
      // Kurz stehen lassen, damit man die Passung und die Kundenansicht sieht (Marko 17.11.: nicht warten lassen).
      await show.sleep(700);
      if (!(await tapOn(next, show))) return false;
      await waitFor(() => $('[data-tour="vorstellen.consent"]') ?? (i === 0 ? $('[data-tour="vorstellen.next"]') : null), show, 2000);
    }
    return show.alive();
  },
  async debrief(values, show) {
    const root = await waitFor(() => $('[data-tour="debrief.window"]'), show);
    const gut = root && await waitFor(() => chip(root, 'bauch', 'gut'), show);
    if (!root || !gut) return show.alive();
    if (!chipOn(gut) && !(await tapOn(gut, show))) return false;
    const fix = $<HTMLInputElement>('[data-field="fixMin"]', root);
    if (fix && !fix.value) {
      if (!(await tapOn(fix, show, () => fix.focus()))) return false;
      if (!(await typeSlow(fix, salaryText(values.salary), show))) return false;
    }
    const start = chip(root, 'start', 'nach_frist');
    if (start && !chipOn(start) && !(await tapOn(start, show))) return false;
    const weiter = chip(root, 'weiter', 'ja');
    if (weiter && !chipOn(weiter) && !(await tapOn(weiter, show))) return false;
    show.hidePointer();
    return show.alive();
  },
  async recommend(values, show) {
    const input = await waitFor(() => $<HTMLInputElement>('[data-tour="recommend.window"] input[data-rec="homeoffice"]'), show);
    if (!input || input.value) return show.alive();
    if (!(await tapOn(input, show, () => input.focus()))) return false;
    if (!(await typeSlow(input, values.homeoffice, show, 30))) return false;
    show.hidePointer();
    return show.alive();
  },
  async offerTalked(_v, show) {
    const talked = await waitFor(() => $<HTMLButtonElement>('[data-tour="offerAnswer.talked"]'), show);
    if (talked) {
      await show.sleep(400);
      if (!(await tapOn(talked, show))) return false;
    }
    const accepted = await waitFor(() => (!$('[data-tour="offerAnswer.talked"]') ? $<HTMLButtonElement>('[data-tour="offerAnswer.window"] [data-way="accepted"]') : null), show, 4000);
    if (accepted && !$('[data-tour="offerAnswer.accept"]') && !(await tapOn(accepted, show))) return false;
    return show.alive();
  },
};

/** Sichtbar ausfüllen; `true`, wenn es fertig wurde. */
export function showHhFill(kind: HhFill, values: HhFillValues, show: HhShow): Promise<boolean> {
  return SHOWS[kind](values, show);
}
