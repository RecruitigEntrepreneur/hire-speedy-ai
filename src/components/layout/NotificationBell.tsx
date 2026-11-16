import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";
import { cn } from "@/lib/utils";
import { Honorar } from '@/components/recruiter/Honorar';
import { HinweisIcon } from '@/components/notifications/HinweisIcon';
import { hinweisPfad, hinweisZiel } from '@/lib/hinweisZiel';
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useTranslation } from "react-i18next";
import { fmtDate } from "@/lib/localeFormat";

/** Relative Zeit wie „vor 3 Std.“, ab einer Woche das Datum (Texte: notifications). */
function hinweisZeit(dateString: string, t: (k: string, o?: Record<string, unknown>) => string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return t("justNow");
  if (diffMins < 60) return t("minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("daysAgo", { count: diffDays });
  return fmtDate(date);
}

/**
 * Glocke (Etappe 1, 15.11.2026): Ein Klick führt auf die Seite, auf der man weitermacht, und das
 * passende Fenster liegt offen darüber (Ziele in lib/hinweisZiel). Der Hinweis und alle zum selben
 * Vorgang gelten dann als gelesen. „Alle ansehen“ führt auch beim Kunden auf eine echte Liste.
 */
export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications();
  const { role } = useAuth();
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();

  const oeffnen = async (n: (typeof notifications)[number]) => {
    if (!n.is_read) void markAsRead(n);
    const pfad = await hinweisPfad(n, role);
    if (pfad) navigate(pfad);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("title")}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="font-semibold">{t("title")}</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-1 text-xs" onClick={() => markAllAsRead()}>
              <CheckCheck className="h-3 w-3 mr-1" />
              {t("markAllRead")}
            </Button>
          )}
        </div>
        {/* Radix legt um den Inhalt eine Tabelle, die mit langen Titeln breiter wird als das Fenster:
            als Block bleibt sie so breit wie die Glocke, Titel brechen um (16.11.2026). */}
        <ScrollArea className="h-[320px] [&_[data-radix-scroll-area-viewport]>div]:!block">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              {t("empty")}
            </div>
          ) : (
            notifications.slice(0, 10).map((n) => {
              const hatZiel = !!hinweisZiel(n, role);
              return (
                <DropdownMenuItem
                  key={n.id}
                  onSelect={() => void oeffnen(n)}
                  className={cn(
                    "flex items-start gap-3 rounded-none border-b border-border/60 px-3 py-2.5 last:border-b-0",
                    hatZiel ? "cursor-pointer" : "cursor-default",
                    !n.is_read && "bg-muted/50",
                  )}
                >
                  <HinweisIcon type={n.type} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug line-clamp-2 break-words">{n.title}</p>
                    {n.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2 break-words mt-0.5">
                        {/* „Provision: … €“ nach einer Platzierung folgt dem Auge in der Kopfleiste. */}
                        {n.type === 'placement_created' ? <Honorar>{n.message}</Honorar> : n.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">{hinweisZeit(n.created_at, t)}</p>
                  </div>
                  {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                </DropdownMenuItem>
              );
            })
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem asChild className="justify-center py-2.5 text-sm text-muted-foreground">
              <Link to={role === "recruiter" ? "/recruiter/notifications" : "/dashboard/notifications"}>{t("showAll")}</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
