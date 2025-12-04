import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Banknote, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface PayoutRequestCardProps {
  placementId: string;
  amount: number;
  currency?: string;
  escrowStatus: string;
  escrowReleaseDate?: string;
  existingRequest?: {
    id: string;
    status: string;
    created_at: string;
  } | null;
  onRequestCreated?: () => void;
}

export function PayoutRequestCard({
  placementId,
  amount,
  currency = "EUR",
  escrowStatus,
  escrowReleaseDate,
  existingRequest,
  onRequestCreated,
}: PayoutRequestCardProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const canRequestPayout = () => {
    if (existingRequest) return false;
    if (escrowStatus !== "held" && escrowStatus !== "released") return false;
    
    if (escrowReleaseDate) {
      const releaseDate = new Date(escrowReleaseDate);
      return new Date() >= releaseDate;
    }
    
    return escrowStatus === "released";
  };

  const handleRequestPayout = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("payout_requests").insert({
        placement_id: placementId,
        recruiter_id: user.id,
        amount,
        currency,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Auszahlungsanfrage erstellt");
      onRequestCreated?.();
    } catch (error: any) {
      console.error("Error creating payout request:", error);
      toast.error("Fehler beim Erstellen der Anfrage");
    } finally {
      setLoading(false);
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Ausstehend
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Genehmigt
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Wird verarbeitet
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Abgeschlossen
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Fehlgeschlagen
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <XCircle className="h-3 w-3 mr-1" />
            Abgelehnt
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4" />
            Auszahlung
          </CardTitle>
          {existingRequest && getRequestStatusBadge(existingRequest.status)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Betrag</span>
          <span className="text-lg font-semibold">{formatCurrency(amount)}</span>
        </div>

        {existingRequest ? (
          <div className="text-sm text-muted-foreground">
            Anfrage erstellt am{" "}
            {format(new Date(existingRequest.created_at), "dd.MM.yyyy", { locale: de })}
          </div>
        ) : canRequestPayout() ? (
          <Button onClick={handleRequestPayout} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              "Auszahlung anfordern"
            )}
          </Button>
        ) : (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {escrowStatus === "pending"
                ? "Warte auf Zahlung des Clients"
                : escrowStatus === "held" && escrowReleaseDate
                ? `Escrow-Periode endet am ${format(new Date(escrowReleaseDate), "dd.MM.yyyy", { locale: de })}`
                : "Auszahlung nicht verfügbar"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
