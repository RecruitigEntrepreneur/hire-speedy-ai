import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { clientTasksApi, taskHref, useClientTasks, waitingLabel, type ClientTask } from '@/lib/clientTasksApi';
import { interviewApi } from '@/lib/interviewScheduling';
import { offerApi } from '@/lib/offerApi';
import { contractApi } from '@/lib/contractApi';
import { placementApi } from '@/lib/placementApi';
import type { ContractOpen } from '@/components/contracts/ContractBox';
import { TaskContextBlock } from './ClientTaskParts';

/**
 * Aufgaben-Fenster des Kunden (23.10.2026): eine Aufgabe, ihre Antworten zum Anklicken,
 * darunter die Felder der gewählten Antwort. Antworten mit eigenem Fenster (Interview
 * anfragen, Angebot, Vertrag, Absage) übergeben an das bekannte Fenster im Profil.
 * Kein Aufschieben (Entscheidung 23.10.); Gründe bei Abbruch Pflicht.
 */

/** Was das Profil für Antworten mit eigenem Fenster bereitstellt. */
export interface TaskHandlers {
  requestInterview: (replacesInterviewId?: string | null) => void;
  reject: () => void;
  askRecruiter: () => void;
  offer: () => void;
  contract: (open: ContractOpen) => void;
}

type Field = 'none' | 'reason' | 'date' | 'text' | 'colleague' | 'nonstart';

interface Option {
  key: string;
  label: string;
  /** Text auf dem Knopf unten */
  cta: string;
  field?: Field;
  hint?: string;
  /** Pflichtauswahl bei Abbruch */
  reasons?: { key: string; label: string }[];
  /** Felder prüfen; Text = Fehlermeldung */
  check?: (v: Values) => string | null;
  /** Satz nach dem Erledigen */
  doneText?: string;
  /** 'done' = erledigt (Fenster schreibt das Protokoll), 'logged' = erledigt (Server hat protokolliert), 'handoff' = anderes Fenster übernimmt */
  run: (v: Values) => Promise<'done' | 'logged' | 'handoff'>;
}

interface Values { reason: string; date: string; text: string; colleague: string }

const INTERVIEW_CANCEL = [
  { key: 'Kandidat passt nicht mehr', label: 'passt nicht mehr' }, { key: 'Stelle ist besetzt', label: 'Stelle besetzt' },
  { key: 'Termin entfällt intern', label: 'Termin entfällt intern' }, { key: 'Anderer Grund', label: 'anderer Grund' },
];
const OFFER_WITHDRAW = [
  { key: 'Keine Rückmeldung', label: 'keine Rückmeldung' }, { key: 'Anderer Kandidat', label: 'anderer Kandidat' },
  { key: 'Budget', label: 'Budget' }, { key: 'Anderer Grund', label: 'anderer Grund' },
];
const NON_START = [
  { key: 'not_started', label: 'nicht erschienen' }, { key: 'counter_offer', label: 'Gegenangebot angenommen' },
  { key: 'other_job', label: 'andere Stelle angetreten' }, { key: 'personal', label: 'persönliche Gründe' }, { key: 'other', label: 'anderer Grund' },
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

function optionsFor(t: ClientTask, h: TaskHandlers | null, extra: { recruiter: string }): Option[] {
  const hh = extra.recruiter;
  const handoff = (fn: () => void): Option['run'] => async () => { fn(); return 'handoff'; };
  const needH = (fn: (x: TaskHandlers) => void): Option['run'] => async () => { if (h) fn(h); return 'handoff'; };
  const sid = t.submissionId ?? '';
  switch (t.kind) {
    case 'review':
      return [
        { key: 'ja', label: 'Ja, Interview anfragen', cta: 'Weiter zur Terminwahl', hint: 'Öffnet „Interview anfragen“ mit Format, Dauer und Zeiten.', run: needH((x) => x.requestInterview(null)) },
        { key: 'nein', label: 'Nein, absagen', cta: 'Weiter zur Absage', hint: 'Grund wählen; der Headhunter sagt dem Kandidaten neutral ab.', run: needH((x) => x.reject()) },
        { key: 'frage', label: `Frage an ${hh}`, cta: 'Frage schreiben', hint: 'Die Aufgabe bleibt offen, bis Sie entschieden haben.', run: needH((x) => x.askRecruiter()) },
      ];
    case 'alternative':
      return [
        { key: 'ok', label: 'Passt, bestätigen', cta: 'Bestätigen', hint: 'Termin steht, Einladung an alle.', doneText: 'Der Termin steht, die Einladung geht an alle.', run: async () => { await interviewApi.confirmAlternative(t.ref.interviewId!); return 'done'; } },
        { key: 'neu', label: 'Andere Zeiten vorschlagen', cta: 'Zeiten wählen', hint: 'Öffnet das Terminraster; die neue Anfrage ersetzt die alte.', run: needH((x) => x.requestInterview(t.ref.interviewId ?? null)) },
        { key: 'absagen', label: 'Interview absagen', cta: 'Absagen', doneText: 'Das Interview ist abgesagt, der Headhunter ist informiert.', field: 'reason', reasons: INTERVIEW_CANCEL, check: (v) => (v.reason ? null : 'Bitte einen Grund wählen.'),
          run: async (v) => { await interviewApi.withdraw(t.ref.interviewId!, v.reason); return 'done'; } },
      ];
    case 'expired_request':
      return [
        { key: 'neu', label: 'Neue Termine vorschlagen', cta: 'Zeiten wählen', run: needH((x) => x.requestInterview(t.ref.interviewId ?? null)) },
        { key: 'nachfassen', label: `${hh} soll nachfassen`, cta: 'Bitten', hint: `${hh} bekommt die Aufgabe „anrufen“. Ihre Aufgabe bleibt sichtbar.`,
          run: async () => { await clientTasksApi.askFollowup(sid, 'Der Kandidat hat auf die Terminvorschläge nicht reagiert.'); return 'handoff'; } },
        { key: 'beenden', label: 'Bewerbung beenden', cta: 'Weiter zur Absage', run: needH((x) => x.reject()) },
      ];
    case 'decide_unsure':
      return [
        { key: 'angebot', label: 'Angebot machen', cta: 'Angebot erstellen', run: needH((x) => x.offer()) },
        { key: 'runde', label: 'Noch eine Runde', cta: 'Interview anfragen', run: needH((x) => x.requestInterview(null)) },
        { key: 'absage', label: 'Absage', cta: 'Weiter zur Absage', run: needH((x) => x.reject()) },
      ];
    case 'make_offer':
      return [
        { key: 'angebot', label: 'Angebot erstellen', cta: 'Angebot erstellen', hint: 'Die Werte aus der Empfehlung stehen oben im Angebotsfenster.', run: needH((x) => x.offer()) },
        { key: 'frage', label: `Erst Frage an ${hh}`, cta: 'Frage schreiben', hint: 'Die Aufgabe bleibt offen.', run: needH((x) => x.askRecruiter()) },
        { key: 'absage', label: 'Doch absagen', cta: 'Weiter zur Absage', run: needH((x) => x.reject()) },
      ];
    case 'counter':
      return [
        { key: 'anpassen', label: 'Angebot anpassen', cta: 'Version 2 erstellen', hint: 'Version 2 ersetzt Version 1; der Headhunter überbringt sie.', run: needH((x) => x.offer()) },
        { key: 'bleiben', label: 'Beim Angebot bleiben', cta: 'Antwort senden', doneText: 'Ihre Antwort geht an den Headhunter.', field: 'text', hint: 'Optional ein Satz für die Kandidatin oder den Kandidaten.',
          run: async (v) => { await offerApi.keep(t.ref.offerId!, v.text.trim()); return 'done'; } },
        { key: 'absagen', label: 'Absagen', cta: 'Angebot zurückziehen', doneText: 'Das Angebot ist zurückgezogen.', field: 'reason', reasons: OFFER_WITHDRAW, check: (v) => (v.reason ? null : 'Bitte einen Grund wählen.'),
          run: async () => { await offerApi.withdraw(t.ref.offerId!); return 'done'; } },
      ];
    case 'offer_overdue':
      return [
        { key: 'verlaengern', label: 'Frist verlängern', cta: 'Verlängern', doneText: 'Die Frist ist verlängert, der Headhunter weiß Bescheid.', field: 'date', check: (v) => (v.date && v.date >= todayIso() ? null : 'Bitte ein Datum ab heute wählen.'),
          run: async (v) => { await offerApi.extend(t.ref.offerId!, v.date); return 'done'; } },
        { key: 'nachfassen', label: `${hh} soll nachfassen`, cta: 'Bitten', hint: 'Ihre Aufgabe bleibt sichtbar.',
          run: async () => { await clientTasksApi.askFollowup(sid, 'Die Antwortfrist für das Angebot ist vorbei.'); return 'handoff'; } },
        { key: 'zurueck', label: 'Angebot zurückziehen', cta: 'Zurückziehen', doneText: 'Das Angebot ist zurückgezogen.', field: 'reason', reasons: OFFER_WITHDRAW, check: (v) => (v.reason ? null : 'Bitte einen Grund wählen.'),
          run: async () => { await offerApi.withdraw(t.ref.offerId!); return 'done'; } },
      ];
    case 'send_contract':
      return [
        { key: 'digital', label: 'Digital über Matchunt', cta: 'Vertrag hochladen', hint: 'DocuSign: erst Ihr Unterzeichner, dann die Kandidatin oder der Kandidat.', run: needH((x) => x.contract('digital')) },
        { key: 'selbst', label: 'Selbst verschickt', cta: 'Datum eintragen', run: needH((x) => x.contract('verschickt')) },
        { key: 'unterschrieben', label: 'Ist schon unterschrieben', cta: 'Unterschrift melden', run: needH((x) => x.contract('melden')) },
        { key: 'weg', label: 'Abgesprungen', cta: 'Weiter', hint: 'Grund ist Pflicht; der Headhunter klärt den Fall.', run: needH((x) => x.contract('abgesprungen')) },
      ];
    case 'contract_signed_check':
      return [
        { key: 'ja', label: 'Ja, unterschrieben', cta: 'Unterschrift melden', run: needH((x) => x.contract('melden')) },
        { key: 'nein', label: 'Noch nicht', cta: 'Antwort speichern', hint: 'Wir fragen in einer Woche wieder.', doneText: 'Gespeichert. Wir fragen in einer Woche wieder.', run: async () => 'done' },
        { key: 'weg', label: 'Abgesprungen', cta: 'Weiter', run: needH((x) => x.contract('abgesprungen')) },
      ];
    case 'docusign_sign':
      return [
        { key: 'mail', label: 'DocuSign-Mail erneut senden', cta: 'Mail erneut senden', hint: 'Die Aufgabe bleibt, bis die Unterschrift bei DocuSign eingegangen ist.',
          run: async () => { await contractApi.resend(sid); toast.success('DocuSign schickt die Mail noch einmal.'); return 'handoff'; } },
        { key: 'stand', label: 'Ich habe schon unterschrieben', cta: 'Stand bei DocuSign abfragen',
          run: async () => { await contractApi.refresh(sid); return 'handoff'; } },
        { key: 'anderer', label: 'Anderer Unterzeichner', cta: 'Umschlag neu senden', hint: 'Der bisherige Umschlag wird zurückgezogen.',
          run: async () => { await contractApi.voidDigital(sid, false); h?.contract('digital'); return 'handoff'; } },
        { key: 'selbst', label: 'Doch selbst verschicken', cta: 'Umschlag zurückziehen',
          run: async () => { await contractApi.voidDigital(sid, true); h?.contract('verschickt'); return 'handoff'; } },
      ];
    case 'confirm_signature':
      return [
        { key: 'ja', label: 'Stimmt', cta: 'Bestätigen', hint: 'Die Einstellung wird verbindlich.', doneText: 'Bestätigt. Die Einstellung ist verbindlich.', run: async () => { await contractApi.confirm(sid, 'yes'); return 'done'; } },
        { key: 'werte', label: 'Andere Werte', cta: 'Werte eintragen', run: needH((x) => x.contract('werte')) },
        { key: 'nein', label: 'Noch nicht unterschrieben', cta: 'Antwort senden', doneText: 'Der Headhunter bekommt Ihre Rückmeldung.', run: async () => { await contractApi.confirm(sid, 'not_yet'); return 'done'; } },
      ];
    case 'recruiter_question':
      return [
        { key: 'antworten', label: 'Antworten', cta: 'Antwort senden', doneText: 'Ihre Antwort ist beim Headhunter.', field: 'text', check: (v) => (v.text.trim().length >= 2 ? null : 'Bitte eine Antwort schreiben.'),
          run: async (v) => { await clientTasksApi.answerQuestion(t.ref.notificationId!, v.text.trim()); return 'logged'; } },
        { key: 'kollege', label: 'An Kollegen geben', cta: 'Weitergeben', doneText: 'Weitergegeben. Die Frage steht jetzt bei Ihrer Kollegin oder Ihrem Kollegen.', field: 'colleague', check: (v) => (v.colleague ? null : 'Bitte eine Person wählen.'),
          run: async (v) => { const r = await clientTasksApi.forwardQuestion(t.ref.notificationId!, v.colleague); toast.success(`An ${r.to} weitergegeben.`); return 'logged'; } },
      ];
    case 'confirm_start':
      return [
        { key: 'ja', label: 'Ja, gestartet', cta: 'Bestätigen', doneText: 'Antritt bestätigt. Der Headhunter ist informiert.', run: async () => { await clientTasksApi.confirmStart({ placementId: t.ref.placementId!, way: 'started' }); return 'logged'; } },
        { key: 'spaeter', label: 'Später gestartet', cta: 'Datum speichern', doneText: 'Neuer erster Arbeitstag gespeichert.', field: 'date', check: (v) => (v.date ? null : 'Bitte das Datum des ersten Arbeitstags wählen.'),
          run: async (v) => { await clientTasksApi.confirmStart({ placementId: t.ref.placementId!, way: 'later', startedOn: v.date }); return 'logged'; } },
        { key: 'nein', label: 'Nicht angetreten', cta: 'Nichtantritt melden', doneText: 'Nichtantritt gemeldet. Matchunt prüft den Fall und meldet sich.', field: 'nonstart', hint: 'Matchunt prüft den Fall nach dem Vertrag (Nichtantritt).', check: (v) => (v.reason ? null : 'Bitte einen Grund wählen.'),
          run: async (v) => { await clientTasksApi.confirmStart({ placementId: t.ref.placementId!, way: 'not_started', reason: v.reason, note: v.text.trim() || undefined }); return 'logged'; } },
      ];
    case 'invoice':
      return [
        { key: 'pdf', label: 'Rechnung ansehen', cta: 'PDF öffnen', run: async () => { const { url } = await placementApi.file(t.ref.invoiceId!); window.open(url, '_blank', 'noopener'); return 'handoff'; } },
        { key: 'bezahlt', label: 'Ist überwiesen', cta: 'Überweisung melden', doneText: 'Überweisung gemeldet. Matchunt prüft den Zahlungseingang.', field: 'date', hint: 'Matchunt prüft den Zahlungseingang; erledigt ist die Aufgabe, sobald er gebucht ist.',
          check: (v) => (v.date ? null : 'Bitte das Überweisungsdatum wählen.'), run: async (v) => { await clientTasksApi.invoicePaid(t.ref.invoiceId!, v.date); return 'logged'; } },
        { key: 'frage', label: 'Frage zur Rechnung', cta: 'Frage senden', field: 'text', check: (v) => (v.text.trim().length >= 3 ? null : 'Bitte die Frage schreiben.'),
          run: async (v) => { await clientTasksApi.invoiceQuestion(t.ref.invoiceId!, v.text.trim()); toast.success('Frage an Matchunt gesendet.'); return 'handoff'; } },
      ];
    default:
      return [{ key: 'open', label: 'Öffnen', cta: 'Öffnen', run: handoff(() => {}) }];
  }
}

interface Props {
  task: ClientTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handlers: TaskHandlers | null;
  recruiterName?: string | null;
}

export function ClientTaskWindow({ task, open, onOpenChange, handlers, recruiterName }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const all = useClientTasks();
  const hh = (recruiterName ?? 'Headhunter').split(' ')[0];
  const options = useMemo(() => (task ? optionsFor(task, handlers, { recruiter: hh }) : []), [task, handlers, hh]);
  const [choice, setChoice] = useState<string>('');
  const [values, setValues] = useState<Values>({ reason: '', date: '', text: '', colleague: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [colleagues, setColleagues] = useState<{ userId: string; name: string }[] | null>(null);

  useEffect(() => {
    if (!open || !task) return;
    setChoice(options[0]?.key ?? '');
    setValues({ reason: '', date: task.kind === 'offer_overdue' ? plusDays(3) : task.kind === 'invoice' ? todayIso() : '', text: '', colleague: '' });
    setError(null);
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.key]);

  const opt = options.find((o) => o.key === choice) ?? null;
  useEffect(() => {
    if (opt?.field === 'colleague' && task?.ref.notificationId && colleagues === null) {
      clientTasksApi.colleagues(task.ref.notificationId).then((r) => setColleagues(r.colleagues)).catch(() => setColleagues([]));
    }
  }, [opt?.field, task?.ref.notificationId, colleagues]);

  if (!task) return null;
  const list = all.data?.tasks ?? [];
  const index = list.findIndex((x) => x.key === task.key);
  const next = list.find((x) => x.key !== task.key) ?? null;

  const submit = async () => {
    if (!opt) return;
    const msg = opt.check?.(values) ?? null;
    if (msg) { setError(msg); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await opt.run(values);
      if (r === 'done' || r === 'logged') {
        if (r === 'done') await clientTasksApi.logDone(task, `${task.title}: ${opt.label}`, values.reason || undefined).catch(() => undefined);
        setDone(opt.doneText ?? `${opt.label}.`);
      } else {
        onOpenChange(false);
      }
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['contract'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>{task.context?.ask ?? task.title}</DialogTitle>
          <DialogDescription>{task.who}{task.jobTitle && task.who !== task.jobTitle ? ` · ${task.jobTitle}` : ''} · {waitingLabel(task)}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div><p className="font-medium">Erledigt.</p><p className="text-muted-foreground">{done}</p></div>
            </div>
            {next ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">Nächste Aufgabe</p>
                <p className="font-medium">{next.title}</p>
                <p className="text-xs text-muted-foreground">{next.who}{next.jobTitle ? ` · ${next.jobTitle}` : ''} · {waitingLabel(next)}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Damit ist alles erledigt.</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Schließen</Button>
              {next && <Button onClick={() => { onOpenChange(false); navigate(taskHref(next)); }}>Weiter zur nächsten</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <TaskContextBlock task={task} />

            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <Button key={o.key} type="button" size="sm" variant={choice === o.key ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => { setChoice(o.key); setError(null); }}>
                  {o.label}
                </Button>
              ))}
            </div>

            {opt?.hint && <p className="text-xs text-muted-foreground">{opt.hint}</p>}

            {opt?.field === 'reason' && (
              <div className="flex flex-wrap gap-1.5">
                <span className="w-full text-xs text-muted-foreground">Grund (Pflicht)</span>
                {(opt.reasons ?? []).map((r) => (
                  <Button key={r.key} type="button" size="sm" variant={values.reason === r.key ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setValues((v) => ({ ...v, reason: r.key }))}>{r.label}</Button>
                ))}
              </div>
            )}
            {opt?.field === 'nonstart' && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  <span className="w-full text-xs text-muted-foreground">Grund (Pflicht)</span>
                  {NON_START.map((r) => (
                    <Button key={r.key} type="button" size="sm" variant={values.reason === r.key ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setValues((v) => ({ ...v, reason: r.key }))}>{r.label}</Button>
                  ))}
                </div>
                <Textarea rows={2} placeholder="Was ist passiert? (optional)" value={values.text} onChange={(e) => setValues((v) => ({ ...v, text: e.target.value }))} />
              </div>
            )}
            {opt?.field === 'date' && (
              <label className="block text-sm"><span className="text-muted-foreground">{task.kind === 'invoice' ? 'Überwiesen am' : task.kind === 'confirm_start' ? 'Erster Arbeitstag' : 'Neue Frist'}</span>
                <Input type="date" className="mt-1 h-9 w-48" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} /></label>
            )}
            {opt?.field === 'text' && (
              <Textarea rows={task.kind === 'recruiter_question' ? 4 : 2} placeholder={task.kind === 'counter' ? 'z. B. Mehr ist im Budget nicht drin, dafür Start flexibel.' : task.kind === 'invoice' ? 'Ihre Frage an Matchunt …' : 'Ihre Antwort …'}
                value={values.text} onChange={(e) => setValues((v) => ({ ...v, text: e.target.value }))} />
            )}
            {opt?.field === 'colleague' && (
              <div className="flex flex-wrap gap-1.5">
                {colleagues === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : colleagues.length === 0 ? <p className="text-xs text-muted-foreground">Im Team der Stelle ist sonst niemand.</p>
                  : colleagues.map((c) => (
                    <Button key={c.userId} type="button" size="sm" variant={values.colleague === c.userId ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setValues((v) => ({ ...v, colleague: c.userId }))}>{c.name}</Button>
                  ))}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className={cn('text-xs text-muted-foreground', index < 0 && 'invisible')}>Aufgabe {index + 1} von {list.length}</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
                <Button disabled={busy || !opt} onClick={() => void submit()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{opt?.cta ?? 'Weiter'}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
