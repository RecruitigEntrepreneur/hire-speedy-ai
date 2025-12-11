import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ExternalLink, 
  Github, 
  Globe, 
  Linkedin, 
  Award,
  Upload,
  File
} from 'lucide-react';
import { Candidate } from './CandidateCard';

interface CandidateDocumentsProps {
  candidate: Candidate;
}

export function CandidateDocuments({ candidate }: CandidateDocumentsProps) {
  const hasLinks = candidate.cv_url || candidate.linkedin_url || candidate.portfolio_url || candidate.github_url || candidate.website_url;
  const rawCerts = Array.isArray(candidate.certificates) ? candidate.certificates : [];
  const certificates = rawCerts as { name: string; url?: string }[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Dokumente & Links
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Documents */}
        <div className="space-y-2">
          {candidate.cv_url && (
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => window.open(candidate.cv_url!, '_blank')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Lebenslauf (CV)
              <ExternalLink className="h-3 w-3 ml-auto" />
            </Button>
          )}
        </div>

        {/* Links */}
        {hasLinks && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Profile & Websites</p>
            <div className="flex flex-wrap gap-2">
              {candidate.linkedin_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                >
                  <Linkedin className="h-4 w-4 mr-2" />
                  LinkedIn
                </Button>
              )}
              {candidate.github_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(candidate.github_url!, '_blank')}
                >
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </Button>
              )}
              {candidate.portfolio_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(candidate.portfolio_url!, '_blank')}
                >
                  <File className="h-4 w-4 mr-2" />
                  Portfolio
                </Button>
              )}
              {candidate.website_url && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open(candidate.website_url!, '_blank')}
                >
                  <Globe className="h-4 w-4 mr-2" />
                  Website
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Certificates */}
        {certificates.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Zertifikate</p>
            <div className="flex flex-wrap gap-2">
              {certificates.map((cert, i) => (
                <Badge 
                  key={i} 
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => cert.url && window.open(cert.url, '_blank')}
                >
                  <Award className="h-3 w-3 mr-1" />
                  {cert.name}
                  {cert.url && <ExternalLink className="h-3 w-3 ml-1" />}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {!hasLinks && certificates.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto opacity-50 mb-2" />
            <p className="text-sm">Keine Dokumente vorhanden</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
