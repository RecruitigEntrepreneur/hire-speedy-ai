import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { linkedinApi, meineTerminseite, speichereTerminseite, type LinkedinStatus, type TerminseiteZeile } from '@/lib/terminApi';

/** Einstellungen der eigenen Terminseite (Profil › Terminseite, Übersicht, Beitragsfenster). */
export function useTerminseite() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['terminseite', user?.id];
  const query = useQuery({ queryKey: key, enabled: !!user?.id, staleTime: 60_000, queryFn: () => meineTerminseite(user!.id) });
  const speichern = useMutation({
    mutationFn: (zeile: Omit<TerminseiteZeile, 'recruiter_id'>) => speichereTerminseite({ ...zeile, recruiter_id: user!.id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terminseite'] }),
  });
  return { zeile: query.data ?? null, isLoading: query.isLoading, speichern };
}

/** LinkedIn-Verbindung zum Posten; liest den Rücksprung (?linkedin=…) einmal aus. */
export function useLinkedin(opts: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const query = useQuery<LinkedinStatus>({ queryKey: ['linkedin-status', user?.id], enabled: !!user?.id && opts.enabled !== false, staleTime: 60_000, queryFn: () => linkedinApi.status() });
  const verbinden = useMutation({
    mutationFn: (returnTo: string) => linkedinApi.start(returnTo),
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e: Error) => toast.error(e.message),
  });
  const trennen = useMutation({
    mutationFn: () => linkedinApi.trennen(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['linkedin-status'] }),
  });
  return { status: query.data ?? null, isLoading: query.isLoading, verbinden, trennen };
}

let ruecksprungGemeldet = false;
/** Rücksprung aus LinkedIn oder Microsoft melden und die Adresse aufräumen. */
export function useRuecksprung() {
  const qc = useQueryClient();
  useEffect(() => {
    const url = new URL(window.location.href);
    const li = url.searchParams.get('linkedin');
    const ka = url.searchParams.get('kalender');
    if (!li && !ka) return;
    url.searchParams.delete('linkedin');
    url.searchParams.delete('kalender');
    url.searchParams.delete('grund');
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (ruecksprungGemeldet) return;
    ruecksprungGemeldet = true;
    window.setTimeout(() => {
      if (li === 'verbunden') { toast.success('LinkedIn ist verbunden.'); void qc.invalidateQueries({ queryKey: ['linkedin-status'] }); }
      else if (li === 'abgebrochen') toast('LinkedIn-Verbindung abgebrochen.');
      else if (li) toast.error('LinkedIn konnte nicht verbunden werden. Versuch es noch einmal.');
      if (ka === 'verbunden') { toast.success('Outlook ist verbunden.'); void qc.invalidateQueries({ queryKey: ['calendar-status'] }); }
      else if (ka === 'it') toast('Deine IT muss der Verbindung einmal zustimmen.');
      else if (ka) toast.error('Outlook konnte nicht verbunden werden. Versuch es noch einmal.');
    }, 0);
  }, [qc]);
}
