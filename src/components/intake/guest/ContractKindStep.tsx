import { Button } from '@/components/ui/button';
import { ArrowLeft, Briefcase, Clock, Info, UserCheck } from 'lucide-react';

/**
 * Die erste Frage: worum geht es ueberhaupt?
 *
 * BEFUND (05.09.2026): Der Contracting-Zweig ist vollstaendig gebaut --
 * Tagessatz, Laufzeit, Auslastung und Verlaengerung haben eigene Spalten,
 * stehen in recruiter_jobs_view und werden vom Katalog beruecksichtigt. Er war
 * aber UNERREICHBAR: im gesamten Gast-Pfad gab es kein Bedienelement, mit dem
 * ein Kunde ihn haette waehlen koennen. `contract_type` kam ausschliesslich aus
 * dem Entwurf und stand per Vorgabe auf 'full-time'.
 *
 * Alle fuenf untersuchten DACH-Personalberatungen (Hays, Randstad, Robert Half,
 * Michael Page, Kienbaum) stellen diese Frage weit vorn -- Randstad und Hays
 * sogar mit Arbeitnehmerueberlassung als dritter Option. Wir stellen sie
 * ebenfalls, aber aus dem umgekehrten Grund: um eine davon sauber abzuweisen.
 *
 * ARBEITNEHMERUEBERLASSUNG BIETEN WIR NICHT AN, und das steht nicht zur
 * Disposition der Oberflaeche -- es steht in den Dokumenten, die jeder Kunde
 * unterschreibt:
 *   AGB Paragraph 3 (2): "Matchunt wird nicht selbst als Personalvermittler
 *     taetig und betreibt keine Arbeitnehmerueberlassung im Sinne des AUEG."
 *   Rahmenvertrag Paragraph 1 (1): "Matchunt vermittelt dem Auftraggeber
 *     Kandidatinnen und Kandidaten zur Begruendung eines EIGENEN Arbeits- oder
 *     Dienstverhaeltnisses. Eine Arbeitnehmerueberlassung findet nicht statt."
 *
 * Die Option trotzdem zu ZEIGEN ist Absicht. Wer sie sucht, sucht sie ohnehin;
 * sie wegzulassen hiesse, ihn erst nach zwanzig Angaben merken zu lassen, dass
 * er falsch ist. Und in vielen Faellen meint "AUEG" in Wahrheit "befristet,
 * ohne Festanstellung" -- das ist Contracting, und das koennen wir.
 */

export type ContractKind = 'full-time' | 'freelance';

interface Props {
  onChoose: (kind: ContractKind) => void;
  /** Die Arbeitnehmerueberlassung fuehrt nicht ins Formular, sondern zur Absage. */
  onDecline: () => void;
  /** Zurueck, wenn schon ein Profil besteht und der Kunde nur korrigiert. */
  onBack?: () => void;
}

const KARTEN: {
  kind: ContractKind | 'anue';
  icon: typeof Briefcase;
  titel: string;
  zeile: string;
  hinweis: string;
}[] = [
  {
    kind: 'full-time',
    icon: UserCheck,
    titel: 'Festanstellung',
    zeile: 'Die Person wird bei Ihnen angestellt',
    hinweis: 'Unbefristet oder befristet — wir vermitteln, Sie stellen ein.',
  },
  {
    kind: 'freelance',
    icon: Clock,
    titel: 'Contracting',
    zeile: 'Freiberuflich auf Zeit, mit Tagessatz',
    hinweis: 'Für einen befristeten Bedarf, ohne feste Anstellung.',
  },
  {
    kind: 'anue',
    icon: Briefcase,
    titel: 'Arbeitnehmerüberlassung',
    zeile: 'Zeitarbeit über einen Verleiher',
    hinweis: 'Die Person ist beim Verleiher angestellt.',
  },
];

export function ContractKindStep({ onChoose, onDecline, onBack }: Props) {
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">Um welche Art von Besetzung geht es?</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Danach richtet sich, wonach wir Sie fragen — und was in der Vereinbarung steht.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {KARTEN.map(({ kind, icon: Icon, titel, zeile, hinweis }) => (
          <button
            key={kind}
            type="button"
            onClick={() => (kind === 'anue' ? onDecline() : onChoose(kind))}
            data-kind={kind}
            // Die dritte Karte ist bewusst nicht abgeschwaecht: sie sieht
            // waehlbar aus, weil sie waehlbar IST -- sie fuehrt nur woanders
            // hin. Eine ausgegraute Karte ohne Erklaerung waere schlechter.
            className="rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30 hover:bg-accent/40"
          >
            <Icon className="mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-semibold">{titel}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{zeile}</p>
            <p className="mt-2 text-xs text-muted-foreground/80">{hinweis}</p>
          </button>
        ))}
      </div>

      {onBack && (
        <Button variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Der Ausgang fuer die Arbeitnehmerueberlassung.
 *
 * Kein "das koennen wir leider nicht" ohne Begruendung: der Kunde soll
 * verstehen, WARUM, und in einem Satz sehen, ob Contracting sein Anliegen
 * ohnehin trifft. Der Wortlaut bleibt innerhalb dessen, was AGB und
 * Rahmenvertrag sagen -- wir behaupten hier keine Rechtslage, die dort nicht
 * steht.
 */
export function ContractKindDeclined({
  onContracting,
  onBack,
}: {
  onContracting: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-muted-foreground" />
          Arbeitnehmerüberlassung bieten wir nicht an
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Bei der Überlassung bleibt die Fachkraft beim Verleiher angestellt und arbeitet nur
          bei Ihnen. Das ist nach dem Arbeitnehmerüberlassungsgesetz erlaubnispflichtig und
          nicht unser Geschäft. Wir vermitteln Ihnen Kandidatinnen und Kandidaten, mit denen
          Sie selbst einen Vertrag schließen.
        </p>
        <div className="mt-4 rounded-lg border border-border/60 bg-accent/30 p-3">
          <p className="text-sm font-medium">Brauchen Sie jemanden nur auf Zeit?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dann ist Contracting meist der passende Weg: freiberuflich, mit Tagessatz und
            fester Laufzeit — ohne dass Sie jemanden fest anstellen.
          </p>
          <Button size="sm" className="mt-3" onClick={onContracting}>
            Contracting ansehen
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="mt-3 gap-1.5 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> Zurück zur Auswahl
        </Button>
      </div>
    </div>
  );
}
