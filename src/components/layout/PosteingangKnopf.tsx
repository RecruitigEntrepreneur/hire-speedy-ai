import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

/**
 * Posteingang oben neben der Glocke (Etappe 2, 15.11.2026): kein Menüpunkt mehr. Die Zahl zählt
 * Gespräche, die auf dich warten: beim Headhunter jede Frage, deren neueste Nachricht nicht von ihm
 * ist (sinkt erst mit der Antwort), beim Kunden ungelesene Antworten. Je Gespräch einmal.
 */
export function usePosteingangZahl() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['posteingang-zahl', user?.id, role],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('conversation_id, recipient_id, is_read, created_at')
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order('created_at', { ascending: false })
        .limit(500);
      const neueste = new Map<string, { recipient_id: string; is_read: boolean }>();
      for (const m of (data ?? []) as { conversation_id: string; recipient_id: string; is_read: boolean }[]) {
        if (!neueste.has(m.conversation_id)) neueste.set(m.conversation_id, m);
      }
      return [...neueste.values()].filter((m) => m.recipient_id === user!.id && (role === 'recruiter' || !m.is_read)).length;
    },
  });
}

export function PosteingangKnopf({ href }: { href: string }) {
  const { t } = useTranslation('notifications');
  const { role } = useAuth();
  const zahl = usePosteingangZahl().data ?? 0;
  return (
    <Button variant="ghost" size="icon" className="relative" asChild>
      <Link to={href} aria-label={zahl ? t(role === 'client' ? 'inboxWaitingClient' : 'inboxWaiting', { count: zahl }) : t('inbox')} title={t('inbox')}>
        <MessageCircle className="h-5 w-5" />
        {zahl > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-medium text-destructive-foreground">
            {zahl > 9 ? '9+' : zahl}
          </span>
        )}
      </Link>
    </Button>
  );
}
