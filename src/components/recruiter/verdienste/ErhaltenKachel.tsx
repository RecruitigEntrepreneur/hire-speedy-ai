import { Link } from 'react-router-dom';
import { Euro } from 'lucide-react';
import { Honorar } from '@/components/recruiter/Honorar';
import { useVerdienste } from '@/lib/abrechnungApi';
import { eur0 } from '../../../../supabase/functions/_shared/abrechnung-view';

const year = () => String(new Date().getFullYear());

/**
 * Kachel in der Übersicht (H1): „Erhalten 2026“ statt „Verdient“. Zählt nur, was als
 * Gutschrift ausgezahlt ist; darunter die nächste Gutschrift. Ruhig, ohne Grün.
 */
export function ErhaltenKachel() {
  const { data, isError } = useVerdienste();
  const next = data?.next;
  return (
    <Link to="/recruiter/earnings" className="block rounded-lg border border-border/30 bg-muted/30 p-3 hover:bg-muted/50">
      <div className="mb-1 flex items-center gap-2">
        <Euro className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Erhalten {data?.year ?? year()}</span>
      </div>
      <p className="text-xl font-bold">{data ? <Honorar>{eur0(data.totals.receivedYearCents)}</Honorar> : isError ? '–' : '…'}</p>
      {next && <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground"><Honorar>{`nächste Gutschrift ${eur0(next.netCents)} · ${next.slot.label}`}</Honorar></p>}
    </Link>
  );
}

/** Eine Zeile unter „Erwartbar“ in der Pipeline-Kachel. */
export function ErhaltenZeile() {
  const { data } = useVerdienste();
  if (!data || data.totals.receivedYearCents <= 0) return null;
  return (
    <div className="flex items-center justify-between border-t border-border/30 pt-1 text-sm">
      <span className="text-muted-foreground">Erhalten {data.year}</span>
      <span className="font-semibold"><Honorar>{eur0(data.totals.receivedYearCents)}</Honorar></span>
    </div>
  );
}
