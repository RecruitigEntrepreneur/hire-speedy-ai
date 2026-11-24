import { Check, Circle, FileText, MessagesSquare, Pencil, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18next from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { term } from '@/lib/candidateTerms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useState } from 'react';
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
          <CardTitle className="text-[15px] font-semibold tracking-tight">{t('cards.readyTitle')}</CardTitle>
          <span className="text-xs text-muted-foreground">
            {t('cards.doneOf', { done: readiness.done, total: readiness.total })}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-klick transition-all" style={{ width: `${(readiness.done / readiness.total) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {readiness.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {/* Apple-Stil (24.11.2026): kein Grün und kein Orange, offene Punkte mit leerem Kreis */}
              {item.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-foreground" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span>{term(item.label)}</span>
              {!item.ok && (
                <button
                  type="button"
                  className="text-xs font-medium text-klick hover:underline"
                  onClick={() => (item.key === 'interview' ? onStartInterview() : item.action === 'upload_cv' ? onUploadCv() : onEdit({ section: item.section, field: item.field }))}
                >
                  {item.key === 'interview' ? t('cards.actComplete') : item.action === 'upload_cv' ? t('cards.actUpload') : t('cards.actEnter')} ›
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
            <button type="button" className="font-medium text-klick hover:underline" onClick={onUploadCv}>
              {t('cards.replace')} ›
            </button>
          </p>
        )}
        <ReadinessSchluss {...{ readiness, firstName, onEdit, onUploadCv, onStartInterview, onCompleteAndSubmit, onViewExpose, onSubmit }} />
      </CardContent>
    </Card>
  );
}

type ReadinessProps = {
  readiness: Readiness;
  firstName: string;
  onEdit: (focus: EditFocus) => void;
  onUploadCv: () => void;
  onStartInterview: () => void;
  onCompleteAndSubmit?: () => void;
  onViewExpose: () => void;
  onSubmit: () => void;
};

/** Satz und Knopf je nach Stand; gemeinsam für die Karte und den Ring im Kopf (24.11.2026). */
function ReadinessSchluss({ readiness, firstName, onEdit, onUploadCv, onStartInterview, onCompleteAndSubmit, onViewExpose, onSubmit }: ReadinessProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  const onlyCvMissing = readiness.missing.length === 1 && readiness.missing[0].action === 'upload_cv';
  return (
    readiness.isReady ? (
      <div className="space-y-2.5">
        <p className="text-sm font-medium">{t('cards.allComplete', { name: firstName })}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onViewExpose}>
            <FileText className="mr-1.5 h-3.5 w-3.5" /> {t('cards.viewExpose')}
          </Button>
          <Button size="sm" variant="outline" onClick={onSubmit}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> {t('cards.submit')}
          </Button>
        </div>
      </div>
    ) : onlyCvMissing ? (
      <div className="space-y-2.5">
        <p className="text-sm">{t('cards.onlyCvMissing', { name: firstName })}</p>
        <Button size="sm" variant="outline" onClick={onUploadCv}>
          <Upload className="mr-1.5 h-3.5 w-3.5" /> {t('cards.uploadCv')}
        </Button>
      </div>
    ) : readiness.missing.length === 1 && readiness.missing[0].key === 'interview' && onCompleteAndSubmit ? (
      <div className="space-y-2.5">
        <p className="text-sm">{t('cards.interviewOpen', { name: firstName })}</p>
        <Button size="sm" variant="outline" onClick={onCompleteAndSubmit}>
          <MessagesSquare className="mr-1.5 h-3.5 w-3.5" /> {t('cards.completeAndSubmit')}
        </Button>
      </div>
    ) : readiness.items.find((i) => i.key === 'interview')?.ok && readiness.missing[0] ? (
      // Interview schon abgeschlossen, es fehlen nur Angaben: direkt zum ersten offenen Feld.
      <Button size="sm" variant="outline" onClick={() => onEdit({ section: readiness.missing[0].section, field: readiness.missing[0].field })}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> {t('cards.fillMissing')}
      </Button>
    ) : (
      // Grau: blau ist auf der Seite nur „Zum Gespräch einladen“ bzw. „Auf Stelle einreichen“ (24.11.2026)
      <Button size="sm" variant="outline" onClick={onStartInterview}>
        <MessagesSquare className="mr-1.5 h-3.5 w-3.5" /> {t('cards.startInterview')}
      </Button>
    )
  );
}

/**
 * „Bereit zum Einreichen“ als Stand-Zeile im Profilkopf (erst Kasten, seit 25.11.2026 Zeile). Zeigt nur, was fehlt, jeweils als Link; alles Weitere im Fenster.
 */
export function DossierReadinessKasten(props: ReadinessProps) {
  const { readiness, onEdit, onUploadCv, onStartInterview, onViewExpose } = props;
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  const [offenListe, setOffenListe] = useState(false);
  const offen = readiness.items.filter((i) => !i.ok);
  const anteil = readiness.total ? readiness.done / readiness.total : 0;
  const handlung = (item: Readiness['items'][number]) =>
    item.key === 'interview' ? onStartInterview() : item.action === 'upload_cv' ? onUploadCv() : onEdit({ section: item.section, field: item.field });
  const link = 'font-medium text-klick hover:underline';
  // Jeder Knopf im Fenster schließt es zuerst, sonst bleibt es über dem geöffneten Ziel stehen
  const zu = <A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => { setOffenListe(false); fn(...a); };
  const imFenster: ReadinessProps = {
    ...props,
    onEdit: zu(props.onEdit), onUploadCv: zu(props.onUploadCv), onStartInterview: zu(props.onStartInterview),
    onCompleteAndSubmit: props.onCompleteAndSubmit && zu(props.onCompleteAndSubmit), onViewExpose: zu(props.onViewExpose), onSubmit: zu(props.onSubmit),
  };

  return (
    // Stand-Zeile statt Kasten (Marko, Vorschlag A, 25.11.2026): ruhig über die Breite, rechts daneben der Talent Pool
    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
      <span className="flex items-center gap-1 font-medium">
        {readiness.isReady && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
        {t('cards.readyTitle')}
      </span>
      <span className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <span className="block h-full rounded-full bg-klick" style={{ width: `${anteil * 100}%` }} />
      </span>
      <span className="text-muted-foreground">{t('cards.doneOf', { done: readiness.done, total: readiness.total })}</span>
      <Popover open={offenListe} onOpenChange={setOffenListe}>
        <span className="text-muted-foreground">
          {readiness.isReady ? (
            <>
              <button type="button" className={link} onClick={onViewExpose}>{t('cards.viewExpose')} ›</button>
              {' · '}
              <PopoverTrigger asChild><button type="button" className={link}>{t('cards.allPoints')} ›</button></PopoverTrigger>
            </>
          ) : offen.length <= 3 ? (
            <>
              {t('cards.missingLabel')}{' '}
              {offen.map((item, i) => (
                <span key={item.key}>
                  {i > 0 && ' · '}
                  <button type="button" className={link} onClick={() => handlung(item)}>{term(item.label)} ›</button>
                </span>
              ))}
              {' · '}
              <PopoverTrigger asChild><button type="button" className={link}>{t('cards.allPoints')} ›</button></PopoverTrigger>
            </>
          ) : (
            <>
              {t('cards.missingLabel')}{' '}
              <PopoverTrigger asChild><button type="button" className={link}>{t('cards.missingPoints', { count: offen.length })} ›</button></PopoverTrigger>
            </>
          )}
        </span>
        <PopoverContent align="start" className="w-80 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-semibold tracking-tight">{t('cards.readyTitle')}</p>
            <span className="text-xs text-muted-foreground">{t('cards.doneOf', { done: readiness.done, total: readiness.total })}</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {readiness.items.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                {item.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-foreground" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <span className={item.ok ? 'min-w-0 flex-1 text-muted-foreground' : 'min-w-0 flex-1'}>{term(item.label)}</span>
                {!item.ok && (
                  <button type="button" className={`shrink-0 text-xs ${link}`} onClick={() => { setOffenListe(false); handlung(item); }}>
                    {item.key === 'interview' ? t('cards.actComplete') : item.action === 'upload_cv' ? t('cards.actUpload') : t('cards.actEnter')} ›
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            <ReadinessSchluss {...imFenster} />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function Row({ label, value, onFix, fehltText }: { label: string; value: string | null; onFix?: () => void; fehltText?: string }) {
  const { t } = useTranslation('candidateDossier');
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      {onFix ? (
        <span className="text-right">
          {value && <span className="mr-2">{value}</span>}
          <span className="text-muted-foreground">{fehltText ?? t('cards.missing')}</span>
          <button type="button" className="ml-2 text-xs font-medium text-klick hover:underline" onClick={onFix}>{t('cards.actEnter')} ›</button>
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
          <CardTitle className="text-[15px] font-semibold tracking-tight">{t('cards.factsTitle')}</CardTitle>
          <button type="button" className="text-sm font-medium text-klick hover:underline" aria-label={t('cards.factsEdit')} onClick={() => onEdit({ section: 'wechsel' })}>
            {t('cards.editShort')} ›
          </button>
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
