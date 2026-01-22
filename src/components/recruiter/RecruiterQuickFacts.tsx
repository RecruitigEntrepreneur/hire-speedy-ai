import { Card, CardContent } from "@/components/ui/card";
import { Users, Rocket, Calendar, Heart, Building2, Globe } from "lucide-react";
import { LucideIcon } from "lucide-react";

interface QuickFactProps {
  icon: LucideIcon;
  label: string;
  value: string | null;
}

function QuickFact({ icon: Icon, label, value }: QuickFactProps) {
  if (!value) return null;
  
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

interface QuickFactsData {
  team_size?: string | null;
  growth_stage?: string | null;
  culture_keywords?: string[] | null;
  interview_process?: string | null;
}

interface RecruiterQuickFactsProps {
  quickFacts?: QuickFactsData | null;
  companySize?: string | null;
  fundingStage?: string | null;
  techEnvironment?: string[] | null;
}

export function RecruiterQuickFacts({ 
  quickFacts, 
  companySize, 
  fundingStage,
  techEnvironment 
}: RecruiterQuickFactsProps) {
  const teamSize = quickFacts?.team_size || formatCompanySize(companySize);
  const growthStage = quickFacts?.growth_stage || fundingStage || null;
  const culture = quickFacts?.culture_keywords?.join(", ") || null;
  const interview = quickFacts?.interview_process || null;
  const techStack = techEnvironment?.slice(0, 3).join(", ") || null;

  // Don't render if no data
  if (!teamSize && !growthStage && !culture && !interview && !techStack) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-muted/30">
      <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-4 py-4">
        <QuickFact icon={Users} label="Teamgröße" value={teamSize} />
        <QuickFact icon={Rocket} label="Phase" value={growthStage} />
        <QuickFact icon={Building2} label="Tech-Stack" value={techStack} />
        <QuickFact icon={Calendar} label="Interview-Prozess" value={interview} />
        <QuickFact icon={Heart} label="Kultur" value={culture} />
        <QuickFact icon={Globe} label="Arbeitsmodell" value={null} />
      </CardContent>
    </Card>
  );
}

function formatCompanySize(size: string | null): string | null {
  if (!size) return null;
  
  const sizeMap: Record<string, string> = {
    "1-10": "Startup (1-10)",
    "11-50": "Kleines Team (11-50)",
    "51-200": "Wachsend (51-200)",
    "201-500": "Mittelstand (201-500)",
    "501-1000": "Großunternehmen (501-1000)",
    "1001-5000": "Enterprise (1000+)",
    "5001+": "Konzern (5000+)"
  };
  
  return sizeMap[size] || size;
}
