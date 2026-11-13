import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isFreemailAddress, isPlausibleEmail } from '@/lib/domain';
import { Info, Building2, User, ArrowRight, Check, Loader2 } from 'lucide-react';
import { isFailure, type GuestDraft } from '@/hooks/useGuestIntake';
import {
  fehlendeFirmenangaben, hatRechtsform,
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

export function ContactStep({ draft, freemailBlocked, onChange, onNext, onEnrich }: Props) {
  const { t } = useTranslation('clientFunnel');
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
        <h2 className="text-xl font-bold tracking-tight">{t('contact.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('contact.lead')}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" /> {t('contact.person')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('contact_name', t('contact.name'), { required: true, placeholder: t('common.namePlaceholder') })}
            {field('contact_role', t('contact.role'), { placeholder: t('contact.rolePlaceholder') })}
            <div className="sm:col-span-2">
              <Label htmlFor="contact_email" className="text-xs text-muted-foreground">
                {t('common.businessEmail')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contact_email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                placeholder={t('common.emailPlaceholder')}
                onChange={(e) => update('contact_email', e.target.value)}
                onBlur={nachEmail}
                className="mt-1"
                aria-invalid={emailInvalid || freemailRejected || undefined}
              />
              {emailInvalid && (
                <p className="mt-1 text-[11px] text-destructive">{t('contact.emailInvalid')}</p>
              )}
              {freemailRejected && (
                <p className="mt-1 text-[11px] text-destructive">
                  {t('contact.freemailRejected')}
                </p>
              )}
              {freemail && !freemailRejected && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('contact.freemailHint')}
                </p>
              )}
              {!emailInvalid && !freemail && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t('contact.codeHint')}
                </p>
              )}
            </div>
            {field('contact_phone', t('contact.phone'), { placeholder: t('contact.phonePlaceholder') })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> {t('contact.company')}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('company_name', t('contact.companyName'), {
              required: true, placeholder: t('contact.companyNamePlaceholder'),
              hint: rechtsformImNamen ? t('contact.legalFormDetected') : undefined,
            })}
            {field('company_legal_name', t('contact.legalName'), {
              required: !rechtsformImNamen,
              placeholder: rechtsformImNamen ? String(values.company_name) : t('contact.legalNamePlaceholder'),
              hint: t('contact.legalNameHint'),
            })}
            {field('company_website', t('contact.website'), {
              placeholder: t('contact.websitePlaceholder'),
              hint: domain && values.company_website === domain ? t('contact.websiteFromEmail') : undefined,
            })}
            {field('company_industry', t('contact.industry'), { placeholder: t('contact.industryPlaceholder') })}

            {impressum.stand === 'laeuft' && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('contact.imprintSearching', { domain })}
              </p>
            )}
            {impressum.stand === 'gefunden' && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm sm:col-span-2">
                <p className="text-xs text-emerald-600">{t('contact.imprintFound', { domain })}</p>
                {impressum.daten.legal_name && <p className="mt-1 font-medium">{impressum.daten.legal_name}</p>}
                <p className="text-muted-foreground">
                  {[impressum.daten.street, [impressum.daten.postal_code, impressum.daten.city].filter(Boolean).join(' ')]
                    .filter(Boolean).join(', ')}
                </p>
                {(impressum.daten.registration_number || impressum.daten.vat_id) && (
                  <p className="text-xs text-muted-foreground">
                    {[impressum.daten.registration_number, impressum.daten.vat_id ? t('contact.vatWithId', { id: impressum.daten.vat_id }) : '']
                      .filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    onClick={() => impressum.stand === 'gefunden' && uebernehmen(impressum.daten)}>
                    <Check className="h-3.5 w-3.5" /> {t('contact.imprintAccept')}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setImpressum({ stand: 'aus' })}>
                    {t('contact.imprintManual')}
                  </Button>
                </div>
              </div>
            )}
            {impressum.stand === 'nichts' && anschriftLeer && (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                {t('contact.imprintNotFound')}
              </p>
            )}

            {field('company_street', t('contact.street'), { required: true, span: true, placeholder: t('contact.streetPlaceholder') })}
            {field('company_postal_code', t('contact.postalCode'), { required: true })}
            {field('company_city', t('contact.city'), { required: true })}
            {field('company_vat_id', t('contact.vatId'), { placeholder: t('common.optional') })}
            {field('company_registration_number', t('contact.registration'), { placeholder: t('common.optional') })}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {t('contact.anonymityNote')}
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-end gap-3">
        {missing.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {t('common.missing', { fields: missing.map((k) => t(`fieldLabel.${k}`, { defaultValue: k })).join(', ') })}
          </span>
        )}
        <Button onClick={onNext} disabled={!canProceed} className="gap-2">
          {t('common.next')} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
