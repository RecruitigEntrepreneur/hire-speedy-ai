import { FileWarning } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

/** Markierung in Kandidatenlisten: ohne hochgeladenen Lebenslauf kein Einreichen. */
export function CvMissingBadge({ className }: { className?: string }) {
  const { t } = useTranslation('candidates');
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-warning', className)} title={t('cvMissing.hint')}>
      <FileWarning className="h-3 w-3" aria-hidden />
      {t('cvMissing.label')}
    </span>
  );
}
