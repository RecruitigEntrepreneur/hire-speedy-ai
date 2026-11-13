import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { dayDe, offerApi, type OfferContext } from '@/lib/offerApi';
import { useTranslation } from 'react-i18next';
import { fmtDate } from '@/lib/localeFormat';

/**
 * Contracting statt Angebot (Etappe 1, Entscheidung 04.11.2026).
 *
 * Ein Angebot über ein Fixgehalt führte bei Contracting in Arbeitsvertrag und
 * Prozent-Rechnung. Bis Projektauftrag und Leistungsschein in der Plattform
 * laufen, fragt der Kunde den Einsatz an: Beginn, Laufzeit, Umfang. Den
 * Tagessatz stimmt Matchunt mit dem Headhunter ab und schickt den Projektauftrag.
 */
export function EinsatzForm({ c, onClose, onSent, onAsk, onReject }: {
  c: OfferContext; onClose: () => void; onSent?: () => void; onAsk?: () => void; onReject?: () => void;
}) {
  const { t } = useTranslation('offers');
  const queryClient = useQueryClient();
  const k = c.contracting!;
  const hh = c.recruiterName?.trim() || t('client.yourRecruiterDat');
  const hhFirst = hh.split(' ')[0];
  const name = c.candidateName || t('client.theCandidateAcc');
  const last = k.request;

  const [startDate, setStartDate] = useState(last?.startDate ?? '');
  const [months, setMonths] = useState(String(last?.months ?? k.defaults.months ?? ''));
  const [daysPerWeek, setDaysPerWeek] = useState(String(last?.daysPerWeek ?? k.defaults.daysPerWeek ?? ''));
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(null);

  // Wie beim Angebot: erst beim Schließen neu laden, sonst ist die Bestätigung weg
  const sentRef = useRef(false);
  const afterClose = useRef(onSent);
  afterClose.current = onSent;
  useEffect(() => () => {
    if (!sentRef.current) return;
    queryClient.invalidateQueries({ queryKey: ['offer-context', c.submissionId] });
    afterClose.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const m = Number(months);
  const d = Number(daysPerWeek);
  const ready = !!startDate && Number.isInteger(m) && m >= 1 && m <= 60 && Number.isInteger(d) && d >= 1 && d <= 5;

  const send = async () => {
    setBusy(true);
    try {
      const res = await offerApi.einsatzAnfragen(c.submissionId, { startDate, months: m, daysPerWeek: d });
      sentRef.current = true;
      setSentAt(res.requestedAt);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('errors.einsatz'));
    } finally {
      setBusy(false);
    }
  };

  if (sentAt) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('client.einsatz.requested')}</DialogTitle>
          <DialogDescription>{c.jobTitle} · {name}</DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          {t('client.einsatz.matchuntAgrees', { hh })}
        </p>
        <div className="flex justify-end"><Button onClick={onClose}>{t('client.form.done')}</Button></div>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('client.einsatz.title', { name })}</DialogTitle>
        <DialogDescription>{[c.jobTitle, k.budget].filter(Boolean).join(' · ')}</DialogDescription>
      </DialogHeader>

      {last && (
        <p className="text-sm text-muted-foreground">
          {t('client.einsatz.last', { date: fmtDate(last.requestedAt), start: dayDe(last.startDate), months: last.months, days: last.daysPerWeek })}
        </p>
      )}

      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
        <div>
          <label htmlFor="einsatz-start" className="text-sm font-medium">{t('client.einsatz.start')}</label>
          <Input id="einsatz-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
        </div>
        <div>
          <label htmlFor="einsatz-monate" className="text-sm font-medium">{t('client.einsatz.months')}</label>
          <Input id="einsatz-monate" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, '').slice(0, 2))} placeholder="12" className="mt-1" />
        </div>
        <div>
          <label htmlFor="einsatz-tage" className="text-sm font-medium">{t('client.einsatz.days')}</label>
          <Input id="einsatz-tage" inputMode="numeric" value={daysPerWeek} onChange={(e) => setDaysPerWeek(e.target.value.replace(/[^\d]/g, '').slice(0, 1))} placeholder="5" className="mt-1" />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {t('client.einsatz.matchuntAgrees', { hh })}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          {!last && onAsk && <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onAsk(); }}>{t('client.form.askFirst', { hh: hhFirst })}</button>}
          {!last && onReject && <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => { onClose(); onReject(); }}>{t('client.form.rejectInstead')}</button>}
        </div>
        <Button disabled={!ready || busy} onClick={send} className="gap-1.5">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {last ? t('client.einsatz.again') : t('client.einsatz.request')}
        </Button>
      </div>
    </>
  );
}
