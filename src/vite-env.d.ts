/// <reference types="vite/client" />

/** Kurzer Git-Commit des Builds (vite.config.ts), für die Feedback-Lasche. */
declare const __APP_VERSION__: string;
/** Zeitpunkt des Builds (ISO). */
declare const __APP_BUILT_AT__: string;

/** Routen-Tabelle aus src/App.tsx (vite-plugins/feedbackRoutes.ts), für die Feedback-Lasche. */
declare module "virtual:feedback-routes" {
  const routes: { path: string; component: string; file: string }[];
  export default routes;
}
