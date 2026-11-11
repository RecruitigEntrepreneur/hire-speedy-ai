import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Honorar } from '@/components/recruiter/Honorar';
import { cn } from '@/lib/utils';
import { Kette } from './Schritte';
import { dm, eur0, eur2, type OverviewResponse, type UpcomingRun } from '../../../../supabase/functions/_shared/abrechnung-view';

function naechsteZeile(run: UpcomingRun) {
  const first = run.lines[0];
  const rest = run.lines.length - 1;
  return `${first.label}${rest > 0 ? ` und ${rest} ${rest === 1 ? 'weiterer Posten' : 'weitere Posten'}` : ''}`;
}

/**
 * Verdienste › Übersicht (H8): nächste Gutschrift, drei Zahlen, deine Besetzungen.
 * Kein „Ausgezahlt“ mehr für Geld, das nur der Kunde gezahlt hat.
 */
export function VerdiensteUebersicht({ data, onOpen, onAbrechnungsdaten }: { data: OverviewResponse; onOpen: (placementId: string) => void; onAbrechnungsdaten: () => void }) {
  const next = data.next;
  const t = data.totals;
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          {next ? (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Nächste Gutschrift</p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums"><Honorar>{eur2(next.netCents)}</Honorar></p>
                <p className="text-sm text-muted-foreground">
                  {next.vatCents > 0 && <><Honorar>{`+ ${eur2(next.vatCents)} USt`}</Honorar> · </>}
                  {naechsteZeile(next)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{next.slot.label}</p>
                <p className="text-sm text-muted-foreground">spätestens {dm(next.slot.latest)} · Geld 7 Tage danach</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">Nächste Gutschrift</p>
              <p className="mt-0.5 text-sm">Gerade ist nichts fällig. Fällig wird dein Anteil, wenn der Kunde bezahlt hat und dein Kandidat angefangen hat.</p>
            </div>
          )}
        </CardContent>
      </Card>
      {data.payoutGaps.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className={cn(next && 'text-warning')}>Damit wir auszahlen können, fehlt noch: {data.payoutGaps.join(', ')}.</span>{' '}
          <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={onAbrechnungsdaten}>Abrechnungsdaten</button>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Kachel label={`Erhalten ${data.year}`} cents={t.receivedYearCents} />
        <Kachel label="Wartet auf Antritt" cents={t.waitingStartCents} hint={t.waitingPaymentCents > 0 ? `davon ${eur0(t.waitingPaymentCents)} bis der Kunde bezahlt hat` : undefined} />
        <Kachel label="Wartet auf Ende der Garantie" cents={t.waitingGuaranteeCents} />
      </div>

      <div>
        <h2 className="mb-1 font-medium">Deine Besetzungen</h2>
        {data.rows.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Noch keine Besetzungen. Sobald ein Arbeitsvertrag verbindlich ist, siehst du hier, was du wann bekommst.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {data.rows.map((r) => (
              <li key={r.placementId}>
                <button type="button" onClick={() => onOpen(r.placementId)}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {r.candidateName}
                      <span className="text-muted-foreground">{[r.companyName, r.packageLabel].filter(Boolean).map((x) => ` · ${x}`).join('')}</span>
                    </span>
                    {r.status
                      ? <span className="block text-xs text-muted-foreground">{r.status}</span>
                      : <span className="block"><Kette items={r.chain} /></span>}
                  </span>
                  <span className="text-right">
                    <span className="block text-sm tabular-nums">{r.amountCents != null ? <Honorar>{eur0(r.amountCents)}</Honorar> : '–'}</span>
                    {r.amountSub && <span className="block text-xs text-muted-foreground"><Honorar>{r.amountSub}</Honorar></span>}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Kachel({ label, cents, hint }: { label: string; cents: number; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums"><Honorar>{eur0(cents)}</Honorar></p>
        {hint && <p className="text-xs text-muted-foreground"><Honorar>{hint}</Honorar></p>}
      </CardContent>
    </Card>
  );
}
