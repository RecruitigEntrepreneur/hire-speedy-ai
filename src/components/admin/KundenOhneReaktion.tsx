import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MAX_ERINNERUNGEN, WERKTAGE_BIS_NAECHSTE, addWorkdays } from '@/lib/kundePrueft';

interface Row {
  company: string;
  candidates: number;
  jobs: number;
  since: string;
}

const DAY_MS = 86_400_000;

async function load(): Promise<Row[]> {
  const now = new Date();
  const { data: logs, error } = await (supabase as any)
    .from('candidate_activity_log')
    .select('related_submission_id, created_at')
    .contains('metadata', { kind: 'client_nudge' })
    .gte('created_at', new Date(Date.now() - 60 * DAY_MS).toISOString())
    .limit(2000);
  if (error) throw error;
  const bySub = new Map<string, string[]>();
  for (const l of (logs ?? []) as { related_submission_id: string | null; created_at: string }[]) {
    if (!l.related_submission_id) continue;
    bySub.set(l.related_submission_id, [...(bySub.get(l.related_submission_id) ?? []), l.created_at]);
  }
  // 2 Erinnerungen und danach 3 Werktage ohne Antwort
  const due = [...bySub.entries()].filter(([, at]) => {
    if (at.length < MAX_ERINNERUNGEN) return false;
    const last = at.sort().pop()!;
    return now >= addWorkdays(new Date(last), WERKTAGE_BIS_NAECHSTE);
  });
  if (!due.length) return [];
  const sinceOf = new Map(due.map(([id, at]) => [id, addWorkdays(new Date(at.sort().pop()!), WERKTAGE_BIS_NAECHSTE).toISOString()]));
  const { data: subs } = await supabase
    .from('submissions')
    .select('id, job_id, status')
    .in('id', due.map(([id]) => id))
    // Auch „Kunde ohne Feedback“ nach dem Interview: das Fenster verspricht, dass Matchunt übernimmt (29.10.2026)
    .in('status', ['submitted', 'pending', 'in_review', 'interview']);
  const open = (subs ?? []) as { id: string; job_id: string; status: string }[];
  if (!open.length) return [];
  const { data: jobs } = await supabase.from('jobs').select('id, company_name').in('id', [...new Set(open.map(s => s.job_id))]);
  const companyOf = new Map(((jobs ?? []) as { id: string; company_name: string | null }[]).map(j => [j.id, j.company_name || 'Unbekannter Kunde']));
  const byCompany = new Map<string, { subs: string[]; jobs: Set<string> }>();
  for (const s of open) {
    const c = companyOf.get(s.job_id) ?? 'Unbekannter Kunde';
    const e = byCompany.get(c) ?? { subs: [], jobs: new Set<string>() };
    e.subs.push(s.id);
    e.jobs.add(s.job_id);
    byCompany.set(c, e);
  }
  return [...byCompany.entries()].map(([company, e]) => ({
    company,
    candidates: e.subs.length,
    jobs: e.jobs.size,
    since: e.subs.map(id => sinceOf.get(id)!).sort()[0],
  })).sort((a, b) => a.since.localeCompare(b.since));
}

/**
 * Admin › Dashboard (20.10.2026): Kunden, die auf 2 Erinnerungen des Headhunters nicht
 * reagiert haben. Ab hier kümmert sich Matchunt; der Headhunter sieht „Matchunt
 * kümmert sich“. Die Zeile verschwindet, sobald der Kunde reagiert.
 */
export function KundenOhneReaktion() {
  const navigate = useNavigate();
  const { data: rows = [], isError } = useQuery({ queryKey: ['admin-kunden-ohne-reaktion'], queryFn: load, retry: false, staleTime: 60_000 });
  if (isError || rows.length === 0) return null;
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-amber-600" />
          Kunden ohne Reaktion · {rows.length}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(r => (
          <div key={r.company} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
            <div className="min-w-0">
              <p className="font-medium">{r.company}</p>
              <p className="text-xs text-muted-foreground">
                {r.candidates} {r.candidates === 1 ? 'Kandidat' : 'Kandidaten'} · {r.jobs} {r.jobs === 1 ? 'Stelle' : 'Stellen'} · 2 Erinnerungen ohne Antwort · seit {new Date(r.since).toLocaleDateString('de-DE')}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate('/admin/clients')}>Zum Kunden</Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Die Headhunter erinnern hier nicht mehr selbst. Die Zeile verschwindet, sobald der Kunde reagiert.</p>
      </CardContent>
    </Card>
  );
}
