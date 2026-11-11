import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { buchhaltungApi, dateDe, dateShort, todayIso, type CoopAction, type CoopDetail, type CoopSignal } from '@/lib/buchhaltungApi';
import { Empty, ErrorLine, Loading, errText, useRefresh } from '@/components/admin/buchhaltung/ui';

/**
 * Admin › Zusammenarbeit (F1, Umbau 11.11.2026): faire Zusammenarbeit je Kunde.
 * /admin/zusammenarbeit           Kunden mit Signal (Einstieg)
 * /admin/zusammenarbeit/:ownerId  Stufen, Signale, Verlauf, Aktionen
 */
export default function AdminZusammenarbeit() {
  const { ownerId } = useParams<{ ownerId?: string }>();
  return <DashboardLayout>{ownerId ? <Detail ownerId={ownerId} /> : <Liste />}</DashboardLayout>;
}

function SignalLine({ s }: { s: CoopSignal }) {
  return (
    <li className="flex gap-2">
      <span className={cn('w-4 shrink-0 text-center', s.level === 'warn' ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
        {s.level === 'warn' ? '!' : s.level === 'ok' ? <Check className="mt-0.5 h-4 w-4" /> : '·'}
      </span>
      <span className="flex-1">{s.text}</span>
      {s.link && <Link to={s.link} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Ansehen</Link>}
    </li>
  );
}

function Liste() {
  const [all, setAll] = useState(false);
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'zusammenarbeit', all], queryFn: () => buchhaltungApi.cooperationList(all) });
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Zusammenarbeit</h1>
          <p className="text-sm text-muted-foreground">Kunden, bei denen die Zusammenarbeit hakt. Stufe 1 läuft automatisch, ab Stufe 2 entscheidest du per Klick.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAll(!all)}>{all ? 'Nur mit Signal' : 'Alle Kunden'}</Button>
      </div>
      {q.isLoading ? <Loading /> : q.error || !q.data ? <ErrorLine error={q.error} /> : q.data.clients.length === 0 ? (
        <Empty>{all ? 'Noch keine Kunden mit Stellen.' : 'Gerade hakt es bei keinem Kunden.'}</Empty>
      ) : (
        <div className="divide-y rounded-lg border">
          {q.data.clients.map((c) => (
            <Link key={c.ownerId} to={`/admin/zusammenarbeit/${c.ownerId}`} className="flex flex-wrap items-start gap-3 p-3 text-sm hover:bg-muted/40">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.company} <span className="font-normal text-muted-foreground">· {c.jobs} {c.jobs === 1 ? 'Stelle' : 'Stellen'}</span></p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {c.signals.slice(0, 3).map((s) => <li key={s.key + s.text} className={cn(s.level === 'warn' && 'text-destructive')}>{s.level === 'warn' ? '! ' : '· '}{s.text}</li>)}
                </ul>
              </div>
              <span className="text-xs text-muted-foreground">{c.stageLabel ? `Stufe ${c.stage}: ${c.stageLabel}${c.stageSince ? ` · seit ${dateShort(c.stageSince)}` : ''}` : 'keine Stufe'}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type Open = null | 'call' | 'hint' | 'pause' | 'resume' | 'end' | 'terminate';

function Detail({ ownerId }: { ownerId: string }) {
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'zusammenarbeit', 'detail', ownerId], queryFn: () => buchhaltungApi.cooperationDetail(ownerId) });
  const [open, setOpen] = useState<Open>(null);
  const d = q.data;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link to="/admin/zusammenarbeit"><ArrowLeft className="mr-1 h-4 w-4" />Alle Kunden mit Signal</Link></Button>
      {q.isLoading ? <Loading /> : q.error || !d ? <ErrorLine error={q.error} /> : (
        <>
          <div>
            <h1 className="text-2xl font-semibold">{d.company}</h1>
            <p className="text-sm text-muted-foreground">{[d.since ? `seit ${dateDe(d.since).slice(3)}` : null, `${d.activeJobs} ${d.activeJobs === 1 ? 'Stelle' : 'Stellen'}`, d.ownerName].filter(Boolean).join(' · ')}</p>
          </div>
          <ol className="flex flex-wrap gap-1.5 text-xs">
            {d.stages.map((s, i) => (
              <li key={s} className={cn('rounded-full border px-2.5 py-1 text-muted-foreground', d.stage === i + 1 && 'border-foreground/40 font-medium text-foreground')}>{i + 1} {s}</li>
            ))}
          </ol>
          <p className="text-sm">{d.stageLabel ? <>Aktuelle Stufe: {d.stageLabel}{d.stageSince ? ` · seit ${dateShort(d.stageSince)}` : ''}</> : <span className="text-muted-foreground">Keine Stufe, alles läuft normal.</span>}</p>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Signale</p>
            {d.signals.length ? <ul className="space-y-1.5 text-sm">{d.signals.map((s) => <SignalLine key={s.key + s.text} s={s} />)}</ul> : <p className="text-sm text-muted-foreground">Keine Signale.</p>}
            <p className="text-xs text-muted-foreground">Warnzeichen nur bei Signalen, die gerade über der Grenze liegen.</p>
          </div>

          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">Verlauf</p>
            {d.history.length === 0 ? <p className="text-sm text-muted-foreground">Noch nichts.</p> : (
              <ul className="space-y-1.5 text-sm">
                {d.history.map((h) => (
                  <li key={h.id} className="flex gap-2">
                    <span className="w-4 shrink-0 text-center text-muted-foreground">·</span>
                    <span className="flex-1">
                      {h.label}{h.jobTitle ? ` · ${h.jobTitle}` : ''}{h.deadline ? ` · Frist ${dateShort(h.deadline)}` : ''}
                      {h.note && <span className="block whitespace-pre-line text-xs text-muted-foreground">{h.kind === 'hint' ? h.note.split('\n')[0] : `„${h.note}“`}</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">{dateShort(h.at)} · {h.by}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setOpen('call')}>Gespräch notieren</Button>
            <Button size="sm" variant="outline" onClick={() => setOpen('hint')}>Hinweis mit Frist senden</Button>
            <Button size="sm" variant="outline" disabled={!d.jobs.some((j) => j.status === 'published' && !j.cooperationPaused)} onClick={() => setOpen('pause')}>Stelle ruhen lassen</Button>
            {d.jobs.some((j) => j.cooperationPaused) && <Button size="sm" variant="outline" onClick={() => setOpen('resume')}>Stelle fortsetzen</Button>}
            <Button size="sm" variant="outline" onClick={() => setOpen('end')}>Bearbeitung beenden</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen('terminate')}>Vertrag kündigen</Button>
          </div>
          <p className="text-xs text-muted-foreground">Jede Stufe ab 2 löst Matchunt per Klick aus. „Stelle ruhen lassen“ informiert die suchenden Headhunter. „Bearbeitung beenden“ beendet auch eine laufende Nachbesetzung.</p>
          <ActionDialog open={open} detail={d} onClose={() => setOpen(null)} />
        </>
      )}
    </div>
  );
}

const TITLES: Record<Exclude<Open, null>, { title: string; desc: string; button: string }> = {
  call: { title: 'Gespräch notieren', desc: 'Stufe 2. Was wurde besprochen, was wurde zugesagt?', button: 'Notieren' },
  hint: { title: 'Hinweis mit Frist senden', desc: 'Stufe 3. Geht als Mail an den Kunden und bleibt als Nachweis im Verlauf. Sachlich und freundlich.', button: 'Hinweis senden' },
  pause: { title: 'Stelle ruhen lassen', desc: 'Stufe 4. Die Suche hält an, die suchenden Headhunter und der Kunde bekommen eine Mitteilung.', button: 'Ruhen lassen' },
  resume: { title: 'Stelle fortsetzen', desc: 'Die Suche läuft wieder, Headhunter und Kunde werden informiert.', button: 'Fortsetzen' },
  end: { title: 'Bearbeitung beenden', desc: 'Stufe 5. Die Stelle schließt; eine laufende Nachbesetzung endet mit. Kosten entstehen dem Kunden nicht (§ 4 Abs. 6).', button: 'Beenden' },
  terminate: { title: 'Vertrag kündigen', desc: 'Nur ein Vermerk mit Grund. Die App kündigt nicht selbst; die Kündigung geht in Textform an den Kunden.', button: 'Vermerken' },
};

function ActionDialog({ open, detail, onClose }: { open: Open; detail: CoopDetail; onClose: () => void }) {
  const refresh = useRefresh();
  const [note, setNote] = useState('');
  const [mail, setMail] = useState('');
  const [deadline, setDeadline] = useState('');
  const [email, setEmail] = useState('');
  const [jobs, setJobs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setNote('');
    setMail(detail.hint.text);
    setDeadline(detail.hint.deadline);
    setEmail(detail.ownerEmail ?? '');
    setJobs([]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Frist im Text mitziehen
  const changeDeadline = (v: string) => {
    if (deadline && v) setMail((m) => m.split(dateDe(deadline)).join(dateDe(v)));
    setDeadline(v);
  };
  if (!open) return null;
  const t = TITLES[open];
  const selectable = detail.jobs.filter((j) => (open === 'pause' ? j.status === 'published' && !j.cooperationPaused : open === 'resume' ? j.cooperationPaused : open === 'end'));
  const needsJobs = open === 'pause' || open === 'resume' || open === 'end';
  const needsNote = open === 'call' || open === 'end' || open === 'terminate';
  const action: CoopAction = open;
  const save = async () => {
    setBusy(true);
    try {
      const r = await buchhaltungApi.cooperationAction(detail.ownerId, action, { note: note.trim() || undefined, jobIds: needsJobs ? jobs : undefined, mailText: open === 'hint' ? mail : undefined, deadline: open === 'hint' ? deadline : undefined, email: open === 'hint' ? email.trim() : undefined });
      toast.success(r.hint ?? (open === 'hint' ? `Hinweis an ${r.sentTo} geschickt.` : 'Gespeichert.'));
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const valid = (!needsJobs || jobs.length > 0) && (!needsNote || note.trim().length > 0) && (open !== 'hint' || (mail.trim().length >= 20 && deadline > todayIso() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>{t.title} · {detail.company}</DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {needsJobs && (
            selectable.length === 0 ? <p className="text-muted-foreground">Keine passende Stelle.</p> : (
              <div className="space-y-1.5 rounded-lg border p-3">
                {selectable.map((j) => (
                  <label key={j.id} className="flex items-center gap-2">
                    <Checkbox checked={jobs.includes(j.id)} onCheckedChange={(v) => setJobs(v === true ? [...jobs, j.id] : jobs.filter((x) => x !== j.id))} />
                    <span>{j.title}{j.research ? ' · Nachbesetzung' : ''}{j.cooperationPaused ? ` · ruht seit ${dateShort(j.pausedAt)}` : ''}</span>
                  </label>
                ))}
              </div>
            )
          )}
          {open === 'hint' && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block"><span className="text-muted-foreground">An</span><Input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 h-9" /></label>
                <label className="block"><span className="text-muted-foreground">Frist</span><Input type="date" min={todayIso()} value={deadline} onChange={(e) => changeDeadline(e.target.value)} className="mt-1 h-9" /></label>
              </div>
              <label className="block"><span className="text-muted-foreground">Text</span><Textarea value={mail} onChange={(e) => setMail(e.target.value)} rows={12} className="mt-1" /></label>
            </>
          )}
          {open !== 'hint' && (
            <label className="block">
              <span className="text-muted-foreground">{open === 'call' ? 'Was wurde besprochen?' : needsNote ? 'Grund (Pflicht)' : 'Notiz (optional)'}</span>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1" />
            </label>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant={open === 'end' ? 'destructive' : 'default'} disabled={busy || !valid} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t.button}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
