import { useCallback, useEffect, useState } from 'react';
import { Flag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  avatarUrl,
  errorText,
  fmtDayShort,
  getJobSearchers,
  reportDirectContact,
  TIER_LABEL,
  type ContactChannel,
  type JobSearcher,
} from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

const CHANNELS: { key: ContactChannel; label: string }[] = [
  { key: 'phone', label: 'Anruf' },
  { key: 'email', label: 'E-Mail' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'other', label: 'Sonstiges' },
];

const initials = (name: string | null) =>
  (name || '?')
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();

const relDays = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`;
};

function SearcherRow({ s, photo }: { s: JobSearcher; photo: string | null }) {
  const tier = s.tier ? TIER_LABEL[s.tier] : null;
  const tierClass = s.tier === 'gold' ? 'text-amber-500' : s.tier === 'silver' ? 'text-slate-400' : 'text-muted-foreground';
  const parts: string[] = [];
  if (s.status === 'ended') {
    parts.push(`suchte ${fmtDayShort(s.started_at)}–${fmtDayShort(s.ended_at)}`);
  } else if (s.status === 'paused') {
    parts.push('ruht gerade');
  } else {
    parts.push(`sucht seit ${relDays(s.started_at).replace('vor ', '')}`);
  }
  parts.push(s.candidates === 0 ? (s.status === 'ended' ? 'kein Kandidat' : '') : `${s.candidates} ${s.candidates === 1 ? 'Kandidat' : 'Kandidaten'}`);
  if (s.last_submission_at && s.status !== 'ended') parts.push(`letzte Einreichung ${relDays(s.last_submission_at)}`);

  const body = (
    <>
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-medium',
          photo ? 'bg-muted' : 'bg-primary/10 text-primary',
          s.status === 'ended' && 'opacity-70',
        )}
      >
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials(s.full_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {s.full_name || 'Headhunter'}
          {s.company_name ? <span className="font-normal text-muted-foreground"> · {s.company_name}</span> : null}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {tier && <span className={tierClass}>{tier.replace('Matchunt ', '')}</span>}
          {s.is_new && (!s.tier || s.tier === 'partner') && <span>{tier ? ' · ' : ''}neu bei Matchunt</span>}
          {parts.filter(Boolean).map((p) => ` · ${p}`)}
        </span>
      </span>
    </>
  );

  return s.partner_number ? (
    <a
      href={`/partner/${s.partner_number}`}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 border-t py-2.5 first:border-t-0 hover:bg-muted/30"
      title="Partner-Prüfseite öffnen"
    >
      {body}
    </a>
  ) : (
    <div className="flex items-center gap-3 border-t py-2.5 first:border-t-0">{body}</div>
  );
}

/**
 * „Diese Headhunter suchen für Sie“ (K2): mit Foto, Name, Unternehmen und Stufe,
 * auch nach dem Ende ihrer Suche. Direktkontakte meldet der Kunde vertraulich.
 */
export function JobSearchersCard({ jobId, jobTitle, closed = false }: { jobId: string; jobTitle: string; closed?: boolean }) {
  const [rows, setRows] = useState<JobSearcher[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const [reportOpen, setReportOpen] = useState(false);
  const [who, setWho] = useState('');
  const [channel, setChannel] = useState<ContactChannel | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getJobSearchers(jobId);
      setRows(list ?? []);
      const entries = await Promise.all((list ?? []).map(async (s) => [s.recruiter_id, await avatarUrl(s.avatar_path)] as const));
      setPhotos(Object.fromEntries(entries));
    } catch {
      setRows([]);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReport = async () => {
    if (!who || !channel) return;
    setBusy(true);
    try {
      await reportDirectContact(jobId, who, channel, note);
      toast.success('Danke. Wir kümmern uns vertraulich darum.');
      setReportOpen(false);
      setWho('');
      setChannel(null);
      setNote('');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  if (rows === null) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const current = rows.filter((r) => r.status !== 'ended');
  const former = rows.filter((r) => r.status === 'ended');

  return (
    <div className="rounded-xl border bg-card p-4">
      {!(closed && current.length === 0) && (
        <p className="text-sm font-semibold">
          {current.length > 0 ? `Suchen gerade für Sie · ${current.length}` : 'Noch kein Headhunter aktiv'}
        </p>
      )}
      {current.length === 0 && !closed && (
        <p className="mt-1 text-xs text-muted-foreground">Sobald ein Headhunter „Ich suche“ drückt, sehen Sie ihn hier und in der Glocke.</p>
      )}
      {current.length > 0 && (
        <div className="mt-1">
          {current.map((s) => (
            <SearcherRow key={s.activation_id} s={s} photo={photos[s.recruiter_id] ?? null} />
          ))}
        </div>
      )}
      {former.length > 0 && (
        <>
          <p className={cn('text-sm font-semibold', !(closed && current.length === 0) && 'mt-3')}>Haben für diese Stelle gesucht · {former.length}</p>
          <div className="mt-1">
            {former.map((s) => (
              <SearcherRow key={s.activation_id} s={s} photo={photos[s.recruiter_id] ?? null} />
            ))}
          </div>
        </>
      )}
      {rows.length > 0 && (
        <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            Alle hier genannten Headhunter arbeiten für Sie nur über Matchunt, auch nach dem Ende ihrer Suche. Meldet sich einer direkt bei
            Ihnen, sagen Sie uns bitte Bescheid.
          </p>
          <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-primary hover:underline" onClick={() => setReportOpen(true)}>
            <Flag className="h-3 w-3" />
            Direktkontakt melden
          </button>
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Direktkontakt melden</DialogTitle>
            <DialogDescription>{jobTitle} · geht vertraulich an Matchunt. Der Headhunter erfährt nicht, wer gemeldet hat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="mb-1.5 font-medium">Wer?</p>
              <select
                value={who}
                onChange={(e) => setWho(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Headhunter wählen</option>
                {rows.map((r) => (
                  <option key={r.recruiter_id} value={r.recruiter_id}>
                    {r.full_name || 'Headhunter'}
                    {r.company_name ? ` · ${r.company_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1.5 font-medium">Wie?</p>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setChannel(c.key)}
                    className={cn('rounded-md border px-2.5 py-1 text-xs', channel === c.key ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted/50')}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Was ist passiert? (optional)" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={submitReport} disabled={busy || !who || !channel}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Melden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
