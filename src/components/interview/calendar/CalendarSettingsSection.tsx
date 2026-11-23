import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Save, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { describeHours, normalizeRules, type InterviewHoursRules } from '@/lib/interviewScheduling';
import { CalendarConnectCard } from './CalendarConnectCard';
import { InterviewHoursEditor } from './InterviewHoursEditor';
import { useCalendarStatus, useInterviewHours } from './useCalendarStatus';

/**
 * Einstellungen › „Kalender und Interview-Zeiten“ (02.10.2026): Outlook
 * verbinden und die Zeiten, in denen ein Kandidat selbst eine andere Zeit
 * wählen darf. Speichert unabhängig vom Speichern-Knopf der Seite.
 * Ziel von /dashboard/settings#kalender (Checkliste, Dashboard-Karte, Rücksprung).
 */
export function CalendarSettingsSection() {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  const hours = useInterviewHours();
  // Ohne Microsoft-App gibt es nichts zu verbinden: nur die Interview-Zeiten zeigen.
  const calendarReady = useCalendarStatus().status?.state !== 'not_configured';
  const [draft, setDraft] = useState<InterviewHoursRules | null>(null);
  const current = draft ?? hours.rules;
  const dirty = !!draft && !!hours.rules && JSON.stringify(normalizeRules(draft)) !== JSON.stringify(hours.rules);

  const save = () => {
    if (!draft) return;
    hours.save.mutate(draft, {
      onSuccess: () => {
        setDraft(null);
        toast.success(t('hours.saved'));
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : t('interviews:error.hours')),
    });
  };

  // Apple-Stil (22.11.2026): Verbinden als eigene Karte oben, darunter die Zeiten in zwei Spalten.
  return (
    <div id="kalender" className="scroll-mt-24 space-y-5" data-tour="settings.calendar">
      {calendarReady && (
        <section className="rounded-xl border bg-card p-5">
          <CalendarConnectCard variant="settings" />
        </section>
      )}

      <section className="space-y-5 rounded-xl border bg-card p-5">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold tracking-tight">{t('hours.yours')}</h2>
          <p className="text-sm text-muted-foreground">{t('hours.yoursLead')}</p>
          {current && <p className="text-xs text-muted-foreground">{t('hours.short', { text: describeHours(current) })}</p>}
        </div>

        {!current ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />{t('hours.loading')}
          </p>
        ) : (
          <InterviewHoursEditor value={current} onChange={setDraft} split />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="flex items-center gap-2 text-sm">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">{t('hours.videoLink')}</span> {t('hours.videoLinkValue')}
          </p>
          {current && (
            <div className="flex flex-wrap items-center gap-3">
              {dirty && <span className="text-xs text-muted-foreground">{t('hours.unsaved')}</span>}
              {dirty && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={hours.save.isPending}>
                  {t('hours.discard')}
                </Button>
              )}
              <Button type="button" size="sm" onClick={save} disabled={!dirty || hours.save.isPending}>
                {hours.save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {t('hours.save')}
              </Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
