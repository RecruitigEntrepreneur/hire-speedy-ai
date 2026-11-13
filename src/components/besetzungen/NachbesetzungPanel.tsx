import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { besetzungApi, type BesetzungItem } from '@/lib/besetzungApi';
import { first, type ResearchPanel } from './besetzungView';
import { PanelRows } from './BesetzungParts';
import { useTranslation } from 'react-i18next';

/**
 * Stand der Nachbesetzung im Fenster „Besetzung“ (K6, J2, J3, 11.11.2026): von der Meldung
 * bis zum Ende der Suche, mit dem Hauptknopf je Stand. Kein Wort von „Joker“; Vergleiche
 * („statt …“) stehen bewusst nicht da.
 */

/** Merkt sich, dass der Kunde zum Anpassen der Stelle gegangen ist (danach „angepasst“ bestätigen). */
const ADJUST_KEY = (placementId: string) => `matchunt:nachbesetzung-angepasst:${placementId}`;
const readAdjusted = (id: string) => { try { return sessionStorage.getItem(ADJUST_KEY(id)) === '1'; } catch { return false; } };
const markAdjusted = (id: string, on: boolean) => { try { if (on) sessionStorage.setItem(ADJUST_KEY(id), '1'); else sessionStorage.removeItem(ADJUST_KEY(id)); } catch { /* nur Komfort */ } };

interface Props {
  item: BesetzungItem;
  panel: ResearchPanel;
  busy: boolean;
  run: (work: () => Promise<string>) => void;
  /** Zur bestehenden Bearbeitung der Stelle */
  onEditJob: (jobId: string) => void;
  onSubmissions: (jobId: string) => void;
  onInvoice: (invoiceId: string) => void;
  onOpenSubmission: (submissionId: string) => void;
}

export function NachbesetzungPanel({ item, panel, busy, run, onEditJob, onSubmissions, onInvoice, onOpenSubmission }: Props) {
  const { t } = useTranslation('clientPlacements');
  const p = item.placement!;
  const r = p.research;
  const [confirmEnd, setConfirmEnd] = useState(false);
  const adjusted = readAdjusted(p.id);
  const btn = (label: string, onClick: () => void, primary = false) => (
    <Button key={label} size="sm" variant={primary ? 'default' : 'outline'} disabled={busy} onClick={onClick}>{busy && primary && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{label}</Button>
  );

  const buttons: React.ReactNode[] = [];
  if (panel.variant === 'position' && item.can?.confirmPosition) {
    buttons.push(btn(adjusted ? t('research.confirmAdjusted') : t('research.confirmAsIs'), () => run(async () => {
      const res = await besetzungApi.confirmPosition(p.id, adjusted);
      markAdjusted(p.id, false);
      return res.state === 'running'
        ? t('research.confirmedRunning')
        : t('research.confirmedAfterPay');
    }), true));
    buttons.push(btn(t('research.adjust'), () => { markAdjusted(p.id, true); onEditJob(r?.jobId ?? item.jobId); }));
  }
  if (panel.variant === 'payment') {
    const inv = r?.kind === 'joker' ? p.researchInvoice : item.invoice;
    if (inv?.id && inv.number) buttons.push(btn(t('research.invoice'), () => onInvoice(inv.id), true));
  }
  if (panel.variant === 'running') buttons.push(btn(t('research.submissions'), () => onSubmissions(r?.jobId ?? item.jobId)));
  if (panel.variant === 'found' && r?.replacement) buttons.push(btn(t('research.toPlacement', { first: first(r.replacement.name) }), () => onOpenSubmission(r.replacement!.submissionId)));
  if (panel.variant === 'offer' && item.can?.answerOffer) {
    buttons.push(btn(t('research.noThanks'), () => run(async () => {
      await besetzungApi.answerOffer(p.id, false);
      return t('research.declinedDone');
    })));
    buttons.push(btn(t('research.accept'), () => run(async () => {
      const res = await besetzungApi.answerOffer(p.id, true);
      if (res.state === 'running') return t('research.acceptedRunning');
      return res.released ? t('research.acceptedReleased') : t('research.acceptedInvoice');
    }), true));
  }
  if (['core', 'rejected', 'late', 'outside', 'ended'].includes(panel.variant) && item.can?.reopenJob) {
    buttons.push(btn(t('research.reopen'), () => run(async () => {
      await besetzungApi.reopenJob(p.id);
      return t('research.reopened');
    })));
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {panel.title && <p className="text-sm font-medium">{panel.title}</p>}
      <PanelRows rows={panel.rows} />
      {panel.lines.map((l, n) => (
        <p key={n} className={n === 0 && !panel.rows.length ? 'text-sm' : 'text-sm text-muted-foreground'}>{l}</p>
      ))}
      {panel.variant === 'position' && adjusted && (
        <p className="text-xs text-muted-foreground">{t('research.adjustedHint')}</p>
      )}
      {buttons.length > 0 && <div className="flex flex-wrap gap-2 pt-1">{buttons}</div>}

      {item.can?.endResearch && !confirmEnd && (
        <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setConfirmEnd(true)}>{t('research.end')}</button>
      )}
      {item.can?.endResearch && confirmEnd && (
        <div className="space-y-2 rounded-md bg-muted/50 p-2.5 text-sm">
          <p>{t('research.endQ')}</p>
          <p className="text-xs text-muted-foreground">{t('research.endHint')}</p>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmEnd(false)}>{t('common.cancel')}</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
              await besetzungApi.endResearch(p.id);
              return t('research.endDone');
            })}>{t('research.endYes')}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
