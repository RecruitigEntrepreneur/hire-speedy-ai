import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import './academy.css';

import AcademyLanding from './pages/AcademyLanding';
import AcademyAuth from './pages/AcademyAuth';
import AusbildungPage from './pages/AusbildungPage';
import ModulPage from './pages/ModulPage';
import ThemaPage from './pages/ThemaPage';
import AbfragePage from './pages/AbfragePage';
import ModulTestPage from './pages/ModulTestPage';

const queryClient = new QueryClient();

/** Akademie-Zugang nur mit Anmeldung. Die Akademie vergibt nie eine Plattform-Rolle
 *  und ist vom Matchunt-Dashboard getrennt; dorthin geht es erst nach Zulassung,
 *  Vertrag und Freischaltung. */
function AcademyProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}

const guard = (el: React.ReactNode) => <AcademyProtected>{el}</AcademyProtected>;

/** Jede neue Seite beginnt oben (außer bei Sprungmarken wie #lehrplan). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => { if (!hash) window.scrollTo(0, 0); }, [pathname, hash]);
  return null;
}

function AcademyRoutes() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<AcademyLanding />} />
      <Route path="/auth" element={<AcademyAuth />} />
      <Route path="/dashboard" element={guard(<AusbildungPage />)} />
      <Route path="/modul/:moduleId" element={guard(<ModulPage />)} />
      <Route path="/modul/:moduleId/test" element={guard(<ModulTestPage />)} />
      <Route path="/thema/:lessonId" element={guard(<ThemaPage />)} />
      <Route path="/thema/:lessonId/abfrage" element={guard(<AbfragePage />)} />
      <Route path="/kurs/*" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

const AcademyApp = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <div className="academy-shell">
            <AcademyRoutes />
          </div>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default AcademyApp;
