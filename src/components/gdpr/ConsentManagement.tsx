import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsent, ConsentType } from "@/hooks/useConsent";
import { Shield, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface ConsentItemProps {
  type: ConsentType;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (type: ConsentType, checked: boolean) => void;
}

function ConsentItem({ type, label, description, checked, disabled, onChange }: ConsentItemProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label htmlFor={type} className="font-medium">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={type}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(checked) => onChange(type, checked)}
      />
    </div>
  );
}

export function ConsentManagement() {
  const { consents, updateConsent, acceptAll, rejectAll, loading } = useConsent();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Lade Einstellungen...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Einwilligungen verwalten
        </CardTitle>
        <CardDescription>
          Verwalten Sie Ihre Cookie- und Datenverarbeitungseinstellungen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 mb-4">
          <Button variant="outline" size="sm" onClick={acceptAll}>
            Alle akzeptieren
          </Button>
          <Button variant="outline" size="sm" onClick={rejectAll}>
            Alle ablehnen
          </Button>
        </div>

        <Separator />

        <div className="space-y-1">
          <ConsentItem
            type="functional"
            label="Notwendige Cookies"
            description="Diese Cookies sind für den Betrieb der Website erforderlich und können nicht deaktiviert werden."
            checked={true}
            disabled
            onChange={updateConsent}
          />
          <Separator />
          <ConsentItem
            type="analytics"
            label="Analyse-Cookies"
            description="Helfen uns zu verstehen, wie Besucher mit der Website interagieren, um das Nutzererlebnis zu verbessern."
            checked={consents.analytics}
            onChange={updateConsent}
          />
          <Separator />
          <ConsentItem
            type="marketing"
            label="Marketing-Cookies"
            description="Werden verwendet, um Ihnen relevante Werbung basierend auf Ihren Interessen zu zeigen."
            checked={consents.marketing}
            onChange={updateConsent}
          />
        </div>

        <Separator />

        <div className="space-y-1">
          <h4 className="font-medium">Rechtliche Dokumente</h4>
          <ConsentItem
            type="privacy_policy"
            label="Datenschutzerklärung"
            description="Ich habe die Datenschutzerklärung gelesen und akzeptiert."
            checked={consents.privacy_policy}
            onChange={updateConsent}
          />
          <ConsentItem
            type="terms_of_service"
            label="Nutzungsbedingungen"
            description="Ich habe die Nutzungsbedingungen gelesen und akzeptiert."
            checked={consents.terms_of_service}
            onChange={updateConsent}
          />
        </div>
      </CardContent>
    </Card>
  );
}
