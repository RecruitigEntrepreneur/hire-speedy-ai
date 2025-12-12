import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Phone,
  Mail,
  Briefcase,
  Euro,
  Edit,
  Trash2,
  MoreVertical,
  Linkedin,
  UserPlus,
  Tag,
  Eye,
} from 'lucide-react';
import { CandidateTag } from '@/hooks/useCandidateTags';

export interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  experience_years: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  skills: string[] | null;
  summary: string | null;
  cv_url: string | null;
  linkedin_url: string | null;
  availability_date: string | null;
  notice_period: string | null;
  created_at: string;
  // Profile fields
  job_title?: string | null;
  company?: string | null;
  seniority?: string | null;
  work_model?: string | null;
  city?: string | null;
  remote_possible?: boolean | null;
  relocation_willing?: boolean | null;
  salary_fix?: number | null;
  salary_bonus?: number | null;
  visa_required?: boolean | null;
  work_permit_notes?: string | null;
  portfolio_url?: string | null;
  github_url?: string | null;
  website_url?: string | null;
  certificates?: (string | { name: string; url?: string })[] | null;
  hubspot_contact_id?: string | null;
  import_source?: string | null;
  candidate_status?: string | null;
  // Extended fields
  nationality?: string | null;
  residence_status?: string | null;
  specializations?: string[] | null;
  industry_experience?: string[] | null;
  soft_skills?: string[] | null;
  project_metrics?: {
    max_team_size?: number | string;
    max_budget?: string;
    locations_managed?: number | string;
    units_delivered?: string;
  } | null;
  expose_title?: string | null;
  expose_summary?: string | null;
  expose_highlights?: string[] | null;
  expose_project_highlights?: string[] | null;
  expose_certifications?: string[] | null;
  target_locations?: string[] | null;
  target_industries?: string[] | null;
  target_roles?: string[] | null;
  target_employment_type?: string | null;
  remote_preference?: string | null;
  salary_expectation_min?: number | null;
  salary_expectation_max?: number | null;
  cv_ai_summary?: string | null;
  cv_ai_bullets?: string[] | null;
}

interface CandidateCardProps {
  candidate: Candidate;
  tags: CandidateTag[];
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
  onView: (candidate: Candidate) => void;
  onAssignTag: (candidateId: string) => void;
  onAddToPool: (candidate: Candidate) => void;
}

const statusLabels: Record<string, string> = {
  new: 'Neu',
  contacted: 'Kontaktiert',
  interview: 'Interview',
  offer: 'Angebot',
  placed: 'Platziert',
  rejected: 'Absage',
};

export function CandidateCard({
  candidate,
  tags,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onView,
  onAssignTag,
  onAddToPool,
}: CandidateCardProps) {
  const statusLabel = statusLabels[candidate.candidate_status || 'new'] || candidate.candidate_status;

  return (
    <Card
      className={`transition-all hover:shadow-md cursor-pointer ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(candidate.id, !!checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <Avatar className="h-10 w-10" onClick={() => onView(candidate)}>
              <AvatarFallback className="bg-primary/10 text-primary">
                {candidate.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')}
              </AvatarFallback>
            </Avatar>
            <div onClick={() => onView(candidate)}>
              <h3 className="font-semibold">{candidate.full_name}</h3>
              <p className="text-sm text-muted-foreground">
                {candidate.job_title ? `${candidate.job_title}${candidate.company ? ` bei ${candidate.company}` : ''}` : candidate.email}
              </p>
              {candidate.candidate_status && (
                <Badge variant="outline" className="mt-1 text-xs">
                  {statusLabel}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView(candidate)}>
                <Eye className="h-4 w-4 mr-2" />
                Details anzeigen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(candidate)}>
                <Edit className="h-4 w-4 mr-2" />
                Bearbeiten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAssignTag(candidate.id)}>
                <Tag className="h-4 w-4 mr-2" />
                Tags verwalten
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddToPool(candidate)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Zum Talent Pool
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(candidate)}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 mb-3">
          {candidate.phone && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `tel:${candidate.phone}`;
              }}
              title="Anrufen"
            >
              <Phone className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `mailto:${candidate.email}`;
            }}
            title="E-Mail senden"
          >
            <Mail className="h-4 w-4" />
          </Button>
          {candidate.linkedin_url && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                window.open(candidate.linkedin_url!, '_blank');
              }}
              title="LinkedIn öffnen"
            >
              <Linkedin className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="space-y-1.5 text-sm">
          {candidate.experience_years !== null && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              {candidate.experience_years} Jahre Erfahrung
            </div>
          )}
          {candidate.expected_salary && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Euro className="h-3 w-3" />
              {candidate.expected_salary.toLocaleString('de-DE')} € erwartet
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="text-xs"
                style={{ backgroundColor: tag.color + '30', color: tag.color, borderColor: tag.color }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Skills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {candidate.skills.slice(0, 3).map((skill, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {candidate.skills.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{candidate.skills.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
