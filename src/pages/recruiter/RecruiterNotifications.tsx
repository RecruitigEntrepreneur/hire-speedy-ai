import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Honorar } from '@/components/recruiter/Honorar';
import { hinweisPfad, hinweisZiel } from '@/lib/hinweisZiel';
import { cn } from '@/lib/utils';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  related_id: string | null;
  related_type: string | null;
  is_read: boolean;
  created_at: string;
}

/**
 * „Alle ansehen“ aus der Glocke (15.11.2026), für Headhunter (/recruiter/notifications) und Kunden
 * (/dashboard/notifications, bisher „Seite nicht gefunden“). Gleiche Ziele wie die Glocke: Klick
 * öffnet die Seite mit dem passenden Fenster, der Hinweis und alle zum selben Vorgang gelten als gelesen.
 */
export default function RecruiterNotifications() {
  // notifications: Zeitangaben und „Alle gelesen“ wie in der Glocke (gilt für Headhunter und Kunden)
  const { t, i18n } = useTranslation(['recruiterInbox', 'notifications']);
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const sie = role !== 'recruiter';

  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from('notifications')
      .select('id, type, title, message, related_id, related_type, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('Benachrichtigungen konnten nicht geladen werden:', error);
        setNotifications((data ?? []) as Notification[]);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [user]);

  const markiereGelesen = async (n: Notification) => {
    if (!user) return;
    const verwandt = (x: Notification) => x.id === n.id || (!!n.related_type && !!n.related_id && x.related_type === n.related_type && x.related_id === n.related_id);
    let query = supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    query = n.related_type && n.related_id
      ? query.or(`id.eq.${n.id},and(related_type.eq.${n.related_type},related_id.eq.${n.related_id})`)
      : query.eq('id', n.id);
    const { error } = await query;
    if (!error) setNotifications((prev) => prev.map((x) => (verwandt(x) ? { ...x, is_read: true } : x)));
  };

  const alleGelesen = async () => {
    if (!user) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    if (!error) setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const oeffnen = async (n: Notification) => {
    if (!n.is_read) void markiereGelesen(n);
    const pfad = await hinweisPfad(n, role);
    if (pfad) navigate(pfad);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMinutes < 1) return t('notifications:justNow');
    if (diffMinutes < 60) return t('notifications:minutesAgo', { count: diffMinutes });
    if (diffMinutes < 1440) return t('notifications:hoursAgo', { count: Math.floor(diffMinutes / 60) });
    if (diffMinutes < 2880) return t('time.yesterday');
    return date.toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit' });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const liste = notifications.filter((n) => filter === 'all' || !n.is_read);
  // Gliederung nach Tagen: Heute, letzte 7 Tage, Früher (22.11.2026)
  const gruppen = (['today', 'week', 'earlier'] as const)
    .map((key) => ({
      key,
      eintraege: liste.filter((n) => {
        const d = new Date(n.created_at);
        const heute = d.toDateString() === new Date().toDateString();
        const woche = Date.now() - d.getTime() < 7 * 86_400_000;
        return key === 'today' ? heute : key === 'week' ? !heute && woche : !heute && !woche;
      }),
    }))
    .filter((g) => g.eintraege.length > 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('notifications.title')}</h1>
            <p className="text-muted-foreground">{unreadCount > 0 ? t('notifications.unreadOf', { count: unreadCount, total: notifications.length }) : t('notifications.allReadShort')}</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="secondary" className="rounded-full px-4" onClick={() => void alleGelesen()}>
              {t('notifications:markAllRead')}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {([['all', t('notifications.all'), notifications.length], ['unread', t('notifications.unreadTab'), unreadCount]] as const).map(([wert, name, zahl]) => (
            <button
              key={wert}
              type="button"
              onClick={() => setFilter(wert)}
              aria-pressed={filter === wert}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                filter === wert ? 'border-foreground font-medium ring-1 ring-foreground' : 'border-input text-muted-foreground hover:text-foreground',
              )}
            >
              {name} <span className="tabular-nums text-muted-foreground">{zahl}</span>
            </button>
          ))}
        </div>

        {liste.length === 0 ? (
          <div className="rounded-xl border bg-card py-16 text-center">
            <Bell className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-[15px] font-semibold tracking-tight">{t('notifications.emptyTitle')}</h3>
            <p className="text-sm text-muted-foreground">
              {filter === 'unread' ? t('notifications.emptyUnreadShort') : sie ? t('notifications.emptyAllSie') : t('notifications.emptyAllDu')}
            </p>
          </div>
        ) : (
          gruppen.map((g) => (
            <section key={g.key} className="space-y-2">
              <p className="text-xs text-muted-foreground">{t(`notifications:group.${g.key}`)}</p>
              <div className="divide-y overflow-hidden rounded-xl border bg-card">
                {g.eintraege.map((n) => {
                  const hatZiel = !!hinweisZiel(n, role);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => void oeffnen(n)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40',
                        !hatZiel && 'cursor-default',
                      )}
                    >
                      <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', !n.is_read && 'bg-klick')} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', !n.is_read && 'font-medium')}>{n.title}</p>
                        {n.message && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                            {n.type === 'placement_created' ? <Honorar>{n.message}</Honorar> : n.message}
                          </p>
                        )}
                        {n.type === 'opt_in_request' && (
                          <p className="mt-1 text-xs text-muted-foreground">{t('notifications.optInNote')}</p>
                        )}
                        {/* Am Handy steht die Zeit unter dem Text, damit der Titel die Breite bekommt */}
                        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{formatTime(n.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pt-0.5">
                        <span className="hidden text-xs text-muted-foreground sm:inline">{formatTime(n.created_at)}</span>
                        {hatZiel && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
