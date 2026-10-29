import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useMyOrganization } from '@/hooks/useOrganization';
import { useCalendarStatus } from '@/components/interview/calendar/useCalendarStatus';
import { useCompanyProfile } from '@/components/client/settings/useCompanyProfile';
import { SettingsHub, type Bereich } from '@/components/client/settings/SettingsHub';
import { KontoSettings } from '@/components/client/settings/KontoSettings';
import { UnternehmenSettings } from '@/components/client/settings/UnternehmenSettings';
import { AuftrittSettings } from '@/components/client/settings/AuftrittSettings';
import { KalenderSettings } from '@/components/client/settings/KalenderSettings';
import { VertragSettings, useVertragStand } from '@/components/client/settings/VertragSettings';

const BEREICHE: Bereich[] = ['konto', 'kalender', 'auftritt', 'team', 'unternehmen', 'vertrag'];
// Alte Sprungmarken (Start-Checkliste, Interview-Fenster, Rücksprung von Microsoft).
const HASH_ZIEL: Record<string, Bereich> = { kalender: 'kalender', firmendaten: 'unternehmen' };
const FIRMA: Bereich[] = ['auftritt', 'unternehmen', 'vertrag'];

/**
 * Einstellungen für Kunden (Entwurf „Mix aus Kacheln und offenen Fragen“, 09.10.2026):
 * Übersicht mit offenen Punkten und Bereichen, jeder Bereich eine kurze Unterseite
 * (?bereich=…), alles speichert automatisch.
 */
export default function ClientSettings() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { organization, myRole, isLoading: orgLoading } = useMyOrganization();
  // Ohne Organisation ist der Kunde selbst der Inhaber.
  const isOwner = myRole ? myRole === 'owner' : true;
  // Rolle Buchhaltung (Etappe 4, 25.10.2026): nur „Mein Konto“; Rechnungsdaten stehen unter Rechnungen
  const financeOnly = myRole === 'finance';
  const company = useCompanyProfile();
  const calendar = useCalendarStatus();
  const vertrag = useVertragStand();

  const roh = params.get('bereich') as Bereich | null;
  const bereich = roh && BEREICHE.includes(roh) && (isOwner || !FIRMA.includes(roh)) && (!financeOnly || roh === 'konto') ? roh : null;

  const open = (b: Bereich | null) => {
    if (b === 'team') { navigate('/dashboard/team'); return; }
    const next = new URLSearchParams(params);
    if (b) next.set('bereich', b); else next.delete('bereich');
    setParams(next);
    window.scrollTo({ top: 0 });
  };

  useEffect(() => {
    const ziel = HASH_ZIEL[window.location.hash.slice(1)];
    if (ziel && !params.get('bereich')) {
      const next = new URLSearchParams(params);
      next.set('bereich', ziel);
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  if (company.loading || orgLoading) {
    return <DashboardLayout><div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  const back = () => open(null);
  const a = vertrag.data?.agreement;
  const contractStatus = !a ? null : a.status === 'active' ? 'Unterschrieben' : a.status === 'customer_signed' ? 'Gegenzeichnung folgt' : a.status === 'sent' ? 'Wartet auf Ihre Unterschrift' : 'In Vorbereitung';

  return (
    <DashboardLayout>
      {bereich === 'konto' ? <KontoSettings onBack={back} />
        : bereich === 'kalender' ? <KalenderSettings onBack={back} />
        : bereich === 'auftritt' ? <AuftrittSettings company={company} onBack={back} />
        : bereich === 'unternehmen' ? <UnternehmenSettings company={company} onBack={back} />
        : bereich === 'vertrag' ? <VertragSettings billingEmail={company.profile.billing_email} onBack={back} onEditCompany={() => open('unternehmen')} />
        : (
          <SettingsHub
            company={company}
            companyName={company.profile.company_name || organization?.name || ''}
            isOwner={isOwner}
            financeOnly={financeOnly}
            calendarConnected={calendar.isLoading ? null : calendar.state === 'connected'}
            contractStatus={contractStatus}
            onOpen={open}
          />
        )}
    </DashboardLayout>
  );
}
