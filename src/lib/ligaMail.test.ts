import { describe, expect, it, vi } from 'vitest';
import { sendAwards, sendWeekly } from '../../supabase/functions/_shared/liga-mail';
import { awardMailContent } from '../../supabase/functions/_shared/liga';

const weeklyRow = {
  recruiter_id: 'r1', email: 'hh@x.de', full_name: 'Julia Hartmann', season_label: 'Q4 2026', days_left: 42,
  rank: 2, participants: 12, points: 30, previous_rank: 3, gap_above: 5, top_n: 10, next_hold: null, hold_points: 10,
};

function weeklyDb(rows: unknown[]) {
  const rpc = vi.fn(async () => ({ data: rows, error: null }));
  return { db: { rpc } as never, rpc };
}

describe('Liga-Mails', () => {
  it('Vorschau sendet nichts und merkt keinen Wochenstand', async () => {
    const { db, rpc } = weeklyDb([weeklyRow]);
    const mail = vi.fn();
    const r = await sendWeekly(db, { dryRun: true, mail: mail as never });
    expect(rpc).toHaveBeenCalledWith('liga_weekly_rows', { p_dry_run: true });
    expect(mail).not.toHaveBeenCalled();
    expect(r.preview).toEqual([{ to: 'hh@x.de', subject: 'Matchunt Liga: Du bist auf Platz 2 gestiegen (▲ 1)' }]);
    expect(r.sample_html).toContain('Abbestellen');
  });

  it('Testmail geht nur an die Testadresse, einmal, ohne Wochenstand zu merken', async () => {
    const { db, rpc } = weeklyDb([weeklyRow, { ...weeklyRow, recruiter_id: 'r2', email: 'b@x.de' }]);
    const mail = vi.fn(async () => ({ sent: true }));
    const r = await sendWeekly(db, { dryRun: false, onlyTo: 'test@x.de', mail: mail as never });
    expect(rpc).toHaveBeenCalledWith('liga_weekly_rows', { p_dry_run: true });
    expect(mail).toHaveBeenCalledTimes(1);
    expect((mail.mock.calls[0] as unknown[])[1]).toMatchObject({ to: 'test@x.de', template: 'liga_weekly' });
    expect(r.sent).toBe(1);
  });

  it('Montags-Versand geht an alle mit Adresse, mit Schlüssel gegen Doppelversand', async () => {
    const { db } = weeklyDb([weeklyRow, { ...weeklyRow, recruiter_id: 'r2', email: null }]);
    const mail = vi.fn(async () => ({ sent: true }));
    const r = await sendWeekly(db, { dryRun: false, mail: mail as never, today: '2026-10-26' });
    expect(mail).toHaveBeenCalledTimes(1);
    expect((mail.mock.calls[0] as unknown[])[1]).toMatchObject({ to: 'hh@x.de', idempotencyKey: 'liga-weekly-r1-2026-10-26' });
    expect(r.total).toBe(1);
  });

  it('Glückwunsch nur nach dem Abschluss', async () => {
    const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { closed_at: null }, error: null }) }) }) }) };
    await expect(sendAwards(db as never, 's1', { dryRun: true })).rejects.toThrow('noch nicht abgeschlossen');
  });

  it('Glückwunsch nennt Platz, Preis und Kriterien', () => {
    const c = awardMailContent({ full_name: 'Julia Hartmann', awards: ['season_winner', 'top_performer'], season_label: 'Q3 2026', rank: 1, participants: 38, points: 86, prizes: ['Headhunter der Saison: Wochenende in Hamburg'] });
    expect(c.subject).toBe('Matchunt Liga: Du bist Headhunter der Saison Q3 2026');
    expect(c.paragraphs[0]).toBe('Glückwunsch: Platz 1 von 38 in der Matchunt Liga, 86 Punkte.');
    expect(c.paragraphs.join(' ')).toContain('Wochenende in Hamburg');
    expect(c.paragraphs.join(' ')).toContain('Gewertet werden Ergebnisse beim Kunden');
  });
});
