import {
  AUSZAHLUNG_RECRUITER,
  VERTRAG_KANDIDAT,
  ZAHLUNG_KANDIDAT,
  einsatzFuerKandidat,
  spezialistenGrenze,
  verdienstImMonat,
  verdienstJeTag,
  verdienstLaufzeit,
} from '@/lib/recruiterContracting';
import { Honorar } from './Honorar';

/**
 * Projektkonditionen einer Contracting-Stelle als Gesprächskarte (Variante C,
 * Entscheidung 29.09.2026).
 *
 * Befund: "Tagessatz für den Spezialisten" direkt über "Dein Verdienst" liess
 * offen, ob der Verdienst vom Satz des Kandidaten abgeht oder obendrauf kommt.
 * Die Karte trennt deshalb, was in das Gespräch mit dem Kandidaten gehört, von
 * dem, was nur der Recruiter sieht, und beantwortet beide Fragen ausdrücklich.
 * Budget und Marge des Kunden stehen hier nie.
 *
 * Etappe 1 (04.11.2026): die Obergrenze statt der Spanne, wer Vertragspartner
 * ist, der Wert über die Laufzeit und was bei einem höheren Satz passiert.
 */
export function ContractingKonditionen({ job }: { job: object }) {
  const grenze = spezialistenGrenze(job);
  const jeTag = verdienstJeTag(job);
  const imMonat = verdienstImMonat(job);
  const laufzeit = verdienstLaufzeit(job);
  const { utilization_days_per_week: tage, contract_duration_months: monate } =
    job as { utilization_days_per_week?: number | null; contract_duration_months?: number | null };
  const obergrenze = grenze?.startsWith('bis ') ? grenze.slice(4) : null;

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <h3 className="font-medium">Projektkonditionen</h3>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Für das Gespräch mit dem Kandidaten</p>
        <p className="text-lg font-semibold">
          {grenze ? `${grenze.charAt(0).toUpperCase()}${grenze.slice(1)} / Tag` : 'Tagessatz nicht verfügbar'}
        </p>
        <p className="text-xs leading-5 text-muted-foreground">{einsatzFuerKandidat(job)}</p>
        <p className="text-xs leading-5 text-muted-foreground">{ZAHLUNG_KANDIDAT}</p>
        <p className="text-xs leading-5 text-muted-foreground">{VERTRAG_KANDIDAT}</p>
      </div>

      {jeTag && (
        <div className="space-y-1 rounded-lg bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Nur für dich</p>
          <p className="text-lg font-semibold text-emerald-600"><Honorar>{`ca. ${jeTag}`}</Honorar></p>
          <p className="text-xs leading-5 text-muted-foreground">
            je Einsatztag{imMonat ? <> · bei {tage} Tagen/Woche ca. <Honorar>{imMonat}</Honorar> im Monat</> : ''}
            {laufzeit ? <> · bei {monate} Monaten ca. <Honorar>{laufzeit}</Honorar></> : ''} · {AUSZAHLUNG_RECRUITER}
          </p>
        </div>
      )}

      {jeTag && (
        <div className="space-y-2 text-xs leading-5">
          <p><span className="font-medium">Wird mein Verdienst vom Kandidaten abgezogen?</span> Nein. Der Kandidat bekommt seinen Satz voll, deinen Anteil zahlt Matchunt.</p>
          <p><span className="font-medium">Kommt er beim Kunden obendrauf?</span> Nein, er ist im Preis des Kunden schon enthalten.</p>
          {obergrenze && (
            <p><span className="font-medium">Und wenn er mehr will als {obergrenze}?</span> Stell ihn trotzdem vor, wenn er gut ist. Der Kunde entscheidet, ob er über sein Budget geht.</p>
          )}
        </div>
      )}
    </div>
  );
}
