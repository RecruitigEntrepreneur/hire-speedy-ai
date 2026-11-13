import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { clientBundleSet, clientLangOfLocation, composeClientText, feedbackBundleSet, inDays } from '@/lib/aufgabenTexte';
import { intlLocale } from '@/i18n/languages';
import { candidateLanguage } from '@/lib/localeFormat';
import { WERKTAGE_BIS_NAECHSTE, addWorkdays, candidateUpdateChoice, candidateUpdateSubject, candidateUpdateText, updateWhen, type StalledBundle } from '@/lib/kundePrueft';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Check, Lock, Mail, Phone } from 'lucide-react';
import { dateShort, euro, firstName, viewLabel } from './taskWindow';
import { clockTime } from './sprache';
import { Honorar } from '@/components/recruiter/Honorar';

import { functionError } from '@/lib/functionError';

type Sent = { at: Date; nudged: string[] };

/**
 * Fenster für eine Zeile „Kunde prüft“ (20.10.2026): ein Ziel, drei Schritte.
 *   1 Kunden erinnern – eine Bitte für alle Kandidaten der Stelle, auf Wunsch zusammen
 *     mit den anderen Stellen desselben Kunden in EINER Mail.
 *   2 Danach im selben Fenster: Kandidaten Bescheid geben? Vorausgewählt nur, wer
 *     seit 5 Werktagen nichts von dir gehört hat. Die Aufgabe ist so oder so erledigt.
 *   3 Wartet 3 Werktage; dann einmal die 2. Erinnerung; danach übernimmt Matchunt.
 * Seit 28.10.2026 auch für „Kunde gibt kein Feedback“ (bundle.kind 'feedback'): gleiche
 * Schritte, Bitte um den Eindruck aus dem Interview (intent interview_feedback).
 */
export function KundePrueftWindow({ bundle, sameClient, startSent, onClose, onDone }: {
  bundle: StalledBundle | null;
  /** Weitere Zeilen desselben Kunden (nur wenn die Firma bekannt ist). */
  sameClient: StalledBundle[];
  /** Kunde schon erinnert (aus „Wartet auf andere“): direkt bei Schritt 2 beginnen. */
  startSent?: { at: string } | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation('recruiterTasks');
  const navigate = useNavigate();
  const [intent, setIntent] = useState<string>('decision');
  const [hints, setHints] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [clientEdit, setClientEdit] = useState<string | null>(null);
  const [candEdit, setCandEdit] = useState<string | null>(null);
  // Schon gesendeter Zwischenstand, auf Klick nachlesbar (05.11.2026)
  const [textOffen, setTextOffen] = useState(false);
  const [gesendeterText, setGesendeterText] = useState<string | null>(null);

  useEffect(() => {
    setIntent(startSent ? bundle?.items[0]?.lastNudgeIntent ?? 'decision' : 'decision');
    setHints([]);
    setClientEdit(null);
    setCandEdit(null);
    setTextOffen(false);
    setGesendeterText(null);
    setExtra(startSent ? [] : sameClient.map(b => b.key));
    if (bundle && startSent) {
      const nudged = bundle.items.map(i => i.submissionId).filter((x): x is string => !!x);
      setSent({ at: new Date(startSent.at), nudged });
      setChosen(bundle.items.filter(i => candidateUpdateChoice({
        hasEmail: !!i.candidateEmail, lastContactAt: i.lastCandidateContactAt ?? null, lastUpdateAt: i.lastCandidateUpdateAt ?? null, submittedAt: i.createdAt, anchor: feedback ? 'Interview' : 'Einreichung', nudgeAt: startSent.at,
      }, new Date()).preselect).map(i => i.itemId));
    } else {
      setSent(null);
      setChosen([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.key, startSent?.at]);

  const included = useMemo(
    () => (bundle ? [bundle, ...sameClient.filter(b => extra.includes(b.key))] : []),
    [bundle, sameClient, extra],
  );
  const items = included.flatMap(b => b.items);
  const feedback = bundle?.kind === 'feedback';
  const firstCandidate = items[0]?.candidateName ?? null;
  // Mailtext an den Kunden in seiner Sprache (aus dem Stellenort, sonst Deutsch)
  const clientLang = clientLangOfLocation(items[0]?.jobLocation);
  const set = useMemo(
    // Der Vorname geht in den Mailtext an den Kunden; ohne Namen greift dort der Ersatz in der Sprache des Kunden
    () => (feedback ? feedbackBundleSet(items.length, firstCandidate ? firstName(firstCandidate) : null, clientLang) : clientBundleSet(items.length, clientLang)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Beschriftung der Knöpfe folgt der Sprache
    [feedback, items.length, firstCandidate, clientLang, i18n.language],
  );
  // An den Server und für den Zwischenstand: nach dem Interview zählt der Eindruck, nicht eine Prüfung
  const sendIntent = feedback ? 'interview_feedback' : intent;
  // Text vor dem Senden änderbar (29.10.2026)
  const clientText = clientEdit ?? composeClientText(set, intent, hints);
  // Frist im Zwischenstand an den Kandidaten: Mailtext in der Sprache des Headhunters
  const candLang = candidateLanguage();
  const until = inDays(2, intlLocale(candLang));
  const now = new Date();
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]);

  if (!bundle) return null;
  // Zusammengefasste Kundenzeile (mehrere Stellen in einer Mail): Kopf und Grund zeigen alle (29.10.2026)
  const multi = included.length > 1;
  const first = items[0] ?? bundle.items[0];
  const fee = euro(included.reduce((sum, b) => sum + b.feeTotal, 0));
  const n = items.length;
  const days = Math.max(...included.map(b => b.days));
  // Frisch: ist das hier die 2. Erinnerung? Aus „Wartet“: wurde schon zweimal erinnert?
  const fristDate = sent ? dateShort(addWorkdays(sent.at, WERKTAGE_BIS_NAECHSTE).toISOString()) : null;
  const zweite = startSent ? bundle.items.some(i => (i.nudgeCount ?? 0) >= 2) : bundle.erinnerung === 2;

  const sendClient = async () => {
    setSending(true);
    const ids = items.map(i => i.submissionId).filter((x): x is string => !!x);
    // Erst fragen, ob die Function bündeln kann. Eine ältere Version würde je Kandidat
    // eine eigene Mail schicken – dann wird gar nicht gesendet (20.10.2026: 10 Mails).
    const probe = await supabase.functions.invoke('recruiter-notify', { body: { action: 'ping' } });
    if (!(probe.data as any)?.bundles) {
      setSending(false);
      toast.error(t('kp.toast.notLive'), {
        description: t('kp.toast.notLiveHint'),
      });
      return;
    }
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      body: { action: 'client_nudge', submissionIds: ids, submissionId: ids[0], text: clientText.trim(), intent: sendIntent, hints, lang: clientLang },
    });
    const failure = await functionError(error, data);
    const nudged: string[] = (data as any)?.nudged ?? [];
    setSending(false);
    if (failure || !nudged.length) {
      toast.error(failure ?? t('toast.sendFailed'));
      return;
    }
    const skipped = ids.length - nudged.length;
    toast.success([
      items.length > 1 ? t(feedback ? 'kp.toast.askedMany' : 'kp.toast.remindedMany', { count: nudged.length }) : t(feedback ? 'kp.toast.asked' : 'kp.toast.reminded'),
      skipped > 0 ? t('kp.toast.skipped', { count: skipped }) : '',
    ].filter(Boolean).join(' '));
    const done = items.filter(i => i.submissionId && nudged.includes(i.submissionId));
    setChosen(done.filter(i => candidateUpdateChoice({
      hasEmail: !!i.candidateEmail, lastContactAt: i.lastCandidateContactAt ?? null, lastUpdateAt: i.lastCandidateUpdateAt ?? null, submittedAt: i.createdAt, anchor: feedback ? 'Interview' : 'Einreichung', nudgeAt: now.toISOString(),
    }, now).preselect).map(i => i.itemId));
    setSent({ at: new Date(), nudged });
    onDone();
    notifyTasksChanged();
  };

  // Geht in den Mailtext an den Kandidaten (candidateUpdateText), in der Sprache des Headhunters
  const wann = updateWhen(sent?.at ?? new Date(), candLang);
  const updateItems = sent ? items.filter(i => i.submissionId && sent.nudged.includes(i.submissionId)) : [];
  // Zu dieser Erinnerung schon Bescheid gegeben: Zeile erledigt statt anhakbar (05.11.2026)
  const choiceOf = (i: (typeof items)[number]) => candidateUpdateChoice({
    hasEmail: !!i.candidateEmail, lastContactAt: i.lastCandidateContactAt ?? null, lastUpdateAt: i.lastCandidateUpdateAt ?? null, submittedAt: i.createdAt, anchor: feedback ? 'Interview' : 'Einreichung', nudgeAt: sent?.at.toISOString() ?? null,
  }, now);
  const offen = updateItems.filter(i => !choiceOf(i).erledigt);
  const bescheidGegeben = updateItems.filter(i => choiceOf(i).erledigt);
  const schritt2Erledigt = !!sent && updateItems.length > 0 && offen.length === 0;
  const wannKurz = (iso: string) => {
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString() ? t('nach.when.today', { time: clockTime(d) }) : t('nach.when.on', { date: dateShort(iso) });
  };
  const textUmschalten = async (submissionId: string | null | undefined) => {
    setTextOffen(o => !o);
    if (gesendeterText !== null || !submissionId) return;
    const { data } = await supabase.from('candidate_activity_log').select('description')
      .eq('related_submission_id', submissionId).contains('metadata', { kind: 'candidate_message' })
      .order('created_at', { ascending: false }).limit(1);
    setGesendeterText((data?.[0] as { description?: string | null } | undefined)?.description ?? '');
  };
  const chosenItems = updateItems.filter(i => chosen.includes(i.itemId));
  // Ein Kandidat: Text änderbar; mehrere: je Kandidat der passende Zwischenstand
  const singleText = chosenItems.length === 1 ? candEdit ?? candidateUpdateText(sendIntent, chosenItems[0].jobTitle, until, wann) : null;
  // Vorschau der Mail an den Kandidaten; „Hallo“ setzt der Server (deutsch) davor
  const preview = chosenItems.length > 1 ? `Hallo ${firstName(chosenItems[0].candidateName)}, ${candidateUpdateText(sendIntent, chosenItems[0].jobTitle, until, wann)}` : null;

  const sendCandidates = async () => {
    setSending(true);
    let ok = 0;
    for (const it of updateItems.filter(i => chosen.includes(i.itemId))) {
      const { data, error } = await supabase.functions.invoke('recruiter-notify', {
        body: { action: 'candidate_message', submissionId: it.submissionId, text: (singleText ?? candidateUpdateText(sendIntent, it.jobTitle, until, wann)).trim(), subject: candidateUpdateSubject(it.jobTitle, candLang), kind: 'zwischenstand', lang: candLang },
      });
      const f = await functionError(error, data);
      if (f) toast.error(`${it.candidateName}: ${f}`); else ok++;
    }
    setSending(false);
    if (ok) toast.success(t('kp.toast.updateSent', { count: ok }));
    onDone();
    notifyTasksChanged();
    onClose();
  };

  const callFirst = updateItems.find(i => chosen.includes(i.itemId) && i.candidatePhone);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b p-5 pb-4 text-left">
          <DialogTitle className="flex flex-wrap items-center gap-x-2 text-base">
            <span>{multi ? t('kp.titleMulti', { company: bundle.companyName ?? t('fallback.client'), count: included.length }) : bundle.jobTitle ?? t('fallback.job')}</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{sent ? t('kp.pillWaiting') : feedback ? t('guide.feedbackDue.pill') : t('guide.reviewStalled.pill')}</Badge>
            {fee && <span className="text-sm font-medium text-emerald-500 tabular-nums"><Honorar>{fee}</Honorar></span>}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1 text-xs">
            {multi ? included.map(b => b.jobTitle ?? t('fallback.job')).join(' · ') : bundle.companyName ?? t('kp.companyAnonymous')}{!multi && !bundle.companyName && <Lock className="h-3 w-3" />} · {t('kp.candidates', { count: n })}
          </DialogDescription>
          <p className="text-sm">
            {sent
              ? t(`kp.header.${feedback ? 'sentAsked' : 'sentReminded'}${zweite ? 'Second' : 'First'}`, { date: fristDate })
              : [
                n === 1
                  ? t(feedback ? 'kp.header.noFeedbackOne' : 'kp.header.silentOne', { days, name: first.candidateName ?? t('fallback.theCandidateDat') })
                  : t(feedback ? 'kp.header.noFeedbackMany' : 'kp.header.silentMany', { days, count: n }),
                zweite ? t(feedback ? 'kp.header.firstAskUnanswered' : 'kp.header.firstReminderUnanswered') : '',
              ].filter(Boolean).join(' ')}
          </p>
        </DialogHeader>

        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1.25fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.reason')}</p>
              <ul className="space-y-1.5 text-sm">
                {items.map(i => (
                  <li key={i.itemId} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{t(feedback ? 'kp.reasonInterview' : 'kp.reasonSubmitted', { who: `${i.candidateName}${multi && i.jobTitle ? ` (${i.jobTitle})` : ''}`, date: dateShort(feedback ? i.interviewAt ?? i.createdAt : i.createdAt) })}{!feedback && <span className={i.clientViewCount ? 'text-emerald-600' : 'text-amber-600'}> · {viewLabel(i.clientViewCount, i.clientLastViewedAt)}</span>}</span></li>
                ))}
                <li className="flex gap-2"><span className="text-muted-foreground">•</span><span>{feedback ? t('kp.sinceNoFeedback') : t('kp.sinceNoReaction')}</span></li>
                <li className="flex gap-2 text-muted-foreground"><span>→</span><span>{feedback ? t('kp.consequenceFeedback') : t('kp.consequenceReview')}</span></li>
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.history')}</p>
              {(() => {
                const rows = bundle.items.flatMap(i => [
                  i.lastNudgeAt ? { at: i.lastNudgeAt, text: t(feedback ? 'kp.log.asked' : 'kp.log.reminded', { name: i.candidateName }) } : null,
                  i.lastCandidateUpdateAt ? { at: i.lastCandidateUpdateAt, text: t('kp.log.update', { first: firstName(i.candidateName) }) } : null,
                ]).filter(Boolean) as { at: string; text: string }[];
                if (sent && !startSent) rows.unshift({ at: sent.at.toISOString(), text: t(feedback ? 'kp.log.askedNow' : 'kp.log.remindedNow') });
                return rows.length === 0
                  ? <p className="text-xs text-muted-foreground">{feedback ? t('kp.notAskedYet') : t('kp.notRemindedYet')}</p>
                  : <ul className="space-y-1 text-xs">{rows.sort((a, b) => b.at.localeCompare(a.at)).map((r, k) => <li key={k} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateShort(r.at)}</span><span>{r.text}</span></li>)}</ul>;
              })()}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.yourTask')}</p>

            {/* Schritt 1 */}
            <div className="flex gap-2.5">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium', sent ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground')}>{sent ? <Check className="h-3 w-3" /> : 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">{sent ? t(feedback ? 'kp.step1.asked' : 'kp.step1.reminded', { when: wannKurz(sent.at.toISOString()) }) : t(`kp.step1.${zweite ? 'second' : feedback ? 'ask' : 'remind'}${items.length > 1 ? 'Many' : ''}`, { count: items.length })}</p>
                {!sent && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {set.clientIntents.map(c => (
                        <Button key={c.key} size="sm" variant={intent === c.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setIntent(c.key); setClientEdit(null); }}>{c.label}</Button>
                      ))}
                    </div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.addHint')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {set.clientHints.map(c => (
                        <Button key={c.key} size="sm" variant={hints.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setHints(h => toggle(h, c.key)); setClientEdit(null); }}>{c.label}</Button>
                      ))}
                    </div>
                    <Textarea value={clientText} onChange={e => setClientEdit(e.target.value)} rows={4} className="text-sm" />
                    {sameClient.length > 0 && (
                      <div className="space-y-1.5 rounded-md border border-border/60 bg-background/60 p-2">
                        <p className="text-xs text-muted-foreground">{t('kp.sameClient', { company: bundle.companyName })}</p>
                        {sameClient.map(b => (
                          <label key={b.key} className="flex cursor-pointer items-center gap-2 text-xs">
                            <Checkbox checked={extra.includes(b.key)} onCheckedChange={() => setExtra(x => toggle(x, b.key))} />
                            <span>{b.jobTitle} · {t('kp.candidates', { count: b.items.length })}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{t('kp.mailInfo')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Schritt 2 */}
            <div className="flex gap-2.5">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium', schritt2Erledigt ? 'bg-emerald-500 text-white' : sent ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground')}>{schritt2Erledigt ? <Check className="h-3 w-3" /> : 2}</span>
              <div className="min-w-0 flex-1 space-y-2">
                {schritt2Erledigt ? (
                  <>
                    {bescheidGegeben.length === 1 ? (
                      <p className="text-sm font-medium">{t('kp.step2.toldOne', { first: firstName(bescheidGegeben[0].candidateName), when: wannKurz(choiceOf(bescheidGegeben[0]).erledigt!.at) })}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{t('kp.step2.toldMany')}</p>
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {bescheidGegeben.map(i => <li key={i.itemId}>{i.candidateName} · {wannKurz(choiceOf(i).erledigt!.at)}</li>)}
                        </ul>
                      </>
                    )}
                    {bescheidGegeben.length === 1 && (
                      <>
                        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => void textUmschalten(bescheidGegeben[0].submissionId)}>
                          {textOffen ? t('kp.step2.hideText') : t('kp.step2.showText')}
                        </button>
                        {textOffen && gesendeterText !== null && (
                          <p className="whitespace-pre-line rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">
                            {gesendeterText ? `Hallo ${firstName(bescheidGegeben[0].candidateName)},\n\n${gesendeterText}` : t('kp.step2.textGone')}
                          </p>
                        )}
                      </>
                    )}
                  </>
                ) : (
                <p className={cn('text-sm', sent ? 'font-medium' : 'text-muted-foreground')}>{sent ? t('kp.step2.title') : t('kp.step2.titleLater')}</p>
                )}
                {sent && !schritt2Erledigt && (
                  <>
                    <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-background/60">
                      {updateItems.map(i => {
                        const c = choiceOf(i);
                        if (c.erledigt) {
                          return (
                            <div key={i.itemId} className="flex items-start gap-2 p-2 text-xs text-muted-foreground">
                              <Check className="mt-0.5 h-4 w-4 shrink-0" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm">{i.candidateName}{included.length > 1 ? <span> · {i.jobTitle}</span> : null}</span>
                                <span className="block">{c.reason}</span>
                              </span>
                            </div>
                          );
                        }
                        return (
                          <label key={i.itemId} className={cn('flex items-start gap-2 p-2 text-xs', c.disabled ? 'opacity-60' : 'cursor-pointer')}>
                            <Checkbox className="mt-0.5" disabled={c.disabled} checked={chosen.includes(i.itemId)} onCheckedChange={() => { setChosen(x => toggle(x, i.itemId)); setCandEdit(null); }} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-foreground">{i.candidateName}{included.length > 1 ? <span className="text-muted-foreground"> · {i.jobTitle}</span> : null}</span>
                              <span className="block text-muted-foreground">{c.reason}</span>
                            </span>
                            {i.candidatePhone && <a href={`tel:${i.candidatePhone}`} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={t('plan.call', { first: i.candidateName })}><Phone className="h-3.5 w-3.5" /></a>}
                          </label>
                        );
                      })}
                    </div>
                    {singleText !== null && (
                      <div className="rounded-md border border-border/60 bg-background/60 p-2 text-sm">
                        {/* Anrede der Mail an den Kandidaten: bleibt deutsch */}
                        <p className="mb-1">Hallo {firstName(chosenItems[0].candidateName)},</p>
                        <Textarea value={singleText} onChange={e => setCandEdit(e.target.value)} rows={4} className="text-sm" />
                      </div>
                    )}
                    {preview && <p className="whitespace-pre-line rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{preview}</p>}
                    <p className="text-xs text-muted-foreground">{t('kp.step2.info')}</p>
                  </>
                )}
              </div>
            </div>

            {/* Schritt 3 */}
            <div className="flex gap-2.5">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px]', schritt2Erledigt ? 'bg-primary font-medium text-primary-foreground' : 'border border-border text-muted-foreground')}>3</span>
              <p className={cn('leading-5', schritt2Erledigt ? 'text-sm' : 'text-xs text-muted-foreground')}>
                {t(`kp.step3.${zweite ? 'second' : feedback ? 'firstAsk' : 'firstRemind'}${fristDate ? 'Until' : 'In3'}`, { date: fristDate })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-xs">
          <span className="text-muted-foreground"><Trans ns="recruiterTasks" i18nKey="window.goal" values={{ goal: feedback ? t('kp.goalFeedback') : t('kp.goalReview') }} components={{ g: <span className="font-medium text-emerald-500" /> }} /></span>
          <div className="flex flex-wrap items-center gap-1.5">
            {!sent ? (
              <>
                {first.submissionId && n === 1 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/recruiter/submissions/${first.submissionId}`)}>{t('window.submission')}</Button>
                )}
                <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || !clientText} onClick={sendClient}>
                  <Mail className="h-3 w-3" />{zweite ? t('kp.sendSecond') : feedback ? t('guide.askClient') : t('guide.remindClient')}
                </Button>
              </>
            ) : offen.length === 0 ? (
              <Button size="sm" className="h-8 text-xs" onClick={onClose}>{t('window.close')}</Button>
            ) : (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={sending} onClick={onClose}>{t('window.notNeeded')}</Button>
                {callFirst && (
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                    <a href={`tel:${callFirst.candidatePhone}`}><Phone className="h-3 w-3" />{t('kp.ratherCall')}</a>
                  </Button>
                )}
                <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || chosen.length === 0} onClick={sendCandidates}>
                  <Mail className="h-3 w-3" />{chosen.length === 0 ? t('kp.nobodyChosen') : chosen.length === 1 ? t('window.sendTo', { first: firstName(updateItems.find(i => chosen.includes(i.itemId))?.candidateName ?? null) }) : t('kp.sendToMany', { count: chosen.length })}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
