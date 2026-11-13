import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { answerDirectPosition, errorText, getDirectPositionRequests, type DirectPositionRequest } from '@/lib/jobSearch';

/**
 * Rückfrage an den Kunden (K7): Ein Headhunter gibt an, die Stelle schon vor
 * Matchunt direkt bekommen zu haben. Bestätigt ist erst, wenn Belege und Kunde passen.
 */
export function DirectPositionBanner({ jobId, jobTitle, canAnswer }: { jobId: string; jobTitle: string; canAnswer: boolean }) {
  const { t } = useTranslation('clientJobs');
  const [rows, setRows] = useState<DirectPositionRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows((await getDirectPositionRequests(jobId)) ?? []);
    } catch {
      setRows([]);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (id: string, a: 'yes' | 'no') => {
    setBusy(id);
    try {
      await answerDirectPosition(id, a);
      toast.success(
        a === 'yes'
          ? t('direct.yesDone')
          : t('direct.noDone'),
      );
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const open = rows.filter((r) => !r.client_answer);
  if (open.length === 0) return null;

  return (
    <div className="space-y-2">
      {open.map((r) => (
        <div key={r.declaration_id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <HelpCircle className="h-4 w-4 text-amber-600" aria-hidden="true" />
            {t('direct.title', { title: jobTitle })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t('direct.question', { name: r.recruiter_name })}
          </p>
          {canAnswer ? (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" disabled={busy === r.declaration_id} onClick={() => answer(r.declaration_id, 'yes')}>
                {busy === r.declaration_id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t('direct.yes')}
              </Button>
              <Button size="sm" variant="outline" disabled={busy === r.declaration_id} onClick={() => answer(r.declaration_id, 'no')}>
                {t('direct.no')}
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t('direct.noRights')}</p>
          )}
        </div>
      ))}
    </div>
  );
}
