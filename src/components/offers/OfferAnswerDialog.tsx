import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Loader2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { DECLINE_REASONS, dayDe, euro, offerApi, type AnswerWay, type RecruiterOfferContext } from '@/lib/offerApi';

interface Props {
  /** Einreichung, zu der das Angebot gehört; null = Fenster zu */
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
}

// „Überlegt noch“ gibt es seit G + H nicht mehr: Es gilt die Antwortfrist des Kunden
const WAYS: { key: AnswerWay; label: string }[] = [
  { key: 'accepted', label: 'Zusage melden' }, { key: 'countered', label: 'Gegenwunsch' }, { key: 'declined', label: 'Absage melden' },
];
const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? new Intl.NumberFormat('de-DE').format(n) : '');
const first = (name: string | null) => (name ?? '').trim().split(/\s+/)[0] || 'der Kandidat';
const berlinDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
const timeDe = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
/** „um 17:05“, „morgen um 08:00“, „am 27.10. um 08:00“ */
const whenDe = (iso: string, now: number) => {
  const d = Date.parse(iso);
  if (berlinDay(d) === berlinDay(now)) return `um ${timeDe(iso)}`;
  if (berlinDay(d) === berlinDay(now + 86_400_000)) return `morgen um ${timeDe(iso)}`;
  return `am ${new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })} um ${timeDe(iso)}`;
};
/** Kurz für „seit …“ und „bis …“: „15:05“, „morgen 08:00“, „gestern 17:30“, „22.10., 17:30“ */
const shortDe = (iso: string, now: number) => {
  const d = Date.parse(iso);
  if (berlinDay(d) === berlinDay(now)) return timeDe(iso);
  if (berlinDay(d) === berlinDay(now + 86_400_000)) return `morgen ${timeDe(iso)}`;
  if (berlinDay(d) === berlinDay(now - 86_400_000)) return `gestern ${timeDe(iso)}`;
  return `${new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })}, ${timeDe(iso)}`;
};
/** Restzeit: „1:52 Std.“ bzw. „12 Min.“ */
const leftDe = (ms: number) => {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min < 60 ? `${min} Min.` : `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Std.`;
};

/** Minütlich neu rechnen, damit die Uhr läuft */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

/**
 * Angebot überbringen (Headhunter, 22.10.2026; G + H 25.10.2026): Angebot des Kunden auf einen Blick,
 * anrufen, „Gespräch geführt“ schickt die Mail an den Kandidaten sofort (sonst nach 2 Std.).
 * Antworten gibt der Kandidat selbst; hier nur, was er am Telefon sagt. Fenster in der Mitte.
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
  const now = useNow();
  const o = c.currentOffer;
  const name = first(c.candidateName);
  const firma = c.companyName;
  const [way, setWay] = useState<AnswerWay | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [startConfirmed, setStartConfirmed] = useState(o?.startDate ?? '');
  const [wishSalary, setWishSalary] = useState('');
  const [wishVariable, setWishVariable] = useState('');
  const [wishStart, setWishStart] = useState('');
  const [wishOther, setWishOther] = useState('');
  const [reason, setReason] = useState('');
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [agrees, setAgrees] = useState(false);
  useEffect(() => { setStartConfirmed(o?.startDate ?? ''); }, [o?.id, o?.startDate]);

  if (!o || o.status === 'superseded') {
    return (
      <>
        <DialogHeader><DialogTitle>Kein offenes Angebot</DialogTitle><DialogDescription>{c.candidateName} · {c.jobTitle}</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">Zu dieser Einreichung liegt gerade kein Angebot bei dir.</p>
      </>
    );
  }
  const cand = o.candidate;
  // 'considering' nur noch bei älteren Angeboten von vor G + H
  const open = o.status === 'with_recruiter' || o.status === 'considering';
  const mailDue = cand?.mailDueAt ? Date.parse(cand.mailDueAt) : null;
  const mailSent = !!cand?.mailSent || (mailDue !== null && mailDue <= now);
  const mailSentAt = cand?.mailSentAt ?? (mailSent ? cand?.mailDueAt ?? null : null);
  const callbackOpen = open && !!cand?.callbackAt;
  const reportedLong = o.status === 'accept_reported' && !!cand?.acceptReportedAt && now - Date.parse(cand.acceptReportedAt) >= 24 * 3_600_000;

  const nach = c.nachgespraech;
  // Nur für den Headhunter: Schmerzgrenze aus dem Nachgespräch, sonst der genannte Wunsch
  const grenze = (nach?.angebot_fix_min as number | null) ?? null;
  const wunsch = (nach?.gehalt_besprochen ? (nach?.gehalt_kandidat as number | null) : null) ?? c.akte.expectedSalary;
  const gehaltHinweis = grenze ? `deine Schmerzgrenze: ${euro(grenze)}` : wunsch ? `Wunsch: ${euro(wunsch)}` : null;

  const facts: [string, string][] = [
    ['Fixgehalt', `${euro(o.salary)}${gehaltHinweis ? ` (${gehaltHinweis})` : ''}`],
    ...(o.variable ? [['Variabel', `${euro(o.variable)} bei 100 %`] as [string, string]] : []),
    ['Start', o.startDate ? dayDe(o.startDate) : 'offen'],
    ['Vertrag', [o.contractType === 'fixed_term' ? 'befristet' : 'unbefristet', o.probationMonths ? `${o.probationMonths} Monate Probezeit` : null].filter(Boolean).join(' · ')],
    ...(o.extras.length ? [['Extras', o.extras.join(' · ')] as [string, string]] : []),
    ...(o.workModel ? [['Ort · Modell', o.workModel] as [string, string]] : []),
  ];

  const ready = way === 'accepted' ? true
    : way === 'countered' ? !!(digits(wishSalary) || digits(wishVariable) || wishStart || wishOther.trim()) && agrees
      : way === 'declined' ? !!reasonCategory : false;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['offer-recruiter-context', c.submissionId] });
    notifyTasksChanged();
    onDone?.();
  };

  const run = async (key: string, fn: () => Promise<unknown>, done: string, close = false) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      refresh();
      if (close) onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(null);
    }
  };

  const talked = () => run('talked', () => offerApi.talked(o.id), `Mail ist raus. ${name} hat das Angebot jetzt schriftlich.`);
  const callback = (outcome: 'stays' | 'unreachable') => run(outcome, () => offerApi.callbackDone(o.id, outcome),
    outcome === 'stays' ? `Notiert. ${name} antwortet selbst auf der Angebotsseite.` : 'Notiert. Die Rückruf-Aufgabe bleibt, versuch es noch einmal.', outcome === 'stays');

  const save = () => way && run('save', () => offerApi.respond({
    offerId: o.id, way,
    wishSalary: way === 'countered' ? digits(wishSalary) : undefined,
    wishVariable: way === 'countered' ? digits(wishVariable) : undefined,
    wishStart: way === 'countered' ? wishStart || null : undefined,
    wishOther: way === 'countered' ? wishOther : undefined,
    reason: way === 'countered' || way === 'declined' ? reason : undefined,
    reasonCategory: way === 'declined' ? reasonCategory ?? 'other' : undefined,
    startConfirmed: way === 'accepted' && startConfirmed ? startConfirmed : undefined,
    candidateAgrees: way === 'countered' ? agrees : undefined,
  }), way === 'accepted' ? `Zusage gemeldet. ${name} bestätigt sie jetzt per Mail, dann schickt ${firma} den Vertrag.`
    : way === 'countered' ? `Gegenwunsch ist bei ${firma}.` : `Absage gemeldet. ${firma} weiß Bescheid.`, true);

  const callButton = c.candidatePhone ? (
    <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
      <a href={`tel:${c.candidatePhone}`}><Phone className="h-3 w-3" />{name} anrufen</a>
    </Button>
  ) : null;

  return (
    <>
      <DialogHeader className="text-left">
        <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
          <DialogTitle>Angebot für {c.candidateName} überbringen</DialogTitle>
          {open && !mailSent && mailDue !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
              <Clock className="h-3 w-3" />Mail an {name} in {leftDe(mailDue - now)}
            </span>
          )}
        </div>
        <DialogDescription>
          {firma} · {c.jobTitle}{o.version > 1 ? ` · Version ${o.version}` : ''}{o.responseDue ? ` · Antwort bis ${dayDe(o.responseDue)}` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
        <dl className="grid grid-cols-[7.5rem_1fr] gap-x-3 gap-y-1">
          {facts.map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {o.message && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{firma} an dich: „{o.message}“</p>}
        {o.candidateMessage && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{firma} an {name} (steht auf der Angebotsseite): „{o.candidateMessage}“</p>}
        {o.response?.client_keep && <p className="mt-2 border-t border-border/60 pt-2 text-muted-foreground">{firma} bleibt bei diesem Angebot{o.response.client_keep.note ? `: „${o.response.client_keep.note}“` : '.'}</p>}
      </div>

      {/* Mail an den Kandidaten: erst anrufen, dann „Gespräch geführt“; sonst geht sie von selbst raus */}
      {open && !mailSent && mailDue !== null && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <p>Erst anrufen, dann klicken. Ohne Klick geht die Mail an {name} {whenDe(cand!.mailDueAt!, now)} automatisch raus.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="h-8" disabled={!!busy} onClick={talked}>
              {busy === 'talked' && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Gespräch geführt, Mail jetzt senden
            </Button>
            {callButton}
          </div>
          <p className="text-xs text-muted-foreground">Stand: Mail noch nicht gesendet</p>
        </div>
      )}
      {open && mailSent && !callbackOpen && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {name} hat das Angebot schriftlich{mailSentAt ? ` seit ${shortDe(mailSentAt, now)}` : ''} (Mail und Angebotsseite).
            {cand?.talkedAt ? ` Gespräch geführt ${whenDe(cand.talkedAt, now)}.` : ''}
          </p>
          {callButton}
        </div>
      )}

      {/* Rückrufwunsch von der Angebotsseite */}
      {callbackOpen && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">{name} möchte sprechen</p>
            {cand?.callbackDueAt && <p className="text-xs font-medium text-amber-600">Rückruf bis {shortDe(cand.callbackDueAt, now)}</p>}
          </div>
          <p className="text-muted-foreground">
            Über die Angebotsseite {whenDe(cand!.callbackAt!, now)}{cand?.callbackTopic ? ` · Thema: „${cand.callbackTopic}“` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {callButton}
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => setWay('countered')}>Angerufen: Gegenwunsch senden</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={!!busy} onClick={() => callback('stays')}>
              {busy === 'stays' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Angerufen: bleibt beim Angebot
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={!!busy} onClick={() => callback('unreachable')}>
              {busy === 'unreachable' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Nicht erreicht
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">„Bleibt beim Angebot“: {name} antwortet danach selbst auf der Angebotsseite.</p>
        </div>
      )}

      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-muted-foreground">
            {o.status === 'accept_reported'
              ? `Du hast die Zusage gemeldet${cand?.acceptReportedAt ? ` (${whenDe(cand.acceptReportedAt, now)})` : ''}. ${name} bestätigt sie noch per Mail.${reportedLong ? ` Seit 24 Std. kein Klick: ruf ${name} an.` : ''}`
              : o.status === 'countered' ? `Dein Gegenwunsch liegt bei ${firma}.`
                : o.status === 'accepted' ? `${name} hat ${cand?.confirmedAt || cand?.answeredByCandidate ? 'selbst ' : ''}zugesagt. ${firma} schickt den Vertrag.`
                  : o.status === 'declined' ? `${name} hat ${cand?.answeredByCandidate ? 'auf der Angebotsseite ' : ''}abgesagt.` : 'Das Angebot wurde zurückgezogen.'}
          </p>
          {o.status === 'accept_reported' && callButton}
        </div>
      ) : (
        <>
          <div>
            <p className="text-sm font-medium">Antwort von {name}</p>
            <p className="mb-1.5 text-xs text-muted-foreground">{name} antwortet selbst auf der Angebotsseite. Hier nur, wenn {name} es dir am Telefon sagt:</p>
            <div className="grid grid-cols-3 gap-1 rounded-md border border-border/60 bg-muted/30 p-1">
              {WAYS.map((w) => (
                <button key={w.key} type="button" onClick={() => setWay(way === w.key ? null : w.key)}
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
              <p className="text-muted-foreground">{name} bekommt sofort „Haben Sie zugesagt?“. Der Vertrag startet erst nach dem Klick von {name}.</p>
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
              <label className="block"><span className="text-muted-foreground">Begründung in eigenen Worten (geht so an {firma})</span>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" placeholder="z. B. Kündigungsfrist 3 Monate zum Quartal, liegt heute mit Bonus bei 155.000 €" /></label>
              <label className={cn('flex cursor-pointer items-start gap-2 rounded-md border p-2.5', agrees ? 'border-primary bg-primary/5' : 'border-amber-500/30 bg-amber-500/[0.06]')}>
                <Checkbox checked={agrees} onCheckedChange={(v) => setAgrees(v === true)} className="mt-0.5" />
                <span>{name} hat mir gesagt: „Bei diesen Werten sage ich zu.“</span>
              </label>
              <p className="text-muted-foreground">Ohne Haken lässt sich nichts senden. Nimmt {firma} an, bekommt {name} Version {o.version + 1} direkt zur Zusage.</p>
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
        <Button variant="ghost" onClick={onClose}>{open && way ? 'Abbrechen' : 'Schließen'}</Button>
        {open && way && (
          <Button disabled={!!busy || !ready} onClick={save}>
            {busy === 'save' && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {way === 'accepted' ? 'Zusage melden' : way === 'countered' ? `An ${firma} senden` : 'Absage melden'}
          </Button>
        )}
      </div>
    </>
  );
}
