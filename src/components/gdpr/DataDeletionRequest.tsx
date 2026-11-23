import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function DataDeletionRequest() {
  const { t } = useTranslation("privacy");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleRequestDeletion = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error(t("notAuthenticated"));
        return;
      }

      const { data, error } = await supabase.functions.invoke("gdpr-deletion", {
        body: {
          action: "request",
          reason,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      setRequestSent(true);
      toast.success(t("deletion.requestSent"));
    } catch (error) {
      console.error("Deletion request error:", error);
      toast.error(t("deletion.requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!confirmToken) {
      toast.error(t("deletion.codeMissing"));
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error(t("notAuthenticated"));
        return;
      }

      const { data, error } = await supabase.functions.invoke("gdpr-deletion", {
        body: {
          action: "confirm",
          confirmation_token: confirmToken,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(t("deletion.deleted"));
      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Deletion confirm error:", error);
      toast.error(t("deletion.confirmFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error(t("notAuthenticated"));
        return;
      }

      await supabase.functions.invoke("gdpr-deletion", {
        body: { action: "cancel" },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      setRequestSent(false);
      setConfirmToken("");
      toast.success(t("deletion.cancelled"));
    } catch (error) {
      console.error("Cancellation error:", error);
      toast.error(t("deletion.cancelFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      {/* Ruhig statt ganz in Rot: rot ist nur der Knopf, der wirklich löscht. */}
      <h2 className="text-[15px] font-semibold tracking-tight">{t("deletion.title")}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t("deletion.description")}</p>
      <div className="mt-4 space-y-4">
        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">
          <span className="font-medium">{t("deletion.warning")}:</span> {t("deletion.warningText")}
        </p>

        {!requestSent ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="reason">{t("deletion.reason")}</Label>
              <Textarea
                id="reason"
                placeholder={t("deletion.reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("deletion.request")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deletion.sure")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deletion.sureText")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRequestDeletion}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t("deletion.requestShort")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <>
            <p className="rounded-lg bg-secondary/60 px-3 py-2 text-sm">{t("deletion.codeSent")}</p>

            <div className="space-y-2">
              <Label htmlFor="confirm-token">{t("deletion.code")}</Label>
              <Input
                id="confirm-token"
                placeholder={t("deletion.codePlaceholder")}
                value={confirmToken}
                onChange={(e) => setConfirmToken(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleConfirmDeletion}
                disabled={loading || !confirmToken}
              >
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {t("deletion.confirm")}
              </Button>
              <Button variant="secondary" className="rounded-full px-4" onClick={handleCancelDeletion} disabled={loading}>
                {t("cancel")}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
