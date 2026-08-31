import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, ShieldCheck, TriangleAlert, Users } from 'lucide-react';
import { CONSENT_TEXT } from './consentText';
import { isFailure, type GuestDraft, type IntakeTerms } from '@/hooks/useGuestIntake';

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
  terms: IntakeTerms | null;
  summary: { label: string; value: string }[];
  openQuestions: number;
  onSubmit: (signerName: string) => Promise<any>;
  onForward: () => void;
  onBack: () => void;
}

export function SummaryStep({ draft, terms, summary, openQuestions, onSubmit, onForward, onBack }: Props) {
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

  const canSubmit = consent && signer.trim().length >= 3 && !busy;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Prüfen und beauftragen</h2>
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

      {terms && (
        <Card className="border-primary/25">
          <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 text-sm">
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              {terms.fee_percentage} % Erfolgshonorar
            </Badge>
            <span className="text-muted-foreground">
              fällig erst bei Einstellung · {terms.payment_terms_days} Tage netto · AGB {terms.agb_version}
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
                {CONSENT_TEXT.map((line) => <span key={line} className="block">{line}</span>)}
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
              Beauftragung anfragen
            </Button>
            <Button variant="outline" onClick={onForward} className="gap-2">
              <Users className="h-4 w-4" /> An Entscheider weiterleiten
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Mit dem Absenden kommt noch kein Vertrag zustande. Wir prüfen Ihre Anfrage und melden uns.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
