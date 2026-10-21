import { Link } from 'react-router-dom';
import { ArrowLeft, Check, CircleHelp, Loader2, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { CandidateForJob } from '@/hooks/useCandidateForJob';
import { FIT_LABEL, isFitting, mustSplit } from '@/lib/matchFit';
import { cn } from '@/lib/utils';

/** Streifen über der Stelle: für wen du schaust, was belegt und was offen ist. */
export function CandidateJobStrip({ ctx, candidateId }: { ctx: CandidateForJob; candidateId: string }) {
  const back = (
    <Link to={`/recruiter/candidates/${candidateId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
      <ArrowLeft className="h-3.5 w-3.5" />zurück zu {ctx.candidate?.firstName ?? 'Kandidat'}
    </Link>
  );
  const wrap = (tone: 'info' | 'danger', children: React.ReactNode) => (
    <div className={cn('mx-auto mb-5 max-w-[1440px] rounded-lg border px-4 py-3 text-sm',
      tone === 'danger' ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/5')}>
      {children}
    </div>
  );

  if (ctx.loading || !ctx.candidate) {
    return wrap('info', <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Passung wird geprüft …</span>);
  }
  const { firstName, full_name } = ctx.candidate;
  const profile = `/recruiter/candidates/${candidateId}`;

  if (ctx.submittedAt) {
    return wrap('info', <p>{back} · {firstName} ist hier seit {new Date(ctx.submittedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} eingereicht · <Link to={profile} className="text-primary hover:underline">zum Profil ›</Link></p>);
  }
  if (!ctx.matchDown && !isFitting(ctx.fit)) {
    return wrap('danger', (
      <p className="flex flex-wrap items-center gap-x-1.5">
        {back} · <XCircle className="h-4 w-4 text-destructive" />
        <span className="font-medium">{firstName} passt laut Matching nicht zu dieser Stelle{ctx.item?.exclusion ? `: ${ctx.item.exclusion.text}` : ''}.</span>
      </p>
    ));
  }
  if (ctx.readiness && !ctx.readiness.isReady) {
    return wrap('info', <p>{back} · {firstName} ist noch nicht bereit ({ctx.readiness.done} von {ctx.readiness.total}) · <Link to={profile} className="text-primary hover:underline">Interview abschließen ›</Link></p>);
  }

  const split = ctx.item ? mustSplit(ctx.item) : { met: [], open: [] };
  const talk = ctx.item?.talking_points?.[0] ?? null;
  return wrap('info', (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-x-1.5">
        {back} · <span className="font-medium">Du schaust für {full_name}</span>
        {isFitting(ctx.fit) && <Badge variant="outline" className="text-[11px]">{FIT_LABEL[ctx.fit]}</Badge>}
      </p>
      {(split.met.length > 0 || split.open.length > 0) && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {split.met.slice(0, 4).map((t) => <span key={t} className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><Check className="h-3.5 w-3.5" />{t}</span>)}
          {split.open.slice(0, 4).map((t) => <span key={t} className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><CircleHelp className="h-3.5 w-3.5" />{t}</span>)}
          {split.open.length > 0 && <span className="text-muted-foreground">→ vorher mit {firstName} klären</span>}
        </p>
      )}
      {split.met.length === 0 && split.open.length === 0 && ctx.item?.gaps?.[0] && (
        <p className="text-amber-600 dark:text-amber-400">{ctx.item.gaps[0]}</p>
      )}
      {talk && <p className="text-xs text-muted-foreground">Gesprächspunkt: {talk}</p>}
      {ctx.matchDown && <p className="text-xs text-muted-foreground">Die Passung konnte gerade nicht geprüft werden.</p>}
    </div>
  ));
}
