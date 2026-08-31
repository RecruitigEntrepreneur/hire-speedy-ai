import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { isFailure, requestResumeLink } from '@/hooks/useGuestIntake';

/**
 * Weiterleiten an einen Entscheider.
 *
 * Erzeugt serverseitig einen EIGENEN Zugang für die neue Adresse, statt den
 * vorhandenen Link weiterzureichen. Eine Aufnahme enthält Gehaltsbänder und
 * interne Gründe für die Vakanz — wer darauf zugreift, muss nachvollziehbar
 * und einzeln entziehbar sein.
 */
export function ForwardDialog({
  open, onOpenChange, onForward,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onForward: (email: string, name: string, message: string) => Promise<any>;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    const res = await onForward(email.trim(), name.trim(), message.trim());
    setBusy(false);
    if (isFailure(res)) { setError(res.message); return; }
    setDone(res.message);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setDone(null); setError(null); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>An Entscheider weiterleiten</DialogTitle>
          <DialogDescription>
            Die Person erhält einen eigenen Zugang zu dieser Aufnahme und kann sie ergänzen und einreichen.
            Ihr eigener Zugang bleibt bestehen.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <Alert><AlertDescription className="text-sm">{done}</AlertDescription></Alert>
        ) : (
          <div className="space-y-3">
            <div>
              <Label htmlFor="fwd-email" className="text-xs text-muted-foreground">Geschäftliche E-Mail-Adresse</Label>
              <Input id="fwd-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ihrunternehmen.de" className="mt-1" />
            </div>
            <div>
              <Label htmlFor="fwd-name" className="text-xs text-muted-foreground">Name (optional)</Label>
              <Input id="fwd-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="fwd-msg" className="text-xs text-muted-foreground">Nachricht (optional)</Label>
              <Textarea id="fwd-msg" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder={'z. B. Bitte kurz prüfen und freigeben.'} className="mt-1" />
            </div>
            {error && <Alert variant="destructive"><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={send} disabled={busy || !email.trim()} className="gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Einladung senden
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * „Später fortsetzen".
 *
 * Antwortet immer gleich, unabhängig davon, ob zur Adresse etwas existiert —
 * sonst wäre die Funktion ein Weg herauszufinden, welche Unternehmen gerade
 * eine Stelle bei Matchunt aufnehmen.
 */
export function ResumeDialog({
  open, onOpenChange, defaultEmail, verified,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultEmail: string | null;
  verified: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    const res = await requestResumeLink(email.trim());
    setBusy(false);
    setDone(isFailure(res) ? res.message : res.message);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setDone(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Später fortsetzen</DialogTitle>
          <DialogDescription>
            Ihre Angaben sind gespeichert. Auf demselben Gerät geht es über denselben Link weiter.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <Alert><AlertDescription className="text-sm">{done}</AlertDescription></Alert>
        ) : verified ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Wenn Sie das Gerät wechseln möchten, senden wir Ihnen einen Fortsetzungslink per E-Mail.
            </p>
            <div>
              <Label htmlFor="resume-email" className="text-xs text-muted-foreground">Ihre bestätigte E-Mail-Adresse</Label>
              <Input id="resume-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription className="text-sm">
              Sobald Sie Ihre E-Mail-Adresse bestätigt haben, können wir Ihnen einen Fortsetzungslink
              senden. Bis dahin geht es auf diesem Gerät über denselben Link weiter.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {done || !verified ? (
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={send} disabled={busy || !email.trim()} className="gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Link senden
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
