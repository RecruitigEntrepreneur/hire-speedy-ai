import { useTranslation } from 'react-i18next';
import { CalendarSettingsSection } from '@/components/interview/calendar/CalendarSettingsSection';
import { SettingsSubpage } from './SettingsShell';

/** Unterseite „Kalender“: Outlook verbinden und Interview-Zeiten -- der bestehende Block speichert für sich. */
export function KalenderSettings({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('clientSettings');
  return (
    <SettingsSubpage title={t('calendar.title')} description={t('calendar.description')} onBack={onBack}>
      <div id="kalender" className="scroll-mt-24">
        <CalendarSettingsSection />
      </div>
    </SettingsSubpage>
  );
}
