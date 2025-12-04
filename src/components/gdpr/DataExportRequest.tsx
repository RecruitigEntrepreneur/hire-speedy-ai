import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, FileJson, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function DataExportRequest() {
  const [loading, setLoading] = useState(false);
  const [exportData, setExportData] = useState<Record<string, unknown> | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Nicht authentifiziert");
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
      toast.success("Datenexport erfolgreich erstellt");
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Fehler beim Erstellen des Datenexports");
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
          Datenexport
        </CardTitle>
        <CardDescription>
          Laden Sie eine Kopie aller Ihrer persönlichen Daten herunter (DSGVO Art. 20)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Der Export enthält alle Ihre persönlichen Daten, Aktivitäten und Einstellungen 
            in einem maschinenlesbaren JSON-Format.
          </AlertDescription>
        </Alert>

        {!exportData ? (
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Export wird erstellt...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Datenexport anfordern
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <AlertDescription className="text-green-700 dark:text-green-300">
                Ihr Datenexport wurde erfolgreich erstellt.
              </AlertDescription>
            </Alert>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadJson}>
                <Download className="h-4 w-4 mr-2" />
                Als JSON herunterladen
              </Button>
              {downloadUrl && (
                <Button variant="outline" asChild>
                  <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 mr-2" />
                    Cloud-Download (7 Tage gültig)
                  </a>
                </Button>
              )}
            </div>

            <div className="mt-4">
              <h4 className="font-medium mb-2">Exportierte Daten:</h4>
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
