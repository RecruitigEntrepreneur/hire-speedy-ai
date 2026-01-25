import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ExternalLink, 
  MapPin, 
  Building2, 
  FileText,
  CheckCircle,
  Sparkles,
  Code,
  Gift,
  Clock,
  Briefcase,
  Home,
  DollarSign
} from 'lucide-react';
import { LiveJob, OutreachCompany } from '@/hooks/useOutreachCompanies';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface JobDetailDialogProps {
  job: LiveJob | null;
  company: OutreachCompany;
  onClose: () => void;
}

export function JobDetailDialog({ job, company, onClose }: JobDetailDialogProps) {
  if (!job) return null;

  const hasRequirements = job.requirements && job.requirements.length > 0;
  const hasNiceToHaves = job.nice_to_haves && job.nice_to_haves.length > 0;
  const hasTechStack = job.tech_stack && job.tech_stack.length > 0;
  const hasBenefits = job.benefits && job.benefits.length > 0;
  const hasDescription = job.description && job.description.trim().length > 0;

  return (
    <Dialog open={!!job} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">{job.title || 'Unbenannte Stelle'}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Building2 className="h-3 w-3" />
                {company.name}
                {job.location && (
                  <>
                    <span>•</span>
                    <MapPin className="h-3 w-3" />
                    {job.location}
                  </>
                )}
                {job.department && (
                  <>
                    <span>•</span>
                    {job.department}
                  </>
                )}
              </DialogDescription>
            </div>
          </div>
          
          {/* Quick Info Badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {job.remote_policy && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Home className="h-3 w-3" />
                {job.remote_policy}
              </Badge>
            )}
            {job.experience_level && (
              <Badge variant="secondary">
                {job.experience_level}
              </Badge>
            )}
            {job.salary_range && (
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                <DollarSign className="h-3 w-3 mr-1" />
                {job.salary_range}
              </Badge>
            )}
            {job.type && (
              <Badge variant="outline">{job.type}</Badge>
            )}
            {job.posted_at && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(job.posted_at), { addSuffix: true, locale: de })}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="p-6 space-y-4">
            {/* Description */}
            {hasDescription && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" /> 
                    Stellenbeschreibung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                    {job.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Requirements Grid */}
            {(hasRequirements || hasNiceToHaves) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hasRequirements && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" /> 
                        Anforderungen
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1.5">
                        {job.requirements!.map((req, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">•</span> 
                            <span className="text-muted-foreground">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {hasNiceToHaves && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-yellow-500" /> 
                        Nice-to-have
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="text-sm space-y-1.5">
                        {job.nice_to_haves!.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-yellow-500 mt-0.5">•</span> 
                            <span className="text-muted-foreground">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Tech Stack */}
            {hasTechStack && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Code className="h-4 w-4 text-blue-500" /> 
                    Tech Stack
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {job.tech_stack!.map((tech, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Benefits */}
            {hasBenefits && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Gift className="h-4 w-4 text-purple-500" /> 
                    Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {job.benefits!.map((benefit, i) => (
                      <div key={i} className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-purple-500">✓</span> {benefit}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* No detailed content available */}
            {!hasDescription && !hasRequirements && !hasNiceToHaves && !hasTechStack && !hasBenefits && (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">Keine detaillierten Informationen verfügbar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Klicken Sie auf "Zur Stelle" um die vollständige Ausschreibung zu sehen.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            📍 Karriereseite 
            {job.scraped_at && (
              <> · Gecrawlt {formatDistanceToNow(new Date(job.scraped_at), { addSuffix: true, locale: de })}</>
            )}
          </p>
          <div className="flex gap-2">
            {job.url && (
              <Button variant="outline" size="sm" asChild>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" /> 
                  Zur Stelle
                </a>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
