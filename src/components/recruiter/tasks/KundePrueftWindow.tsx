import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { clientBundleSet, composeClientText, inDays } from '@/lib/aufgabenTexte';
import { WERKTAGE_BIS_NAECHSTE, addWorkdays, candidateUpdateChoice, candidateUpdateText, type StalledBundle } from '@/lib/kundePrueft';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Check, Lock, Mail, Phone } from 'lucide-react';
import { dateDe, euro, firstName } from './taskWindow';
import { Honorar } from '@/components/recruiter/Honorar';

type Sent = { at: Date; nudged: string[] };

async function functionError(error: any, data: any): Promise<string | null> {
  if (data?.error) return typeof data.error === 'string' ? data.error : data.message ?? 'Senden fehlgeschlagen.';
  if (!error) return null;
  try {
    const body = await error.context?.json?.();
    if (body?.error || body?.message) return body.message ?? body.error;
  } catch { /* kein JSON */ }
  return /Failed to send a request/i.test(error.message ?? '')
    ? 'Senden nicht möglich: Die Function „recruiter-notify“ ist noch nicht deployt.'
    : error.message ?? 'Senden fehlgeschlagen.';
}

/**
 * Fenster für eine Zeile „Kunde prüft“ (20.10.2026): ein Ziel, drei Schritte.
 *   1 Kunden erinnern – eine Bitte für alle Kandidaten der Stelle, auf Wunsch zusammen
 *     mit den anderen Stellen desselben Kunden in EINER Mail.
 *   2 Danach im selben Fenster: Kandidaten Bescheid geben? Vorausgewählt nur, wer
 *     seit 5 Werktagen nichts von dir gehört hat. Die Aufgabe ist so oder so erledigt.
 *   3 Wartet 3 Werktage; dann einmal die 2. Erinnerung; danach übernimmt Matchunt.
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
  const navigate = useNavigate();
  const [intent, setIntent] = useState<string>('decision');
  const [hints, setHints] = useState<string[]>([]);
  const [extra, setExtra] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Sent | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    setIntent(startSent ? bundle?.items[0]?.lastNudgeIntent ?? 'decision' : 'decision');
    setHints([]);
    setExtra(startSent ? [] : sameClient.map(b => b.key));
    if (bundle && startSent) {
      const nudged = bundle.items.map(i => i.submissionId).filter((x): x is string => !!x);
      setSent({ at: new Date(startSent.at), nudged });
      setChosen(bundle.items.filter(i => candidateUpdateChoice({
        hasEmail: !!i.candidateEmail, lastContactAt: i.lastCandidateContactAt ?? null, lastUpdateAt: i.lastCandidateUpdateAt ?? null, submittedAt: i.createdAt,
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
  const set = useMemo(() => clientBundleSet(items.length), [items.length]);
  const clientText = composeClientText(set, intent, hints);
  const until = inDays(2);
  const now = new Date();
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]);

  if (!bundle) return null;
  const first = bundle.items[0];
  const fee = euro(bundle.feeTotal);
  const n = bundle.items.length;
  // Frisch: ist das hier die 2. Erinnerung? Aus „Wartet“: wurde schon zweimal erinnert?
  const frist = sent ? `bis ${dateDe(addWorkdays(sent.at, WERKTAGE_BIS_NAECHSTE).toISOString())}` : 'in 3 Werktagen';
  const zweite = startSent ? bundle.items.some(i => (i.nudgeCount ?? 0) >= 2) : bundle.erinnerung === 2;

  const sendClient = async () => {
    setSending(true);
    const ids = items.map(i => i.submissionId).filter((x): x is string => !!x);
    // Erst fragen, ob die Function bündeln kann. Eine ältere Version würde je Kandidat
    // eine eigene Mail schicken – dann wird gar nicht gesendet (20.10.2026: 10 Mails).
    const probe = await supabase.functions.invoke('recruiter-notify', { body: { action: 'ping' } });
    if (!(probe.data as any)?.bundles) {
      setSending(false);
      toast.error('Noch nicht gesendet: Die gebündelte Erinnerung ist noch nicht live.', {
        description: 'Bitte zuerst die Function „recruiter-notify“ in Lovable neu deployen (Nr. 23). Sonst bekäme der Kunde eine Mail je Kandidat.',
      });
      return;
    }
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      body: { action: 'client_nudge', submissionIds: ids, submissionId: ids[0], text: clientText, intent, hints },
    });
    const failure = await functionError(error, data);
    const nudged: string[] = (data as any)?.nudged ?? [];
    setSending(false);
    if (failure || !nudged.length) {
      toast.error(failure ?? 'Senden fehlgeschlagen.');
      return;
    }
    const skipped = ids.length - nudged.length;
    toast.success(`Kunde erinnert${items.length > 1 ? ` (${nudged.length} Kandidaten in einer Mail)` : ''}.${skipped > 0 ? ` ${skipped} war${skipped === 1 ? '' : 'en'} in den letzten 3 Tagen schon erinnert.` : ''}`);
    const done = items.filter(i => i.submissionId && nudged.includes(i.submissionId));
    setChosen(done.filter(i => candidateUpdateChoice({
      hasEmail: !!i.candidateEmail, lastContactAt: i.lastCandidateContactAt ?? null, lastUpdateAt: i.lastCandidateUpdateAt ?? null, submittedAt: i.createdAt,
    }, now).preselect).map(i => i.itemId));
    setSent({ at: new Date(), nudged });
    onDone();
    notifyTasksChanged();
  };

  const wann = sent && sent.at.toDateString() !== new Date().toDateString() ? `am ${dateDe(sent.at.toISOString())}` : 'heute';
  const updateItems = sent ? items.filter(i => i.submissionId && sent.nudged.includes(i.submissionId)) : [];
  const preview = (() => {
    const it = updateItems.find(i => chosen.includes(i.itemId));
    return it ? `Hallo ${firstName(it.candidateName)}, ${candidateUpdateText(intent, it.jobTitle, until, wann)}` : null;
  })();

  const sendCandidates = async () => {
    setSending(true);
    let ok = 0;
    for (const it of updateItems.filter(i => chosen.includes(i.itemId))) {
      const { data, error } = await supabase.functions.invoke('recruiter-notify', {
        body: { action: 'candidate_message', submissionId: it.submissionId, text: candidateUpdateText(intent, it.jobTitle, until, wann), subject: `Stand zu ${it.jobTitle ?? 'deiner Bewerbung'}`, kind: 'zwischenstand' },
      });
      const f = await functionError(error, data);
      if (f) toast.error(`${it.candidateName}: ${f}`); else ok++;
    }
    setSending(false);
    if (ok) toast.success(`Zwischenstand an ${ok} Kandidaten gesendet.`);
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
            <span>{bundle.jobTitle ?? 'Stelle'}</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{sent ? 'Wartet auf Kunde' : 'Prüfung'}</Badge>
            {fee && <span className="text-sm font-medium text-emerald-500 tabular-nums"><Honorar>{fee}</Honorar></span>}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1 text-xs">
            {bundle.companyName ?? 'Firma anonym'}{!bundle.companyName && <Lock className="h-3 w-3" />} · {n} {n === 1 ? 'Kandidat' : 'Kandidaten'}
          </DialogDescription>
          <p className="text-sm">
            {sent
              ? `Kunde erinnert. Kommt bis ${dateDe(addWorkdays(sent.at, WERKTAGE_BIS_NAECHSTE).toISOString())} nichts, ${zweite ? 'übernimmt Matchunt' : 'ist einmal die 2. Erinnerung dran'}.`
              : `Der Kunde hat sich zu ${n === 1 ? first.candidateName ?? 'dem Kandidaten' : `${n} Kandidaten`} seit ${bundle.days} Tagen nicht gemeldet.${zweite ? ' Die 1. Erinnerung blieb ohne Antwort.' : ''}`}
          </p>
        </DialogHeader>

        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1.25fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Grund</p>
              <ul className="space-y-1.5 text-sm">
                {bundle.items.map(i => (
                  <li key={i.itemId} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{i.candidateName}, eingereicht {dateDe(i.createdAt)}</span></li>
                ))}
                <li className="flex gap-2"><span className="text-muted-foreground">•</span><span>Seitdem keine Reaktion des Kunden.</span></li>
                <li className="flex gap-2 text-muted-foreground"><span>→</span><span>Ohne Nachfassen kühlt der Deal ab.</span></li>
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bisher</p>
              {(() => {
                const rows = bundle.items.flatMap(i => [
                  i.lastNudgeAt ? { at: i.lastNudgeAt, text: `Kunde erinnert · ${i.candidateName}` } : null,
                  i.lastCandidateUpdateAt ? { at: i.lastCandidateUpdateAt, text: `Zwischenstand an ${firstName(i.candidateName)}` } : null,
                ]).filter(Boolean) as { at: string; text: string }[];
                if (sent && !startSent) rows.unshift({ at: sent.at.toISOString(), text: 'Kunde erinnert (eben)' });
                return rows.length === 0
                  ? <p className="text-xs text-muted-foreground">Kunde noch nicht erinnert.</p>
                  : <ul className="space-y-1 text-xs">{rows.sort((a, b) => b.at.localeCompare(a.at)).map((r, k) => <li key={k} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateDe(r.at)}</span><span>{r.text}</span></li>)}</ul>;
              })()}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Deine Aufgabe</p>

            {/* Schritt 1 */}
            <div className="flex gap-2.5">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium', sent ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground')}>{sent ? <Check className="h-3 w-3" /> : 1}</span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-medium">{sent ? `Kunde erinnert · ${sent.at.toDateString() === new Date().toDateString() ? `heute ${sent.at.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : `am ${dateDe(sent.at.toISOString())}`}` : `${zweite ? '2. Erinnerung' : 'Kunden erinnern'}${items.length > 1 ? `, für ${items.length} Kandidaten` : ''}`}</p>
                {!sent && (
                  <>
                    <div className="flex flex-wrap gap-1.5">
                      {set.clientIntents.map(c => (
                        <Button key={c.key} size="sm" variant={intent === c.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setIntent(c.key)}>{c.label}</Button>
                      ))}
                    </div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hinweis mitgeben</p>
                    <div className="flex flex-wrap gap-1.5">
                      {set.clientHints.map(c => (
                        <Button key={c.key} size="sm" variant={hints.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setHints(h => toggle(h, c.key))}>{c.label}</Button>
                      ))}
                    </div>
                    <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{clientText}</p>
                    {sameClient.length > 0 && (
                      <div className="space-y-1.5 rounded-md border border-border/60 bg-background/60 p-2">
                        <p className="text-xs text-muted-foreground">Bei {bundle.companyName} warten auch, gleich in derselben Mail:</p>
                        {sameClient.map(b => (
                          <label key={b.key} className="flex cursor-pointer items-center gap-2 text-xs">
                            <Checkbox checked={extra.includes(b.key)} onCheckedChange={() => setExtra(x => toggle(x, b.key))} />
                            <span>{b.jobTitle} · {b.items.length} {b.items.length === 1 ? 'Kandidat' : 'Kandidaten'}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Eine Mail an das Kundenteam mit allen Kandidaten (vor Opt-In nur als Kürzel) und eine Benachrichtigung im Dashboard. Je Kandidat höchstens einmal in drei Tagen.</p>
                  </>
                )}
              </div>
            </div>

            {/* Schritt 2 */}
            <div className="flex gap-2.5">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium', sent ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground')}>2</span>
              <div className="min-w-0 flex-1 space-y-2">
                <p className={cn('text-sm', sent ? 'font-medium' : 'text-muted-foreground')}>Kandidaten Bescheid geben?{!sent && ' · kommt nach dem Senden'}</p>
                {sent && (
                  <>
                    <div className="divide-y divide-border/60 rounded-md border border-border/60 bg-background/60">
                      {updateItems.map(i => {
                        const c = candidateUpdateChoice({ hasEmail: !!i.candidateEmail, lastContactAt: i.lastCandidateContactAt ?? null, lastUpdateAt: i.lastCandidateUpdateAt ?? null, submittedAt: i.createdAt }, now);
                        return (
                          <label key={i.itemId} className={cn('flex items-start gap-2 p-2 text-xs', c.disabled ? 'opacity-60' : 'cursor-pointer')}>
                            <Checkbox className="mt-0.5" disabled={c.disabled} checked={chosen.includes(i.itemId)} onCheckedChange={() => setChosen(x => toggle(x, i.itemId))} />
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm text-foreground">{i.candidateName}{included.length > 1 ? <span className="text-muted-foreground"> · {i.jobTitle}</span> : null}</span>
                              <span className="block text-muted-foreground">{c.reason}</span>
                            </span>
                            {i.candidatePhone && <a href={`tel:${i.candidatePhone}`} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={`${i.candidateName} anrufen`}><Phone className="h-3.5 w-3.5" /></a>}
                          </label>
                        );
                      })}
                    </div>
                    {preview && <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{preview}</p>}
                    <p className="text-xs text-muted-foreground">Kommt von dir, Antworten landen bei dir. Ohne Firmennamen. Die Aufgabe ist schon erledigt, egal wie du hier entscheidest.</p>
                  </>
                )}
              </div>
            </div>

            {/* Schritt 3 */}
            <div className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">3</span>
              <p className="text-xs leading-5 text-muted-foreground">
                {zweite
                  ? `Kommt ${frist} nichts, übernimmt Matchunt. Für dich ist die Aufgabe dann zu Ende.`
                  : `Danach wartest du. Kommt ${frist} nichts, steht hier einmal die 2. Erinnerung. Danach übernimmt Matchunt.`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-xs">
          <span className="text-muted-foreground">Ziel: <span className="font-medium text-emerald-500">Der Kunde lädt ein, sagt ab oder fragt nach</span></span>
          <div className="flex flex-wrap items-center gap-1.5">
            {!sent ? (
              <>
                {first.submissionId && n === 1 && (
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/recruiter/submissions/${first.submissionId}`)}>Einreichung</Button>
                )}
                <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || !clientText} onClick={sendClient}>
                  <Mail className="h-3 w-3" />{zweite ? '2. Erinnerung senden' : 'Kunden erinnern'}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" className="h-8 text-xs" disabled={sending} onClick={onClose}>Nicht nötig</Button>
                {callFirst && (
                  <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild>
                    <a href={`tel:${callFirst.candidatePhone}`}><Phone className="h-3 w-3" />Lieber anrufen</a>
                  </Button>
                )}
                <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || chosen.length === 0} onClick={sendCandidates}>
                  <Mail className="h-3 w-3" />{chosen.length === 1 ? `An ${firstName(updateItems.find(i => chosen.includes(i.itemId))?.candidateName ?? null)} senden` : `An ${chosen.length} senden`}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
