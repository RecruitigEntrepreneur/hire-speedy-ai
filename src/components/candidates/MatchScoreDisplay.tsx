import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertTriangle, TrendingUp, Sparkles } from 'lucide-react';

interface MatchAnalysis {
  skillMatch: number;
  experienceMatch: number;
  salaryMatch: number;
  matchedSkills: string[];
  missingMustHaves: string[];
  overallAssessment: string;
  strengthPoints: string[];
  concernPoints: string[];
}

interface MatchScoreDisplayProps {
  overallScore: number;
  analysis: MatchAnalysis;
  compact?: boolean;
}

export function MatchScoreDisplay({ overallScore, analysis, compact = false }: MatchScoreDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${getScoreColor(overallScore)}`}>
          <Sparkles className="h-4 w-4" />
          <span className="font-bold">{overallScore}%</span>
        </div>
        {analysis.matchedSkills.length > 0 && (
          <div className="flex gap-1">
            {analysis.matchedSkills.slice(0, 3).map((skill) => (
              <Badge key={skill} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {analysis.matchedSkills.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{analysis.matchedSkills.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Match-Analyse
          </span>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${getScoreColor(overallScore)}`}>
            <span className="text-2xl font-bold">{overallScore}%</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Score Breakdown */}
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground">Score-Aufschlüsselung</h4>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Skills</span>
                <span className="font-medium">{analysis.skillMatch}%</span>
              </div>
              <Progress value={analysis.skillMatch} className={getProgressColor(analysis.skillMatch)} />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Erfahrung</span>
                <span className="font-medium">{analysis.experienceMatch}%</span>
              </div>
              <Progress value={analysis.experienceMatch} className={getProgressColor(analysis.experienceMatch)} />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Gehalt</span>
                <span className="font-medium">{analysis.salaryMatch}%</span>
              </div>
              <Progress value={analysis.salaryMatch} className={getProgressColor(analysis.salaryMatch)} />
            </div>
          </div>
        </div>

        {/* Assessment */}
        {analysis.overallAssessment && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">{analysis.overallAssessment}</p>
          </div>
        )}

        {/* Matched Skills */}
        {analysis.matchedSkills.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Übereinstimmende Skills
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.matchedSkills.map((skill) => (
                <Badge key={skill} variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Missing Must-Haves */}
        {analysis.missingMustHaves.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Fehlende Must-Haves
            </h4>
            <div className="flex flex-wrap gap-2">
              {analysis.missingMustHaves.map((skill) => (
                <Badge key={skill} variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Strength Points */}
        {analysis.strengthPoints.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Stärken
            </h4>
            <ul className="space-y-1">
              {analysis.strengthPoints.map((point, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Concern Points */}
        {analysis.concernPoints.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Bedenken
            </h4>
            <ul className="space-y-1">
              {analysis.concernPoints.map((point, index) => (
                <li key={index} className="text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
