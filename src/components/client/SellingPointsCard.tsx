import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, DollarSign, Monitor, Code2, Gift, Factory, FileText } from 'lucide-react';

interface SellingPointsCardProps {
  job: {
    salary_min: number | null;
    salary_max: number | null;
    skills: string[] | null;
    remote_type: string | null;
    industry: string | null;
    description: string | null;
  };
  hasBenefits: boolean;
  onGenerateExpose: () => void;
  className?: string;
}

interface USP {
  icon: React.ReactNode;
  label: string;
}

export function SellingPointsCard({ job, hasBenefits, onGenerateExpose, className }: SellingPointsCardProps) {
  const usps: USP[] = [];

  if ((job.salary_min && job.salary_min >= 50000) || (job.salary_max && job.salary_max >= 50000)) {
    usps.push({ icon: <DollarSign className="h-3.5 w-3.5" />, label: 'Wettbewerbsfähige Vergütung' });
  }
  if (job.remote_type === 'remote' || job.remote_type === 'hybrid') {
    usps.push({ icon: <Monitor className="h-3.5 w-3.5" />, label: 'Flexibles Arbeitsmodell' });
  }
  if (job.skills && job.skills.length > 0) {
    usps.push({ icon: <Code2 className="h-3.5 w-3.5" />, label: 'Klares technisches Profil' });
  }
  if (hasBenefits) {
    usps.push({ icon: <Gift className="h-3.5 w-3.5" />, label: 'Attraktives Benefits-Paket' });
  }
  if (job.industry) {
    usps.push({ icon: <Factory className="h-3.5 w-3.5" />, label: `Etablierte Branche: ${job.industry}` });
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          Selling Points
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {usps.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {usps.map((usp, i) => (
              <Badge key={i} variant="secondary" className="gap-1.5 font-normal py-1 px-2.5">
                {usp.icon}
                {usp.label}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Noch keine USPs erkannt. Ergänzen Sie Gehalt, Remote-Optionen und Skills für bessere Verkaufsargumente.
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={onGenerateExpose}>
          <FileText className="h-4 w-4 mr-2" />
          Anonymes Exposé generieren
        </Button>
      </CardContent>
    </Card>
  );
}
