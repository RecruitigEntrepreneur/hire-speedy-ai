import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { cn } from '@/lib/utils';
import { TIER_LABEL, type PartnerTier } from '../../../../supabase/functions/_shared/recruiter-partner';

/**
 * Das Abzeichen „Karte“ (Entscheidung 22.09.2026): weiß mit schwarzem Zeichen für
 * Partner, schwarz mit Gold für Gold Partner. Feste Farben wie auf Signatur, Website
 * und Urkunde, deshalb unabhängig vom Farbschema der Plattform.
 */
const SIZES = {
  sm: { logo: 20, box: 'gap-2 rounded-lg px-2 py-1', line: 'h-4', top: 'text-[9px]', main: 'text-[11px]' },
  md: { logo: 30, box: 'gap-2.5 rounded-[10px] py-1.5 pl-2 pr-3', line: 'h-6', top: 'text-[10px]', main: 'text-sm' },
  lg: { logo: 38, box: 'gap-3 rounded-xl py-2.5 pl-3 pr-4', line: 'h-8', top: 'text-[11px]', main: 'text-base' },
} as const;

export function PartnerCard({ tier = 'partner', theme = 'light', size = 'md', className }: {
  tier?: PartnerTier; theme?: 'light' | 'dark'; size?: keyof typeof SIZES; className?: string;
}) {
  const s = SIZES[size];
  const gold = tier === 'gold';
  const dark = gold || theme === 'dark';
  return <span role="img" aria-label={TIER_LABEL[tier]}
    className={cn('inline-flex shrink-0 items-center border', dark ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-[#E4E4E7] bg-white text-[#0A0A0A]', s.box, className)}>
    <MatchuntLogo size={s.logo} className={gold ? 'text-[#C8A24A]' : undefined}/>
    <span aria-hidden className={cn('w-px', s.line, dark ? 'bg-[#3F3F46]' : 'bg-[#E4E4E7]')}/>
    <span aria-hidden className="text-left leading-tight">
      <span className={cn('block tracking-wide', s.top, gold ? 'text-[#C8A24A]' : dark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]')}>Matchunt</span>
      <span className={cn('block font-semibold', s.main)}>{gold ? 'Gold Partner' : 'Partner'}</span>
    </span>
  </span>;
}

/**
 * So zeigt das Website-Abzeichen (public/badge.js) den Status: Karte plus Zeile
 * „aktiv · geprüft“. Hier nur als Vorschau im Profil.
 */
export function LiveBadge({ tier = 'partner', theme = 'light', size = 'l', state = 'active' }: {
  tier?: PartnerTier; theme?: 'light' | 'dark'; size?: 's' | 'l'; state?: 'active' | 'paused';
}) {
  const dark = tier === 'gold' || theme === 'dark';
  if (size === 's') return <PartnerCard tier={tier} theme={theme} size="sm"/>;
  return <span className={cn('inline-flex flex-col items-start gap-1 rounded-[10px] border py-1.5 pl-2 pr-3', dark ? 'border-[#0A0A0A] bg-[#0A0A0A]' : 'border-[#E4E4E7] bg-white')}>
    <PartnerCard tier={tier} theme={theme} size="md" className="border-0 p-0"/>
    <span className={cn('flex items-center gap-1.5 pl-0.5 text-[11px]', state === 'active' ? (dark ? 'text-[#86EFAC]' : 'text-[#15803D]') : (dark ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'))}>
      <span className={cn('h-1.5 w-1.5 rounded-full', state === 'active' ? 'bg-[#16A34A]' : 'bg-[#A1A1AA]')}/>
      {state === 'active' ? 'aktiv · geprüft' : 'derzeit nicht aktiv'}
    </span>
  </span>;
}
