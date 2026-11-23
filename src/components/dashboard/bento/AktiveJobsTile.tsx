import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoTile } from './BentoTile';
import { KachelLeer, KachelReiter, KachelZeile } from './KachelTeile';
import type { JobStats } from '@/hooks/useClientDashboard';
import { Briefcase } from 'lucide-react';

interface Props {
  jobs: JobStats[];
  loading?: boolean;
}

type Reiter = 'all' | 'turn' | 'review';
const MAX_ROWS = 5;
const istPruefung = (j: JobStats) => j.status === 'pending_approval';

/** Tile B – Aktive Jobs (Apple-Stil, 21.11.2026): gleiche Zeilen wie die anderen Kacheln.
 *  Zahlen in Worten statt Symbolen, rechts nur die Handlung (neue Kandidaten prüfen) oder der Stand.
 *  Die errechnete Note „OK / Achtung“ ist entfallen: sie gab dem Kunden nichts zu tun. */
export function AktiveJobsTile({ jobs, loading }: Props) {
  const { t } = useTranslation('clientDashboard');
  const [tab, setTab] = useState<Reiter>('all');

  const dran = useMemo(() => jobs.filter((j) => !istPruefung(j) && j.newCandidates > 0), [jobs]);
  const pruefung = useMemo(() => jobs.filter(istPruefung), [jobs]);

  const visible = useMemo(() => {
    const liste = tab === 'turn' ? dran : tab === 'review' ? pruefung : jobs;
    // Wo der Kunde dran ist zuerst, Stellen in Prüfung zuletzt.
    const rang = (j: JobStats) => (istPruefung(j) ? 2 : j.newCandidates > 0 ? 0 : 1);
    return liste.slice().sort((a, b) => rang(a) - rang(b) || b.newCandidates - a.newCandidates).slice(0, MAX_ROWS);
  }, [jobs, dran, pruefung, tab]);

  const reiter: { key: Reiter; label: string }[] = [
    { key: 'all', label: t('tiles.allCount', { count: jobs.length }) },
    ...(dran.length ? [{ key: 'turn' as const, label: t('tiles.yourTurn', { count: dran.length }) }] : []),
    ...(pruefung.length ? [{ key: 'review' as const, label: `${t('tiles.inReview')} (${pruefung.length})` }] : []),
  ];

  const zahlen = (j: JobStats) => {
    const teile = [
      j.totalCandidates > 0 && t('tiles.nCandidates', { count: j.totalCandidates }),
      j.interviews > 0 && t('tiles.nInterviews', { count: j.interviews }),
      j.offers > 0 && t('tiles.nOffers', { count: j.offers }),
    ].filter(Boolean);
    return teile.length ? teile.join(' · ') : t('tiles.noCandidatesYet');
  };

  return (
    <BentoTile icon={Briefcase} title={t('tiles.activeJobs')} count={loading ? undefined : jobs.length} to="/dashboard/jobs">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <KachelReiter<Reiter> items={reiter} value={tab} onChange={setTab} />
          {jobs.length === 0 ? (
            <KachelLeer>{t('tiles.noActiveJobs')}</KachelLeer>
          ) : (
            <div>
              {visible.map((job) => (
                <KachelZeile
                  key={job.id}
                  to={`/dashboard/jobs/${job.id}`}
                  title={job.title}
                  sub={zahlen(job)}
                  action={!istPruefung(job) && job.newCandidates > 0 ? t('tiles.newToReview', { count: job.newCandidates }) : undefined}
                  state={istPruefung(job) ? t('tiles.inReview') : undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </BentoTile>
  );
}
