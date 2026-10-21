import { cn } from '@/lib/utils';
import { AWARD_LABEL, type LigaAwardKind } from '@/lib/liga';

/**
 * Abzeichen der Matchunt Liga: schwarze Karte mit Gold wie die Gold-Partner-Karte,
 * immer mit Saison („Matchunt Liga · Q3 2026“). Feste Farben wie Signatur und Prüfseite.
 */
const SIZES = {
  sm: { box: 'gap-1.5 rounded-lg px-2 py-1', star: 'text-sm', top: 'text-[9px]', main: 'text-[11px]' },
  md: { box: 'gap-2 rounded-[10px] py-1.5 pl-2.5 pr-3', star: 'text-lg', top: 'text-[10px]', main: 'text-sm' },
  lg: { box: 'gap-2.5 rounded-xl py-2.5 pl-3 pr-4', star: 'text-2xl', top: 'text-[11px]', main: 'text-base' },
} as const;

export function LigaAwardCard({ award, season, size = 'md', className }: {
  award: LigaAwardKind; season: string; size?: keyof typeof SIZES; className?: string;
}) {
  const s = SIZES[size];
  return <span role="img" aria-label={`${AWARD_LABEL[award]} · Matchunt Liga · ${season}`}
    className={cn('inline-flex shrink-0 items-center whitespace-nowrap border border-[#27272A] bg-[#0A0A0A] text-white', s.box, className)}>
    <span aria-hidden className={cn('leading-none text-[#C8A24A]', s.star)}>✦</span>
    <span aria-hidden className="text-left leading-tight">
      <span className={cn('block font-semibold', s.main)}>{AWARD_LABEL[award]}</span>
      <span className={cn('block tracking-wide text-[#C8A24A]', s.top)}>Matchunt Liga · {season}</span>
    </span>
  </span>;
}

/** Kleine Marke in Tabellen: ✦ in Gold. */
export function LigaStar({ title }: { title: string }) {
  return <span title={title} aria-label={title} className="text-[#C8A24A]">✦</span>;
}
