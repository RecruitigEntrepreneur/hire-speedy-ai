import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, MapPin, Users, Briefcase, ExternalLink, Loader2 } from "lucide-react";
import { useCreateCompanyFromDomain } from "@/hooks/useCompanyEnrichment";

interface QuickAddCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (companyId: string) => void;
}

export function QuickAddCompanyDialog({ open, onOpenChange, onSuccess }: QuickAddCompanyDialogProps) {
  const [domain, setDomain] = useState("");
  const [result, setResult] = useState<any>(null);
  const createCompany = useCreateCompanyFromDomain();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;

    try {
      const res = await createCompany.mutateAsync(domain);
      setResult(res);
    } catch {
      // Error handled by mutation
    }
  };

  const handleClose = () => {
    setDomain("");
    setResult(null);
    onOpenChange(false);
  };

  const handleOpenDetails = () => {
    if (result?.id) {
      onSuccess?.(result.id);
    }
    handleClose();
  };

  const handleAddAnother = () => {
    setDomain("");
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Unternehmen schnell hinzufügen
              </DialogTitle>
              <DialogDescription>
                Geben Sie nur die Domain ein - die AI findet alle weiteren Informationen automatisch.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input
                  id="domain"
                  placeholder="beispiel.de oder www.beispiel.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={createCompany.isPending}
                />
              </div>

              <Card className="p-3 bg-muted/50 border-dashed">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
                  <div>
                    <p className="font-medium text-foreground">Die AI findet automatisch:</p>
                    <p>Firmenname, Branche, Standort, Größe, Tech-Stack, offene Stellen & News</p>
                  </div>
                </div>
              </Card>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={createCompany.isPending || !domain.trim()}>
                  {createCompany.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      AI analysiert...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Mit AI anlegen
                    </>
                  )}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <Building2 className="h-5 w-5" />
                {result.name} wurde angelegt
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <Card className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{result.name}</span>
                </div>
                
                {result.data?.industry && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Briefcase className="h-4 w-4" />
                    <span>{result.data.industry}</span>
                  </div>
                )}
                
                {result.data?.city && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{result.data.city}</span>
                  </div>
                )}
                
                {result.data?.headcount && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>~{result.data.headcount} Mitarbeiter</span>
                  </div>
                )}

                {result.data?.technologies && result.data.technologies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {result.data.technologies.slice(0, 5).map((tech: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                )}

                {result.data?.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.data.description}
                  </p>
                )}
              </Card>

              <p className="text-sm text-muted-foreground text-center">
                Jobs & News werden im Hintergrund geladen...
              </p>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleAddAnother}>
                  Weitere hinzufügen
                </Button>
                <Button onClick={handleOpenDetails}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Details öffnen
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
