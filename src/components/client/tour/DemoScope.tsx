import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router, UNSAFE_LocationContext, UNSAFE_RouteContext, createPath, parsePath, type Location, type Navigator, type To } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { installDemoBackend, type DemoRegistry } from '@/lib/demoBackend';
import { LayoutBannerContext } from '@/components/layout/DashboardLayout';

/** Adresse einer echten Seite auf der Bühne, etwa das Profil mit offenem Angebots-Fenster. */
export interface DemoLocation { pathname: string; search?: string; state?: unknown }

const toLocation = (to: To, state?: unknown): Location => {
  const path = typeof to === 'string' ? parsePath(to) : to;
  return { pathname: path.pathname ?? '/', search: path.search ?? '', hash: path.hash ?? '', state: state ?? null, key: Math.random().toString(36).slice(2) };
};

/**
 * Seitenwechsel auf der Bühne ohne `?aufgabe=`: Ein Klick auf „Prüfen“ in den Aufgaben soll
 * das Profil zeigen, nicht gleich das Aufgaben-Fenster darüber. Fenster öffnet nur der
 * Rundgang selbst (Startadresse eines Schritts).
 */
const withoutTask = (to: To): To => {
  const path = typeof to === 'string' ? parsePath(to) : { ...to };
  if (!path.search) return path;
  const params = new URLSearchParams(path.search);
  params.delete('aufgabe');
  const rest = params.toString();
  return { ...path, search: rest ? `?${rest}` : '' };
};

/**
 * Eigener Adressraum für die echten Seiten auf der Bühne: Sie sehen ihre eigene Adresse
 * (etwa /dashboard/candidates/…), Seitenwechsel bleiben innen, und die echte Adresse des
 * Rundgangs (/dashboard/rundgang?schritt=…) bleibt unberührt.
 */
function DemoRouter({ initial, children }: { initial: DemoLocation; children: ReactNode }) {
  const [location, setLocation] = useState<Location>(() => toLocation({ pathname: initial.pathname, search: initial.search ?? '' }, initial.state));
  // Neuer Schritt (neues Objekt): Seite und Fenster wie vorgegeben.
  useEffect(() => { setLocation(toLocation({ pathname: initial.pathname, search: initial.search ?? '' }, initial.state)); }, [initial]);
  const navigator = useMemo<Navigator>(() => ({
    createHref: (to) => (typeof to === 'string' ? to : createPath(to)),
    push: (to, state) => setLocation(toLocation(withoutTask(to), state)),
    replace: (to, state) => setLocation(toLocation(withoutTask(to), state)),
    go: () => undefined,
  }), []);
  // Router darf sonst nicht in einem Router stehen; hier ist das gewollt. Ohne leeren
  // RouteContext läsen die inneren Routen ihre Pfade als Unterseiten der Bühne.
  return (
    <UNSAFE_LocationContext.Provider value={null as unknown as React.ContextType<typeof UNSAFE_LocationContext>}>
      <UNSAFE_RouteContext.Provider value={{ outlet: null, matches: [], isDataRoute: false }}>
        <Router location={location} navigator={navigator}>{children}</Router>
      </UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
  );
}

/**
 * Bühne mit echten Seiten: Datenzugriffe kommen aus `registry` (lib/demoBackend.ts), eine
 * eigene Zwischenablage (QueryClient) hält Beispieldaten von den echten Seiten fern.
 */
export function DemoScope({ registry, location, banner, children }: {
  registry: DemoRegistry; location: DemoLocation; banner?: ReactNode; children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const uninstall = installDemoBackend(supabase as unknown as Parameters<typeof installDemoBackend>[0], registry);
    setReady(true);
    return () => { uninstall(); setReady(false); };
  }, [registry]);
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity } } }));
  useEffect(() => () => client.clear(), [client]);
  if (!ready) return null;
  return (
    <QueryClientProvider client={client}>
      <LayoutBannerContext.Provider value={banner ?? null}>
        <DemoRouter initial={location}>{children}</DemoRouter>
      </LayoutBannerContext.Provider>
    </QueryClientProvider>
  );
}
