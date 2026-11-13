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
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dfLocale, fmtDate } from '@/lib/localeFormat';
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

// Beschriftungen über t('type.…') und t('availability.…') beim Anzeigen
const poolTypeConfig = {
  general: { icon: Users, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  silver_medalist: { icon: Star, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  future_fit: { icon: Clock, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  passive: { icon: Coffee, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
};

const AVAILABILITY_KEYS = ['immediate', '2_weeks', '1_month', '3_months', 'passive'];

export function TalentPoolCard({ entry }: TalentPoolCardProps) {
  const { t } = useTranslation('talentPool');
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
                <h3 className="font-semibold">{candidate?.full_name || t('card.unknown')}</h3>
                <Badge variant="secondary" className={config.color}>
                  <Icon className="h-3 w-3 mr-1" />
                  {t(`type.${entry.pool_type}`)}
                </Badge>
                {isContactDue && (
                  <Badge variant="destructive">{t('card.contactDue')}</Badge>
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
                    {t('card.experience', { count: entry.experience_years })}
                  </Badge>
                )}
                {entry.availability && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {AVAILABILITY_KEYS.includes(entry.availability) ? t(`availability.${entry.availability}`) : entry.availability}
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
                  {t('card.lastContact', { when: formatDistanceToNow(new Date(entry.last_contacted_at), {
                    locale: dfLocale(),
                    addSuffix: true,
                  }) })}
                </p>
              )}
              {entry.next_contact_at && (
                <p className={isContactDue ? 'text-orange-600 font-medium' : ''}>
                  {t('card.nextContact', { date: fmtDate(entry.next_contact_at) })}
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
                  {t('card.markContacted')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    if (confirm(t('card.removeConfirm'))) {
                      removeFromPool.mutate(entry.id);
                    }
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('card.remove')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
