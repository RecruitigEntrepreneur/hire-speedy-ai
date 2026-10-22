import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheck, Linkedin, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * Erstgespräche aus der Terminseite (21.10.2026): gebuchte Gespräche mit
 * Kandidaten, getrennt von Interviews beim Kunden. Für Interviews, die Akte
 * und die Stelle („Meine Kandidaten“).
 */
export interface Erstgespraech {
  id: string; starts_at: string; ends_at: string; mode: 'teams' | 'phone'; status: 'booked' | 'cancelled';
  first_name: string; last_name: string; email: string; phone: string | null; join_url: string | null;
  candidate_id: string | null; job_id: string | null; source: 'linkedin_beitrag' | 'terminseite'; job_title: string | null; note: string | null;
}

const tabelle = (t: string) => (supabase as unknown as { from: (t: string) => any }).from(t); // eslint-disable-line @typescript-eslint/no-explicit-any

export function useErstgespraeche(filter: { candidateId?: string; jobId?: string; kommende?: boolean } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['erstgespraeche', user?.id, filter.candidateId ?? null, filter.jobId ?? null, filter.kommende ?? false],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<Erstgespraech[]> => {
      let q = tabelle('recruiter_bookings').select('id, starts_at, ends_at, mode, status, first_name, last_name, email, phone, join_url, candidate_id, job_id, source, note')
        .eq('recruiter_id', user!.id).eq('status', 'booked').order('starts_at', { ascending: true }).limit(50);
      if (filter.candidateId) q = q.eq('candidate_id', filter.candidateId);
      if (filter.jobId) q = q.eq('job_id', filter.jobId);
      if (filter.kommende) q = q.gte('ends_at', new Date(Date.now() - 2 * 3600000).toISOString());
      const { data, error } = await q;
      if (error) return [];
      const rows = (data ?? []) as Omit<Erstgespraech, 'job_title'>[];
      const ids = [...new Set(rows.map(r => r.job_id).filter(Boolean))] as string[];
      const titel = new Map<string, string>();
      if (ids.length) {
        // Headhunter lesen Stellen über recruiter_jobs_view, nicht direkt aus jobs.
        const { data: jobs } = await tabelle('recruiter_jobs_view').select('id, title').in('id', ids);
        for (const j of (jobs ?? []) as { id: string; title: string }[]) titel.set(j.id, j.title);
      }
      return rows.map(r => ({ ...r, job_title: r.job_id ? titel.get(r.job_id) ?? null : null }));
    },
  });
}

const ZEIT = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const TAG = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' });

export function ErstgespraechZeile({ g, ohneStelle, ohneAkte }: { g: Erstgespraech; ohneStelle?: boolean; ohneAkte?: boolean }) {
  const jetzt = Date.now();
  const laeuft = Date.parse(g.starts_at) - 10 * 60000 <= jetzt && Date.parse(g.ends_at) >= jetzt;
  return <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border p-3', laeuft ? 'border-emerald-500/40 bg-emerald-500/[0.05]' : 'border-border bg-card')}>
    <div className="w-16 shrink-0 text-center">
      <div className="text-sm font-semibold tabular-nums">{ZEIT.format(new Date(g.starts_at))}</div>
      <div className="text-[10px] text-muted-foreground">{TAG.format(new Date(g.starts_at)).replace(',', '')}</div>
    </div>
    {g.mode === 'teams' ? <Video className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Teams"/> : <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Telefon"/>}
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{g.first_name} {g.last_name} <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Erstgespräch</span></p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {[
          !ohneStelle && g.job_title ? <span key="s" className="truncate">{g.job_title}</span> : null,
          <span key="m">{g.mode === 'teams' ? 'Teams' : `Telefon${g.phone ? ` ${g.phone}` : ''}`}</span>,
          g.source === 'linkedin_beitrag' ? <span key="l" className="inline-flex items-center gap-1 text-[#0A66C2]"><Linkedin className="h-3 w-3"/>über LinkedIn</span> : null,
        ].filter(Boolean).flatMap((el, i) => (i ? [<span key={`t${i}`} aria-hidden="true">·</span>, el] : [el]))}
      </p>
    </div>
    <div className="flex shrink-0 gap-1.5">
      {g.mode === 'teams' && g.join_url && <Button size="sm" variant={laeuft ? 'default' : 'outline'} asChild><a href={g.join_url} target="_blank" rel="noreferrer"><Video className="mr-1.5 h-3.5 w-3.5"/>Beitreten</a></Button>}
      {g.mode === 'phone' && g.phone && <Button size="sm" variant={laeuft ? 'default' : 'outline'} asChild><a href={`tel:${g.phone.replace(/[^\d+]/g, '')}`}><Phone className="mr-1.5 h-3.5 w-3.5"/>Anrufen</a></Button>}
      {!ohneAkte && g.candidate_id && <Button size="sm" variant="outline" asChild><Link to={`/recruiter/candidates/${g.candidate_id}`}>Akte</Link></Button>}
    </div>
  </div>;
}

export function ErstgespraecheAbschnitt({ liste, titel = 'Erstgespräche', ohneStelle, ohneAkte }: { liste: Erstgespraech[]; titel?: string; ohneStelle?: boolean; ohneAkte?: boolean }) {
  if (!liste.length) return null;
  return <div className="space-y-2">
    <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary"><CalendarCheck className="h-3.5 w-3.5"/>{titel} ({liste.length})</p>
    <div className="space-y-2">{liste.map(g => <ErstgespraechZeile key={g.id} g={g} ohneStelle={ohneStelle} ohneAkte={ohneAkte}/>)}</div>
  </div>;
}
