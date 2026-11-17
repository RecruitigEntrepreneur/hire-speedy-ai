import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Briefcase, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { useBewerber } from '@/hooks/useBewerber';
import { sucheKundenBewerber, sucheKundenStellen, type KundenBewerber, type KundenStelle } from '@/lib/kundenSuche';

/**
 * Suche des Kunden (17.11.2026, Kunden-Durchklick Punkt 3): Stellen der ganzen Firma und alle
 * Bewerber. Liegt im CommandDialog und wird nur gerendert, solange das Fenster offen ist.
 * Bewerber kommen aus derselben Quelle wie die Bewerberliste (Name erst nach Freigabe).
 */
export function KundenSuche({ userId, query, onWaehle }: {
  userId: string;
  query: string;
  onWaehle: (pfad: string) => void;
}) {
  const { t } = useTranslation('common');
  const bewerber = useBewerber({ tab: null, jobId: null, search: '', sort: 'newest' });

  // Alle Stellen, die der Kunde sehen darf (RLS: eigene Firma), wie die Stellenliste.
  const stellenRoh = useQuery({
    queryKey: ['kunden-suche', 'stellen', userId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, location, status')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stellen = useMemo<KundenStelle[]>(() => {
    const laufend = new Map<string, number>();
    for (const b of bewerber.allItems) if (b.tab !== 'archiv') laufend.set(b.jobId, (laufend.get(b.jobId) ?? 0) + 1);
    return (stellenRoh.data ?? []).map((s) => ({ ...s, laufend: laufend.get(s.id) ?? 0 }));
  }, [stellenRoh.data, bewerber.allItems]);

  const leute = useMemo<KundenBewerber[]>(() => bewerber.allItems.map((b) => ({
    id: b.submissionId,
    name: (b.identityUnlocked && b.fullName) || b.anonymizedName,
    kuerzel: b.anonymizedName,
    rolle: b.currentRole,
    stelle: b.jobTitle,
    archiv: b.tab === 'archiv',
  })), [bewerber.allItems]);

  const q = query.trim();
  const sTreffer = useMemo(() => sucheKundenStellen(stellen, q), [stellen, q]);
  const bTreffer = useMemo(() => sucheKundenBewerber(leute, q), [leute, q]);
  const laedt = stellenRoh.isLoading || bewerber.isLoading;

  if (!q) return null;
  if (laedt) return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('search.loading')}</p>;
  if (sTreffer.length === 0 && bTreffer.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('search.none', { q })}</p>;
  }

  return (
    <>
      {sTreffer.length > 0 && (
        <CommandGroup heading={t('search.jobs')}>
          {sTreffer.map((s) => {
            const unter = [
              s.location,
              s.status ? t(`search.jobState.${s.status}`, { defaultValue: '' }) : '',
              s.laufend ? t('search.running', { count: s.laufend }) : '',
            ].filter(Boolean).join(' · ');
            return (
              <CommandItem key={s.id} value={`s-${s.id}`} onSelect={() => onWaehle(`/dashboard/jobs/${s.id}`)} className="cursor-pointer gap-3">
                <Briefcase className="text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.title}</span>
                  {unter && <span className="block truncate text-xs text-muted-foreground">{unter}</span>}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}

      {bTreffer.length > 0 && (
        <CommandGroup heading={t('search.cApplicants')}>
          {bTreffer.map((b) => {
            const unter = [b.rolle, b.stelle ? t('search.forJob', { job: b.stelle }) : ''].filter(Boolean).join(' · ');
            return (
              <CommandItem key={b.id} value={`b-${b.id}`} onSelect={() => onWaehle(`/dashboard/candidates/${b.id}`)} className="cursor-pointer gap-3">
                <User className="text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{b.name}</span>
                  {unter && <span className="block truncate text-xs text-muted-foreground">{unter}</span>}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}
    </>
  );
}
