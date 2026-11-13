import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarClock, Loader2, Save, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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

  return (
    <Card id="kalender" className="scroll-mt-24" data-tour="settings.calendar">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          {t('hours.title')}
        </CardTitle>
        <CardDescription>
          {calendarReady
            ? t('hours.lead')
            : t('hours.leadShort')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {calendarReady && (
          <>
            <CalendarConnectCard variant="settings" />
            <Separator />
          </>
        )}

        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{t('hours.yours')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('hours.yoursLead')}
            </p>
            {current && <p className="text-xs text-muted-foreground">{t('hours.short', { text: describeHours(current) })}</p>}
          </div>

          {!current ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />{t('hours.loading')}
            </p>
          ) : (
            <>
              <InterviewHoursEditor value={current} onChange={setDraft} />
              <div className="flex flex-wrap items-center justify-end gap-3">
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
            </>
          )}
        </div>

        <Separator />

        <p className="flex items-center gap-2 text-sm">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t('hours.videoLink')}</span> {t('hours.videoLinkValue')}
        </p>
      </CardContent>
    </Card>
  );
}
