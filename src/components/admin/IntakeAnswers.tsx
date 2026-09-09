import {
  BRIEF_QUESTIONS, DASHBOARD_FRAGEN, frageKurz, slotLabel,
  type BriefQuestion, type BriefSlot, type Known, type Vertrag,
} from '@/lib/briefCatalog';

/**
 * Alles, was der Kunde in der Aufnahme gesagt hat -- auf der Seite, auf der
 * darueber entschieden wird.
 *
 * BEFUND (09.09.2026, an einer echten Aufnahme gemessen): Der Reiter
 * "Aufnahme" zeigte neun feste Zeilen, den generierten Briefing-Text und eine
 * Karte "Dialogantworten", die aus `dyn.answers` liest. Die Katalogantworten
 * liegen aber in `dyn.catalog.known`. Gemessen an MV-2026-001005:
 *
 *     dyn.catalog.known  39 Felder, davon 29 vom Kunden beantwortet
 *     dyn.answers         0  -- das Einzige, was die Seite rendert
 *
 * Die Karte erschien also gar nicht, und 29 Kundenantworten waren unsichtbar:
 * Arbeitsalltag, Erfolgs- und Fehlprofil, Kultur, Entscheider, Muss-Kriterien,
 * nachschulbare Skills, Aufgabenverteilung, Betriebsrat, Kernzeit. Der Admin
 * gab eine Stelle frei, ohne lesen zu koennen, was ihr Kunde gesagt hatte.
 *
 * Die Beschriftungen kommen aus dem Katalog, nicht aus diesem Bauteil -- wie
 * seit `3d772a1` fuer die gesamte Aufnahme festgelegt. Eine neue Frage im
 * Katalog erscheint hier von selbst; eine hier abgeschriebene Beschriftung
 * waere beim ersten Umformulieren still falsch geworden.
 */

/** Woher der Wert stammt. Ein Wert ohne Marke ist die Antwort des Kunden. */
const HERKUNFT: Partial<Record<string, string>> = {
  ad: 'aus der Anzeige',
  enrich: 'aus dem Impressum',
  inherit: 'aus dem Firmenprofil',
  derive: 'abgeleitet',
};

/** Zahlen mit Tausenderpunkt, so wie sie im Rest des Bereichs stehen. */
const zahl = (n: number) => n.toLocaleString('de-DE');

/**
 * Ein Katalogwert als Text.
 *
 * Der Katalog kennt sechs Ablageformen (`store`), und jede sieht anders aus.
 * Ohne diese Stelle stuende bei der Aufgabenverteilung `[object Object]` und
 * beim Gehaltsband dasselbe -- gerade bei den Feldern also, die am meisten
 * hergeben.
 */
export function alsText(wert: unknown): string | null {
  if (wert === null || wert === undefined || wert === '') return null;
  if (typeof wert === 'boolean') return wert ? 'Ja' : 'Nein';
  if (typeof wert === 'number') return zahl(wert);
  if (Array.isArray(wert)) {
    const teile = wert.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).filter(Boolean);
    return teile.length ? teile.join(' · ') : null;
  }
  if (typeof wert === 'object') {
    const o = wert as Record<string, unknown>;
    // Spanne: Gehalt, Tagessatz.
    if ('min' in o || 'max' in o) {
      const min = typeof o.min === 'number' ? zahl(o.min) : null;
      const max = typeof o.max === 'number' ? zahl(o.max) : null;
      if (min && max) return `${min}–${max}`;
      return min ?? max ?? null;
    }
    // Aufteilung in Prozent: Aufgabenverteilung.
    const paare = Object.entries(o)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => (typeof v === 'number' ? `${k} ${v} %` : `${k}: ${String(v)}`));
    return paare.length ? paare.join(' · ') : null;
  }
  return String(wert);
}

/**
 * Beschriftung fuer Werte, die im Katalog KEINEN Slot haben.
 *
 * Es gibt sie, und zwar mit Absicht: `nice_to_have_criteria` entsteht aus der
 * Einstufung an der Kriterienliste, nicht aus einer eigenen Frage
 * (_shared/intake-mapping.ts:168). Ohne diese Stelle waere es eine beantwortete
 * Angabe, die nirgends erscheint -- unsichtbar genau in der Ansicht, die
 * beweisen soll, dass nichts verlorengeht.
 */
const OHNE_SLOT: Partial<Record<string, string>> = {
  nice_to_have_criteria: 'Verhandelbare Kriterien',
};

/**
 * Den Katalog gegen die Antworten legen.
 *
 * Gibt zusaetzlich zurueck, was KEINEN Slot hat. Der Rest der Karte rendert
 * beides; damit kann kein Schluessel aus `known` stumm herausfallen -- auch
 * kein kuenftiger, den heute noch niemand kennt.
 */
export function teileAuf(known: Known, contract: Vertrag) {
  const gesehen = new Set<string>();
  const gruppen: { frage: BriefQuestion; slots: BriefSlot[] }[] = [];
  for (const frage of [...BRIEF_QUESTIONS, ...DASHBOARD_FRAGEN]) {
    const slots = frage.slots.filter((s) => {
      if (s.only && s.only !== contract) return false;
      if (gesehen.has(s.key)) return false;
      gesehen.add(s.key);
      return true;
    });
    if (slots.length) gruppen.push({ frage, slots });
  }
  const ohneSlot = Object.keys(known)
    .filter((k) => !gesehen.has(k) && alsText(known[k]?.value) !== null)
    .sort();
  return { gruppen, ohneSlot };
}

export function IntakeAnswers({ known, contract }: { known: Known; contract: Vertrag }) {
  const { gruppen, ohneSlot } = teileAuf(known, contract);

  const alle = gruppen.flatMap((g) => g.slots);
  const belegt = alle.filter((s) => alsText(known[s.key]?.value) !== null);
  const vomKunden = belegt.filter((s) => {
    const q = known[s.key]?.from;
    return q === 'answer' || q === 'inherit';
  });
  const offen = alle.filter((s) => alsText(known[s.key]?.value) === null);

  if (belegt.length === 0 && ohneSlot.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Alle Antworten aus der Aufnahme
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        <strong className="text-foreground">{vomKunden.length}</strong> von {alle.length} Feldern
        hat der Kunde selbst beantwortet
        {belegt.length > vomKunden.length && <> · {belegt.length - vomKunden.length} stammen aus Anzeige oder Profil</>}
        {offen.length > 0 && <> · {offen.length} blieben offen</>}
      </p>

      <div className="space-y-4">
        {gruppen.map(({ frage, slots }) => {
          const zeigen = slots.filter((s) => alsText(known[s.key]?.value) !== null);
          if (zeigen.length === 0) return null;
          return (
            <div key={frage.key}>
              {/* Markos Wortlaut, nicht eine hier erfundene Ueberschrift. */}
              <p className="mb-1.5 text-xs leading-snug text-muted-foreground">
                {frageKurz(frage, contract) ?? frage.text}
              </p>
              <dl className="space-y-1.5 border-l pl-3 text-sm">
                {zeigen.map((s) => {
                  const zustand = known[s.key]!;
                  const herkunft = zustand.from ? HERKUNFT[zustand.from] : null;
                  return (
                    <div key={s.key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                      <dt className="w-52 shrink-0 text-muted-foreground">
                        {slotLabel(s, contract)}
                      </dt>
                      <dd className="min-w-0 font-medium">
                        {alsText(zustand.value)}
                        {/* Nur das Nicht-Bestaetigte wird markiert. Wer prueft,
                            sucht genau diese Zeilen -- alles andere hat der
                            Kunde selbst gesagt. */}
                        {herkunft && (
                          <span className="ml-2 whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                            {herkunft} — ungeprüft
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          );
        })}
      </div>

      {/* Beantwortet, aber ohne eigene Katalogfrage. Steht getrennt, damit
          niemand nach der zugehoerigen Frage sucht -- es gibt keine. */}
      {ohneSlot.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs leading-snug text-muted-foreground">
            Aus der Einstufung an der Kriterienliste
          </p>
          <dl className="space-y-1.5 border-l pl-3 text-sm">
            {ohneSlot.map((k) => (
              <div key={k} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-52 shrink-0 text-muted-foreground">{OHNE_SLOT[k] ?? k}</dt>
                <dd className="min-w-0 font-medium">{alsText(known[k]?.value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* Was fehlt, gehoert auf dieselbe Seite. Sonst sieht eine lueckenhafte
          Aufnahme genauso aus wie eine vollstaendige. */}
      {offen.length > 0 && (
        <div className="mt-5 border-t pt-3">
          <p className="mb-1 text-xs text-muted-foreground">Offen geblieben</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {offen.map((s) => slotLabel(s, contract)).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}
