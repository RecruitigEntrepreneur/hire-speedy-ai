import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
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
  // Lädt die Meldungen (Namespace recruiterTermin); gelesen werden sie erst beim Anzeigen.
  useTranslation('recruiterTermin');
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
      if (li === 'verbunden') { toast.success(i18n.t('recruiterTermin:rueck.linkedinConnected')); void qc.invalidateQueries({ queryKey: ['linkedin-status'] }); }
      else if (li === 'abgebrochen') toast(i18n.t('recruiterTermin:rueck.linkedinCancelled'));
      else if (li) toast.error(i18n.t('recruiterTermin:rueck.linkedinFailed'));
      if (ka === 'verbunden') { toast.success(i18n.t('recruiterTermin:rueck.outlookConnected')); void qc.invalidateQueries({ queryKey: ['calendar-status'] }); }
      else if (ka === 'it') toast(i18n.t('recruiterTermin:rueck.itConsent'));
      else if (ka) toast.error(i18n.t('recruiterTermin:rueck.outlookFailed'));
    }, 0);
  }, [qc]);
}
