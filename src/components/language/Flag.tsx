import type { FlagCode } from '@/i18n/languages';
import { cn } from '@/lib/utils';

/** Kleine Fahnen als Bild: Emoji-Fahnen zeigt Windows nur als Buchstaben. */
export function Flag({ code, className }: { code: FlagCode; className?: string }) {
  return (
    <svg viewBox="0 0 18 12" aria-hidden="true" className={cn('h-3 w-[18px] shrink-0 rounded-[2px]', className)}>
      {code === 'de' && <><rect width="18" height="4" fill="#111"/><rect y="4" width="18" height="4" fill="#DD0000"/><rect y="8" width="18" height="4" fill="#FFCE00"/></>}
      {code === 'at' && <><rect width="18" height="12" fill="#ED2939"/><rect y="4" width="18" height="4" fill="#fff"/></>}
      {code === 'ch' && <><rect width="18" height="12" fill="#DA291C"/><rect x="7.5" y="2.5" width="3" height="7" fill="#fff"/><rect x="5.5" y="4.5" width="7" height="3" fill="#fff"/></>}
      {code === 'se' && <><rect width="18" height="12" fill="#006AA7"/><rect x="5" width="2.5" height="12" fill="#FECC02"/><rect y="4.75" width="18" height="2.5" fill="#FECC02"/></>}
      {code === 'no' && <><rect width="18" height="12" fill="#BA0C2F"/><rect x="4.5" width="4" height="12" fill="#fff"/><rect y="4" width="18" height="4" fill="#fff"/><rect x="5.5" width="2" height="12" fill="#00205B"/><rect y="5" width="18" height="2" fill="#00205B"/></>}
      {code === 'gb' && <><rect width="18" height="12" fill="#012169"/><path d="M0 0L18 12M18 0L0 12" stroke="#fff" strokeWidth="2.4"/><path d="M0 0L18 12M18 0L0 12" stroke="#C8102E" strokeWidth="1"/><path d="M9 0V12M0 6H18" stroke="#fff" strokeWidth="4"/><path d="M9 0V12M0 6H18" stroke="#C8102E" strokeWidth="2.4"/></>}
    </svg>
  );
}
