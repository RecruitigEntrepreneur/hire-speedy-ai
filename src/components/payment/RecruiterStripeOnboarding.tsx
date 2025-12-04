import { useStripeConnect } from "@/hooks/useStripeConnect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, CreditCard, ExternalLink } from "lucide-react";

export function RecruiterStripeOnboarding() {
  const { 
    account, 
    loading, 
    creating, 
    isOnboarded, 
    canReceivePayouts,
    startOnboarding,
    refreshStatus 
  } = useStripeConnect();

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    if (isOnboarded && canReceivePayouts) {
      return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Aktiv</Badge>;
    }
    if (account && !isOnboarded) {
      return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Onboarding ausstehend</Badge>;
    }
    return <Badge variant="outline">Nicht verbunden</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Stripe Connect</CardTitle>
              <CardDescription>
                Verbinde dein Bankkonto für Auszahlungen
              </CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!account ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Um Auszahlungen zu erhalten, musst du dein Stripe-Konto einrichten. 
              Dies ermöglicht sichere und schnelle Überweisungen auf dein Bankkonto.
            </p>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Sichere Bankverbindung
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Automatische Auszahlungen
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Transparente Transaktionsübersicht
              </li>
            </ul>
            <Button onClick={startOnboarding} disabled={creating} className="w-full">
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird eingerichtet...
                </>
              ) : (
                <>
                  Stripe-Konto einrichten
                  <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        ) : !isOnboarded ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-600">Onboarding nicht abgeschlossen</p>
                <p className="text-sm text-muted-foreground">
                  Bitte vervollständige dein Stripe-Profil, um Auszahlungen zu erhalten.
                </p>
              </div>
            </div>
            <Button onClick={startOnboarding} className="w-full">
              Onboarding fortsetzen
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-600">Konto vollständig eingerichtet</p>
                <p className="text-sm text-muted-foreground">
                  Du kannst jetzt Auszahlungen empfangen.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Zahlungen aktiviert</p>
                <p className="font-medium">{account.charges_enabled ? "Ja" : "Nein"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Auszahlungen aktiviert</p>
                <p className="font-medium">{account.payouts_enabled ? "Ja" : "Nein"}</p>
              </div>
            </div>
            <Button variant="outline" onClick={refreshStatus} className="w-full">
              Status aktualisieren
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
