import { useTranslation } from 'react-i18next';
import { Checkbox } from '@/components/ui/checkbox';
import { intlLocale } from '@/i18n/languages';
import { kandidatKuerzel } from '@/lib/kandidatenStand';
import { cn } from '@/lib/utils';
import type { Candidate } from './CandidateCard';
import { KandidatMenue, StandZeilen, type KandidatKarteProps } from './KandidatKarte';

type Zeile = Omit<KandidatKarteProps, 'candidate' | 'isSelected'>;

/**
 * Ansicht „Liste“ (24.11.2026): Liste und Tabelle in einem, mit Stand und passenden Stellen.
 * Spaltenköpfe sortieren; die Liste scrollt bei schmalem Fenster in ihrer Karte seitlich, die Seite nicht.
 */
export function KandidatenListe({ candidates, zeile, selectedIds, sortBy, sortOrder, onSort }: {
  candidates: Candidate[];
  zeile: (c: Candidate) => Zeile;
  selectedIds: string[];
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (key: string) => void;
}) {
  const { t, i18n } = useTranslation('candidates');
  const locale = intlLocale(i18n.language);

  const Kopf = ({ k, children, className }: { k?: string; children: React.ReactNode; className?: string }) => (
    <th className={cn('px-3 py-2.5 text-left text-xs font-normal text-muted-foreground', className)}>
      {k ? <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}{sortBy === k && <span aria-hidden="true">{sortOrder === 'asc' ? '↑' : '↓'}</span>}
      </button> : children}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border bg-background">
      <table className="w-full min-w-[860px] text-[13px]">
        <thead className="bg-card">
          <tr className="border-b">
            <Kopf k="full_name" className="pl-4">{t('list.candidate')}</Kopf>
            <Kopf>{t('list.stand')}</Kopf>
            <Kopf>{t('list.matches')}</Kopf>
            <Kopf k="experience_years">{t('list.experience')}</Kopf>
            <Kopf k="expected_salary">{t('list.salary')}</Kopf>
            <Kopf k="created_at">{t('list.added')}</Kopf>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const z = zeile(c);
            const sel = selectedIds.includes(c.id);
            const rolle = [c.job_title, (c as { city?: string | null }).city].filter(Boolean).join(' · ');
            return (
              <tr key={c.id} onClick={() => z.onView(c)} className={cn('group cursor-pointer border-b align-top transition-colors last:border-b-0 hover:bg-card/60', sel && 'bg-card')}>
                <td className="py-3 pl-4 pr-3">
                  <div className="flex items-center gap-2.5">
                    <span className={cn('transition-opacity', sel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 max-sm:opacity-100')} onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={sel} onCheckedChange={(v) => z.onSelect(c.id, !!v)} aria-label={c.full_name} className="rounded-full" />
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold">{kandidatKuerzel(c.full_name)}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{rolle || (z.cvMissing ? t('cvMissing.label') : t('card.roleOpen'))}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[16rem] px-3 py-3">
                  <StandZeilen kompakt stand={z.stand} passend={z.passend} aufgabe={z.aufgabe} onPassend={() => z.onPassend(c)} pool={z.pool} onMelden={z.onMelden ? () => z.onMelden!(c) : undefined} />
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {/* Bei Eingestellten keine Zahl: sie suchen gerade nicht (24.11.2026) */}
                  {z.stand?.art === 'eingestellt' ? <span className="text-muted-foreground">–</span>
                    : z.passend == null ? <span className="text-muted-foreground">…</span>
                    : z.passend > 0 ? <button type="button" className="whitespace-nowrap font-medium text-klick hover:underline" onClick={(e) => { e.stopPropagation(); z.onPassend(c); }}>{t('stand.matchesShort', { count: z.passend })} ›</button>
                    : <span className="text-muted-foreground">–</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{c.experience_years != null ? t('list.years', { count: c.experience_years }) : <span className="text-muted-foreground">–</span>}</td>
                <td className="whitespace-nowrap px-3 py-3">{c.expected_salary ? `${Math.round(c.expected_salary).toLocaleString(locale)} €` : <span className="text-muted-foreground">–</span>}</td>
                <td className="px-3 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}</td>
                <td className="py-2 pr-2">
                  <KandidatMenue c={c} onView={() => z.onView(c)} onEdit={() => z.onEdit(c)} onAssignTag={() => z.onAssignTag(c.id)} onAddToPool={() => z.onAddToPool(c)} onDelete={() => z.onDelete(c)} imPool={!!z.pool} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
