import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RecruiterTextReview, type TextEntwurf } from './RecruiterTextReview';

/**
 * Admin > Jobs: Anzeige & Ansprache für eine Stelle, die schon live ist, neu
 * erzeugen (Entscheidung 29.09.2026). Der Entwurf ist für Recruiter unsichtbar,
 * bis Matchunt ihn mit „Übernehmen" in formatted_content schreibt.
 */
export function AnzeigeNeuDialog({ job, onClose, onUebernommen }: {
  job: Record<string, any> | null;
  onClose: () => void;
  onUebernommen: () => void;
}) {
  const [entwurf, setEntwurf] = useState<TextEntwurf | null>(null);
  const [busy, setBusy] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [gesperrt, setGesperrt] = useState(false);

  const uebernehmen = async () => {
    if (!job || !entwurf) return;
    setSpeichert(true);
    const { error } = await supabase.from('jobs').update({ formatted_content: entwurf.content }).eq('id', job.id);
    if (!error) await supabase.from('job_recruiter_text_drafts' as never).delete().eq('job_id', job.id);
    setSpeichert(false);
    if (error) { toast.error(`Nicht übernommen: ${error.message}`); return; }
    toast.success('Anzeige übernommen – Recruiter sehen jetzt die neue Fassung.');
    onUebernommen();
    onClose();
  };

  return (
    <Dialog open={Boolean(job)} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anzeige neu erzeugen</DialogTitle>
          <DialogDescription>{job?.title} · live. Recruiter sehen den Entwurf erst, wenn du ihn übernimmst.</DialogDescription>
        </DialogHeader>
        {job && <RecruiterTextReview key={job.id} job={job} onEntwurf={setEntwurf} onBusy={setBusy} onSperre={setGesperrt} />}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Schließen</Button>
          <Button onClick={() => void uebernehmen()} disabled={!entwurf || busy || speichert || gesperrt}
            title={gesperrt ? 'Erst wenn der Firmenname aus der Anzeige entfernt ist' : undefined}>
            {speichert && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Übernehmen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
