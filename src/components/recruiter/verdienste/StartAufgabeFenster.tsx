import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
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
  const { t } = useTranslation('recruiterEarnings');
  const send = async (way: 'started' | 'later' | 'not_started') => {
    if (way === 'later' && !date) { toast.error(t('start.newDateMissing')); return; }
    setBusy(true);
    try {
      const r = await abrechnungApi.reportStart({ ...target, way, startedOn: way === 'started' ? view.start.planned ?? undefined : undefined, startDate: way === 'later' ? date : undefined, note: note.trim() || undefined });
      toast.success(way === 'started' ? t('start.reportedStarted', { company: companyShort(view.companyName) }) : way === 'later' ? t('start.reportedLater') : t('start.reportedNot'));
      onReported(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('api.reportStart'));
    } finally { setBusy(false); }
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => void send('started')}>{busy && !mode ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{t('start.yes')}</Button>
        <Button size="sm" variant={mode === 'later' ? 'secondary' : 'outline'} disabled={busy} onClick={() => setMode(mode === 'later' ? null : 'later')}>{t('start.later')}</Button>
        <Button size="sm" variant={mode === 'not_started' ? 'secondary' : 'outline'} disabled={busy} onClick={() => setMode(mode === 'not_started' ? null : 'not_started')}>{t('start.no')}</Button>
      </div>
      {mode === 'later' && (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="space-y-1.5"><Label htmlFor="neuer-start">{t('start.newDay')}</Label><Input id="neuer-start" type="date" min={tomorrow()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="start-notiz">{t('start.noteOptional')}</Label><Input id="start-notiz" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder={t('start.notePlaceholder')} /></div>
          <div className="sm:col-span-2"><Button size="sm" disabled={busy} onClick={() => void send('later')}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{t('start.reportNewDate')}</Button></div>
        </div>
      )}
      {mode === 'not_started' && (
        <div className="space-y-2">
          <Label htmlFor="nicht-angefangen">{t('start.whatHappened')}</Label>
          <Textarea id="nicht-angefangen" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('start.whatHappenedPlaceholder', { name: view.firstName })} />
          <Button size="sm" disabled={busy} onClick={() => void send('not_started')}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{t('start.report')}</Button>
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
  const { t } = useTranslation('recruiterEarnings');
  const send = async (status: 'ok' | 'shaky') => {
    setBusy(true);
    try {
      const r = await abrechnungApi.halfway({ ...target, status, note: note.trim() || undefined });
      toast.success(status === 'ok' ? t('halfway.thanksOk') : t('halfway.thanksShaky'));
      onAnswered(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('api.halfway'));
    } finally { setBusy(false); }
  };
  if (view.halfway.status) {
    return <p className="text-sm text-muted-foreground">{view.halfway.at
      ? t(view.halfway.status === 'ok' ? 'halfway.answeredOkOn' : 'halfway.answeredShakyOn', { date: dmy(view.halfway.at.slice(0, 10), i18n.language) })
      : t(view.halfway.status === 'ok' ? 'halfway.answeredOk' : 'halfway.answeredShaky')}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void send('ok')}>{t('halfway.ok')}</Button>
        <Button size="sm" variant={shaky ? 'secondary' : 'outline'} disabled={busy} onClick={() => setShaky(!shaky)}>{t('halfway.shaky')}</Button>
      </div>
      {shaky && (
        <div className="space-y-2">
          <Label htmlFor="wackelt">{t('halfway.whatsUp')}</Label>
          <Textarea id="wackelt" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" disabled={busy} onClick={() => void send('shaky')}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{t('sendToMatchunt')}</Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{t('halfway.shakyNote')}</p>
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
  const { t } = useTranslation('recruiterEarnings');
  const q = useQuery({
    queryKey: ['verdienst-aufgabe', task?.taskId, i18n.language],
    queryFn: () => abrechnungApi.placement({ taskId: task!.taskId }),
    enabled: !!task,
    retry: false,
  });
  const view = q.data?.view;
  const finish = (r: PlacementResponse) => {
    qc.setQueryData(['verdienst-aufgabe', task?.taskId, i18n.language], r);
    void qc.invalidateQueries({ queryKey: ['verdienste'] });
    onDone();
    onClose();
  };
  const planned = view?.start.planned ? dmy(view.start.planned, i18n.language) : '';
  return (
    <Dialog open={!!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        {!view ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            {q.isError ? <p className="text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : t('api.placement')}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        ) : task?.kind === 'halfway' ? (
          <>
            <DialogHeader>
              <p className="text-xs text-muted-foreground">{t('halfway.kicker')}</p>
              <DialogTitle>{t('placement.howIsIt', { name: view.firstName })}</DialogTitle>
              <DialogDescription>{t('halfway.description', { date: dmy(view.halfway.guaranteeUntil, i18n.language) })}</DialogDescription>
            </DialogHeader>
            <HalbzeitFrage view={view} ziel={{ taskId: task.taskId }} onAnswered={finish} />
          </>
        ) : (
          <>
            <DialogHeader>
              <p className="text-xs text-muted-foreground">{t('start.kicker')}</p>
              <DialogTitle>{t('placement.started', { name: view.firstName })}</DialogTitle>
              <DialogDescription>{t('start.description', { company: companyShort(view.companyName), date: planned })}</DialogDescription>
            </DialogHeader>
            {task?.phone && <Button variant="outline" size="sm" className="w-fit" asChild><a href={`tel:${task.phone.replace(/[^\d+]/g, '')}`}><Phone className="mr-1.5 h-3.5 w-3.5" />{t('start.call', { name: view.firstName })}</a></Button>}
            {view.start.fixed ? (
              <div className="space-y-3">
                <p className="text-sm">{view.start.fixedText}</p>
                <Button size="sm" onClick={() => { onDone(); onClose(); }}>{t('start.close')}</Button>
              </div>
            ) : view.start.canReport ? (
              <AntrittMelden view={view} ziel={{ taskId: task!.taskId }} onReported={finish} />
            ) : (
              <p className="text-sm text-muted-foreground">{t('start.alreadyReported')}</p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
