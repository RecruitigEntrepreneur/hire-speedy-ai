import { kontaktZeile, type Herkunft, type Posting } from '@/lib/jobPosting';

const HERKUNFT: Record<Herkunft, string> = {
  kunde: 'Angaben des Kunden',
  ki: 'KI formuliert',
  system: 'Matchunt',
};

/**
 * Die Anzeige, wie der Headhunter sie sieht -- auf seiner Seite „Anzeige &
 * Ansprache" und für Matchunt in der Vorschau vor der Freigabe. Die Herkunft
 * je Abschnitt steht nur hier, nie im kopierten Text.
 */
export function AnzeigeAnsicht({ posting, herkunftZeigen = true, kompakt = false }: {
  posting: Posting;
  herkunftZeigen?: boolean;
  /** Kleinere Überschrift, z. B. in der Vorschau im Freigabe-Dialog. */
  kompakt?: boolean;
}) {
  const kontakt = kontaktZeile(posting.kontakt);
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <h1 className={`${kompakt ? 'text-xl' : 'text-3xl'} font-semibold leading-tight tracking-tight`}>{posting.title}</h1>
        {posting.subtitle && <p className="text-sm text-muted-foreground">{posting.subtitle}</p>}
      </header>

      {posting.eckdaten.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-card px-5 py-4 text-sm sm:grid-cols-3">
          {posting.eckdaten.map(e => (
            <div key={e.label} className="min-w-0">
              <dt className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{e.label}</dt>
              <dd className="mt-0.5 tabular-nums">{e.wert}</dd>
            </div>
          ))}
        </dl>
      )}

      {posting.blocks.map(block => (
        <section key={block.id} className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{block.title}</h2>
            {herkunftZeigen && block.herkunft && (
              <span className="flex flex-wrap gap-1">
                {block.herkunft.map(h => (
                  <span key={h} className="rounded border border-border px-1.5 text-[10px] text-muted-foreground">{HERKUNFT[h]}</span>
                ))}
              </span>
            )}
          </div>
          {block.lead && <p className="whitespace-pre-line text-sm leading-7">{block.lead}</p>}
          {block.bullets.length > 0 && <Punkte werte={block.bullets} />}
          {block.gruppen?.map(g => (
            <div key={g.titel} className="space-y-1.5">
              <p className="text-sm font-medium">{g.titel}</p>
              <Punkte werte={g.bullets} />
            </div>
          ))}
          {block.nachsatz && <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{block.nachsatz}</p>}
        </section>
      ))}

      {kontakt && (
        <section className="space-y-1 border-t border-border pt-5">
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Deine Ansprechperson</h2>
          <p className="text-sm">{kontakt}</p>
        </section>
      )}
    </div>
  );
}

function Punkte({ werte }: { werte: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-7">
      {werte.map(bullet => (
        <li key={bullet} className="flex gap-3">
          <span aria-hidden className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span className="min-w-0 whitespace-pre-line">{bullet}</span>
        </li>
      ))}
    </ul>
  );
}
