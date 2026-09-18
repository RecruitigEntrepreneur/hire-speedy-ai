import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { MailStat } from '../../../../supabase/functions/_shared/email-stats';
import { EVENT_LABELS, MAIL_LABELS, mailHeadline, shortDate } from './mailFormat';

/**
 * Mails eines Vorgangs mit Zustellung, Öffnungen und Klicks: Einladung,
 * Anmeldecodes und Zugangsmail. Die Daten kommen aus email_events; ohne
 * mitgeschriebene Ereignisse zeigt die Karte den letzten Stand laut Resend.
 */

const times = (n: { count: number; first: string | null; last: string | null }) =>
  `${n.count}× · ${n.count > 1 ? `zuerst ${shortDate(n.first)}, zuletzt ${shortDate(n.last)}` : shortDate(n.first)}`;

export type MailState = { loading: boolean; error: string; items: MailStat[] };

function MailCard({ m }: { m: MailStat }) {
  const rows: [string, string][] = [['Gesendet', `${shortDate(m.sentAt)} an ${m.to}`]];
  if (m.deliveredAt) rows.push(['Zugestellt', shortDate(m.deliveredAt)]);
  if (m.opens.count) rows.push(['Geöffnet', times(m.opens)]);
  if (m.clicks.count) rows.push(['Link geklickt', times(m.clicks)]);
  if (m.problem) rows.push([EVENT_LABELS[m.problem.type], shortDate(m.problem.at)]);
  if (m.error) rows.push(['Fehler', m.error]);
  const bad = m.status === 'failed' || (m.problem && m.problem.type !== 'delivery_delayed');
  return <div className="space-y-2 rounded-lg border p-4">
    <div className="flex items-center justify-between gap-3">
      <strong className="text-sm">{MAIL_LABELS[m.template] ?? (m.subject || 'E-Mail')}</strong>
      <Badge variant={bad ? 'destructive' : 'secondary'}>{mailHeadline(m)}</Badge>
    </div>
    <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([label, value]) => <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}
    </dl>
    {!m.tracked && m.status === 'sent' && <p className="text-xs text-muted-foreground">{m.lastEvent
      ? `Letzter Stand laut Resend: ${EVENT_LABELS[m.lastEvent]}. Uhrzeit und Anzahl gibt es nur für Mails, deren Ereignisse mitgeschrieben werden.`
      : 'Resend hat noch keine Zustellung oder Öffnung gemeldet.'}</p>}
  </div>;
}

export function MailPanel({ state, busy, onRefresh }: { state: MailState | null; busy: boolean; onRefresh: () => void }) {
  return <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-sm font-semibold">E-Mails an den Headhunter</h4>
      <Button type="button" variant="ghost" size="sm" disabled={busy || !state || state.loading} onClick={onRefresh}>Aktualisieren</Button>
    </div>
    {!state || state.loading ? <p className="text-sm text-muted-foreground">Mailstatus wird geladen …</p>
      : state.error ? <p className="text-sm text-muted-foreground">{state.error}</p>
      : !state.items.length ? <p className="text-sm text-muted-foreground">Für diesen Vorgang wurde noch keine Mail verschickt.</p>
      : <>{state.items.map(m => <MailCard key={m.id} m={m}/>)}
        <p className="text-xs text-muted-foreground">Öffnungen sind ein Anhaltspunkt. Manche Mailprogramme laden Bilder vorab, andere blockieren sie.</p></>}
  </div>;
}
