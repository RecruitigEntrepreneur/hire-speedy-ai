import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { describeHours, type InterviewHoursRules } from '@/lib/interviewScheduling';
import { InterviewHoursEditor } from '@/components/interview/calendar/InterviewHoursEditor';

interface Props {
  allow: boolean;
  onAllowChange: (v: boolean) => void;
  rules: InterviewHoursRules;
  onRulesChange: (v: InterviewHoursRules) => void;
  /** Regeln aus den Einstellungen – um „geändert“ anzuzeigen und zurückzusetzen */
  defaultRules: InterviewHoursRules;
}

export function AlternativeSection({ allow, onAllowChange, rules, onRulesChange, defaultRules }: Props) {
  const { t } = useTranslation('clientInterviews');
  const [editing, setEditing] = useState(false);
  const changed = JSON.stringify(rules) !== JSON.stringify(defaultRules);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Switch id="allow-alternative" checked={allow} onCheckedChange={onAllowChange} />
        <Label htmlFor="allow-alternative" className="cursor-pointer text-sm font-normal">
          {t('alt.allow')}
        </Label>
      </div>
      {allow ? (
        <>
          <p className="text-xs text-muted-foreground">
            {t('alt.rule', { hours: describeHours(rules), count: rules.horizonDays })}{' '}
            <button
              type="button"
              className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
              onClick={() => setEditing((v) => !v)}
              aria-expanded={editing}
            >
              {editing ? t('calendar.done') : t('alt.change')}
            </button>
          </p>
          {editing && (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <InterviewHoursEditor value={rules} onChange={onRulesChange} compact />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span>{t('alt.onlyThis')}</span>
                {changed && (
                  <button
                    type="button"
                    className="font-medium text-primary underline underline-offset-2 hover:opacity-80"
                    onClick={() => onRulesChange(defaultRules)}
                  >
                    {t('page.reset')}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t('alt.onlyYours')}</p>
      )}
    </div>
  );
}
