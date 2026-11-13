import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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
    die haengen zu sehr an der Stelle, um sie allgemein vorzuschlagen.
    Der deutsche Text ist der Speicherwert (a.schnittstellen); angezeigt wird
    er ueber intake:treppe.interface.c<Stelle>. */
const SCHNITTSTELLEN_STANDARD = [
  'Geschäftsführung', 'Vertrieb', 'Einkauf', 'Controlling', 'IT', 'Personal', 'Produktion', 'Kunden',
];

type T = TFunction<['intake', 'intakeCatalog']>;

/** Anzeige einer Schnittstelle: feste Vorschlaege uebersetzt, eigene und KI-Vorschlaege unveraendert. */
const schnittstelleText = (t: T, x: string): string => {
  const i = SCHNITTSTELLEN_STANDARD.indexOf(x);
  return i >= 0 ? t(`treppe.interface.c${i}`, { defaultValue: x }) : x;
};

const einbindungText = (t: T, a: Abteilungsaufbau): string =>
  a.einbindung
    ? t(`treppe.einbindung.${a.einbindung}`, { defaultValue: EINBINDUNGEN.find((e) => e.wert === a.einbindung)?.label ?? '' })
    : '';

const fuehrungAnzeige = (t: T, f: Abteilungsaufbau['fuehrung']): string =>
  f ? t(`treppe.fuehrung.${f}`, { defaultValue: fuehrungText(f) }) : '';

function frageFuer(t: T, s: AufbauSchritt, a: Abteilungsaufbau): string {
  if (s === 'rollen' && a.einbindung === 'leitung') return t('treppe.question.rollenLeitung');
  if (s === 'rollen' && a.einbindung === 'aufbau') return t('treppe.question.rollenAufbau');
  if (s === 'schnittstellen' && a.einbindung === 'allein') return t('treppe.question.schnittstellenAllein');
  return t(`treppe.question.${s}`);
}

function zeilenText(t: T, s: AufbauSchritt, a: Abteilungsaufbau): string {
  switch (s) {
    case 'einbindung': return einbindungText(t, a);
    case 'team': case 'fuehrt': case 'teams': case 'ziel':
      return t(`treppe.count.${s}`, { count: a[s] ?? 0 });
    case 'fuehrung': return fuehrungAnzeige(t, a.fuehrung);
    case 'rollen': return rollenText(a.rollen) || t('treppe.notSpecified');
    case 'abteilung': {
      const ab = a.abteilung;
      return ab?.name?.trim()
        ? t('treppe.departmentNamed', { name: ab.name.trim(), count: ab?.groesse ?? 0 })
        : t('treppe.departmentSize', { count: ab?.groesse ?? 0 });
    }
    case 'schnittstellen': return (a.schnittstellen ?? []).map((x) => schnittstelleText(t, x)).join(', ') || t('treppe.notSpecified');
  }
}

/** Herkunftshinweis; nur fuer 'ad' und 'derive' gibt es einen. */
const quelleText = (t: T, quelle: string | undefined): string | null =>
  quelle === 'ad' || quelle === 'derive' ? t(`treppe.source.${quelle}`) : null;

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
  /**
   * Etappen-Ansicht (J12): keine eigenen "Weiter"-Knoepfe. Jede Stufe
   * bleibt offen stehen, die naechste erscheint darunter, sobald die davor
   * beantwortet ist; Zahlen gelten beim Verlassen des Felds. Ohne Angabe:
   * alles wie bisher.
   */
  ohneWeiter?: boolean;
}

export function AbteilungsTreppe({
  wert, quelle, onSet, onConfirm,
  rollenVorschlaege = [], schnittstellenVorschlaege = [], laedtVorschlaege, onVorschlaegeNoetig, ohneWeiter = false,
}: Props) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  const a: Abteilungsaufbau = istAufbau(wert) ? wert : {};
  const [bearbeite, setBearbeite] = useState<AufbauSchritt | null>(null);
  const box = useRef<HTMLDivElement>(null);
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
  const hinweis = quelle && quelle !== 'answer' ? quelleText(t, quelle) : null;

  if (ohneWeiter) {
    // Alle beantworteten Stufen bleiben als Frage stehen, dazu die erste offene.
    const setzeUndWeiter = (neu: Abteilungsaufbau) => {
      const vorher = box.current?.querySelectorAll('[data-stufe]').length ?? 0;
      onSet(aufbauBereinigt(neu));
      // Erscheint eine neue Folgefrage, bekommt sie den Fokus -- sonst
      // sprang Tab nach einer Zahl auf "Zurueck" (Durchklick 04.11.2026).
      window.setTimeout(() => {
        const stufen = box.current?.querySelectorAll<HTMLElement>('[data-stufe]');
        if (!stufen || stufen.length <= vorher) return;
        const ziel = stufen[stufen.length - 1].querySelector<HTMLElement>('input, button');
        const imFeld = box.current?.contains(document.activeElement);
        if (ziel && !imFeld) ziel.focus({ preventScroll: true });
      }, 60);
    };
    const sichtbar: AufbauSchritt[] = [];
    for (const s of schritte) {
      sichtbar.push(s);
      if (!schrittBeantwortet(a, s)) break;
    }
    return (
      <div ref={box} className="space-y-4 text-xs">
        {sichtbar.map((s) => (
          <div key={`${a.einbindung ?? ''}-${s}`} data-stufe={s}>
            <Stufe
              schritt={s}
              a={a}
              frage={frageFuer(t, s, a)}
              onFertig={setzeUndWeiter}
              rollenVorschlaege={rollenVorschlaege}
              schnittstellenVorschlaege={schnittstellenVorschlaege.length ? schnittstellenVorschlaege : SCHNITTSTELLEN_STANDARD}
              laedt={laedtVorschlaege}
              ohneWeiter
            />
          </div>
        ))}
        {!a.einbindung && <p className="text-[11px] text-muted-foreground">{t('treppe.followUpsHint')}</p>}
        {hinweis && (
          <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-amber-600">
            {hinweis}
            {onConfirm && quelle === 'ad' && (
              <button type="button" onClick={onConfirm} className="rounded border border-amber-500/40 px-1.5 py-px font-medium hover:bg-amber-500/10">
                {t('treppe.confirm')}
              </button>
            )}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="text-xs">
      {schritte.map((s) => {
        if (s === offen) {
          return (
            <div key={s} className="my-1.5 border-l-2 border-primary py-1 pl-3">
              <Stufe
                schritt={s}
                a={a}
                frage={frageFuer(t, s, a)}
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
                    {t('treppe.cancel')}
                  </button>
                ) : !a.einbindung ? (
                  t('treppe.followUpsHint')
                ) : rest ? (
                  t('treppe.remaining', { count: rest })
                ) : (
                  t('treppe.lastQuestion')
                )}
              </p>
            </div>
          );
        }
        if (!schrittBeantwortet(a, s)) return null;
        return (
          <div key={s} className="flex items-baseline gap-3 border-b py-1.5 last:border-b-0">
            <span className="w-28 shrink-0 text-muted-foreground">{t(`treppe.row.${s}`)}</span>
            <span className="min-w-0 flex-1">{zeilenText(t, s, a)}</span>
            <button
              type="button"
              onClick={() => setBearbeite(s)}
              className="shrink-0 text-[11px] text-primary hover:underline"
            >
              {t('treppe.change')}
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
              {t('treppe.confirm')}
            </button>
          )}
          <span className="text-muted-foreground">{t('treppe.orChange')}</span>
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
  schritt, a, frage, onFertig, rollenVorschlaege, schnittstellenVorschlaege, laedt, ohneWeiter = false,
}: {
  schritt: AufbauSchritt;
  a: Abteilungsaufbau;
  frage: string;
  onFertig: (neu: Abteilungsaufbau) => void;
  rollenVorschlaege: string[];
  schnittstellenVorschlaege: string[];
  laedt?: boolean;
  /** Ohne eigenes "Weiter": Zahlen beim Verlassen, Auswahl sofort uebernehmen. */
  ohneWeiter?: boolean;
}) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  const [zahl, setZahl] = useState<string>(() => {
    const v = schritt === 'abteilung' ? a.abteilung?.groesse : (a as Record<string, unknown>)[schritt];
    return typeof v === 'number' ? String(v) : '';
  });
  const [name, setName] = useState(a.abteilung?.name ?? '');
  const [rollenLokal, setRollenLokal] = useState<Rollenzahl[]>(a.rollen ?? []);
  const [auswahlLokal, setAuswahlLokal] = useState<string[]>(a.schnittstellen ?? []);
  // Ohne "Weiter" gilt jede Aenderung sofort -- dann ist der Entwurf die Quelle.
  const rollen = ohneWeiter ? (a.rollen ?? []) : rollenLokal;
  const auswahl = ohneWeiter ? (a.schnittstellen ?? []) : auswahlLokal;
  const setRollen = (f: (l: Rollenzahl[]) => Rollenzahl[]) =>
    ohneWeiter ? onFertig({ ...a, rollen: f(a.rollen ?? []) }) : setRollenLokal(f);
  const setAuswahl = (f: (l: string[]) => string[]) =>
    ohneWeiter ? onFertig({ ...a, schnittstellen: f(a.schnittstellen ?? []) }) : setAuswahlLokal(f);
  const [eigene, setEigene] = useState('');
  const [fehler, setFehler] = useState('');

  const zahlOk = () => {
    const n = Math.round(Number(zahl));
    if (!zahl.trim() || !Number.isFinite(n) || n < 1) {
      setFehler(t('treppe.numberError'));
      return null;
    }
    return n;
  };

  const kopf = <p className={cn('mb-2 font-medium text-foreground', ohneWeiter ? 'text-sm' : 'text-xs')}>{frage}</p>;
  const fehlerZeile = fehler && <p className="mt-1 text-[11px] text-destructive">{fehler}</p>;
  const weiter = (onClick: () => void) => (ohneWeiter ? null :
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
    >
      {t('shared.next')}
    </button>
  );
  const ueberspringen = (onClick: () => void) => (
    <button type="button" onClick={onClick} className="text-[11px] text-muted-foreground hover:underline">
      {t('treppe.skip')}
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
              {t(`treppe.einbindung.${e.wert}`, { defaultValue: e.label })}
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
              {t(`treppe.fuehrung.${f.wert}`, { defaultValue: f.label })}
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
            type="number" min={1} step={1} value={zahl} autoFocus={!ohneWeiter}
            onChange={(e) => { setZahl(e.target.value); setFehler(''); }}
            onKeyDown={enter(fertig)}
            onBlur={ohneWeiter ? () => { if (zahl.trim()) fertig(); } : undefined}
            className="h-8 w-20 text-xs"
          />
          <span className="text-muted-foreground">{t(`treppe.unit.${schritt}`)}</span>
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
            value={name} placeholder={t('treppe.departmentPlaceholder')}
            onChange={(e) => setName(e.target.value)}
            onBlur={ohneWeiter ? () => { if (zahl.trim()) fertig(); } : undefined}
            className={cn('h-8 text-xs', ohneWeiter ? 'w-full sm:w-96' : 'w-48')}
          />
          <span className="text-muted-foreground">{t('treppe.departmentWith')}</span>
          <Input
            type="number" min={1} step={1} value={zahl}
            onChange={(e) => { setZahl(e.target.value); setFehler(''); }}
            onKeyDown={enter(fertig)}
            onBlur={ohneWeiter ? () => { if (zahl.trim()) fertig(); } : undefined}
            className="h-8 w-20 text-xs"
          />
          <span className="text-muted-foreground">{t('treppe.departmentPeople')}</span>
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
    const alle = ohneWeiter
      ? [...new Set([...rollenVorschlaege, ...rollen.map((x) => x.rolle)])]
      : [...new Set([...rollen.map((x) => x.rolle), ...rollenVorschlaege])];
    // Ohne "Weiter": die erste Rolle uebernimmt die schon genannte Zahl
    // (6 gefuehrte Personen -> "6 Servicetechniker" statt "1").
    const startZahl = ohneWeiter && rollen.length === 0 ? Math.max(1, a.fuehrt ?? a.team ?? 1) : 1;
    const dazu = () => {
      const r = eigene.trim();
      if (r) { setAnzahl(r, Math.max(startZahl, anzahl(r))); setEigene(''); }
    };
    return (
      <>
        {kopf}
        <div className="flex flex-wrap gap-1.5">
          {alle.map((r) => {
            const n = anzahl(r);
            return n > 0 ? (
              <span key={r} className={cn(chipKlasse(true), 'gap-1.5')}>
                <button type="button" aria-label={t('treppe.roleLess', { role: r })} onClick={() => setAnzahl(r, n - 1)}>
                  <Minus className="h-3 w-3" />
                </button>
                {n} {r}
                <button type="button" aria-label={t('treppe.roleMore', { role: r })} onClick={() => setAnzahl(r, n + 1)}>
                  <Plus className="h-3 w-3" />
                </button>
              </span>
            ) : (
              <button key={r} type="button" className={chipKlasse(false)} onClick={() => setAnzahl(r, startZahl)}>
                + {r}
              </button>
            );
          })}
          <Input
            value={eigene} placeholder={t('treppe.rolePlaceholder')}
            onChange={(e) => setEigene(e.target.value)}
            onKeyDown={enter(dazu)} onBlur={dazu}
            className="h-6 w-36 rounded-full px-2.5 text-xs"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {laedt ? t('treppe.suggestionsLoading') : t('treppe.roleHint')}
        </p>
        <div className="mt-2 flex items-center gap-3">
          {weiter(() => onFertig({ ...a, rollen }))}
          {(!ohneWeiter || (rollen.length === 0 && !Array.isArray(a.rollen))) && ueberspringen(() => onFertig({ ...a, rollen: [] }))}
        </div>
      </>
    );
  }

  // schnittstellen
  const alle = ohneWeiter
    ? [...new Set([...schnittstellenVorschlaege, ...auswahl])]
    : [...new Set([...auswahl, ...schnittstellenVorschlaege])];
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
            {schnittstelleText(t, x)}
          </button>
        ))}
        <Input
          value={eigene} placeholder={t('treppe.morePlaceholder')}
          onChange={(e) => setEigene(e.target.value)}
          onKeyDown={enter(dazu)} onBlur={dazu}
          className="h-6 w-28 rounded-full px-2.5 text-xs"
        />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {laedt ? t('treppe.suggestionsLoading') : t('treppe.multiple')}
      </p>
      <div className="mt-2 flex items-center gap-3">
        {weiter(() => onFertig({ ...a, schnittstellen: auswahl }))}
        {(!ohneWeiter || (auswahl.length === 0 && !Array.isArray(a.schnittstellen))) && ueberspringen(() => onFertig({ ...a, schnittstellen: [] }))}
      </div>
    </>
  );
}
