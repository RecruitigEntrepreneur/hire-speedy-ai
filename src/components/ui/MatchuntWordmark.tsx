import { cn } from '@/lib/utils';
import { MatchuntLogo } from './MatchuntLogo';

interface MatchuntWordmarkProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { icon: 24, text: 'text-base' },
  md: { icon: 32, text: 'text-xl' },
  lg: { icon: 40, text: 'text-2xl' },
};

export function MatchuntWordmark({ size = 'md', className }: MatchuntWordmarkProps) {
  const s = sizes[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <MatchuntLogo size={s.icon} />
      <span className={cn(s.text, 'font-semibold tracking-tight')}>
        Matchunt.ai
      </span>
    </div>
  );
}
