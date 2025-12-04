import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  BookOpen,
  DollarSign,
  Building2,
  Sparkles,
  Send,
  Copy,
  Eye,
  CheckCircle,
} from "lucide-react";

interface SupportContent {
  id: string;
  title: string;
  content: string;
  content_type: string;
  industry: string | null;
  media_url: string | null;
  view_count: number | null;
}

interface CandidateSupportViewerProps {
  candidateEmail?: string;
  candidateName?: string;
  jobTitle?: string;
  industry?: string;
  onContentSent?: (contentId: string) => void;
}

const CONTENT_TYPES = [
  { key: "interview_guide", label: "Interview Guide", icon: BookOpen },
  { key: "salary_benchmark", label: "Gehalt", icon: DollarSign },
  { key: "company_culture", label: "Unternehmenskultur", icon: Building2 },
  { key: "confidence_builder", label: "Motivation", icon: Sparkles },
];

export function CandidateSupportViewer({
  candidateEmail,
  candidateName,
  jobTitle,
  industry,
  onContentSent,
}: CandidateSupportViewerProps) {
  const [content, setContent] = useState<SupportContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("interview_guide");
  const [sentContent, setSentContent] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchContent();
  }, [industry]);

  const fetchContent = async () => {
    try {
      let query = supabase
        .from("candidate_support_content")
        .select("*")
        .eq("is_active", true);

      if (industry) {
        query = query.or(`industry.eq.${industry},industry.is.null`);
      }

      const { data, error } = await query.order("title");

      if (error) throw error;
      setContent(data || []);
    } catch (error) {
      console.error("Error fetching support content:", error);
    } finally {
      setLoading(false);
    }
  };

  const getContentByType = (type: string) => {
    return content.filter((c) => c.content_type === type);
  };

  const handleCopy = async (item: SupportContent) => {
    try {
      await navigator.clipboard.writeText(item.content);
      toast.success("In Zwischenablage kopiert");
      
      // Track view
      await supabase
        .from("candidate_support_content")
        .update({ view_count: (item.view_count || 0) + 1 })
        .eq("id", item.id);
    } catch (error) {
      toast.error("Kopieren fehlgeschlagen");
    }
  };

  const handleSendToCandidate = async (item: SupportContent) => {
    if (!candidateEmail) {
      toast.error("Keine E-Mail-Adresse vorhanden");
      return;
    }

    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: {
          to: candidateEmail,
          template: "candidate_support",
          data: {
            candidateName: candidateName || "Kandidat",
            contentTitle: item.title,
            content: item.content,
            jobTitle: jobTitle || "",
          },
        },
      });

      if (error) throw error;

      setSentContent((prev) => new Set([...prev, item.id]));
      onContentSent?.(item.id);
      toast.success(`"${item.title}" an ${candidateName} gesendet`);

      // Track send
      await supabase.functions.invoke("track-candidate-engagement", {
        body: {
          event_type: "support_content_sent",
          content_id: item.id,
          candidate_email: candidateEmail,
        },
      });
    } catch (error) {
      console.error("Error sending content:", error);
      toast.error("Senden fehlgeschlagen");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Lade Materialien...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5" />
          Vorbereitungs-Material
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-4 mb-4">
            {CONTENT_TYPES.map((type) => {
              const Icon = type.icon;
              const count = getContentByType(type.key).length;
              return (
                <TabsTrigger
                  key={type.key}
                  value={type.key}
                  className="text-xs"
                >
                  <Icon className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden sm:inline">{type.label}</span>
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CONTENT_TYPES.map((type) => (
            <TabsContent key={type.key} value={type.key} className="space-y-3">
              {getContentByType(type.key).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Keine {type.label}-Materialien verfügbar
                </div>
              ) : (
                getContentByType(type.key).map((item) => (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium flex items-center gap-2">
                          {item.title}
                          {sentContent.has(item.id) && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </h4>
                        {item.industry && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            {item.industry}
                          </Badge>
                        )}
                      </div>
                      {item.view_count !== null && item.view_count > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Eye className="h-3 w-3" />
                          {item.view_count}
                        </div>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-3 max-h-40 overflow-y-auto">
                      {item.content}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(item)}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Kopieren
                      </Button>
                      {candidateEmail && (
                        <Button
                          size="sm"
                          onClick={() => handleSendToCandidate(item)}
                          disabled={sentContent.has(item.id)}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" />
                          {sentContent.has(item.id)
                            ? "Gesendet"
                            : "An Kandidat senden"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}