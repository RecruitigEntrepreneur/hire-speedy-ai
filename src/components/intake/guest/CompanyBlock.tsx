import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Check, Loader2, Sparkles, X } from 'lucide-react';
import { isFailure } from '@/hooks/useGuestIntake';

/**
 * Das Unternehmen — in der Positionsaufnahme, nicht erst unter Kontakt.
 *
 * Zwei Gruende. Erstens: der Parser liest den Firmennamen aus der Anzeige und
 * hat ihn bisher nur in `built.company_name` abgelegt, von wo er nie in die
 * Entwurfsspalten wanderte. Im Admin stand deshalb "Unbenanntes Unternehmen",
 * obwohl die Anzeige die Firma nannte. Zweitens: der Kunde soll sehen und
 * korrigieren, welche Firma wir verstanden haben, waehrend er ohnehin am
 * Profil arbeitet.
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

/** Domain aus einer Website oder einer E-Mail-Adresse. */
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

export function CompanyBlock({ werte, ausAnzeige, onChange, onEnrich }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<Anreicherung | null>(null);
  const vorbelegt = useRef(false);
  const versucht = useRef(false);

  // Was der Parser gelesen hat, einmalig in die leeren Felder uebernehmen.
  // Nur in leere: was der Kunde getippt hat, gewinnt immer.
  useEffect(() => {
    if (vorbelegt.current) return;
    const patch: Partial<CompanyDraft> = {};
    if (!werte.company_name && ausAnzeige.company_name) {
      patch.company_name = ausAnzeige.company_name.replace(/\s+(GmbH|AG|KG|SE|UG|mbH|e\.K\.|OHG)(\s*&?\s*Co\.?\s*KG)?$/i, '').trim()
        || ausAnzeige.company_name;
      patch.company_legal_name = werte.company_legal_name || ausAnzeige.company_name;
    }
    if (!werte.company_industry && ausAnzeige.industry) patch.company_industry = ausAnzeige.industry;
    if (Object.keys(patch).length > 0) onChange(patch);
    vorbelegt.current = true;
  }, [ausAnzeige.company_name, ausAnzeige.industry]);

  const domain = domainVon(werte.company_website, werte.company_name?.includes('.') ? werte.company_name : null);

  const holen = async (d?: string) => {
    setBusy(true);
    setNote(null);
    const res = await onEnrich(d);
    setBusy(false);
    if (isFailure(res as any)) {
      // Nur die eigene, an den Kunden gerichtete Meldung durchlassen. Alles
      // andere ist Betriebszustand -- "Unbekannte Operation." hat auf einer
      // Kundenseite nichts zu suchen.
      setNote((res as any).reason === 'invalid_request'
        ? (res as any).message
        : 'Die automatische Ergänzung ist gerade nicht möglich. Bitte tragen Sie die Angaben von Hand ein.');
      return;
    }
    const a = res as Anreicherung;
    const brauchbar = a.legal_name || a.street || a.registration_number || a.vat_id || a.city;
    if (!brauchbar) {
      setNote('Auf der Website war kein Impressum mit verwertbaren Angaben zu finden. Bitte von Hand ergänzen.');
      return;
    }
    setVorschlag(a);
  };

  // Sobald eine Firmen-Domain bekannt ist, einmal im Hintergrund versuchen.
  useEffect(() => {
    if (versucht.current || !domain || FREEMAIL.test(domain)) return;
    if (werte.company_street && werte.company_registration_number) return; // schon vollständig
    versucht.current = true;
    void holen(domain);
  }, [domain]);

  const uebernehmen = () => {
    if (!vorschlag) return;
    const a = vorschlag;
    const patch: Partial<CompanyDraft> = {};
    // Nur leere Felder fuellen -- eine Kundeneingabe wird nie ueberschrieben.
    if (a.legal_name && !werte.company_legal_name) patch.company_legal_name = a.legal_name;
    if (a.street && !werte.company_street) patch.company_street = a.street;
    if (a.postal_code && !werte.company_postal_code) patch.company_postal_code = a.postal_code;
    if (a.city && !werte.company_city) patch.company_city = a.city;
    if (a.registration_number && !werte.company_registration_number) patch.company_registration_number = a.registration_number;
    if (a.vat_id && !werte.company_vat_id) patch.company_vat_id = a.vat_id;
    if (a.industry && !werte.company_industry) patch.company_industry = a.industry;
    onChange(patch);
    setVorschlag(null);
  };

  const feld = (k: keyof CompanyDraft, ph: string, cls = '') => (
    <Input
      value={werte[k] ?? ''}
      onChange={(e) => onChange({ [k]: e.target.value } as Partial<CompanyDraft>)}
      placeholder={ph}
      className={`h-8 text-xs ${cls}`}
    />
  );

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Ihr Unternehmen
          </p>
          {busy ? (
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Wir lesen Ihre Website
            </span>
          ) : domain ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1 text-[11px] text-muted-foreground"
              onClick={() => holen(domain)}
            >
              <Sparkles className="h-3 w-3" /> Daten ergänzen
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Aus Ihrer Anzeige gelesen — bitte prüfen. Diese Angaben stehen später auf der Vereinbarung.
        </p>
      </div>

      <div className="space-y-2 p-4">
        <div className="grid grid-cols-2 gap-2">
          {feld('company_name', 'Firmenname')}
          {feld('company_legal_name', 'Vollständige Firmierung')}
          {feld('company_website', 'https://…')}
          {feld('company_industry', 'Branche des Unternehmens')}
        </div>
        <div className="grid grid-cols-[2fr_1fr_2fr] gap-2">
          {feld('company_street', 'Straße und Hausnummer')}
          {feld('company_postal_code', 'PLZ')}
          {feld('company_city', 'Ort')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {feld('company_registration_number', 'Handelsregister')}
          {feld('company_vat_id', 'USt-IdNr.')}
        </div>

        {note && <p className="text-[11px] text-amber-600">{note}</p>}

        {vorschlag && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Sparkles className="h-2.5 w-2.5 text-primary" /> aus Ihrem Impressum gelesen
              </Badge>
            </div>
            <ul className="mb-2.5 space-y-0.5 text-xs">
              {vorschlag.legal_name && <li><span className="text-muted-foreground">Firmierung:</span> {vorschlag.legal_name}</li>}
              {(vorschlag.street || vorschlag.city) && (
                <li>
                  <span className="text-muted-foreground">Adresse:</span>{' '}
                  {[vorschlag.street, [vorschlag.postal_code, vorschlag.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                </li>
              )}
              {vorschlag.registration_number && <li><span className="text-muted-foreground">Handelsregister:</span> {vorschlag.registration_number}</li>}
              {vorschlag.vat_id && <li><span className="text-muted-foreground">USt-IdNr.:</span> {vorschlag.vat_id}</li>}
              {vorschlag.industry && <li><span className="text-muted-foreground">Branche:</span> {vorschlag.industry}</li>}
              {vorschlag.headcount ? <li><span className="text-muted-foreground">Mitarbeitende:</span> {vorschlag.headcount}</li> : null}
            </ul>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 gap-1 text-xs" onClick={uebernehmen}>
                <Check className="h-3 w-3" /> Stimmt, übernehmen
              </Button>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => setVorschlag(null)}>
                <X className="h-3 w-3" /> Verwerfen
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
