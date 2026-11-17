/**
 * Füllt die echten Fenster auf der Beispiel-Bühne so aus, wie es ein Kunde tun würde:
 * Termine anklicken, Gehalt eintippen, Sterne vergeben. Die Fenster selbst bleiben
 * unverändert; hier wird nur geklickt und getippt, gespeichert wird nichts
 * (lib/demoBackend.ts fängt jedes Senden ab).
 */

import { toast } from 'sonner';

export type DemoFill = 'request' | 'feedback' | 'offer' | 'offerSend' | 'einsatz' | 'contract' | 'newJob' | 'bell' | 'intakeKind' | 'invite';

/** Menüs (Radix) öffnen beim Drücken, nicht beim Klick: so wie eine echte Maus. */
function press(el: Element) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
}

/**
 * Offene Menüs (Glocke, Neue Stelle) schließen, bevor das Fenster des nächsten Schritts aufgeht:
 * mit einem Druck auf ihren Knopf, solange noch kein Fenster offen ist. Danach zählte der Druck
 * für das Fenster als Klick daneben und schlösse es mit; Escape fängt der Rundgang selbst ab.
 * Die Bühne ruft das beim Schrittwechsel als Layout-Effekt (ClientTour).
 */
export function closeOpenMenus(): void {
  for (const menu of document.querySelectorAll('[role="menu"]')) {
    const trigger = menu.id ? document.querySelector(`[aria-controls="${CSS.escape(menu.id)}"]`) : null;
    if (trigger) press(trigger);
  }
}

/** Einladen: das Häkchen der Stelle des Rundgangs, sonst der ersten Stelle in der Liste. */
function inviteJobBox(values: DemoFillValues): HTMLInputElement | null {
  const list = '[data-tour="team.inviteWindow"] label input[type="checkbox"]';
  return (values.jobId ? document.querySelector<HTMLInputElement>(`${list}[data-job="${values.jobId}"]`) : null) ?? document.querySelector<HTMLInputElement>(list);
}

/** Wert in ein Feld schreiben, das React steuert: über den eingebauten Setter, dann „input“. */
function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Ein Schritt des Ausfüllens; `true`, sobald er erledigt ist (sonst nächster Versuch). */
type Pass = (root: HTMLElement, texts: DemoFillTexts, values: DemoFillValues) => boolean;

export interface DemoFillTexts {
  impression: string; strengths: string; concerns: string;
  /** Beispiel-Kollegin für „Team einladen“. */
  colleagueName: string; colleagueEmail: string;
  /** Meldung bei der Zusage, wie sie live als Hinweis oben einblendet. */
  notifyTitle: string; notifyBody: string;
}
export interface DemoFillValues {
  salary: number | null; /** YYYY-MM-DD */ startDate: string;
  /** Art der Besetzung der Stelle des Kunden, für das Aufnahme-Fenster (data-kind). */
  kind?: 'full-time' | 'freelance';
  /** Stelle des Rundgangs: Beim Einladen wird sie angehakt. */
  jobId?: string;
}

const PASSES: Record<DemoFill, Pass[]> = {
  /** Drei Terminvorschläge an verschiedenen Tagen. */
  request: [
    (root) => {
      const grid = root.querySelector('[data-tour="request.grid"]');
      if (!grid) return false;
      const chosen = grid.querySelectorAll('button[aria-pressed="true"]').length;
      if (chosen >= 3) return true;
      const free = [...grid.querySelectorAll<HTMLButtonElement>('button[aria-pressed="false"]:not(:disabled)')];
      if (free.length < 3) return false;
      const picks = [0, Math.floor(free.length / 2), free.length - 1].slice(0, 3 - chosen);
      picks.forEach((i) => free[i].click());
      return true;
    },
  ],
  /** Eindruck, dann „Mehr“ öffnen, Sterne, Stärken und offene Punkte. Den Weg wählt der Kunde selbst. */
  feedback: [
    (root, texts) => {
      const impression = root.querySelector<HTMLTextAreaElement>('textarea[id^="impression-"]');
      if (!impression) return false;
      if (impression.value !== texts.impression) type(impression, texts.impression);
      root.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
      return true;
    },
    (root, texts) => {
      const groups = [...root.querySelectorAll<HTMLElement>('[role="radiogroup"]')].filter((g) => !g.querySelector('[data-way]'));
      const areas = [...root.querySelectorAll<HTMLTextAreaElement>('textarea')].filter((a) => !a.id);
      if (groups.length < 3 || areas.length < 2) return false;
      // Nur klicken, was noch nicht stimmt: Ein zweiter Klick auf denselben Stern nähme ihn zurück.
      [4, 5, 4].forEach((stars, i) => {
        const star = groups[i].querySelectorAll<HTMLButtonElement>('button')[stars - 1];
        if (star && star.getAttribute('aria-checked') !== 'true') star.click();
      });
      if (areas[0].value !== texts.strengths) type(areas[0], texts.strengths);
      if (areas[1].value !== texts.concerns) type(areas[1], texts.concerns);
      return true;
    },
  ],
  /** Gehalt aus der Empfehlung und die ersten Extras aus der Aufnahme. */
  offer: [
    (root, _texts, values) => {
      const fix = root.querySelector<HTMLInputElement>('#offer-fix');
      if (!fix) return false;
      if (values.salary && fix.value.replace(/\D/g, '') !== String(values.salary)) type(fix, String(values.salary));
      const on = root.querySelectorAll('button[aria-pressed="true"]').length;
      [...root.querySelectorAll<HTMLButtonElement>('button[aria-pressed="false"]')].slice(0, Math.max(0, 2 - on)).forEach((b) => b.click());
      return true;
    },
  ],
  /** Contracting: Beginn eintragen; Laufzeit und Tage je Woche kommen aus der Stelle. */
  einsatz: [
    (root, _texts, values) => {
      const startAt = root.querySelector<HTMLInputElement>('#einsatz-start');
      if (!startAt) return false;
      if (!startAt.value) type(startAt, values.startDate);
      return true;
    },
  ],
  /**
   * Arbeitsvertrag (Marko 17.11.: „wir schicken ihn selbst zu, dann ist es einfacher“): Weg
   * „Selbst verschicken“, „Verschickt am“ steht schon auf heute. Gespeichert wird selbst.
   */
  contract: [
    (root) => {
      if (root.querySelector('[data-tour="contract.saveSelf"]')) return true;
      const self = root.querySelector<HTMLButtonElement>('[data-tour="contract.self"]');
      if (!self) return false;
      self.click();
      return true;
    },
  ],
  /** Team: Einladen öffnen, Beispiel-Kollegin eintragen, „Entscheidet mit“ für die Stelle. Verschickt wird nichts. */
  invite: [
    () => {
      if (document.querySelector('[data-tour="team.inviteWindow"]')) return true;
      const open = document.querySelector<HTMLButtonElement>('[data-tour="team.invite"]');
      if (!open) return false;
      open.click();
      return true;
    },
    (_root, texts) => {
      const name = document.querySelector<HTMLInputElement>('#invite-name');
      const email = document.querySelector<HTMLInputElement>('#invite-email');
      if (!name || !email) return false;
      if (!name.value) type(name, texts.colleagueName);
      if (!email.value) type(email, texts.colleagueEmail);
      return true;
    },
    () => {
      const role = document.querySelector<HTMLButtonElement>('[data-tour="team.inviteWindow"] [data-role="hiring_manager"]');
      if (!role) return false;
      if (!role.className.includes('border-primary')) role.click();
      return true;
    },
    (_root, _texts, values) => {
      const box = inviteJobBox(values);
      if (!box) return false;
      if (!box.checked) box.click();
      return true;
    },
  ],
  /** Aufnahme: die Art der Besetzung wählen, wie sie die Stelle des Kunden hat; dann stehen die Wege da. */
  intakeKind: [
    (_root, _texts, values) => {
      if (document.querySelector('[data-tour="intake.ways"]')) return true;
      const kind = document.querySelector<HTMLButtonElement>(`[data-kind="${values.kind ?? 'full-time'}"]`);
      if (!kind) return false;
      kind.click();
      return true;
    },
  ],
  /** Das Menü „Neue Stelle“ öffnen (nur zeigen, nicht hineinspringen). */
  newJob: [
    () => {
      if (document.querySelector('[data-tour="jobs.menu"]')) return true;
      const button = document.querySelector('[data-tour="jobs.new"]');
      if (!button) return false;
      press(button);
      return true;
    },
  ],
  /** Die Glocke öffnen: oben steht die Zusage. */
  bell: [
    () => {
      if (document.querySelector('[data-tour="bell.menu"]')) return true;
      const bell = document.querySelector('[data-tour="header.bell"]');
      if (!bell) return false;
      press(bell);
      return true;
    },
  ],
  /** Wie `offer`, danach weiter zur Prüfung: Dort steht die Mail an den Kandidaten. */
  offerSend: [
    (root, texts, values) => PASSES.offer[0](root, texts, values),
    (root) => {
      const next = root.querySelector<HTMLButtonElement>('[data-tour="offer.next"]:not(:disabled)');
      if (!next) return false;
      next.click();
      return true;
    },
  ],
};

/**
 * Füllt das offene Fenster aus, sobald es da ist; höchstens 9 Sekunden lang. Die Rückgabe
 * bricht ab (Schrittwechsel).
 */
export function runAutofill(kind: DemoFill, texts: DemoFillTexts, values: DemoFillValues): () => void {
  const passes = PASSES[kind];
  let at = 0;
  let tries = 0;
  const timer = window.setInterval(() => {
    tries += 1;
    // Auch die Rundgang-Karte ist ein „dialog“: das Fenster nehmen, in dem der Schritt gelingt.
    // Ohne offenes Fenster (Menü, Glocke) arbeitet der Schritt auf der Seite selbst.
    const roots = [...document.querySelectorAll<HTMLElement>('[role="dialog"]'), document.body];
    if (roots.some((root) => passes[at](root, texts, values))) at += 1;
    if (at >= passes.length || tries > 60) window.clearInterval(timer);
  }, 150);
  return () => window.clearInterval(timer);
}

// ---------------------------------------------------------------------------------------------
// Sichtbar ausfüllen (16.11.2026, Marko: „Ja, mach mal“): dieselben Felder wie oben, aber vor den
// Augen des Kunden. Termine klickt der Zeiger an, Texte tippen sich, Sterne füllen sich
// nacheinander. Bricht ab, sobald der Schritt wechselt oder „Weiter“ die Vorführung überspringt.
// ---------------------------------------------------------------------------------------------

/** Diese Fenster werden vorgeführt; die übrigen füllt `runAutofill` sofort. */
export const ANIMATED_FILLS: ReadonlySet<DemoFill> = new Set<DemoFill>(['request', 'feedback', 'offer', 'contract', 'newJob', 'bell', 'invite']);

interface Show {
  alive: () => boolean;
  sleep: (ms: number) => Promise<void>;
  pointerTo: (el: Element) => Promise<void>;
  tap: () => Promise<void>;
  hidePointer: () => void;
}

async function waitFor<T extends Element>(find: () => T | null | undefined, show: Show, ms = 4000): Promise<T | null> {
  for (let waited = 0; waited < ms && show.alive(); waited += 100) {
    const found = find();
    if (found) return found;
    await show.sleep(100);
  }
  return null;
}

/** Tippt einen Text Zeichen für Zeichen ein (React-gesteuertes Feld). */
async function typeSlow(el: HTMLInputElement | HTMLTextAreaElement, text: string, perChar: number, show: Show): Promise<boolean> {
  for (let i = 1; i <= text.length; i += 1) {
    if (!show.alive()) return false;
    type(el, text.slice(0, i));
    await show.sleep(perChar);
  }
  return true;
}

const SHOWS: Partial<Record<DemoFill, (texts: DemoFillTexts, values: DemoFillValues, show: Show) => Promise<boolean>>> = {
  /** Der Zeiger wählt drei Zeiten an verschiedenen Tagen. */
  async request(_texts, _values, show) {
    const grid = await waitFor(() => document.querySelector('[data-tour="request.grid"]'), show);
    const free = grid ? [...grid.querySelectorAll<HTMLButtonElement>('button[aria-pressed="false"]:not(:disabled)')] : [];
    if (free.length < 3) return show.alive();
    // Drei Tage aus dem linken Teil des Rasters: rechts steht beim Vorführen die Karte.
    for (const i of [0, Math.floor(free.length / 3), Math.floor((free.length * 2) / 3)]) {
      await show.pointerTo(free[i]);
      await show.tap();
      if (!show.alive()) return false;
      free[i].click();
      await show.sleep(180);
    }
    show.hidePointer();
    await show.sleep(250);
    return show.alive();
  },
  /** Eindruck tippt sich, „Mehr“ geht auf, Sterne füllen sich, Stärken und offene Punkte. */
  async feedback(texts, _values, show) {
    const root = await waitFor(() => document.querySelector<HTMLElement>('[data-tour="feedback.window"]'), show);
    const impression = root?.querySelector<HTMLTextAreaElement>('textarea[id^="impression-"]');
    if (!root || !impression) return show.alive();
    if (!(await typeSlow(impression, texts.impression, 22, show))) return false;
    root.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
    await show.sleep(300);
    const groups = [...root.querySelectorAll<HTMLElement>('[role="radiogroup"]')].filter((g) => !g.querySelector('[data-way]'));
    for (const [i, stars] of [4, 5, 4].entries()) {
      const buttons = groups[i]?.querySelectorAll<HTMLButtonElement>('button') ?? [];
      for (let n = 0; n < stars; n += 1) {
        if (!show.alive()) return false;
        buttons[n]?.click();
        await show.sleep(80);
      }
    }
    const areas = [...root.querySelectorAll<HTMLTextAreaElement>('textarea')].filter((a) => !a.id);
    if (areas[0] && !(await typeSlow(areas[0], texts.strengths, 10, show))) return false;
    if (areas[1] && !(await typeSlow(areas[1], texts.concerns, 10, show))) return false;
    await show.sleep(250);
    return show.alive();
  },
  /** Gehalt aus der Empfehlung tippt sich, zwei Extras schalten an. */
  async offer(_texts, values, show) {
    const root = await waitFor(() => document.querySelector<HTMLElement>('[data-tour="offer.window"]'), show);
    const fix = root?.querySelector<HTMLInputElement>('#offer-fix');
    if (!root || !fix) return show.alive();
    if (values.salary && !(await typeSlow(fix, String(values.salary), 110, show))) return false;
    await show.sleep(350);
    for (let n = 0; n < 2; n += 1) {
      const next = root.querySelector<HTMLButtonElement>('button[aria-pressed="false"]');
      if (!next || !show.alive()) break;
      next.click();
      await show.sleep(280);
    }
    await show.sleep(250);
    return show.alive();
  },
};

SHOWS.newJob = async (_texts, _values, show) => {
  const button = await waitFor(() => document.querySelector('[data-tour="jobs.new"]'), show);
  if (!button) return show.alive();
  await show.sleep(300);
  await show.pointerTo(button);
  await show.tap();
  if (!show.alive()) return false;
  if (!document.querySelector('[data-tour="jobs.menu"]')) press(button);
  await waitFor(() => document.querySelector('[data-tour="jobs.menu"]'), show, 1500);
  show.hidePointer();
  return show.alive();
};

/** Die Zusage kommt herein (wie live: Hinweis oben), dann öffnet der Zeiger die Glocke. */
SHOWS.bell = async (texts, _values, show) => {
  const bell = await waitFor(() => document.querySelector('[data-tour="header.bell"]'), show);
  if (!bell) return show.alive();
  await show.sleep(500);
  if (!show.alive()) return false;
  toast(texts.notifyTitle, { description: texts.notifyBody });
  await show.sleep(1600);
  await show.pointerTo(bell);
  await show.tap();
  if (!show.alive()) return false;
  if (!document.querySelector('[data-tour="bell.menu"]')) press(bell);
  await waitFor(() => document.querySelector('[data-tour="bell.menu"]'), show, 1500);
  show.hidePointer();
  return show.alive();
};

SHOWS.contract = async (_texts, _values, show) => {
  const root = await waitFor(() => document.querySelector<HTMLElement>('[data-tour="contract.window"]'), show);
  const self = root?.querySelector<HTMLButtonElement>('[data-tour="contract.self"]');
  if (!root || !self) return show.alive();
  await show.sleep(400);
  await show.pointerTo(self);
  await show.tap();
  if (!show.alive()) return false;
  self.click();
  await waitFor(() => root.querySelector('[data-tour="contract.saveSelf"]'), show, 1500);
  await show.sleep(300);
  return show.alive();
};

/** Team: Der Zeiger klickt „Einladen“, tippt die Beispiel-Kollegin ein, wählt Rolle und Stelle. */
SHOWS.invite = async (texts, values, show) => {
  const open = await waitFor(() => document.querySelector<HTMLButtonElement>('[data-tour="team.invite"]'), show);
  if (!open) return show.alive();
  await show.sleep(300);
  await show.pointerTo(open);
  await show.tap();
  if (!show.alive()) return false;
  open.click();
  const name = await waitFor(() => document.querySelector<HTMLInputElement>('#invite-name'), show, 2000);
  const email = document.querySelector<HTMLInputElement>('#invite-email');
  if (!name || !email) return show.alive();
  await show.sleep(250);
  for (const [field, value] of [[name, texts.colleagueName], [email, texts.colleagueEmail]] as const) {
    await show.pointerTo(field);
    for (let i = 1; i <= value.length && show.alive(); i += 2) { type(field, value.slice(0, i)); await show.sleep(35); }
    type(field, value);
  }
  const role = document.querySelector<HTMLButtonElement>('[data-tour="team.inviteWindow"] [data-role="hiring_manager"]');
  if (role) {
    await show.pointerTo(role);
    await show.tap();
    if (!show.alive()) return false;
    if (!role.className.includes('border-primary')) role.click();
  }
  const box = await waitFor(() => inviteJobBox(values), show, 2500);
  if (box) {
    await show.pointerTo(box);
    await show.tap();
    if (!show.alive()) return false;
    if (!box.checked) box.click();
  }
  show.hidePointer();
  await show.sleep(250);
  return show.alive();
};


/** Füllt das Fenster sichtbar aus; `true`, wenn es fertig wurde (nicht abgebrochen). */
export function showFill(kind: DemoFill, texts: DemoFillTexts, values: DemoFillValues, show: Show): Promise<boolean> {
  const run = SHOWS[kind];
  return run ? run(texts, values, show) : Promise.resolve(true);
}

// ---------------------------------------------------------------------------------------------
// Besondere Momente: ruhige Einblendungen auf den echten Seiten, nur beim ersten Besuch.
// ---------------------------------------------------------------------------------------------

export type DemoMoment = 'reveal' | 'hired';

const LOCK_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>';

/**
 * Spielt einen Moment ab, sobald die Seite steht. Die Elemente sind bis zum Einsatz verborgen
 * (fill: backwards), damit nichts erst sichtbar ist und dann neu erscheint.
 */
export function runMoment(kind: DemoMoment, opts: { companies: string[]; delay?: number }): () => void {
  let stopped = false;
  const delay = opts.delay ?? 650;
  const timers: number[] = [];
  const animations: Animation[] = [];
  const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const play = (el: Element | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions) => {
    if (el) animations.push(el.animate(frames, { fill: 'backwards', easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', ...options }));
  };

  const start = () => {
    if (kind === 'reveal') {
      const name = document.querySelector('[data-tour="candidate.name"]');
      const avatar = document.querySelector('[data-tour="candidate.avatar"]');
      if (!name || !avatar) return false;
      // Schloss über dem Bild öffnet sich und verschwindet, dann erscheinen Bild und Name.
      const r = avatar.getBoundingClientRect();
      const lock = document.createElement('div');
      lock.setAttribute('aria-hidden', 'true');
      lock.innerHTML = LOCK_OPEN;
      lock.style.cssText = `position:fixed;z-index:99;left:${r.left + r.width / 2 - 11}px;top:${r.top + r.height / 2 - 11}px;color:hsl(var(--primary));pointer-events:none;opacity:0`;
      document.body.appendChild(lock);
      animations.push(lock.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'scale(1)', offset: 0.3 }, { opacity: 0, transform: 'scale(1.5)' }],
        { duration: 1000, delay: delay - 450, fill: 'forwards' }));
      later(delay + 700, () => lock.remove());
      play(avatar, [{ opacity: 0, transform: 'scale(0.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 500, delay: delay + 200 });
      play(name, [{ opacity: 0, filter: 'blur(8px)', transform: 'translateY(4px)' }, { opacity: 1, filter: 'blur(0)', transform: 'none' }], { duration: 700, delay: delay + 250 });
      const head = document.querySelector('[data-tour="candidate.head"]');
      [...(head?.querySelectorAll('.lucide-phone, .lucide-mail, .lucide-file-text') ?? [])]
        .map((icon) => icon.closest('button')).filter(Boolean)
        .forEach((button, i) => play(button, [{ opacity: 0, transform: 'scale(0.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 400, delay: delay + 650 + i * 120 }));
      // Firmen im Werdegang: kurz hervorgehoben.
      const career = document.querySelector('[data-tour="candidate.career"]');
      const spans = [...(career?.querySelectorAll('span') ?? [])].filter((s) => opts.companies.includes((s.textContent ?? '').trim()));
      spans.forEach((span, i) => play(span, [{ opacity: 0, backgroundColor: 'hsl(var(--primary) / 0.25)' }, { opacity: 1, backgroundColor: 'hsl(var(--primary) / 0.25)', offset: 0.4 }, { opacity: 1, backgroundColor: 'transparent' }],
        { duration: 1400, delay: delay + 1000 + i * 200 }));
      return true;
    }
    const steps = document.querySelector('[data-tour="besetzung.steps"] > div');
    if (!steps) return false;
    [...steps.children].forEach((chip, i) => play(chip, [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: delay + i * 380 }));
    return true;
  };

  // Warten, bis die Seite steht (Daten der Bühne laden in Bruchteilen einer Sekunde).
  let tries = 0;
  const poll = window.setInterval(() => {
    tries += 1;
    if (stopped || start() || tries > 40) window.clearInterval(poll);
  }, 50);
  return () => {
    stopped = true;
    window.clearInterval(poll);
    timers.forEach((id) => window.clearTimeout(id));
    animations.forEach((a) => a.finish());
  };
}
