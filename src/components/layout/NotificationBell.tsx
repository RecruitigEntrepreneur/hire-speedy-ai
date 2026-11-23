import { useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
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
import { hinweisPfad, hinweisZiel } from '@/lib/hinweisZiel';
import { buendeln, headhunterAus, stelleAus } from '@/lib/hinweisBuendel';
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

const istHeute = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** Ungelesen = blauer Punkt links; gelesen bleibt der Platz frei, damit die Titel bündig stehen. */
function Punkt({ an }: { an: boolean }) {
  return <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", an && "bg-klick")} aria-hidden />;
}

/**
 * Glocke (Etappe 1, 15.11.2026): Ein Klick führt auf die Seite, auf der man weitermacht, und das
 * passende Fenster liegt offen darüber (Ziele in lib/hinweisZiel). Der Hinweis und alle zum selben
 * Vorgang gelten dann als gelesen. „Alle ansehen“ führt auch beim Kunden auf eine echte Liste.
 * Seit 17.11.2026 stehen gleiche Info-Meldungen, die direkt aufeinander folgen, in einer Zeile
 * (lib/hinweisBuendel); ein Tipp klappt sie auf.
 */
export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useRealtimeNotifications();
  const { role } = useAuth();
  const { t } = useTranslation("notifications");
  const navigate = useNavigate();
  const [aufgeklappt, setAufgeklappt] = useState<Set<string>>(new Set());

  const oeffnen = async (n: (typeof notifications)[number]) => {
    if (!n.is_read) void markAsRead(n);
    const pfad = await hinweisPfad(n, role);
    if (pfad) navigate(pfad);
  };
  const umschalten = (key: string) =>
    setAufgeklappt((s) => {
      const neu = new Set(s);
      if (neu.has(key)) neu.delete(key);
      else neu.add(key);
      return neu;
    });

  const einzeln = (n: (typeof notifications)[number], eingerueckt: boolean) => {
    const hatZiel = !!hinweisZiel(n, role);
    return (
      <DropdownMenuItem
        key={n.id}
        onSelect={() => void oeffnen(n)}
        className={cn(
          "flex items-start gap-2.5 rounded-none border-b border-border/60 px-4 py-2.5 last:border-b-0",
          hatZiel ? "cursor-pointer" : "cursor-default",
          eingerueckt && "border-b-0 pl-8",
        )}
      >
        <Punkt an={!n.is_read} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm leading-snug line-clamp-2 break-words", !n.is_read && "font-medium")}>{n.title}</p>
          {n.message && (
            <p className="text-xs text-muted-foreground line-clamp-2 break-words mt-0.5">
              {/* „Provision: … €“ nach einer Platzierung folgt dem Auge in der Kopfleiste. */}
              {n.type === 'placement_created' ? <Honorar>{n.message}</Honorar> : n.message}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">{hinweisZeit(n.created_at, t)}</p>
        </div>
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("title")} data-tour="header.bell">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" data-tour="bell.menu">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="text-[15px] font-semibold tracking-tight">
            {t("title")}
            {unreadCount > 0 && <span className="text-xs font-normal text-muted-foreground"> · {t("newCount", { count: unreadCount })}</span>}
          </span>
          {unreadCount > 0 && (
            <button type="button" className="text-xs text-klick hover:underline" onClick={() => markAllAsRead()}>
              {t("markAllRead")}
            </button>
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
            buendeln(notifications.slice(0, 30)).slice(0, 10).map((e, i, alle) => {
              // Gliederung „Heute“ / „Früher“: die Zeile steht einmal vor dem ersten Eintrag ihrer Gruppe.
              const tag = (x: (typeof alle)[number]) => istHeute(x.art === 'einzeln' ? x.hinweis.created_at : x.hinweise[0].created_at);
              const kopf = i === 0 || tag(alle[i - 1]) !== tag(e)
                ? <p key={`kopf-${i}`} className="px-4 pb-0.5 pt-2.5 text-xs text-muted-foreground">{tag(e) ? t('group.today') : t('group.earlier')}</p>
                : null;
              if (e.art === 'einzeln') return <div key={e.hinweis.id}>{kopf}{einzeln(e.hinweis, false)}</div>;
              const offen = aufgeklappt.has(e.key);
              const ungelesen = e.hinweise.some((x) => !x.is_read);
              const namen = [...new Set(e.hinweise.map((x) => headhunterAus(x.message)))];
              const stellen = [...new Set(e.hinweise.map((x) => stelleAus(x.message)).filter(Boolean))];
              const count = e.hinweise.length;
              const titel = e.type === 'search_started'
                ? namen.length === 1 && namen[0] ? t('bundle.searchStartedBy', { name: namen[0], count }) : t('bundle.searchStarted', { count })
                : e.type === 'pause_ended' ? t('bundle.pauseEnded', { count }) : t('bundle.pauseEnding', { count });
              return (
                <div key={e.key} className="border-b border-border/60 last:border-b-0">
                  {kopf}
                  <DropdownMenuItem
                    onSelect={(ev) => { ev.preventDefault(); umschalten(e.key); }}
                    aria-expanded={offen}
                    className="flex cursor-pointer items-start gap-2.5 rounded-none px-4 py-2.5"
                  >
                    <Punkt an={ungelesen} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm leading-snug line-clamp-2 break-words", ungelesen && "font-medium")}>{titel}</p>
                      {stellen.length > 0 && (
                        <p className="text-xs text-muted-foreground line-clamp-2 break-words mt-0.5">{stellen.join(' · ')}</p>
                      )}
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {hinweisZeit(e.hinweise[0].created_at, t)} · <span className="text-klick">{offen ? t('bundle.collapse') : t('bundle.expand')}</span>
                        <ChevronDown className={cn("h-3 w-3 text-klick transition-transform", offen && "rotate-180")} />
                      </p>
                    </div>
                  </DropdownMenuItem>
                  {offen && e.hinweise.map((n) => einzeln(n, true))}
                </div>
              );
            })
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="m-0" />
            <DropdownMenuItem asChild className="justify-center py-2.5 text-sm text-klick focus:text-klick">
              <Link to={role === "recruiter" ? "/recruiter/notifications" : "/dashboard/notifications"}>{t("showAll")} ›</Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
