import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Briefcase, Phone, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { sucheKandidaten, sucheStellen, type SuchKandidat, type SuchStelle } from '@/lib/headhunterSuche';

/**
 * Suche des Headhunters (16.11.2026, Marko: „Ja, so bauen“). Für den Moment „Kandidat ruft an“:
 * eigene Kandidaten nach Name, Telefonnummer, E-Mail, Position, Firma, Ort; dazu offene Stellen.
 * Keine Schnellwege mehr, die erledigt das Menü. Vorher suchte die Leiste nur Kundendaten.
 */
export function HeadhunterSuche({ userId, offen, query, onWaehle }: {
  userId: string;
  offen: boolean;
  query: string;
  onWaehle: (pfad: string) => void;
}) {
  const { t } = useTranslation('common');

  // Einmal laden, wenn das Fenster aufgeht; gefiltert wird im Browser (auch Telefonnummern).
  const kandidaten = useQuery({
    queryKey: ['headhunter-suche', 'kandidaten', userId],
    enabled: offen,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidates')
        .select('id, full_name, email, phone, job_title, company, city')
        .eq('recruiter_id', userId)
        .order('updated_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as SuchKandidat[];
    },
  });
  const stellen = useQuery({
    queryKey: ['headhunter-suche', 'stellen'],
    enabled: offen,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruiter_jobs_view')
        .select('id, title, location, company_name, company_revealed')
        .eq('status', 'published')
        .limit(500);
      if (error) throw error;
      return (data ?? []).filter((s): s is SuchStelle => !!s.id) as SuchStelle[];
    },
  });

  const q = query.trim();
  const kTreffer = useMemo(() => sucheKandidaten(kandidaten.data ?? [], q), [kandidaten.data, q]);
  const sTreffer = useMemo(() => sucheStellen(stellen.data ?? [], q), [stellen.data, q]);
  const laedt = kandidaten.isLoading || stellen.isLoading;

  return (
    <CommandList className="max-h-[min(420px,calc(100svh-9rem))]">
      {!q && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('search.hhHint')}</p>}
      {q && laedt && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('search.loading')}</p>}
      {q && !laedt && kTreffer.length === 0 && sTreffer.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('search.none', { q })}</p>
      )}

      {kTreffer.length > 0 && (
        <CommandGroup heading={t('search.myCandidates')}>
          {kTreffer.map((k) => {
            const unter = [k.job_title, k.city].filter(Boolean).join(' · ') || k.email || '';
            const tel = k.phone ? k.phone.replace(/[^\d+]/g, '') : null;
            return (
              <CommandItem key={k.id} value={`k-${k.id}`} onSelect={() => onWaehle(`/recruiter/candidates/${k.id}`)} className="cursor-pointer gap-3">
                <User className="text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{k.full_name}</span>
                  {unter && <span className="block truncate text-xs text-muted-foreground">{unter}</span>}
                </span>
                {tel && (
                  // Anrufen direkt aus der Liste; stopPropagation, damit nicht zugleich das Profil aufgeht
                  <a
                    href={`tel:${tel}`}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={t('search.call', { name: k.full_name })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-foreground hover:bg-accent [&_svg]:!h-4 [&_svg]:!w-4"
                  >
                    <Phone aria-hidden />
                  </a>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      )}

      {sTreffer.length > 0 && (
        <CommandGroup heading={t('search.jobs')}>
          {sTreffer.map((s) => {
            const unter = [s.company_revealed ? s.company_name : null, s.location].filter(Boolean).join(' · ');
            return (
              <CommandItem key={s.id} value={`s-${s.id}`} onSelect={() => onWaehle(`/recruiter/jobs/${s.id}`)} className="cursor-pointer gap-3">
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
    </CommandList>
  );
}
