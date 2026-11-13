import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Honorar } from '@/components/recruiter/Honorar';
import { abrechnungApi, type PlacementResponse } from '@/lib/abrechnungApi';
import { SchrittListe } from './Schritte';
import { AntrittMelden, HalbzeitFrage } from './StartAufgabeFenster';

/**
 * Besetzungs-Fenster (H9 alles läuft, H10 wenn etwas schiefgeht, J5 Core ohne Antritt).
 * Grundlage und Teile oben, darunter die Schritte mit Datum. Bei einem offenen Fall
 * gibt der Headhunter hier seine Sicht ab.
 */
export function BesetzungFenster({ placementId, onClose }: { placementId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useTranslation('recruiterEarnings');
  const q = useQuery({
    queryKey: ['verdienst-besetzung', placementId, i18n.language],
    queryFn: () => abrechnungApi.placement({ placementId: placementId! }),
    enabled: !!placementId,
    retry: false,
  });
  const [statement, setStatement] = useState('');
  const [busy, setBusy] = useState(false);
  const [wackelt, setWackelt] = useState(false);
  const view = q.data?.view;
  const update = (r: PlacementResponse) => {
    qc.setQueryData(['verdienst-besetzung', placementId, i18n.language], r);
    void qc.invalidateQueries({ queryKey: ['verdienste'] });
  };
  const sendStatement = async () => {
    if (!placementId || !statement.trim()) { toast.error(t('placement.writeWhatYouKnow')); return; }
    setBusy(true);
    try {
      update(await abrechnungApi.statement(placementId, statement.trim()));
      setStatement('');
      toast.success(t('placement.statementSent'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('api.statement'));
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!placementId} onOpenChange={(o) => { if (!o) { setWackelt(false); onClose(); } }}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {!view ? (
          <div className="flex min-h-[10rem] items-center justify-center">
            {q.isError ? <p className="text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : t('api.placement')}</p> : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{view.candidateName}{view.jobTitle ? ` · ${view.jobTitle}` : ''}</DialogTitle>
              <DialogDescription>{view.subtitle}</DialogDescription>
            </DialogHeader>

            {view.figures.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {view.figures.map((f) => (
                  <div key={f.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground"><Honorar>{f.label}</Honorar></p>
                    <p className="text-sm font-medium tabular-nums">{f.key === 'basis' ? f.value : <Honorar>{f.value}</Honorar>}</p>
                    {f.note && <p className="text-[11px] text-muted-foreground">{f.note}</p>}
                  </div>
                ))}
              </div>
            )}

            {view.caseTitle && <p className="font-medium">{view.caseTitle}</p>}
            <SchrittListe steps={view.steps} />

            {view.box && <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm leading-6"><Honorar>{view.box}</Honorar></p>}

            {view.statement && (
              <div className="text-sm">
                <p className="text-xs text-muted-foreground">{t('placement.yourView')}</p>
                <p className="whitespace-pre-line">{view.statement.text}</p>
              </div>
            )}
            {view.canStatement && (
              <div className="space-y-2">
                <Label htmlFor="sicht">{t('placement.yourViewLabel')}</Label>
                <Textarea id="sicht" rows={4} maxLength={2000} value={statement} onChange={(e) => setStatement(e.target.value)} placeholder={t('placement.leavingPlaceholder', { name: view.firstName })} />
                <Button size="sm" disabled={busy || !statement.trim()} onClick={() => void sendStatement()}>{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}{t('sendToMatchunt')}</Button>
              </div>
            )}

            {view.start.canReport && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm font-medium">{t('placement.started', { name: view.firstName })}</p>
                <AntrittMelden view={view} ziel={{ placementId: view.placementId }} onReported={update} />
              </div>
            )}

            {view.footer && <p className="text-sm text-muted-foreground">{view.footer}</p>}
            {view.halfway.possible && view.halfway.status !== 'shaky' && (
              wackelt
                ? <HalbzeitFrage view={view} ziel={{ placementId: view.placementId }} onAnswered={(r) => { update(r); setWackelt(false); }} />
                : <button type="button" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground" onClick={() => setWackelt(true)}>{t('placement.howIsIt', { name: view.firstName })}</button>
            )}

            {view.jobLink && (
              <div>
                <Button variant="outline" size="sm" asChild><Link to={view.jobLink} onClick={onClose}>{t('placement.toJob')}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
