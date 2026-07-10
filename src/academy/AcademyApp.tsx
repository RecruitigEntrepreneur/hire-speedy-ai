import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import './academy.css';

import AcademyLanding from './pages/AcademyLanding';
import AcademyAuth from './pages/AcademyAuth';
import AcademyDashboard from './pages/AcademyDashboard';
import AcademyCourseDetail from './pages/AcademyCourseDetail';
import AcademyLessonPlayer from './pages/AcademyLessonPlayer';

const queryClient = new QueryClient();

/** Akademie-Zugang. Eingeloggte Mitglieder nutzen die echte DB; ohne Login
 *  läuft der DEMO-MODUS (gebündelte Inhalte + localStorage), damit man die
 *  Akademie sofort ansehen/testen kann. Gating NICHT über Plattform-Rolle. */
function AcademyProtected({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  return <>{children}</>;
}

function AcademyRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AcademyLanding />} />
      <Route path="/auth" element={<AcademyAuth />} />
      <Route
        path="/dashboard"
        element={
          <AcademyProtected>
            <AcademyDashboard />
          </AcademyProtected>
        }
      />
      <Route
        path="/kurs/:slug"
        element={
          <AcademyProtected>
            <AcademyCourseDetail />
          </AcademyProtected>
        }
      />
      <Route
        path="/kurs/:slug/lektion/:lessonId"
        element={
          <AcademyProtected>
            <AcademyLessonPlayer />
          </AcademyProtected>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
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
