import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { ANGEBOT_PUNKTE } from '@/lib/nachgespraech';
import { dayDe, euro, offerApi, type RecruiterOfferContext, type RecommendationItem } from '@/lib/offerApi';

interface Props {
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

interface Row { key: string; label: string; value: string; on: boolean; placeholder: string; privateHint?: string }

const datum = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** Vorschlag aus dem Nachgespräch. Die Schmerzgrenze steht nur als Hinweis für den Headhunter da. */
function rowsFrom(c: RecruiterOfferContext): Row[] {
  const n = c.nachgespraech ?? {};
  const last = c.recommendation?.items ?? [];
  const prev = (key: string) => last.find((i) => i.key === key)?.value;
  const wunsch = (n.gehalt_besprochen ? n.gehalt_kandidat : null) ?? c.akte.expectedSalary;
  const punkte: string[] = n.angebot_punkte ?? [];
  const start = n.start_art === 'sofort' ? 'sofort möglich'
    : n.start_art === 'fester_tag' && n.start_datum ? `ab ${datum(n.start_datum)}`
      : n.start_art === 'nach_frist' ? `nach Kündigungsfrist${c.akte.noticePeriod ? ` (${c.akte.noticePeriod})` : ''}`
        : c.akte.availabilityDate ? `ab ${datum(c.akte.availabilityDate)}` : '';
  const wichtig = [
    punkte.filter((p) => p !== 'homeoffice').map((p) => ANGEBOT_PUNKTE.find((x) => x.key === p)?.label ?? p).join(', '),
    (n.angebot_text ?? '').trim(),
  ].filter(Boolean).join('. ');
  const rows: Row[] = [
    { key: 'fix', label: 'Fixgehalt', value: prev('fix') ?? (wunsch ? `ab ${euro(wunsch)}` : ''), on: true, placeholder: 'z. B. ab 150.000 €',
      privateHint: n.angebot_fix_min ? `Deine Schmerzgrenze ${euro(n.angebot_fix_min)} bleibt bei dir.` : undefined },
    { key: 'variable', label: 'Variabel', value: prev('variable') ?? '', on: true, placeholder: 'z. B. 20.000 € wie besprochen' },
    { key: 'homeoffice', label: 'Homeoffice', value: prev('homeoffice') ?? '', on: punkte.includes('homeoffice'), placeholder: 'z. B. 3 Tage pro Woche' },
    { key: 'start', label: 'Start', value: prev('start') ?? start, on: true, placeholder: 'z. B. ab 01.01.2027' },
    { key: 'wichtig', label: 'Wichtig im Angebot', value: prev('wichtig') ?? wichtig, on: true, placeholder: 'z. B. Dienstwagen, eigenes Team' },
    { key: 'gut_zu_wissen', label: 'Gut zu wissen', value: prev('gut_zu_wissen') ?? '', on: true, placeholder: 'z. B. zweiter Prozess, Entscheidung Mitte November' },
    // Bedenken nie vorab angehakt: der Headhunter entscheidet bewusst
    { key: 'bedenken', label: 'Bedenken', value: prev('bedenken') ?? (n.bedenken ?? ''), on: !!prev('bedenken'), placeholder: 'z. B. Pendelzeit 50 Min.' },
  ];
  return rows.map((r) => ({ ...r, on: r.on && r.value.trim().length > 0 }));
}

/**
 * Empfehlung an den Kunden (Headhunter, 22.10.2026): was der Kandidat für eine Zusage
 * braucht, aus dem Nachgespräch vorbefüllt. Der Headhunter hakt an, was der Kunde sieht.
 */
export function RecommendationDialog({ submissionId, onClose, onDone }: Props) {
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
            <DialogHeader><DialogTitle>Empfehlung</DialogTitle><DialogDescription>wird geladen …</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : 'Konnte nicht geladen werden.'}</p>
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <RecommendationForm c={ctx.data} onClose={onClose} onDone={onDone} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecommendationForm({ c, onClose, onDone }: { c: RecruiterOfferContext; onClose: () => void; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const firma = c.companyName;
  const name = (c.candidateName ?? '').split(' ')[0] || 'der Kandidat';
  const initial = useMemo(() => rowsFrom(c), [c]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [intro, setIntro] = useState(c.recommendation?.intro ?? '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRows(initial); }, [initial]);

  const set = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chosen: RecommendationItem[] = rows.filter((r) => r.on && r.value.trim()).map((r) => ({ key: r.key, label: r.label, value: r.value.trim() }));
  const nachDatum = c.nachgespraech?.created_at ? datum(c.nachgespraech.created_at).slice(0, 6) : null;

  const send = async () => {
    setBusy(true);
    try {
      await offerApi.recommend(c.submissionId, intro, chosen);
      toast.success(`Empfehlung ist bei ${firma}.`);
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
        <DialogTitle>Empfehlung an {firma}</DialogTitle>
        <DialogDescription>
          {c.candidateName} · {c.jobTitle}. {nachDatum ? `Aus deinem Nachgespräch vom ${nachDatum} ` : ''}Du entscheidest, was {firma} sieht.
        </DialogDescription>
      </DialogHeader>
      {c.recommendation && (
        <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Zuletzt gesendet am {dayDe(c.recommendation.createdAt)}. Eine neue Empfehlung ersetzt sie im Profil des Kunden.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className={cn('rounded-md border p-2', r.on ? 'border-primary/30 bg-primary/[0.03]' : 'border-border/60')}>
            <div className="flex items-center gap-2">
              <Checkbox id={`rec-${r.key}`} checked={r.on} onCheckedChange={(v) => set(r.key, { on: v === true })} disabled={!r.value.trim()} />
              <label htmlFor={`rec-${r.key}`} className="w-32 shrink-0 text-sm font-medium">{r.label}</label>
              <Input value={r.value} onChange={(e) => set(r.key, { value: e.target.value, on: e.target.value.trim() ? (r.value.trim() ? r.on : true) : false })}
                placeholder={r.placeholder} className="h-8 text-sm" aria-label={r.label} />
            </div>
            {r.privateHint && <p className="ml-6 mt-1 text-xs text-amber-600 dark:text-amber-400">{r.privateHint}</p>}
          </div>
        ))}
      </div>

      <label className="block text-sm">
        <span className="text-muted-foreground">Persönliche Einleitung (optional)</span>
        <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} className="mt-1" placeholder={`z. B. ${name} war nach dem Termin vor Ort begeistert vom Team. So kommt die Zusage:`} />
      </label>

      <div className="rounded-lg border border-dashed p-3 text-sm">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">So sieht {firma} es</p>
        {intro.trim() && <p className="mb-1 italic">„{intro.trim()}“</p>}
        {chosen.length === 0 ? <p className="text-muted-foreground">Hake mindestens einen Punkt an.</p> : (
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-0.5">
            {chosen.map((i) => <div key={i.key} className="contents"><dt className="text-muted-foreground">{i.label}</dt><dd>{i.value}</dd></div>)}
          </dl>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Erscheint als Karte im Bewerberprofil und im Angebotsfenster. Nicht angehakte Punkte und deine Schmerzgrenze sieht {firma} nie.</p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
        <Button disabled={busy || chosen.length === 0} onClick={send}>
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Empfehlung senden
        </Button>
      </div>
    </>
  );
}
