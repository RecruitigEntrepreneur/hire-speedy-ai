import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isMissingColumnError } from '@/lib/intakeCapture';
import { useAuth } from '@/lib/auth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Flame,
  Zap,
  Circle,
  Building2,
  MapPin,
  Euro,
  Sparkles,
  FileSignature,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { RecruiterTextReview, type TextEntwurf } from '@/components/admin/RecruiterTextReview';
import {
  CONTRACTING_AUFTRAG,
  RAHMEN_STATUS,
  einsatzZeile,
  euroSpanne,
  kundenBudget,
  modellDerStelle,
  modellDesAuftrags,
  recruiterJeTag,
  recruiterTagessatz,
  spanne,
  vertragsabweichung,
} from '@/lib/contractingFreigabe';

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  industry: string | null;
  fee_percentage: number | null;
  recruiter_fee_percentage: number | null;
  urgency: string | null;
  status: string | null;
  client_id?: string | null;
  briefing_notes?: string | null;
  /** Aus einer Beauftragungsanfrage über einen Aufnahme-Link entstanden. */
  mandate_id?: string | null;
  intake_draft_id?: string | null;
  /** Contracting (employment_type 'freelance'): Budget je Tag und Einsatz. */
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  utilization_days_per_week?: number | null;
  contract_duration_months?: number | null;
  extension_possible?: boolean | null;
  /** Für die anonyme Firmenzeile, wie Recruiter sie sehen. */
  company_size_band?: string | null;
  funding_stage?: string | null;
  tech_environment?: string[] | null;
}

const SIGNATURE_LABEL: Record<string, string> = {
  pending: 'noch nicht versendet',
  sent: 'versendet, Unterschrift ausstehend',
  declined: 'vom Kunden abgelehnt',
  expired: 'abgelaufen',
  voided: 'aufgehoben',
  not_required: 'nicht erforderlich',
  signed: 'unterzeichnet',
};

interface JobApprovalDialogProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}

export function JobApprovalDialog({ job, open, onOpenChange, onApproved }: JobApprovalDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [feePercentage, setFeePercentage] = useState(20);
  const [recruiterFeePercentage, setRecruiterFeePercentage] = useState(15);
  const [urgency, setUrgency] = useState<string>('standard');
  const [rejectionNotes, setRejectionNotes] = useState('');
  /** Die veröffentlichte Konditionsregel. Ersetzt die hartkodierten 20/15 und
   *  die Slidergrenzen 15–30 / 10–25, die bisher nur im Code standen. */
  const [terms, setTerms] = useState<Record<string, any> | null>(null);
  /** Die Vermittlungsvereinbarung, falls die Stelle aus einer Anfrage stammt. */
  const [mandate, setMandate] = useState<Record<string, any> | null>(null);
  /** Der Rahmenvertrag unter dem Auftrag (Nummer, Fassung, Stand). */
  const [rahmen, setRahmen] = useState<Record<string, any> | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  /** Anzeige & Ansprache: der geprüfte Entwurf, der beim Freigeben live geht. */
  const [textEntwurf, setTextEntwurf] = useState<TextEntwurf | null>(null);
  const [textBusy, setTextBusy] = useState(false);
  const [textGesperrt, setTextGesperrt] = useState(false);

  useEffect(() => {
    if (!job) return;
    setUrgency(job.urgency || 'standard');

    let cancelled = false;
    setGateLoading(true);
    (async () => {
      // Die aktive Vorlage ist die Quelle der Voreinstellung und der Grenzen.
      const { data: tpl } = await supabase.from('commercial_terms_templates')
        .select('*').eq('key', 'standard').eq('is_active', true).maybeSingle();

      // Und der Vertragsstand, falls die Stelle aus einer Anfrage kam.
      let m: Record<string, any> | null = null;
      if (job.mandate_id) {
        const { data } = await supabase.from('commercial_mandates')
          .select('*').eq('id', job.mandate_id).maybeSingle();
        m = data ?? null;
      }
      let rv: Record<string, any> | null = null;
      if (m?.framework_agreement_id) {
        const { data } = await supabase.from('client_framework_agreements')
          .select('agreement_number, status, template_version, countersigned_at')
          .eq('id', m.framework_agreement_id).maybeSingle();
        rv = data ?? null;
      }

      if (cancelled) return;
      setTerms(tpl ?? null);
      setMandate(m);
      setRahmen(rv);
      // Ein bestätigtes Mandat schlägt alles: der Kunde hat GENAU diese Zahl
      // bestätigt, sie darf hier nicht still überschrieben werden. Contracting
      // ohne Auftrag rechnet mit der Contracting-Kondition, nicht mit den
      // Festanstellungs-Werten, die draftToJobRow in die Stelle schreibt.
      const standard = m || job.employment_type !== 'freelance'
        ? { fee: job.fee_percentage ?? tpl?.fee_percentage ?? 20, recruiter: job.recruiter_fee_percentage ?? tpl?.recruiter_fee_percentage ?? 15 }
        : { fee: CONTRACTING_AUFTRAG.fee_percentage, recruiter: CONTRACTING_AUFTRAG.recruiter_fee_percentage };
      setFeePercentage(Number(m?.fee_percentage ?? standard.fee));
      setRecruiterFeePercentage(Number(m?.recruiter_fee_percentage ?? standard.recruiter));
      setGateLoading(false);
    })();

    return () => { cancelled = true; };
  }, [job]);

  // Aus einer Beauftragungsanfrage entstandene Stellen dürfen erst nach
  // unterzeichnetem Vertrag live gehen. Der Trigger jobs_guard_privileged_columns
  // erzwingt das ohnehin — hier steht nur, warum die Schaltfläche gesperrt ist.
  const fromIntake = Boolean(job?.mandate_id || job?.intake_draft_id);
  const contractOk =
    !fromIntake ||
    (mandate?.status === 'accepted' &&
      ['signed', 'not_required'].includes(mandate?.signature_status ?? ''));
  const feeLocked = Boolean(mandate?.client_confirmed_at);
  // Welche Konditionen gezeigt werden, bestimmt der Auftrag -- nach ihm wird
  // abgerechnet. Passt die Stelle nicht dazu, steht oben die Warnung.
  const contracting = (modellDesAuftrags(mandate) ?? modellDerStelle(job?.employment_type)) === 'contracting';
  const abweichung = gateLoading ? null : vertragsabweichung(job?.employment_type, mandate);

  const formatJobForRecruiters = async (jobId: string) => {
    setFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-job-for-recruiters', {
        body: { jobId }
      });

      if (error) throw error;
      return data?.formattedContent || null;
    } catch (error) {
      console.error('Error formatting job:', error);
      return null;
    } finally {
      setFormatting(false);
    }
  };

  const handleApprove = async () => {
    if (!job || !user) return;

    setLoading(true);
    try {
      // Veröffentlicht wird, was Matchunt oben gesehen hat: der Entwurf, sonst
      // eine schon veröffentlichte neue Anzeige. Nur wenn beides fehlt, erzeugt
      // die KI wie bisher beim Freigeben.
      const bisher = (job as { formatted_content?: Record<string, unknown> | null }).formatted_content;
      const formattedContent = textEntwurf?.content
        ?? (bisher?.anzeige ? bisher : await formatJobForRecruiters(job.id));

      // Update job with approval data
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'published',
          fee_percentage: feePercentage,
          recruiter_fee_percentage: recruiterFeePercentage,
          urgency: urgency,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          formatted_content: formattedContent,
        })
        .eq('id', job.id);

      if (error) throw error;

      if (textEntwurf) {
        await supabase.from('job_recruiter_text_drafts' as never).delete().eq('job_id', job.id);
      }

      // Summary entsteht ops-seitig beim Publish — nie als Kunden-Aufgabe.
      // Fire-and-forget: Fehler blockieren die Freigabe nicht.
      supabase.functions
        .invoke('generate-job-summary', { body: { jobId: job.id } })
        .catch((e) => console.warn('Auto-Summary fehlgeschlagen:', e));

      // Kunde erfährt sofort, dass die Stelle live ist (vorher: Funkstille).
      if (job.client_id) {
        await supabase.from('notifications').insert({
          user_id: job.client_id,
          type: 'job_published',
          title: 'Ihre Stelle ist live',
          message: `„${job.title}" wurde geprüft und ist jetzt für unsere Recruiter sichtbar. Erste Kandidaten kommen erfahrungsgemäß in 3–5 Tagen.`,
          related_type: 'job',
          related_id: job.id,
        });
      }

      toast.success('Job genehmigt und veröffentlicht!');
      onApproved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving job:', error);
      toast.error('Fehler beim Genehmigen des Jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!job) return;

    setLoading(true);
    try {
      const reason = rejectionNotes?.trim() || 'Bitte überprüfen Sie die Stellendetails.';

      // Echte Spalten (Migration 20260710120000); Fallback vor dem Deploy:
      // Grund VORNE an briefing_notes anhängen statt das Briefing zu überschreiben.
      let { error } = await supabase
        .from('jobs')
        .update({
          status: 'draft',
          rejection_reason: reason,
          rejected_at: new Date().toISOString(),
        } as any)
        .eq('id', job.id);

      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase
          .from('jobs')
          .update({
            status: 'draft',
            briefing_notes: `[ABGELEHNT] ${reason}\n\n${job.briefing_notes || ''}`.trim(),
          })
          .eq('id', job.id));
      }

      if (error) throw error;

      if (job.client_id) {
        await supabase.from('notifications').insert({
          user_id: job.client_id,
          type: 'job_rejected',
          title: 'Stelle zurückgegeben',
          message: `„${job.title}" wurde zurückgegeben: ${reason} Bitte ergänzen und erneut einreichen.`,
          related_type: 'job',
          related_id: job.id,
        });
      }

      toast.success('Job abgelehnt und an Kunden zurückgesendet');
      onApproved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error rejecting job:', error);
      toast.error('Fehler beim Ablehnen des Jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Nicht angegeben';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `Ab €${min.toLocaleString()}`;
    return `Bis €${max?.toLocaleString()}`;
  };

  const calculatePotentialEarning = () => {
    if (!job?.salary_min && !job?.salary_max) return null;
    const avgSalary = job.salary_min && job.salary_max 
      ? (job.salary_min + job.salary_max) / 2 
      : job.salary_min || job.salary_max;
    if (!avgSalary) return null;
    return Math.round(avgSalary * (recruiterFeePercentage / 100));
  };

  if (!job) return null;

  const potentialEarning = calculatePotentialEarning();
  const budget = kundenBudget(mandate, job);
  // Gerechnet wird vom Tagessatz der Stelle (all-in). Recruiter sehen davon
  // nur den Satz des Spezialisten und ihren Verdienst in Euro.
  const stellenTagessatz = spanne(job.day_rate_min, job.day_rate_max);
  const satzFuerRecruiter = recruiterTagessatz(stellenTagessatz, mandate);
  const recruiterTag = recruiterJeTag(stellenTagessatz, recruiterFeePercentage);
  const einsatz = einsatzZeile(job);
  const zahlungsziel = mandate?.payment_terms_days ?? mandate?.pricing_snapshot?.paymentTermsDays ?? CONTRACTING_AUFTRAG.payment_terms_days;
  const anonymeFirma = formatAnonymousCompany({
    industry: job.industry,
    companySize: job.company_size_band,
    fundingStage: job.funding_stage,
    techStack: job.tech_environment,
    location: job.location,
    remoteType: job.remote_type,
  });

  const dringlichkeit = (
    <div className="space-y-3">
      <Label>Dringlichkeit</Label>
      <Select value={urgency} onValueChange={setUrgency}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="standard">
            <div className="flex items-center gap-2">
              <Circle className="h-3 w-3 text-muted-foreground" />
              Standard
            </div>
          </SelectItem>
          <SelectItem value="urgent">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-warning" />
              Urgent
            </div>
          </SelectItem>
          <SelectItem value="hot">
            <div className="flex items-center gap-2">
              <Flame className="h-3 w-3 text-destructive" />
              Hot
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Beeinflusst die Sichtbarkeit und Priorisierung für Recruiter
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Job zur Genehmigung
          </DialogTitle>
          <DialogDescription>
            {contracting
              ? 'Prüfe, was der Kunde bestätigt hat und was Recruiter sehen'
              : 'Prüfe die Stellendetails und lege die Konditionen für Recruiter fest'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {abweichung && (
            <Alert className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 !text-amber-600" />
              <AlertDescription className="space-y-1 text-sm">
                <p className="font-medium">{abweichung.titel}</p>
                <p className="text-muted-foreground">{abweichung.text}</p>
                {job.intake_draft_id && (
                  <Button asChild variant="outline" size="sm" className="mt-1 gap-1.5">
                    <Link to={`/admin/intakes/${job.intake_draft_id}`}>
                      <ExternalLink className="h-3.5 w-3.5" /> Zum Vertragslauf
                    </Link>
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Job Preview */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-navy flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{job.title}</h3>
                  <p className="text-muted-foreground">{job.company_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    {job.remote_type && (
                      <Badge variant="secondary" className="capitalize text-xs">
                        {job.remote_type}
                      </Badge>
                    )}
                    {job.employment_type && (
                      <Badge variant="outline" className="capitalize text-xs">
                        {job.employment_type === 'freelance' ? 'Contracting' : job.employment_type}
                      </Badge>
                    )}
                  </div>
                </div>
                {contracting ? (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Budget je Tag</p>
                    <p className="font-semibold">{budget ? euroSpanne(budget) : 'Nicht angegeben'}</p>
                    {budget && <p className="text-xs text-muted-foreground">alles inklusive</p>}
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Gehalt</p>
                    <p className="font-semibold">{formatSalary(job.salary_min, job.salary_max)}</p>
                  </div>
                )}
              </div>

              {/* Skills */}
              {job.skills && job.skills.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Skills:</p>
                  <div className="flex flex-wrap gap-1">
                    {job.skills.slice(0, 10).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {job.skills.length > 10 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{job.skills.length - 10}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {contracting ? (
          <div className="space-y-6">
            <h4 className="font-semibold flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Konditionen
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Was der Kunde bestätigt hat
                </p>
                <p className="font-semibold">
                  {budget ? `Budget ${euroSpanne(budget)} je Tag` : 'Ohne Budget: Tagessatz je Einsatz abstimmen'}
                </p>
                {budget && <p className="text-xs text-muted-foreground">alles inklusive, zzgl. USt</p>}
                {einsatz && <p className="text-sm">{einsatz}</p>}
                <p className="text-sm">Zahlungsziel {zahlungsziel} Tage</p>
                {mandate?.client_confirmed_at && (
                  <p className="text-sm">
                    Bestätigt am {new Date(mandate.client_confirmed_at).toLocaleDateString('de-DE')}
                    {mandate.mandate_number ? <> · {mandate.mandate_number}</> : null}
                  </p>
                )}
                <p className="text-sm">
                  {rahmen
                    ? <>Rahmenvertrag {rahmen.agreement_number} · Fassung {rahmen.template_version} · {RAHMEN_STATUS[rahmen.status] ?? rahmen.status}</>
                    : mandate ? 'Kein Rahmenvertrag am Auftrag' : 'Ohne Auftrag angelegt'}
                </p>
              </div>

              <div className="space-y-2 rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Was Recruiter sehen
                </p>
                <p className="font-semibold">{job.title}</p>
                <p className="text-xs text-muted-foreground">{anonymeFirma} · Firma verborgen bis zum Reveal</p>
                <p className="text-sm">
                  Tagessatz Spezialist {satzFuerRecruiter ? `${euroSpanne(satzFuerRecruiter)} pro Tag` : 'nicht angegeben'}
                </p>
                {recruiterTag && (
                  <p className="text-sm">
                    Verdienst ca. <span className="font-semibold text-emerald">{recruiterTag} je Einsatztag</span>, laufend
                  </p>
                )}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Intern: Marge {feePercentage.toLocaleString('de-DE')} % vom Tagessatz, davon{' '}
              {recruiterFeePercentage.toLocaleString('de-DE')} % an den Recruiter.{' '}
              {feeLocked
                ? <>Fest aus {mandate?.mandate_number ?? 'dem Auftrag'}, vom Kunden bestätigt — nicht änderbar.</>
                : mandate ? 'Aus dem Auftrag.' : 'Contracting-Kondition, weil kein Auftrag vorliegt.'}
            </p>

            {dringlichkeit}
          </div>
          ) : (
          <div className="space-y-6">
            <h4 className="font-semibold flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Konditionen festlegen
            </h4>

            {/* Fee Percentage (Client pays) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Gesamtgebühr (Client zahlt)</Label>
                <span className="font-bold text-lg">{feePercentage}%</span>
              </div>
              <Slider
                value={[feePercentage]}
                onValueChange={(val) => setFeePercentage(val[0])}
                min={Number(terms?.min_fee_percentage ?? 15)}
                max={Number(terms?.max_fee_percentage ?? 30)}
                step={0.5}
                disabled={feeLocked}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                {feeLocked ? (
                  <>
                    Vom Kunden bestätigt am{' '}
                    {new Date(mandate!.client_confirmed_at).toLocaleDateString('de-DE')} — nicht mehr
                    änderbar. Für eine Änderung eine neue Konditionsversion vorlegen.
                  </>
                ) : terms ? (
                  <>
                    Anteil vom {terms.fee_basis === 'annual_target_salary' ? 'Zieljahresgehalt' : 'Jahresbruttogehalt'},
                    den der Kunde bei erfolgreicher Vermittlung zahlt. Veröffentlichte Bandbreite:{' '}
                    {terms.min_fee_percentage}–{terms.max_fee_percentage} %.
                  </>
                ) : (
                  'Anteil vom Jahresgehalt, den der Kunde bei erfolgreicher Vermittlung zahlt.'
                )}
              </p>
            </div>

            {/* Recruiter Fee Percentage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Recruiter-Anteil</Label>
                <span className="font-bold text-lg text-emerald">{recruiterFeePercentage}%</span>
              </div>
              <Slider
                value={[recruiterFeePercentage]}
                onValueChange={(val) => setRecruiterFeePercentage(val[0])}
                min={Number(terms?.min_recruiter_fee_percentage ?? 10)}
                max={Number(terms?.max_recruiter_fee_percentage ?? 25)}
                step={0.5}
                disabled={feeLocked}
                className="w-full"
              />
              {potentialEarning && (
                <p className="text-xs text-muted-foreground">
                  Recruiter verdient ca. <span className="font-semibold text-emerald">€{potentialEarning.toLocaleString()}</span> bei erfolgreicher Vermittlung
                </p>
              )}
            </div>

            {dringlichkeit}
          </div>
          )}

          <Separator />
          <RecruiterTextReview key={job.id} job={job as unknown as Record<string, any>} mandate={mandate}
            onEntwurf={setTextEntwurf} onBusy={setTextBusy} onSperre={setTextGesperrt} />

          {fromIntake && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="flex items-center gap-2 font-semibold">
                  <FileSignature className="h-4 w-4" />
                  Vermittlungsvereinbarung
                </h4>
                {gateLoading ? (
                  <p className="text-sm text-muted-foreground">Vertragsstand wird geprüft …</p>
                ) : contractOk ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription className="text-sm">
                      {mandate?.signature_status === 'signed'
                        ? <>Unterzeichnet am {new Date(mandate.signature_signed_at).toLocaleDateString('de-DE')} ({mandate.mandate_number}). Die Stelle kann veröffentlicht werden.</>
                        : <>Für dieses Mandat ist keine Unterschrift erforderlich. Die Stelle kann veröffentlicht werden.</>}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <FileSignature className="h-4 w-4" />
                    <AlertDescription className="space-y-2 text-sm">
                      <p>
                        Diese Stelle stammt aus einer Beauftragungsanfrage. Sie kann erst
                        veröffentlicht werden, wenn die Vermittlungsvereinbarung angenommen und
                        unterzeichnet ist
                        {mandate ? <> — aktuell: {SIGNATURE_LABEL[mandate.signature_status] ?? mandate.signature_status}</> : null}.
                        Die Datenbank verhindert die Freigabe unabhängig von dieser Anzeige.
                      </p>
                      {job.intake_draft_id && (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <Link to={`/admin/intakes/${job.intake_draft_id}`}>
                            <ExternalLink className="h-3.5 w-3.5" /> Zum Vertragslauf
                          </Link>
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Rejection Notes (optional) */}
          <div className="space-y-3">
            <Label>Ablehnungsgrund (falls abgelehnt)</Label>
            <Textarea
              placeholder="Grund für die Ablehnung angeben (wird dem Kunden mitgeteilt)..."
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading || !rejectionNotes.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Ablehnen
          </Button>
          <Button
            variant="emerald"
            onClick={handleApprove}
            disabled={loading || formatting || textBusy || textGesperrt || !contractOk}
            title={!contractOk ? 'Erst nach unterzeichneter Vermittlungsvereinbarung'
              : textGesperrt ? 'Erst wenn der Firmenname aus der Anzeige entfernt ist' : undefined}
          >
            {loading || formatting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {formatting ? 'Formatiere...' : 'Genehmige...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {abweichung ? 'Trotzdem veröffentlichen' : 'Genehmigen & Veröffentlichen'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
