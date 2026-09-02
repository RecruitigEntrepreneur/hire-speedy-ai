import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileSignature, Loader2, UserCheck, Users } from 'lucide-react';

/**
 * Wer unterschreibt?
 *
 * Die eine Frage, die entscheidet, ob der Vorgang durchläuft oder liegen
 * bleibt. Wer die Stelle aufnimmt, darf im Mittelstand oft nicht zeichnen —
 * HR oder der Hiring Manager briefen, unterschreiben tut die Geschäftsführung.
 * Ein Vertrag, der ungefragt beim Absender landet, ist dort eine Sackgasse.
 *
 * Die Formulierung meidet „berechtigt“ und „Prokura“: Wer sich unsicher ist,
 * ob er das darf, soll den zweiten Weg wählen können, ohne sich rechtfertigen
 * zu müssen.
 */

interface Props {
  contactName: string | null;
  busy: boolean;
  error: string | null;
  onChoose: (args: { self: boolean; name?: string; email?: string }) => void;
}

export function SignerChoice({ contactName, busy, error, onChoose }: Props) {
  const [modus, setModus] = useState<'frage' | 'andere'>('frage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h1 className="text-xl font-bold tracking-tight">Wer unterschreibt den Vertrag?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Rahmenvertrag und Einzelauftrag gehen in einem Durchgang zur Unterschrift.
        </p>
      </div>

      {modus === 'frage' ? (
        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose({ self: true })}
            className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">
                Ich unterschreibe selbst{contactName ? ` – ${contactName}` : ''}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Sie unterschreiben gleich hier, ohne Umweg über E-Mail. Dauert etwa zwei Minuten.
              </span>
            </span>
            {busy && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setModus('andere')}
            className="flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:opacity-60"
          >
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <span>
              <span className="block font-medium">Jemand anderes unterschreibt</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                Wir senden den Vertrag direkt an die zuständige Person. Sie bekommen Bescheid,
                sobald unterschrieben ist.
              </span>
            </span>
          </button>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <Label htmlFor="signer-name">Name der unterzeichnenden Person</Label>
            <Input id="signer-name" value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1" placeholder="Vor- und Nachname" autoFocus />
          </div>
          <div>
            <Label htmlFor="signer-mail">Geschäftliche E-Mail-Adresse</Label>
            <Input id="signer-mail" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1" placeholder="name@ihrunternehmen.de" />
            <p className="mt-1 text-xs text-muted-foreground">
              An diese Adresse geht der Vertrag zur digitalen Unterschrift.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setModus('frage')} disabled={busy}>
              Zurück
            </Button>
            <Button
              className="flex-1"
              disabled={busy || !name.trim() || !email.trim()}
              onClick={() => onChoose({ self: false, name: name.trim(), email: email.trim() })}
            >
              {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Wird gesendet …</>
                    : <><FileSignature className="mr-2 h-4 w-4" /> Vertrag dorthin senden</>}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Mit dieser Anfrage ist noch kein Vertrag zustande gekommen. Er wird wirksam, wenn
        beide Seiten unterschrieben haben — Sie zuerst, Matchunt zuletzt.
      </p>
    </div>
  );
}
