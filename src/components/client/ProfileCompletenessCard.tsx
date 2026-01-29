import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Users, TrendingUp, Calendar, Sparkles, CheckCircle2 } from 'lucide-react';

interface CompanyProfile {
  company_name: string;
  website: string | null;
  description: string | null;
  headcount: number | null;
  annual_revenue: string | null;
  founded_year: number | null;
  unique_selling_point: string | null;
}

interface ProfileCompletenessCardProps {
  profile: CompanyProfile;
  onScrollToSection?: () => void;
}

interface MissingField {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export function ProfileCompletenessCard({ profile, onScrollToSection }: ProfileCompletenessCardProps) {
  // Define required fields with their labels
  const requiredFields: MissingField[] = [
    { key: 'company_name', label: 'Firmenname', icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: 'website', label: 'Website', icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: 'description', label: 'Beschreibung', icon: <CheckCircle2 className="h-4 w-4" /> },
    { key: 'headcount', label: 'Mitarbeiteranzahl', icon: <Users className="h-4 w-4" /> },
    { key: 'annual_revenue', label: 'Jahresumsatz', icon: <TrendingUp className="h-4 w-4" /> },
    { key: 'founded_year', label: 'Gründungsjahr', icon: <Calendar className="h-4 w-4" /> },
    { key: 'unique_selling_point', label: 'Unique Selling Point', icon: <Sparkles className="h-4 w-4" /> },
  ];

  // Calculate completion
  const filledFields = requiredFields.filter(field => {
    const value = profile[field.key as keyof CompanyProfile];
    return value !== null && value !== undefined && value !== '';
  });

  const completionPercentage = Math.round((filledFields.length / requiredFields.length) * 100);
  const missingFields = requiredFields.filter(field => {
    const value = profile[field.key as keyof CompanyProfile];
    return value === null || value === undefined || value === '';
  });

  // Don't show if profile is complete
  if (completionPercentage === 100) {
    return null;
  }

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base font-semibold">
              Dein Profil ist zu {completionPercentage}% vollständig
            </CardTitle>
            <CardDescription className="mt-1">
              Vervollständige dein Profil, damit Recruiter dein Unternehmen besser präsentieren können
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={completionPercentage} className="h-2" />
        
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Fehlende Angaben:</p>
          <ul className="space-y-1.5">
            {missingFields.map((field) => (
              <li key={field.key} className="flex items-center gap-2 text-sm text-muted-foreground">
                {field.icon}
                {field.label}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Diese Infos werden Recruitern angezeigt, um dein Unternehmen als attraktiven Arbeitgeber darzustellen.
        </p>

        {onScrollToSection && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onScrollToSection}
            className="w-full border-warning/30 hover:bg-warning/10"
          >
            Jetzt vervollständigen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
