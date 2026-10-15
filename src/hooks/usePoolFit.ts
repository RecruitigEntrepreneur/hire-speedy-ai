import { useEffect, useState } from 'react';
import { checkPoolFit, storedPoolFit, type Fit } from '@/lib/matchFit';

/**
 * Passung der eigenen Kandidaten für eine Stelle: erst die gespeicherten Urteile,
 * dann einmal im Hintergrund die Kandidaten ohne Urteil. `checking` bleibt wahr,
 * bis alle geprüft sind.
 */
export function usePoolFit(jobId: string | null | undefined, candidateIds: string[]) {
  const [fit, setFit] = useState<Map<string, Fit | null>>(new Map());
  const [checking, setChecking] = useState(false);
  const key = candidateIds.join(',');

  useEffect(() => {
    if (!jobId || !candidateIds.length) { setFit(new Map()); setChecking(false); return; }
    let alive = true;
    setChecking(true);
    (async () => {
      const stored = await storedPoolFit(jobId, candidateIds).catch(() => new Map<string, Fit>());
      if (!alive) return;
      setFit(new Map(stored));
      const missing = candidateIds.filter((id) => !stored.has(id));
      await checkPoolFit(jobId, missing, (id, f) => {
        if (alive) setFit((prev) => new Map(prev).set(id, f));
      });
      if (alive) setChecking(false);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, key]);

  return { fit, checking };
}
