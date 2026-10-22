import { describe, expect, it } from 'vitest';
import {
  einstellungenAus, freieZeiten, nachTagen, passtZurStelle, pruefeBuchung, steckbrief, steckbriefVerraet, terminText, zeitNochFrei,
} from '../../supabase/functions/_shared/termin-seite';

// Mittwoch, 21.10.2026, 10:00 in Berlin (UTC+2)
const jetzt = Date.parse('2026-10-21T08:00:00Z');
const berlin = (tag: string, hhmm: string) => Date.parse(`2026-10-${tag}T${hhmm}:00+02:00`);
const zeit = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

describe('Freie Zeiten der Terminseite', () => {
  const e = einstellungenAus({ rules: {}, duration_minutes: 15, allow_teams: true, allow_phone: true });
  const outlook = [{ start: berlin('22', '10:00'), end: berlin('22', '11:00') }];
  const gebucht = [{ start: berlin('22', '09:30'), end: berlin('22', '09:45') }];
  const frei = freieZeiten(e, jetzt, outlook, gebucht);
  const tage = nachTagen(frei);

  it('nimmt die Vorschläge für Headhunter, wenn nichts eingestellt ist', () => {
    expect(e.rules.minNoticeHours).toBe(4);
    expect(e.rules.bufferMinutes).toBe(10);
    expect(e.arten).toEqual(['teams', 'phone']);
  });

  it('heute erst ab 4 Stunden Vorlauf', () => {
    expect(tage[0].tag).toBe('2026-10-21');
    expect(zeit(tage[0].zeiten[0])).toBe('14:00');
  });

  it('lässt Outlook-Termine und Buchungen samt 10 Minuten Puffer frei', () => {
    const donnerstag = tage.find(t => t.tag === '2026-10-22')!.zeiten.map(zeit);
    expect(donnerstag.slice(0, 5)).toEqual(['09:00', '11:15', '11:30', '11:45', '14:00']);
    expect(donnerstag).not.toContain('09:30');
    expect(donnerstag).not.toContain('11:00');
  });

  it('kein Wochenende, Freitag nur vormittags', () => {
    expect(tage.map(t => t.tag)).not.toContain('2026-10-24');
    const freitag = tage.find(t => t.tag === '2026-10-23')!.zeiten.map(zeit);
    expect(freitag[freitag.length - 1]).toBe('11:45');
  });

  it('zeigt ohne sichtbaren Kalender keine Zeiten und prüft vor dem Buchen nach', () => {
    expect(freieZeiten(e, jetzt, null, [])).toEqual([]);
    expect(zeitNochFrei(e, jetzt, outlook, gebucht, new Date(berlin('22', '11:15')).toISOString())).toBe(true);
    expect(zeitNochFrei(e, jetzt, outlook, gebucht, new Date(berlin('22', '09:30')).toISOString())).toBe(false);
  });
});

describe('Buchungsangaben', () => {
  const e = einstellungenAus({ rules: {}, duration_minutes: 15, allow_teams: true, allow_phone: true });
  const gut = { start: '2026-10-22T07:30:00Z', mode: 'teams', first_name: ' Anna ', last_name: 'Beispiel', email: 'Anna@Example.de', consent: true };

  it('übernimmt saubere Angaben und normalisiert LinkedIn', () => {
    const r = pruefeBuchung({ ...gut, linkedin_url: 'linkedin.com/in/anna-beispiel' }, e);
    expect(r).toMatchObject({ ok: true, buchung: { first_name: 'Anna', email: 'anna@example.de', linkedin_url: 'https://www.linkedin.com/in/anna-beispiel', mode: 'teams' } });
  });

  it('verlangt Telefon nur beim Telefonat, Zustimmung immer', () => {
    expect(pruefeBuchung({ ...gut, mode: 'phone' }, e)).toMatchObject({ ok: false, feld: 'phone' });
    expect(pruefeBuchung({ ...gut, mode: 'phone', phone: '+49 170 1234567' }, e).ok).toBe(true);
    expect(pruefeBuchung({ ...gut, consent: false }, e)).toMatchObject({ ok: false, feld: 'consent' });
  });

  it('weist Gesprächsarten ab, die der Headhunter nicht anbietet, und fängt Bots', () => {
    const nurTeams = einstellungenAus({ rules: {}, allow_teams: true, allow_phone: false });
    expect(pruefeBuchung({ ...gut, mode: 'phone', phone: '+49 170 1234567' }, nurTeams)).toMatchObject({ ok: false, feld: 'mode' });
    expect(pruefeBuchung({ ...gut, website: 'http://spam' }, e)).toMatchObject({ ok: false, bot: true });
  });
});

describe('Steckbrief der Stelle', () => {
  const job = {
    id: 'd047f5db-3cf5-4e84-bae9-e316582b0d95', title: 'Tax Manager (m/w/d) – Konzernsteuern', company_name: 'Bluewater & Bridge GmbH',
    location: 'Frankfurt am Main', remote_type: 'hybrid', onsite_days_required: 3, employment_type: 'full-time', experience_level: 'senior',
    contract_limitation: 'Unbefristet', salary_min: 80000, salary_max: 95000, salary_months: 13, company_headcount: 900,
    position_advantages: ['Steuerberaterexamen komplett bezahlt inkl. 3 Monate Freistellung · Perspektive Head of Tax bei Bluewater in drei Jahren'],
    benefits: ['30 Urlaubstage', 'Deutschlandticket'], must_have_criteria: ['Ertragsteuern', 'Umsatzsteuer'],
  };

  it('zeigt die Stelle anonym und ohne Firmennamen', () => {
    const s = steckbrief(job, true);
    expect(s).toMatchObject({ region: 'Rhein-Main', gehalt: '80.000 – 95.000 € × 13', fakten: ['3 Tage vor Ort', 'Vollzeit', 'Senior', 'unbefristet'], muss: ['Ertragsteuern', 'Umsatzsteuer'] });
    expect(s.vorteile[1]).toBe('Perspektive Head of Tax in drei Jahren');
    expect(steckbriefVerraet(s, job)).toEqual([]);
    expect(steckbrief(job, false).gehalt).toBeNull();
  });

  it('erkennt die Stelle am Link und schreibt Zeiten deutsch', () => {
    expect(passtZurStelle(job.id, 'tax-manager-d047f5')).toBe(true);
    expect(passtZurStelle(job.id, 'tax-manager-ffffff')).toBe(false);
    expect(terminText('2026-10-22T07:30:00Z')).toBe('Do 22.10., 9:30');
  });
});
