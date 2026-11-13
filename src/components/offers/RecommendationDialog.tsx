import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { ANGEBOT_PUNKTE } from '@/lib/nachgespraech';
import { dayDe, euro, offerApi, type RecruiterOfferContext, type RecommendationItem } from '@/lib/offerApi';
import { useTranslation } from 'react-i18next';
import { fmtDate, fmtDayMonth, fmtNumber, tFor } from '@/lib/localeFormat';
import i18n from '@/i18n';
import { mapNoticeText, NOTICE_OPTIONS, optionLabel } from '@/lib/candidateDossier';
import { termKey } from '@/lib/candidateTerms';

interface Props {
  submissionId: string | null;
  onClose: () => void;
  onDone?: () => void;
  /** Fehlt das Nachgespräch: erst dorthin, danach ist hier alles vorbefüllt */
  onNachgespraech?: (c: RecruiterOfferContext) => void;
}

interface Row { key: string; label: string; value: string; on: boolean; placeholder: string; privateHint?: string }

const datum = (iso: string, lang?: string) => fmtDate(`${iso.slice(0, 10)}T12:00:00`, lang);
const ROW_KEYS = ['fix', 'variable', 'homeoffice', 'start', 'wichtig', 'gut_zu_wissen', 'bedenken'] as const;

/**
 * Vorschlag aus dem Nachgespräch. Die Schmerzgrenze steht nur als Hinweis für den Headhunter da.
 * Vorbefüllte Werte gehen an den Kunden: in seiner Sprache (`clientLang`); Beschriftung im Fenster
 * in der Sprache der Oberfläche, gesendet wird sie in der Sprache des Kunden (siehe `send`).
 */
function rowsFrom(c: RecruiterOfferContext, clientLang: string): Row[] {
  const tu = (key: string, options?: Record<string, unknown>) => i18n.t(`offers:${key}`, options);
  const tc = (key: string, options?: Record<string, unknown>) => tFor(clientLang, 'offers')(key, options) as string;
  const n = c.nachgespraech ?? {};
  const last = c.recommendation?.items ?? [];
  const prev = (key: string) => last.find((i) => i.key === key)?.value;
  const wunsch = (n.gehalt_besprochen ? n.gehalt_kandidat : null) ?? c.akte.expectedSalary;
  const punkte: string[] = n.angebot_punkte ?? [];
  // Kündigungsfrist als Text statt Code („3 Monate zum Quartalsende“), in der Sprache des Kunden
  const noticeDe = c.akte.noticePeriod ? optionLabel(NOTICE_OPTIONS, mapNoticeText(c.akte.noticePeriod)) ?? c.akte.noticePeriod : null;
  const notice = noticeDe ? tFor(clientLang, 'candidateTerms')(`t.${termKey(noticeDe)}`, { defaultValue: noticeDe }) as string : null;
  const start = n.start_art === 'sofort' ? tc('rec.value.startNow')
    : n.start_art === 'fester_tag' && n.start_datum ? tc('rec.value.from', { value: datum(n.start_datum, clientLang) })
      : n.start_art === 'nach_frist' ? (notice ? tc('rec.value.afterNoticeWith', { notice }) : tc('rec.value.afterNotice'))
        : c.akte.availabilityDate ? tc('rec.value.from', { value: datum(c.akte.availabilityDate, clientLang) }) : '';
  const wichtig = [
    punkte.filter((p) => p !== 'homeoffice').map((p) => tFor(clientLang, 'recruiterTasks')(`nach.options.angebot.${p}`, { defaultValue: ANGEBOT_PUNKTE.find((x) => x.key === p)?.label ?? p }) as string).join(', '),
    (n.angebot_text ?? '').trim(),
  ].filter(Boolean).join('. ');
  const values: Record<(typeof ROW_KEYS)[number], string> = {
    fix: prev('fix') ?? (wunsch ? tc('rec.value.from', { value: `${fmtNumber(wunsch, clientLang)} €` }) : ''),
    variable: prev('variable') ?? '',
    homeoffice: prev('homeoffice') ?? '',
    start: prev('start') ?? start,
    wichtig: prev('wichtig') ?? wichtig,
    gut_zu_wissen: prev('gut_zu_wissen') ?? '',
    bedenken: prev('bedenken') ?? (n.bedenken ?? ''),
  };
  const rows: Row[] = ROW_KEYS.map((key) => ({
    key,
    label: tu(`rec.rows.${key}`),
    value: values[key],
    // Bedenken nie vorab angehakt: der Headhunter entscheidet bewusst; Homeoffice nur, wenn besprochen
    on: key === 'bedenken' ? !!prev('bedenken') : key === 'homeoffice' ? punkte.includes('homeoffice') : true,
    placeholder: tu(`rec.placeholder.${key}`),
    privateHint: key === 'fix' && n.angebot_fix_min ? tu('rec.painLimit', { amount: euro(n.angebot_fix_min) }) : undefined,
  }));
  return rows.map((r) => ({ ...r, on: r.on && r.value.trim().length > 0 }));
}

/**
 * Empfehlung an den Kunden (Headhunter, 22.10.2026): was der Kandidat für eine Zusage
 * braucht, aus dem Nachgespräch vorbefüllt. Der Headhunter hakt an, was der Kunde sieht.
 */
export function RecommendationDialog({ submissionId, onClose, onDone, onNachgespraech }: Props) {
  const { t } = useTranslation('offers');
  const ctx = useQuery({
    queryKey: ['offer-recruiter-context', submissionId],
    queryFn: () => offerApi.recruiterContext(submissionId!),
    enabled: !!submissionId,
    staleTime: 10_000,
  });
  return (
    <Dialog open={!!submissionId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        {ctx.isLoading || !ctx.data ? (
          <>
            <DialogHeader><DialogTitle>{t('rec.title')}</DialogTitle><DialogDescription>{t('common.loading')}</DialogDescription></DialogHeader>
            {ctx.error
              ? <p className="text-sm text-destructive">{ctx.error instanceof Error ? ctx.error.message : t('common.loadError')}</p>
              : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </>
        ) : (
          <RecommendationForm c={ctx.data} onClose={onClose} onDone={onDone} onNachgespraech={onNachgespraech} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecommendationForm({ c, onClose, onDone, onNachgespraech }: { c: RecruiterOfferContext; onClose: () => void; onDone?: () => void; onNachgespraech?: (c: RecruiterOfferContext) => void }) {
  const { t, i18n: { language } } = useTranslation('offers');
  const queryClient = useQueryClient();
  const firma = c.companyName;
  const name = (c.candidateName ?? '').split(' ')[0] || t('rec.theCandidate');
  // Sprache des Kunden: der Kontext kennt weder Profilsprache noch Land, darum Deutsch (wie bisher)
  const clientLang = 'de';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Beschriftung folgt der Sprache der Oberfläche
  const initial = useMemo(() => rowsFrom(c, clientLang), [c, language]);
  const [rows, setRows] = useState<Row[]>(initial);
  const [intro, setIntro] = useState(c.recommendation?.intro ?? '');
  const [busy, setBusy] = useState(false);
  const [withoutTalk, setWithoutTalk] = useState(false);
  useEffect(() => { setRows(initial); }, [initial]);

  const set = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  // Die Beschriftung steht in der Karte beim Kunden: in seiner Sprache
  const chosen: RecommendationItem[] = rows.filter((r) => r.on && r.value.trim())
    .map((r) => ({ key: r.key, label: tFor(clientLang, 'offers')(`rec.rows.${r.key}`) as string, value: r.value.trim() }));
  const nachDatum = c.nachgespraech?.created_at ? fmtDayMonth(c.nachgespraech.created_at) : null;

  const send = async () => {
    setBusy(true);
    try {
      await offerApi.recommend(c.submissionId, intro, chosen);
      toast.success(t('rec.sent', { company: firma }));
      queryClient.invalidateQueries({ queryKey: ['offer-recruiter-context', c.submissionId] });
      notifyTasksChanged();
      onDone?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('common.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>{t('rec.heading', { company: firma })}</DialogTitle>
        <DialogDescription>
          {c.candidateName} · {c.jobTitle}.{nachDatum ? t('rec.fromNach', { date: nachDatum }) : ''}
        </DialogDescription>
      </DialogHeader>
      {c.recommendation && (
        <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {t('rec.lastSent', { date: dayDe(c.recommendation.createdAt) })}
        </p>
      )}

      {!c.nachgespraech && onNachgespraech && c.lastInterview && !withoutTalk && (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-sm">
          <p>{t('rec.noNach', { name })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => { onClose(); onNachgespraech(c); }}>{t('rec.doNach')}</Button>
            <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setWithoutTalk(true)}>{t('rec.withoutNach')}</button>
          </div>
        </div>
      )}

      <label className="block text-sm">
        <span className="text-muted-foreground">{t('rec.intro')}</span>
        <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={2} className="mt-1" placeholder={t('rec.introPlaceholder', { name })} />
      </label>

      <p className="text-xs text-muted-foreground">{t('rec.onlyChecked', { company: firma })}</p>

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className={cn('rounded-md border p-2', r.on ? 'border-primary/30 bg-primary/[0.03]' : 'border-border/60')}>
            <div className="flex items-center gap-2">
              <Checkbox id={`rec-${r.key}`} checked={r.on} onCheckedChange={(v) => set(r.key, { on: v === true })} disabled={!r.value.trim()} />
              <label htmlFor={`rec-${r.key}`} className="w-32 shrink-0 text-sm font-medium">{r.label}</label>
              <Input value={r.value} onChange={(e) => set(r.key, { value: e.target.value, on: e.target.value.trim() ? (r.value.trim() ? r.on : true) : false })}
                placeholder={r.placeholder} className="h-8 text-sm" aria-label={r.label} />
            </div>
            {r.privateHint && <p className="ml-6 mt-1 text-xs text-amber-600 dark:text-amber-400">{r.privateHint}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button disabled={busy || chosen.length === 0} title={chosen.length === 0 ? t('rec.checkOne') : undefined} onClick={send}>
          {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{t('rec.send')}
        </Button>
      </div>
    </>
  );
}
