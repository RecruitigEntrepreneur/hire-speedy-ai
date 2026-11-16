/**
 * Fenster „Das haben wir auf LinkedIn gefunden“ (Profil › Über dich, 16.11.2026).
 *
 * Regel: ergänzen statt überschreiben. Leere Felder sind vorausgewählt; was der
 * Headhunter schon eingetragen hat, ändert sich nur, wenn er es ankreuzt.
 * Sprachen und Bereiche landen in den Schwerpunkte (nichts doppelt in Über dich).
 */
import { cleanExpertise, EXPERIENCE_BANDS, EXPERTISE_AREAS, type RecruiterExpertise } from '../../supabase/functions/_shared/recruiter-expertise';
import i18n from '@/i18n';
import type { LinkedinAbgleich } from './terminApi';

export interface Aktuell { name: string; position: string; jahre: number | null; hatFoto: boolean; fotoVonLinkedin?: boolean; expertise: RecruiterExpertise }
export type ZeilenArt = 'foto' | 'name' | 'position' | 'erfahrung' | 'sprachen' | 'schwerpunkte';
export interface AbgleichZeile { art: ZeilenArt; titel: string; neu: string; bisher: string | null; hinweis?: string; vorausgewaehlt: boolean }

const gleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const ohne = (liste: string[], vorhanden: string[]) => liste.filter((x) => !vorhanden.includes(x));

// Zeilentexte beim Aufruf übersetzt (Namespace recruiterTermin, linkedin.abgleich.zeilen).
const tx = (key: string, o?: Record<string, unknown>) => i18n.t(`recruiterTermin:linkedin.abgleich.zeilen.${key}`, o);
/** Katalogwerte (Sprachen, Bereiche, Erfahrungsband) bleiben Daten; angezeigt wird die Übersetzung aus recruiterFunnel.options. */
function anzeige(wert: string): string {
  const m = i18n.t('recruiterFunnel:options', { returnObjects: true }) as unknown;
  return (m && typeof m === 'object' ? (m as Record<string, string>)[wert] : undefined) ?? wert;
}
const alsListe = (werte: string[]) => werte.map(anzeige).join(', ');

/** Jahre → Band aus „Erfahrung als Headhunter“. */
export function bandFuer(jahre: number): string {
  if (jahre < 2) return EXPERIENCE_BANDS[0];
  if (jahre < 5) return EXPERIENCE_BANDS[1];
  if (jahre <= 10) return EXPERIENCE_BANDS[2];
  return EXPERIENCE_BANDS[3];
}

/** Neue Bereiche und Unterpunkte, die der Headhunter noch nicht hat. */
function neueSchwerpunkte(a: LinkedinAbgleich, x: RecruiterExpertise) {
  const v = a.vorschlag;
  if (!v) return { bereiche: [] as string[], unter: [] as string[] };
  return { bereiche: ohne(v.bereiche, x.areas), unter: ohne(v.unterbereiche, x.subareas) };
}

export function abgleichZeilen(a: LinkedinAbgleich, akt: Aktuell): AbgleichZeile[] {
  const z: AbgleichZeile[] = [];
  const v = a.vorschlag;
  // Ein schon übernommenes LinkedIn-Foto bieten wir nicht noch einmal an.
  if (a.bild && !akt.fotoVonLinkedin) z.push({ art: 'foto', titel: tx('foto'), neu: tx('photoNew'), bisher: akt.hatFoto ? tx('photoBefore') : null, vorausgewaehlt: !akt.hatFoto });
  if (a.name && !akt.name.trim()) z.push({ art: 'name', titel: tx('name'), neu: a.name, bisher: null, vorausgewaehlt: true });
  if (v?.position && !gleich(v.position, akt.position)) {
    z.push({ art: 'position', titel: tx('position'), neu: v.position, bisher: akt.position.trim() || null, vorausgewaehlt: !akt.position.trim() });
  }
  if (v?.erfahrungJahre != null && v.erfahrungJahre !== akt.jahre) {
    z.push({
      art: 'erfahrung', titel: tx('erfahrung'), neu: tx('years', { count: v.erfahrungJahre }),
      bisher: akt.jahre != null ? tx('yearsShort', { count: akt.jahre }) : akt.expertise.experience ? anzeige(akt.expertise.experience) : null,
      hinweis: tx('fromCareer'), vorausgewaehlt: akt.jahre == null,
    });
  }
  const sprachen = v ? ohne(v.sprachen, akt.expertise.languages) : [];
  if (sprachen.length) {
    z.push({
      art: 'sprachen', titel: tx('sprachen'), neu: alsListe(sprachen), bisher: alsListe(akt.expertise.languages) || null,
      hinweis: tx('toFocus'), vorausgewaehlt: !akt.expertise.languages.length,
    });
  }
  const s = neueSchwerpunkte(a, akt.expertise);
  if (s.bereiche.length || s.unter.length) {
    // Nur das Neue, je Bereich gebündelt: „Healthcare & Pharma: Medizintechnik“.
    const neu = EXPERTISE_AREAS
      .filter((b) => s.bereiche.includes(b.label) || b.sub.some((u) => s.unter.includes(u)))
      .map((b) => { const u = b.sub.filter((x) => s.unter.includes(x)); return u.length ? `${anzeige(b.label)}: ${alsListe(u)}` : anzeige(b.label); });
    z.push({
      art: 'schwerpunkte', titel: tx('schwerpunkte'), neu: neu.join(' · '),
      bisher: alsListe(akt.expertise.areas) || null,
      hinweis: tx('toFocusSuggestion'), vorausgewaehlt: !akt.expertise.areas.length,
    });
  }
  return z;
}

export interface Uebernahme {
  foto: boolean;
  profil: { full_name?: string; role_title?: string; years_experience?: number };
  expertise: RecruiterExpertise | null;
}

/** Was nach den Häkchen gespeichert wird. Listen werden nur ergänzt, nie gekürzt. */
export function uebernahme(gewaehlt: ReadonlySet<ZeilenArt>, a: LinkedinAbgleich, akt: Aktuell): Uebernahme {
  const v = a.vorschlag;
  const profil: Uebernahme['profil'] = {};
  if (gewaehlt.has('name') && a.name) profil.full_name = a.name.trim();
  if (gewaehlt.has('position') && v?.position) profil.role_title = v.position;
  let x = akt.expertise;
  let geaendert = false;
  if (gewaehlt.has('erfahrung') && v?.erfahrungJahre != null) {
    profil.years_experience = v.erfahrungJahre;
    if (!x.experience) { x = { ...x, experience: bandFuer(v.erfahrungJahre) }; geaendert = true; }
  }
  if (gewaehlt.has('sprachen') && v) {
    const neu = ohne(v.sprachen, x.languages);
    if (neu.length) { x = { ...x, languages: [...x.languages, ...neu] }; geaendert = true; }
  }
  if (gewaehlt.has('schwerpunkte') && v) {
    const areas = [...x.areas, ...ohne(v.bereiche, x.areas)];
    const erlaubt = new Set(EXPERTISE_AREAS.filter((b) => areas.includes(b.label)).flatMap((b) => b.sub));
    const subareas = [...x.subareas, ...ohne(v.unterbereiche, x.subareas).filter((s) => erlaubt.has(s))];
    if (areas.length !== x.areas.length || subareas.length !== x.subareas.length) { x = { ...x, areas, subareas }; geaendert = true; }
  }
  return { foto: gewaehlt.has('foto') && !!a.bild, profil, expertise: geaendert ? cleanExpertise(x) : null };
}
