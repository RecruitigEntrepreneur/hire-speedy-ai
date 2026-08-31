import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ArrowRight, Coins, FileSignature, Loader2, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { isFailure, type GuestDraft, type IntakeTerms } from '@/hooks/useGuestIntake';

/**
 * Die Konditionen im Klartext.
 *
 * Vier Angaben, die AGB § 9 und § 12 zusagen und die heute nirgends vor der
 * Beauftragung stehen: Prozentsatz, Bemessungsgrundlage, Fälligkeit und
 * Rückerstattungsregel. Dazu ausdrücklich, dass mit der Anfrage noch kein
 * Vertrag zustande kommt — sonst wäre die Darstellung ein bindendes Angebot.
 */

interface Props {
  terms: IntakeTerms;
  draft: GuestDraft;
  onRequestDiscussion: (note: string) => Promise<any>;
  onNext: () => void;
}

export function TermsStep({ terms, draft, onRequestDiscussion, onNext }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const discussionRequested = draft.states.commercial === 'discussion_requested';

  const submitDiscussion = async () => {
    setBusy(true);
    const res = await onRequestDiscussion(note.trim());
    setBusy(false);
    setDialogOpen(false);
    setFeedback(isFailure(res) ? res.message : res.message);
  };

  const basis = terms.fee_basis === 'annual_target_salary' ? 'des Zieljahresgehalts' : 'des Jahresbruttogehalts';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Unsere Konditionen</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Erfolgsbasiert. Sie zahlen erst, wenn Sie tatsächlich einstellen.
        </p>
      </div>

      <Card className="border-primary/25 bg-gradient-to-br from-primary/[0.06] to-background">
        <CardContent className="p-5">
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold tracking-tight">{terms.fee_percentage} %</span>
            <span className="text-sm text-muted-foreground">{basis}</span>
          </div>

          <dl className="space-y-2.5 text-sm">
            <Row label="Fällig" value="Nur im Erfolgsfall — mit Unterzeichnung des Anstellungsvertrags." />
            <Row label="Zahlungsziel" value={`${terms.payment_terms_days} Tage netto ohne Abzug.`} />
            <Row label="Fixkosten" value="Keine. Kein Retainer, keine Grundgebühr, keine Kosten für die Ausschreibung." />
            {terms.guarantee_days && (
              <Row label="Nachbesetzung" value={terms.refund_rule ?? `${terms.guarantee_days} Tage Nachbesetzungsgarantie.`} />
            )}
            {terms.vat_note && <Row label="Umsatzsteuer" value={terms.vat_note} />}
          </dl>

          <p className="mt-4 flex items-start gap-1.5 border-t pt-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            Es gelten ergänzend die{' '}
            <a href={terms.agb_url ?? '/agb'} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Allgemeinen Geschäftsbedingungen
            </a>{' '}
            in der Fassung {terms.agb_version}.
          </p>
        </CardContent>
      </Card>

      {terms.body_md && (
        <Card>
          <CardContent className="p-5">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Coins className="h-3.5 w-3.5" /> Im Wortlaut
            </p>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {terms.body_md.replace(/^#+\s*/gm, '').replace(/\*\*/g, '')}
            </div>
          </CardContent>
        </Card>
      )}

      {terms.requires_signature && (
        <Alert>
          <FileSignature className="h-4 w-4" />
          <AlertDescription className="text-xs">
            {terms.signature_notice ??
              'Nach Ihrer Anfrage prüfen wir das Mandat und senden Ihnen die Vermittlungsvereinbarung zur digitalen Unterschrift zu. Erst danach starten wir die Suche.'}
          </AlertDescription>
        </Alert>
      )}

      {discussionRequested && (
        <Alert>
          <MessageCircleQuestion className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Ihre Rückfrage zu den Konditionen liegt bei uns. Sie können die Aufnahme trotzdem
            abschließen und einreichen — wir starten erst nach der Klärung.
          </AlertDescription>
        </Alert>
      )}
      {feedback && !discussionRequested && (
        <Alert><AlertDescription className="text-xs">{feedback}</AlertDescription></Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="gap-2 text-muted-foreground" onClick={() => setDialogOpen(true)}>
          <MessageCircleQuestion className="h-4 w-4" /> Konditionen besprechen
        </Button>
        <Button onClick={onNext} className="gap-2">
          Zur Zusammenfassung <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konditionen besprechen</DialogTitle>
            <DialogDescription>
              Ihr Ansprechpartner meldet sich. Die Aufnahme können Sie unabhängig davon abschließen.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Worum geht es? z. B. mehrere Positionen, Rahmenvereinbarung, abweichende Bemessungsgrundlage"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={submitDiscussion} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Rückfrage senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-foreground/90">{value}</dd>
    </div>
  );
}
