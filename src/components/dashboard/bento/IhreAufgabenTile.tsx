import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoTile } from './BentoTile';
import { KachelLeer, KachelReiter, KachelZeile } from './KachelTeile';
import { TASK_ACTION, sinceLabel, taskHref, useClientTasks, type ClientTask } from '@/lib/clientTasksApi';

type Reiter = 'mine' | 'others';
const MAX_ROWS = 5;
/** Bei Rechnung und Bestellnummer sagt der Aufgabentitel mehr als die Stelle. */
const TITEL_AUS_AUFGABE = new Set<ClientTask['kind']>(['invoice', 'purchase_order']);

/** Kachel „Ihre Aufgaben“ (23.10.2026; Apple-Stil 21.11.2026): die obersten fünf aus der Aufgaben-Quelle.
 *  Links worum es geht (die Stelle), rechts die eine Handlung in Blau. „Läuft bei anderen“ ist ein Reiter. */
export function IhreAufgabenTile() {
  const { t } = useTranslation('clientDashboard');
  const navigate = useNavigate();
  const { data, isLoading } = useClientTasks();
  const [tab, setTab] = useState<Reiter>('mine');
  const tasks = data?.tasks ?? [];
  const waiting = data?.waiting ?? [];
  const reiter: { key: Reiter; label: string }[] = [
    { key: 'mine', label: t('tiles.yourTurn', { count: tasks.length }) },
    ...(waiting.length ? [{ key: 'others' as const, label: t('tiles.withOthers', { count: waiting.length }) }] : []),
  ];
  const aktiv: Reiter = tab === 'others' && waiting.length ? 'others' : 'mine';
  return (
    <BentoTile icon={CheckSquare} title={t('tiles.tasks')} count={isLoading ? undefined : tasks.length} to="/dashboard/aufgaben">
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : (
        <div className="flex h-full flex-col">
          <KachelReiter<Reiter> items={reiter} value={aktiv} onChange={setTab} />
          {aktiv === 'others' ? (
            <div>
              {waiting.slice(0, MAX_ROWS).map((w) => {
                const titel = w.jobTitle ?? w.who;
                return <KachelZeile key={w.key} title={titel} sub={[w.who !== titel ? w.who : null, w.title].filter(Boolean).join(' · ')} />;
              })}
            </div>
          ) : tasks.length === 0 ? (
            <KachelLeer>{t('tiles.allDone')}</KachelLeer>
          ) : (
            <div>
              {tasks.slice(0, MAX_ROWS).map((task) => {
                const titel = TITEL_AUS_AUFGABE.has(task.kind) ? task.title : task.jobTitle ?? task.title;
                return (
                  <KachelZeile
                    key={task.key}
                    onClick={() => navigate(taskHref(task))}
                    title={titel}
                    sub={[task.who !== titel ? task.who : null, sinceLabel(task.since)].filter(Boolean).join(' · ')}
                    action={TASK_ACTION[task.kind]}
                    rowAttrs={{ 'data-tour-task-row': task.kind }}
                    actionAttrs={{ 'data-tour-task': task.kind }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </BentoTile>
  );
}
