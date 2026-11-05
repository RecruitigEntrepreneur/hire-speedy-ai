import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TASKS_CHANGED } from '@/hooks/useUnifiedTaskInbox';
import type { Gespraechsart } from '@/lib/terminApi';

interface EinladungZeile {
  id: string; arten: Gespraechsart[]; weg: 'mail' | 'selbst'; created_at: string; sent_at: string | null; opened_at: string | null;
  last_opened_at: string | null; booked_at: string | null; revoked_at: string | null; expires_at: string;
}

/** Offene Einladung eines Kandidaten: mehrere Links zählen als eine Einladung. */
export interface OffeneEinladung { seit: string; arten: Gespraechsart[]; perMail: boolean; geoeffnet: boolean; letzteMail: string | null }

const tabelle = () => (supabase as unknown as { from: (t: string) => any }).from('candidate_invites'); // eslint-disable-line @typescript-eslint/no-explicit-any

export function offeneEinladung(zeilen: EinladungZeile[], jetzt = Date.now()): OffeneEinladung | null {
  const offen = zeilen.filter((z) => !z.booked_at && !z.revoked_at && Date.parse(z.expires_at) > jetzt);
  if (!offen.length) return null;
  const mails = offen.map((z) => z.sent_at).filter(Boolean) as string[];
  return {
    seit: offen.map((z) => z.created_at).sort()[0],
    arten: offen[0].arten,
    perMail: mails.length > 0,
    geoeffnet: offen.some((z) => z.opened_at),
    letzteMail: mails.sort().at(-1) ?? null,
  };
}

export function useKandidatEinladung(candidateId: string) {
  const qc = useQueryClient();
  const key = ['kandidat-einladung', candidateId];
  const query = useQuery({
    queryKey: key,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<EinladungZeile[]> => {
      const { data, error } = await tabelle()
        .select('id, arten, weg, created_at, sent_at, opened_at, last_opened_at, booked_at, revoked_at, expires_at')
        .eq('candidate_id', candidateId).order('created_at', { ascending: false }).limit(20);
      return error ? [] : ((data ?? []) as EinladungZeile[]);
    },
  });
  // Einladung aus dem Aufgaben-Fenster: Die Karte im Profil zieht nach
  useEffect(() => {
    const onChange = () => { void qc.invalidateQueries({ queryKey: ['kandidat-einladung', candidateId] }); };
    window.addEventListener(TASKS_CHANGED, onChange);
    return () => window.removeEventListener(TASKS_CHANGED, onChange);
  }, [qc, candidateId]);
  return {
    einladung: offeneEinladung(query.data ?? []),
    isLoading: query.isLoading,
    neuLaden: () => qc.invalidateQueries({ queryKey: key }),
  };
}
