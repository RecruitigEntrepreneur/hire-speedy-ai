import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { notifyTasksChanged, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { notifyCandidateChanged } from '@/hooks/useCandidateDossier';
import { meetingTypeLabel } from '@/components/interview/agenda/meetingType';
import { NOTICE_OPTIONS } from '@/lib/candidateDossier';
import {
  ANGEBOT_PUNKTE, BAUCH, DREI, LEER, START, ausZeile, euroVoll, gehaltAbgleich, istAusgefuellt, kundenText,
  parseEuro, startAbgleich, zuZeile, zusammenfassung, type Abgleich, type Nachgespraech,
} from '@/lib/nachgespraech';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format, isToday, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';
import { AlertTriangle, CalendarDays, Check, Lock, Mail, Phone } from 'lucide-react';
import { Honorar } from '@/components/recruiter/Honorar';

/** Was das Fenster über das Interview wissen muss – aus der Aufgabe oder der Interview-Seite. */
export interface NachTarget {
  interviewId: string;
  submissionId: string | null;
  candidateId: string | null;
  candidateName: string | null;
  candidatePhone: string | null;
  jobId: string | null;
  jobTitle: string | null;
  companyName: string | null;
  feeValue: number | null;
  scheduledAt: string | null;
}

export const nachTargetFromItem = (item: UnifiedTaskItem): NachTarget => ({
  interviewId: item.itemId.replace('derived-debrief-', ''),
  submissionId: item.submissionId,
  candidateId: item.candidateId,
  candidateName: item.candidateName,
  candidatePhone: item.candidatePhone,
  jobId: item.jobId,
  jobTitle: item.jobTitle,
  companyName: item.companyName,
  feeValue: item.feeValue,
  scheduledAt: item.createdAt,
});

const first = (name: string | null) => (name ? name.trim().split(/\s+/)[0] : 'den Kandidaten');
const initials = (name: string | null) => (name ?? '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
const kEuro = (n: number | null) => (n && n > 0 ? `${Math.round(n / 1000)}.000 €` : null);
const uhr = (d: Date) => format(d, 'HH:mm', { locale: de });
const wann = (d: Date) => (isToday(d) ? `heute ${uhr(d)}` : isYesterday(d) ? `gestern ${uhr(d)}` : `am ${format(d, 'dd.MM.', { locale: de })}`);
/** Kein doppelter Punkt nach einem Datum („am 13.10.“). */
const satz = (t: string) => (t.endsWith('.') ? t : `${t}.`);
const tag = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE');
const zahl = (n: number | null) => (n ? n.toLocaleString('de-DE') : '');
const tableMissing = (e: { code?: string; message?: string }) =>
  e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? '');

interface Umfeld {
  interview: { scheduled_at: string | null; duration_minutes: number | null; meeting_type: string | null } | null;
  akte: { expected_salary: number | null; notice_period: string | null; availability_date: string | null };
  stelle: { salary_min: number | null; salary_max: number | null };
  rollen: { title: string | null; is_decision_maker: boolean }[];
  verlauf: { title: string; created_at: string }[];
}
const UMFELD_LEER: Umfeld = { interview: null, akte: { expected_salary: null, notice_period: null, availability_date: null }, stelle: { salary_min: null, salary_max: null }, rollen: [], verlauf: [] };

function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T | null; onChange: (v: T | null) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <Button key={o.key} type="button" size="sm" variant={value === o.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => onChange(value === o.key ? null : o.key)}>{o.label}</Button>
      ))}
    </div>
  );
}

function MultiChips({ options, value, onChange }: { options: { key: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <Button key={o.key} type="button" size="sm" variant={value.includes(o.key) ? 'default' : 'outline'} className="h-7 text-xs"
          onClick={() => onChange(value.includes(o.key) ? value.filter(k => k !== o.key) : [...value, o.key])}>{o.label}</Button>
      ))}
    </div>
  );
}

function Frage({ label, fehlt, children }: { label: string; fehlt?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5 border-t border-border/50 pt-2.5 first:border-0 first:pt-0">
      <p className={cn('text-xs font-medium', fehlt && 'text-amber-600')}>{label}{fehlt && <span className="ml-1.5 font-normal">· fehlt noch</span>}</p>
      {children}
    </div>
  );
}

/**
 * Aufgabe „Nachgespräch“ (20.10.2026, ersetzt das Debrief). Ein Fenster, drei Schritte:
 * 1 Kandidaten anrufen, 2 festhalten, was er sagt, 3 den Kunden nach seinem Eindruck
 * fragen. Nach dem Festhalten bleibt das Fenster offen: Abgleich mit Akte und Stelle,
 * dann die Frage an den Kunden. Gehalt, Angebot, Start und Bedenken bleiben bei dir.
 */
/** Feedback des Kunden aus interviews.feedback, kurz für den Headhunter. */
const WEG: Record<string, string> = { next_round: 'nächste Runde', proceed: 'nächste Runde', offer: 'Angebot', unsure: 'noch unsicher', maybe: 'noch unsicher', reject: 'Absage' };
function kundenFeedbackAus(raw: string | null): { weg: string; eindruck: string | null } | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw);
    const weg = WEG[f?.recommendation] ?? null;
    if (!weg) return null;
    const text = String(f.impression || f.notes || '').trim();
    return { weg, eindruck: text ? (text.length > 200 ? `${text.slice(0, 200)}…` : text) : null };
  } catch {
    return null;
  }
}

export function NachgespraechWindow({ target, onClose, onDone, laterSlot }: {
  target: NachTarget | null;
  onClose: () => void;
  onDone?: () => void;
  /** „Später“-Menü der Aufgabenseite, wenn die Aufgabe vertagt werden kann */
  laterSlot?: ReactNode;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { logActivity } = useActivityLogger();
  const [form, setForm] = useState<Nachgespraech>({ ...LEER });
  const [euroText, setEuroText] = useState({ gk: '', gf: '', af: '' });
  const [umfeld, setUmfeld] = useState<Umfeld>(UMFELD_LEER);
  const [loading, setLoading] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [existing, setExisting] = useState(false);
  const [editing, setEditing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState<string[]>([]);
  const [askedAt, setAskedAt] = useState<Date | null>(null);
  const [kundenFeedback, setKundenFeedback] = useState<{ weg: string; eindruck: string | null } | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!target || !user) return;
    let alive = true;
    setForm({ ...LEER }); setEuroText({ gk: '', gf: '', af: '' }); setUmfeld(UMFELD_LEER);
    setSavedAt(null); setExisting(false); setEditing(true); setApplied([]); setAskedAt(null); setKundenFeedback(null);
    setLoading(true);
    (async () => {
      const [iv, row, cand, job, rollen, log, frage] = await Promise.all([
        supabase.from('interviews').select('scheduled_at, duration_minutes, meeting_type, feedback').eq('id', target.interviewId).maybeSingle(),
        (supabase as any).from('interview_nachgespraeche').select('*').eq('interview_id', target.interviewId).eq('recruiter_id', user.id).maybeSingle(),
        target.candidateId ? supabase.from('candidates').select('expected_salary, salary_fix, notice_period, availability_date').eq('id', target.candidateId).maybeSingle() : Promise.resolve({ data: null }),
        target.jobId ? supabase.from('recruiter_jobs_view').select('salary_min, salary_max').eq('id', target.jobId).maybeSingle() : Promise.resolve({ data: null }),
        (supabase.rpc as any)('recruiter_interview_attendee_roles', { p_interview_id: target.interviewId }),
        target.submissionId
          ? supabase.from('candidate_activity_log').select('title, created_at').eq('related_submission_id', target.submissionId).order('created_at', { ascending: false }).limit(5)
          : Promise.resolve({ data: [] }),
        // Wurde der Kunde schon nach seinem Eindruck gefragt?
        target.submissionId
          ? supabase.from('candidate_activity_log').select('created_at').eq('related_submission_id', target.submissionId)
            .contains('metadata', { kind: 'client_nudge', intent: 'interview_feedback' }).order('created_at', { ascending: false }).limit(1)
          : Promise.resolve({ data: [] }),
      ]);
      if (!alive) return;
      const gefragt = ((frage as any).data ?? [])[0]?.created_at as string | undefined;
      if (gefragt) setAskedAt(new Date(gefragt));
      // Hat der Kunde schon Feedback gegeben? Dann nicht mehr nachfragen, sondern zeigen.
      setKundenFeedback(kundenFeedbackAus((iv as any).data?.feedback ?? null));
      const c = (cand as any).data;
      setUmfeld({
        interview: (iv as any).data ?? null,
        akte: { expected_salary: c?.expected_salary ?? c?.salary_fix ?? null, notice_period: c?.notice_period ?? null, availability_date: c?.availability_date ?? null },
        stelle: { salary_min: (job as any).data?.salary_min ?? null, salary_max: (job as any).data?.salary_max ?? null },
        rollen: ((rollen as any)?.data ?? []) as Umfeld['rollen'],
        verlauf: ((log as any).data ?? []) as Umfeld['verlauf'],
      });
      const r = (row as any).data;
      if (r) {
        const f = ausZeile(r);
        setForm(f);
        setEuroText({ gk: zahl(f.gehalt_kandidat), gf: zahl(f.gehalt_firma), af: zahl(f.angebot_fix_min) });
        setSavedAt(new Date(r.updated_at ?? r.created_at));
        setExisting(true);
        setEditing(false);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [target?.interviewId, user?.id]);

  // Abgleich rechnet mit dem, was gerade im Formular steht
  const aktuell = useMemo<Nachgespraech>(() => ({
    ...form, gehalt_kandidat: parseEuro(euroText.gk), gehalt_firma: parseEuro(euroText.gf), angebot_fix_min: parseEuro(euroText.af),
  }), [form, euroText]);
  const today = new Date();
  const gehalt = useMemo(() => gehaltAbgleich(aktuell, { akte: umfeld.akte.expected_salary, stelleMin: umfeld.stelle.salary_min, stelleMax: umfeld.stelle.salary_max }), [aktuell, umfeld]);
  const start = useMemo(() => startAbgleich(aktuell, { noticePeriod: umfeld.akte.notice_period, availabilityDate: umfeld.akte.availability_date }, today), [aktuell, umfeld]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!target) return null;
  const name = target.candidateName || 'Kandidat';
  const vorname = first(target.candidateName);
  // Ohne Namen neutral statt „er“ (Live-Test 23.10.2026)
  const werNom = target.candidateName?.trim() ? vorname : 'die Person';
  const fee = kEuro(target.feeValue);
  const ivAt = umfeld.interview?.scheduled_at ?? target.scheduledAt;
  const saved = !editing && !!savedAt;
  const set = <K extends keyof Nachgespraech>(k: K, v: Nachgespraech[K]) => setForm(f => ({ ...f, [k]: v }));
  const noticeLabel = umfeld.akte.notice_period ? NOTICE_OPTIONS.find(o => o.value === umfeld.akte.notice_period)?.label ?? umfeld.akte.notice_period : null;

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { data, error } = await (supabase as any).from('interview_nachgespraeche')
      .upsert({ interview_id: target.interviewId, recruiter_id: user.id, ...zuZeile(aktuell) }, { onConflict: 'interview_id,recruiter_id' })
      .select('*').single();
    setSaving(false);
    if (error) {
      toast.error(tableMissing(error) ? 'Noch nicht gespeichert: Das Nachgespräch ist noch nicht live (Lovable Nr. 25).' : `Nicht gespeichert: ${error.message}`);
      return;
    }
    const f = ausZeile(data);
    setForm(f);
    setEuroText({ gk: zahl(f.gehalt_kandidat), gf: zahl(f.gehalt_firma), af: zahl(f.angebot_fix_min) });
    setSavedAt(new Date());
    setEditing(false);
    if (target.candidateId) {
      await logActivity(target.candidateId, 'note', existing ? 'Nachgespräch aktualisiert' : 'Nachgespräch festgehalten', undefined,
        { kind: 'nachgespraech', interview_id: target.interviewId }, target.submissionId ?? undefined);
    }
    setExisting(true);
    onDone?.();
    notifyTasksChanged();
  };

  const uebernehmen = async (a: NonNullable<Abgleich['akte']>) => {
    if (!target.candidateId) return;
    const patch = a.field === 'expected_salary' ? { expected_salary: a.value, salary_fix: a.value } : { availability_date: a.value };
    const { error } = await supabase.from('candidates').update(patch as never).eq('id', target.candidateId);
    if (error) { toast.error('Akte nicht geändert.'); return; }
    setApplied(l => [...l, a.field]);
    setUmfeld(u => ({ ...u, akte: { ...u.akte, ...(a.field === 'expected_salary' ? { expected_salary: a.value as number } : { availability_date: a.value as string }) } }));
    notifyCandidateChanged(target.candidateId);
    toast.success('In die Akte übernommen.');
  };

  const askClient = async () => {
    if (!target.submissionId) return;
    setAsking(true);
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      body: { action: 'client_nudge', submissionId: target.submissionId, text: kundenText(form), intent: 'interview_feedback' },
    });
    setAsking(false);
    const failure = error?.message || (data as any)?.error || ((data as any)?.message && !(data as any)?.ok ? (data as any).message : null);
    if (failure) {
      const msg = typeof failure === 'string' ? failure : 'Senden fehlgeschlagen.';
      toast.error(/Failed to send a request/i.test(msg) ? 'Senden nicht möglich: Die Function „recruiter-notify“ ist noch nicht deployt.' : msg);
      return;
    }
    setAskedAt(new Date());
    toast.success(`Kunde gefragt (${(data as any)?.recipients ?? 1} Empfänger).`);
    onDone?.();
    notifyTasksChanged();
  };

  const abgleich = [gehalt, start].filter((a): a is Abgleich => !!a);

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b p-5 pb-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{initials(target.candidateName)}</div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-x-2 text-base">
                <span>{name}</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">Nachgespräch</Badge>
                {fee && <span className="text-sm font-medium tabular-nums text-emerald-500"><Honorar>{fee}</Honorar></span>}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1 text-xs">
                {target.jobTitle}{target.companyName ? ` · ${target.companyName}` : ''}
                {!target.companyName && <Lock className="h-3 w-3" />}
              </DialogDescription>
            </div>
          </div>
          <p className="text-sm">
            {saved
              ? 'Nachgespräch festgehalten. Die Aufgabe ist erledigt.'
              : ivAt && Date.now() - new Date(ivAt).getTime() >= 48 * 3_600_000
                // Nach zwei Tagen ist nichts mehr frisch (Durchklick 27.10.2026)
                ? `${satz(`Interview war ${wann(new Date(ivAt))}`)} ${vorname} wartet auf deine Rückmeldung.`
                : ivAt ? `${satz(`Interview war ${wann(new Date(ivAt))}`)} Ruf ${vorname} an, solange es frisch ist.` : `Ruf ${vorname} an, solange es frisch ist.`}
          </p>
        </DialogHeader>

        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1.45fr]">
          {/* Links: Interview, Vergleich, Bisher / Festgehalten */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Interview</p>
              {ivAt ? (
                <p>{format(new Date(ivAt), 'EEE, dd.MM., HH:mm', { locale: de })} Uhr · {umfeld.interview?.duration_minutes ?? 60} Min. · {meetingTypeLabel(umfeld.interview?.meeting_type ?? null)}</p>
              ) : <p className="text-muted-foreground">Ohne Termin</p>}
              {umfeld.rollen.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">Beim Kunden dabei: {umfeld.rollen.map(r => `${r.title || 'ohne Funktion'}${r.is_decision_maker ? ' (entscheidet)' : ''}`).join(' · ')}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Zum Vergleich, aus Akte und Stelle</p>
              <ul className="space-y-0.5 text-xs">
                <li>Wunschgehalt Akte: {umfeld.akte.expected_salary ? euroVoll(umfeld.akte.expected_salary) : <span className="text-muted-foreground">nicht eingetragen</span>}</li>
                <li>Stelle: {umfeld.stelle.salary_min || umfeld.stelle.salary_max
                  ? [umfeld.stelle.salary_min, umfeld.stelle.salary_max].filter(Boolean).map(n => euroVoll(n as number)).join('–')
                  : <span className="text-muted-foreground">ohne Gehaltsangabe</span>}</li>
                <li>Kündigungsfrist Akte: {noticeLabel ?? <span className="text-muted-foreground">nicht eingetragen</span>}</li>
                {umfeld.akte.availability_date && <li>Verfügbar ab Akte: {tag(umfeld.akte.availability_date)}</li>}
              </ul>
            </div>
            {saved ? (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Festgehalten · {wann(savedAt!)}</p>
                <ul className="space-y-0.5 text-xs">
                  {zusammenfassung(form, today, umfeld.akte.notice_period).map((z, i) => <li key={i}>{z}</li>)}
                  {form.bedenken && <li className="text-muted-foreground">Bedenken: {form.bedenken}</li>}
                </ul>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bisher</p>
                {umfeld.verlauf.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{loading ? 'Lädt …' : 'Noch kein Kontakt zu diesem Deal.'}</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {umfeld.verlauf.map((h, i) => <li key={i} className="flex gap-2"><span className="w-12 shrink-0 tabular-nums text-muted-foreground">{format(new Date(h.created_at), 'dd.MM.', { locale: de })}</span><span>{h.title}</span></li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Rechts: Deine Aufgabe */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Deine Aufgabe</p>
            {!saved ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px]">1</span>
                  <p className="flex-1 text-sm font-medium">{vorname} anrufen</p>
                  {target.candidatePhone
                    ? <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" asChild><a href={`tel:${target.candidatePhone}`}><Phone className="h-3 w-3" />Anrufen</a></Button>
                    : <span className="text-xs text-muted-foreground">Keine Nummer in der Akte</span>}
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px]">2</span>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <p className="text-sm font-medium">Festhalten, was {vorname} sagt</p>
                    <Frage label="Wie ist es gelaufen?">
                      <Textarea value={form.verlauf} onChange={e => set('verlauf', e.target.value)} rows={2} className="text-sm" placeholder={`Was hat ${werNom} gefallen, was nicht? Möglichst in eigenen Worten`} />
                    </Frage>
                    <Frage label="Bauchgefühl" fehlt={!form.bauchgefuehl}>
                      <Chips options={BAUCH} value={form.bauchgefuehl} onChange={v => set('bauchgefuehl', v)} />
                    </Frage>
                    <Frage label="Zusammenarbeit mit den Ansprechpartnern vorstellbar?">
                      <Chips options={DREI} value={form.zusammenarbeit} onChange={v => set('zusammenarbeit', v)} />
                      <Input value={form.ansprechpartner} onChange={e => set('ansprechpartner', e.target.value)} className="h-8 text-sm" placeholder="Mit wem gesprochen, z. B. Teamleitung" />
                    </Frage>
                    <Frage label="Über Gehalt gesprochen?">
                      <Chips options={[{ key: 'ja', label: 'Ja' }, { key: 'nein', label: 'Nein' }]} value={form.gehalt_besprochen == null ? null : form.gehalt_besprochen ? 'ja' : 'nein'} onChange={v => set('gehalt_besprochen', v == null ? null : v === 'ja')} />
                      {form.gehalt_besprochen && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input value={euroText.gk} onChange={e => setEuroText(t => ({ ...t, gk: e.target.value }))} className="h-8 text-sm" placeholder={`${vorname} genannt, €`} inputMode="numeric" />
                          <Input value={euroText.gf} onChange={e => setEuroText(t => ({ ...t, gf: e.target.value }))} className="h-8 text-sm" placeholder="Firma genannt, €" inputMode="numeric" />
                        </div>
                      )}
                    </Frage>
                    <Frage label={`Wie müsste ein Angebot aussehen, damit ${werNom} annimmt?`}>
                      <Input value={euroText.af} onChange={e => setEuroText(t => ({ ...t, af: e.target.value }))} className="h-8 text-sm" placeholder="Fixgehalt mindestens, €" inputMode="numeric" />
                      <MultiChips options={ANGEBOT_PUNKTE} value={form.angebot_punkte} onChange={v => set('angebot_punkte', v)} />
                      <Input value={form.angebot_text} onChange={e => set('angebot_text', e.target.value)} className="h-8 text-sm" placeholder="Was muss sonst drinstehen" />
                    </Frage>
                    <Frage label="Idealer Starttermin?">
                      <Chips options={START} value={form.start_art} onChange={v => set('start_art', v)} />
                      {form.start_art === 'fester_tag' && (
                        <Input type="date" value={form.start_datum ?? ''} onChange={e => set('start_datum', e.target.value || null)} className="h-8 w-44 text-sm" />
                      )}
                    </Frage>
                    <Frage label={`Will ${werNom} weiter?`} fehlt={!form.will_weiter}>
                      <Chips options={DREI} value={form.will_weiter} onChange={v => set('will_weiter', v)} />
                      <Input value={form.bedenken} onChange={e => set('bedenken', e.target.value)} className="h-8 text-sm" placeholder="Offene Fragen oder Bedenken" />
                    </Frage>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">3</span>
                  <p className="text-xs leading-5 text-muted-foreground">{kundenFeedback ? 'Der Kunde hat sein Feedback schon gegeben (unten).' : 'Danach fragst du den Kunden nach seinem Eindruck.'} Gehalt, Angebot, Start und Bedenken bleiben bei dir.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>
                  <p className="text-sm font-medium">Nachgespräch festgehalten · {wann(savedAt!)}</p>
                </div>
                {abgleich.map((a, i) => (
                  <div key={i} className={cn('rounded-md border px-3 py-2 text-xs', a.tone === 'warn' ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300')}>
                    <p className="flex gap-1.5">{a.tone === 'warn' ? <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> : <CalendarDays className="mt-0.5 h-3 w-3 shrink-0" />}<span>{a.text}</span></p>
                    {a.akte && !applied.includes(a.akte.field) && target.candidateId && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span>{a.akte.label}</span>
                        <Button size="sm" variant="outline" className="h-6 bg-background text-[11px]" onClick={() => uebernehmen(a.akte!)}>Übernehmen</Button>
                      </div>
                    )}
                  </div>
                ))}
                {applied.length > 0 && <p className="text-xs text-emerald-600">✓ In die Akte übernommen</p>}
                <div className="flex gap-2.5">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px]', (askedAt || kundenFeedback) && 'border-0 bg-emerald-500 text-white')}>{askedAt || kundenFeedback ? <Check className="h-3 w-3" /> : '3'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{kundenFeedback ? 'Der Kunde hat sein Feedback schon gegeben (unten)' : askedAt ? `Kunde gefragt · ${wann(askedAt)}` : 'Kunden nach seinem Eindruck fragen?'}</p>
                    {!askedAt && !kundenFeedback && (
                      <>
                        <p className="mt-1.5 rounded-md border border-dashed border-border bg-background px-3 py-2 text-sm italic text-foreground/90">{kundenText(form)}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">Geht als Benachrichtigung ins Kunden-Dashboard und als Mail. Gehalt, Angebot, Start und Bedenken gehen nie automatisch an den Kunden.</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {kundenFeedback && (
          <div className="border-t px-4 pt-3 text-xs">
            <span className="text-muted-foreground">Feedback des Kunden: </span><span className="font-medium">{kundenFeedback.weg}</span>
            {kundenFeedback.eindruck && <span className="text-muted-foreground"> · „{kundenFeedback.eindruck}“</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-xs">
          <span className="text-muted-foreground">Ziel: <span className="font-medium text-emerald-500">{saved ? (askedAt || kundenFeedback ? 'Erledigt' : 'Eindruck des Kunden') : 'Nachgespräch festgehalten'}</span></span>
          {!saved ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {laterSlot}
              {target.submissionId && <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/recruiter/submissions/${target.submissionId}`)}>Einreichung</Button>}
              {existing && <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(false)}>Abbrechen</Button>}
              <Button size="sm" className="h-8 text-xs" disabled={saving || loading || !istAusgefuellt(aktuell)} onClick={save}>{existing ? 'Aktualisieren' : 'Festhalten'}</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setEditing(true)}>Ändern</Button>
              {askedAt || kundenFeedback || !target.submissionId ? (
                <Button size="sm" className="h-8 text-xs" onClick={onClose}>Schließen</Button>
              ) : (
                <>
                  <Button size="sm" variant="outline" className="h-8 text-xs" disabled={asking} onClick={onClose}>Nicht nötig</Button>
                  <Button size="sm" className="h-8 gap-1 text-xs" disabled={asking} onClick={askClient}><Mail className="h-3 w-3" />Kunden fragen</Button>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
