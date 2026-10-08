import { useState } from 'react';
import { Building2, CheckCircle2, FileUp, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { answerClientQuestion, errorText, uploadDeclarationProof, type ClientAnswer } from '@/lib/jobSearch';
import { cn } from '@/lib/utils';

type Step = 'ask' | 'position' | 'proof_client' | 'proof_direct' | 'done';

/**
 * „Ist das schon dein Kunde?“ – direkt nach „Ich suche“, vor der ersten
 * Einreichung (Vertrag § 17 Abs. 1b/1c). Ja verlangt einen unterschriebenen
 * Vertrag von vor dem ersten „Ich suche“; „Stelle schon direkt“ zusätzlich die
 * Beauftragung, und Matchunt fragt den Kunden. Belege sieht nur Matchunt.
 */
export function ClientQuestionFlow({
  jobId,
  jobTitle,
  companyName,
  onDone,
  compact = false,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string | null;
  onDone: (answer: ClientAnswer) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('ask');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<File | null>(null);
  const [assignment, setAssignment] = useState<File | null>(null);
  const [answer, setAnswer] = useState<ClientAnswer | null>(null);
  const company = companyName || 'das Unternehmen';

  const finish = async (a: ClientAnswer) => {
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const ids = await answerClientQuestion(jobId, a);
      if (a !== 'no' && contract && ids.client_declaration_id) {
        await uploadDeclarationProof(user.id, ids.client_declaration_id, 'contract', contract);
      }
      if (a === 'direct_position' && assignment && ids.direct_declaration_id) {
        await uploadDeclarationProof(user.id, ids.direct_declaration_id, 'assignment', assignment);
      }
      setAnswer(a);
      if (a === 'no') onDone(a);
      else setStep('done');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const fileBox = (label: string, hint: string, file: File | null, setFile: (f: File | null) => void) => (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-dashed border-border p-3 text-sm transition-colors hover:bg-muted/40">
      <FileUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{file ? file.name : hint}</span>
      </span>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.eml,.msg"
        className="sr-only"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
    </label>
  );

  return (
    <div className={cn('space-y-3 text-sm', compact && 'space-y-2.5')}>
      {step === 'ask' && (
        <>
          <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{company}</span>
          </div>
          <div>
            <p className="font-medium">Ist {company} schon dein Kunde?</p>
            <p className="text-xs text-muted-foreground">
              Also: Hast du mit dem Unternehmen einen unterschriebenen Vertrag (Rahmen- oder Einzelvertrag) von vor heute?
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => finish('no')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Nein'}
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setStep('position')}>
              Ja, ich habe einen Vertrag mit ihnen
            </Button>
          </div>
        </>
      )}

      {step === 'position' && (
        <>
          <p className="font-medium">Hat dir {company} genau diese Stelle „{jobTitle}“ schon direkt gegeben, vor deinem „Ich suche“?</p>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" onClick={() => setStep('proof_client')}>
              Nein. Ich bearbeite sie über Matchunt
            </Button>
            <Button variant="outline" className="justify-start" onClick={() => setStep('proof_direct')}>
              Ja, diese Stelle habe ich schon direkt
            </Button>
          </div>
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setStep('ask')}>
            Zurück
          </button>
        </>
      )}

      {step === 'proof_client' && (
        <>
          <p className="font-medium">Beleg, dass {company} dein Kunde ist</p>
          {fileBox('Unterschriebener Vertrag mit ' + company, 'Rahmen- oder Einzelvertrag, unterschrieben vor deinem ersten „Ich suche“', contract, setContract)}
          <p className="text-xs text-muted-foreground">
            Beträge und Konditionen darfst du schwärzen. Nur Matchunt sieht den Beleg, der Kunde erfährt nichts. Deine Suche läuft normal weiter.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy} onClick={() => finish('client')}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {contract ? 'Einreichen' : 'Melden, Beleg folgt'}
            </Button>
            <span className="text-xs text-muted-foreground">Frist für den Beleg: 5 Werktage</span>
          </div>
        </>
      )}

      {step === 'proof_direct' && (
        <>
          <p className="font-medium">Belege: Kunde und Stelle</p>
          {fileBox('Unterschriebener Vertrag mit ' + company, 'Rahmen- oder Einzelvertrag, vor deinem ersten „Ich suche“', contract, setContract)}
          {fileBox('Beauftragung für „' + jobTitle + '“', 'z. B. unterschriebener Suchauftrag oder Auftrags-E-Mail des Kunden, vor deinem „Ich suche“', assignment, setAssignment)}
          <p className="text-xs text-muted-foreground">
            Wir fragen {company}, ob das stimmt. Bis dahin ruht deine Suche: keine neuen Einreichungen.
          </p>
          <Button disabled={busy || !contract || !assignment} onClick={() => finish('direct_position')}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Einreichen
          </Button>
        </>
      )}

      {step === 'done' && (
        <div className="space-y-3">
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="font-medium">Danke. Matchunt prüft deine Angabe.</p>
              <p className="text-xs text-muted-foreground">
                {answer === 'direct_position'
                  ? `Bei der Suche steht „Bestandskunde · in Prüfung“. Wir fragen ${company} und melden uns in der Glocke.`
                  : 'Bei der Suche steht „Bestandskunde · in Prüfung“. Das Ergebnis kommt in die Glocke.'}
              </p>
            </div>
          </div>
          <Button onClick={() => answer && onDone(answer)}>Weiter</Button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {step !== 'done' && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Mit Firmen, die du über Matchunt kennenlernst, arbeitest du nur über Matchunt (Kundenschutz).
        </p>
      )}
    </div>
  );
}
