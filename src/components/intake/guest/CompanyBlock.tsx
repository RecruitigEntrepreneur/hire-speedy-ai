import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Building2, Check, Loader2, Pencil, Sparkles, X } from 'lucide-react';
import { isFailure } from '@/hooks/useGuestIntake';

/**
 * Das Unternehmen — in der Positionsaufnahme, nicht erst unter Kontakt.
 *
 * Zwei Gruende. Erstens: der Parser liest den Firmennamen aus der Anzeige und
 * legte ihn nur in `built.company_name` ab, von wo er nie in die
 * Entwurfsspalten wanderte. Im Admin stand deshalb "Unbenanntes Unternehmen",
 * obwohl die Anzeige die Firma nannte. Zweitens: der Kunde soll sehen und
 * korrigieren, welche Firma wir verstanden haben, waehrend er ohnehin am
 * Profil arbeitet.
 *
 * KEIN Dauerformular. Die erste Fassung waren acht namenlose Kaesten: sobald
 * einer gefuellt war, verschwand sein Platzhalter und niemand konnte mehr
 * sagen, ob "Personalberatung" die Branche oder die Firmierung ist. Deshalb
 * steht hier ein lesbarer Datensatz -- jeder Wert mit dauerhafter
 * Beschriftung, Fehlendes ausdruecklich als fehlend, und bearbeitet wird am
 * Wert selbst.
 *
 * Die Anreicherung liest die Website und das Impressum. Ein deutsches
 * Impressum traegt nach Paragraph 5 TMG genau die Angaben, die eine
 * Vereinbarung braucht -- Firmierung, Adresse, Handelsregister, USt-IdNr.
 * Uebernommen wird davon nichts von selbst: ermittelt ist nicht bestaetigt.
 * Eine falsche Registernummer in einem Vertrag ist kein Schoenheitsfehler.
 */

export interface CompanyDraft {
  company_name: string;
  company_legal_name: string;
  company_website: string;
  company_industry: string;
  company_street: string;
  company_postal_code: string;
  company_city: string;
  company_vat_id: string;
  company_registration_number: string;
}

export interface Anreicherung {
  name?: string;
  legal_name?: string;
  industry?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  registration_number?: string;
  vat_id?: string;
  ceo_name?: string;
  headcount?: number;
}

interface Props {
  werte: Partial<CompanyDraft>;
  /** Firmenname und Branche, wie der Parser sie aus der Anzeige gelesen hat. */
  ausAnzeige: { company_name?: string | null; industry?: string | null };
  onChange: (patch: Partial<CompanyDraft>) => void;
  onEnrich: (domain?: string) => Promise<Anreicherung | { reason: string; message: string }>;
}

type Feld = keyof CompanyDraft;

const FELDER: { key: Feld; label: string; pflicht?: boolean; ph: string }[] = [
  { key: 'company_name', label: 'Firmenname', pflicht: true, ph: 'wie er im Alltag verwendet wird' },
  { key: 'company_legal_name', label: 'Vollständige Firmierung', ph: 'z. B. Muster GmbH' },
  { key: 'company_industry', label: 'Branche', ph: 'z. B. Maschinenbau' },
  { key: 'company_website', label: 'Website', ph: 'https://…' },
  { key: 'company_street', label: 'Straße', ph: 'Straße und Hausnummer' },
  { key: 'company_postal_code', label: 'PLZ', ph: '80337' },
  { key: 'company_city', label: 'Ort', ph: 'München' },
  { key: 'company_registration_number', label: 'Handelsregister', ph: 'z. B. HRB 288632' },
  { key: 'company_vat_id', label: 'USt-IdNr.', ph: 'z. B. DE123456789' },
];

/**
 * Zweispaltig, vier Zeilen -- nicht neun.
 *
 * Neun Zeilen untereinander schoben das Briefing aus dem Bild, eine
 * zugeklappte Zeile verbarg zu viel. Dazwischen liegt: jeder Wert behaelt
 * seine Beschriftung, aber PLZ und Ort teilen eine Zelle, und was
 * zusammengehoert steht nebeneinander.
 */
const RASTER: { key: Feld; span?: boolean; mit?: Feld }[][] = [
  [{ key: 'company_name' }, { key: 'company_industry' }],
  [{ key: 'company_legal_name' }, { key: 'company_website' }],
  [{ key: 'company_street' }, { key: 'company_postal_code', mit: 'company_city' }],
  [{ key: 'company_registration_number' }, { key: 'company_vat_id' }],
];

/** Domain aus einer Website oder einem Firmennamen mit Punkt. */
function domainVon(...kandidaten: (string | null | undefined)[]): string | null {
  for (const k of kandidaten) {
    if (!k) continue;
    const d = String(k)
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split(/[/?#]/)[0]
      .toLowerCase();
    if (d.includes('.') && !d.includes(' ')) return d;
  }
  return null;
}

const FREEMAIL = /(gmail|googlemail|outlook|hotmail|live|yahoo|gmx|web\.de|t-online|icloud|aol|proton)/i;
const RECHTSFORM = /\s+(GmbH(\s*&\s*Co\.?\s*KG)?|AG|SE|KG|OHG|UG(\s*\(haftungsbeschränkt\))?|mbH|e\.\s?K\.|GbR)\s*$/i;

export function CompanyBlock({ werte, ausAnzeige, onChange, onEnrich }: Props) {
  /**
   * Eingaben leben lokal, nicht am gespeicherten Entwurf.
   *
   * Dieselbe Falle wie in ContactStep: der Entwurf kommt erst nach dem
   * gebuendelten Autosave zurueck. Hing das Feld direkt daran, verschluckte es
   * beim Tippen Zeichen -- gemessen wurde aus "Bluewater & Bridge" ein
   * "Bluewater & Bridg".
   */
  const [lokal, setLokal] = useState<Partial<CompanyDraft>>(() => ({ ...werte }));
  const [offen, setOffen] = useState<Feld | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<Anreicherung | null>(null);
  const vorbelegt = useRef(false);
  const versucht = useRef(false);

  const wert = (k: Feld) => (lokal[k] ?? '').trim();

  const setzen = (patch: Partial<CompanyDraft>, ausEingabe = false) => {
    setLokal((v) => ({ ...v, ...patch }));
    // Ein leerer String loescht: intake-draft macht daraus null (Zeile 113).
    // Abgeleitete Werte duerfen deshalb nie leer rausgehen -- so verschwand
    // eine bereits gespeicherte Firmierung. Aus einer echten Eingabe darf
    // Leeren dagegen sehr wohl folgen: der Kunde raeumt ein Feld auf.
    const raus = ausEingabe
      ? patch
      : Object.fromEntries(Object.entries(patch).filter(([, v]) => String(v ?? '').trim() !== ''));
    if (Object.keys(raus).length > 0) onChange(raus as Partial<CompanyDraft>);
  };

  // Was der Parser gelesen hat, einmalig in die leeren Felder uebernehmen.
  // Nur in leere: was der Kunde getippt hat, gewinnt immer.
  useEffect(() => {
    if (vorbelegt.current) return;
    const patch: Partial<CompanyDraft> = {};
    const ausName = (ausAnzeige.company_name ?? '').trim();
    // Ohne Quelle kein Vorbelegen. Sonst laeuft dieser Effekt beim Aufbau
    // einmal mit leeren Werten und schreibt Leere ueber Vorhandenes.
    if (!ausName && !ausAnzeige.industry) return;
    if (!wert('company_name') && ausName) {
      // Der Alltagsname ohne Rechtsform, die Firmierung mit -- beides steht in
      // der Anzeige meist als ein String.
      patch.company_name = ausName.replace(RECHTSFORM, '').trim() || ausName;
      if (!wert('company_legal_name') && RECHTSFORM.test(ausName)) patch.company_legal_name = ausName;
    }
    if (!wert('company_industry') && ausAnzeige.industry) patch.company_industry = ausAnzeige.industry;
    if (Object.keys(patch).length > 0) setzen(patch);
    vorbelegt.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ausAnzeige.company_name, ausAnzeige.industry]);

  const domain = domainVon(wert('company_website'), wert('company_name').includes('.') ? wert('company_name') : null);

  const holen = async (d?: string) => {
    setBusy(true);
    setNote(null);
    const res = await onEnrich(d);
    setBusy(false);
    if (isFailure(res as any)) {
      // Immer die eigene Formulierung. Die Meldung des Servers taugt hier
      // nicht: 'invalid_request' traegt mal "brauchen wir die Website"
      // (kann hier nicht auftreten -- ohne Domain rufen wir gar nicht),
      // mal "Unbekannte Operation." aus einem Deploy-Rueckstand. Beides hat
      // auf einer Kundenseite nichts zu suchen.
      setNote('Die automatische Ergänzung ist gerade nicht möglich. Bitte tragen Sie die Angaben von Hand ein.');
      return;
    }
    const a = res as Anreicherung;
    if (!(a.legal_name || a.street || a.registration_number || a.vat_id || a.city)) {
      setNote('Auf der Website war kein Impressum mit verwertbaren Angaben zu finden.');
      return;
    }
    setVorschlag(a);
  };

  // Sobald eine Firmen-Domain bekannt ist, einmal im Hintergrund versuchen.
  useEffect(() => {
    if (versucht.current || !domain || FREEMAIL.test(domain)) return;
    if (wert('company_street') && wert('company_registration_number') && wert('company_vat_id')) return;
    versucht.current = true;
    void holen(domain);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const uebernehmen = () => {
    if (!vorschlag) return;
    const a = vorschlag;
    const patch: Partial<CompanyDraft> = {};
    // Nur leere Felder fuellen -- eine Kundeneingabe wird nie ueberschrieben.
    const fuelle = (k: Feld, v?: string) => { if (v && !wert(k)) patch[k] = v; };
    fuelle('company_legal_name', a.legal_name);
    fuelle('company_street', a.street);
    fuelle('company_postal_code', a.postal_code);
    fuelle('company_city', a.city);
    fuelle('company_registration_number', a.registration_number);
    fuelle('company_vat_id', a.vat_id);
    fuelle('company_industry', a.industry);
    if (Object.keys(patch).length > 0) setzen(patch);
    setVorschlag(null);
  };

  const fehlendePflicht = FELDER.filter((f) => f.pflicht && !wert(f.key));
  const label = (k: Feld) => FELDER.find((f) => f.key === k)!;

  /** Ein Wert mit dauerhafter Beschriftung. Klick oeffnet ihn. */
  const zelle = (k: Feld, mit?: Feld) => {
    const f = label(k);
    const bearbeitet = offen === k || (mit ? offen === mit : false);
    const zusammen = mit
      ? [wert(k), wert(mit)].filter(Boolean).join(' ')
      : wert(k);
    const beschriftung = mit ? `${f.label} / ${label(mit).label}` : f.label;

    return (
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {beschriftung}
          {f.pflicht && <span className="ml-0.5 text-muted-foreground/60">*</span>}
        </p>
        {bearbeitet ? (
          <div className={cn('flex gap-1', mit && 'grid grid-cols-[4rem_minmax(0,1fr)]')}>
            <Input
              autoFocus={offen === k}
              value={lokal[k] ?? ''}
              placeholder={f.ph}
              onChange={(e) => setzen({ [k]: e.target.value } as Partial<CompanyDraft>, true)}
              onBlur={() => !mit && setOffen(null)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setOffen(null); }}
              className="h-6 text-xs"
            />
            {mit && (
              <Input
                autoFocus={offen === mit}
                value={lokal[mit] ?? ''}
                placeholder={label(mit).ph}
                onChange={(e) => setzen({ [mit]: e.target.value } as Partial<CompanyDraft>, true)}
                onBlur={() => setOffen(null)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setOffen(null); }}
                className="h-6 text-xs"
              />
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOffen(k)}
            className={cn(
              'group flex w-full items-center gap-1.5 rounded text-left text-xs hover:text-foreground',
              !zusammen && (f.pflicht ? 'text-amber-600' : 'text-muted-foreground'),
            )}
          >
            <span className="truncate">{zusammen || (f.pflicht ? 'fehlt' : 'ergänzen')}</span>
            <Pencil className="h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-40" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Building2 className="h-3.5 w-3.5" /> Ihr Unternehmen
          <span className="hidden font-normal normal-case tracking-normal opacity-70 sm:inline">
            — steht später auf der Vereinbarung
          </span>
        </p>
        {busy ? (
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Website wird gelesen
          </span>
        ) : domain ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 gap-1 px-2 text-[11px] text-muted-foreground"
            onClick={() => holen(domain)}
          >
            <Sparkles className="h-3 w-3" /> Aus Impressum
          </Button>
        ) : null}
      </div>

      <div className="space-y-2 p-4 pt-3">
        {RASTER.map((reihe, n) => (
          <div key={n} className="grid grid-cols-2 gap-x-4">
            {reihe.map((z) => <div key={z.key}>{zelle(z.key, z.mit)}</div>)}
          </div>
        ))}

        {fehlendePflicht.length > 0 && (
          <p className="pt-1 text-[11px] text-amber-600">
            Ohne {fehlendePflicht.map((f) => f.label).join(' und ')} können wir die Vereinbarung nicht ausstellen.
          </p>
        )}
        {note && <p className="pt-1 text-[11px] text-amber-600">{note}</p>}

        {vorschlag && (
          <div className="mt-1 rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
            <Badge variant="outline" className="mb-2 gap-1 text-[10px]">
              <Sparkles className="h-2.5 w-2.5 text-primary" /> aus Ihrem Impressum gelesen
            </Badge>
            <ul className="mb-2.5 space-y-0.5 text-xs">
              {vorschlag.legal_name && <li><span className="text-muted-foreground">Firmierung: </span>{vorschlag.legal_name}</li>}
              {(vorschlag.street || vorschlag.city) && (
                <li>
                  <span className="text-muted-foreground">Adresse: </span>
                  {[vorschlag.street, [vorschlag.postal_code, vorschlag.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                </li>
              )}
              {vorschlag.registration_number && <li><span className="text-muted-foreground">Handelsregister: </span>{vorschlag.registration_number}</li>}
              {vorschlag.vat_id && <li><span className="text-muted-foreground">USt-IdNr.: </span>{vorschlag.vat_id}</li>}
              {vorschlag.industry && <li><span className="text-muted-foreground">Branche: </span>{vorschlag.industry}</li>}
              {vorschlag.headcount ? <li><span className="text-muted-foreground">Mitarbeitende: </span>{vorschlag.headcount}</li> : null}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={uebernehmen}>
                <Check className="h-3 w-3" /> Stimmt, übernehmen
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setVorschlag(null)}>
                <X className="h-3 w-3" /> Verwerfen
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Wir füllen nur leere Felder. Was Sie selbst eingetragen haben, bleibt stehen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
