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
};

const workModelLabels: Record<string, string> = {
  fulltime: 'Vollzeit',
  parttime: 'Teilzeit',
  freelance: 'Freiberuflich',
};

const sourceLabels: Record<string, string> = {
  manual: 'Manuell',
  hubspot: 'HubSpot',
  linkedin: 'LinkedIn',
  ats: 'ATS',
};

export function CandidateOverviewTab({ candidate, tags }: CandidateOverviewTabProps) {
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
              <p className="font-medium">{candidate.notice_period || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
          </div>
          {candidate.work_permit_notes && (
            <div className="mt-4">
              <p className="text-muted-foreground text-sm">Arbeitsrechtliche Hinweise</p>
              <p className="text-sm mt-1">{candidate.work_permit_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills */}
      {candidate.skills && candidate.skills.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((skill, i) => (
                <Badge key={i} variant="outline">
                  {skill}
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
