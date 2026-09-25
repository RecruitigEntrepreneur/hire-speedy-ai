import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isFreemailAddress, isPlausibleEmail } from '@/lib/domain';
import { Info, Building2, User, ArrowRight, Check, Loader2 } from 'lucide-react';
import { isFailure, type GuestDraft } from '@/hooks/useGuestIntake';
import {
  FIRMA_LABEL, fehlendeFirmenangaben, hatRechtsform,
} from '../../../../supabase/functions/_shared/firma-pflicht';

/**
 * Kontakt und Unternehmen.
 *
 * Zwei Blöcke statt eines langen Formulars: die Kontaktangaben brauchen wir,
 * um zu antworten, die Firmenangaben stehen später im Vertrag.
 *
 * Firmierung und Anschrift sind seit 25.09.2026 PFLICHT. Vorher hieß es hier
 * „kann später ergänzt werden“, während die Firmenprüfung ohne sie den Vertrag
 * anhielt -- der Kunde erfuhr davon nichts und konnte den Vertrag weder öffnen
 * noch weiterleiten (Live-Test mit ASMPT, 24.09.2026). Damit das nicht zum
 * Nachschlagen zwingt, holt der Impressum-Leser die Anschrift von der Domain
 * der E-Mail-Adresse und schlägt sie vor; ein Firmenname mit Rechtsform zählt
 * als Firmierung (_shared/firma-pflicht.ts, dieselbe Regel wie die Prüfung).
 */

type Anreicherung = {
  legal_name?: string; street?: string; postal_code?: string; city?: string;
  registration_number?: string; vat_id?: string;
};

interface Props {
  draft: GuestDraft;
  freemailBlocked: boolean;
  onChange: (patch: Record<string, unknown>) => void;
  onNext: () => void;
  /** Impressum-Leser: Firmierung, Anschrift, Register von der Firmendomain. */
  onEnrich?: (domain?: string) => Promise<Anreicherung | { reason: string; message: string }>;
}

const REQUIRED = ['contact_name', 'contact_email', 'company_name'] as const;
const LABEL: Record<string, string> = {
  contact_name: 'Name', contact_email: 'E-Mail', company_name: 'Firmenname', ...FIRMA_LABEL,
};

export function ContactStep({ draft, freemailBlocked, onChange, onNext, onEnrich }: Props) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  /**
   * Eingaben leben lokal, nicht am gespeicherten Entwurf.
   *
   * Der Entwurf kommt erst nach dem gebündelten Autosave zurück (1,2 s nach der
   * letzten Eingabe). Hinge das Feld direkt daran, spränge es bei jedem
   * Tastenanschlag auf den vorigen Wert zurück — das Formular wäre unbenutzbar.
   * Der Entwurf bleibt die Wahrheit auf dem Server; hier steht die Wahrheit im
   * Feld, solange jemand tippt.
   */
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      [...REQUIRED, 'contact_role', 'contact_phone', 'company_legal_name', 'company_website',
       'company_industry', 'company_street', 'company_postal_code', 'company_city',
       'company_vat_id', 'company_registration_number']
        .map((k) => [k, String((draft as unknown as Record<string, unknown>)[k] ?? '')]),
    ),
  );

  // Wechselt der Entwurf (weitergeleiteter Zugang, anderer Token), wird neu
  // aufgesetzt — aber nicht bei jedem Autosave-Rücklauf.
  const seededFor = useRef(draft.id);
  useEffect(() => {
    if (seededFor.current === draft.id) return;
    seededFor.current = draft.id;
    setValues(
      Object.fromEntries(
        Object.keys(values).map((k) => [k, String((draft as unknown as Record<string, unknown>)[k] ?? '')]),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id]);

  const update = (key: string, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    onChange({ [key]: value });
  };

  const email = values.contact_email ?? '';
  const emailInvalid = Boolean(email) && !isPlausibleEmail(email);
  const freemail = Boolean(email) && isPlausibleEmail(email) && isFreemailAddress(email);
  const freemailRejected = freemail && freemailBlocked;

  const missing = [
    ...REQUIRED.filter((k) => !String(values[k] ?? '').trim()),
    ...(String(values.company_name ?? '').trim() ? fehlendeFirmenangaben(values) : []),
  ];
  const canProceed = missing.length === 0 && !emailInvalid && !freemailRejected;

  // ---- Die Firma aus der E-Mail-Adresse -----------------------------------
  const domain = !emailInvalid && !freemail && email.includes('@')
    ? email.split('@')[1].trim().toLowerCase() : '';
  const rechtsformImNamen = hatRechtsform(values.company_name) && !String(values.company_legal_name ?? '').trim();

  /** Eine Suche je Domain; der Kunde soll nicht zweimal gefragt werden. */
  const gesucht = useRef<string | null>(null);
  const [impressum, setImpressum] = useState<
    { stand: 'aus' } | { stand: 'laeuft' } | { stand: 'nichts' } | { stand: 'gefunden'; daten: Anreicherung }
  >({ stand: 'aus' });
  const anschriftLeer = ['company_street', 'company_postal_code', 'company_city']
    .every((k) => !String(values[k] ?? '').trim());

  const sucheImpressum = async () => {
    if (!onEnrich || !domain || gesucht.current === domain || !anschriftLeer) return;
    gesucht.current = domain;
    setImpressum({ stand: 'laeuft' });
    const res = await onEnrich(domain);
    if (isFailure(res)) { setImpressum({ stand: 'nichts' }); return; }
    const d = res as Anreicherung;
    const hatAnschrift = [d.street, d.postal_code, d.city].some((x) => String(x ?? '').trim());
    setImpressum(hatAnschrift ? { stand: 'gefunden', daten: d } : { stand: 'nichts' });
  };

  const uebernehmen = (d: Anreicherung) => {
    const patch: Record<string, string> = {};
    const setz = (key: string, v?: string) => { if (String(v ?? '').trim()) patch[key] = String(v).trim(); };
    setz('company_legal_name', d.legal_name);
    setz('company_street', d.street);
    setz('company_postal_code', d.postal_code);
    setz('company_city', d.city);
    setz('company_registration_number', d.registration_number);
    setz('company_vat_id', d.vat_id);
    setValues((v) => ({ ...v, ...patch }));
    onChange(patch);
    setImpressum({ stand: 'aus' });
  };

  /** Beim Verlassen des E-Mail-Felds: Website ableiten, Impressum lesen. */
  const nachEmail = () => {
    setTouched((t) => ({ ...t, contact_email: true }));
    if (!domain) return;
    if (!String(values.company_website ?? '').trim()) update('company_website', domain);
    void sucheImpressum();
  };

  // Kommt der Kunde mit schon eingetragener E-Mail zurück, gleich nachsehen.
  useEffect(() => {
    if (domain && anschriftLeer) void sucheImpressum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const field = (
    key: string,
    label: string,
    opts: { required?: boolean; type?: string; placeholder?: string; hint?: string; span?: boolean } = {},
  ) => {
    const value = values[key] ?? '';
    const showError = opts.required && touched[key] && !value.trim();
    return (
      <div className={opts.span ? 'sm:col-span-2' : undefined}>
        <Label htmlFor={key} className="text-xs text-muted-foreground">
          {label} {opts.required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          id={key}
          type={opts.type ?? 'text'}
          value={value}
          placeholder={opts.placeholder}
          onChange={(e) => update(key, e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
          className="mt-1"
          aria-invalid={showError || undefined}
        />
        {opts.hint && <p className="mt-1 text-[11px] text-muted-foreground">{opts.hint}</p>}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Wer sind Sie, und für wen suchen wir?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Diese Angaben brauchen wir, um Ihnen zu antworten und die Vereinbarung auszustellen.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" /> Ansprechpartner
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('contact_name', 'Name', { required: true, placeholder: 'Vor- und Nachname' })}
            {field('contact_role', 'Funktion', { placeholder: 'z. B. Geschäftsführung, HR-Leitung' })}
            <div className="sm:col-span-2">
              <Label htmlFor="contact_email" className="text-xs text-muted-foreground">
                Geschäftliche E-Mail-Adresse <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact_email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder="name@ihrunternehmen.de"
                onChange={(e) => update('contact_email', e.target.value)}
                onBlur={nachEmail}
                className="mt-1"
                aria-invalid={emailInvalid || freemailRejected || undefined}
              />
              {emailInvalid && (
                <p className="mt-1 text-[11px] text-destructive">Diese Adresse sieht nicht vollständig aus.</p>
              )}
              {freemailRejected && (
                <p className="mt-1 text-[11px] text-destructive">
                  Bitte eine geschäftliche Adresse — über eine private können wir das Unternehmen nicht zuordnen.
                </p>
              )}
              {freemail && !freemailRejected && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Eine Firmenadresse hilft uns, Ihr Unternehmen eindeutig zuzuordnen.
                </p>
              )}
              {!emailInvalid && !freemail && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Wir senden gleich einen sechsstelligen Code an diese Adresse.
                </p>
              )}
            </div>
            {field('contact_phone', 'Telefon', { placeholder: 'für Rückfragen, optional' })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Unternehmen
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('company_name', 'Firmenname', {
              required: true, placeholder: 'wie er im Alltag verwendet wird',
              hint: rechtsformImNamen ? 'Rechtsform erkannt — gilt als vollständige Firmierung.' : undefined,
            })}
            {field('company_legal_name', 'Vollständige Firmierung', {
              required: !rechtsformImNamen,
              placeholder: rechtsformImNamen ? String(values.company_name) : 'z. B. Muster GmbH',
              hint: 'Steht so auf der Vereinbarung.',
            })}
            {field('company_website', 'Website', {
              placeholder: 'https://…',
              hint: domain && values.company_website === domain ? 'Aus Ihrer E-Mail-Adresse.' : undefined,
            })}
            {field('company_industry', 'Branche', { placeholder: 'z. B. Maschinenbau' })}

            {impressum.stand === 'laeuft' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wir suchen die Anschrift im Impressum von {domain} …
              </p>
            )}
            {impressum.stand === 'gefunden' && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm sm:col-span-2">
                <p className="text-xs text-emerald-600">Gefunden im Impressum von {domain}</p>
                {impressum.daten.legal_name && <p className="mt-1 font-medium">{impressum.daten.legal_name}</p>}
                <p className="text-muted-foreground">
                  {[impressum.daten.street, [impressum.daten.postal_code, impressum.daten.city].filter(Boolean).join(' ')]
                    .filter(Boolean).join(', ')}
                </p>
                {(impressum.daten.registration_number || impressum.daten.vat_id) && (
                  <p className="text-xs text-muted-foreground">
                    {[impressum.daten.registration_number, impressum.daten.vat_id ? `USt-IdNr. ${impressum.daten.vat_id}` : '']
                      .filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    onClick={() => impressum.stand === 'gefunden' && uebernehmen(impressum.daten)}>
                    <Check className="h-3.5 w-3.5" /> Stimmt, übernehmen
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setImpressum({ stand: 'aus' })}>
                    Selbst eintragen
                  </Button>
                </div>
              </div>
            )}
            {impressum.stand === 'nichts' && anschriftLeer && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Wir konnten die Anschrift nicht automatisch finden. Bitte kurz eintragen.
              </p>
            )}

            {field('company_street', 'Straße und Hausnummer', { required: true, span: true, placeholder: 'für die Vereinbarung nötig' })}
            {field('company_postal_code', 'PLZ', { required: true })}
            {field('company_city', 'Ort', { required: true })}
            {field('company_vat_id', 'USt-IdNr.', { placeholder: 'optional' })}
            {field('company_registration_number', 'Handelsregister', { placeholder: 'optional' })}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Wir geben Ihren Firmennamen nicht an die Recruiter weiter. Sie sehen ein anonymes Profil
          Ihres Unternehmens; Ihre Identität wird erst zum vereinbarten Zeitpunkt freigegeben.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-end gap-3">
        {missing.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Es fehlt noch: {missing.map((k) => LABEL[k] ?? k).join(', ')}
          </span>
        )}
        <Button onClick={onNext} disabled={!canProceed} className="gap-2">
          Weiter <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
