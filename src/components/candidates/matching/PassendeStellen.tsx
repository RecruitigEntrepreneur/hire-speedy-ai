/**
 * Passende Stellen (Match V4.1) in der Kandidatenakte – Wireframes 1–3:
 *   1 Karte in der Akte: Top 3 mit Stufe, Kurzgrund und nächstem Schritt
 *   2 Seitenpanel: alle Stellen, Filter nach Status, Ausschlüsse mit Grund
 *   3 „Warum passt das?": Kriterien mit wörtlichem Beleg, Rahmen, Klärfragen,
 *     Übersteuern (die KI schlägt vor, der Headhunter entscheidet – DSGVO Art. 22)
 *
 * Solange match-v41 nicht deployt ist, zeigt die Karte das bisherige Matching.
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, ChevronRight, Circle, CircleDot, Info, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ActivateJobDialog, useActivationGate } from '@/components/recruiter/ActivateJobDialog';
import { CandidateHeroMatching } from '@/components/candidates/CandidateHeroMatching';
import { useMatchV41, type MatchV41Row } from '@/hooks/useMatchV41';
import { confidenceLabel, effectiveTier, FRAME_LABEL, shortLine, TIER_STYLE, type MatchFrameItem, type MatchRequirementRow } from '@/lib/matchV41';
import { cn } from '@/lib/utils';

const REMOTE_LABELS: Record<string, string> = { remote: 'remote', hybrid: 'hybrid', onsite: 'vor Ort', field: 'Außendienst' };

function jobMeta(r: MatchV41Row): string {
  const j = r.job;
  if (!j) return '';
  const budget = j.salary_max ? `${j.salary_min ? `${Math.round(j.salary_min / 1000)}–` : 'bis '}${Math.round(j.salary_max / 1000)}k` : null;
  return [j.location, j.remote_type ? REMOTE_LABELS[j.remote_type] ?? j.remote_type : null, budget].filter(Boolean).join(' · ');
}

function TierBadge({ row }: { row: MatchV41Row }) {
  const t = effectiveTier(row);
  if (t === 'ausgeblendet') return <Badge variant="outline" className="shrink-0 text-xs font-normal">Ausgeblendet</Badge>;
  return <Badge variant="outline" className={cn('shrink-0 text-xs font-normal', TIER_STYLE[t].className)}>{TIER_STYLE[t].label}</Badge>;
}

type Gate = ReturnType<typeof useActivationGate>;

function NextStep({ row, gate, onSubmit, onActivate, onOpen }: {
  row: MatchV41Row; gate: Gate; onSubmit: (jobId: string) => void; onActivate: (row: MatchV41Row) => void; onOpen: (row: MatchV41Row) => void;
}) {
  if (row.submittedAt) {
    return <span className="shrink-0 text-xs text-muted-foreground">Eingereicht {format(new Date(row.submittedAt), 'd.M.', { locale: de })}</span>;
  }
  if (effectiveTier(row) === 'ausgeschlossen' || effectiveTier(row) === 'ausgeblendet') {
    return <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs" onClick={() => onOpen(row)}>Warum?</Button>;
  }
  if (gate.isActivated(row.job_id)) {
    return <Button size="sm" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => onSubmit(row.job_id)}>Einreichen</Button>;
  }
  if (gate.canActivate) {
    return <Button size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs" onClick={() => onActivate(row)}>Aktivieren</Button>;
  }
  return <span className="shrink-0 text-xs text-muted-foreground">Kein Platz frei ({gate.activeCount}/{gate.maxSlots})</span>;
}

function MatchLine({ row, gate, onSubmit, onActivate, onOpen }: {
  row: MatchV41Row; gate: Gate; onSubmit: (jobId: string) => void; onActivate: (row: MatchV41Row) => void; onOpen: (row: MatchV41Row) => void;
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(row)}>
        <span className="block truncate text-sm font-medium hover:underline">{row.job?.title ?? 'Stelle'}</span>
        <span className="block truncate text-xs text-muted-foreground">{jobMeta(row)}</span>
        <span className="block truncate text-xs text-muted-foreground">{shortLine(row)}</span>
      </button>
      <TierBadge row={row} />
      <NextStep row={row} gate={gate} onSubmit={onSubmit} onActivate={onActivate} onOpen={onOpen} />
    </li>
  );
}

export function PassendeStellenCard({ candidateId, firstName, onSubmit, onEditDossier }: {
  candidateId: string;
  firstName: string;
  onSubmit: (jobId?: string) => void;
  onEditDossier?: () => void;
}) {
  const m = useMatchV41(candidateId);
  const gate = useActivationGate();
  const [listOpen, setListOpen] = useState(false);
  const [detail, setDetail] = useState<MatchV41Row | null>(null);
  const [activateFor, setActivateFor] = useState<MatchV41Row | null>(null);

  const visible = useMemo(() => m.rows.filter((r) => ['sehr_passend', 'passend', 'pruefen'].includes(effectiveTier(r))), [m.rows]);
  const excluded = m.rows.length - visible.length;

  if (m.unavailable) return <CandidateHeroMatching candidateId={candidateId} onNavigateToMatching={() => {}} />;

  const top = visible.slice(0, 3);
  const openGap = top[0]?.frame.find((f) => f.status === 'unknown');

  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" /> Passende Stellen
          </CardTitle>
          {m.rows.length > 0 && (
            <button type="button" className="flex items-center gap-0.5 text-xs text-primary hover:underline" onClick={() => setListOpen(true)}>
              Alle ansehen ({visible.length}) <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {m.loading ? (
          <div className="space-y-3 py-1">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            <p className="text-xs text-muted-foreground">Die KI prüft die offenen Stellen Kriterium für Kriterium …</p>
          </div>
        ) : m.error ? (
          <p className="text-sm text-destructive">{m.error}</p>
        ) : top.length === 0 ? (
          <div className="space-y-1 py-1 text-sm text-muted-foreground">
            <p>{m.pending > 0 ? 'Die offenen Stellen werden noch geprüft …' : 'Unter den offenen Stellen passt gerade keine.'}</p>
            {excluded > 0 && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setListOpen(true)}>
                {excluded} ausgeschlossen – Gründe ansehen
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {top.map((r) => (
              <MatchLine key={r.job_id} row={r} gate={gate} onSubmit={onSubmit} onActivate={setActivateFor} onOpen={setDetail} />
            ))}
          </ul>
        )}
        {m.pending > 0 && top.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> {m.pending} weitere Stellen werden geprüft …</p>
        )}
        {openGap && (
          <p className="flex items-center gap-1.5 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">Sicherheit {confidenceLabel(top[0].confidence)}: {openGap.text}.</span>
            {onEditDossier && <button type="button" className="text-primary hover:underline" onClick={onEditDossier}>Nachtragen</button>}
          </p>
        )}
      </CardContent>

      <PassendeStellenSheet
        open={listOpen}
        onOpenChange={setListOpen}
        firstName={firstName}
        match={m}
        gate={gate}
        onSubmit={(id) => { setListOpen(false); onSubmit(id); }}
        onActivate={setActivateFor}
        onOpen={setDetail}
      />
      <WarumPasstSheet
        row={detail ? m.rows.find((r) => r.job_id === detail.job_id) ?? detail : null}
        firstName={firstName}
        gate={gate}
        onClose={() => setDetail(null)}
        onSubmit={(id) => { setDetail(null); onSubmit(id); }}
        onActivate={setActivateFor}
        onOverride={async (jobId, decision, reason) => {
          try {
            await m.override.mutateAsync({ jobId, decision, reason });
            toast.success(decision === 'hide' ? 'Stelle ausgeblendet' : decision === 'show' ? 'Stelle wird trotzdem vorgeschlagen' : 'Übersteuerung zurückgenommen');
            return true;
          } catch {
            toast.error('Konnte nicht gespeichert werden. Bitte später erneut versuchen.');
            return false;
          }
        }}
        saving={m.override.isPending}
      />
      <ActivateJobDialog
        job={activateFor ? { id: activateFor.job_id, title: activateFor.job?.title ?? 'Stelle' } : null}
        onClose={() => setActivateFor(null)}
        onActivated={() => { setActivateFor(null); gate.refetch(); }}
        gate={gate}
      />
    </Card>
  );
}

type Filter = 'alle' | 'einreichbar' | 'aktivierbar' | 'eingereicht' | 'ausgeschlossen';

function PassendeStellenSheet({ open, onOpenChange, firstName, match, gate, onSubmit, onActivate, onOpen }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  firstName: string;
  match: ReturnType<typeof useMatchV41>;
  gate: Gate;
  onSubmit: (jobId: string) => void;
  onActivate: (row: MatchV41Row) => void;
  onOpen: (row: MatchV41Row) => void;
}) {
  const [filter, setFilter] = useState<Filter>('alle');
  const [recomputing, setRecomputing] = useState(false);
  const isVisible = (r: MatchV41Row) => ['sehr_passend', 'passend', 'pruefen'].includes(effectiveTier(r));
  const groups: Record<Filter, MatchV41Row[]> = {
    alle: match.rows.filter(isVisible),
    einreichbar: match.rows.filter((r) => isVisible(r) && !r.submittedAt && gate.isActivated(r.job_id)),
    aktivierbar: match.rows.filter((r) => isVisible(r) && !r.submittedAt && !gate.isActivated(r.job_id)),
    eingereicht: match.rows.filter((r) => !!r.submittedAt),
    ausgeschlossen: match.rows.filter((r) => !isVisible(r)),
  };
  const LABEL: Record<Filter, string> = { alle: 'Alle', einreichbar: 'Einreichbar', aktivierbar: 'Aktivierbar', eingereicht: 'Eingereicht', ausgeschlossen: 'Ausgeschlossen' };
  const list = groups[filter];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Passende Stellen für {firstName}</SheetTitle>
          <SheetDescription>Die KI prüft jedes Kriterium mit Beleg. Die Stufe ist ein Vorschlag – du entscheidest.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(groups) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn('rounded-full border px-2.5 py-1 text-xs', filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-muted')}
            >
              {LABEL[f]} {groups[f].length}
            </button>
          ))}
        </div>
        {filter === 'ausgeschlossen' && (
          <p className="mt-3 text-xs text-muted-foreground">Ausgeschlossen wird nur mit Beleg. Du kannst jede Stelle trotzdem ansehen und vorschlagen.</p>
        )}
        {list.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Keine Stellen in dieser Auswahl.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {list.map((r) => <MatchLine key={r.job_id} row={r} gate={gate} onSubmit={onSubmit} onActivate={onActivate} onOpen={onOpen} />)}
          </ul>
        )}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{match.pending > 0 ? `${match.pending} Stellen werden noch geprüft …` : `${match.rows.length} offene Stellen geprüft`}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            disabled={recomputing}
            onClick={async () => { setRecomputing(true); try { await match.recompute(); } finally { setRecomputing(false); } }}
          >
            <RefreshCw className={cn('mr-1.5 h-3 w-3', recomputing && 'animate-spin')} /> Neu prüfen
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

const REQ_ICON: Record<MatchRequirementRow['status'], { icon: typeof Check; className: string; label: string }> = {
  met: { icon: Check, className: 'text-success', label: 'erfüllt' },
  partial: { icon: CircleDot, className: 'text-warning', label: 'teilweise' },
  not_met: { icon: X, className: 'text-destructive', label: 'nicht erfüllt' },
  unknown: { icon: Circle, className: 'text-muted-foreground', label: 'offen' },
};

const FRAME_ICON: Record<MatchFrameItem['status'], { icon: typeof Check; className: string }> = {
  ok: { icon: Check, className: 'text-success' },
  check: { icon: CircleDot, className: 'text-warning' },
  unknown: { icon: Circle, className: 'text-muted-foreground' },
  exclude: { icon: X, className: 'text-destructive' },
};

function RequirementItem({ r }: { r: MatchRequirementRow }) {
  const s = REQ_ICON[r.status];
  const Icon = s.icon;
  return (
    <li className="flex gap-2 py-1.5 text-sm">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.className)} aria-label={s.label} />
      <div className="min-w-0">
        <p>{r.text}</p>
        {r.evidence && <p className="text-xs italic text-muted-foreground">„{r.evidence}"</p>}
        {!r.evidence && r.status === 'unknown' && <p className="text-xs text-muted-foreground">Kein Beleg in der Akte – im Gespräch klären</p>}
        {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
      </div>
    </li>
  );
}

function WarumPasstSheet({ row, firstName, gate, onClose, onSubmit, onActivate, onOverride, saving }: {
  row: MatchV41Row | null;
  firstName: string;
  gate: Gate;
  onClose: () => void;
  onSubmit: (jobId: string) => void;
  onActivate: (row: MatchV41Row) => void;
  onOverride: (jobId: string, decision: 'show' | 'hide' | null, reason?: string) => Promise<boolean>;
  saving: boolean;
}) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!row) return null;
  const musts = row.requirements.filter((r) => r.class === 'must');
  const others = row.requirements.filter((r) => r.class !== 'must');
  const known = row.frame.filter((f) => f.status !== 'unknown').length + row.requirements.filter((r) => r.status !== 'unknown').length;
  const total = row.frame.length + row.requirements.length;
  const tier = effectiveTier(row);
  // Belegter Ausschluss aus dem Rahmen: die KI wurde nicht gefragt, „offen" wäre irreführend.
  const notJudged = !!row.exclusion && row.requirements.every((r) => r.status === 'unknown') && !row.summary;

  return (
    <Sheet open onOpenChange={(o) => { if (!o) { setReasonOpen(false); setReason(''); onClose(); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="pr-6">{firstName} × {row.job?.title ?? 'Stelle'}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex flex-wrap items-center gap-2">
              <TierBadge row={row} />
              <span className="text-xs">Sicherheit {confidenceLabel(row.confidence)} · {known} von {total} Angaben vorhanden</span>
            </div>
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {row.exclusion && (
            <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">Ausgeschlossen: {row.exclusion.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">Das ist ein Vorschlag mit Beleg. Wenn du es besser weißt, schlag die Stelle trotzdem vor.</p>
              {row.override?.decision === 'show' ? (
                <Button size="sm" variant="ghost" className="mt-2 h-7 px-2 text-xs" disabled={saving} onClick={() => onOverride(row.job_id, null)}>Übersteuerung zurücknehmen</Button>
              ) : (
                <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" disabled={saving} onClick={() => onOverride(row.job_id, 'show', 'Headhunter übersteuert Ausschluss')}>Trotzdem vorschlagen</Button>
              )}
            </div>
          )}

          {notJudged ? (
            <p className="text-sm text-muted-foreground">Die Kriterien wurden nicht einzeln geprüft, weil der Ausschlussgrund oben schon feststeht.</p>
          ) : (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Muss-Kriterien</h4>
              {musts.length ? <ul>{musts.map((r) => <RequirementItem key={r.id} r={r} />)}</ul> : <p className="py-1.5 text-sm text-muted-foreground">Die Stelle hat keine prüfbaren Muss-Kriterien.</p>}
            </section>
          )}

          {!notJudged && others.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kann- und lernbare Kriterien</h4>
              <ul>{others.map((r) => <RequirementItem key={r.id} r={r} />)}</ul>
            </section>
          )}

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rahmen</h4>
            <ul className="mt-1">
              {row.frame.map((f, i) => {
                const s = FRAME_ICON[f.status];
                const Icon = s.icon;
                return (
                  <li key={`${f.key}-${i}`} className="flex items-start gap-2 border-b border-border py-1.5 text-sm last:border-b-0">
                    <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', s.className)} />
                    <span className="w-28 shrink-0 text-muted-foreground">{FRAME_LABEL[f.key]}</span>
                    <span>{f.text}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {(row.summary || row.caps.length > 0) && (
            <section className="rounded-md bg-muted/50 p-3">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Sparkles className="h-3.5 w-3.5" /> KI-Einschätzung · mit Belegen geprüft</h4>
              {row.summary && <p className="mt-1.5 text-sm">{row.summary}</p>}
              {row.caps.length > 0 && !row.exclusion && (
                <p className="mt-1.5 text-xs text-muted-foreground">Warum nicht höher: {row.caps.join(' · ')}</p>
              )}
            </section>
          )}

          {row.talking_points.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Gesprächspunkte</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{row.talking_points.map((t) => <li key={t}>{t}</li>)}</ul>
            </section>
          )}

          <div className="space-y-3 border-t border-border pt-4">
            {row.override?.decision === 'hide' ? (
              <p className="text-sm text-muted-foreground">
                Von dir ausgeblendet{row.override.reason ? `: ${row.override.reason}` : ''}.{' '}
                <button type="button" className="text-primary hover:underline" disabled={saving} onClick={() => onOverride(row.job_id, null)}>Rückgängig</button>
              </p>
            ) : reasonOpen ? (
              <div className="space-y-2">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Warum passt es nicht? z. B. Kandidat will nicht in die Branche" className="min-h-[70px] text-sm" autoFocus />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={saving || !reason.trim()} onClick={async () => { if (await onOverride(row.job_id, 'hide', reason.trim())) { setReasonOpen(false); setReason(''); } }}>
                    Ausblenden
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setReasonOpen(false)}>Abbrechen</Button>
                </div>
              </div>
            ) : tier !== 'ausgeschlossen' && (
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground hover:underline" onClick={() => setReasonOpen(true)}>Passt nicht? Grund angeben</button>
            )}
            <div className="flex justify-end">
              {row.submittedAt ? (
                <span className="text-sm text-muted-foreground">Eingereicht am {format(new Date(row.submittedAt), 'd. MMMM yyyy', { locale: de })}</span>
              ) : gate.isActivated(row.job_id) ? (
                <Button onClick={() => onSubmit(row.job_id)}>Einreichen</Button>
              ) : gate.canActivate ? (
                <Button variant="outline" onClick={() => onActivate(row)}>Stelle aktivieren</Button>
              ) : (
                <span className="text-sm text-muted-foreground">Kein Platz frei ({gate.activeCount}/{gate.maxSlots})</span>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
