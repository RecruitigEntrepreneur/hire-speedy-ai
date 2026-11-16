import { describe, expect, it } from 'vitest';
import { needsSignatureCheck, RETURN_CHECKS_MS, signatureReturnView, signedLine } from './recruiterSignatureReturn';

describe('Headhunter kommt aus DocuSign zurück', () => {
  const open = { state: 'sent', signedAt: null, late: false };

  it('zeigt nach „Fertigstellen“ erst „wird bestätigt“, nach allen Nachfragen „dauert länger“', () => {
    expect(signatureReturnView({ ...open, event: 'signing_complete' })).toBe('checking');
    expect(signatureReturnView({ ...open, event: 'signing_complete', late: true })).toBe('late');
  });

  it('bietet Unterschreiben nur an, wenn wirklich nicht unterschrieben wurde', () => {
    for (const event of ['cancel', 'ttl_expired', 'session_timeout', 'exception']) {
      expect(signatureReturnView({ ...open, event })).toBe('cancelled');
    }
    expect(signatureReturnView({ ...open, event: 'decline' })).toBe('declined');
  });

  it('fragt nach „nur angesehen“ erst nach und bietet Unterschreiben erst danach an', () => {
    expect(signatureReturnView({ ...open, event: 'viewing_complete' })).toBe('checking');
    expect(signatureReturnView({ ...open, event: 'viewing_complete', late: true })).toBe('cancelled');
    expect(signatureReturnView({ ...open, event: 'viewing_complete', signedAt: '2026-09-25T12:12:00Z' })).toBeNull();
    expect(needsSignatureCheck('viewing_complete')).toBe(true);
    expect(needsSignatureCheck('cancel')).toBe(false);
  });

  it('fällt auf die normale Ansicht zurück, sobald der Server die Unterschrift kennt oder nichts zurückkam', () => {
    expect(signatureReturnView({ ...open, event: 'signing_complete', signedAt: '2026-09-25T12:12:00Z' })).toBeNull();
    expect(signatureReturnView({ ...open, event: 'signing_complete', state: 'completed' })).toBeNull();
    expect(signatureReturnView({ ...open, event: 'signing_complete', state: undefined })).toBeNull();
    expect(signatureReturnView({ ...open, event: '' })).toBeNull();
  });

  it('fragt sofort und dann in kurzen Abständen nach, höchstens zwei Minuten lang, nie öfter als alle 3 Sekunden', () => {
    expect(RETURN_CHECKS_MS[0]).toBe(0);
    expect(RETURN_CHECKS_MS.at(-1)).toBe(120_000);
    RETURN_CHECKS_MS.slice(1).forEach((ms, i) => expect(ms - RETURN_CHECKS_MS[i]).toBeGreaterThanOrEqual(3_000));
  });

  it('nennt Zeitpunkt in deutscher Zeit und die Firma', () => {
    expect(signedLine('2026-09-25T12:12:00Z', 'Greeners GmbH')).toBe('Unterschrieben am 25.09.2026 um 14:12 Uhr · Greeners GmbH');
    expect(signedLine('2026-09-25T12:12:00Z', ' ')).toBe('Unterschrieben am 25.09.2026 um 14:12 Uhr');
  });
});
