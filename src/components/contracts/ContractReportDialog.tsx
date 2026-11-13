import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contractApi, dateDe, euro, todayIso, type ContractContext } from '@/lib/contractApi';
import { Trans, useTranslation } from 'react-i18next';
import { fmtNumber } from '@/lib/localeFormat';

interface Props {
  ctx: ContractContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** report = melden; values = Meldung des Headhunters mit anderen Werten bestätigen */
  mode?: 'report' | 'values';
  onDone?: () => void;
}

const digits = (v: string) => {
  const n = Number(v.replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fmt = (n: number | null) => (n ? fmtNumber(n) : '');

/**
 * „Vertrag unterschrieben“ melden (Paket 3): Kunde (24 h rückgängig), Headhunter
 * (Kunde bestätigt) oder Matchunt (mit Beleg direkt). Fenster in der Mitte.
 */
export function ContractReportDialog({ ctx, open, onOpenChange, mode = 'report', onDone }: Props) {
  const { t } = useTranslation('contracts');
  const queryClient = useQueryClient();
  const c = ctx?.contract ?? null;
  const [signedOn, setSignedOn] = useState(todayIso());
  const [salary, setSalary] = useState('');
  const [variable, setVariable] = useState('');
  const [startDate, setStartDate] = useState('');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState('');
  const [closeJob, setCloseJob] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !ctx) return;
    setSignedOn(c?.signedOn ?? todayIso());
    setSalary(fmt(c?.salary ?? ctx.offer?.salary ?? null));
    setVariable(fmt(c?.variable ?? ctx.offer?.variable ?? null));
    setStartDate(c?.startDate ?? ctx.offer?.startDate ?? '');
    setNote(''); setEvidence(''); setCloseJob(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ctx?.submissionId]);

  if (!ctx) return null;
  const role = ctx.role;
  const first = ctx.candidateName.split(' ')[0];
  const sal = digits(salary);
  const vari = digits(variable);
  const fee = ctx.feePercent && sal ? Math.round(((sal + (vari ?? 0)) * ctx.feePercent) / 100) : null;
  const ready = !!signedOn && signedOn <= todayIso() && !!sal && !!startDate;
  const title = role === 'recruiter' ? t('report.titleRecruiter', { first }) : mode === 'values' ? t('report.titleValues') : t('report.titleClient', { name: ctx.candidateName });

  const save = async () => {
    setBusy(true);
    try {
      const values = { submissionId: ctx.submissionId, signedOn, salary: sal, variable: vari, startDate };
      if (mode === 'values') await contractApi.confirm(ctx.submissionId, 'values', values);
      else await contractApi.report({ ...values, closeJob: role === 'client' ? closeJob : undefined, note: note || undefined, evidence: evidence || undefined });
      toast.success(role === 'client' ? (mode === 'values' ? t('report.toast.clientValues') : t('report.toast.clientReport'))
        : role === 'recruiter' ? t('report.toast.recruiter', { company: ctx.companyName }) : evidence ? t('report.toast.adminEvidence') : t('report.toast.admin'));
      queryClient.invalidateQueries({ queryKey: ['contract', ctx.submissionId] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
      onDone?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {t('report.bothSigned', { job: ctx.jobTitle, who: role === 'recruiter' ? ctx.companyName : t('report.via', { name: ctx.recruiterName ?? t('report.yourRecruiter') }) })}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <label className="block"><span className="text-muted-foreground">{t('report.signedOn')}</span>
            <Input type="date" value={signedOn} max={todayIso()} onChange={(e) => setSignedOn(e.target.value)} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">{t('report.firstDay')}</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">{t('report.salary')}</span>
            <Input inputMode="numeric" value={salary} onChange={(e) => setSalary(fmt(digits(e.target.value)))} className="mt-1 h-9" /></label>
          <label className="block"><span className="text-muted-foreground">{t('report.variable')}</span>
            <Input inputMode="numeric" value={variable} onChange={(e) => setVariable(fmt(digits(e.target.value)))} placeholder={t('report.none')} className="mt-1 h-9" /></label>
        </div>
        {ctx.offer && sal && sal !== ctx.offer.salary && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{t('report.differsFromOffer', { amount: euro(ctx.offer.salary) })}</p>
        )}

        {role === 'client' && mode === 'report' && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={closeJob} onChange={(e) => setCloseJob(e.target.checked)} />
            <span>{t('report.closeJob')} <span className="text-muted-foreground">{t('report.closeJobHint')}</span></span>
          </label>
        )}
        {role === 'recruiter' && (
          <label className="block text-sm"><span className="text-muted-foreground">{t('report.note')}</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('report.notePlaceholder', { first })} className="mt-1 h-9" /></label>
        )}
        {role === 'admin' && mode === 'report' && (
          <label className="block text-sm"><span className="text-muted-foreground">{t('report.evidence')}</span>
            <Textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder={t('report.evidencePlaceholder')} className="mt-1" /></label>
        )}

        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
          {role === 'client' && fee !== null && <p><Trans ns="contracts" i18nKey="report.fee" values={{ percent: ctx.feePercent, base: euro(sal! + (vari ?? 0)), fee: euro(fee) }} components={{ b: <span className="font-medium text-foreground" /> }} /></p>}
          {role === 'client' && mode === 'report' && <p className="mt-1">{t('report.clientUndo', { recruiter: ctx.recruiterName ?? t('report.yourRecruiterNom'), first })}</p>}
          {role === 'client' && mode === 'values' && <p className="mt-1">{t('report.clientValues')}</p>}
          {role === 'recruiter' && <p>{t('report.recruiterHint', { company: ctx.companyName })}</p>}
          {role === 'admin' && <p>{t('report.adminOffer', { offer: ctx.offer ? (ctx.offer.variable ? t('report.adminOfferValuesVariable', { salary: euro(ctx.offer.salary), variable: euro(ctx.offer.variable), date: dateDe(ctx.offer.startDate) }) : t('report.adminOfferValues', { salary: euro(ctx.offer.salary), date: dateDe(ctx.offer.startDate) })) : t('report.adminNoOffer') })}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={busy || !ready} onClick={save}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {role === 'client' ? (mode === 'values' ? t('report.confirm') : t('report.confirmSignature')) : t('report.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
