import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { DECLINE_REASONS, dayDe, euro, isoDay, offerApi, plusWorkdays, type AnswerWay, type RecruiterOfferContext } from '@/lib/offerApi';

interface Props {
  /** Einreichung, zu der das Angebot gehört; null = Fenster zu */
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

const WAYS: { key: AnswerWay; label: string }[] = [
  { key: 'accepted', label: 'Zusage' }, { key: 'considering', label: 'Überlegt noch' },
  { key: 'countered', label: 'Gegenwunsch' }, { key: 'declined', label: 'Absage' },
];
const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? new Intl.NumberFormat('de-DE').format(n) : '');
const first = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'der Kandidat';

/**
 * Angebot überbringen (Headhunter, 22.10.2026): Angebot des Kunden auf einen Blick,
 * Anrufen, dann die Antwort des Kandidaten eintragen. Fenster in der Mitte.
 */
export function OfferAnswerDialog({ submissionId, onClose, onDone }: Props) {
  const ctx = useQuery({
    queryKey: ['offer-recruiter-context', submissionId],
    queryFn: () => offerApi.recruiterContext(submissionId!),
    enabled: !!submissionId,
    staleTime: 10_000,
  });
  return (
    <Dialog open={!!submissionId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {ctx.isLoading || !ctx.data ? (
          <>
            <DialogHeader><DialogTitle>Angebot</DialogTitle><DialogDescription>wird geladen …</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : 'Konnte nicht geladen werden.'}</p>
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <AnswerForm c={ctx.data} onClose={onClose} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AnswerForm({ c, onClose, onDone }: { c: RecruiterOfferContext; onClose: () => void; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const o = c.currentOffer;
  const name = first(c.candidateName);
  const firma = c.companyName;
  const [way, setWay] = useState<AnswerWay>('accepted');
  const [busy, setBusy] = useState(false);
  const [startConfirmed, setStartConfirmed] = useState(o?.startDate ?? '');
  const [until, setUntil] = useState(plusWorkdays(2));
  const [note, setNote] = useState('');
  const [wishSalary, setWishSalary] = useState('');
  const [wishVariable, setWishVariable] = useState('');
  const [wishStart, setWishStart] = useState('');
  const [wishOther, setWishOther] = useState('');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  useEffect(() => { setStartConfirmed(o?.startDate ?? ''); }, [o?.id, o?.startDate]);

  if (!o || o.status === 'superseded') {
    return (
      <>
        <DialogHeader><DialogTitle>Kein offenes Angebot</DialogTitle><DialogDescription>{c.candidateName} · {c.jobTitle}</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">Zu dieser Einreichung liegt gerade kein Angebot bei dir.</p>
      </>
    );
  }
  const open = o.status === 'with_recruiter' || o.status === 'considering';
  const nach = c.nachgespraech;
  // Nur für den Headhunter: Schmerzgrenze aus dem Nachgespräch, sonst der genannte Wunsch
  const grenze = (nach?.angebot_fix_min as number | null) ?? null;
  const wunsch = (nach?.gehalt_besprochen ? (nach?.gehalt_kandidat as number | null) : null) ?? c.akte.expectedSalary;
  const gehaltHinweis = grenze ? `deine Schmerzgrenze: ${euro(grenze)}` : wunsch ? `Wunsch: ${euro(wunsch)}` : null;
  const deadline = o.status === 'considering' && o.response?.until ? o.response.until : o.responseDue;

  const facts: [string, string][] = [
    ['Fixgehalt', `${euro(o.salary)}${gehaltHinweis ? ` (${gehaltHinweis})` : ''}`],
    ...(o.variable ? [['Variabel', `${euro(o.variable)} bei 100 %`] as [string, string]] : []),
    ['Start', o.startDate ? dayDe(o.startDate) : 'offen'],
    ['Vertrag', [o.contractType === 'fixed_term' ? 'befristet' : 'unbefristet', o.probationMonths ? `${o.probationMonths} Monate Probezeit` : null].filter(Boolean).join(' · ')],
    ...(o.extras.length ? [['Extras', o.extras.join(' · ')] as [string, string]] : []),
    ...(o.workModel ? [['Ort · Modell', o.workModel] as [string, string]] : []),
  ];

  const ready = way === 'accepted' ? true
    : way === 'considering' ? !!until && until >= isoDay(new Date())
      : way === 'countered' ? !!(digits(wishSalary) || digits(wishVariable) || wishStart || wishOther.trim())
        : !!reasonCategory;

  const save = async () => {
    setBusy(true);
    try {
      await offerApi.respond({
        offerId: o.id, way,
        note: way === 'considering' ? note : undefined,
        until: way === 'considering' ? until : undefined,
        wishSalary: way === 'countered' ? digits(wishSalary) : undefined,
        wishVariable: way === 'countered' ? digits(wishVariable) : undefined,
        wishStart: way === 'countered' ? wishStart || null : undefined,
        wishOther: way === 'countered' ? wishOther : undefined,
        reason: way === 'countered' || way === 'declined' ? reason : undefined,
        reasonCategory: way === 'declined' ? reasonCategory ?? 'other' : undefined,
        startConfirmed: way === 'accepted' && startConfirmed ? startConfirmed : undefined,
      });
      toast.success(way === 'accepted' ? `Zusage gemeldet. ${firma} schickt jetzt den Vertrag.`
        : way === 'considering' ? `${firma} weiß Bescheid: Antwort bis ${dayDe(until)}${dayDe(until).endsWith('.') ? '' : '.'}`
          : way === 'countered' ? `Gegenwunsch ist bei ${firma}.` : 'Absage gemeldet.');
      queryClient.invalidateQueries({ queryKey: ['offer-recruiter-context', c.submissionId] });
      notifyTasksChanged();
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>Angebot für {c.candidateName} überbringen</DialogTitle>
        <DialogDescription>
          {firma} · {c.jobTitle}{deadline ? ` · ${o.status === 'considering' ? 'überlegt bis' : 'Antwort bis'} ${dayDe(deadline)}` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
        <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
          {facts.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {o.message && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{firma}: „{o.message}“</p>}
        {o.response?.client_keep && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{firma} bleibt bei diesem Angebot{o.response.client_keep.note ? `: „${o.response.client_keep.note}“` : '.'}</p>}
        {c.candidatePhone && open && (
          <Button size="sm" variant="outline" className="mt-3 h-8 gap-1 text-xs" asChild>
            <a href={`tel:${c.candidatePhone}`}><Phone className="h-3 w-3" />{name} anrufen</a>
          </Button>
        )}
      </div>

      {!open ? (
        <p className="text-sm text-muted-foreground">
          {o.status === 'countered' ? `Dein Gegenwunsch liegt bei ${firma}.`
            : o.status === 'accepted' ? `${name} hat zugesagt. ${firma} schickt den Vertrag.`
              : o.status === 'declined' ? `${name} hat abgesagt.` : 'Das Angebot wurde zurückgezogen.'}
        </p>
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-sm font-medium">Antwort von {name}</p>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border/60 bg-muted/30 p-1 sm:grid-cols-4">
              {WAYS.map((w) => (
                <button key={w.key} type="button" onClick={() => setWay(w.key)}
                  className={cn('rounded px-2 py-1.5 text-sm', way === w.key ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {way === 'accepted' && (
            <div className="space-y-2 text-sm">
              <label className="flex flex-wrap items-center gap-2">
                <span className="w-32 text-muted-foreground">Start bestätigt</span>
                <Input type="date" value={startConfirmed} onChange={(e) => setStartConfirmed(e.target.value)} className="h-8 w-44" />
              </label>
              <p className="text-muted-foreground">{firma} schickt jetzt den Arbeitsvertrag. Du hörst von uns, sobald er unterschrieben ist.</p>
            </div>
          )}

          {way === 'considering' && (
            <div className="space-y-2 text-sm">
              <label className="flex flex-wrap items-center gap-2">
                <span className="w-32 text-muted-foreground">Antwort kommt bis</span>
                <Input type="date" value={until} min={isoDay(new Date())} onChange={(e) => setUntil(e.target.value)} className="h-8 w-44" />
              </label>
              <label className="block">
                <span className="text-muted-foreground">Hinweis an {firma} (optional)</span>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. bespricht es am Wochenende mit der Familie" className="mt-1 h-8" />
              </label>
            </div>
          )}

          {way === 'countered' && (
            <div className="space-y-2 text-sm">
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="block"><span className="text-muted-foreground">Fixgehalt gewünscht</span>
                  <Input inputMode="numeric" value={wishSalary} onChange={(e) => setWishSalary(fmt(digits(e.target.value)))} placeholder={`statt ${euro(o.salary)}`} className="mt-1 h-8" /></label>
                <label className="block"><span className="text-muted-foreground">Variabel gewünscht</span>
                  <Input inputMode="numeric" value={wishVariable} onChange={(e) => setWishVariable(fmt(digits(e.target.value)))} placeholder="unverändert" className="mt-1 h-8" /></label>
                <label className="block"><span className="text-muted-foreground">Start gewünscht</span>
                  <Input type="date" value={wishStart} onChange={(e) => setWishStart(e.target.value)} className="mt-1 h-8" /></label>
              </div>
              <label className="block"><span className="text-muted-foreground">Sonst noch</span>
                <Input value={wishOther} onChange={(e) => setWishOther(e.target.value)} placeholder="z. B. 4 Tage Homeoffice" className="mt-1 h-8" /></label>
              <label className="block"><span className="text-muted-foreground">Warum, in eigenen Worten (geht so an {firma})</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="z. B. liegt heute mit Bonus bei 155.000 € und will sich nicht verschlechtern" /></label>
              <p className="text-muted-foreground">{firma} sieht den Gegenwunsch sofort im Bewerberprofil.</p>
            </div>
          )}

          {way === 'declined' && (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-1.5">
                {DECLINE_REASONS.map((r) => (
                  <Button key={r.key} size="sm" variant={reasonCategory === r.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setReasonCategory(r.key)}>{r.label}</Button>
                ))}
              </div>
              <label className="block"><span className="text-muted-foreground">In eigenen Worten (optional)</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" /></label>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onClose}>{open ? 'Abbrechen' : 'Schließen'}</Button>
        {open && (
          <Button disabled={busy || !ready} onClick={save}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {way === 'accepted' ? 'Zusage melden' : way === 'considering' ? `${firma} Bescheid geben` : way === 'countered' ? `Gegenwunsch an ${firma} geben` : 'Absage melden'}
          </Button>
        )}
      </div>
    </>
  );
}
