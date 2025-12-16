import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Newspaper, Users, RefreshCw, ExternalLink, Lightbulb, TrendingUp } from "lucide-react";
import { useCrawlCompanyData } from "@/hooks/useOutreachCompanies";
import { useGenerateCompanyInsights } from "@/hooks/useCompanyEnrichment";
import { toast } from "sonner";

interface IntelligenceTabProps {
  company: any;
}

export function IntelligenceTab({ company }: IntelligenceTabProps) {
  const crawlMutation = useCrawlCompanyData();
  const insightsMutation = useGenerateCompanyInsights();
  
  const news = (company.recent_news as any[]) || [];
  const executives = (company.key_executives as any[]) || [];
  const insights = (company.ai_insights as any[]) || [];

  const handleCrawl = async () => {
    try {
      await crawlMutation.mutateAsync(company.id);
      toast.success("Daten werden aktualisiert...");
    } catch (error) {
      toast.error("Fehler beim Crawlen");
    }
  };

  const handleGenerateInsights = async () => {
    try {
      await insightsMutation.mutateAsync(company.id);
      toast.success("Insights generiert");
    } catch (error) {
      toast.error("Fehler beim Generieren");
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCrawl}
          disabled={crawlMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${crawlMutation.isPending ? 'animate-spin' : ''}`} />
          Daten aktualisieren
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleGenerateInsights}
          disabled={insightsMutation.isPending}
        >
          <Brain className={`h-4 w-4 mr-2 ${insightsMutation.isPending ? 'animate-spin' : ''}`} />
          Insights generieren
        </Button>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            AI Insights
            {company.intelligence_score && (
              <Badge variant="secondary" className="ml-auto">Score: {company.intelligence_score}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <div key={i} className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium text-sm">{insight.title}</div>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      {insight.outreach_angle && (
                        <div className="mt-2 text-xs text-primary">
                          <TrendingUp className="h-3 w-3 inline mr-1" />
                          {insight.outreach_angle}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Keine Insights vorhanden</p>
              <p className="text-sm mt-1">Klicke auf "Insights generieren"</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Executives */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Key Executives
          </CardTitle>
        </CardHeader>
        <CardContent>
          {executives.length > 0 ? (
            <div className="space-y-2">
              {executives.map((exec, i) => (
                <div key={i} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded">
                  <div>
                    <div className="font-medium text-sm">{exec.name}</div>
                    <div className="text-xs text-muted-foreground">{exec.title}</div>
                  </div>
                  {exec.linkedin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                      <a href={exec.linkedin} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Keine Executives hinterlegt
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent News */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            Neueste Nachrichten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {news.length > 0 ? (
            <div className="space-y-3">
              {news.map((item, i) => (
                <a 
                  key={i} 
                  href={item.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm line-clamp-2">{item.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.source && <span>{item.source}</span>}
                        {item.date && <span> • {new Date(item.date).toLocaleDateString('de-DE')}</span>}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Keine News gefunden</p>
              <p className="text-sm mt-1">Daten aktualisieren für aktuelle News</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
