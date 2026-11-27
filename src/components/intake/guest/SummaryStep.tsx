import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { M3Hinweis, M3Kopf, M3Liste, M3Zeile } from './m3';
import { CircleCheck, CircleHelp, ClipboardCheck, FileText, Loader2, TriangleAlert } from 'lucide-react';
import { isFailure, type GuestDraft, type PackageSummary } from '@/hooks/useGuestIntake';
import { fehlendeFirmenangaben, firmierungAus } from '../../../../supabase/functions/_shared/firma-pflicht';
import {
  CONTRACTING_BUDGET_HINWEIS, CONTRACTING_EINLEITUNG, CONTRACTING_OHNE_BUDGET, CONTRACTING_PUNKTE,
  CONTRACTING_SCHLUSS, CONTRACTING_ZUSTIMMUNG, budgetZeile,
} from '../../../../supabase/functions/_shared/contracting-konditionen';

/**
 * Prüfen und einreichen.
 *
 * Der Einwilligungskasten folgt dem Muster aus InterviewResponsePage.tsx:495-517
 * (Klartext, wer welche Daten bekommt; Schaltfläche erst aktiv mit Zustimmung)
 * — und die Zustimmung wird serverseitig ein zweites Mal erzwungen. Eine
 * Checkbox, auf die sich niemand verlässt, ist kein Nachweis.
 */

interface Props {
  draft: GuestDraft;
  packages: PackageSummary[] | null;
  /** Gesetzt, wenn schon ein Rahmenvertrag gilt: dann wird beauftragt statt
   *  angefragt, und es wird nichts mehr unterschrieben. */
  framework?: { agreement_number: string; fee_percent: number; name: string | null } | null;
  /** Gesetzt bei Contracting: keine Paketkarte, sondern die eine Kondition
   *  (Tagessatz, alles inklusive) mit dem Budget aus der Aufnahme. */
  contracting?: { dayRateMin: number | null; dayRateMax: number | null } | null;
  summary: { label: string; value: string }[];
  openQuestions: number;
  /** `signer`: wer den Vertrag unterschreibt. Steht hier, damit es danach ohne Zwischenseite weitergeht. */
  onSubmit: (signerName: string, signer: { self: boolean; name?: string; email?: string }) => Promise<any>;
  onForward: () => void;
  onBack: () => void;
  /** Firmenangaben ergänzen und sofort neu prüfen. */
  onRecheckCompany?: (patch: Record<string, unknown>) => Promise<any>;
  /** Entwurf neu holen, solange die Firmenprüfung noch läuft. */
  onRefreshDraft?: () => Promise<any>;
}

export function SummaryStep({ draft, packages, framework, contracting, summary, openQuestions, onSubmit, onForward, onBack, onRecheckCompany, onRefreshDraft }: Props) {
  const { t } = useTranslation('clientFunnel');
  // Wortlaut der Zustimmung in der Sprache des Kunden; deutsch zeichengleich mit consentText.ts.
  const consentLines = [t('summary.consent1'), t('summary.consent2'), t('summary.consent3')];
  const chosenPackage = packages?.find((p) => p.key === draft.selected_package_key) ?? null;
  const [signer, setSigner] = useState(draft.contact_name ?? '');
  const [consent, setConsent] = useState(false);
  const [selbst, setSelbst] = useState(true);
  const [andererName, setAndererName] = useState('');
  const [andereMail, setAndereMail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMissing([]);
    const res = await onSubmit(signer.trim(), selbst ? { self: true } : { self: false, name: andererName.trim(), email: andereMail.trim() });
    setBusy(false);
    if (isFailure(res)) {
      setError(res.message);
      setMissing(res.missing ?? []);
    }
  };

  // ---- Firmenangaben: keine Sackgasse mehr --------------------------------
  // Fehlt der Vereinbarung etwas zur Firma, steht es HIER, mit Feldern zum
  // Ergänzen -- vor dem Absenden, weil der Einzelauftrag die Firmendaten beim
  // Absenden einfriert. Vorher hielt die Prüfung den Vertrag erst danach an,
  // und der Kunde konnte ihn weder öffnen noch weiterleiten (Live-Test 24.09.2026).
  const firmaStand = draft.states.company;
  const fehltLokal = fehlendeFirmenangaben(draft);
  const [kritisch, setKritisch] = useState<string[]>([]);
  const [firma, setFirma] = useState(() => ({
    company_legal_name: firmierungAus(draft),
    company_street: draft.company_street ?? '',
    company_postal_code: draft.company_postal_code ?? '',
    company_city: draft.company_city ?? '',
    company_vat_id: draft.company_vat_id ?? '',
  }));
  const [pruefe, setPruefe] = useState(false);
  const [firmaFehler, setFirmaFehler] = useState<string | null>(null);
  const firmaOffen = firmaStand === 'failed' || fehltLokal.length > 0;
  const firmaLaeuft = firmaStand === 'checking' || firmaStand === 'not_checked';

  // Läuft die Prüfung noch (sie startet nach der E-Mail-Bestätigung im
  // Hintergrund), wird nachgefragt, bis ein Ergebnis da ist.
  const versuche = useRef(0);
  useEffect(() => {
    if (!firmaLaeuft || !onRefreshDraft || versuche.current >= 15) return;
    const t = window.setTimeout(() => { versuche.current += 1; void onRefreshDraft(); }, 3000);
    return () => window.clearTimeout(t);
  }, [firmaLaeuft, onRefreshDraft, draft]);

  const neuPruefen = async () => {
    if (!onRecheckCompany) return;
    setPruefe(true);
    setFirmaFehler(null);
    const res = await onRecheckCompany({
      company_legal_name: firma.company_legal_name.trim() || null,
      company_street: firma.company_street.trim() || null,
      company_postal_code: firma.company_postal_code.trim() || null,
      company_city: firma.company_city.trim() || null,
      company_vat_id: firma.company_vat_id.trim() || null,
    });
    setPruefe(false);
    if (isFailure(res)) { setFirmaFehler(res.message); return; }
    setKritisch(res.company?.state === 'failed' ? res.company.critical_fields ?? [] : []);
  };
  const ustFalsch = kritisch.includes('company_vat_id');

  // Ohne Rahmenvertrag folgt die Unterschrift. Steht er schon, wird die Position nur beauftragt.
  const fragtUnterzeichner = !framework;
  const andererOk = selbst || !fragtUnterzeichner || (andererName.trim().length >= 3 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(andereMail.trim()));
  const canSubmit = consent && signer.trim().length >= 3 && andererOk && !busy && !firmaOffen && !firmaLaeuft;

  // Stil M3 (26.11.2026): Kopf mittig, graue Liste, graue Hinweise, Wahl als graue Zeilen,
  // „Beauftragung anfragen“ blau über die volle Breite, Weiterleiten als Link darunter.
  return (
    <div className="space-y-5">
      <M3Kopf icon={ClipboardCheck} titel={contracting ? t('summary.titleRequest') : t('summary.titleOrder')} lead={t('summary.lead')} />

      <M3Liste zeilen={summary.map((row) => [row.label, <span className="font-medium">{row.value}</span>])} />

      {firmaLaeuft && !firmaOffen && (
        <M3Hinweis icon={Dreht}>
          {t('summary.companyChecking')}
          {versuche.current >= 15 && onRecheckCompany && (
            <> <button type="button" onClick={neuPruefen} className="font-medium text-klick hover:underline">{t('summary.checkNow')}</button></>
          )}
        </M3Hinweis>
      )}

      {firmaOffen && (
        <div className="space-y-3 rounded-[14px] bg-secondary p-4">
          <div>
            <p className="text-sm font-semibold">{t('summary.companyMissingTitle')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('summary.companyMissingText')}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {([
              ['company_legal_name', t('contact.legalName'), true],
              ['company_street', t('contact.street'), true],
              ['company_postal_code', t('contact.postalCode'), false],
              ['company_city', t('contact.city'), false],
            ] as const).map(([key, label, span]) => (
              <div key={key} className={span ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`firma-${key}`} className="text-xs text-muted-foreground">
                  {label} <span className="text-muted-foreground">*</span>
                </Label>
                <Input
                  id={`firma-${key}`}
                  value={firma[key]}
                  onChange={(e) => setFirma((f) => ({ ...f, [key]: e.target.value }))}
                  aria-invalid={(!firma[key].trim() || kritisch.includes(key)) || undefined}
                  className="mk3-feld-hell mt-1.5 h-11"
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Label htmlFor="firma-company_vat_id" className="text-xs text-muted-foreground">{t('summary.vatOptional')}</Label>
              <Input
                id="firma-company_vat_id"
                value={firma.company_vat_id}
                onChange={(e) => setFirma((f) => ({ ...f, company_vat_id: e.target.value }))}
                aria-invalid={ustFalsch || undefined}
                placeholder={t('summary.vatPlaceholder')}
                className="mk3-feld-hell mt-1.5 h-11"
              />
              {ustFalsch && <p className="mt-1 text-[11px] font-medium">{t('summary.vatInvalid')}</p>}
            </div>
          </div>
          {kritisch.filter((k) => k !== 'company_vat_id').length > 0 && (
            <p className="text-xs font-medium">
              {t('common.missing', {
                fields: kritisch.filter((k) => k !== 'company_vat_id').map((k) => t(`fieldLabel.${k}`, { defaultValue: k })).join(', '),
              })}
            </p>
          )}
          {firmaFehler && <p className="text-xs font-medium">{firmaFehler}</p>}
          <Button size="lg" onClick={neuPruefen} disabled={pruefe || !onRecheckCompany} className="w-full gap-2 rounded-full">
            {pruefe && <Loader2 className="h-4 w-4 animate-spin" />} {t('summary.saveAndRecheck')}
          </Button>
        </div>
      )}

      {openQuestions > 0 && (
        <M3Hinweis icon={CircleHelp}>
          {t('summary.openQuestions', { count: openQuestions })}{' '}
          <button type="button" onClick={onBack} className="font-medium text-klick hover:underline">{t('summary.backToCapture')}</button>
        </M3Hinweis>
      )}

      {/* Das gewaehlte Paket, nicht die ganze Liste: hier steht, was der Kunde
          gleich anfragt. */}
      {contracting && <ContractingKarte budget={contracting} />}

      {!contracting && chosenPackage && (
        <div className="rounded-[14px] bg-secondary p-4 text-sm">
          <p className="font-medium">{t('summary.packageBadge', { name: chosenPackage.name, percent: chosenPackage.fee_percent })}</p>
          <span className="text-muted-foreground">
            {chosenPackage.continuity_days
              ? t('summary.packageTermsContinuity', { days: chosenPackage.payment_terms_days, continuity: chosenPackage.continuity_days })
              : t('summary.packageTerms', { days: chosenPackage.payment_terms_days })}
          </span>
        </div>
      )}

      <div className="space-y-4 border-t pt-5">
        <div>
          <Label htmlFor="signer" className="text-xs text-muted-foreground">
            {t('summary.signerLabel')} <span className="text-muted-foreground">*</span>
          </Label>
          <Input
            id="signer"
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder={t('common.namePlaceholder')}
            className="mt-1.5 h-11"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('summary.signerHint')}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-[14px] bg-secondary p-4">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            className="mt-0.5"
            aria-describedby="consent-text"
          />
          <span id="consent-text" className="space-y-1.5 text-xs leading-relaxed text-foreground/90">
            {contracting
              ? <span className="block">{CONTRACTING_ZUSTIMMUNG}</span>
              : consentLines.map((line) => <span key={line} className="block">{line}</span>)}
          </span>
        </label>

        {fragtUnterzeichner && (
          <fieldset className="space-y-2.5">
            <legend className="mb-2 text-sm font-medium">{t('signerChoice.question')}</legend>
            <M3Zeile
              gewaehlt={selbst}
              onClick={() => setSelbst(true)}
              titel={signer.trim() ? t('signerChoice.selfName', { name: signer.trim() }) : t('signerChoice.self')}
              text={t('signerChoice.selfText')}
            />
            <M3Zeile
              gewaehlt={!selbst}
              onClick={() => setSelbst(false)}
              titel={t('signerChoice.other')}
              text={t('signerChoice.otherText')}
            />
            {!selbst && (
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <div>
                  <Label htmlFor="anderer-name" className="text-xs text-muted-foreground">{t('signerChoice.name')}</Label>
                  <Input id="anderer-name" value={andererName} onChange={(e) => setAndererName(e.target.value)} placeholder={t('signerChoice.namePlaceholder')} className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label htmlFor="andere-mail" className="text-xs text-muted-foreground">{t('signerChoice.email')}</Label>
                  <Input id="andere-mail" type="email" value={andereMail} onChange={(e) => setAndereMail(e.target.value)} placeholder={t('signerChoice.emailPlaceholder')} className="mt-1.5 h-11" />
                </div>
              </div>
            )}
          </fieldset>
        )}

        {error && (
          <M3Hinweis icon={TriangleAlert}>
            {error}
            {missing.length > 0 && (
              <ul className="mt-1.5 list-inside list-disc">
                {missing.map((m) => <li key={m}>{m}</li>)}
              </ul>
            )}
          </M3Hinweis>
        )}

        <div className="space-y-3 pt-1 text-center">
          <Button size="lg" onClick={submit} disabled={!canSubmit} className="w-full gap-2 rounded-full">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {framework && !contracting ? t('summary.order') : t('summary.request')}
          </Button>
          <button type="button" onClick={onForward} className="text-sm font-medium text-klick hover:underline">{t('summary.forward')}</button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {contracting
              ? t('summary.noteContracting')
              : framework
              ? t('summary.noteFramework', { number: framework.agreement_number, percent: framework.fee_percent })
              : t('summary.noteRequest')}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Drehendes Symbol, solange die Firmenprüfung läuft. */
function Dreht({ className }: { className?: string }) {
  return <Loader2 className={cn(className, 'animate-spin')} />;
}

/** Die Konditionen für Contracting. Der Text lebt in _shared/contracting-konditionen.ts,
 *  damit Seite, Eingangsbestätigung und Nachweis dasselbe sagen. Die Aufteilung
 *  des Tagessatzes steht hier bewusst NICHT (Entscheidung 25.09.2026). */
export function ContractingKarte({ budget }: { budget: { dayRateMin: number | null; dayRateMax: number | null } }) {
  const { t } = useTranslation('clientFunnel');
  // Die Texte darunter (CONTRACTING_*) kommen aus _shared/contracting-konditionen.ts: derselbe
  // Wortlaut wie Eingangsbestätigung und Nachweis, deshalb vorerst nur deutsch.
  const zeile = budgetZeile(budget.dayRateMin, budget.dayRateMax);
  return (
    <Card className="border-primary/25">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('summary.contractingTitle')}</p>
        </div>
        <p className="text-sm text-muted-foreground">{CONTRACTING_EINLEITUNG}</p>

        <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-3">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">{zeile ?? CONTRACTING_OHNE_BUDGET}</p>
            {zeile && <p className="mt-0.5 text-xs text-muted-foreground">{CONTRACTING_BUDGET_HINWEIS}</p>}
          </div>
        </div>

        <dl className="space-y-2 text-sm">
          {CONTRACTING_PUNKTE.map((p) => (
            <div key={p.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="w-36 shrink-0 text-muted-foreground">{p.label}</dt>
              <dd>{p.text}</dd>
            </div>
          ))}
        </dl>
        <p className="border-t pt-3 text-xs text-muted-foreground">{CONTRACTING_SCHLUSS}</p>
      </CardContent>
    </Card>
  );
}
