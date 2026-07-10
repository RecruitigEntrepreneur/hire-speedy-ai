import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { BentoTile } from './BentoTile';
import { Inbox } from 'lucide-react';

interface Row {
  submissionId: string;
  anonId: string;
  role: string;
  stage: string;
  status: string;
  matchScore: number | null;
  region: string | null;
  isNew: boolean;
}

const MAX_ROWS = 5;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

/** Tile A – Bewerbungen. Liest ausschließlich aus der reveal-gated
 *  client_candidate_view (Triple-Blind: PII bleibt NULL bis Opt-In). */
export function BewerbungenTile() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_candidate_view')
        .select('submission_id, status, stage, submitted_at, candidate_role, match_score, region_broad')
        .order('submitted_at', { ascending: false });

      if (error) {
        console.error('Error fetching Bewerbungen:', error);
        return;
      }

      const now = Date.now();
      setRows(
        (data || []).map((s: any) => ({
          submissionId: s.submission_id,
          anonId: `PR-${String(s.submission_id || '').slice(0, 6).toUpperCase()}`,
          role: s.candidate_role || 'Nicht angegeben',
          stage: s.stage || s.status,
          status: s.status,
          matchScore: s.match_score ?? null,
          region: s.region_broad ?? null,
          isNew: s.status === 'submitted' && now - new Date(s.submitted_at).getTime() < SEVEN_DAYS,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  const active = useMemo(
    () => rows.filter((r) => r.status !== 'rejected' && r.status !== 'hired'),
    [rows],
  );

  const stageCounts = useMemo(
    () =>
      PIPELINE_STAGES.reduce((acc, st) => {
        acc[st.key] = active.filter((r) => r.stage === st.key).length;
        return acc;
      }, {} as Record<string, number>),
    [active],
  );

  const visible = useMemo(
    () =>
      (tab === 'all' ? active : active.filter((r) => r.stage === tab))
        .slice()
        .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0))
        .slice(0, MAX_ROWS),
    [active, tab],
  );

  return (
    <BentoTile icon={Inbox} title="Bewerbungen" count={loading ? undefined : active.length} to="/dashboard/candidates">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <div className="flex h-full items-center justify-center py-6 text-center text-sm text-muted-foreground">
          Keine offenen Bewerbungen
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="mb-2.5 flex flex-wrap gap-1.5 border-b pb-2.5">
            <Button
              variant={tab === 'all' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTab('all')}
            >
              Alle ({active.length})
            </Button>
            {PIPELINE_STAGES.slice(0, 5).map((st) => {
              const c = stageCounts[st.key] || 0;
              if (!c) return null;
              return (
                <Button
                  key={st.key}
                  variant={tab === st.key ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTab(st.key)}
                >
                  {st.label} ({c})
                </Button>
              );
            })}
          </div>
          <div className="space-y-0.5">
            {visible.map((r) => (
              <Link
                key={r.submissionId}
                to={`/dashboard/candidates/${r.submissionId}`}
                className="group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all hover:bg-accent/50"
              >
                {r.isNew && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-medium transition-colors group-hover:text-primary">
                    {r.anonId}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.role}
                    {r.region ? ` · ${r.region}` : ''}
                  </p>
                </div>
                {r.matchScore != null && (
                  <span className="shrink-0 text-sm font-semibold text-emerald-600">{r.matchScore}%</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </BentoTile>
  );
}
