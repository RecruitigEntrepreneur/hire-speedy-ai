import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useJobParsing, type ParsedJobData } from '@/hooks/useJobParsing';
import { useJobPdfParsing, type ParsedJobProfile } from '@/hooks/useJobPdfParsing';
import { useOrganization, useOrganizationMembers } from '@/hooks/useOrganization';
import { useQuery } from '@tanstack/react-query';
import { serializeBriefing, briefingProgress, prefillFromBuilt, openBriefingQuestions, type Answers } from './IntakeBriefing';
import { DynamicBriefing, EMPTY_DYN_STATE, type DynState } from './intake/DynamicBriefing';
import { ProfileSections, type FlexibilityMap } from './intake/ProfileSections';
import { QualityCheck } from './intake/QualityCheck';
import { EMPTY_FREELANCE, type BuiltJob, type FreelanceTerms, type RevealSetup } from './intake/types';
import { insertJobWithIntake, updateJobWithIntake, type ExtendedJobFields } from '@/lib/intakeCapture';
// Die Abbildungen liegen in @/lib/intakeMapping, weil die login-freie Aufnahme
// über /start/:token exakt dieselben benutzt. Zwei Kopien wären zwei Wahrheiten.
import {
  EMPTY_BUILT, fromParsedJobData, fromParsedJobProfile, toBriefBuilt,
  remoteLabel, levelLabel, buildAiJobDraft, buildIntakePayload,
} from '@/lib/intakeMapping';
import { resolveIntakeSubmitTarget, notifyApproversOfIntake, type IntakeSubmitStatus } from '@/lib/intakeApproval';
import { cn } from '@/lib/utils';
import {
  Sparkles, FileUp, Link2, MapPin, Home, Coins, TrendingUp, Building2,
  CheckCircle2, Loader2, Users, ArrowRight, Circle, Save, FileText,
} from 'lucide-react';

type JobType = 'full-time' | 'freelance';
type Stage = 'input' | 'building' | 'built' | 'submitted';
type Source = 'text' | 'url' | 'pdf' | null;


/** Entwurf einer bestehenden Job-Zeile (Fortsetzen aus NeueStelleBar). */
export interface StudioDraft {
  id: string;
  row: Record<string, any>;
}

interface Props {
  open: boolean;
  type: JobType;
  initialText?: string;
  initialSource?: Source;
  initialDraft?: StudioDraft | null;
  onOpenChange: (open: boolean) => void;
}

export function JobIntakeStudio({ open, type: initialType, initialText, initialSource, initialDraft, onOpenChange }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const jp = useJobParsing();
  const pdf = useJobPdfParsing();
  const fileRef = useRef<HTMLInputElement>(null);

  const { organizations } = useOrganization();
  const { members } = useOrganizationMembers(organizations?.[0]?.id);

  const [type, setType] = useState<JobType>(initialType);
  const [stage, setStage] = useState<Stage>('input');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [built, setBuilt] = useState<BuiltJob | null>(null);
  const [reveal, setReveal] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [dyn, setDyn] = useState<DynState>(EMPTY_DYN_STATE);
  const [freelance, setFreelance] = useState<FreelanceTerms>(EMPTY_FREELANCE);
  const [flexibility, setFlexibility] = useState<FlexibilityMap>({});
  const [profileFacts, setProfileFacts] = useState<string[]>([]);
  const profileMerged = useRef(false);
  const [revealSetup, setRevealSetup] = useState<RevealSetup>({ descriptor: '', trigger: 'after_first_interview' });
  const [draftJobId, setDraftJobId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [createdJobId, setCreatedJobId] = useState<string | null>(null);
  const [submittedStatus, setSubmittedStatus] = useState<IntakeSubmitStatus>('pending_approval');

  const staticProg = built ? briefingProgress(type, { remote_type: built.remote_type }, answers) : { pct: 0, open: 0, totalQ: 0 };
  // Wird nur noch fuer jobs.intake_completeness gespeichert, nicht mehr angezeigt.
  const progressPct = dyn.available ? dyn.completeness : staticProg.pct;

  // Was in der Kopfzeile steht: gezaehlte Antworten und offene Kapitel statt
  // einer Prozentzahl, die niemand nachrechnen kann.
  const openChapters = dyn.chapterProgress.filter((c) => c.state === 'open').length;
  const briefingSummary = dyn.available
    ? `${dyn.answers.length} beantwortet${openChapters ? ` · ${openChapters} Kapitel offen` : ''}`
    : `${staticProg.open} von ${staticProg.totalQ} Fragen offen`;

  // ---- Firmenprofil (nur lesend): nie zweimal nach Bekanntem fragen --------
  const { data: companyProfile } = useQuery({
    queryKey: ['company-profile-intake', user?.id],
    queryFn: async () => {
      // select('*') statt fester Spaltenliste: excluded_companies/company_size
      // existieren erst nach der Juni-Migration — so funktioniert es vor & nach Deploy.
      const { data } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data as Record<string, any> | null;
    },
    enabled: open && !!user,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!open) {
      profileMerged.current = false;
      return;
    }
    if (!companyProfile || !built || profileMerged.current || stage === 'submitted') return;
    profileMerged.current = true;

    const merged: string[] = [];
    const locRaw = Array.isArray(companyProfile.office_locations) ? companyProfile.office_locations[0] : null;
    const loc = typeof locRaw === 'string' ? locRaw : (locRaw as any)?.city || (locRaw as any)?.location || '';

    const patch: Partial<BuiltJob> = {};
    if (!built.industry && companyProfile.industry) { patch.industry = companyProfile.industry; merged.push('Branche'); }
    if (!built.company_name && companyProfile.company_name) { patch.company_name = companyProfile.company_name; merged.push('Firma'); }
    if (!built.location && loc) { patch.location = loc; merged.push('Standort'); }
    if (Object.keys(patch).length) setBuilt((b) => (b ? { ...b, ...patch } : b));

    if (!answers.nogo_companies && companyProfile.excluded_companies?.length) {
      setAnswers((prev) => ({ ...prev, nogo_companies: { value: companyProfile.excluded_companies!.join(', ') } }));
      merged.push('No-Go-Firmen');
    }
    const size = companyProfile.team_size_range || companyProfile.company_size;
    if (size) merged.push('Größe');
    setRevealSetup((r) =>
      r.descriptor
        ? r
        : { ...r, descriptor: [companyProfile.industry, size && `${size} MA`, (loc || built.location) && `Region ${loc || built.location}`].filter(Boolean).join(', ') },
    );
    setProfileFacts(merged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyProfile, built?.title, stage]);

  // Coverage: was die Anzeige/das Dokument bereits beantwortet hat
  const docFacts = useMemo(
    () =>
      built
        ? [
            built.title, built.location, built.salary_min || built.salary_max, built.industry,
            built.must_haves.length, built.nice_to_haves.length, built.skills.length,
            built.description, built.requirements, built.vacancyReason, built.reportsTo,
            built.hiringUrgency, built.usps.length,
          ].filter(Boolean).length
        : 0,
    [built],
  );

  const isFreelance = type === 'freelance';
  const salaryLabel = built?.salary_min || built?.salary_max
    ? `${built?.salary_min ? `€${built.salary_min / 1000}k` : ''}${built?.salary_min && built?.salary_max ? '–' : ''}${built?.salary_max ? `€${built.salary_max / 1000}k` : ''}`
    : '—';

  const facts = built
    ? [
        { icon: Sparkles, label: 'Titel', value: built.title || '—' },
        { icon: MapPin, label: 'Standort', value: built.location || '—' },
        { icon: Home, label: 'Modell', value: remoteLabel(built.remote_type) },
        { icon: Coins, label: isFreelance ? 'Tagessatz' : 'Gehalt', value: isFreelance ? 'noch ergänzen' : salaryLabel },
        { icon: TrendingUp, label: 'Erfahrung', value: levelLabel(built.experience_level) },
        { icon: Sparkles, label: 'Skills', value: built.must_haves.slice(0, 3).join(' · ') || built.skills.slice(0, 3).join(' · ') || '—' },
        { icon: Building2, label: 'Branche', value: built.industry || '—' },
      ]
    : [];

  /** Job-Entwurf für die intake-questions-KI (kompakt, ohne Volltexte). */
  const jobDraft = useMemo(
    () =>
      built
        ? buildAiJobDraft({
            type,
            built,
            freelance,
            flexibility,
            // Aus dem Firmenprofil bekannt — die KI darf das NIE erneut abfragen
            companyDefaults: companyProfile
              ? {
                  industry: companyProfile.industry,
                  size: companyProfile.team_size_range || companyProfile.company_size,
                  remote_policy: companyProfile.remote_policy,
                  excluded_companies: companyProfile.excluded_companies,
                }
              : null,
          })
        : {},
    [built, type, freelance, flexibility, companyProfile],
  );

  const startBuild = (job: BuiltJob | null) => {
    if (!job || !job.title) {
      toast.error('Konnte keine Stelle erkennen – bitte mehr Text/Details angeben.');
      setStage('input');
      return;
    }
    setBuilt(job);
    setAnswers(prefillFromBuilt(toBriefBuilt(job)));
    if (!revealSetup.descriptor && (job.industry || job.location)) {
      setRevealSetup((r) => ({ ...r, descriptor: [job.industry, job.location && `Region ${job.location}`].filter(Boolean).join(', ') }));
    }
    setReveal(0);
    setStage('building');
  };

  /**
   * "Ohne Vorlage starten" (M1 aus INTAKE_UMSETZUNG_WELLE_A.md:52-79).
   *
   * Der Ausweg, wenn die Parser-Function nicht antwortet oder schlicht keine
   * Anzeige vorliegt. Ohne ihn hängt die Aufnahme vollständig an einer Edge
   * Function, die laut ONBOARDING_INTAKE_MASTERANALYSE.md:698 am 29.08. mit
   * 404 antwortete.
   */
  const startManual = () => {
    const seed = text.trim();
    setBuilt({ ...EMPTY_BUILT, title: seed.length <= 120 ? seed : '' });
    setAnswers({});
    setReveal(0);
    setStage('built');
  };

  const buildFromText = async (t: string) => {
    setStage('building'); setBuilt(null); setReveal(0);
    const d = await jp.parseJobText(t.trim());
    startBuild(d ? fromParsedJobData(d) : null);
  };
  const buildFromUrl = async (u: string) => {
    setStage('building'); setBuilt(null); setReveal(0);
    const d = await jp.parseJobUrl(u.trim());
    startBuild(d ? fromParsedJobData(d) : null);
  };
  const handlePdf = async (file: File) => {
    setStage('building'); setBuilt(null); setReveal(0);
    const p = await pdf.uploadAndParsePdf(file);
    startBuild(p ? fromParsedJobProfile(p) : null);
  };

  const handleBuild = () => {
    if (url.trim()) buildFromUrl(url);
    else if (text.trim()) buildFromText(text);
    else toast.error('Bitte Anzeige einfügen, beschreiben, einen Link oder ein PDF angeben.');
  };

  // Beim Öffnen: zurücksetzen; ggf. Entwurf hydratisieren oder Seed bauen.
  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setStage('input'); setBuilt(null); setReveal(0); setSubmitting(false); setSavingDraft(false);
    setAnswers({}); setDyn(EMPTY_DYN_STATE); setFreelance(EMPTY_FREELANCE);
    setFlexibility({}); setProfileFacts([]);
    setRevealSetup({ descriptor: '', trigger: 'after_first_interview' });
    setDraftJobId(null); setCreatedJobId(null);
    setUrl(''); setShowUrl(initialSource === 'url');
    setText(initialText || '');

    if (initialDraft) {
      const r = initialDraft.row;
      const ds = r.intake_payload?.draft_state;
      setDraftJobId(initialDraft.id);
      setType(ds?.type ?? (r.employment_type === 'freelance' ? 'freelance' : 'full-time'));
      setBuilt(
        ds?.built ?? {
          title: r.title || '', company_name: r.company_name || '', location: r.location || '',
          remote_type: r.remote_type || 'hybrid', experience_level: r.experience_level || 'mid',
          salary_min: r.salary_min, salary_max: r.salary_max, skills: r.skills || [],
          must_haves: r.must_haves || [], nice_to_haves: r.nice_to_haves || [],
          industry: r.industry || '', description: r.description || '', requirements: r.requirements || '',
          vacancyReason: r.vacancy_reason ?? null, reportsTo: r.reports_to ?? null,
          hiringUrgency: r.hiring_urgency ?? null, remoteDays: null, usps: [],
        },
      );
      setAnswers(ds?.answers ?? {});
      setDyn(ds?.dyn ? { ...EMPTY_DYN_STATE, ...ds.dyn, available: null, tensionFlags: [] } : EMPTY_DYN_STATE);
      setFreelance(ds?.freelance ?? EMPTY_FREELANCE);
      setFlexibility(ds?.flexibility ?? {});
      setRevealSetup(ds?.revealSetup ?? { descriptor: r.reveal_envelope?.descriptor || '', trigger: r.reveal_trigger || 'after_first_interview' });
      setStage('built');
    } else if (initialText && initialText.trim()) {
      void buildFromText(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Sobald die KI geantwortet hat, ist die Arbeit fertig — dann wird auch nicht
  // mehr gewartet. Vorher liefen hier 7 × 280 ms + 350 ms reine Inszenierung ab,
  // NACHDEM das Ergebnis bereits vorlag. Der Spinner waehrend des echten Aufrufs
  // bleibt; er ist die einzige ehrliche Rueckmeldung in dieser Stufe.
  useEffect(() => {
    if (stage !== 'building' || !built) return;
    setReveal(facts.length);
    setStage('built');
  }, [stage, built, facts.length]);

  // ---- Persistenz ----------------------------------------------------------

  const buildRecord = (status: 'draft' | 'pending_approval' | 'pending_client_approval') => {
    if (!built) return null;
    const tf = dyn.typedFields as Record<string, unknown>;

    const base: Record<string, unknown> = {
      client_id: user?.id,
      title: built.title,
      company_name: built.company_name || 'Mein Unternehmen',
      description: built.description || null,
      requirements: built.requirements || null,
      location: built.location || null,
      remote_type: built.remote_type || 'hybrid',
      employment_type: type,
      experience_level: built.experience_level || 'mid',
      salary_min: isFreelance ? null : built.salary_min ?? null,
      salary_max: isFreelance ? null : built.salary_max ?? null,
      skills: built.skills.length ? built.skills : null,
      must_haves: built.must_haves.length ? built.must_haves : null,
      nice_to_haves: built.nice_to_haves.length ? built.nice_to_haves : null,
      briefing_notes: serializeBriefing(answers) || null,
      vacancy_reason: built.vacancyReason || null,
      reports_to: built.reportsTo || null,
      hiring_urgency: built.hiringUrgency || null,
      onsite_days_required: built.remote_type === 'hybrid' && built.remoteDays != null ? Math.max(0, 5 - built.remoteDays) : null,
      intake_completeness: progressPct || null,
      status,
    };

    const extended: ExtendedJobFields = {
      visa_sponsorship: tf.visa_sponsorship as boolean | undefined,
      experience_min: tf.experience_min as number | undefined,
      experience_max: tf.experience_max as number | undefined,
      search_difficulty: tf.search_difficulty as string | undefined,
      target_companies: (tf.target_companies as string[] | undefined)?.length ? tf.target_companies : undefined,
      nogo_companies: (tf.nogo_companies as string[] | undefined)?.length ? tf.nogo_companies : undefined,
      reveal_trigger: revealSetup.trigger,
      reveal_envelope: {
        ...(dyn.envelopePatch || {}),
        descriptor: revealSetup.descriptor || (dyn.envelopePatch as any)?.descriptor || null,
      },
      intake_payload: {
        ...buildIntakePayload({
          source: 'studio',
          state: { type, built, answers, freelance, flexibility, revealSetup, dyn },
          briefingText: serializeBriefing(answers) || null,
          profileFacts,
        }),
        // draft_state bleibt auch bei interner Freigabe erhalten, damit ein
        // zurückgegebener Entwurf im Studio fortsetzbar ist.
        ...(status !== 'pending_approval'
          ? { draft_state: { type, built, answers, freelance, flexibility, revealSetup, dyn: { ...dyn, tensionFlags: [] } } }
          : { draft_state: null }),
      },
    };

    return { base, extended };
  };

  const persist = async (status: 'draft' | 'pending_approval' | 'pending_client_approval') => {
    const rec = buildRecord(status);
    if (!rec) return { data: null, error: new Error('kein Entwurf') };
    return draftJobId
      ? updateJobWithIntake(draftJobId, rec.base, rec.extended)
      : insertJobWithIntake(rec.base, rec.extended);
  };

  const persistSkillRequirements = async (jobId: string) => {
    if (!dyn.skillRequirements.length) return;
    const seen = new Set<string>();
    const rows = dyn.skillRequirements
      .filter((s) => s.skill && !seen.has(s.skill.toLowerCase()) && seen.add(s.skill.toLowerCase()))
      .map((s) => ({ job_id: jobId, skill_name: s.skill, type: s.kind, weight: s.kind === 'must' ? 1.0 : 0.5 }));
    const { error } = await supabase
      .from('job_skill_requirements')
      .upsert(rows as any, { onConflict: 'job_id,skill_name', ignoreDuplicates: true });
    if (error) console.warn('job_skill_requirements nicht persistiert:', error.message);
  };

  const handleSaveDraft = async () => {
    if (!built?.title) { toast.error('Bitte zuerst einen Jobtitel angeben.'); return; }
    setSavingDraft(true);
    const { data, error } = await persist('draft');
    setSavingDraft(false);
    if (error) {
      console.error('Draft-Fehler:', error);
      toast.error('Entwurf konnte nicht gespeichert werden.');
      return;
    }
    setDraftJobId(data.id);
    toast.success('Entwurf gespeichert — über „Stelle ausschreiben" jederzeit fortsetzbar.');
  };

  const handleDelegate = async (memberUserId: string, memberName: string) => {
    if (!built?.title) { toast.error('Bitte zuerst einen Jobtitel angeben.'); return; }
    setSavingDraft(true);
    const { data, error } = await persist('draft');
    if (!error && data?.id) {
      setDraftJobId(data.id);
      await supabase.from('notifications').insert({
        user_id: memberUserId,
        type: 'intake_delegated',
        title: 'Jobaufnahme an Sie übergeben',
        message: `Bitte vervollständigen Sie die Jobaufnahme für „${built.title}" (Entwurf im Dashboard unter „Stelle ausschreiben" fortsetzen).`,
        related_type: 'job',
        related_id: data.id,
      });
      toast.success(`Entwurf gespeichert und an ${memberName} übergeben.`);
    } else {
      toast.error('Übergabe fehlgeschlagen.');
    }
    setSavingDraft(false);
  };

  const handleSubmit = async () => {
    if (!built?.title) { toast.error('Bitte einen Jobtitel angeben'); return; }
    setSubmitting(true);
    // Hiring Manager + aktivierte interne Freigabe → erst zu Admin/HR statt zu Matchunt
    const target = await resolveIntakeSubmitTarget(user!.id);
    const { data, error } = await persist(target.status);
    if (error) {
      setSubmitting(false);
      console.error('Übergabe-Fehler:', error);
      toast.error('Fehler beim Übergeben');
      return;
    }
    await persistSkillRequirements(data.id);
    if (target.status === 'pending_client_approval' && target.organizationId) {
      await notifyApproversOfIntake(target.organizationId, data.id, built.title, user?.id);
    }
    setSubmitting(false);
    setCreatedJobId(data.id);
    setSubmittedStatus(target.status);
    setStage('submitted');
  };

  const moveSkillToNice = (skill: string) => {
    setBuilt((b) =>
      b
        ? {
            ...b,
            must_haves: b.must_haves.filter((s) => s.toLowerCase() !== skill.toLowerCase()),
            nice_to_haves: b.nice_to_haves.some((s) => s.toLowerCase() === skill.toLowerCase())
              ? b.nice_to_haves
              : [...b.nice_to_haves, skill],
          }
        : b,
    );
    toast.success(`„${skill}" zu Kann verschoben — größerer Kandidaten-Pool.`);
  };

  const headline = isFreelance ? 'Contracting anlegen' : 'Festanstellung anlegen';
  const activeMembers = (members || []).filter((m: any) => m.status === 'active' && m.user_id !== user?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Großes zentriertes Fenster — bleibt sichtbar Teil des Dashboards */}
      <DialogContent className="flex h-[90vh] w-[96vw] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {/* ---- Kopfzeile ---- */}
        <div className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <DialogTitle className="truncate text-base font-semibold">
            {headline}
            {built?.title ? ` · ${built.title}` : ''}
          </DialogTitle>
          <Badge variant="secondary" className="hidden shrink-0 text-xs sm:inline-flex">🔒 triple-blind</Badge>
          <DialogDescription className="sr-only">
            Stelle aus Anzeige, Link oder Beschreibung bauen, Briefing beantworten und an die Recruiter übergeben.
          </DialogDescription>

          {stage === 'built' && (
            <div className="ml-auto flex items-center gap-3">
              {/* Gezaehlt statt geschaetzt: die frueheren Prozentzahlen kamen aus
                  zwei verschiedenen Rechenwegen und widersprachen sich auf demselben
                  Bildschirm (Kopf 42 %, Briefing-Reife 65/100). */}
              <span className="hidden text-xs text-muted-foreground md:inline">{briefingSummary}</span>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSaveDraft} disabled={savingDraft}>
                {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Später weiter
              </Button>
            </div>
          )}
          {/* Platz für den eingebauten Dialog-Close (absolut, oben rechts) */}
          <div className={cn('w-8 shrink-0', stage !== 'built' && 'ml-auto')} />
        </div>

        {/* ---- Inhalt ---- */}
        <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
          {/* INPUT */}
          {stage === 'input' && (
            <div className="mx-auto max-w-2xl space-y-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Erzählen Sie uns von der Rolle</h3>
                <p className="text-sm text-muted-foreground">
                  Anzeige einfügen, beschreiben, Link oder PDF — die KI baut daraus live ein vollständiges Profil.
                </p>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={'z. B. „Senior Cloud Architect in Frankfurt, hybrid, ~95k, AWS & Kubernetes, ab August …"\n\noder die komplette Stellenanzeige hier einfügen.'}
                rows={7}
                className="resize-none text-sm"
              />
              {showUrl && (
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://karriere.example.com/job/123" className="text-sm" />
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleBuild} className="gap-2" variant="hero">
                  <Sparkles className="h-4 w-4" /> Profil bauen
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4" /> PDF ablegen
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowUrl((s) => !s)}>
                  <Link2 className="h-4 w-4" /> Link
                </Button>
                {/* Immer sichtbarer manueller Weg: die KI-Wege können ausfallen,
                    die Aufnahme darf daran nicht scheitern. */}
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={startManual}>
                  <FileText className="h-4 w-4" /> Ohne Vorlage starten
                </Button>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdf(f); }} />
              </div>
            </div>
          )}

          {/* BUILDING */}
          {stage === 'building' && (
            <div className="mx-auto max-w-2xl space-y-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {built ? 'Profil wird gebaut …' : 'KI liest und versteht die Rolle …'}
              </div>
              <div className="space-y-2.5 rounded-xl border bg-card p-5">
                {(built ? facts : Array.from({ length: 7 })).map((f: any, i) => {
                  const done = built && i < reveal;
                  const Icon = f?.icon ?? Sparkles;
                  return (
                    <div key={i} className={cn('flex items-center gap-3 transition-opacity', built && i >= reveal && 'opacity-40')}>
                      {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground/50" />}
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="w-24 shrink-0 text-xs text-muted-foreground">{f?.label ?? '…'}</span>
                      <span className="truncate text-sm font-medium">{done ? f.value : ''}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BUILT · Profil links, Briefing rechts */}
          {stage === 'built' && built && (
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2">
              <ProfileSections
                type={type}
                built={built}
                onChange={setBuilt}
                freelance={freelance}
                onFreelanceChange={setFreelance}
                reveal={revealSetup}
                onRevealChange={setRevealSetup}
                flexibility={flexibility}
                onFlexibilityChange={setFlexibility}
              />
              <div className="flex flex-col gap-3">
                {/* Coverage: das Vertrauenssignal, dass sich der Upload gelohnt hat */}
                {(docFacts > 0 || profileFacts.length > 0) && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {docFacts > 0 && (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Aus Ihrer Anzeige übernommen: <strong>{docFacts} Angaben</strong>
                      </span>
                    )}
                    {profileFacts.length > 0 && (
                      <span className="text-muted-foreground">
                        · aus Ihrem Firmenprofil: <strong>{profileFacts.join(', ')}</strong>
                      </span>
                    )}
                    {!dyn.available && staticProg.open > 0 && (
                      <span className="text-muted-foreground">· noch offen: {staticProg.open} Fragen</span>
                    )}
                  </div>
                )}
                <DynamicBriefing
                  type={type}
                  jobDraft={jobDraft}
                  state={dyn}
                  onState={setDyn}
                  onMoveSkillToNice={moveSkillToNice}
                  onDone={() => undefined}
                  fallback={{ built: toBriefBuilt(built), value: answers, onChange: setAnswers }}
                />
                <QualityCheck
                  type={type}
                  built={built}
                  freelance={freelance}
                  answers={answers}
                  openQuestions={dyn.available ? [] : openBriefingQuestions(type, toBriefBuilt(built), answers)}
                  revealDescriptor={revealSetup.descriptor}
                />
              </div>
            </div>
          )}

          {/* SUBMITTED */}
          {stage === 'submitted' && (
            <div className="mx-auto flex max-w-md flex-col items-center py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold tracking-tight">
                {submittedStatus === 'pending_client_approval' ? 'Zur internen Freigabe eingereicht!' : 'Stelle eingereicht!'}
              </h3>
              <p className="mb-5 mt-1 text-sm text-muted-foreground">
                {submittedStatus === 'pending_client_approval'
                  ? 'Admin bzw. HR Ihres Teams wurden benachrichtigt und geben die Aufnahme frei, bevor sie an Matchunt geht.'
                  : 'Wir benachrichtigen Sie, sobald die Stelle live ist.'}
              </p>
              <div className="mb-6 w-full space-y-2.5 rounded-xl border bg-card p-4 text-left text-sm">
                {(submittedStatus === 'pending_client_approval'
                  ? [
                      { label: 'Interne Freigabe (Ihr Team)', hint: null, active: true },
                      { label: 'Prüfung durch Matchunt', hint: null, active: false },
                      { label: 'Stelle geht live', hint: null, active: false },
                      { label: 'Erste Kandidaten', hint: null, active: false },
                    ]
                  : [
                      { label: 'Prüfung durch Matchunt', hint: null, active: true },
                      { label: 'Stelle geht live', hint: null, active: false },
                      { label: 'Recruiter beginnen die Suche', hint: null, active: false },
                      { label: 'Erste Kandidaten', hint: null, active: false },
                    ]).map((s) => (
                  <div key={s.label} className={cn('flex items-center gap-2.5', !s.active && 'text-muted-foreground')}>
                    {s.active ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className="flex-1">{s.label}</span>
                    {s.hint && <span className="text-xs text-muted-foreground">{s.hint}</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
                <Button
                  variant="hero"
                  className="gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    if (createdJobId) navigate(`/dashboard/jobs/${createdJobId}`);
                  }}
                >
                  Zur Stelle <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ---- Fußzeile ---- */}
        {stage === 'built' && built && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 md:px-6">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1.5 text-muted-foreground" disabled={savingDraft}>
                  <Users className="h-4 w-4" /> an Fachbereich geben
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel className="text-xs">Entwurf speichern &amp; übergeben an:</DropdownMenuLabel>
                {activeMembers.length === 0 ? (
                  <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                    Keine Team-Mitglieder — unter Einstellungen → Team einladen.
                  </DropdownMenuItem>
                ) : (
                  activeMembers.map((m: any) => (
                    <DropdownMenuItem
                      key={m.id}
                      onClick={() => handleDelegate(m.user_id, m.profiles?.full_name || m.profiles?.email || 'Teammitglied')}
                    >
                      {m.profiles?.full_name || m.profiles?.email || m.user_id}
                      <span className="ml-auto text-xs text-muted-foreground">{m.role}</span>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStage('input')}>Neu starten</Button>
              <Button variant="hero" className="gap-2" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                An Recruiter übergeben
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
