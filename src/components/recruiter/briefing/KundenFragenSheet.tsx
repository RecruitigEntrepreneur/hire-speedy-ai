import { useEffect, useState } from 'react';
import { Check, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { fragenAnKunden, type Fehlt } from '@/lib/mandatsBriefing';

const VORSATZ = 'Damit ich passende Kandidaten finde, fehlen mir noch ein paar Angaben. Sie können sie direkt in der Aufnahme der Stelle ergänzen.';

/**
 * „Kunden fragen“ (Endfassung 21.10.2026): die offenen Fragen der Aufnahme im
 * Wortlaut des Katalogs, abwählbar, ein Satz dazu. Erst „Senden“ verschickt;
 * die Mail geht über Matchunt an das Kundenteam (recruiter-notify,
 * job_questions), höchstens einmal in sieben Tagen je Stelle.
 */
export function KundenFragenSheet({ open, onOpenChange, jobId, jobTitle, fehlt }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  fehlt: Fehlt[];
}) {
  const [auswahl, setAuswahl] = useState<Set<string>>(new Set());
  const [text, setText] = useState(VORSATZ);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gesendet, setGesendet] = useState<string | null>(null);
  const gruppen = fragenAnKunden(fehlt);

  useEffect(() => {
    if (!open) return;
    setAuswahl(new Set(fragenAnKunden(fehlt).map(g => g.frage)));
    setFehler(null);
  }, [open, fehlt]);

  const umschalten = (id: string) => setAuswahl(a => {
    const n = new Set(a);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const senden = async () => {
    setBusy(true);
    setFehler(null);
    try {
      const fragen = gruppen.filter(g => auswahl.has(g.frage)).map(g => ({ id: g.ids.join(','), frage: g.frage }));
      const { data, error } = await supabase.functions.invoke('recruiter-notify', { body: { action: 'job_questions', jobId, fragen, text: text.trim() || VORSATZ } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const msg = ctx && typeof ctx.json === 'function' ? await ctx.json().then((j: { message?: string; error?: string }) => j.message ?? j.error).catch(() => null) : null;
        throw new Error(msg ?? 'Senden hat nicht geklappt. Bitte später noch einmal versuchen.');
      }
      const r = data as { mails?: number; recipients?: number };
      setGesendet(r.mails ? `An ${r.mails} ${r.mails === 1 ? 'Person' : 'Personen'} im Kundenteam gesendet.` : 'Gesendet. Der Kunde sieht die Fragen in seinen Benachrichtigungen.');
    } catch (e) {
      setFehler(e instanceof Error ? e.message : 'Senden hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return <Sheet open={open} onOpenChange={o => { onOpenChange(o); if (!o) setGesendet(null); }}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader>
        <SheetTitle>Kunden fragen</SheetTitle>
        <SheetDescription>{jobTitle} · Die Fragen gehen über Matchunt an das Kundenteam. Du siehst vorher genau, was rausgeht.</SheetDescription>
      </SheetHeader>
      {gesendet ? <div className="mt-6 space-y-3">
        <p className="flex items-center gap-2 text-sm font-medium text-emerald-600"><Check className="h-4 w-4" />{gesendet}</p>
        <p className="text-sm text-muted-foreground">Sobald der Kunde antwortet, stehen die Angaben im Briefing.</p>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Schließen</Button>
      </div> : <div className="mt-5 space-y-5">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">So fragt die Aufnahme ({auswahl.size} von {gruppen.length} ausgewählt)</p>
          <ul className="space-y-1.5">
            {gruppen.map(g => <li key={g.frage}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 text-sm hover:bg-muted/40">
                <Checkbox checked={auswahl.has(g.frage)} onCheckedChange={() => umschalten(g.frage)} className="mt-0.5" />
                <span><span className="block">{g.frage}</span><span className="block text-xs text-muted-foreground">{g.labels.join(' · ')}</span></span>
              </label>
            </li>)}
          </ul>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">Dein Satz dazu</span>
          <Textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={600} />
        </label>
        {fehler && <p role="alert" className="text-sm text-destructive">{fehler}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void senden()} disabled={busy || auswahl.size === 0}>{busy ? <Loader2 className="animate-spin" /> : <Send />}Senden</Button>
          <span className="text-xs text-muted-foreground">Höchstens einmal in sieben Tagen je Stelle.</span>
        </div>
      </div>}
    </SheetContent>
  </Sheet>;
}
