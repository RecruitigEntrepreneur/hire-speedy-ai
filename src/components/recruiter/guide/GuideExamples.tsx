import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Calendar, Lock, MapPin, MessageSquareText, Search, Unlock, Users, Video } from 'lucide-react';
import type { GuideExample } from '@/lib/recruiterGuide';

/** Beispiele im Rundgang: ausgedachte Daten, klar als Beispiel markiert. */
function Frame({ children }: { children: ReactNode }) {
  const { t } = useTranslation('recruiterGuide');
  return <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-3">
    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{t('ui.example')}</p>
    {children}
  </div>;
}

const Chip = ({ children, strong = false }: { children: ReactNode; strong?: boolean }) =>
  <span className={strong ? 'rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground' : 'rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground'}>{children}</span>;

const PHASES = ['submitted', 'inReview', 'interviewRequested', 'optIn', 'scheduled', 'interviewed', 'offer', 'placed'] as const;

export function GuideExampleView({ kind }: { kind: GuideExample }) {
  const { t: tx } = useTranslation('recruiterGuide');
  const t = (key: string) => tx(`examples.${key}`);
  switch (kind) {
    case 'job': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug">{t('job.title')}</p>
          <p className="shrink-0 text-right"><span className="block text-sm font-semibold">{t('job.fee')}</span><span className="text-[10px] text-muted-foreground">{t('job.feeNote')}</span></p>
        </div>
        <p className="mt-1.5 flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{t('job.company')}</p>
        <p className="mt-1 flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{t('job.place')}</p>
        <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{t('job.activity')}</span>
          <span className="flex items-center gap-1"><Search className="h-3 w-3" />{t('job.searching')}</span>
        </div>
      </div>
    </Frame>;
    case 'submit': return <Frame>
      <ol className="space-y-1.5 text-xs">
        {[t('submit.step1'), t('submit.step2'), t('submit.step3'), t('submit.step4')].map((text, i) =>
          <li key={i} className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">{i + 1}</span>{text}</li>)}
      </ol>
    </Frame>;
    case 'candidate': return <Frame>
      <div className="flex items-center gap-3 rounded-md border border-border bg-card p-3 text-xs">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">{t('candidate.initials')}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t('candidate.name')}</p>
          <p className="text-muted-foreground">{t('candidate.role')}</p>
          <p className="text-muted-foreground">{t('candidate.place')}</p>
        </div>
      </div>
    </Frame>;
    case 'pipeline': return <Frame>
      <div className="flex flex-wrap items-center gap-1">
        {PHASES.map((phase, i) => <span key={phase} className="flex items-center gap-1"><Chip strong={phase === 'interviewRequested'}>{t(`pipeline.${phase}`)}</Chip>{i < PHASES.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}</span>)}
      </div>
    </Frame>;
    case 'optin': return <Frame>
      <ol className="space-y-1.5 text-xs">
        {[
          { icon: MessageSquareText, text: t('optin.step1') },
          { icon: Users, text: t('optin.step2') },
          { icon: Unlock, text: t('optin.step3') },
          { icon: Calendar, text: t('optin.step4') },
        ].map(({ icon: Icon, text }, i) => <li key={i} className="flex items-center gap-2"><Icon className="h-3.5 w-3.5 shrink-0 text-primary" />{text}</li>)}
      </ol>
    </Frame>;
    case 'task': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <div className="flex items-center gap-1.5"><Chip strong>{t('task.pill')}</Chip><span className="text-[11px] font-medium text-destructive">{t('task.urgent')}</span></div>
        <p className="mt-2 text-sm font-medium">{t('task.title')}</p>
        <p className="text-muted-foreground">{t('task.text')}</p>
      </div>
    </Frame>;
    case 'interview': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <p className="flex items-center gap-1.5 text-sm font-medium"><Video className="h-3.5 w-3.5 text-primary" />{t('interview.when')}</p>
        <p className="mt-1 text-muted-foreground">{t('interview.kind')}</p>
        <p className="mt-2 text-muted-foreground">{t('interview.after')}</p>
      </div>
    </Frame>;

    // ---- Kunden-Rundgang (lib/clientGuide.ts) ------------------------------
    case 'clientSubmit': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <p className="text-sm font-semibold">{t('clientSubmit.title')}</p>
        <p className="mt-1 text-muted-foreground">{t('clientSubmit.text')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2"><Chip>{t('clientSubmit.topUp')}</Chip><Chip strong>{t('clientSubmit.submit')}</Chip></div>
      </div>
    </Frame>;
    case 'clientStatus': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">{t('clientStatus.title')} <Chip>{t('clientStatus.state')}</Chip></p>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[['submitted', 'done'], ['review', 'now'], ['live', ''], ['candidates', '']].map(([label, st]) =>
            <div key={label} className={st === 'done' ? 'border-t-[3px] border-emerald-500 pt-1' : st === 'now' ? 'border-t-[3px] border-primary pt-1 font-medium' : 'border-t-[3px] border-border pt-1 text-muted-foreground'}>{st === 'done' ? '✓ ' : ''}{t(`clientStatus.${label}`)}</div>)}
        </div>
      </div>
    </Frame>;
    case 'clientCandidate': return <Frame>
      <div className="rounded-md border border-border bg-card p-3 text-xs">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold">{t('clientCandidate.title')}</p>
          <p className="shrink-0 text-sm font-semibold text-emerald-600">{t('clientCandidate.match')}</p>
        </div>
        <p className="mt-1 text-muted-foreground">{t('clientCandidate.quote')}</p>
        <p className="mt-1.5 flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3 shrink-0" />{t('clientCandidate.locked')}</p>
        <div className="mt-2 flex items-center gap-2"><Chip strong>{t('clientCandidate.meet')}</Chip><Chip>{t('clientCandidate.decline')}</Chip></div>
      </div>
    </Frame>;
  }
}
