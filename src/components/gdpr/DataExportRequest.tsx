import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FileJson, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DataExportRequest() {
  const { t } = useTranslation("privacy");
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error(t("notAuthenticated"));
        return;
      }

      const { data, error } = await supabase.functions.invoke("gdpr-export", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setExportData(data.data);
      setDownloadUrl(data.download_url);
      toast.success(t("export.success"));
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t("export.failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadJson = () => {
    if (!exportData) return;
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meine-daten-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          {t("export.title")}
        </CardTitle>
        <CardDescription>
          {t("export.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            {t("export.info")}
          </AlertDescription>
        </Alert>

        {!exportData ? (
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("export.creating")}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t("export.request")}
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <AlertDescription className="text-green-700 dark:text-green-300">
                {t("export.ready")}
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadJson}>
                <Download className="h-4 w-4 mr-2" />
                {t("export.downloadJson")}
              </Button>
              {downloadUrl && (
                <Button variant="outline" asChild>
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    {t("export.cloud")}
                  </a>
                </Button>
              )}
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2">{t("export.exported")}</h4>
              <div className="bg-muted rounded-lg p-4 max-h-64 overflow-auto">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(Object.keys(exportData), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
