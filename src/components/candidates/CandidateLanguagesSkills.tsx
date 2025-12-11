import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Languages, Sparkles, Code, Wrench, Brain, Layers } from 'lucide-react';

interface CandidateLanguagesSkillsProps {
  candidateId: string;
}

interface Language {
  id: string;
  language: string;
  proficiency: string | null;
}

interface Skill {
  id: string;
  skill_name: string;
  category: string | null;
  level: string | null;
}

const proficiencyLabels: Record<string, string> = {
  native: 'Muttersprache',
  fluent: 'Fließend',
  advanced: 'Fortgeschritten',
  intermediate: 'Gut',
  basic: 'Grundkenntnisse',
};

const proficiencyColors: Record<string, string> = {
  native: 'bg-primary text-primary-foreground',
  fluent: 'bg-green-500/20 text-green-700 dark:text-green-400',
  advanced: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  intermediate: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  basic: 'bg-muted text-muted-foreground',
};

const categoryIcons: Record<string, React.ReactNode> = {
  programming: <Code className="h-3.5 w-3.5" />,
  tool: <Wrench className="h-3.5 w-3.5" />,
  soft_skill: <Brain className="h-3.5 w-3.5" />,
  process: <Layers className="h-3.5 w-3.5" />,
  domain: <Sparkles className="h-3.5 w-3.5" />,
};

const categoryLabels: Record<string, string> = {
  programming: 'Programmierung',
  tool: 'Tools',
  soft_skill: 'Soft Skills',
  process: 'Methoden',
  domain: 'Fachkenntnisse',
};

export function CandidateLanguagesSkills({ candidateId }: CandidateLanguagesSkillsProps) {
  const { data: languages, isLoading: loadingLang } = useQuery({
    queryKey: ['candidate-languages', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_languages')
        .select('*')
        .eq('candidate_id', candidateId);

      if (error) throw error;
      return data as Language[];
    },
  });

  const { data: skills, isLoading: loadingSkills } = useQuery({
    queryKey: ['candidate-skills', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_skills')
        .select('*')
        .eq('candidate_id', candidateId);

      if (error) throw error;
      return data as Skill[];
    },
  });

  // Group skills by category
  const groupedSkills = skills?.reduce((acc, skill) => {
    const category = skill.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>) || {};

  if (loadingLang || loadingSkills) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-6 w-20" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Languages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Languages className="h-4 w-4" />
            Sprachen ({languages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!languages || languages.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Sprachen hinterlegt</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <Badge 
                  key={lang.id} 
                  className={proficiencyColors[lang.proficiency || 'basic']}
                  variant="secondary"
                >
                  {lang.language}
                  {lang.proficiency && (
                    <span className="ml-1 opacity-80">
                      ({proficiencyLabels[lang.proficiency] || lang.proficiency})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills by Category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Skills ({skills?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!skills || skills.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Skills hinterlegt</p>
          ) : (
            Object.entries(groupedSkills).map(([category, categorySkills]) => (
              <div key={category}>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                  {categoryIcons[category] || <Sparkles className="h-3.5 w-3.5" />}
                  <span>{categoryLabels[category] || 'Sonstige'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {categorySkills.map((skill) => (
                    <Badge key={skill.id} variant="secondary" className="text-xs">
                      {skill.skill_name}
                      {skill.level && (
                        <span className="ml-1 opacity-60">• {skill.level}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
