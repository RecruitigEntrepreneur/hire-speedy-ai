import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, MapPin, Briefcase, Clock, Users, Home } from "lucide-react";

interface JobStatsCardProps {
  location: string | null;
  remoteType: string | null;
  employmentType: string | null;
  experienceLevel: string | null;
  totalSubmissions: number;
  salaryMin: number | null;
  salaryMax: number | null;
}

export function JobStatsCard({ 
  location, 
  remoteType, 
  employmentType,
  experienceLevel,
  totalSubmissions,
  salaryMin,
  salaryMax
}: JobStatsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-primary" />
          Job Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location */}
        {location && (
          <StatRow 
            icon={MapPin} 
            label="Standort" 
            value={location} 
          />
        )}

        {/* Remote Type */}
        {remoteType && (
          <StatRow 
            icon={Home} 
            label="Arbeitsmodell" 
            value={formatRemoteType(remoteType)} 
          />
        )}

        {/* Employment Type */}
        {employmentType && (
          <StatRow 
            icon={Briefcase} 
            label="Anstellung" 
            value={formatEmploymentType(employmentType)} 
          />
        )}

        {/* Experience Level */}
        {experienceLevel && (
          <StatRow 
            icon={Clock} 
            label="Erfahrung" 
            value={formatExperienceLevel(experienceLevel)} 
          />
        )}

        {/* Salary */}
        {(salaryMin || salaryMax) && (
          <StatRow 
            icon={BarChart3} 
            label="Gehalt" 
            value={formatSalary(salaryMin, salaryMax)} 
          />
        )}

        {/* Total Submissions */}
        <div className="pt-2 border-t">
          <StatRow 
            icon={Users} 
            label="Einreichungen" 
            value={`${totalSubmissions} Kandidaten`}
            highlight
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface StatRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}

function StatRow({ icon: Icon, label, value, highlight }: StatRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={`text-sm font-medium ${highlight ? 'text-primary' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function formatRemoteType(type: string): string {
  const map: Record<string, string> = {
    'remote': '100% Remote',
    'hybrid': 'Hybrid',
    'onsite': 'Vor Ort',
    'flexible': 'Flexibel'
  };
  return map[type.toLowerCase()] || type;
}

function formatEmploymentType(type: string): string {
  const map: Record<string, string> = {
    'full-time': 'Vollzeit',
    'fulltime': 'Vollzeit',
    'part-time': 'Teilzeit',
    'parttime': 'Teilzeit',
    'contract': 'Freelance',
    'freelance': 'Freelance',
    'temporary': 'Befristet'
  };
  return map[type.toLowerCase()] || type;
}

function formatExperienceLevel(level: string): string {
  const map: Record<string, string> = {
    'junior': 'Junior (0-2 Jahre)',
    'mid': 'Mid-Level (2-5 Jahre)',
    'mid-level': 'Mid-Level (2-5 Jahre)',
    'senior': 'Senior (5+ Jahre)',
    'lead': 'Lead/Principal',
    'principal': 'Lead/Principal',
    'executive': 'Executive'
  };
  return map[level.toLowerCase()] || level;
}

function formatSalary(min: number | null, max: number | null): string {
  if (min && max) {
    return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
  }
  if (max) {
    return `bis €${(max / 1000).toFixed(0)}k`;
  }
  if (min) {
    return `ab €${(min / 1000).toFixed(0)}k`;
  }
  return 'k.A.';
}
