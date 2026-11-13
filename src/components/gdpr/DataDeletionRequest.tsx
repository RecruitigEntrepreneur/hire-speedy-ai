import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

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
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          {t("deletion.title")}
        </CardTitle>
        <CardDescription>
          {t("deletion.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t("deletion.warning")}</AlertTitle>
          <AlertDescription>
            {t("deletion.warningText")}
          </AlertDescription>
        </Alert>

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
            <Alert>
              <AlertDescription>
                {t("deletion.codeSent")}
              </AlertDescription>
            </Alert>

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
              <Button variant="outline" onClick={handleCancelDeletion} disabled={loading}>
                {t("cancel")}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
