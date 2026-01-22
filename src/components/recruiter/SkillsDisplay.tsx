import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2 } from "lucide-react";

interface SkillsDisplayProps {
  skills: string[] | null;
  techEnvironment?: string[] | null;
}

export function SkillsDisplay({ skills, techEnvironment }: SkillsDisplayProps) {
  // Combine and deduplicate skills
  const allSkills = new Set<string>();
  
  skills?.forEach(skill => allSkills.add(skill));
  techEnvironment?.forEach(tech => allSkills.add(tech));
  
  const uniqueSkills = Array.from(allSkills);
  
  if (uniqueSkills.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Code2 className="h-5 w-5 text-primary" />
          Skills & Technologien
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {uniqueSkills.map((skill, index) => (
            <Badge 
              key={index} 
              variant="secondary"
              className="px-3 py-1"
            >
              {skill}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
