import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Building2, Calendar, TrendingUp, Sparkles } from 'lucide-react';

interface PartnerFacts {
  headcount: number | null;
  annual_revenue: string | null;
  founded_year: number | null;
  unique_selling_point: string | null;
  company_awards?: string[] | null;
  industry: string | null;
}

interface PartnerFactsCardProps {
  facts: PartnerFacts;
}

export function PartnerFactsCard({ facts }: PartnerFactsCardProps) {
  const currentYear = new Date().getFullYear();
  const yearsInMarket = facts.founded_year 
    ? currentYear - facts.founded_year 
    : null;

  // Build fact items with icons
  const factItems: { icon: React.ElementType; text: string }[] = [];

  if (facts.headcount) {
    factItems.push({
      icon: Building2,
      text: `ca. ${facts.headcount.toLocaleString('de-DE')} Mitarbeiter`
    });
  }

  if (facts.annual_revenue) {
    factItems.push({
      icon: TrendingUp,
      text: `${facts.annual_revenue} Umsatz`
    });
  }

  if (yearsInMarket && yearsInMarket > 0) {
    factItems.push({
      icon: Calendar,
      text: `Über ${yearsInMarket} Jahre am Markt`
    });
  }

  if (facts.unique_selling_point) {
    factItems.push({
      icon: Sparkles,
      text: facts.unique_selling_point
    });
  }

  if (facts.company_awards && facts.company_awards.length > 0) {
    facts.company_awards.forEach(award => {
      factItems.push({
        icon: Award,
        text: award
      });
    });
  }

  // Don't render if no facts available
  if (factItems.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Das zeichnet unseren Partner aus
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2.5">
          {factItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={index} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-foreground">{item.text}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
