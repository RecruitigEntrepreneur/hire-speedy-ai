import { Check, Circle, FileText, MessagesSquare, Pencil, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18next from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { term } from '@/lib/candidateTerms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DossierForm,
  EMPLOYMENT_OPTIONS,
  NOTICE_OPTIONS,
  PERMIT_OPTIONS,
  Readiness,
  WORK_MODEL_OPTIONS,
  missingFieldSet,
  optionLabel,
} from '@/lib/candidateDossier';
import type { EditFocus } from './CandidateEditSheet';
import { CurrentCv, cvStandDate } from '@/lib/candidateCv';
import { cvViewUrl } from '@/hooks/useCandidateCv';

async function openCv(cv: CurrentCv) {
  const url = await cvViewUrl(cv);
  if (url) window.open(url, '_blank', 'noopener');
  else toast.error(i18next.t('candidateDossier:cards.cvOpenFailed'));
}

export function DossierReadinessCard({
  readiness,
  firstName,
  cv,
  onEdit,
  onUploadCv,
  onStartInterview,
  onCompleteAndSubmit,
  onViewExpose,
  onSubmit,
}: {
  readiness: Readiness;
  firstName: string;
  /** Aktueller Lebenslauf; null = fehlt */
  cv: CurrentCv | null;
  onEdit: (focus: EditFocus) => void;
  /** Lebenslauf hochladen oder ersetzen */
  onUploadCv: () => void;
  onStartInterview: () => void;
  /** Fehlt nur noch das Interview: abschließen und danach direkt einreichen. */
  onCompleteAndSubmit?: () => void;
  onViewExpose: () => void;
  onSubmit: () => void;
}) {
  const { t, i18n } = useTranslation(['candidateDossier', 'candidateTerms']);
  const onlyCvMissing = readiness.missing.length === 1 && readiness.missing[0].action === 'upload_cv';
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t('cards.readyTitle')}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {t('cards.doneOf', { done: readiness.done, total: readiness.total })}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(readiness.done / readiness.total) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {readiness.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {item.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-warning" />}
              <span className={item.ok ? '' : 'text-warning'}>{term(item.label)}</span>
              {!item.ok && (
                <button
                  type="button"
                  className="text-xs text-primary underline-offset-2 hover:underline"
                  onClick={() => (item.key === 'interview' ? onStartInterview() : item.action === 'upload_cv' ? onUploadCv() : onEdit({ section: item.section, field: item.field }))}
                >
                  {item.key === 'interview' ? t('cards.actComplete') : item.action === 'upload_cv' ? t('cards.actUpload') : t('cards.actEnter')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {cv && (
          <p className="text-xs text-muted-foreground">
            {t('cards.cv')}{' '}
            <button type="button" className="text-foreground underline-offset-2 hover:underline" onClick={() => openCv(cv)}>
              {cv.file_name}
            </button>
            {' · '}{t('cards.cvAsOf', { date: new Date(cvStandDate(cv)).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric' }) })}{' · '}
            <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={onUploadCv}>
              {t('cards.replace')}
            </button>
          </p>
        )}
        {readiness.isReady ? (
          <div className="space-y-2.5">
            <p className="text-sm text-success">{t('cards.allComplete', { name: firstName })}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onViewExpose}>
                <FileText className="mr-1.5 h-3.5 w-3.5" /> {t('cards.viewExpose')}
              </Button>
              <Button size="sm" onClick={onSubmit}>
                <Send className="mr-1.5 h-3.5 w-3.5" /> {t('cards.submit')}
              </Button>
            </div>
          </div>
        ) : onlyCvMissing ? (
          <div className="space-y-2.5">
            <p className="text-sm text-warning">{t('cards.onlyCvMissing', { name: firstName })}</p>
            <Button size="sm" onClick={onUploadCv}>
              <Upload className="mr-1.5 h-3.5 w-3.5" /> {t('cards.uploadCv')}
            </Button>
          </div>
        ) : readiness.missing.length === 1 && readiness.missing[0].key === 'interview' && onCompleteAndSubmit ? (
          <div className="space-y-2.5">
            <p className="text-sm text-warning">{t('cards.interviewOpen', { name: firstName })}</p>
            <Button size="sm" onClick={onCompleteAndSubmit}>
              <MessagesSquare className="mr-1.5 h-3.5 w-3.5" /> {t('cards.completeAndSubmit')}
            </Button>
          </div>
        ) : readiness.items.find((i) => i.key === 'interview')?.ok && readiness.missing[0] ? (
          // Interview schon abgeschlossen, es fehlen nur Angaben: direkt zum ersten offenen Feld.
          <Button size="sm" variant="outline" onClick={() => onEdit({ section: readiness.missing[0].section, field: readiness.missing[0].field })}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> {t('cards.fillMissing')}
          </Button>
        ) : (
          <Button size="sm" onClick={onStartInterview}>
            <MessagesSquare className="mr-1.5 h-3.5 w-3.5" /> {t('cards.startInterview')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, onFix, fehltText }: { label: string; value: string | null; onFix?: () => void; fehltText?: string }) {
  const { t } = useTranslation('candidateDossier');
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0">
      <span className={onFix ? 'text-warning' : 'text-muted-foreground'}>{label}</span>
      {onFix ? (
        <span className="text-right">
          {value && <span className="mr-2">{value}</span>}
          <span className="text-warning">{fehltText ?? t('cards.missing')}</span>
          <button type="button" className="ml-2 text-xs text-primary underline-offset-2 hover:underline" onClick={onFix}>{t('cards.actEnter')}</button>
        </span>
      ) : (
        <span className={value ? 'text-right' : 'text-muted-foreground'}>{value ?? '–'}</span>
      )}
    </div>
  );
}

export function DossierFactsCard({ form, onEdit }: { form: DossierForm; onEdit: (focus: EditFocus) => void }) {
  const { t, i18n } = useTranslation(['candidateDossier', 'candidateTerms']);
  const euro = (n: number) => `${n.toLocaleString(intlLocale(i18n.language))} €`;
  // Pflichtangaben aus „Bereit zum Einreichen“, die fehlen: orange mit „eintragen“.
  const fehlt = missingFieldSet(form);
  const fix = (field: string, section: EditFocus['section']) => (fehlt.has(field) ? () => onEdit({ section, field }) : undefined);
  const commute = form.max_commute_minutes ? t('cards.maxCommute', { n: form.max_commute_minutes }) : null;
  const workModel = [term(optionLabel(WORK_MODEL_OPTIONS, form.remote_preference)) || null, commute].filter(Boolean).join(', ') || null;
  const motivation = form.change_motivation.trim() || (form.change_motivation_tags.length ? form.change_motivation_tags.map((x) => term(x)).join(', ') : null);
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t('cards.factsTitle')}</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('cards.factsEdit')} onClick={() => onEdit({ section: 'wechsel' })}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Row label={t('blocks.currentSalary')} value={form.current_salary ? euro(form.current_salary) : null} />
        <Row label={t('blocks.expectedSalary')} value={form.expected_salary ? euro(form.expected_salary) : null} onFix={fix('expected_salary', 'wechsel')} />
        <Row label={t('blocks.salaryMinimum')} value={form.salary_minimum ? euro(form.salary_minimum) : null} />
        <Row label={t('blocks.notice')} value={term(optionLabel(NOTICE_OPTIONS, form.notice_period)) || null} onFix={fix('notice_period', 'wechsel')} />
        <Row label={t('blocks.workModel')} value={workModel} onFix={fix('remote_preference', 'arbeitsort') ?? fix('max_commute_minutes', 'arbeitsort')} fehltText={fehlt.has('remote_preference') ? undefined : fehlt.has('max_commute_minutes') ? t('cards.commuteMissing') : undefined} />
        <Row label={t('cards.employment')} value={term(optionLabel(EMPLOYMENT_OPTIONS, form.employment_type)) || null} />
        <Row label={t('edit.tab.sprachen')} value={form.languages.length ? form.languages.map((l) => (l.proficiency ? `${term(l.language)} (${term(l.proficiency)})` : term(l.language))).join(', ') : null} onFix={fix('languages', 'sprachen')} />
        <Row label={t('edit.tab.arbeitserlaubnis')} value={term(optionLabel(PERMIT_OPTIONS, form.work_permit)) || null} />
        <Row label={t('blocks.motivation')} value={motivation} onFix={fix('change_motivation', 'wechsel')} />
      </CardContent>
    </Card>
  );
}
