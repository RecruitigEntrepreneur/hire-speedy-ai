import { useNavigate } from 'react-router-dom';
import { CheckCircle2, CheckSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoTile } from './BentoTile';
import { TaskRow } from '@/components/client/tasks/ClientTaskParts';
import { taskHref, useClientTasks } from '@/lib/clientTasksApi';

/** Kachel „Ihre Aufgaben“ (23.10.2026, ersetzt „Braucht Entscheidung“): gleiche Größe, die
 *  obersten fünf aus der Aufgaben-Quelle, Klick führt direkt zur Handlung. */
export function IhreAufgabenTile() {
  const navigate = useNavigate();
  const { data, isLoading } = useClientTasks();
  const tasks = data?.tasks ?? [];
  return (
    <BentoTile icon={CheckSquare} title="Ihre Aufgaben" count={isLoading ? undefined : tasks.length} to="/dashboard/aufgaben" toLabel="Alle">
      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="mb-1.5 h-8 w-8 text-emerald-500/60" />
          <p className="text-sm text-muted-foreground">Alles erledigt</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {tasks.slice(0, 5).map((t) => <TaskRow key={t.key} task={t} compact onOpen={(x) => navigate(taskHref(x))} />)}
          {(data?.waiting.length ?? 0) > 0 && <p className="px-2.5 pt-1 text-xs text-muted-foreground">Läuft bei anderen: {data!.waiting.length}</p>}
        </div>
      )}
    </BentoTile>
  );
}
