import { useState } from 'react';
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
        toast.success('Ihre Interview-Zeiten sind gespeichert.');
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Die Interview-Zeiten konnten nicht gespeichert werden.'),
    });
  };

  return (
    <Card id="kalender" className="scroll-mt-24" data-tour="settings.calendar">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          Kalender und Interview-Zeiten
        </CardTitle>
        <CardDescription>
          {calendarReady
            ? 'Wann Kandidaten Ihnen ein Interview vorschlagen dürfen, und woher Matchunt weiß, wann Sie belegt sind.'
            : 'Wann Kandidaten Ihnen ein Interview vorschlagen dürfen.'}
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
            <h3 className="text-base font-semibold">Ihre Interview-Zeiten</h3>
            <p className="text-sm text-muted-foreground">
              Innerhalb dieser Zeiten darf ein Kandidat eine andere Zeit wählen, wenn Ihre Vorschläge nicht passen.
              Belegte Zeiten aus Outlook sind immer ausgenommen.
            </p>
            {current && <p className="text-xs text-muted-foreground">Kurz: {describeHours(current)}</p>}
          </div>

          {!current ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Interview-Zeiten werden geladen …
            </p>
          ) : (
            <>
              <InterviewHoursEditor value={current} onChange={setDraft} />
              <div className="flex flex-wrap items-center justify-end gap-3">
                {dirty && <span className="text-xs text-muted-foreground">Nicht gespeicherte Änderungen</span>}
                {dirty && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={hours.save.isPending}>
                    Verwerfen
                  </Button>
                )}
                <Button type="button" size="sm" onClick={save} disabled={!dirty || hours.save.isPending}>
                  {hours.save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Zeiten speichern
                </Button>
              </div>
            </>
          )}
        </div>

        <Separator />

        <p className="flex items-center gap-2 text-sm">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Videolink:</span> Microsoft Teams über Matchunt
        </p>
      </CardContent>
    </Card>
  );
}
