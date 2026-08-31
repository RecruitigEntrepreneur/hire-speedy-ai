import { createRoot } from "react-dom/client";
import { Suspense, lazy } from "react";
import "./index.css";
import "./i18n";

// Host-/Port-basierter App-Split: akademie.* (Prod) oder Dev-Port :8081 -> AcademyApp,
// sonst Matchunt. Beide teilen Supabase, Typen & i18n. Lazy geladen -> getrennte Bundles.
const App = lazy(() => import("./App.tsx"));
const AcademyApp = lazy(() => import("./academy/AcademyApp.tsx"));
// Die login-freie Jobaufnahme bekommt ein eigenes Bundle: sie wird kalt aus
// einer E-Mail geöffnet, oft mobil, und hat mit Dashboard, Admin und Academy
// nichts zu tun. App.tsx importiert alle ~90 Seiten eager (> 2 MB gebaut).
const IntakeApp = lazy(() => import("./IntakeApp.tsx"));

// Initialize theme from localStorage before render to prevent flash
const savedTheme = localStorage.getItem('matchunt-theme');
if (savedTheme === 'light') {
  document.documentElement.classList.add('light');
}

function isAcademyHost(): boolean {
  const { hostname, port } = window.location;
  // Produktion: akademie.matchunt.* -> Akademie.
  if (hostname.startsWith("akademie.")) return true;
  // Dev: die Akademie läuft auf einem eigenen Port (npm run dev:academy -> :8081).
  if (port === "8081") return true;
  return false;
}

/** Der Aufnahme-Link läuft auf der kanonischen Domain, aber in eigenem Bundle. */
function isGuestIntakePath(): boolean {
  const path = window.location.pathname;
  return path.startsWith("/start/") || path.startsWith("/aufnahme/");
}

const Root = isAcademyHost() ? AcademyApp : isGuestIntakePath() ? IntakeApp : App;

createRoot(document.getElementById("root")!).render(
  <Suspense fallback={<div className="min-h-screen bg-background" />}>
    <Root />
  </Suspense>,
);
