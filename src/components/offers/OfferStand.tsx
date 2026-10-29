import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { dayDe, euro, offerApi, overdue } from '@/lib/offerApi';
import { offerSummary } from './OfferBox';

/**
 * Angebot im Bewerberprofil (24.10.2026, „Profil: nachsehen“): der Stand als ruhige Zeitleiste.
 * Gehandelt wird im Angebots-Fenster (Karte oben oder „Öffnen“).
 */
export function OfferStand({ submissionId, onOpen }: { submissionId: string; onOpen: () => void }) {
  const q = useQuery({ queryKey: ['offer-context', submissionId], queryFn: () => offerApi.context(submissionId), staleTime: 15_000 });
  const o = q.data?.currentOffer;
  if (!o || o.status === 'superseded') return null;
  const first = (q.data?.candidateName ?? '').split(' ')[0] || 'Der Kandidat';
  const hh = q.data?.recruiterName?.trim() || 'Ihr Headhunter';
  const hhFirst = hh.split(' ')[0];
  const r = o.response;
  const late = overdue(o);
  const openLink = <button type="button" className="ml-1 text-primary underline underline-offset-2" onClick={onOpen}>Öffnen</button>;

  type Row = { state: 'done' | 'now' | 'bad'; text: React.ReactNode; when?: string | null };
  const rows: Row[] = [{ state: 'done', text: `Angebot ${offerSummary(o)}${o.version > 1 ? ` · Version ${o.version}` : ''}`, when: o.sentAt ? dayDe(o.sentAt) : null }];
  if (o.status === 'countered') {
    const w = r?.wish;
    const wish = [w?.salary ? `${euro(w.salary)} fix` : null, w?.startDate ? `Start ${dayDe(w.startDate)}` : null, w?.other ?? null].filter(Boolean).join(' · ');
    rows.push({ state: 'now', text: <>{first} wünscht {wish || 'Änderungen'}{r?.reason ? <span className="text-muted-foreground"> · {hhFirst}: „{r.reason}“</span> : null}{openLink}</> });
  } else if (o.status === 'considering') {
    rows.push({ state: 'now', text: <>{first} überlegt noch{r?.until ? ` bis ${dayDe(r.until)}` : ''}{openLink}</> });
  } else if (o.status === 'accept_reported') {
    rows.push({ state: 'now', text: <>{first} hat laut {hhFirst} zugesagt und bestätigt gerade per Mail{openLink}</> });
  } else if (o.status === 'with_recruiter') {
    rows.push({ state: late ? 'bad' : 'now', text: <>{late ? `Antwortfrist abgelaufen (${dayDe(o.responseDue)})` : `${hhFirst} bespricht es mit ${first}, ${first} antwortet selbst per Mail · Antwort bis ${dayDe(o.responseDue)}`}{openLink}</> });
  } else if (o.status === 'declined') {
    rows.push({ state: 'bad', text: <>{first} hat abgesagt{r?.reason ? `: „${r.reason}“` : ''}{openLink}</> });
  } else if (o.status === 'withdrawn') {
    rows.push({ state: 'bad', text: <>Angebot zurückgezogen{openLink}</> });
  }

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-card p-3 text-sm">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Angebot</p>
      <ol className="space-y-1">
        {rows.map((row, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', row.state === 'done' ? 'bg-emerald-500' : row.state === 'now' ? 'bg-amber-500' : 'bg-destructive')} />
            <span className="min-w-0 flex-1">{row.text}</span>
            {row.when && <span className="shrink-0 text-xs text-muted-foreground">{row.when}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
