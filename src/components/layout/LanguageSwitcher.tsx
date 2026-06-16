import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<AppLanguage, string> = { de: "DE", en: "EN" };

export function LanguageSwitcher({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "de").slice(0, 2) as AppLanguage;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border/60 bg-card/60 p-0.5 text-xs font-medium",
        className,
      )}
      role="group"
      aria-label="Sprache wählen / Select language"
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = current === lng;
        return (
          <button
            key={lng}
            type="button"
            onClick={() => i18n.changeLanguage(lng)}
            aria-pressed={active}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABELS[lng]}
          </button>
        );
      })}
    </div>
  );
}
