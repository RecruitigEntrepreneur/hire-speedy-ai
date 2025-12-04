import { useState } from "react";
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
        toast.error("Nicht authentifiziert");
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
      toast.success("Löschanfrage gesendet. Bitte prüfen Sie Ihre E-Mails.");
    } catch (error) {
      console.error("Deletion request error:", error);
      toast.error("Fehler beim Senden der Löschanfrage");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeletion = async () => {
    if (!confirmToken) {
      toast.error("Bitte geben Sie den Bestätigungscode ein");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Nicht authentifiziert");
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

      toast.success("Ihr Konto wurde gelöscht");
      // Sign out and redirect
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Deletion confirm error:", error);
      toast.error("Fehler bei der Bestätigung. Ungültiger Code?");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDeletion = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error("Nicht authentifiziert");
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
      toast.success("Löschanfrage abgebrochen");
    } catch (error) {
      console.error("Cancellation error:", error);
      toast.error("Fehler beim Abbrechen");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Konto löschen
        </CardTitle>
        <CardDescription>
          Löschen Sie Ihr Konto und alle damit verbundenen Daten (DSGVO Art. 17)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warnung</AlertTitle>
          <AlertDescription>
            Die Kontolöschung ist unwiderruflich. Alle Ihre Daten werden anonymisiert 
            und können nicht wiederhergestellt werden.
          </AlertDescription>
        </Alert>

        {!requestSent ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="reason">Grund für die Löschung (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Teilen Sie uns mit, warum Sie Ihr Konto löschen möchten..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Kontolöschung anfordern
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sind Sie sicher?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sie erhalten eine E-Mail mit einem Bestätigungslink. Erst nach der 
                    Bestätigung wird Ihr Konto gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRequestDeletion}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Löschung anfordern
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        ) : (
          <>
            <Alert>
              <AlertDescription>
                Wir haben Ihnen eine E-Mail mit einem Bestätigungscode gesendet. 
                Geben Sie diesen Code unten ein, um die Löschung zu bestätigen.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="confirm-token">Bestätigungscode</Label>
              <Input
                id="confirm-token"
                placeholder="Code aus der E-Mail eingeben..."
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
                Löschung bestätigen
              </Button>
              <Button variant="outline" onClick={handleCancelDeletion} disabled={loading}>
                Abbrechen
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
