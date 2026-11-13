import { useTranslation } from 'react-i18next';
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

/** Die Texte der drei Karten stehen in den Sprachdateien (clientFunnel: kind.*). */
const KARTEN: {
  kind: ContractKind | 'anue';
  icon: typeof Briefcase;
  text: 'permanent' | 'contracting' | 'temp';
}[] = [
  { kind: 'full-time', icon: UserCheck, text: 'permanent' },
  { kind: 'freelance', icon: Clock, text: 'contracting' },
  { kind: 'anue', icon: Briefcase, text: 'temp' },
];

export function ContractKindStep({ onChoose, onDecline, onBack }: Props) {
  const { t } = useTranslation('clientFunnel');
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="text-2xl font-bold tracking-tight">{t('kind.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t('kind.lead')}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {KARTEN.map(({ kind, icon: Icon, text }) => (
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
            <p className="text-sm font-semibold">{t(`kind.${text}Title`)}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(`kind.${text}Line`)}</p>
            <p className="mt-2 text-xs text-muted-foreground/80">{t(`kind.${text}Hint`)}</p>
          </button>
        ))}
      </div>

      {onBack && (
        <Button variant="ghost" size="sm" className="mt-4 gap-1.5 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> {t('common.back')}
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
  const { t } = useTranslation('clientFunnel');
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-xl border bg-card p-5">
        <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-muted-foreground" />
          {t('kind.declinedTitle')}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('kind.declinedText')}
        </p>
        <div className="mt-4 rounded-lg border border-border/60 bg-accent/30 p-3">
          <p className="text-sm font-medium">{t('kind.temporaryTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('kind.temporaryText')}
          </p>
          <Button size="sm" className="mt-3" onClick={onContracting}>
            {t('kind.viewContracting')}
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="mt-3 gap-1.5 text-muted-foreground" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" /> {t('kind.backToChoice')}
        </Button>
      </div>
    </div>
  );
}
