import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { BentoTile } from './BentoTile';
import { KachelLeer, KachelReiter, KachelZeile } from './KachelTeile';
import { Inbox } from 'lucide-react';

interface Row {
  submissionId: string;
  anonId: string;
  role: string | null;
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
  const { t } = useTranslation('clientDashboard');
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
          role: s.candidate_role || null,
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

  // Neue zuerst (dort ist der Kunde dran), sonst die Reihenfolge des Eingangs. Kein Score.
  const visible = useMemo(
    () =>
      (tab === 'all' ? active : active.filter((r) => r.stage === tab))
        .slice()
        .sort((a, b) => Number(b.stage === 'submitted') - Number(a.stage === 'submitted'))
        .slice(0, MAX_ROWS),
    [active, tab],
  );

  const reiter = [
    { key: 'all', label: t('tiles.allCount', { count: active.length }) },
    ...PIPELINE_STAGES.slice(0, 5)
      .filter((st) => (stageCounts[st.key] || 0) > 0)
      .map((st) => ({ key: st.key as string, label: `${t(`tiles.stage.${st.key}`, { defaultValue: st.label })} (${stageCounts[st.key]})` })),
  ];

  return (
    <BentoTile icon={Inbox} title={t('tiles.applications')} count={loading ? undefined : active.length} to="/dashboard/candidates">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <KachelReiter items={reiter} value={tab} onChange={setTab} />
          {active.length === 0 ? (
            <KachelLeer>{t('tiles.noApplications')}</KachelLeer>
          ) : (
            <div>
              {visible.map((r) => (
                <KachelZeile
                  key={r.submissionId}
                  to={`/dashboard/candidates/${r.submissionId}`}
                  title={r.role ?? t('tiles.notSpecified')}
                  sub={`${r.region ? `${r.region} · ` : ''}${r.anonId}`}
                  action={r.stage === 'submitted' ? t('tiles.review') : undefined}
                  state={t(`tiles.stage.${r.stage}`, { defaultValue: '' }) || undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </BentoTile>
  );
}
