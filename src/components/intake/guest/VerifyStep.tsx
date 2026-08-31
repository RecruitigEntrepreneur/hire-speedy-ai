import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Loader2, Mail, TriangleAlert } from 'lucide-react';
import { isFailure, type GuestDraft } from '@/hooks/useGuestIntake';

/**
 * Nachweis der Geschäfts-E-Mail per sechsstelligem Code.
 *
 * Bewusst ein Code und kein Magic Link: Mails landen häufig auf dem Telefon,
 * die Aufnahme läuft am Rechner. Ein Link erzwingt den Gerätewechsel und
 * verliert dabei den halbfertigen Zustand; ein Code wird abgetippt.
 */

interface Props {
  draft: GuestDraft;
  onSend: (email: string) => Promise<any>;
  onConfirm: (code: string) => Promise<any>;
  onEditEmail: () => void;
  onVerified: (knownCompany: { name: string } | null) => void;
}

export function VerifyStep({ draft, onSend, onConfirm, onEditEmail, onVerified }: Props) {
  const email = draft.contact_email ?? '';
  const alreadyVerified = draft.states.identity === 'email_verified';

  const [sent, setSent] = useState(false);
  const [masked, setMasked] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await onSend(email);
    setBusy(false);
    if (isFailure(res)) { setError(res.message); return; }
    setSent(true);
    setMasked(res.masked_email ?? email);
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
    onVerified(res.known_company ?? null);
  };

  if (alreadyVerified) {
    return (
      <div className="mx-auto max-w-md space-y-5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600/10">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight">E-Mail-Adresse bestätigt</h2>
          <p className="mt-1 text-sm text-muted-foreground">{email}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold tracking-tight">Ihre E-Mail-Adresse bestätigen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sent
            ? <>Wir haben einen sechsstelligen Code an <strong className="text-foreground">{masked}</strong> gesendet.</>
            : <>Wir senden einen sechsstelligen Code an <strong className="text-foreground">{email}</strong>.</>}
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          {!sent ? (
            <Button onClick={send} disabled={busy || !email} className="w-full gap-2">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Code senden
            </Button>
          ) : (
            <>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    setError(null);
                    if (v.length === 6) void confirm(v);
                  }}
                  disabled={busy}
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {busy && (
                <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Wird geprüft
                </p>
              )}

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={onEditEmail}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Adresse ändern
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={cooldown > 0 || busy}
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground disabled:cursor-default disabled:no-underline disabled:opacity-60"
                >
                  {cooldown > 0 ? `Erneut senden in ${cooldown} s` : 'Code erneut senden'}
                </button>
              </div>
            </>
          )}

          {error && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Der Code ist 15 Minuten gültig. Prüfen Sie gegebenenfalls den Spam-Ordner.
      </p>
    </div>
  );
}
