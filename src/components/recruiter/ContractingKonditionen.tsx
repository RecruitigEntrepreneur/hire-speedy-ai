import {
  AUSZAHLUNG_RECRUITER,
  ZAHLUNG_KANDIDAT,
  einsatzFuerKandidat,
  spezialistenSatz,
  verdienstImMonat,
  verdienstJeTag,
} from '@/lib/recruiterContracting';

/**
 * Projektkonditionen einer Contracting-Stelle als Gesprächskarte (Variante C,
 * Entscheidung 29.09.2026).
 *
 * Befund: "Tagessatz für den Spezialisten" direkt über "Dein Verdienst" liess
 * offen, ob der Verdienst vom Satz des Kandidaten abgeht oder obendrauf kommt.
 * Die Karte trennt deshalb, was in das Gespräch mit dem Kandidaten gehört, von
 * dem, was nur der Recruiter sieht, und beantwortet beide Fragen ausdrücklich.
 * Budget und Marge des Kunden stehen hier nie.
 */
export function ContractingKonditionen({ job }: { job: object }) {
  const satz = spezialistenSatz(job);
  const jeTag = verdienstJeTag(job);
  const imMonat = verdienstImMonat(job);
  const tage = (job as { utilization_days_per_week?: number | null }).utilization_days_per_week;

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-medium">Projektkonditionen</h3>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Für das Gespräch mit dem Kandidaten</p>
        <p className="text-lg font-semibold">{satz ? `${satz} / Tag` : 'Tagessatz nicht verfügbar'}</p>
        <p className="text-xs leading-5 text-muted-foreground">{einsatzFuerKandidat(job)}</p>
        <p className="text-xs leading-5 text-muted-foreground">{ZAHLUNG_KANDIDAT}</p>
      </div>

      {jeTag && (
        <div className="space-y-1 rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Nur für dich</p>
          <p className="text-lg font-semibold text-emerald-600">ca. {jeTag}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            je Einsatztag{imMonat ? ` · bei ${tage} Tagen/Woche ca. ${imMonat} im Monat` : ''} · {AUSZAHLUNG_RECRUITER}
          </p>
        </div>
      )}

      {jeTag && (
        <div className="space-y-2 text-xs leading-5">
          <p><span className="font-medium">Wird mein Verdienst vom Kandidaten abgezogen?</span> Nein. Der Kandidat bekommt seinen Satz voll, deinen Anteil zahlt Matchunt.</p>
          <p><span className="font-medium">Kommt er beim Kunden obendrauf?</span> Nein, er ist im Preis des Kunden schon enthalten.</p>
        </div>
      )}
    </div>
  );
}
