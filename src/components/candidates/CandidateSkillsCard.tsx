import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wrench, Award, ChevronDown, ChevronUp } from 'lucide-react';

interface CandidateSkillsCardProps {
  skills?: string[] | null;
  certifications?: string[] | null;
}

export function CandidateSkillsCard({ skills, certifications }: CandidateSkillsCardProps) {
  const { t } = useTranslation('candidateDetail');
  const [expanded, setExpanded] = useState(false);

  const hasSkills = skills && skills.length > 0;
  const hasCertifications = certifications && certifications.length > 0;

  if (!hasSkills && !hasCertifications) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            {t('skills.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('skills.empty')}
          </p>
        </CardContent>
      </Card>
    );
  }

  const displayLimit = 6;
  const displaySkills = expanded ? skills : skills?.slice(0, displayLimit);
  const hasMoreSkills = (skills?.length ?? 0) > displayLimit;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          {t('skills.title')}
          {hasSkills && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {skills.length} Skills
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Skills */}
        {hasSkills && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t('skills.core')}</p>
            <div className="flex flex-wrap gap-1.5">
              {displaySkills?.map((skill, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="text-xs font-normal"
                >
                  {skill}
                </Badge>
              ))}
            </div>
            {hasMoreSkills && (
              <Button
                variant="ghost"
                size="sm"
                className="px-0 h-auto text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    {t('common.showLess')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    {t('skills.more', { count: (skills?.length ?? 0) - displayLimit })}
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Certifications */}
        {hasCertifications && (
          <div className="space-y-2 pt-3 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Award className="h-3 w-3" />
              Zertifizierungen
            </p>
            <div className="flex flex-wrap gap-1.5">
              {certifications.map((cert, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="text-xs border-amber-500/50 text-amber-600 dark:text-amber-400"
                >
                  {cert}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
