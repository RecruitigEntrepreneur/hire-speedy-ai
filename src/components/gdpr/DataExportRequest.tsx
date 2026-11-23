import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-[15px] font-semibold tracking-tight">{t("export.title")}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("export.description")}</p>
      <p className="mt-2 text-sm text-muted-foreground">{t("export.info")}</p>

      {!exportData ? (
        <Button className="mt-4 gap-2" onClick={handleExport} disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? t("export.creating") : t("export.request")}
        </Button>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm font-medium">{t("export.ready")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleDownloadJson}>{t("export.downloadJson")}</Button>
            {downloadUrl && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-klick hover:underline">
                {t("export.cloud")} ›
              </a>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">{t("export.exported")}</h3>
            <div className="max-h-64 overflow-auto rounded-lg bg-muted p-4">
              <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(Object.keys(exportData), null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
