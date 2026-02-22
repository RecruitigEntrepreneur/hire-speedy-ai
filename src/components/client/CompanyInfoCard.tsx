import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  Globe, 
  Linkedin, 
  MapPin, 
  ExternalLink,
  Factory,
  Calendar,
  Briefcase,
  Monitor,
  ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface CompanyInfoCardProps {
  companyName: string;
  industry?: string | null;
  location?: string | null;
  employeeCount?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  foundedYear?: number | null;
  description?: string | null;
  remoteType?: string | null;
  employmentType?: string | null;
  className?: string;
}

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'Vor Ort',
  hybrid: 'Hybrid',
  remote: 'Full Remote',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  fulltime: 'Vollzeit',
  parttime: 'Teilzeit',
  contract: 'Freelance',
  internship: 'Praktikum',
};

export function CompanyInfoCard({
  companyName,
  industry,
  location,
  employeeCount,
  website,
  linkedinUrl,
  foundedYear,
  description,
  remoteType,
  employmentType,
  className
}: CompanyInfoCardProps) {
  const hasLinks = website || linkedinUrl;
  const hasDetails = industry || location || employeeCount || foundedYear || remoteType || employmentType;
  const detailCount = [industry, location, employeeCount, foundedYear, remoteType, employmentType, website, linkedinUrl, description].filter(Boolean).length;
  const isMinimalProfile = detailCount <= 2;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Über das Unternehmen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Company Name & Industry */}
        <div>
          <h3 className="font-semibold text-lg">{companyName}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {industry && (
              <Badge variant="secondary">
                <Factory className="h-3 w-3 mr-1" />
                {industry}
              </Badge>
            )}
            {remoteType && (
              <Badge variant="outline">
                <Monitor className="h-3 w-3 mr-1" />
                {REMOTE_LABELS[remoteType] || remoteType}
              </Badge>
            )}
            {employmentType && (
              <Badge variant="outline">
                <Briefcase className="h-3 w-3 mr-1" />
                {EMPLOYMENT_LABELS[employmentType] || employmentType}
              </Badge>
            )}
          </div>
        </div>

        {/* Details Grid */}
        {(location || employeeCount || foundedYear) && (
          <div className="grid grid-cols-2 gap-3">
            {location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            )}
            {employeeCount && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                <span>{employeeCount} Mitarbeiter</span>
              </div>
            )}
            {foundedYear && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Gegründet {foundedYear}</span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-3">
            {description}
          </p>
        )}

        {/* Links */}
        {hasLinks && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
            {website && (
              <Button variant="outline" size="sm" asChild>
                <a href={website} target="_blank" rel="noopener noreferrer">
                  <Globe className="h-3.5 w-3.5 mr-1.5" />
                  Website
                  <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
                </a>
              </Button>
            )}
            {linkedinUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="h-3.5 w-3.5 mr-1.5" />
                  LinkedIn
                  <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Minimal profile hint */}
        {isMinimalProfile && (
          <div className="p-3 rounded-lg border border-dashed border-border bg-muted/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tipp:</span> Recruiter sehen nur wenige Infos über Ihr Unternehmen. Ein vollständigeres Profil hilft bei der Kandidatenansprache.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
