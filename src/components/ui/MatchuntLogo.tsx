import { cn } from '@/lib/utils';

interface MatchuntLogoProps {
  size?: number;
  className?: string;
}

export function MatchuntLogo({ size = 32, className }: MatchuntLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
    >
      {/* MH Monogram – downward-pointing diamond/arrow shape */}
      <path
        d="M50 5L90 40L70 40L70 70L58 70L58 35L50 25L42 35L42 70L30 70L30 40L10 40L50 5Z"
        fill="currentColor"
      />
      <path
        d="M30 72L50 95L70 72L58 72L58 55L50 65L42 55L42 72L30 72Z"
        fill="currentColor"
      />
    </svg>
  );
}
