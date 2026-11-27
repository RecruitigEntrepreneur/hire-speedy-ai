import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth';
import { CookieConsentBanner } from '@/components/gdpr/CookieConsentBanner';
import { ALTE_SEITEN } from './websitePfade';

/**
 * Die öffentliche Website als eigenes, leichtes Bündel (27.11.2026). Vorher lud die Startseite die ganze App
 * (alle ~90 Seiten, rund 4 MB) und alle Sprachpakete, bevor sie etwas zeigte. Hier nur: die Website-Seiten,
 * der Cookie-Hinweis (braucht die Anmeldung für die gespeicherte Einwilligung) und die alten Umleitungen.
 * Alle Wege in die App (/start, /auth, /recruiter/…) sind gewöhnliche Links und laden die App neu.
 */
const Startseite = lazy(() => import('./pages/Startseite'));
const Headhunter = lazy(() => import('./pages/Headhunter'));
const Karriere = lazy(() => import('./pages/Karriere'));
const Impressum = lazy(() => import('./pages/public/Impressum'));
const Datenschutz = lazy(() => import('./pages/public/Datenschutz'));
const AGB = lazy(() => import('./pages/public/AGB'));

/** Keine Website-Adresse: einmal neu laden, dann übernimmt die App (main.tsx entscheidet nach der Adresse). */
function ZurApp() {
  useEffect(() => { window.location.replace(window.location.href); }, []);
  return null;
}

export default function WebsiteApp() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div style={{ minHeight: '100vh', background: '#fff' }} />}>
          <Routes>
            <Route path="/" element={<Startseite />} />
            <Route path="/w/:sprache" element={<Startseite />} />
            <Route path="/headhunter" element={<Headhunter />} />
            <Route path="/karriere" element={<Karriere />} />
            <Route path="/impressum" element={<Impressum />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="/agb" element={<AGB />} />
            {Object.entries(ALTE_SEITEN).map(([alt, neu]) => <Route key={alt} path={alt} element={<Navigate to={neu} replace />} />)}
            <Route path="*" element={<ZurApp />} />
          </Routes>
        </Suspense>
        <CookieConsentBanner />
      </BrowserRouter>
    </AuthProvider>
  );
}
