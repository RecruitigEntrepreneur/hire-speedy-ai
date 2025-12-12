import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Briefcase,
  Euro,
  Calendar,
  Clock,
  MapPin,
  Globe,
  Plane,
  FileCheck,
  Database,
  User,
  Building2,
  Sparkles,
  Award,
  Target,
  Users,
  Wallet,
  Building,
  Package,
  FileText,
  Flag,
  ChevronDown,
  Phone,
  Mail,
  Linkedin,
  ExternalLink,
  ClipboardList,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { CandidateJobMatching } from './CandidateJobMatching';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { useAIAssessment } from '@/hooks/useAIAssessment';
import { supabase } from '@/integrations/supabase/client';

interface CandidateOverviewTabProps {
  candidate: Candidate;
  tags: CandidateTag[];
}

const seniorityLabels: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead / Principal',
  director: 'Director / C-Level',
};

const noticePeriodLabels: Record<string, string> = {
  immediate: 'Sofort verfügbar',
  '2_weeks': '2 Wochen',
  '1_month': '1 Monat',
  '2_months': '2 Monate',
  '3_months': '3 Monate',
  '6_months': '6 Monate',
};

const sourceLabels: Record<string, string> = {
  manual: 'Manuell',
  hubspot: 'HubSpot',
  linkedin: 'LinkedIn',
  ats: 'ATS',
  cv_upload: 'CV-Upload',
};

export function CandidateOverviewTab({ candidate, tags }: CandidateOverviewTabProps) {
  const extCandidate = candidate as any;
  const [expandedSummary, setExpandedSummary] = useState(false);
  const [interviewNotes, setInterviewNotes] = useState<any>(null);
  const { assessment, loading: assessmentLoading, refetch: refetchAssessment } = useAIAssessment(candidate.id);

  // Fetch interview notes for customer summary
  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from('candidate_interview_notes')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setInterviewNotes(data);
    };
    fetchNotes();
  }, [candidate.id]);

  // Format salary display
  const formatSalary = (value: number | null | undefined) => {
    if (!value) return null;
    return `${(value / 1000).toFixed(0)}k €`;
  };

  const salaryDisplay = candidate.expected_salary || extCandidate.salary_expectation_max
    ? formatSalary(candidate.expected_salary || extCandidate.salary_expectation_max)
    : null;

  const availabilityDisplay = candidate.notice_period
    ? noticePeriodLabels[candidate.notice_period] || candidate.notice_period
    : candidate.availability_date
      ? format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })
      : null;

  // Get recommendation styling
  const getRecommendationStyle = (rec: string | null) => {
    switch (rec) {
      case 'strong_yes': return { color: 'text-green-600', bg: 'bg-green-100', label: 'Starke Empfehlung' };
      case 'yes': return { color: 'text-green-500', bg: 'bg-green-50', label: 'Empfohlen' };
      case 'maybe': return { color: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Vielleicht' };
      case 'no': return { color: 'text-red-500', bg: 'bg-red-50', label: 'Nicht empfohlen' };
      case 'strong_no': return { color: 'text-red-600', bg: 'bg-red-100', label: 'Ablehnung' };
      default: return { color: 'text-muted-foreground', bg: 'bg-muted', label: 'Keine Bewertung' };
    }
  };

  return (
    <div className="space-y-4">
      {/* BLOCK 1: Compact Header Info - Always Visible */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{candidate.job_title || 'N/A'}</span>
              {candidate.seniority && (
                <Badge variant="secondary" className="text-xs">
                  {seniorityLabels[candidate.seniority] || candidate.seniority}
                </Badge>
              )}
            </div>
            {candidate.city && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {candidate.city}
              </div>
            )}
            {salaryDisplay && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Euro className="h-3 w-3" />
                {salaryDisplay}
              </div>
            )}
            {availabilityDisplay && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                {availabilityDisplay}
              </div>
            )}
            {candidate.experience_years && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Briefcase className="h-3 w-3" />
                {candidate.experience_years} Jahre
              </div>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs"
                  style={{
                    backgroundColor: tag.color + '20',
                    color: tag.color,
                    borderColor: tag.color,
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCK 2: Job Matching - Always Visible */}
      <CandidateJobMatching 
        candidate={{
          id: candidate.id,
          skills: candidate.skills,
          experience_years: candidate.experience_years,
          expected_salary: candidate.expected_salary,
          salary_expectation_min: extCandidate.salary_expectation_min,
          salary_expectation_max: extCandidate.salary_expectation_max,
          city: candidate.city,
          seniority: candidate.seniority,
          target_roles: extCandidate.target_roles,
          job_title: candidate.job_title,
          full_name: candidate.full_name,
        }}
      />

      {/* BLOCK 3: Customer Summary from AI Assessment - Always Visible */}
      {(assessment || interviewNotes) && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-green-600" />
                <span className="text-green-700">Zusammenfassung für Kunden</span>
              </div>
              {assessment && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getRecommendationStyle(assessment.recommendation).color} ${getRecommendationStyle(assessment.recommendation).bg}`}
                >
                  {getRecommendationStyle(assessment.recommendation).label}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* AI Generated Summary */}
            {assessment?.reasoning && (
              <p className="text-sm">{assessment.reasoning}</p>
            )}

            {/* Key Highlights */}
            {assessment?.key_highlights && assessment.key_highlights.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Key Highlights
                </p>
                <div className="flex flex-wrap gap-1">
                  {assessment.key_highlights.slice(0, 5).map((h: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Interview Summary Fields */}
            {interviewNotes && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                {interviewNotes.summary_motivation && (
                  <div>
                    <p className="text-xs text-muted-foreground">Motivation</p>
                    <p className="text-sm">{interviewNotes.summary_motivation}</p>
                  </div>
                )}
                {interviewNotes.summary_salary && (
                  <div>
                    <p className="text-xs text-muted-foreground">Gehalt</p>
                    <p className="text-sm font-medium">{interviewNotes.summary_salary}</p>
                  </div>
                )}
                {interviewNotes.summary_notice && (
                  <div>
                    <p className="text-xs text-muted-foreground">Kündigungsfrist</p>
                    <p className="text-sm">{interviewNotes.summary_notice}</p>
                  </div>
                )}
                {interviewNotes.summary_key_requirements && (
                  <div>
                    <p className="text-xs text-muted-foreground">Key Requirements</p>
                    <p className="text-sm">{interviewNotes.summary_key_requirements}</p>
                  </div>
                )}
              </div>
            )}

            {/* Scores */}
            {assessment && (
              <div className="flex items-center gap-4 pt-2 border-t text-xs">
                {assessment.placement_probability && (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    <span className="text-muted-foreground">Vermittlungschance:</span>
                    <span className="font-medium text-green-600">{assessment.placement_probability}%</span>
                  </div>
                )}
                {assessment.overall_score && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Score:</span>
                    <span className="font-medium">{assessment.overall_score}/100</span>
                  </div>
                )}
              </div>
            )}

            {/* Risk Factors */}
            {assessment?.risk_factors && assessment.risk_factors.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-yellow-600" />
                  Risikofaktoren
                </p>
                <div className="flex flex-wrap gap-1">
                  {assessment.risk_factors.map((r: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs border-yellow-300 text-yellow-700 bg-yellow-50">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* BLOCK 4: AI CV Summary - Always Visible (collapsible) */}
      {extCandidate.cv_ai_summary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-Zusammenfassung (CV)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-sm ${!expandedSummary ? 'line-clamp-3' : ''}`}>
              {extCandidate.cv_ai_summary}
            </p>
            {extCandidate.cv_ai_summary.length > 200 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-auto py-1 px-2 text-xs"
                onClick={() => setExpandedSummary(!expandedSummary)}
              >
                {expandedSummary ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                <ChevronDown className={`h-3 w-3 ml-1 transition-transform ${expandedSummary ? 'rotate-180' : ''}`} />
              </Button>
            )}
            {extCandidate.cv_ai_bullets?.length > 0 && expandedSummary && (
              <ul className="mt-3 space-y-1">
                {(extCandidate.cv_ai_bullets as string[]).map((bullet: string, i: number) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {bullet}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* ACCORDIONS - Expandable Sections */}
      <Accordion type="multiple" className="space-y-2">
        {/* ACC 1: Berufserfahrung & CV */}
        <AccordionItem value="experience" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Beruflicher Hintergrund</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              {/* Current Position */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Aktuelle Rolle</p>
                  <p className="font-medium">{candidate.job_title || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Firma</p>
                  <p className="font-medium">{candidate.company || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Erfahrung</p>
                  <p className="font-medium">
                    {candidate.experience_years ? `${candidate.experience_years} Jahre` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Seniority</p>
                  <p className="font-medium">
                    {candidate.seniority ? seniorityLabels[candidate.seniority] : '—'}
                  </p>
                </div>
              </div>

              {/* Skills */}
              {candidate.skills?.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1">
                    {candidate.skills.slice(0, 10).map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills.length > 10 && (
                      <Badge variant="secondary" className="text-xs">
                        +{candidate.skills.length - 10}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Specializations */}
              {extCandidate.specializations?.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Spezialisierungen</p>
                  <div className="flex flex-wrap gap-1">
                    {extCandidate.specializations.map((s: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Certificates */}
              {(candidate.certificates as string[])?.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-2">Zertifikate</p>
                  <div className="flex flex-wrap gap-1">
                    {(candidate.certificates as string[]).map((cert, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-primary/50">
                        <Award className="h-3 w-3 mr-1" />
                        {cert}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ACC 2: Gehalt & Verfügbarkeit */}
        <AccordionItem value="salary" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Gehalt & Verfügbarkeit</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 text-sm pt-2">
              <div>
                <p className="text-muted-foreground text-xs">Gehaltsvorstellung</p>
                <p className="font-medium">
                  {candidate.expected_salary
                    ? `${candidate.expected_salary.toLocaleString('de-DE')} €`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Aktuelles Gehalt</p>
                <p className="font-medium">
                  {candidate.current_salary
                    ? `${candidate.current_salary.toLocaleString('de-DE')} €`
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Kündigungsfrist</p>
                <p className="font-medium">
                  {candidate.notice_period
                    ? noticePeriodLabels[candidate.notice_period] || candidate.notice_period
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Verfügbar ab</p>
                <p className="font-medium">
                  {candidate.availability_date
                    ? format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Remote möglich</p>
                <p className="font-medium">{candidate.remote_possible ? 'Ja' : 'Nein'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Umzugsbereitschaft</p>
                <p className="font-medium">{candidate.relocation_willing ? 'Ja' : 'Nein'}</p>
              </div>
            </div>

            {/* Target Preferences */}
            {((extCandidate.target_roles as string[])?.length > 0 ||
              (extCandidate.target_locations as string[])?.length > 0) && (
              <div className="mt-4 pt-4 border-t space-y-2">
                <p className="text-muted-foreground text-xs flex items-center gap-1">
                  <Target className="h-3 w-3" />
                  Präferenzen
                </p>
                {(extCandidate.target_roles as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Rollen:</span>
                    {(extCandidate.target_roles as string[]).map((r: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                    ))}
                  </div>
                )}
                {(extCandidate.target_locations as string[])?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground mr-1">Standorte:</span>
                    {(extCandidate.target_locations as string[]).map((l: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{l}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ACC 3: Kontaktdaten */}
        <AccordionItem value="contact" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Kontaktdaten</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 text-sm pt-2">
              <div>
                <p className="text-muted-foreground text-xs">E-Mail</p>
                <p className="font-medium">{candidate.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Telefon</p>
                <p className="font-medium">{candidate.phone || '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Standort</p>
                <p className="font-medium">{candidate.city || '—'}</p>
              </div>
              {extCandidate.nationality && (
                <div>
                  <p className="text-muted-foreground text-xs">Nationalität</p>
                  <p className="font-medium">{extCandidate.nationality}</p>
                </div>
              )}
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {candidate.linkedin_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-3 w-3 mr-1" />
                    LinkedIn
                  </a>
                </Button>
              )}
              {extCandidate.github_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={extCandidate.github_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    GitHub
                  </a>
                </Button>
              )}
              {extCandidate.portfolio_url && (
                <Button variant="outline" size="sm" asChild>
                  <a href={extCandidate.portfolio_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Portfolio
                  </a>
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ACC 4: Dokumente */}
        <AccordionItem value="documents" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Dokumente</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-2">
              <CandidateDocumentsManager candidateId={candidate.id} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ACC 5: CRM Info */}
        {(candidate.hubspot_contact_id || candidate.import_source) && (
          <AccordionItem value="crm" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">CRM-Informationen</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-4 text-sm pt-2">
                <div>
                  <p className="text-muted-foreground text-xs">Quelle</p>
                  <Badge variant="outline">
                    {candidate.import_source
                      ? sourceLabels[candidate.import_source] || candidate.import_source
                      : 'Manuell'}
                  </Badge>
                </div>
                {candidate.hubspot_contact_id && (
                  <div>
                    <p className="text-muted-foreground text-xs">HubSpot ID</p>
                    <p className="font-mono text-xs">{candidate.hubspot_contact_id}</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      {/* Meta Info */}
      <div className="text-xs text-muted-foreground border-t pt-4">
        Hinzugefügt am{' '}
        {format(new Date(candidate.created_at), "dd. MMMM yyyy 'um' HH:mm", {
          locale: de,
        })}
      </div>
    </div>
  );
}
