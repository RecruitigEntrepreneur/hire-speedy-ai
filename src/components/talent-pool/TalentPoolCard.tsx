import { TalentPoolEntry, useTalentPool } from '@/hooks/useTalentPool';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  MoreHorizontal,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  Star,
  Clock,
  Coffee,
  Users,
  MessageSquare,
  Trash2,
} from 'lucide-react';

interface TalentPoolCardProps {
  entry: TalentPoolEntry;
}

const poolTypeConfig = {
  general: { label: 'Allgemein', icon: Users, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  silver_medalist: { label: 'Silber-Medaillist', icon: Star, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  future_fit: { label: 'Zukunft', icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  passive: { label: 'Passiv', icon: Coffee, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

const availabilityLabels: Record<string, string> = {
  immediate: 'Sofort verfügbar',
  '2_weeks': '2 Wochen',
  '1_month': '1 Monat',
  '3_months': '3 Monate',
  passive: 'Nicht aktiv suchend',
};

export function TalentPoolCard({ entry }: TalentPoolCardProps) {
  const { markContacted, removeFromPool } = useTalentPool();
  const candidate = entry.candidates;
  const config = poolTypeConfig[entry.pool_type];
  const Icon = config.icon;

  const isContactDue = entry.next_contact_at && new Date(entry.next_contact_at) <= new Date();

  return (
    <Card className={isContactDue ? 'border-orange-500 border-2' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {candidate?.full_name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{candidate?.full_name || 'Unbekannt'}</h3>
                <Badge variant="secondary" className={config.color}>
                  <Icon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
                {isContactDue && (
                  <Badge variant="destructive">Kontakt fällig</Badge>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {candidate?.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {candidate.email}
                  </span>
                )}
                {candidate?.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {candidate.phone}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {entry.experience_years && (
                  <Badge variant="outline">
                    <Briefcase className="h-3 w-3 mr-1" />
                    {entry.experience_years} Jahre Erfahrung
                  </Badge>
                )}
                {entry.availability && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {availabilityLabels[entry.availability] || entry.availability}
                  </Badge>
                )}
                {entry.preferred_locations?.length > 0 && (
                  <Badge variant="outline">
                    <MapPin className="h-3 w-3 mr-1" />
                    {entry.preferred_locations.slice(0, 2).join(', ')}
                  </Badge>
                )}
              </div>

              {entry.skills_snapshot && entry.skills_snapshot.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.skills_snapshot.slice(0, 5).map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {entry.skills_snapshot.length > 5 && (
                    <Badge variant="secondary" className="text-xs">
                      +{entry.skills_snapshot.length - 5}
                    </Badge>
                  )}
                </div>
              )}

              {entry.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">
                  "{entry.notes}"
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right text-sm text-muted-foreground">
              {entry.last_contacted_at && (
                <p>
                  Letzter Kontakt:{' '}
                  {formatDistanceToNow(new Date(entry.last_contacted_at), {
                    locale: de,
                    addSuffix: true,
                  })}
                </p>
              )}
              {entry.next_contact_at && (
                <p className={isContactDue ? 'text-orange-600 font-medium' : ''}>
                  Nächster Kontakt:{' '}
                  {format(new Date(entry.next_contact_at), 'dd.MM.yyyy', { locale: de })}
                </p>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => markContacted.mutate(entry.id)}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Als kontaktiert markieren
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm('Aus dem Talent Pool entfernen?')) {
                      removeFromPool.mutate(entry.id);
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Aus Pool entfernen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
