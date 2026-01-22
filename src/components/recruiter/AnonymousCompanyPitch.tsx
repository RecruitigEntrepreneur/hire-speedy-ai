import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Building2 } from "lucide-react";

interface AnonymousCompanyPitchProps {
  pitch: string | null;
  industry?: string | null;
  companySize?: string | null;
  fundingStage?: string | null;
  isRevealed?: boolean;
  companyName?: string | null;
}

export function AnonymousCompanyPitch({ 
  pitch, 
  industry,
  companySize,
  fundingStage,
  isRevealed = false,
  companyName
}: AnonymousCompanyPitchProps) {
  // If revealed, show actual company name
  if (isRevealed && companyName) {
    return (
      <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-5 w-5 text-green-600" />
            Unternehmen enthüllt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold text-green-700 dark:text-green-400">
            {companyName}
          </p>
          {pitch && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {pitch}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Generate fallback pitch if none provided
  const displayPitch = pitch || generateFallbackPitch(industry, companySize, fundingStage);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-5 w-5 text-primary" />
          Über das Unternehmen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {displayPitch}
        </p>
        <p className="mt-3 text-xs text-muted-foreground/70 italic">
          Der Unternehmensname wird nach erfolgreicher Kandidaten-Einreichung enthüllt.
        </p>
      </CardContent>
    </Card>
  );
}

function generateFallbackPitch(
  industry: string | null | undefined, 
  companySize: string | null | undefined, 
  fundingStage: string | null | undefined
): string {
  const parts: string[] = [];
  
  // Industry-based intro
  const industryDescriptions: Record<string, string> = {
    "Technology": "Innovatives Technologieunternehmen",
    "FinTech": "Dynamisches FinTech-Unternehmen",
    "HealthTech": "Zukunftsorientiertes HealthTech-Unternehmen",
    "E-Commerce": "Wachsendes E-Commerce-Unternehmen",
    "SaaS": "Erfolgreiches SaaS-Unternehmen",
    "Consulting": "Renommiertes Beratungsunternehmen",
    "Manufacturing": "Etabliertes Industrieunternehmen",
    "Automotive": "Innovatives Unternehmen im Automobilsektor",
  };
  
  const intro = industry 
    ? (industryDescriptions[industry] || `Unternehmen im Bereich ${industry}`)
    : "Etabliertes Unternehmen";
  
  parts.push(intro);
  
  // Size context
  if (companySize) {
    const sizeContext: Record<string, string> = {
      "1-10": "in der Startup-Phase",
      "11-50": "mit schlanken Strukturen",
      "51-200": "in einer spannenden Wachstumsphase",
      "201-500": "mit stabiler Marktposition",
      "501-1000": "mit internationaler Präsenz",
      "1001-5000": "als etablierter Marktführer",
      "5001+": "als globaler Player"
    };
    
    if (sizeContext[companySize]) {
      parts.push(sizeContext[companySize]);
    }
  }
  
  // Funding context
  if (fundingStage) {
    const fundingContext: Record<string, string> = {
      "Bootstrapped": "mit profitablem Geschäftsmodell",
      "Seed": "mit frischer Seed-Finanzierung",
      "Series A": "nach erfolgreicher Series A",
      "Series B": "in der Skalierungsphase nach Series B",
      "Series C+": "als gut finanziertes Scale-up",
      "Public": "als börsennotiertes Unternehmen"
    };
    
    if (fundingContext[fundingStage]) {
      parts.push(fundingContext[fundingStage]);
    }
  }
  
  // Add generic closing
  parts.push("sucht Verstärkung für das Team.");
  
  return parts.join(" ");
}
