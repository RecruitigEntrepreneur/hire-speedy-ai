import { useEffect, useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, Minus, Plus } from 'lucide-react';
import {
  EINBINDUNGEN, FUEHRUNGEN, aufbauBereinigt, aufbauSchritte, istAufbau, naechsterSchritt,
  rollenText, schrittBeantwortet, fuehrungText,
  type Abteilungsaufbau, type AufbauSchritt, type Rollenzahl,
} from '../../../../supabase/functions/_shared/abteilung';

/**
 * "Wie strukturiert sich die Abteilung von der Position?" -- als Treppe.
 *
 * Eine Frage nach der anderen; welche als naechste kommt, haengt an der
 * ersten Antwort (Zweige in _shared/abteilung.ts). Beantwortete Stufen
 * schrumpfen zu einer Zeile mit "aendern" -- der Block bleibt so niedrig wie
 * moeglich (Durchklicken 24.09.2026: "Teamgroesse nimmt viel Platz").
 *
 * Wer eine Stufe aendert, oeffnet NUR diese Stufe, an ihrer Stelle. Wer die
 * Einbindung umstellt, behaelt, was in beiden Zweigen vorkommt, und bekommt
 * nur die neuen Folgefragen.
 */

/** Rueckfall, wenn die KI keine Vorschlaege liefert. Rollen haben keinen:
    die haengen zu sehr an der Stelle, um sie allgemein vorzuschlagen. */
const SCHNITTSTELLEN_STANDARD = [
  'Geschäftsführung', 'Vertrieb', 'Einkauf', 'Controlling', 'IT', 'Personal', 'Produktion', 'Kunden',
];

const FRAGE: Record<AufbauSchritt, string> = {
  einbindung: 'Wie ist die Position eingebunden?',
  team: 'Wie viele Kolleg:innen im direkten Team?',
  fuehrt: 'Wie viele Personen führt die Position direkt?',
  fuehrung: 'Wie wird geführt?',
  teams: 'Wie viele Teams gehören dazu?',
  ziel: 'Auf wie viele Personen soll das Team wachsen?',
  rollen: 'Wer ist im Team?',
  abteilung: 'Wie heißt die Abteilung, und wie groß ist sie?',
  schnittstellen: 'Mit wem arbeitet die Position eng zusammen?',
};

const ZEILE: Record<AufbauSchritt, string> = {
  einbindung: 'Einbindung',
  team: 'Direktes Team',
  fuehrt: 'Führt direkt',
  fuehrung: 'Führung',
  teams: 'Teams',
  ziel: 'Zielgröße',
  rollen: 'Rollen',
  abteilung: 'Abteilung',
  schnittstellen: 'Schnittstellen',
};

const EINHEIT: Partial<Record<AufbauSchritt, [string, string]>> = {
  team: ['Kolleg:in', 'Kolleg:innen'],
  fuehrt: ['Person', 'Personen'],
  teams: ['Team', 'Teams'],
  ziel: ['Person', 'Personen'],
};

function frageFuer(s: AufbauSchritt, a: Abteilungsaufbau): string {
  if (s === 'rollen' && a.einbindung === 'leitung') return 'Wen führt die Position?';
  if (s === 'rollen' && a.einbindung === 'aufbau') return 'Welche Rollen kommen dazu?';
  if (s === 'schnittstellen' && a.einbindung === 'allein') return 'Mit wem arbeitet die Position am engsten?';
  return FRAGE[s];
}

function zeilenText(s: AufbauSchritt, a: Abteilungsaufbau): string {
  const zahl = (n: number | undefined, e: [string, string]) => `${n} ${n === 1 ? e[0] : e[1]}`;
  switch (s) {
    case 'einbindung': return EINBINDUNGEN.find((e) => e.wert === a.einbindung)?.label ?? '';
    case 'team': case 'fuehrt': case 'teams': case 'ziel':
      return zahl(a[s], EINHEIT[s]!);
    case 'fuehrung': return fuehrungText(a.fuehrung);
    case 'rollen': return rollenText(a.rollen) || 'ohne Angabe';
    case 'abteilung': {
      const ab = a.abteilung;
      return `${ab?.name?.trim() ? `${ab.name.trim()} · ` : ''}${ab?.groesse} Personen`;
    }
    case 'schnittstellen': return (a.schnittstellen ?? []).join(', ') || 'ohne Angabe';
  }
}

const QUELLE: Partial<Record<string, string>> = {
  ad: 'aus der Anzeige',
  derive: 'abgeleitet',
};

interface Props {
  wert: unknown;
  quelle?: string;
  onSet: (a: Abteilungsaufbau | undefined) => void;
  onConfirm?: () => void;
  rollenVorschlaege?: string[];
  schnittstellenVorschlaege?: string[];
  laedtVorschlaege?: boolean;
  /** Wird gerufen, sobald Rollen oder Schnittstellen offen stehen. */
  onVorschlaegeNoetig?: () => void;
}

export function AbteilungsTreppe({
  wert, quelle, onSet, onConfirm,
  rollenVorschlaege = [], schnittstellenVorschlaege = [], laedtVorschlaege, onVorschlaegeNoetig,
}: Props) {
  const a: Abteilungsaufbau = istAufbau(wert) ? wert : {};
  const [bearbeite, setBearbeite] = useState<AufbauSchritt | null>(null);
  const offen = bearbeite ?? naechsterSchritt(a);
  const schritte = aufbauSchritte(a);

  useEffect(() => {
    if (offen === 'rollen' || offen === 'schnittstellen') onVorschlaegeNoetig?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  const setze = (neu: Abteilungsaufbau) => {
    onSet(aufbauBereinigt(neu));
    setBearbeite(null);
  };

  const rest = offen ? schritte.filter((s) => s !== offen && !schrittBeantwortet(a, s)).length : 0;
  const hinweis = quelle && quelle !== 'answer' ? QUELLE[quelle] : null;

  return (
    <div className="text-xs">
      {schritte.map((s) => {
        if (s === offen) {
          return (
            <div key={s} className="my-1.5 border-l-2 border-primary py-1 pl-3">
              <Stufe
                schritt={s}
                a={a}
                frage={frageFuer(s, a)}
                onFertig={setze}
                rollenVorschlaege={rollenVorschlaege}
                schnittstellenVorschlaege={
                  schnittstellenVorschlaege.length ? schnittstellenVorschlaege : SCHNITTSTELLEN_STANDARD
                }
                laedt={laedtVorschlaege}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                {bearbeite ? (
                  <button type="button" onClick={() => setBearbeite(null)} className="text-primary hover:underline">
                    abbrechen
                  </button>
                ) : !a.einbindung ? (
                  'Je nach Antwort 2–4 kurze Folgefragen'
                ) : rest ? (
                  `Noch ${rest} ${rest === 1 ? 'Frage' : 'Fragen'}`
                ) : (
                  'Letzte Frage'
                )}
              </p>
            </div>
          );
        }
        if (!schrittBeantwortet(a, s)) return null;
        return (
          <div key={s} className="flex items-baseline gap-3 border-b py-1.5 last:border-b-0">
            <span className="w-28 shrink-0 text-muted-foreground">{ZEILE[s]}</span>
            <span className="min-w-0 flex-1">{zeilenText(s, a)}</span>
            <button
              type="button"
              onClick={() => setBearbeite(s)}
              className="shrink-0 text-[11px] text-primary hover:underline"
            >
              ändern
            </button>
          </div>
        );
      })}

      {hinweis && !offen && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-amber-600">
          {hinweis}
          {onConfirm && quelle === 'ad' && (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded border border-amber-500/40 px-1.5 py-px font-medium hover:bg-amber-500/10"
            >
              ✓ stimmt
            </button>
          )}
          <span className="text-muted-foreground">sonst einfach ändern</span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const chipKlasse = (an: boolean) =>
  cn(
    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
    an
      ? 'border-primary bg-primary/10 text-foreground'
      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
  );

function Stufe({
  schritt, a, frage, onFertig, rollenVorschlaege, schnittstellenVorschlaege, laedt,
}: {
  schritt: AufbauSchritt;
  a: Abteilungsaufbau;
  frage: string;
  onFertig: (neu: Abteilungsaufbau) => void;
  rollenVorschlaege: string[];
  schnittstellenVorschlaege: string[];
  laedt?: boolean;
}) {
  const [zahl, setZahl] = useState<string>(() => {
    const v = schritt === 'abteilung' ? a.abteilung?.groesse : (a as Record<string, unknown>)[schritt];
    return typeof v === 'number' ? String(v) : '';
  });
  const [name, setName] = useState(a.abteilung?.name ?? '');
  const [rollen, setRollen] = useState<Rollenzahl[]>(a.rollen ?? []);
  const [auswahl, setAuswahl] = useState<string[]>(a.schnittstellen ?? []);
  const [eigene, setEigene] = useState('');
  const [fehler, setFehler] = useState('');

  const zahlOk = () => {
    const n = Math.round(Number(zahl));
    if (!zahl.trim() || !Number.isFinite(n) || n < 1) {
      setFehler('Eine Zahl ab 1 eintragen');
      return null;
    }
    return n;
  };

  const kopf = <p className="mb-2 text-xs font-medium text-foreground">{frage}</p>;
  const fehlerZeile = fehler && <p className="mt-1 text-[11px] text-destructive">{fehler}</p>;
  const weiter = (onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
    >
      Weiter
    </button>
  );
  const ueberspringen = (onClick: () => void) => (
    <button type="button" onClick={onClick} className="text-[11px] text-muted-foreground hover:underline">
      überspringen
    </button>
  );
  const enter = (fn: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); fn(); }
  };

  if (schritt === 'einbindung') {
    return (
      <>
        {kopf}
        <div className="flex flex-wrap gap-1.5">
          {EINBINDUNGEN.map((e) => (
            <button
              key={e.wert}
              type="button"
              className={chipKlasse(a.einbindung === e.wert)}
              onClick={() => onFertig({ ...a, einbindung: e.wert })}
            >
              {a.einbindung === e.wert && <Check className="h-2.5 w-2.5" />}
              {e.label}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (schritt === 'fuehrung') {
    return (
      <>
        {kopf}
        <div className="flex flex-wrap gap-1.5">
          {FUEHRUNGEN.map((f) => (
            <button
              key={f.wert}
              type="button"
              className={chipKlasse(a.fuehrung === f.wert)}
              onClick={() => onFertig({ ...a, fuehrung: f.wert })}
            >
              {a.fuehrung === f.wert && <Check className="h-2.5 w-2.5" />}
              {f.label}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (schritt === 'team' || schritt === 'fuehrt' || schritt === 'teams' || schritt === 'ziel') {
    const fertig = () => {
      const n = zahlOk();
      if (n) onFertig({ ...a, [schritt]: n });
    };
    return (
      <>
        {kopf}
        <div className="flex items-center gap-2">
          <Input
            type="number" min={1} step={1} value={zahl} autoFocus
            onChange={(e) => { setZahl(e.target.value); setFehler(''); }}
            onKeyDown={enter(fertig)}
            className="h-8 w-20 text-xs"
          />
          <span className="text-muted-foreground">{EINHEIT[schritt]![1]}</span>
          {weiter(fertig)}
        </div>
        {fehlerZeile}
      </>
    );
  }

  if (schritt === 'abteilung') {
    const fertig = () => {
      const n = zahlOk();
      if (n) onFertig({ ...a, abteilung: { ...(name.trim() ? { name: name.trim() } : {}), groesse: n } });
    };
    return (
      <>
        {kopf}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={name} placeholder="z. B. Rechnungswesen"
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-48 text-xs"
          />
          <span className="text-muted-foreground">mit</span>
          <Input
            type="number" min={1} step={1} value={zahl}
            onChange={(e) => { setZahl(e.target.value); setFehler(''); }}
            onKeyDown={enter(fertig)}
            className="h-8 w-20 text-xs"
          />
          <span className="text-muted-foreground">Personen</span>
          {weiter(fertig)}
        </div>
        {fehlerZeile}
      </>
    );
  }

  if (schritt === 'rollen') {
    const anzahl = (r: string) => rollen.find((x) => x.rolle === r)?.anzahl ?? 0;
    const setAnzahl = (r: string, n: number) =>
      setRollen((l) => (n < 1
        ? l.filter((x) => x.rolle !== r)
        : l.some((x) => x.rolle === r)
          ? l.map((x) => (x.rolle === r ? { ...x, anzahl: n } : x))
          : [...l, { rolle: r, anzahl: n }]));
    const alle = [...new Set([...rollen.map((x) => x.rolle), ...rollenVorschlaege])];
    const dazu = () => {
      const r = eigene.trim();
      if (r) { setAnzahl(r, Math.max(1, anzahl(r))); setEigene(''); }
    };
    return (
      <>
        {kopf}
        <div className="flex flex-wrap gap-1.5">
          {alle.map((r) => {
            const n = anzahl(r);
            return n > 0 ? (
              <span key={r} className={cn(chipKlasse(true), 'gap-1.5')}>
                <button type="button" aria-label={`${r} weniger`} onClick={() => setAnzahl(r, n - 1)}>
                  <Minus className="h-3 w-3" />
                </button>
                {n} {r}
                <button type="button" aria-label={`${r} mehr`} onClick={() => setAnzahl(r, n + 1)}>
                  <Plus className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <button key={r} type="button" className={chipKlasse(false)} onClick={() => setAnzahl(r, 1)}>
                + {r}
              </button>
            );
          })}
          <Input
            value={eigene} placeholder="Weitere Rolle …"
            onChange={(e) => setEigene(e.target.value)}
            onKeyDown={enter(dazu)} onBlur={dazu}
            className="h-6 w-36 rounded-full px-2.5 text-xs"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {laedt ? 'Vorschläge passend zur Rolle werden geladen …' : 'Vorschläge passend zur Rolle · + erhöht die Anzahl'}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {weiter(() => onFertig({ ...a, rollen }))}
          {ueberspringen(() => onFertig({ ...a, rollen: [] }))}
        </div>
      </>
    );
  }

  // schnittstellen
  const alle = [...new Set([...auswahl, ...schnittstellenVorschlaege])];
  const umschalten = (x: string) =>
    setAuswahl((l) => (l.includes(x) ? l.filter((y) => y !== x) : [...l, x]));
  const dazu = () => {
    const x = eigene.trim();
    if (x && !auswahl.includes(x)) setAuswahl((l) => [...l, x]);
    setEigene('');
  };
  return (
    <>
      {kopf}
      <div className="flex flex-wrap gap-1.5">
        {alle.map((x) => (
          <button key={x} type="button" className={chipKlasse(auswahl.includes(x))} onClick={() => umschalten(x)}>
            {auswahl.includes(x) && <Check className="h-2.5 w-2.5" />}
            {x}
          </button>
        ))}
        <Input
          value={eigene} placeholder="Weitere …"
          onChange={(e) => setEigene(e.target.value)}
          onKeyDown={enter(dazu)} onBlur={dazu}
          className="h-6 w-28 rounded-full px-2.5 text-xs"
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {laedt ? 'Vorschläge passend zur Rolle werden geladen …' : 'Mehrere möglich'}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {weiter(() => onFertig({ ...a, schnittstellen: auswahl }))}
        {ueberspringen(() => onFertig({ ...a, schnittstellen: [] }))}
      </div>
    </>
  );
}
