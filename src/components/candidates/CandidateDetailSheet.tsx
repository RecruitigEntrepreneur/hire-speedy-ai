import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  Phone,
  Linkedin,
  FileText,
  Calendar,
  Briefcase,
  Euro,
  Clock,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { CandidateJobsOverview } from './CandidateJobsOverview';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';

interface CandidateDetailSheetProps {
  candidate: Candidate | null;
  tags: CandidateTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (candidate: Candidate) => void;
}

export function CandidateDetailSheet({
  candidate,
  tags,
  open,
  onOpenChange,
  onEdit,
}: CandidateDetailSheetProps) {
  const { activities, loading: activitiesLoading } = useCandidateActivityLog(candidate?.id);

  if (!candidate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg">
                  {candidate.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-xl">{candidate.full_name}</SheetTitle>
                <p className="text-sm text-muted-foreground">{candidate.email}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(candidate)}>
              <Edit className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mb-6">
            {candidate.phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `tel:${candidate.phone}`}
              >
                <Phone className="h-4 w-4 mr-2" />
                Anrufen
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = `mailto:${candidate.email}`}
            >
              <Mail className="h-4 w-4 mr-2" />
              E-Mail
            </Button>
            {candidate.linkedin_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(candidate.linkedin_url!, '_blank')}
              >
                <Linkedin className="h-4 w-4 mr-2" />
                LinkedIn
              </Button>
            )}
            {candidate.cv_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(candidate.cv_url!, '_blank')}
              >
                <FileText className="h-4 w-4 mr-2" />
                CV öffnen
              </Button>
            )}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
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

          <Separator className="my-4" />

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                Erfahrung
              </p>
              <p className="font-medium">
                {candidate.experience_years !== null
                  ? `${candidate.experience_years} Jahre`
                  : 'Nicht angegeben'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Euro className="h-3 w-3" />
                Gehaltsvorstellung
              </p>
              <p className="font-medium">
                {candidate.expected_salary
                  ? `${candidate.expected_salary.toLocaleString('de-DE')} €`
                  : 'Nicht angegeben'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Euro className="h-3 w-3" />
                Aktuelles Gehalt
              </p>
              <p className="font-medium">
                {candidate.current_salary
                  ? `${candidate.current_salary.toLocaleString('de-DE')} €`
                  : 'Nicht angegeben'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Verfügbar ab
              </p>
              <p className="font-medium">
                {candidate.availability_date
                  ? format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })
                  : 'Nicht angegeben'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Kündigungsfrist
              </p>
              <p className="font-medium">{candidate.notice_period || 'Nicht angegeben'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Telefon
              </p>
              <p className="font-medium">{candidate.phone || 'Nicht angegeben'}</p>
            </div>
          </div>

          {/* Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Skills</h4>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, i) => (
                  <Badge key={i} variant="outline">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {candidate.summary && (
            <div className="mb-6">
              <h4 className="text-sm font-medium mb-2">Zusammenfassung</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {candidate.summary}
              </p>
            </div>
          )}

          <Separator className="my-4" />

          {/* Tabs for Activities and Jobs */}
          <Tabs defaultValue="activities" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="activities">Aktivitäten</TabsTrigger>
              <TabsTrigger value="jobs">Jobs</TabsTrigger>
            </TabsList>
            <TabsContent value="activities" className="mt-4">
              <CandidateActivityTimeline
                activities={activities}
                loading={activitiesLoading}
              />
            </TabsContent>
            <TabsContent value="jobs" className="mt-4">
              <CandidateJobsOverview candidateId={candidate.id} />
            </TabsContent>
          </Tabs>

          {/* Meta Info */}
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
            Hinzugefügt am{' '}
            {format(new Date(candidate.created_at), "dd. MMMM yyyy 'um' HH:mm", {
              locale: de,
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
