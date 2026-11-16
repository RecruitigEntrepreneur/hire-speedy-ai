import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Honorar } from '@/components/recruiter/Honorar';
import { HinweisIcon } from '@/components/notifications/HinweisIcon';
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
            <h1 className="text-3xl font-bold tracking-tight">{t('notifications.title')}</h1>
            <p className="text-muted-foreground">{unreadCount > 0 ? t('notifications.unreadShort', { count: unreadCount }) : t('notifications.allReadShort')}</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={() => void alleGelesen()}>
              <Check className="mr-2 h-4 w-4" />
              {t('notifications:markAllRead')}
            </Button>
          )}
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
          <TabsList>
            <TabsTrigger value="all">
              {t('notifications.all')}
              <Badge variant="secondary" className="ml-2">{notifications.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="unread">
              {t('notifications.unreadTab')}
              {unreadCount > 0 && <Badge className="ml-2 bg-destructive">{unreadCount}</Badge>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardContent className="p-0">
            {liste.length === 0 ? (
              <div className="py-16 text-center">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">{t('notifications.emptyTitle')}</h3>
                <p className="text-muted-foreground">
                  {filter === 'unread' ? t('notifications.emptyUnreadShort') : sie ? t('notifications.emptyAllSie') : t('notifications.emptyAllDu')}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {liste.map((n) => {
                  const hatZiel = !!hinweisZiel(n, role);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => void oeffnen(n)}
                      className={cn(
                        'flex w-full items-start gap-4 p-4 text-left transition-colors',
                        !n.is_read ? 'bg-primary/5' : 'hover:bg-muted/30',
                        !hatZiel && 'cursor-default',
                      )}
                    >
                      <HinweisIcon type={n.type} className="h-10 w-10 [&>svg]:h-5 [&>svg]:w-5" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn('font-medium', n.is_read && 'text-muted-foreground')}>{n.title}</p>
                            {n.message && (
                              <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                                {n.type === 'placement_created' ? <Honorar>{n.message}</Honorar> : n.message}
                              </p>
                            )}
                            {n.type === 'opt_in_request' && (
                              <p className="mt-2 text-xs text-muted-foreground">{t('notifications.optInNote')}</p>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatTime(n.created_at)}</span>
                            {!n.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                            {hatZiel && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
