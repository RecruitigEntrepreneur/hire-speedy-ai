import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { isFreemailAddress, isPlausibleEmail } from '@/lib/domain';
import { Info, Building2, User, ArrowRight } from 'lucide-react';
import type { GuestDraft } from '@/hooks/useGuestIntake';

/**
 * Kontakt und Unternehmen.
 *
 * Zwei Blöcke statt eines langen Formulars: die Kontaktangaben brauchen wir,
 * um zu antworten, die Firmenangaben stehen später im Vertrag. Pflicht ist nur
 * das Nötigste — Rechtsform, Anschrift und USt-IdNr. lassen sich nachtragen,
 * und ein Pflichtfeld, das jemanden zum Nachschlagen zwingt, kostet an dieser
 * Stelle mehr, als es einbringt.
 */

interface Props {
  draft: GuestDraft;
  freemailBlocked: boolean;
  onChange: (patch: Record<string, unknown>) => void;
  onNext: () => void;
}

const REQUIRED = ['contact_name', 'contact_email', 'company_name'] as const;

export function ContactStep({ draft, freemailBlocked, onChange, onNext }: Props) {
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

  const missing = REQUIRED.filter((k) => !String(values[k] ?? '').trim());
  const canProceed = missing.length === 0 && !emailInvalid && !freemailRejected;

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
                onBlur={() => setTouched((t) => ({ ...t, contact_email: true }))}
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
            {field('company_name', 'Firmenname', { required: true, placeholder: 'wie er im Alltag verwendet wird' })}
            {field('company_legal_name', 'Rechtsform / vollständige Firmierung', {
              placeholder: 'z. B. Muster GmbH',
              hint: 'Steht so auf der Vereinbarung. Kann später ergänzt werden.',
            })}
            {field('company_website', 'Website', { placeholder: 'https://…' })}
            {field('company_industry', 'Branche', { placeholder: 'z. B. Maschinenbau' })}
            {field('company_street', 'Straße und Hausnummer', { span: true })}
            {field('company_postal_code', 'PLZ')}
            {field('company_city', 'Ort')}
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
            Es fehlt noch: {missing.map((k) => ({ contact_name: 'Name', contact_email: 'E-Mail', company_name: 'Firmenname' }[k])).join(', ')}
          </span>
        )}
        <Button onClick={onNext} disabled={!canProceed} className="gap-2">
          Weiter <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
