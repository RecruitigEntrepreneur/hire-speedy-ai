import { describe, expect, it } from 'vitest';
import { clientStartDone, clientStartSteps, currentFramework } from './clientStart';

const lucaHeute = {
  framework: { agreement_number: 'RV-2026-001002', status: 'active', countersigned_at: '2026-09-25T12:17:23Z' },
  jobs: [{ title: 'Arzt / Ärztin für Cannabinoidmedizin', status: 'pending_approval' }],
  missingCompany: ['Straße', 'PLZ'],
  tourDone: false,
};

describe('Ihr Start bei Matchunt', () => {
  it('zeigt Lucas echten Stand statt „AGB akzeptieren“', () => {
    const steps = clientStartSteps(lucaHeute);
    expect(steps.map(s => [s.id, s.state])).toEqual([['contract', 'done'], ['position', 'waiting'], ['company', 'open'], ['tour', 'open']]);
    expect(steps[0].detail).toBe('Rahmenvertrag RV-2026-001002 beidseitig unterzeichnet am 25.09.2026');
    expect(steps[1].detail).toContain('wird von Matchunt geprüft');
    expect(steps[2].detail).toBe('Es fehlt: Straße, PLZ');
    expect(clientStartDone(steps)).toBe(1);
  });

  it('ohne Vertrag und ohne Stelle: der Weg führt über die erste Position', () => {
    const steps = clientStartSteps({ framework: null, jobs: [], missingCompany: [], tourDone: true });
    expect(steps[0]).toMatchObject({ state: 'open', detail: 'Der Rahmenvertrag entsteht mit Ihrer ersten Position.' });
    expect(steps[1]).toMatchObject({ state: 'open', action: 'Position aufnehmen' });
    expect(clientStartDone(steps)).toBe(2);
  });

  it('alles erledigt, sobald eine Stelle live ist', () => {
    const steps = clientStartSteps({ ...lucaHeute, jobs: [{ title: 'A', status: 'pending_approval' }, { title: 'B', status: 'published' }], missingCompany: [], tourDone: true });
    expect(clientStartDone(steps)).toBe(4);
    expect(steps[1].detail).toBe('B ist für unsere Recruiter freigegeben');
  });

  it('Vertragsstände: Gegenzeichnung offen, Unterschrift offen, in Vorbereitung', () => {
    const mit = (status: string) => clientStartSteps({ ...lucaHeute, framework: { agreement_number: 'RV-1', status, countersigned_at: null } })[0];
    expect(mit('customer_signed').state).toBe('waiting');
    expect(mit('sent')).toMatchObject({ state: 'open', detail: 'Der Rahmenvertrag wartet auf Ihre Unterschrift in DocuSign.' });
    expect(mit('draft').state).toBe('waiting');
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
});
