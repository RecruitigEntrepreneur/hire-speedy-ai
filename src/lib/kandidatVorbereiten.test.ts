import { describe, expect, it } from 'vitest';
import {
  betroffeneKandidaten, istGleichDran, leiteVorbereitungAb, vorbereitenTexte,
  type VBuchung, type VEingabe, type VEinladung, type VKandidat, type VNotiz,
} from './kandidatVorbereiten';

const JETZT = Date.parse('2026-11-10T12:00:00+01:00');
const DAY = 86_400_000;
const vor = (tage: number) => new Date(JETZT - tage * DAY).toISOString();

const kandidat = (over: Partial<VKandidat> = {}): VKandidat => ({
  id: 'k1', full_name: 'Max Beispiel', phone: '+49 170 1', email: 'max@example.test', job_title: 'Controller', created_at: vor(5), ...over,
});
const eingabe = (over: Partial<VEingabe> = {}): VEingabe => ({
  kandidaten: [kandidat()], einladungen: [], buchungen: [], notizen: [], logs: [], mitEinreichung: new Set(), ...over,
});
const einladung = (over: Partial<VEinladung> = {}): VEinladung => ({
  candidate_id: 'k1', arten: ['teams'], weg: 'mail', created_at: vor(4), sent_at: vor(4), opened_at: null, last_opened_at: null,
  expires_at: new Date(JETZT + 20 * DAY).toISOString(), booked_at: null, revoked_at: null, ...over,
});
const buchung = (startsAt: number, over: Partial<VBuchung> = {}): VBuchung => ({
  candidate_id: 'k1', starts_at: new Date(startsAt).toISOString(), ends_at: new Date(startsAt + 15 * 60_000).toISOString(),
  mode: 'teams', status: 'booked', join_url: 'https://teams.test/x', note: null, ...over,
});
const notiz = (over: Partial<VNotiz> = {}): VNotiz => ({
  candidate_id: 'k1', status: 'draft', updated_at: vor(3), interview_date: vor(3), ...over,
});
const art = (e: VEingabe, now = JETZT) => leiteVorbereitungAb(e, now).map(v => v.art);

describe('Aufgaben vor der Einreichung', () => {
  it('neu angelegt: Aufgabe „Neu“, in den ersten zwei Tagen unter „Diese Woche“', () => {
    expect(leiteVorbereitungAb(eingabe({ kandidaten: [kandidat({ created_at: vor(1) })] }), JETZT)[0]).toMatchObject({ art: 'neu', frisch: true });
    expect(leiteVorbereitungAb(eingabe(), JETZT)[0]).toMatchObject({ art: 'neu', frisch: false });
  });

  it('nach 14 Tagen ohne Schritt fällt „Neu“ heraus', () => {
    expect(art(eingabe({ kandidaten: [kandidat({ created_at: vor(9) })] }))).toEqual(['neu']);
    expect(art(eingabe({ kandidaten: [kandidat({ created_at: vor(15) })] }), JETZT + 2 * DAY)).toEqual([]);
  });

  it('der Lebenslauf-Import ohne Gesprächsdatum zählt nicht als Interview', () => {
    expect(art(eingabe({ notizen: [notiz({ interview_date: null })] }))).toEqual(['neu']);
  });

  it('bestehende Kandidaten vor dem Start bleiben still', () => {
    const alt = kandidat({ created_at: '2026-10-20T10:00:00+02:00' });
    expect(betroffeneKandidaten(eingabe({ kandidaten: [alt] }))).toEqual([]);
    expect(art(eingabe({ kandidaten: [alt], einladungen: [einladung()] }))).toEqual(['eingeladen']);
  });

  it('mit Einreichung gibt es keine dieser Aufgaben', () => {
    expect(art(eingabe({ mitEinreichung: new Set(['k1']) }))).toEqual([]);
  });

  it('ein Termin heute steht auch bei ausgeblendetem Kandidaten da', () => {
    const e = eingabe({ kandidaten: [kandidat({ prep_dismissed_at: vor(1) })], buchungen: [buchung(JETZT + 3 * 3_600_000)] });
    expect(art(e)).toEqual(['termin']);
  });

  it('„Nicht relevant“ blendet alles andere aus', () => {
    expect(art(eingabe({ kandidaten: [kandidat({ prep_dismissed_at: vor(1) })] }))).toEqual([]);
  });

  it('ein Termin rückt erst 30 Minuten vorher nach oben', () => {
    const spaeter = leiteVorbereitungAb(eingabe({ buchungen: [buchung(JETZT + 31 * 60_000)] }), JETZT)[0];
    const gleich = leiteVorbereitungAb(eingabe({ buchungen: [buchung(JETZT + 30 * 60_000)] }), JETZT)[0];
    const laeuft = leiteVorbereitungAb(eingabe({ buchungen: [buchung(JETZT - 5 * 60_000)] }), JETZT)[0];
    expect(istGleichDran(spaeter, JETZT)).toBe(false);
    expect(istGleichDran(gleich, JETZT)).toBe(true);
    expect(istGleichDran(laeuft, JETZT)).toBe(true);
  });

  it('ein künftiger Termin an einem anderen Tag ist keine Aufgabe', () => {
    expect(art(eingabe({ buchungen: [buchung(JETZT + 3 * DAY)] }))).toEqual([]);
  });

  it('abgesagte Buchung zählt nicht', () => {
    expect(art(eingabe({ buchungen: [buchung(JETZT - DAY, { status: 'cancelled' })] }))).toEqual(['neu']);
  });

  it('Termin vorbei ohne Notizen: „Gespräch war“', () => {
    const v = leiteVorbereitungAb(eingabe({ buchungen: [buchung(JETZT - DAY)] }), JETZT)[0];
    expect(v.art).toBe('war');
    expect(vorbereitenTexte(v, JETZT).text).toContain('gestern');
    expect(vorbereitenTexte(v, JETZT).text).toContain('solange es frisch ist');
    const alt = leiteVorbereitungAb(eingabe({ buchungen: [buchung(JETZT - 5 * DAY)] }), JETZT)[0];
    expect(vorbereitenTexte(alt, JETZT).text).not.toContain('frisch');
  });

  it('„Nicht erschienen“ schließt den Termin, der Kandidat fällt zurück auf „Neu“', () => {
    const logs = [{ candidate_id: 'k1', activity_type: 'note', created_at: vor(0), metadata: { kind: 'no_show' } }];
    expect(art(eingabe({ buchungen: [buchung(JETZT - DAY)], logs }))).toEqual(['neu']);
  });

  it('frischer Entwurf ruht, nach zwei Tagen wird er zur Aufgabe', () => {
    expect(art(eingabe({ notizen: [notiz({ updated_at: vor(1) })] }))).toEqual([]);
    expect(art(eingabe({ notizen: [notiz({ updated_at: vor(2) })] }))).toEqual(['entwurf']);
  });

  it('Entwurf nach einem Termin ist sofort dran, vor einem Termin nicht', () => {
    expect(art(eingabe({ notizen: [notiz({ updated_at: vor(0) })], buchungen: [buchung(JETZT - DAY)] }))).toEqual(['entwurf']);
    expect(art(eingabe({ notizen: [notiz()], buchungen: [buchung(JETZT + 2 * DAY)] }))).toEqual([]);
  });

  it('Entwurf nennt, was fehlt', () => {
    const luecken = new Map([['k1', ['Wunschgehalt', 'Verfügbarkeit', 'Wohnort', 'Sprachen', 'Arbeitsmodell']]]);
    const v = leiteVorbereitungAb(eingabe({ notizen: [notiz()], luecken }), JETZT)[0];
    expect(vorbereitenTexte(v, JETZT).text).toBe('Seit 3 Tagen offen. Es fehlen Wunschgehalt, Verfügbarkeit und 3 weitere.');
    expect(vorbereitenTexte(v, JETZT).kurz).toBe('Es fehlen Wunschgehalt und 4 weitere');
  });

  it('abgeschlossen und vollständig: „Bereit“, mit Anzahl passender Stellen', () => {
    const v = leiteVorbereitungAb(eingabe({ notizen: [notiz({ status: 'completed' })], stellen: new Map([['k1', 3]]) }), JETZT)[0];
    expect(v.art).toBe('bereit');
    expect(vorbereitenTexte(v, JETZT).text).toContain('3 Stellen passen');
    expect(vorbereitenTexte({ ...v, stellen: 0 }, JETZT).text).toBe('Interview fertig, noch nirgends eingereicht.');
  });

  it('abgeschlossen, aber mit Lücken: bleibt Entwurf, weil Einreichen sonst scheitert', () => {
    expect(art(eingabe({ notizen: [notiz({ status: 'completed' })], luecken: new Map([['k1', ['Wohnort']]]) }))).toEqual(['entwurf']);
  });

  describe('eingeladen, kein Termin', () => {
    it('erst nach drei Tagen', () => {
      expect(art(eingabe({ einladungen: [einladung({ created_at: vor(2), sent_at: vor(2) })] }))).toEqual([]);
      expect(art(eingabe({ einladungen: [einladung({ created_at: vor(3), sent_at: vor(3) })] }))).toEqual(['eingeladen']);
    });

    it('Link geöffnet steht im Satz', () => {
      const v = leiteVorbereitungAb(eingabe({ einladungen: [einladung({ last_opened_at: vor(1) })] }), JETZT)[0];
      expect(vorbereitenTexte(v, JETZT).text).toBe('Seit 4 Tagen eingeladen, Link geöffnet, noch kein Termin. Ruf kurz an.');
    });

    it('zurückgezogen, abgelaufen oder gebucht zählt nicht als offen', () => {
      expect(art(eingabe({ einladungen: [einladung({ revoked_at: vor(1) })] }))).toEqual(['neu']);
      expect(art(eingabe({ einladungen: [einladung({ expires_at: vor(1) })] }))).toEqual(['neu']);
      expect(art(eingabe({ einladungen: [einladung({ booked_at: vor(1) })] }))).toEqual(['neu']);
    });

    it('„Bucht selbst“ am Telefon gibt drei Tage Ruhe', () => {
      const logs = [{ candidate_id: 'k1', activity_type: 'call', created_at: vor(1), metadata: { reached: true } }];
      expect(art(eingabe({ einladungen: [einladung()], logs }))).toEqual([]);
    });

    it('„Nicht erreicht“ kommt am nächsten Tag wieder', () => {
      const logs = [{ candidate_id: 'k1', activity_type: 'call', created_at: vor(0.5), metadata: { reached: false } }];
      expect(art(eingabe({ einladungen: [einladung()], logs }))).toEqual([]);
      expect(art(eingabe({ einladungen: [einladung()], logs }), JETZT + DAY)).toEqual(['eingeladen']);
    });

    it('„Termin ausgemacht“ macht aus der Einladung einen Termin', () => {
      const am = new Date(JETZT + 2 * 3_600_000).toISOString();
      const logs = [{ candidate_id: 'k1', activity_type: 'call', created_at: vor(0), metadata: { reached: true, termin_at: am } }];
      const e = eingabe({ einladungen: [einladung()], logs });
      expect(leiteVorbereitungAb(e, JETZT)[0]).toMatchObject({ art: 'termin', termin: { mode: 'phone', selbstGebucht: false } });
      expect(art(e, JETZT + DAY)).toEqual(['war']);
    });
  });
});
