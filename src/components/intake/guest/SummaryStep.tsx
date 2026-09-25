import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Send, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { CONSENT_TEXT } from './consentText';
import { isFailure, type GuestDraft, type PackageSummary } from '@/hooks/useGuestIntake';
import { FIRMA_LABEL, fehlendeFirmenangaben, firmierungAus } from '../../../../supabase/functions/_shared/firma-pflicht';
import {
  ANTEIL_MATCHUNT, ANTEIL_SPEZIALIST, CONTRACTING_EINLEITUNG, CONTRACTING_PUNKTE, CONTRACTING_SCHLUSS,
  CONTRACTING_ZUSTIMMUNG, aufteilungAusBudget,
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
   *  (Tagessatz, 78/22), gerechnet aus dem Budget der Aufnahme. */
  contracting?: { dayRateMin: number | null; dayRateMax: number | null } | null;
  summary: { label: string; value: string }[];
  openQuestions: number;
  onSubmit: (signerName: string) => Promise<any>;
  onForward: () => void;
  onBack: () => void;
  /** Firmenangaben ergänzen und sofort neu prüfen. */
  onRecheckCompany?: (patch: Record<string, unknown>) => Promise<any>;
  /** Entwurf neu holen, solange die Firmenprüfung noch läuft. */
  onRefreshDraft?: () => Promise<any>;
}

export function SummaryStep({ draft, packages, framework, contracting, summary, openQuestions, onSubmit, onForward, onBack, onRecheckCompany, onRefreshDraft }: Props) {
  const chosenPackage = packages?.find((p) => p.key === draft.selected_package_key) ?? null;
  const [signer, setSigner] = useState(draft.contact_name ?? '');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMissing([]);
    const res = await onSubmit(signer.trim());
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

  const canSubmit = consent && signer.trim().length >= 3 && !busy && !firmaOffen && !firmaLaeuft;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{contracting ? 'Prüfen und anfragen' : 'Prüfen und beauftragen'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Das ist der Stand, den unsere Recruiter bekommen — ohne Ihren Firmennamen.
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <dl className="space-y-2.5 text-sm">
            {summary.map((row) => (
              <div key={row.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-44 shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {firmaLaeuft && !firmaOffen && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            Wir prüfen gerade Ihre Firmenangaben — das dauert meist nur wenige Sekunden.
            {versuche.current >= 15 && onRecheckCompany && (
              <button type="button" onClick={neuPruefen} className="underline underline-offset-2">Jetzt prüfen</button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {firmaOffen && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="space-y-3 p-5">
            <div>
              <p className="text-sm font-semibold">Für die Vereinbarung fehlt noch etwas zu Ihrer Firma</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ohne vollständige Firmierung und Anschrift können wir keinen Vertrag ausstellen.
                Ergänzen Sie die Angaben hier, dann geht es gleich weiter.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['company_legal_name', 'Vollständige Firmierung', true],
                ['company_street', 'Straße und Hausnummer', true],
                ['company_postal_code', 'PLZ', false],
                ['company_city', 'Ort', false],
              ] as const).map(([key, label, span]) => (
                <div key={key} className={span ? 'sm:col-span-2' : undefined}>
                  <Label htmlFor={`firma-${key}`} className="text-xs text-muted-foreground">
                    {label} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`firma-${key}`}
                    value={firma[key]}
                    onChange={(e) => setFirma((f) => ({ ...f, [key]: e.target.value }))}
                    aria-invalid={(!firma[key].trim() || kritisch.includes(key)) || undefined}
                    className="mt-1 bg-background"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <Label htmlFor="firma-company_vat_id" className="text-xs text-muted-foreground">USt-IdNr. (optional)</Label>
                <Input
                  id="firma-company_vat_id"
                  value={firma.company_vat_id}
                  onChange={(e) => setFirma((f) => ({ ...f, company_vat_id: e.target.value }))}
                  aria-invalid={ustFalsch || undefined}
                  placeholder="z. B. DE123456789"
                  className="mt-1 bg-background"
                />
                {ustFalsch && (
                  <p className="mt-1 text-[11px] text-destructive">
                    Die USt-IdNr. passt nicht zum üblichen Format. Korrigieren Sie sie oder lassen Sie das Feld leer.
                  </p>
                )}
              </div>
            </div>
            {kritisch.filter((k) => k !== 'company_vat_id').length > 0 && (
              <p className="text-xs text-destructive">
                Es fehlt noch: {kritisch.filter((k) => k !== 'company_vat_id').map((k) => FIRMA_LABEL[k] ?? k).join(', ')}
              </p>
            )}
            {firmaFehler && <p className="text-xs text-destructive">{firmaFehler}</p>}
            <Button onClick={neuPruefen} disabled={pruefe || !onRecheckCompany} className="gap-2">
              {pruefe && <Loader2 className="h-4 w-4 animate-spin" />} Speichern und neu prüfen
            </Button>
          </CardContent>
        </Card>
      )}

      {openQuestions > 0 && (
        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {openQuestions === 1 ? 'Eine Frage ist' : `${openQuestions} Fragen sind`} noch offen. Sie können
            trotzdem einreichen — je vollständiger das Briefing, desto gezielter suchen unsere Recruiter.{' '}
            <button type="button" onClick={onBack} className="underline underline-offset-2">
              Zurück zur Aufnahme
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* Das gewaehlte Paket, nicht die ganze Liste: hier steht, was der Kunde
          gleich anfragt. */}
      {contracting && <ContractingKarte budget={contracting} />}

      {!contracting && chosenPackage && (
        <Card className="border-primary/25">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {chosenPackage.name} · {chosenPackage.fee_percent} % Erfolgshonorar
            </Badge>
            <span className="text-muted-foreground">
              fällig erst bei Einstellung · {chosenPackage.payment_terms_days} Tage netto
              {chosenPackage.continuity_days
                ? ` · erneuter Suchlauf in den ersten ${chosenPackage.continuity_days} Tagen`
                : ''}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <Label htmlFor="signer" className="text-xs text-muted-foreground">
              Ihr Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="signer"
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="Vor- und Nachname"
              className="mt-1"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Wird zusammen mit Zeitpunkt und AGB-Fassung als Nachweis Ihrer Bestätigung gespeichert.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
                aria-describedby="consent-text"
              />
              <span id="consent-text" className="space-y-1.5 text-xs leading-relaxed text-foreground/90">
                {contracting
                  ? <span className="block">{CONTRACTING_ZUSTIMMUNG}</span>
                  : CONSENT_TEXT.map((line) => <span key={line} className="block">{line}</span>)}
              </span>
            </label>
          </div>

          {error && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {error}
                {missing.length > 0 && (
                  <ul className="mt-1.5 list-inside list-disc">
                    {missing.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={submit} disabled={!canSubmit} className="gap-2" variant="hero">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {framework && !contracting ? 'Position beauftragen' : 'Beauftragung anfragen'}
            </Button>
            <Button variant="outline" onClick={onForward} className="gap-2">
              <Users className="h-4 w-4" /> An Entscheider weiterleiten
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {contracting
              ? 'Mit dem Absenden kommt noch kein Vertrag zustande. Wir prüfen Ihre Anfrage und senden Ihnen '
                + 'den Rahmenvertrag mit dem Modul Contracting zur Unterschrift.'
              : framework
              ? `Der Auftrag läuft unter Ihrem Rahmenvertrag ${framework.agreement_number} `
                + `zu ${framework.fee_percent} % — keine erneute Unterschrift nötig.`
              : 'Mit dem Absenden kommt noch kein Vertrag zustande. Wir prüfen Ihre Anfrage und melden uns.'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Die Konditionen für Contracting. Der Text lebt in _shared/contracting-konditionen.ts,
 *  damit Seite, Eingangsbestätigung und Nachweis dasselbe sagen. */
function ContractingKarte({ budget }: { budget: { dayRateMin: number | null; dayRateMax: number | null } }) {
  const rechnung = aufteilungAusBudget(budget.dayRateMin, budget.dayRateMax);
  return (
    <Card className="border-primary/25">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Konditionen Contracting</p>
        </div>
        <p className="text-sm text-muted-foreground">{CONTRACTING_EINLEITUNG}</p>

        <div className="rounded-lg bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium">Transparente Aufteilung Ihres Tagessatzes</p>
          <div className="flex h-7 overflow-hidden rounded-md text-xs font-medium">
            <div className="flex items-center bg-emerald-600/15 pl-2 text-emerald-700" style={{ width: `${ANTEIL_SPEZIALIST}%` }}>
              {ANTEIL_SPEZIALIST} % Spezialist
            </div>
            <div className="flex items-center justify-center bg-primary/15 text-primary" style={{ width: `${ANTEIL_MATCHUNT}%` }}>
              {ANTEIL_MATCHUNT} % Matchunt
            </div>
          </div>
          {rechnung && <p className="mt-2 text-xs text-muted-foreground">{rechnung}</p>}
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
