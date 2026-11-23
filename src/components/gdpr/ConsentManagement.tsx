import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useConsent, ConsentType } from "@/hooks/useConsent";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
        <Label htmlFor={type} className="text-sm font-medium">
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
  const { t } = useTranslation("privacy");

  if (loading) {
    return (
      <div className="rounded-xl border bg-card py-8 text-center">
        <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">{t("consent.loading")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">{t("consent.cookies")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("consent.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="rounded-full px-4" onClick={acceptAll}>{t("consent.acceptAll")}</Button>
            <Button variant="secondary" size="sm" className="rounded-full px-4" onClick={rejectAll}>{t("consent.rejectAll")}</Button>
          </div>
        </div>
        <div className="mt-3 divide-y">
          {/* Notwendig ist immer an: ein gesperrter Schalter sah aus wie eine Wahl. */}
          <div className="flex items-center justify-between gap-4 py-3">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{t("consent.functional")}</p>
              <p className="text-sm text-muted-foreground">{t("consent.functionalText")}</p>
            </div>
            <span className="shrink-0 text-sm text-muted-foreground">{t("consent.alwaysOn")}</span>
          </div>
          <ConsentItem type="analytics" label={t("consent.analytics")} description={t("consent.analyticsText")} checked={consents.analytics} onChange={updateConsent} />
          <ConsentItem type="marketing" label={t("consent.marketing")} description={t("consent.marketingText")} checked={consents.marketing} onChange={updateConsent} />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">{t("consent.legal")}</h2>
        <div className="mt-1 divide-y">
          <ConsentItem type="privacy_policy" label={t("consent.privacyPolicy")} description={t("consent.privacyPolicyText")} checked={consents.privacy_policy} onChange={updateConsent} />
          <ConsentItem type="terms_of_service" label={t("consent.terms")} description={t("consent.termsText")} checked={consents.terms_of_service} onChange={updateConsent} />
        </div>
      </section>
    </div>
  );
}
