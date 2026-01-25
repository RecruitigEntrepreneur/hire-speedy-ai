import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  Code, 
  Star, 
  TrendingUp, 
  DollarSign, 
  Award,
  Users,
  MapPin,
  Calendar,
  RefreshCw,
  UserPlus,
  ExternalLink,
  Linkedin,
  Loader2,
  Database
} from 'lucide-react';
import { OutreachCompany } from '@/hooks/useOutreachCompanies';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface KeyExecutive {
  name: string;
  role: string;
  linkedin?: string;
}

interface CompanyIntelligenceCardProps {
  company: OutreachCompany;
  onCrawl: () => void;
  isCrawling?: boolean;
}

export function CompanyIntelligenceCard({ company, onCrawl, isCrawling }: CompanyIntelligenceCardProps) {
  const queryClient = useQueryClient();
  const [creatingContact, setCreatingContact] = useState<string | null>(null);
  const [creatingAll, setCreatingAll] = useState(false);

  // Parse JSON fields
  const technologies = (Array.isArray(company?.technologies) ? company.technologies : []) as unknown as string[];
  const keyExecutives = (Array.isArray(company?.key_executives) ? company.key_executives : []) as unknown as KeyExecutive[];
  const awards = (Array.isArray(company?.awards) ? company.awards : []) as unknown as string[];

  // Check if we have any intelligence data
  const hasData = company.industry || company.city || company.headcount || 
                  technologies.length > 0 || keyExecutives.length > 0 ||
                  company.kununu_score || company.glassdoor_score ||
                  company.revenue_range || company.employee_growth;

  const createContactFromExecutive = async (exec: KeyExecutive) => {
    setCreatingContact(exec.name);
    try {
      // Determine decision level
      const role = (exec.role || '').toLowerCase();
      let decisionLevel = 'gatekeeper';
      if (role.includes('ceo') || role.includes('geschäftsführer') || role.includes('cto') || 
          role.includes('cfo') || role.includes('chief') || role.includes('founder')) {
        decisionLevel = 'entscheider';
      } else if (role.includes('head') || role.includes('director') || role.includes('vp') || role.includes('lead')) {
        decisionLevel = 'influencer';
      }

      // Determine functional area
      let functionalArea = 'Other';
      if (role.includes('hr') || role.includes('people') || role.includes('talent')) functionalArea = 'HR';
      else if (role.includes('tech') || role.includes('cto') || role.includes('engineer')) functionalArea = 'Tech';
      else if (role.includes('marketing') || role.includes('cmo')) functionalArea = 'Marketing';
      else if (role.includes('sales') || role.includes('revenue')) functionalArea = 'Sales';
      else if (role.includes('finance') || role.includes('cfo')) functionalArea = 'Finance';
      else if (role.includes('ceo') || role.includes('founder') || role.includes('managing')) functionalArea = 'Leadership';

      const { error } = await supabase
        .from('outreach_leads')
        .insert({
          company_id: company.id,
          company_name: company.name,
          contact_name: exec.name,
          contact_email: `kontakt@${company.domain}`,
          contact_role: exec.role, // FIXED: was contact_title
          personal_linkedin_url: exec.linkedin || null,
          lead_source: 'linkedin_crawl',
          segment: 'enterprise',
          decision_level: decisionLevel,
          functional_area: functionalArea,
          status: 'neu',
          contact_outreach_status: 'nicht_kontaktiert',
        });

      if (error) throw error;
      
      toast.success(`Kontakt "${exec.name}" angelegt`);
      queryClient.invalidateQueries({ queryKey: ['outreach-company', company.id] });
      queryClient.invalidateQueries({ queryKey: ['company-leads', company.id] });
    } catch (err: any) {
      toast.error(`Fehler: ${err.message}`);
    } finally {
      setCreatingContact(null);
    }
  };

  const createAllContacts = async () => {
    setCreatingAll(true);
    let created = 0;
    
    for (const exec of keyExecutives) {
      try {
        await createContactFromExecutive(exec);
        created++;
      } catch {
        // Continue with next
      }
    }
    
    setCreatingAll(false);
    if (created > 0) {
      toast.success(`${created} Kontakte angelegt`);
    }
  };

  return (
    <Card className={hasData ? 'border-primary/30' : 'border-dashed border-muted-foreground/30'}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Unternehmens-Intelligence
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onCrawl}
            disabled={isCrawling}
          >
            {isCrawling ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            {isCrawling ? 'Lädt...' : 'Aktualisieren'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <div className="text-center py-6 space-y-3">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Keine Intelligence-Daten vorhanden</p>
              <p className="text-xs text-muted-foreground">
                Klicken Sie auf "Aktualisieren" um Daten zu crawlen:
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">Branche</Badge>
              <Badge variant="outline">Tech Stack</Badge>
              <Badge variant="outline">Kununu Score</Badge>
              <Badge variant="outline">Executives</Badge>
              <Badge variant="outline">Funding</Badge>
            </div>
          </div>
        ) : (
          <>
            {/* Basic Data Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Building2 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Branche</p>
                <p className="text-sm font-medium truncate">{company.industry || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <MapPin className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Standort</p>
                <p className="text-sm font-medium truncate">{company.city || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Mitarbeiter</p>
                <p className="text-sm font-medium">{company.headcount?.toLocaleString() || '-'}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Gegründet</p>
                <p className="text-sm font-medium">{company.founded_year || company.founding_year || '-'}</p>
              </div>
            </div>

            {/* Tech Stack */}
            {technologies.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Code className="h-3 w-3" />
                  Tech Stack
                </div>
                <div className="flex flex-wrap gap-1">
                  {technologies.slice(0, 8).map((tech, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{tech}</Badge>
                  ))}
                  {technologies.length > 8 && (
                    <Badge variant="outline" className="text-xs">+{technologies.length - 8}</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Employer Scores */}
            {(company.kununu_score || company.glassdoor_score) && (
              <div className="flex flex-wrap gap-4">
                {company.kununu_score && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm">Kununu:</span>
                    <span className="font-medium">{company.kununu_score}/5</span>
                  </div>
                )}
                {company.glassdoor_score && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Star className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Glassdoor:</span>
                    <span className="font-medium">{company.glassdoor_score}/5</span>
                  </div>
                )}
              </div>
            )}

            {/* Financial / Growth */}
            {(company.revenue_range || company.employee_growth || company.funding_stage) && (
              <div className="flex flex-wrap gap-3">
                {company.revenue_range && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-sm">{company.revenue_range}</span>
                  </div>
                )}
                {company.employee_growth && (
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm">{company.employee_growth}</span>
                  </div>
                )}
                {company.funding_stage && (
                  <Badge variant="outline">{company.funding_stage}</Badge>
                )}
              </div>
            )}

            {/* Awards */}
            {awards.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Award className="h-3 w-3" />
                  Auszeichnungen
                </div>
                <div className="flex flex-wrap gap-1">
                  {awards.slice(0, 3).map((award, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {award.length > 40 ? award.slice(0, 40) + '...' : award}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Key Executives */}
            {keyExecutives.length > 0 && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-primary" />
                    Key Executives ({keyExecutives.length})
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={createAllContacts}
                    disabled={creatingAll}
                  >
                    {creatingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-1" />
                    )}
                    Alle als Kontakte
                  </Button>
                </div>
                <div className="space-y-2">
                  {keyExecutives.map((exec, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-medium">
                          {exec.name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{exec.name}</p>
                          <p className="text-xs text-muted-foreground">{exec.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {exec.linkedin && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            asChild
                          >
                            <a href={exec.linkedin} target="_blank" rel="noopener noreferrer">
                              <Linkedin className="h-4 w-4 text-[#0077B5]" />
                            </a>
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => createContactFromExecutive(exec)}
                          disabled={creatingContact === exec.name}
                        >
                          {creatingContact === exec.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UserPlus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last updated */}
            {company.last_enriched_at && (
              <p className="text-xs text-muted-foreground text-right">
                Zuletzt aktualisiert: {new Date(company.last_enriched_at).toLocaleDateString('de-DE')}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}