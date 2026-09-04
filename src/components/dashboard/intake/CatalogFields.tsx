import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  chipWert, hatWert, questionsAt,
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
  const fragen = questionsAt(place).filter((q) =>
    q.slots.some((s) => !s.only || s.only === contract),
  );
  if (fragen.length === 0) return null;

  return (
    <div className="space-y-4">
      {fragen.map((q) => {
        const slots = q.slots.filter(
          (s) =>
            (!s.only || s.only === contract) &&
            // Auswahl aus dem vorhandenen Profil braucht keine eigene Eingabe.
            !(s.key === 'salary_range' || s.key === 'day_rate_range') &&
            (!s.askIf || String(known[s.askIf.key]?.value ?? '') === s.askIf.equals),
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
              <p className="mb-2 text-xs leading-snug text-muted-foreground">{q.text}</p>
            )}
            <div className="space-y-2.5">
              {slots.map((s) => (
                <div key={s.key}>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    {s.label}
                    {!s.required && <span className="ml-1 text-[10px]">(optional)</span>}
                  </p>
                  <FeldEingabe
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
  slot, wert, quelle, optionen, onSet,
}: {
  slot: BriefSlot;
  wert: unknown;
  quelle?: string;
  /** Ersetzt slot.chips, wenn die Auswahl aus dem Profil kommt. */
  optionen?: string[];
  onSet: (v: unknown) => void;
}) {
  const hinweis = quelle && quelle !== 'answer' ? QUELLE[quelle] : null;
  const gewaehlt = Array.isArray(wert) ? (wert as string[]) : [];
  const chips = optionen ?? slot.chips;

  const chipReihe = (multi: boolean) => (
    <div className="flex flex-wrap gap-1.5">
      {(chips ?? []).map((c) => {
        const an = multi ? gewaehlt.includes(c) : wert === chipWert(slot, c);
        return (
          <button
            key={c}
            type="button"
            onClick={() =>
              multi
                ? onSet(an ? gewaehlt.filter((x) => x !== c) : [...gewaehlt, c])
                : onSet(an ? undefined : chipWert(slot, c))
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

      {slot.form === 'number' && (
        <Input type="number" value={String(wert ?? '')} className="h-8 text-xs"
               onChange={(e) => onSet(e.target.value === '' ? undefined : Number(e.target.value))} />
      )}

      {(slot.form === 'text' || slot.form === 'ai') && (
        <Textarea value={String(wert ?? '')} rows={2} placeholder="In Ihren Worten …"
                  className="text-xs" onChange={(e) => onSet(e.target.value || undefined)} />
      )}

      {hinweis && hatWert({ [slot.key]: { value: wert, from: 'ad' } }, slot.key) && (
        <p className="mt-1 text-[10px] text-muted-foreground">{hinweis} — bitte prüfen</p>
      )}
    </div>
  );
}
