import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  bedingungGilt, hatWert, questionsAt, sizeBand,
  frageKurz, slotChipWert, slotChips, slotLabel,
  type BriefPlace, type BriefSlot, type Known,
} from '@/lib/briefCatalog';
import { Check } from 'lucide-react';

/**
 * Die Katalogfragen, die LINKS als Formular stehen.
 *
 * Warum links und nicht im Gespraech: eine Frage geht dorthin, wo ihr
 * schwerster Teil hingehoert. Ist das ein Wert, den jemand ohnehin in ein
 * Formularfeld tippen wuerde -- Monatsgehaelter, Teamgroesse, Betriebsrat --
 * dann ist eine Gespraechsrunde dafuer verschenkte Aufmerksamkeit. Markos
 * Wortlaut steht trotzdem da, nur als Beschriftung statt als Frage.
 *
 * Diese Komponente rendert AUSSCHLIESSLICH Felder, die es links noch nicht
 * gibt. Gehalt, Muss-/Kann-Kriterien, Standort und Arbeitsmodell bleiben in
 * ProfileSections, wo sie immer waren; ihr Wert wird ueber knownFromForm in
 * den Katalog gespiegelt. Wuerden sie hier ein zweites Mal erscheinen, waere
 * das genau die Doppelung, an der die erste Fassung gescheitert ist.
 */

interface Props {
  place: BriefPlace;
  known: Known;
  onSet: (key: string, value: unknown) => void;
  contract: 'full-time' | 'freelance';
  /**
   * Die Muss-Liste aus dem Profil. Aus ihr markiert der Kunde die drei, ohne
   * die es nicht geht -- eine zweite Liste zum Abtippen waere Unsinn.
   */
  mustHaves?: string[];
}

export function CatalogFields({ place, known, onSet, contract, mustHaves = [] }: Props) {
  const fragen = questionsAt(place, contract).filter((q) =>
    q.slots.some((s) => !s.only || s.only === contract),
  );
  if (fragen.length === 0) return null;

  return (
    <div className="space-y-4">
      {fragen.map((q) => {
        const slots = q.slots.filter(
          (s) =>
            (!s.only || s.only === contract) &&
            // Was links im Formular steht, wird hier nicht noch einmal erhoben.
            // Frueher eine fest verdrahtete Zweierliste -- jede weitere
            // Formularzeile im Katalog waere doppelt gerendert worden.
            !s.imFormular &&
            // Eine Stelle fuer die Bedingung, hier wie im Gespraech. Die
            // Fassung hier verglich zusaetzlich anders als die im Katalog
            // (`!== undefined` statt `hatWert`) -- zwei Wahrheiten darueber,
            // wann eine Folgezeile erscheint.
            bedingungGilt(known, s),
        );
        if (slots.length === 0) return null;
        /**
         * Die Frage steht nur ueber ihrer HAUPTZEILE.
         *
         * Bei der Verguetung ist das das Gehaltsband -- und das hat sein Feld
         * seit jeher oben im Profil. Ohne diese Bedingung stand "In was fuer
         * eine Range befindet sich das Fixgehalt?" als Ueberschrift ueber
         * Monatsgehaeltern und Bonus, waehrend das Range-Feld woanders lag.
         */
        const zeigeFrage = slots[0]?.key === q.slots[0]?.key;
        return (
          <div key={q.key}>
            {zeigeFrage && (
              /* Markos Wortlaut — als Beschriftung, nicht als Frage. */
              <p className="mb-2 text-xs leading-snug text-muted-foreground">
                {frageKurz(q, contract) ?? q.text}
              </p>
            )}
            <div className="space-y-2.5">
              {slots.map((s) => (
                <div key={s.key}>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    {slotLabel(s, contract)}
                    {!s.required && <span className="ml-1 text-[10px]">(optional)</span>}
                  </p>
                  <FeldEingabe
                    contract={contract}
                    slot={s}
                    wert={known[s.key]?.value}
                    quelle={known[s.key]?.from}
                    optionen={
                      s.key === 'must_have_criteria'
                        ? mustHaves
                        : s.key === 'trainable_skills'
                          // Was schon als eines der drei Muss-Kriterien
                          // markiert ist, kann nicht zugleich nachschulbar
                          // sein -- sonst widerspricht sich das Profil.
                          ? mustHaves.filter(
                              (m) => !(known.must_have_criteria?.value as string[] | undefined)?.includes(m),
                            )
                          : undefined
                    }
                    onSet={(v) => onSet(s.key, v)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const QUELLE: Partial<Record<string, string>> = {
  ad: 'aus der Anzeige',
  enrich: 'aus dem Impressum',
  inherit: 'aus Ihrem Firmenprofil',
  derive: 'abgeleitet',
};

function FeldEingabe({
  slot, contract, wert, quelle, optionen, onSet,
}: {
  slot: BriefSlot;
  contract: 'full-time' | 'freelance';
  wert: unknown;
  quelle?: string;
  /** Ersetzt slot.chips, wenn die Auswahl aus dem Profil kommt. */
  optionen?: string[];
  onSet: (v: unknown) => void;
}) {
  const hinweis = quelle && quelle !== 'answer' ? QUELLE[quelle] : null;
  const gewaehlt = Array.isArray(wert) ? (wert as string[]) : [];
  const chips = optionen ?? slotChips(slot, contract);

  /**
   * Ein markierter Chip, der noch nicht bestaetigt ist, wird durch den Klick
   * BESTAETIGT -- nicht geleert.
   *
   * BEFUND (09.09.2026): Unter dem Chip stand "aus der Anzeige -- bitte
   * pruefen", und das Empfehlungsfeld forderte woertlich auf, die Frage zu
   * beantworten. Wer der Aufforderung folgte und den markierten Chip klickte,
   * loeschte den Wert aus der Anzeige: `remote_days` verschwand aus dem
   * Entwurf, der Zaehler blieb stehen, der Hinweis verschwand mit. Erst der
   * ZWEITE Klick setzte ihn wieder -- wer einmal klickte und weiterging, hatte
   * die Angabe verloren, ohne dass etwas es sagte.
   *
   * Abwaehlen bleibt moeglich, sobald der Wert die Antwort des Kunden IST.
   */
  const nurVorschlag = !!quelle && quelle !== 'answer';

  const chipReihe = (multi: boolean) => (
    <div className="flex flex-wrap gap-1.5">
      {(chips ?? []).map((c) => {
        const an = multi ? gewaehlt.includes(c) : wert === slotChipWert(slot, contract, c);
        const wert_ = slotChipWert(slot, contract, c);
        return (
          <button
            key={c}
            type="button"
            onClick={() =>
              multi
                ? onSet(an ? gewaehlt.filter((x) => x !== c) : [...gewaehlt, c])
                : onSet(an && !nurVorschlag ? undefined : wert_)
            }
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
              an
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {an && <Check className="h-2.5 w-2.5 shrink-0" />}
            {c}
          </button>
        );
      })}
      {chips?.length === 0 && (
        <span className="text-xs text-muted-foreground">
          Tragen Sie zuerst Muss-Kriterien ein — daraus wählen Sie hier aus.
        </span>
      )}
    </div>
  );

  return (
    <div>
      {(slot.form === 'chips' || slot.form === 'multi') && chipReihe(slot.form === 'multi')}

      {slot.form === 'short' && (
        <Input value={String(wert ?? '')} className="h-8 text-xs"
               placeholder={slot.placeholder}
               /* Nicht bei jedem Anschlag trimmen: sonst frisst das Feld das
                  Leerzeichen, das gerade getippt wird. Das Trimmen passiert
                  beim Schreiben in die Spalte. */
               onChange={(e) => onSet(e.target.value || undefined)} />
      )}

      {slot.form === 'number' && (
        <Input type="number" value={String(wert ?? '')} className="h-8 text-xs"
               placeholder={slot.placeholder}
               onChange={(e) => onSet(e.target.value === '' ? undefined : Number(e.target.value))} />
      )}

      {(slot.form === 'text' || slot.form === 'ai') && (
        <Textarea value={String(wert ?? '')} rows={2} placeholder="In Ihren Worten …"
                  className="text-xs" onChange={(e) => onSet(e.target.value || undefined)} />
      )}

      {hinweis && hatWert({ [slot.key]: { value: wert, from: 'ad' } }, slot.key) && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hinweis} — bitte prüfen</p>
      )}

      {/* Eine einzige benannte Ausnahme, kein Baukasten: die Kopfzahl zeigt,
          was der Recruiter vor dem Reveal daraus liest. Ohne diese Zeile
          gaebe der Kunde eine Zahl ein und wuesste nicht, dass davon nur
          eine Groessenklasse nach draussen geht. */}
      {slot.key === 'company_headcount' && sizeBand(wert as number) && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Größenklasse {sizeBand(wert as number)} — mehr sieht der Recruiter
          vor der Freigabe nicht.
        </p>
      )}
    </div>
  );
}
