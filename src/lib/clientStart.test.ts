import { describe, expect, it } from 'vitest';
import { clientStartDone, clientStartSteps, currentFramework, clientHasPosition, clientIsWaiting, clientPathClosedDuringTour, clientPathOpenWhileWaiting } from './clientStart';

const lucaHeute = {
  framework: { agreement_number: 'RV-2026-001002', status: 'active', countersigned_at: '2026-09-25T12:17:23Z' },
  jobs: [{ title: 'Arzt / Ärztin für Cannabinoidmedizin', status: 'pending_approval' }],
  missingCompany: ['Straße', 'PLZ'],
  calendar: 'not_connected' as const,
  tourDone: false,
};

describe('Ihr Start bei Matchunt', () => {
  it('zeigt Lucas echten Stand statt „AGB akzeptieren“', () => {
    const steps = clientStartSteps(lucaHeute);
    expect(steps.map(s => [s.id, s.state])).toEqual([['contract', 'done'], ['position', 'waiting'], ['company', 'open'], ['calendar', 'open'], ['tour', 'open']]);
    expect(steps[0].detail).toBe('Rahmenvertrag RV-2026-001002 beidseitig unterzeichnet am 25.09.2026');
    expect(steps[1].detail).toContain('wird von Matchunt geprüft');
    expect(steps[2].detail).toBe('Es fehlt: Straße, PLZ');
    expect(clientStartDone(steps)).toBe(1);
  });

  it('ohne Vertrag und ohne Stelle: der Weg führt über die erste Stelle', () => {
    const steps = clientStartSteps({ framework: null, jobs: [], missingCompany: [], calendar: null, tourDone: true });
    expect(steps[0]).toMatchObject({ state: 'open', detail: 'Der Rahmenvertrag entsteht mit Ihrer ersten Stelle.' });
    expect(steps[1]).toMatchObject({ state: 'open', action: 'Stelle aufnehmen' });
    expect(clientStartDone(steps)).toBe(2);
  });

  it('alles erledigt, sobald eine Stelle live ist', () => {
    const steps = clientStartSteps({ ...lucaHeute, jobs: [{ title: 'A', status: 'pending_approval' }, { title: 'B', status: 'published' }], missingCompany: [], calendar: 'connected', tourDone: true });
    expect(clientStartDone(steps)).toBe(5);
    expect(clientStartDone(steps)).toBe(steps.length);
    expect(steps[1].detail).toBe('B ist für unsere Recruiter freigegeben');
  });

  it('Vertragsstände: Gegenzeichnung offen, Unterschrift offen, in Vorbereitung', () => {
    const mit = (status: string) => clientStartSteps({ ...lucaHeute, framework: { agreement_number: 'RV-1', status, countersigned_at: null } })[0];
    expect(mit('customer_signed').state).toBe('waiting');
    expect(mit('sent')).toMatchObject({ state: 'open', detail: 'Der Rahmenvertrag wartet auf Ihre Unterschrift in DocuSign.' });
    expect(mit('draft').state).toBe('waiting');
  });

  it('Kalender: verbunden, wartet auf die IT, abgelaufen, unbekannt', () => {
    const kalender = (calendar: Parameters<typeof clientStartSteps>[0]['calendar']) =>
      clientStartSteps({ ...lucaHeute, calendar }).find(s => s.id === 'calendar')!;
    expect(kalender('connected')).toMatchObject({ state: 'done', detail: 'Outlook ist verbunden' });
    expect(kalender('connected').action).toBeUndefined();
    expect(kalender('it_pending')).toMatchObject({ state: 'waiting', detail: 'Wartet auf Ihre IT' });
    expect(kalender('not_connected')).toMatchObject({ state: 'open', detail: 'Damit Kandidaten nur freie Zeiten sehen', action: 'Verbinden' });
    expect(kalender('expired')).toMatchObject({ state: 'open', action: 'Neu verbinden' });
    // null = Stand unbekannt (Laden fehlgeschlagen) -> als offen behandeln
    expect(kalender(null)).toMatchObject({ state: 'open', detail: 'Damit Kandidaten nur freie Zeiten sehen' });
    // Liegt bei Matchunt: kein Knopf, der in eine Sackgasse führt
    expect(clientStartSteps({ ...lucaHeute, calendar: 'not_configured' }).map(s => s.id)).toEqual(['contract', 'position', 'company', 'tour']);
  });

  it('der Kalender-Schritt steht nach den Firmendaten', () => {
    expect(clientStartSteps(lucaHeute).map(s => s.id)).toEqual(['contract', 'position', 'company', 'calendar', 'tour']);
  });

  it('wählt den wirksamen Rahmenvertrag vor älteren oder abgelehnten', () => {
    const rows = [
      { agreement_number: 'alt', status: 'declined', countersigned_at: null },
      { agreement_number: 'offen', status: 'sent', countersigned_at: null },
      { agreement_number: 'gilt', status: 'active', countersigned_at: '2026-09-25T12:00:00Z' },
    ];
    expect(currentFramework(rows)?.agreement_number).toBe('gilt');
    expect(currentFramework([rows[0]])).toBeNull();
  });

  describe('Wartezustand', () => {
    const rv = (status: string) => ({ agreement_number: 'RV-1', status, countersigned_at: null });
    const base = { jobs: [], missingCompany: [], calendar: 'connected' as const, tourDone: false };
    const waiting = { title: 'Servicetechniker', signerEmail: 'k@firma.test', self: true, closed: false };

    it('wartet nur ohne wirksamen Vertrag und ohne Stelle, bestehende Kunden nie', () => {
      expect(clientIsWaiting([rv('customer_signed')], 0)).toBe(true);
      expect(clientIsWaiting([rv('sent')], 0)).toBe(true);
      expect(clientIsWaiting([rv('customer_signed')], 1)).toBe(false);
      expect(clientIsWaiting([rv('active'), rv('sent')], 0)).toBe(false);
      expect(clientIsWaiting([rv('declined')], 0)).toBe(false);
      expect(clientIsWaiting([], 0)).toBe(false);
    });

    it('kennt bereits aufgenommene Positionen für den Rundgang', () => {
      expect(clientHasPosition([], 0)).toBe(false);
      expect(clientHasPosition([], 2)).toBe(true);
      expect(clientHasPosition([rv('sent')], 0)).toBe(true);
    });

    it('lässt Start, Vertrag, Passwort und Firmendaten offen und die Aufnahme immer zu', () => {
      for (const p of ['/dashboard', '/dashboard/settings', '/dashboard/vertrag-unterschreiben', '/dashboard/privacy']) expect(clientPathOpenWhileWaiting(p)).toBe(true);
      for (const p of ['/dashboard/jobs', '/dashboard/candidates', '/dashboard/team', '/dashboard/aufnahme']) expect(clientPathOpenWhileWaiting(p)).toBe(false);
      expect(clientPathClosedDuringTour('/dashboard/aufnahme/abc')).toBe(true);
      expect(clientPathClosedDuringTour('/dashboard/jobs')).toBe(false);
    });

    it('zeigt Unterschrift, Position, Firmendaten, Passwort und Rundgang, ohne Kalender', () => {
      const steps = clientStartSteps({ ...base, framework: rv('customer_signed'), waiting });
      expect(steps.map(s => s.id)).toEqual(['contract', 'position', 'company', 'password', 'tour']);
      expect(steps[0]).toMatchObject({ state: 'waiting', detail: 'Ihre Unterschrift liegt vor. Matchunt zeichnet gegen.' });
      expect(steps[1]).toMatchObject({ state: 'waiting', detail: 'Servicetechniker wartet auf die Gegenzeichnung' });
      expect(steps[1].action).toBeUndefined();
      expect(clientStartSteps({ ...base, framework: rv('customer_signed'), waiting, passwordSet: true })[3]).toMatchObject({ state: 'done' });
    });

    it('führt zur Unterschrift oder nennt die Person, bei der der Vertrag liegt', () => {
      expect(clientStartSteps({ ...base, framework: rv('sent'), waiting })[0]).toMatchObject({ state: 'open', action: 'Jetzt unterschreiben' });
      const anders = clientStartSteps({ ...base, framework: rv('sent'), waiting: { ...waiting, self: false } })[0];
      expect(anders.state).toBe('waiting');
      expect(anders.detail).toContain('k@firma.test');
      expect(anders.action).toBeUndefined();
    });

    it('sagt ehrlich, wenn kein Vertrag zustande kam', () => {
      const steps = clientStartSteps({ ...base, framework: rv('sent'), waiting: { ...waiting, closed: true } });
      expect(steps[0].detail).toContain('kein Vertrag zustande');
      expect(steps.map(s => s.id)).toContain('calendar');
    });
  });
});
