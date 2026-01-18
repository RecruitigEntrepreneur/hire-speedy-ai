import React from 'react';
import { 
  Briefcase, 
  FileText, 
  Euro, 
  Calendar, 
  ExternalLink,
  User,
  Globe,
  Star,
  Target,
  AlertTriangle,
  Compass
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high';
  detail: string;
}

interface ClientSummary {
  key_selling_points?: string[];
  change_motivation_summary?: string;
  career_goals?: string;
  risk_factors?: RiskFactor[];
}

interface CandidateData {
  id: string;
  full_name: string;
  email?: string;
  phone?: string;
  city?: string;
  job_title?: string;
  company?: string;
  experience_years?: number;
  skills?: string[];
  current_salary?: number;
  expected_salary?: number;
  notice_period?: string;
  availability_date?: string;
  cv_url?: string;
  linkedin_url?: string;
  cv_ai_summary?: string;
  language_skills?: any;
}

interface CandidateQuickInfoProps {
  candidate: CandidateData;
  jobTitle?: string;
  clientSummary?: ClientSummary;
}

export function CandidateQuickInfo({ candidate, jobTitle, clientSummary }: CandidateQuickInfoProps) {
  const initials = candidate.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const formatSalary = (salary?: number) => {
    if (!salary) return '-';
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR',
      maximumFractionDigits: 0 
    }).format(salary);
  };

  // Parse language skills - can be array of strings or array of objects
  const parseLanguageSkills = (skills: any): string[] => {
    if (!skills) return [];
    if (Array.isArray(skills)) {
      return skills.map((s: any) => {
        if (typeof s === 'string') return s;
        if (s.language && s.proficiency) return `${s.language} (${s.proficiency})`;
        if (s.language) return s.language;
        return String(s);
      });
    }
    return [];
  };

  const languages = parseLanguageSkills(candidate.language_skills);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Avatar & Name */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <span className="text-xl font-semibold text-primary">{initials}</span>
          </div>
          <h3 className="font-semibold text-lg">{candidate.full_name}</h3>
          {candidate.job_title && (
            <p className="text-sm text-muted-foreground">{candidate.job_title}</p>
          )}
          {candidate.company && (
            <p className="text-xs text-muted-foreground">@ {candidate.company}</p>
          )}
        </div>


        {/* Was zeichnet den Kandidaten aus */}
        {clientSummary?.key_selling_points && clientSummary.key_selling_points.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-amber-500" />
                Was ihn auszeichnet
              </h4>
              <ul className="space-y-1.5">
                {clientSummary.key_selling_points.slice(0, 5).map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Wechselmotivation */}
        {clientSummary?.change_motivation_summary && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-blue-500" />
                Wechselmotivation
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {clientSummary.change_motivation_summary}
              </p>
            </div>
          </>
        )}

        {/* Karriereziel */}
        {clientSummary?.career_goals && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-emerald-500" />
                Karriereziel
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {clientSummary.career_goals}
              </p>
            </div>
          </>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Sprachen
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {languages.map((lang, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {lang}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Current Position */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5" />
            Aktuell
          </h4>
          <div className="text-sm">
            <p className="font-medium">{candidate.job_title || 'Keine Angabe'}</p>
            {candidate.company && <p className="text-muted-foreground">{candidate.company}</p>}
            {candidate.experience_years && (
              <p className="text-muted-foreground">{candidate.experience_years} Jahre Erfahrung</p>
            )}
          </div>
        </div>

        <Separator />

        {/* Skills */}
        {candidate.skills && candidate.skills.length > 0 && (
          <>
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                🎯 Top-Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.slice(0, 6).map((skill, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {candidate.skills.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{candidate.skills.length - 6}
                  </Badge>
                )}
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Documents */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Dokumente
          </h4>
          <div className="flex flex-col gap-1.5">
            {candidate.cv_url ? (
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                onClick={() => window.open(candidate.cv_url, '_blank')}
              >
                <FileText className="h-4 w-4" />
                CV öffnen
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Kein CV verfügbar</p>
            )}
            {candidate.linkedin_url && (
              <Button
                variant="outline"
                size="sm"
                className="justify-start gap-2"
                onClick={() => window.open(candidate.linkedin_url, '_blank')}
              >
                <User className="h-4 w-4" />
                LinkedIn
                <ExternalLink className="h-3 w-3 ml-auto" />
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Conditions */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Euro className="h-3.5 w-3.5" />
            Konditionen
          </h4>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Aktuell:</span>
              <span className="font-medium">{formatSalary(candidate.current_salary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Wunsch:</span>
              <span className="font-medium">{formatSalary(candidate.expected_salary)}</span>
            </div>
            {candidate.notice_period && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Kündigungsfrist:</span>
                <span className="font-medium">{candidate.notice_period}</span>
              </div>
            )}
            {candidate.availability_date && (
              <div className="flex justify-between items-center gap-2">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Verfügbar:
                </span>
                <span className="font-medium">
                  {new Date(candidate.availability_date).toLocaleDateString('de-DE')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Risiken - ganz unten */}
        {clientSummary?.risk_factors && clientSummary.risk_factors.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Risiken
              </h4>
              <ul className="space-y-1.5">
                {clientSummary.risk_factors.slice(0, 2).map((risk, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className={
                      risk.severity === 'high' ? 'text-destructive' :
                      risk.severity === 'medium' ? 'text-amber-500' :
                      'text-muted-foreground'
                    }>
                      {risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢'}
                    </span>
                    <span className="text-muted-foreground">{risk.factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
