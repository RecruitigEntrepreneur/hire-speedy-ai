import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { REJECTION_CATEGORIES } from '@/components/rejection/RejectionReasonSelector';
import type { ArchiveKind, BewerberItem, BewerberState, BewerberTone } from '@/hooks/useBewerber';

const TONE_CLASSES: Record<BewerberTone, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  crit: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

type T = (key: string, opts?: Record<string, unknown>) => string;

/** Pillentext: mit Datum bei Anfrage („Angefragt 12.10. · seit 8 Tagen“) und Absage („Abgelehnt 23.07. · Gehaltsvorstellung“). */
export function stateLabel(state: BewerberState, archiveKind: ArchiveKind | null | undefined, t: T): string {
  const p = state.params ?? {};
  if (state.key === 'archiv') {
    const kind = archiveKind || 'abgelehnt';
    if (kind === 'abgelehnt' && p.date) {
      const grund = REJECTION_CATEGORIES.find((c) => c.value === p.grund)?.label;
      return grund
        ? t('bewerber.archive.kind.abgelehnt_dated_grund', { date: p.date, grund })
        : t('bewerber.archive.kind.abgelehnt_dated', { date: p.date });
    }
    return t(`bewerber.archive.kind.${kind}`);
  }
  if (state.key === 'wartet_kandidat' && p.date) {
    const days = Number(p.days ?? 0);
    return t(days === 0 ? 'bewerber.state.angefragt_heute' : days === 1 ? 'bewerber.state.angefragt_gestern' : 'bewerber.state.angefragt', p);
  }
  return t(`bewerber.state.${state.key}`, p);
}

export function bewerberStateLabel(item: BewerberItem, t: T): string {
  return stateLabel(item.state, item.archiveKind, t);
}

// Niedrigschwellige Pille für Stellen, an denen kein volles BewerberItem existiert
// (z. B. Detailseite) — gleiche Wort+Farb-Sprache wie die Inbox.
export function StatePill({
  state,
  archiveKind,
  className,
}: {
  state: BewerberState;
  archiveKind?: ArchiveKind | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const label = stateLabel(state, archiveKind, t);
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASSES[state.tone],
        className
      )}
    >
      {label}
    </span>
  );
}

export function BewerberStatusPill({ item, className }: { item: BewerberItem; className?: string }) {
  return <StatePill state={item.state} archiveKind={item.archiveKind} className={className} />;
}
