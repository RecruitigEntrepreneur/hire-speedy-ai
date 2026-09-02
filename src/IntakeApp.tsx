import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import GuestIntake from './pages/intake/GuestIntake';
import ClarifyAnswer from './pages/intake/ClarifyAnswer';

/**
 * Eigener Einstiegspunkt für die login-freie Jobaufnahme.
 *
 * Warum nicht einfach eine Route in App.tsx: App importiert alle rund 90 Seiten
 * eager (src/App.tsx:7-104) und wiegt gebaut über 2 MB. Ein Unternehmen öffnet
 * einen Aufnahme-Link kalt aus einer E-Mail, häufig mobil — es hat mit dem
 * Admin-, Recruiter- und Academy-Code nichts zu tun und soll ihn nicht laden.
 *
 * Die Route bleibt in App.tsx zusätzlich bestehen, damit interne Navigation und
 * Deeplinks aus dem Dashboard weiter funktionieren; der Split hier greift nur
 * beim direkten Aufruf von /start/… und /aufnahme/….
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function IntakeApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/start/:token" element={<GuestIntake />} />
            {/* Vor der allgemeinen Entwurfsroute: sonst faengt :draftToken
                "rueckfrage" als Token ab. */}
            <Route path="/aufnahme/rueckfrage/:token" element={<ClarifyAnswer />} />
            <Route path="/aufnahme/:draftToken" element={<GuestIntake />} />
            {/* Alles andere gehört nicht hierher — zurück zur Hauptanwendung.
                Ein harter Reload, damit App.tsx sauber übernimmt. */}
            <Route path="*" element={<HardRedirect />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function HardRedirect() {
  if (typeof window !== 'undefined') window.location.replace('/');
  return <div className="min-h-screen bg-background" />;
}
