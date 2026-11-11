import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Honorar } from '@/components/recruiter/Honorar';
import { abrechnungApi, type PlacementResponse } from '@/lib/abrechnungApi';
import { companyShort, dmy, type PlacementWindowView } from '../../../../supabase/functions/_shared/abrechnung-view';

const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }); };

/**
 * H7 links: „Hat Cem angefangen?“ — drei Antworten. Die Meldung geht an den Kunden
 * zur Bestätigung; ohne Widerspruch steht der Antritt nach 3 Werktagen fest.
 * Steht auch im Besetzungs-Fenster, wenn der erste Arbeitstag da ist.
 */
export function AntrittMelden({ view, ziel: target, onReported }: {
  view: PlacementWindowView;
  ziel: { placementId?: string; taskId?: string };
  onReported: (r: PlacementResponse) => void;
}) {
  const [mode, setMode] = useState<null | 'later' | 'not_started'>(null);
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (way: 'started' | 'later' | 'not_started') => {
    if (way === 'later' && !date) { toast.error('Bitte den neuen ersten Arbeitstag angeben.'); return; }
    setBusy(true);
    try {
      const r = await abrechnungApi.reportStart({ ...target, way, startedOn: way === 'started' ? view.start.planned ?? undefined : undefined, startDate: way === 'later' ? date : undefined, note: note.trim() || undefined });
      toast.success(way === 'started' ? `Gemeldet. ${companyShort(view.companyName)} bestätigt.` : way === 'later' ? 'Neuer Starttermin gemeldet.' : 'Gemeldet. Der Kunde bestätigt, dann prüft Matchunt.');
      onReported(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deine Meldung konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void send('started')}>{busy && !mode ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Ja, hat angefangen</Button>
        <Button size="sm" variant={mode === 'later' ? 'secondary' : 'outline'} disabled={busy} onClick={() => setMode(mode === 'later' ? null : 'later')}>Fängt später an</Button>
        <Button size="sm" variant={mode === 'not_started' ? 'secondary' : 'outline'} disabled={busy} onClick={() => setMode(mode === 'not_started' ? null : 'not_started')}>Hat nicht angefangen</Button>
      </div>
      {mode === 'later' && (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="space-y-1.5"><Label htmlFor="neuer-start">Neuer erster Arbeitstag</Label><Input id="neuer-start" type="date" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="start-notiz">Notiz (optional)</Label><Input id="start-notiz" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Kündigungsfrist verlängert" /></div>
          <div className="sm:col-span-2"><Button size="sm" disabled={busy} onClick={() => void send('later')}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Neuen Termin melden</Button></div>
        </div>
      )}
      {mode === 'not_started' && (
        <div className="space-y-2">
          <Label htmlFor="nicht-angefangen">Was ist passiert? (optional)</Label>
          <Textarea id="nicht-angefangen" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`z. B. ${view.firstName} hat ein Gegenangebot angenommen`} />
          <Button size="sm" disabled={busy} onClick={() => void send('not_started')}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}Melden</Button>
        </div>
      )}
      <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground"><Honorar>{view.start.box}</Honorar></p>
    </div>
  );
}

/** H7 rechts: Halbzeit der Garantie, optional. Der Kunde sieht davon nichts. */
export function HalbzeitFrage({ view, ziel: target, onAnswered }: {
  view: PlacementWindowView;
  ziel: { placementId?: string; taskId?: string };
  onAnswered: (r: PlacementResponse) => void;
}) {
  const [shaky, setShaky] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async (status: 'ok' | 'shaky') => {
    setBusy(true);
    try {
      const r = await abrechnungApi.halfway({ ...target, status, note: note.trim() || undefined });
      toast.success(status === 'ok' ? 'Danke, festgehalten.' : 'Danke. Matchunt hat den Hinweis.');
      onAnswered(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deine Antwort konnte nicht gespeichert werden.');
    } finally { setBusy(false); }
  };
  if (view.halfway.status) {
    return <p className="text-sm text-muted-foreground">Schon beantwortet: {view.halfway.status === 'ok' ? 'läuft gut' : 'es wackelt'}{view.halfway.at ? ` (${dmy(view.halfway.at.slice(0, 10))})` : ''}.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void send('ok')}>Läuft gut</Button>
        <Button size="sm" variant={shaky ? 'secondary' : 'outline'} disabled={busy} onClick={() => setShaky(!shaky)}>Es wackelt</Button>
      </div>
      {shaky && (
        <div className="space-y-2">
          <Label htmlFor="wackelt">Was ist los? (optional)</Label>
          <Textarea id="wackelt" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={busy} onClick={() => void send('shaky')}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}An Matchunt senden</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">„Es wackelt“ landet als Hinweis bei Matchunt.</p>
    </div>
  );
}

export interface StartAufgabe { kind: 'start' | 'halfway'; taskId: string; phone?: string | null }

/**
 * Fenster zur Aufgabe am ersten Arbeitstag bzw. zur Halbzeit (H7). Öffnet sich aus
 * „Aufgaben“, „Heute“ und dem Kandidatenprofil über das Aufgaben-System.
 */
export function StartAufgabeFenster({ task, onClose, onDone }: { task: StartAufgabe | null; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['verdienst-aufgabe', task?.taskId],
    queryFn: () => abrechnungApi.placement({ taskId: task!.taskId }),
    enabled: !!task,
    retry: false,
  });
  const view = q.data?.view;
  const finish = (r: PlacementResponse) => {
    qc.setQueryData(['verdienst-aufgabe', task?.taskId], r);
    void qc.invalidateQueries({ queryKey: ['verdienste'] });
    onDone();
    onClose();
  };
  const planned = view?.start.planned ? dmy(view.start.planned) : '';
  return (
    <Dialog open={!!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {!view ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            {q.isError ? <p className="text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : 'Die Besetzung konnte nicht geladen werden.'}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        ) : task?.kind === 'halfway' ? (
          <>
            <DialogHeader>
              <p className="text-xs text-muted-foreground">Halbzeit der Garantie · optional</p>
              <DialogTitle>Wie läuft es bei {view.firstName}?</DialogTitle>
              <DialogDescription>Garantie bis {dmy(view.halfway.guaranteeUntil)} · der Kunde sieht davon nichts</DialogDescription>
            </DialogHeader>
            <HalbzeitFrage view={view} ziel={{ taskId: task.taskId }} onAnswered={finish} />
          </>
        ) : (
          <>
            <DialogHeader>
              <p className="text-xs text-muted-foreground">Erster Arbeitstag</p>
              <DialogTitle>Hat {view.firstName} angefangen?</DialogTitle>
              <DialogDescription>{companyShort(view.companyName)} · erster Arbeitstag laut Vertrag {planned} · kurz anrufen, dann melden</DialogDescription>
            </DialogHeader>
            {task?.phone && <Button variant="outline" size="sm" className="w-fit" asChild><a href={`tel:${task.phone.replace(/[^\d+]/g, '')}`}><Phone className="mr-1.5 h-3.5 w-3.5" />{view.firstName} anrufen</a></Button>}
            {view.start.fixed ? (
              <div className="space-y-3">
                <p className="text-sm">{view.start.fixedText}</p>
                <Button size="sm" onClick={() => { onDone(); onClose(); }}>Schließen</Button>
              </div>
            ) : view.start.canReport ? (
              <AntrittMelden view={view} ziel={{ taskId: task!.taskId }} onReported={finish} />
            ) : (
              <p className="text-sm text-muted-foreground">Dazu ist schon etwas gemeldet. Den Stand siehst du unter Verdienste.</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
