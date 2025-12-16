import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Target, 
  Flame, 
  CheckCircle2,
  Users,
  ArrowRight,
  Building2
} from 'lucide-react';
import { useWorkQueue } from '@/hooks/useCompanyOutreach';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export function WorkQueueWidget() {
  const { data: queue, isLoading } = useWorkQueue();
  const navigate = useNavigate();

  const getStatusIndicator = (company: any) => {
    if (company.lead_info.geantwortet > 0) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          🟢 Warm
        </Badge>
      );
    }
    if (company.hiring_activity === 'hot') {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <Flame className="h-3 w-3 mr-1" />
          Hot
        </Badge>
      );
    }
    if (company.hiring_activity === 'active') {
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Aktiv
        </Badge>
      );
    }
    return <Badge variant="outline">Neu</Badge>;
  };

  const getActionHint = (company: any) => {
    if (company.lead_info.geantwortet > 0) {
      return `${company.lead_info.geantwortet} Antwort(en) bearbeiten`;
    }
    if (company.lead_info.entscheider_unkontaktiert > 0) {
      return `${company.lead_info.entscheider_unkontaktiert} Entscheider anschreiben`;
    }
    if (company.lead_info.unkontaktiert > 0) {
      return `${company.lead_info.unkontaktiert} Kontakte anschreiben`;
    }
    return 'Kontakte hinzufügen';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Heute zu bearbeiten
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Heute zu bearbeiten ({queue?.length || 0})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!queue || queue.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-3" />
            <p className="text-sm text-muted-foreground">Alles erledigt! 🎉</p>
          </div>
        ) : (
          queue.slice(0, 5).map((company) => (
            <div 
              key={company.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
              onClick={() => navigate(`/admin/outreach/company/${company.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {getActionHint(company)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIndicator(company)}
                      {company.live_jobs_count && company.live_jobs_count > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {company.live_jobs_count} Stellen
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}

        {queue && queue.length > 5 && (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => navigate('/admin/outreach')}
          >
            Alle {queue.length} anzeigen
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
