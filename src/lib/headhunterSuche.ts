/**
 * Suche des Headhunters (16.11.2026): eigene Kandidaten nach Name, Telefonnummer, E-Mail,
 * Position, Firma und Ort; offene Stellen nach Titel, Ort und (wenn freigegeben) Firma.
 * Gefiltert wird im Browser, damit auch „0171 234“ eine „+49 171 2345678“ findet.
 */

export interface SuchKandidat {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
  city: string | null;
}

export interface SuchStelle {
  id: string;
  title: string | null;
  location: string | null;
  company_name: string | null;
  company_revealed: boolean | null;
}

/** Kleinbuchstaben, ohne Akzente; ß wird ss. „Müller“ findet „Muller“ und umgekehrt. */
export function normal(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Nur Ziffern; „+49 171 / 234“ wird „49171234“. */
export function ziffern(s: string): string {
  return s.replace(/\D/g, '');
}

/** Sieht die Eingabe wie eine Telefonnummer aus (mind. 3 Ziffern, sonst nur Zeichen wie + / ( ) - Leerzeichen)? */
export function istNummer(q: string): boolean {
  return /^[\d\s+/().-]+$/.test(q.trim()) && ziffern(q).length >= 3;
}

/** Passt die Telefonnummer? Führende 0 darf fehlen: „0171…“ findet „+49 171…“. */
export function nummerPasst(phone: string | null, q: string): boolean {
  if (!phone) return false;
  const p = ziffern(phone);
  const d = ziffern(q);
  if (!d) return false;
  return p.includes(d) || (d.startsWith('0') && d.length >= 4 && p.includes(d.slice(1)));
}

/** Alle Wörter der Eingabe müssen irgendwo in den Feldern vorkommen. */
export function woerterPassen(felder: (string | null | undefined)[], q: string): boolean {
  const heu = normal(felder.filter(Boolean).join(' '));
  return normal(q).split(/\s+/).filter(Boolean).every((w) => heu.includes(w));
}

/** Kandidaten: Namenstreffer zuerst (Anfang vor Mitte), dann alles andere. */
export function sucheKandidaten(liste: SuchKandidat[], q: string, max = 6): SuchKandidat[] {
  const t = q.trim();
  if (!t) return [];
  const nummer = istNummer(t);
  const n = normal(t);
  const treffer = liste.filter((k) =>
    nummer
      ? nummerPasst(k.phone, t)
      : woerterPassen([k.full_name, k.email, k.job_title, k.company, k.city], t),
  );
  // Ganzes Wort vor Wortanfang vor Teil des Namens vor Treffern in anderen Feldern („Paul“ vor „Paula“).
  const rang = (k: SuchKandidat) => {
    const name = normal(k.full_name);
    const woerter = name.split(/\s+/);
    if (woerter.includes(n)) return 0;
    if (woerter.some((w) => w.startsWith(n))) return 1;
    if (name.includes(n)) return 2;
    return 3;
  };
  return treffer.sort((a, b) => rang(a) - rang(b)).slice(0, max);
}

/** Stellen: Titel, Ort; die Firma nur, wenn sie für den Headhunter freigegeben ist. */
export function sucheStellen(liste: SuchStelle[], q: string, max = 5): SuchStelle[] {
  const t = q.trim();
  if (!t || istNummer(t)) return [];
  return liste
    .filter((s) => woerterPassen([s.title, s.location, s.company_revealed ? s.company_name : null], t))
    .slice(0, max);
}
