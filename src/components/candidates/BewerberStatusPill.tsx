import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ArchiveKind, BewerberItem, BewerberState, BewerberTone } from '@/hooks/useBewerber';

const TONE_CLASSES: Record<BewerberTone, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  crit: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

export function bewerberStateLabel(item: BewerberItem, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (item.tab === 'archiv') {
    return t(`bewerber.archive.kind.${item.archiveKind || 'abgelehnt'}`);
  }
  return t(`bewerber.state.${item.state.key}`, item.state.params);
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
  const label =
    state.key === 'archiv'
      ? t(`bewerber.archive.kind.${archiveKind || 'abgelehnt'}`)
      : t(`bewerber.state.${state.key}`, state.params);
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
