import { describe, expect, it } from 'vitest';
import { accessState, type IntakeAccess } from './clientAccessState';

const base: IntakeAccess = {
  account: { user_id: 'u', email: 'luca@kanna.test', roles: ['client'], created_at: null, last_sign_in_at: null, password_set_at: null },
  mail: { created_at: '2026-09-25T12:29:03Z', status: 'sent', error_message: null, to_email: 'luca@kanna.test' },
  countersigned: true, signature_required: true, accepted: true,
};

describe('Zugang des Kunden', () => {
  it('hält bei einem Headhunter-Konto an, egal wie weit der Vertrag ist', () => {
    expect(accessState({ ...base, account: { ...base.account!, roles: ['recruiter'] } })).toBe('held');
    expect(accessState({ ...base, countersigned: false, account: { ...base.account!, roles: ['recruiter'] } })).toBe('held');
  });

  it('wartet auf die Gegenzeichnung, auch wenn schon angenommen ist', () => {
    expect(accessState({ ...base, countersigned: false, mail: null })).toBe('waiting_contract');
    expect(accessState({ ...base, countersigned: false, signature_required: false, mail: null })).toBe('missing');
  });

  it('zeigt gescheiterte Annahme, fehlende und gescheiterte Mail', () => {
    expect(accessState({ ...base, accepted: false, mail: null, account: null })).toBe('waiting_accept');
    expect(accessState({ ...base, mail: null })).toBe('missing');
    expect(accessState({ ...base, mail: { ...base.mail!, status: 'failed' } })).toBe('failed');
    expect(accessState(base)).toBe('sent');
  });
});
