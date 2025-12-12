import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';
import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { CandidateDocuments } from './CandidateDocuments';

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

const workModelLabels: Record<string, string> = {
  fulltime: 'Vollzeit',
  parttime: 'Teilzeit',
  freelance: 'Freiberuflich',
  contract: 'Befristet',
};

const sourceLabels: Record<string, string> = {
  manual: 'Manuell',
  hubspot: 'HubSpot',
  linkedin: 'LinkedIn',
  ats: 'ATS',
  cv_upload: 'CV-Upload',
};

const residenceStatusLabels: Record<string, string> = {
  citizen: 'Staatsangehöriger',
  permanent: 'Unbefristete Aufenthaltsgenehmigung',
  work_visa: 'Arbeitsvisum',
  student_visa: 'Studentenvisum',
  pending: 'In Bearbeitung',
};

const noticePeriodLabels: Record<string, string> = {
  immediate: 'Sofort verfügbar',
  '2_weeks': '2 Wochen',
  '1_month': '1 Monat',
  '2_months': '2 Monate',
  '3_months': '3 Monate',
  '6_months': '6 Monate',
};

const remoteLabels: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Vor Ort',
  flexible: 'Flexibel',
};

export function CandidateOverviewTab({ candidate, tags }: CandidateOverviewTabProps) {
  const extCandidate = candidate as any;
  const projectMetrics = extCandidate.project_metrics || {};
  const hasProjectMetrics = Object.values(projectMetrics).some(v => v);
  const hasExpose = extCandidate.expose_title || extCandidate.expose_summary || 
    (extCandidate.expose_highlights?.length > 0) || (extCandidate.expose_project_highlights?.length > 0);
  
  return (
    <div className="space-y-6">
      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              style={{
                backgroundColor: tag.color + '30',
                color: tag.color,
                borderColor: tag.color,
              }}
            >
              {tag.name}
            </Badge>
          ))}
        </div>
      )}

      {/* AI Summary */}
      {extCandidate.cv_ai_summary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              AI-Zusammenfassung
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{extCandidate.cv_ai_summary}</p>
            {extCandidate.cv_ai_bullets && (extCandidate.cv_ai_bullets as string[])?.length > 0 && (
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

      {/* Exposé Preview */}
      {hasExpose && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-600" />
              Exposé-Vorschau
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extCandidate.expose_title && (
              <div>
                <p className="text-muted-foreground text-xs">Titel</p>
                <p className="font-semibold">{extCandidate.expose_title}</p>
              </div>
            )}
            {extCandidate.expose_summary && (
              <div>
                <p className="text-muted-foreground text-xs">Kurzprofil</p>
                <p className="text-sm">{extCandidate.expose_summary}</p>
              </div>
            )}
            {extCandidate.expose_highlights?.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Qualifikations-Highlights</p>
                <div className="flex flex-wrap gap-1">
                  {extCandidate.expose_highlights.map((h: string, i: number) => (
                    <Badge key={i} variant="outline" className="border-amber-500/50 text-amber-700">
                      {h}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {extCandidate.expose_project_highlights?.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1">Projekt-Highlights</p>
                <ul className="text-sm space-y-1">
                  {extCandidate.expose_project_highlights.map((p: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-600">▸</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Basisdaten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Kontaktdaten
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">E-Mail</p>
              <p className="font-medium">{candidate.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Telefon</p>
              <p className="font-medium">{candidate.phone || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Standort
              </p>
              <p className="font-medium">{candidate.city || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Remote möglich
              </p>
              <p className="font-medium">{candidate.remote_possible ? 'Ja' : 'Nein'}</p>
            </div>
            {extCandidate.nationality && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Flag className="h-3 w-3" />
                  Nationalität
                </p>
                <p className="font-medium">{extCandidate.nationality}</p>
              </div>
            )}
            {extCandidate.residence_status && (
              <div>
                <p className="text-muted-foreground">Aufenthaltsstatus</p>
                <p className="font-medium">
                  {residenceStatusLabels[extCandidate.residence_status] || extCandidate.residence_status}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Beruflicher Hintergrund */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Beruflicher Hintergrund
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Aktuelle Rolle</p>
              <p className="font-medium">{candidate.job_title || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Firma</p>
              <p className="font-medium">{candidate.company || '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Erfahrung
              </p>
              <p className="font-medium">
                {candidate.experience_years !== null
                  ? `${candidate.experience_years} Jahre`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Seniority</p>
              <p className="font-medium">
                {candidate.seniority ? seniorityLabels[candidate.seniority] || candidate.seniority : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Arbeitsmodell</p>
              <p className="font-medium">
                {candidate.work_model ? workModelLabels[candidate.work_model] || candidate.work_model : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Kündigungsfrist
              </p>
              <p className="font-medium">
                {candidate.notice_period 
                  ? noticePeriodLabels[candidate.notice_period] || candidate.notice_period 
                  : '—'}
              </p>
            </div>
          </div>
          
          {/* Spezialisierungen */}
          {extCandidate.specializations?.length > 0 && (
            <div className="mt-4">
              <p className="text-muted-foreground text-xs mb-2">Spezialisierungen</p>
              <div className="flex flex-wrap gap-1">
                {extCandidate.specializations.map((s: string, i: number) => (
                  <Badge key={i} variant="secondary">{s}</Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Branchenerfahrung */}
          {extCandidate.industry_experience?.length > 0 && (
            <div className="mt-4">
              <p className="text-muted-foreground text-xs mb-2">Branchenerfahrung</p>
              <div className="flex flex-wrap gap-1">
                {extCandidate.industry_experience.map((s: string, i: number) => (
                  <Badge key={i} variant="outline">{s}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Projektmetriken */}
      {hasProjectMetrics && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              Projektmetriken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {projectMetrics.max_team_size && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Max. Teamgröße</p>
                    <p className="font-medium">{projectMetrics.max_team_size} Personen</p>
                  </div>
                </div>
              )}
              {projectMetrics.max_budget && (
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Max. Budget</p>
                    <p className="font-medium">{projectMetrics.max_budget}</p>
                  </div>
                </div>
              )}
              {projectMetrics.locations_managed && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Standorte</p>
                    <p className="font-medium">{projectMetrics.locations_managed}</p>
                  </div>
                </div>
              )}
              {projectMetrics.units_delivered && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-muted-foreground text-xs">Rollout-Einheiten</p>
                    <p className="font-medium">{projectMetrics.units_delivered}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gehalt & Verfügbarkeit */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Gehalt & Verfügbarkeit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Gehaltsvorstellung (Fix)</p>
              <p className="font-medium">
                {candidate.salary_fix || candidate.expected_salary
                  ? `${(candidate.salary_fix || candidate.expected_salary)?.toLocaleString('de-DE')} €`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Gehaltsvorstellung (Bonus)</p>
              <p className="font-medium">
                {candidate.salary_bonus
                  ? `${candidate.salary_bonus.toLocaleString('de-DE')} €`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Aktuelles Gehalt</p>
              <p className="font-medium">
                {candidate.current_salary
                  ? `${candidate.current_salary.toLocaleString('de-DE')} €`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Verfügbar ab
              </p>
              <p className="font-medium">
                {candidate.availability_date
                  ? format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <Plane className="h-3 w-3" />
                Umzugsbereitschaft
              </p>
              <p className="font-medium">{candidate.relocation_willing ? 'Ja' : 'Nein'}</p>
            </div>
            <div>
              <p className="text-muted-foreground flex items-center gap-1">
                <FileCheck className="h-3 w-3" />
                Visum erforderlich
              </p>
              <p className="font-medium">{candidate.visa_required ? 'Ja' : 'Nein'}</p>
            </div>
            {extCandidate.remote_preference && (
              <div>
                <p className="text-muted-foreground">Remote-Präferenz</p>
                <p className="font-medium">
                  {remoteLabels[extCandidate.remote_preference] || extCandidate.remote_preference}
                </p>
              </div>
            )}
          </div>
          {candidate.work_permit_notes && (
            <div className="mt-4">
              <p className="text-muted-foreground text-sm">Arbeitsrechtliche Hinweise</p>
              <p className="text-sm mt-1">{candidate.work_permit_notes}</p>
            </div>
          )}
          
          {/* Zielvorstellungen */}
          {(extCandidate.target_locations as string[])?.length > 0 || 
           (extCandidate.target_roles as string[])?.length > 0 ||
           (extCandidate.target_industries as string[])?.length > 0 ? (
            <div className="mt-4 pt-4 border-t space-y-3">
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <Target className="h-3 w-3" />
                Präferenzen
              </p>
              {(extCandidate.target_locations as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Standorte:</span>
                  {(extCandidate.target_locations as string[]).map((l: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{l}</Badge>
                  ))}
                </div>
              )}
              {(extCandidate.target_roles as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Rollen:</span>
                  {(extCandidate.target_roles as string[]).map((r: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                </div>
              )}
              {(extCandidate.target_industries as string[])?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-xs text-muted-foreground mr-1">Branchen:</span>
                  {(extCandidate.target_industries as string[]).map((b: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{b}</Badge>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Skills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hard Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill, i) => (
                <Badge key={i} variant="outline">
                  {skill}
                </Badge>
              ))}
            </div>
            
            {/* Soft Skills */}
            {extCandidate.soft_skills?.length > 0 && (
              <div className="mt-4">
                <p className="text-muted-foreground text-xs mb-2">Soft Skills</p>
                <div className="flex flex-wrap gap-2">
                  {extCandidate.soft_skills.map((skill: string, i: number) => (
                    <Badge key={i} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Zertifikate */}
      {(candidate.certificates as string[])?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              Zertifikate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(candidate.certificates as string[]).map((cert, i) => (
                <Badge key={i} variant="outline" className="border-primary/50">
                  {cert}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {candidate.summary && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zusammenfassung</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{candidate.summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Documents & Links */}
      <CandidateDocuments candidate={candidate} />

      {/* CRM Info */}
      {(candidate.hubspot_contact_id || candidate.import_source) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              CRM-Informationen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Quelle</p>
                <Badge variant="outline">
                  {candidate.import_source ? sourceLabels[candidate.import_source] || candidate.import_source : 'Manuell'}
                </Badge>
              </div>
              {candidate.hubspot_contact_id && (
                <div>
                  <p className="text-muted-foreground">HubSpot ID</p>
                  <p className="font-mono text-xs">{candidate.hubspot_contact_id}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground border-t pt-4">
        Hinzugefügt am{' '}
        {format(new Date(candidate.created_at), "dd. MMMM yyyy 'um' HH:mm", {
          locale: de,
        })}
      </div>
    </div>
  );
}
