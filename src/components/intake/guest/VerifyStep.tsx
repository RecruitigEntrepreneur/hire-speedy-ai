import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { M3Hinweis, M3Kopf, M3Liste } from './m3';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { CheckCircle2, Loader2, Mail, TriangleAlert } from 'lucide-react';
import { isFailure, type GuestDraft } from '@/hooks/useGuestIntake';
import { isFreemailAddress, isPlausibleEmail } from '@/lib/domain';

/**
 * Nachweis der Geschäfts-E-Mail per sechsstelligem Code.
 *
 * Bewusst ein Code und kein Magic Link: Mails landen häufig auf dem Telefon,
 * die Aufnahme läuft am Rechner. Ein Link erzwingt den Gerätewechsel und
 * verliert dabei den halbfertigen Zustand; ein Code wird abgetippt.
 *
 * Seit 26.11.2026 (Marko, Variante A „nur E-Mail“) hat der Schritt ein eigenes
 * Feld für die Adresse; Name und Firma fragt weiter der Kontakt-Schritt. Seit
 * 27.11.2026 steht er VOR DEN FRAGEN: Art wählen, die Stelle hineingeben (Anzeige
 * ablegen oder „Worum geht es?“), dann die E-Mail -- bei „Jemand anderes kennt
 * sie besser“ vor dem Einladen. CaptureStep zeigt ihn an dieser Stelle. Nach der
 * Bestätigung liest er das Impressum der Firmendomain und schlägt Firma und
 * Anschrift vor.
 */

type Anreicherung = {
  legal_name?: string; street?: string; postal_code?: string; city?: string;
  registration_number?: string; vat_id?: string;
};

interface Props {
  draft: GuestDraft;
  /** Die gewählte Art der Besetzung als Ortszeile, mit „ändern“ zurück zur Wahl (nur am Anfang). */
  art?: { label: string; onChange: () => void } | null;
  /** Öffentlicher Link: private Adressen werden abgewiesen (Regel des Servers, hier schon vorab gesagt). */
  freemailBlocked?: boolean;
  onSend: (email: string) => Promise<any>;
  onConfirm: (code: string) => Promise<any>;
  onVerified: (knownCompany: { name: string } | null) => void;
  /** Am Anfang: nach der Bestätigung Firma aus dem Impressum vorschlagen. */
  mitFirma?: boolean;
  onEnrich?: (domain?: string) => Promise<Anreicherung | { reason: string; message: string }>;
  onCompany?: (patch: Record<string, string>) => void;
  /** Eingeladene Kollegin: die Adresse steht fest (aus der Einladung), ohne „Adresse ändern“. */
  festeAdresse?: string | null;
  /** Bestätigt ist hier ihr Zugang, nicht der Ansprechpartner. */
  bestaetigt?: boolean;
  titel?: string;
  ortText?: ReactNode;
  /** Was inzwischen läuft, z. B. „Ihre Anzeige wird gelesen …“. */
  status?: ReactNode;
  /** Beschriftung nach der Bestätigung, z. B. „Weiter zu den Fragen“. */
  weiterLabel?: string;
}

export function VerifyStep({ draft, art, freemailBlocked, onSend, onConfirm, onVerified, mitFirma, onEnrich, onCompany, festeAdresse, bestaetigt, titel, ortText, status, weiterLabel }: Props) {
  const { t } = useTranslation('clientFunnel');
  const bold = { bold: <strong className="text-foreground" /> };
  const alreadyVerified = bestaetigt ?? draft.states.identity === 'email_verified';

  // Die Adresse lebt hier, bis der Code bestätigt ist; erst dann schreibt der Server sie in den Entwurf.
  const [adresse, setAdresse] = useState(festeAdresse ?? draft.contact_email ?? '');
  const [bearbeiten, setBearbeiten] = useState(!festeAdresse && !draft.contact_email);
  const sauber = adresse.trim().toLowerCase();
  const ungueltig = Boolean(sauber) && !isPlausibleEmail(sauber);
  const privat = Boolean(sauber) && isPlausibleEmail(sauber) && isFreemailAddress(sauber);
  const privatAbgewiesen = privat && !!freemailBlocked;

  /**
   * BEFUND (09.09.2026): `sent` war reiner lokaler Zustand, und das
   * Eingabefeld hing daran. Wer den Tab neu lud, das Geraet wechselte oder
   * dessen Versand an der Sperre scheiterte, sah nur noch "Code senden" --
   * mit einem gueltigen Code im Postfach und ohne Feld, um ihn einzutippen.
   *
   * Das Feld steht deshalb, sobald eine Adresse da ist. Ohne Adresse holt
   * „Schon einen Code erhalten?“ es hervor.
   */
  const [sent, setSent] = useState(false);
  const [zeigeCode, setZeigeCode] = useState(Boolean(festeAdresse ?? draft.contact_email));
  const [masked, setMasked] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [fertig, setFertig] = useState<{ known: { name: string } | null } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (!sauber || ungueltig || privatAbgewiesen) return;
    setBusy(true);
    setError(null);
    const res = await onSend(sauber);
    setBusy(false);
    if (isFailure(res)) { setError(res.message); return; }
    setSent(true);
    setBearbeiten(false);
    setZeigeCode(true);
    setMasked(res.masked_email ?? sauber);
    setCooldown(60);
  };

  const confirm = async (value: string) => {
    setBusy(true);
    setError(null);
    const res = await onConfirm(value);
    setBusy(false);
    if (isFailure(res)) {
      setError(res.message);
      setCode('');
      return;
    }
    const known = res.known_company ?? null;
    // Kommt die Bestätigung erst nach dem Kontakt (älterer Entwurf), geht es ohne Zwischenblatt weiter.
    if (!mitFirma) { onVerified(known); return; }
    setFertig({ known });
  };

  // ---- Nach der Bestätigung: Firma aus dem Impressum --------------------------
  const domain = (fertig || alreadyVerified) ? domainAus(draft.contact_email ?? sauber) : '';
  const anschriftLeer = ['company_street', 'company_postal_code', 'company_city']
    .every((k) => !String((draft as unknown as Record<string, unknown>)[k] ?? '').trim());
  const [impressum, setImpressum] = useState<
    { stand: 'aus' } | { stand: 'laeuft' } | { stand: 'nichts' } | { stand: 'gefunden'; daten: Anreicherung }
  >({ stand: 'aus' });
  const gesucht = useRef(false);
  useEffect(() => {
    if (!fertig || gesucht.current || !onEnrich || !domain || !anschriftLeer) return;
    gesucht.current = true;
    setImpressum({ stand: 'laeuft' });
    void onEnrich(domain).then((res) => {
      if (isFailure(res)) { setImpressum({ stand: 'nichts' }); return; }
      const d = res as Anreicherung;
      const hatEtwas = [d.legal_name, d.street, d.city].some((x) => String(x ?? '').trim());
      setImpressum(hatEtwas ? { stand: 'gefunden', daten: d } : { stand: 'nichts' });
    });
  }, [fertig, onEnrich, domain, anschriftLeer]);

  const uebernehmen = (d: Anreicherung) => {
    const patch: Record<string, string> = {};
    const setz = (key: string, v?: string) => { if (String(v ?? '').trim()) patch[key] = String(v).trim(); };
    if (!String(draft.company_name ?? '').trim()) setz('company_name', d.legal_name);
    setz('company_legal_name', d.legal_name);
    setz('company_street', d.street);
    setz('company_postal_code', d.postal_code);
    setz('company_city', d.city);
    setz('company_registration_number', d.registration_number);
    setz('company_vat_id', d.vat_id);
    if (domain && !String(draft.company_website ?? '').trim()) patch.company_website = domain;
    onCompany?.(patch);
  };

  if (fertig || alreadyVerified) {
    const known = fertig?.known ?? null;
    return (
      <div>
        {status && <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">{status}</p>}
        {/* Grau statt Grün: bestätigt ist eine Adresse, unterschrieben ist noch nichts. */}
        <M3Kopf icon={CheckCircle2} titel={t('verify.doneTitle')} lead={fertig ? t('verify.doneLead') : (draft.contact_email ?? '')} />
        {known && <M3Hinweis className="mb-4">{t('flow.knownCompany', { name: known.name })}</M3Hinweis>}
        {impressum.stand === 'laeuft' && (
          <p className="mb-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('verify.searching', { domain })}
          </p>
        )}
        {impressum.stand === 'gefunden' ? (
          <>
            <p className="mb-2 text-center text-sm text-muted-foreground">{t('verify.foundIn', { domain })}</p>
            <M3Liste zeilen={[
              ...(impressum.daten.legal_name ? [[t('verify.companyRow'), impressum.daten.legal_name] as [string, string]] : []),
              ...([impressum.daten.street, [impressum.daten.postal_code, impressum.daten.city].filter(Boolean).join(' ')].filter(Boolean).length
                ? [[t('verify.addressRow'), [impressum.daten.street, [impressum.daten.postal_code, impressum.daten.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')] as [string, string]]
                : []),
              ...(impressum.daten.registration_number ? [[t('verify.registerRow'), impressum.daten.registration_number] as [string, string]] : []),
            ]} />
            <Button size="lg" className="mt-6 w-full rounded-full" onClick={() => { uebernehmen(impressum.daten); onVerified(known); }}>
              {weiterLabel ? t('verify.stimmtWeiter') : t('verify.confirmCompany')}
            </Button>
            <button type="button" className="mx-auto mt-3 block text-sm font-medium text-klick hover:underline" onClick={() => onVerified(known)}>
              {t('verify.otherCompany')}
            </button>
          </>
        ) : (
          <Button size="lg" className="w-full rounded-full" onClick={() => onVerified(known)}>{weiterLabel ?? t('verify.toPosition')}</Button>
        )}
      </div>
    );
  }

  const ort = art ? (
    <>{art.label} · <button type="button" onClick={art.onChange} className="text-klick hover:underline">{t('verify.changeKind')}</button></>
  ) : ortText;

  return (
    /* Stil M3 (26.11.2026): Kopf mittig, ein Feld, graue Kästchen, Links darunter. */
    <div>
      {status && <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">{status}</p>}
      <M3Kopf
        icon={Mail}
        ort={ort}
        titel={sent ? t('verify.enterCodeTitle') : titel ?? (mitFirma ? t('verify.startTitle') : t('verify.title'))}
        lead={sent
          ? <Trans t={t} i18nKey="verify.sent" values={{ email: masked }} components={bold} />
          : bearbeiten ? (mitFirma ? t('verify.startLead') : undefined)
          : <Trans t={t} i18nKey="verify.willSend" values={{ email: sauber }} components={bold} />}
      />

      <div className="space-y-4">
        {bearbeiten && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <div>
              <Label htmlFor="verify-email" className="text-xs text-muted-foreground">{t('common.businessEmail')}</Label>
              <Input
                id="verify-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                value={adresse}
                onChange={(e) => { setAdresse(e.target.value); setError(null); }}
                placeholder={t('common.emailPlaceholder')}
                className="mt-1.5 h-11"
                aria-invalid={ungueltig || privatAbgewiesen || undefined}
              />
              {privatAbgewiesen && <p className="mt-1.5 text-xs font-medium">{t('verify.freemailHint')}</p>}
              {ungueltig && <p className="mt-1.5 text-xs font-medium">{t('contact.emailInvalid')}</p>}
            </div>
            <Button type="submit" size="lg" disabled={busy || !sauber || ungueltig || privatAbgewiesen} className="w-full gap-2 rounded-full">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('verify.sendCode')}
            </Button>
          </form>
        )}

        {!bearbeiten && !sent && (
          <Button size="lg" onClick={() => void send()} disabled={busy || !sauber} className="w-full gap-2 rounded-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('verify.sendCode')}
          </Button>
        )}

        {zeigeCode ? (
          <>
            {!sent && (
              /* Ohne diesen Satz steht unten ein Feld ohne Anlass. Mit ihm
                 weiss der Kunde, dass ein aelterer Code hier hingehoert. */
              <p className="text-center text-xs text-muted-foreground">{t('verify.haveCode')}</p>
            )}
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                autoFocus={sent}
                onChange={(v) => {
                  setCode(v);
                  setError(null);
                  if (v.length === 6) void confirm(v);
                }}
                disabled={busy}
              >
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
          </>
        ) : (
          <button type="button" className="mx-auto block text-xs font-medium text-klick hover:underline" onClick={() => setZeigeCode(true)}>
            {t('verify.haveCode')}
          </button>
        )}

        {busy && zeigeCode && (
          <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.checking')}
          </p>
        )}

        {!bearbeiten && (
          <div className="flex items-center justify-between text-sm">
            {festeAdresse ? <span /> : (
              <button type="button" onClick={() => { setBearbeiten(true); setSent(false); setCode(''); setError(null); }} className="font-medium text-klick hover:underline">
                {t('verify.changeAddress')}
              </button>
            )}
            {sent && (
              <button
                type="button"
                onClick={() => void send()}
                disabled={cooldown > 0 || busy}
                className="font-medium text-klick hover:underline disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
              >
                {cooldown > 0 ? t('verify.resendIn', { seconds: cooldown }) : t('verify.resend')}
              </button>
            )}
          </div>
        )}

        {error && <M3Hinweis icon={TriangleAlert}>{error}</M3Hinweis>}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
        {sent || !bearbeiten ? t('verify.validity') : (
          <>{t('verify.privacyLine')} <a href="/datenschutz" target="_blank" rel="noreferrer" className="hover:text-foreground">{t('verify.privacyLink')}</a></>
        )}
      </p>
    </div>
  );
}

/** Firmendomain aus der Adresse; private Postfächer haben keine. */
function domainAus(email: string): string {
  const e = email.trim().toLowerCase();
  if (!e.includes('@') || !isPlausibleEmail(e) || isFreemailAddress(e)) return '';
  return e.split('@')[1];
}
