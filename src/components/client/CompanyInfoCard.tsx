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
  Calendar
} from 'lucide-react';

interface CompanyInfoCardProps {
  companyName: string;
  industry?: string | null;
  location?: string | null;
  employeeCount?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  foundedYear?: number | null;
  description?: string | null;
  className?: string;
}

export function CompanyInfoCard({
  companyName,
  industry,
  location,
  employeeCount,
  website,
  linkedinUrl,
  foundedYear,
  description,
  className
}: CompanyInfoCardProps) {
  const hasLinks = website || linkedinUrl;
  const hasDetails = industry || location || employeeCount || foundedYear;

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
          {industry && (
            <Badge variant="secondary" className="mt-1">
              <Factory className="h-3 w-3 mr-1" />
              {industry}
            </Badge>
          )}
        </div>

        {/* Details Grid */}
        {hasDetails && (
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

        {/* Fallback when minimal info */}
        {!hasDetails && !description && !hasLinks && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Keine weiteren Informationen verfügbar
          </p>
        )}
      </CardContent>
    </Card>
  );
}
