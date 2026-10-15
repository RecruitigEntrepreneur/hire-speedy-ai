import { CalendarSettingsSection } from '@/components/interview/calendar/CalendarSettingsSection';
import { SettingsSubpage } from './SettingsShell';

/** Unterseite „Kalender“: Outlook verbinden und Interview-Zeiten -- der bestehende Block speichert für sich. */
export function KalenderSettings({ onBack }: { onBack: () => void }) {
  return (
    <SettingsSubpage title="Kalender" description="Ihre Termine und wann Sie für Interviews können. Gilt nur für Sie." onBack={onBack}>
      <div id="kalender" className="scroll-mt-24">
        <CalendarSettingsSection />
      </div>
    </SettingsSubpage>
  );
}
