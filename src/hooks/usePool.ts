import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { POOL_FRIST_MONATE, aufWerktag, naechsterEintrag, naechsterKontakt, plusMonate, type Pool, type PoolEintrag, type PoolGrund, type PoolRhythmus, type PoolWechsel } from '@/lib/talentPool';

const SPALTEN = 'id, candidate_id, pool_id, pool_type, contact_frequency, next_contact_at, last_contacted_at, notes, consent_at, consent_source, retention_until, change_readiness, is_active, opted_out_at, created_at';
// Die neuen Spalten stehen noch nicht in den erzeugten Typen (Migration 20261125100000).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tabelle = () => (supabase as any).from('talent_pool');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const poolTabelle = () => (supabase as any).from('talent_pools');

export interface PoolEingabe {
  grund: PoolGrund;
  /** Erster bzw. nächster Kontakt */
  naechsterKontakt: Date;
  rhythmus: PoolRhythmus;
  notiz: string;
}

export interface KontaktEingabe {
  /** Was der Kandidat gesagt hat; leere Felder bleiben unverändert. */
  wechsel: PoolWechsel | null;
  verfuegbarAb: string | null;
  gehalt: number | null;
  notiz: string;
  /** null = „nur einmal“, danach kein Termin mehr */
  naechsterKontakt: Date | null;
  weg: 'call' | 'email';
}

/**
 * Talent Pool des Headhunters (Stufe 1, 25.11.2026): alle aktiven Einträge, hinzufügen, ändern,
 * Kontakt festhalten, herausnehmen. Ein Eintrag je Kandidat (UNIQUE in der Tabelle).
 */
export function usePool() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['pool', user?.id];

  const liste = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await tabelle().select(SPALTEN).eq('recruiter_id', user!.id).eq('is_active', true);
      if (error) throw new Error(error.message);
      return (data ?? []) as PoolEintrag[];
    },
  });

  const poolKey = ['pools', user?.id];
  const poolListe = useQuery({
    queryKey: poolKey,
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await poolTabelle().select('id, name, description, default_frequency').eq('recruiter_id', user!.id).is('archived_at', null).order('name');
      if (error) throw new Error(error.message);
      return (data ?? []) as Pool[];
    },
  });
  const pools = poolListe.data ?? [];

  /** Alle Einträge je Kandidat (er kann in mehreren Pools liegen). */
  const alleJeKandidat = useMemo(() => {
    const m = new Map<string, PoolEintrag[]>();
    for (const e of liste.data ?? []) m.set(e.candidate_id, [...(m.get(e.candidate_id) ?? []), e]);
    return m;
  }, [liste.data]);
  /** Je Kandidat der Eintrag, der als Nächstes dran ist. */
  const jeKandidat = useMemo(() => new Map([...alleJeKandidat].map(([id, es]) => [id, naechsterEintrag(es)!])), [alleJeKandidat]);
  const anzahlJePool = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of liste.data ?? []) if (e.pool_id) m.set(e.pool_id, (m.get(e.pool_id) ?? 0) + 1);
    return m;
  }, [liste.data]);
  const poolName = (e: Pick<PoolEintrag, 'pool_id'>) => pools.find((p) => p.id === e.pool_id)?.name ?? null;
  const neuLaden = async () => { await qc.invalidateQueries({ queryKey: key }); notifyTasksChanged(); };

  /** Neuen Pool anlegen; `doppelt`, wenn es den Namen schon gibt. */
  const poolErstellen = async (p: { name: string; beschreibung: string; rhythmus: PoolRhythmus }) => {
    const { data, error } = await poolTabelle().insert({
      recruiter_id: user!.id, name: p.name.trim(), description: p.beschreibung.trim() || null, default_frequency: p.rhythmus,
    }).select('id').single();
    if (error) return { id: null, error: String(error.message), doppelt: error.code === '23505' };
    await qc.invalidateQueries({ queryKey: poolKey });
    return { id: data.id as string, error: null, doppelt: false };
  };

  /** Name, Zweck oder üblichen Rhythmus eines Pools ändern. */
  const poolAendern = async (id: string, p: { name: string; beschreibung: string; rhythmus: PoolRhythmus }) => {
    const { error } = await poolTabelle().update({ name: p.name.trim(), description: p.beschreibung.trim() || null, default_frequency: p.rhythmus }).eq('id', id);
    if (error) return { error: String(error.message), doppelt: error.code === '23505' };
    await qc.invalidateQueries({ queryKey: poolKey });
    return { error: null, doppelt: false };
  };

  /** Pool löschen: er wird archiviert, seine Einträge enden. Die Kandidaten selbst bleiben unberührt. */
  const poolLoeschen = async (id: string) => {
    const { error: e1 } = await tabelle().update({ is_active: false }).eq('pool_id', id).eq('recruiter_id', user!.id);
    if (e1) return { error: String(e1.message) };
    const { error } = await poolTabelle().update({ archived_at: new Date().toISOString() }).eq('id', id);
    if (error) return { error: String(error.message) };
    await qc.invalidateQueries({ queryKey: poolKey });
    await neuLaden();
    return { error: null };
  };

  /**
   * In einen Pool legen oder den Eintrag dort ändern. Die Einwilligung wird beim ersten Eintrag
   * festgehalten; liegt der Kandidat schon in einem anderen Pool, gilt die von dort weiter.
   */
  const speichern = async (candidateId: string, poolId: string, e: PoolEingabe, einwilligung?: { am: Date }) => {
    const basis = {
      pool_type: e.grund,
      contact_frequency: e.rhythmus,
      next_contact_at: aufWerktag(e.naechsterKontakt).toISOString(),
      notes: e.notiz.trim() || null,
      is_active: true,
      opted_out_at: null,
    };
    const alle = alleJeKandidat.get(candidateId) ?? [];
    // Einträge aus der Zeit vor den eigenen Pools haben keinen Pool; der erste Speichervorgang ordnet sie zu
    const vorhanden = alle.find((x) => x.pool_id === poolId) ?? alle.find((x) => !x.pool_id);
    const frueher = alle.find((x) => x.consent_at);
    let error: { message: string } | null;
    if (vorhanden) {
      ({ error } = await tabelle().update({ ...basis, pool_id: poolId }).eq('id', vorhanden.id));
    } else {
      const zustimmung = frueher
        ? { consent_at: frueher.consent_at, consent_source: frueher.consent_source, retention_until: frueher.retention_until }
        : {
          consent_at: einwilligung?.am.toISOString() ?? null,
          consent_source: einwilligung ? 'verbal' : null,
          retention_until: einwilligung ? plusMonate(einwilligung.am, POOL_FRIST_MONATE).toISOString().slice(0, 10) : null,
        };
      // Früher herausgenommen? Dann den alten Eintrag in diesem Pool wieder aktivieren statt doppelt anlegen
      const { data: alt } = await tabelle().select('id').eq('recruiter_id', user!.id).eq('candidate_id', candidateId).eq('pool_id', poolId).maybeSingle();
      ({ error } = alt
        ? await tabelle().update({ ...basis, ...zustimmung }).eq('id', alt.id)
        : await tabelle().insert({ ...basis, ...zustimmung, candidate_id: candidateId, recruiter_id: user!.id, pool_id: poolId }));
    }
    if (!error) await neuLaden();
    return { error: error ? String(error.message) : null };
  };

  /** „Gemeldet“: Kontakt festhalten, Neues ins Profil schreiben, nächsten Termin setzen. */
  const kontaktFesthalten = async (eintrag: PoolEintrag, k: KontaktEingabe, titel: string) => {
    const jetzt = new Date();
    const { error } = await tabelle().update({
      last_contacted_at: jetzt.toISOString(),
      next_contact_at: k.naechsterKontakt ? aufWerktag(k.naechsterKontakt).toISOString() : null,
      ...(k.wechsel ? { change_readiness: k.wechsel } : {}),
      ...(k.notiz.trim() ? { notes: k.notiz.trim() } : {}),
    }).eq('id', eintrag.id);
    if (error) return { error: String(error.message) };

    const profil: Record<string, unknown> = {};
    if (k.verfuegbarAb) profil.availability_date = k.verfuegbarAb;
    if (k.gehalt) profil.expected_salary = k.gehalt;
    if (Object.keys(profil).length) await supabase.from('candidates').update(profil as never).eq('id', eintrag.candidate_id);

    await supabase.from('candidate_activity_log').insert({
      candidate_id: eintrag.candidate_id,
      recruiter_id: user!.id,
      activity_type: k.weg,
      title: titel,
      description: k.notiz.trim() || null,
      metadata: { quelle: 'talent_pool', wechsel: k.wechsel, verfuegbar_ab: k.verfuegbarAb, gehalt: k.gehalt },
    } as never);
    await neuLaden();
    return { error: null };
  };

  /** „Nicht erreicht“: in zwei Tagen (Werktag) noch einmal. */
  const verschieben = async (eintrag: PoolEintrag, tage = 2) => {
    const d = new Date();
    d.setDate(d.getDate() + tage);
    const { error } = await tabelle().update({ next_contact_at: aufWerktag(d).toISOString() }).eq('id', eintrag.id);
    if (!error) await neuLaden();
    return { error: error ? String(error.message) : null };
  };

  const herausnehmen = async (eintrag: PoolEintrag) => {
    const { error } = await tabelle().update({ is_active: false }).eq('id', eintrag.id);
    if (!error) await neuLaden();
    return { error: error ? String(error.message) : null };
  };

  return { eintraege: liste.data ?? [], pools, alleJeKandidat, anzahlJePool, poolName, poolErstellen, poolAendern, poolLoeschen, jeKandidat, laedt: liste.isLoading || poolListe.isLoading, speichern, kontaktFesthalten, verschieben, herausnehmen, vorschlagNaechster: naechsterKontakt };
}
