import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsent, ConsentType } from "@/hooks/useConsent";
import { Cookie, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CookieConsentBanner() {
  const { hasConsented, consents, updateConsent, acceptAll, rejectAll } = useConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [isVisible, setIsVisible] = useState(!hasConsented);

  if (!isVisible || hasConsented) return null;

  const handleAcceptAll = () => {
    acceptAll();
    setIsVisible(false);
  };

  const handleRejectAll = () => {
    rejectAll();
    setIsVisible(false);
  };

  const handleSaveSettings = () => {
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-sm border-t">
      <Card className="max-w-4xl mx-auto p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Cookie className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-lg">Cookie-Einstellungen</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsVisible(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {!showSettings ? (
              <>
                <p className="text-muted-foreground text-sm mb-4">
                  Wir verwenden Cookies, um Ihre Erfahrung zu verbessern. Einige sind notwendig für 
                  den Betrieb der Website, während andere uns helfen, die Website zu optimieren und 
                  Ihnen personalisierte Inhalte zu zeigen.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleAcceptAll}>Alle akzeptieren</Button>
                  <Button variant="outline" onClick={handleRejectAll}>
                    Nur notwendige
                  </Button>
                  <Button variant="ghost" onClick={() => setShowSettings(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Einstellungen
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 mb-4">
                  <ConsentOption
                    id="functional"
                    label="Notwendige Cookies"
                    description="Diese Cookies sind für den Betrieb der Website erforderlich."
                    checked={true}
                    disabled
                  />
                  <ConsentOption
                    id="analytics"
                    label="Analyse-Cookies"
                    description="Helfen uns zu verstehen, wie Besucher mit der Website interagieren."
                    checked={consents.analytics}
                    onChange={(checked) => updateConsent("analytics", checked)}
                  />
                  <ConsentOption
                    id="marketing"
                    label="Marketing-Cookies"
                    description="Werden verwendet, um Besuchern relevante Werbung zu zeigen."
                    checked={consents.marketing}
                    onChange={(checked) => updateConsent("marketing", checked)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveSettings}>Einstellungen speichern</Button>
                  <Button variant="outline" onClick={() => setShowSettings(false)}>
                    Zurück
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

interface ConsentOptionProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

function ConsentOption({ id, label, description, checked, disabled, onChange }: ConsentOptionProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
      <div className="space-y-0.5">
        <Label htmlFor={id} className={cn("font-medium", disabled && "text-muted-foreground")}>
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
}
