import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { fuehrungArten, fuehrungUmschalten, fuehrungZahl, fuehrungZahlFeld, fuehrungZahlSetzen, type FuehrungArt, type FuehrungWerte } from '@/lib/fuehrung';
import { Field, NumberField, chipClass } from './DossierFields';

const KNOEPFE: { art: 'none' | FuehrungArt; label: string }[] = [
  { art: 'none', label: 'Keine' },
  { art: 'disciplinary', label: 'Disziplinarisch' },
  { art: 'functional', label: 'Fachlich' },
];
const GROESSEN = [5, 15, 50, 200, 250];
const GROESSEN_LABEL = ['1–5', '6–15', '16–50', '51–200', 'über 200'];

/**
 * Führung im Interview und auf der Prüfseite (05.11.2026): „Disziplinarisch“ und „Fachlich“
 * gehen zusammen, jede Art mit eigener Zahl. „Keine“ schließt beide aus.
 */
export function FuehrungFeld({
  value,
  onChange,
  label,
  hinweis,
  vorschlag,
  vorschlagHinweis,
  groessen = false,
}: {
  value: FuehrungWerte;
  onChange: (patch: Partial<FuehrungWerte>) => void;
  label: ReactNode;
  hinweis?: ReactNode;
  /** Vorschlag aus dem Titel, gestrichelt und nie vorausgewählt. */
  vorschlag?: FuehrungArt | null;
  vorschlagHinweis?: string;
  /** Schnellwahl 1–5, 6–15 … vor dem Zahlenfeld (Interview). */
  groessen?: boolean;
}) {
  const a = fuehrungArten(value);
  const an = { none: a.keine, disciplinary: a.disziplinarisch, functional: a.fachlich };
  const arten = (['disciplinary', 'functional'] as const).filter((x) => an[x]);
  return (
    <div className="space-y-3">
      <Field label={label} field="leadership_scope">
        {hinweis}
        <div className="flex flex-wrap gap-1.5" id="dossier-leadership_scope" role="group">
          {KNOEPFE.map((k) => {
            const isVorschlag = !value.leadership_scope && vorschlag === k.art;
            return (
              <button
                key={k.art}
                type="button"
                aria-pressed={an[k.art]}
                title={isVorschlag ? vorschlagHinweis ?? 'Vorschlag' : undefined}
                className={cn(chipClass(an[k.art]), isVorschlag && 'border-dashed border-primary text-primary')}
                onClick={() => onChange(fuehrungUmschalten(value, k.art))}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </Field>
      {arten.map((art) => {
        const feld = fuehrungZahlFeld(value, art);
        const zahl = fuehrungZahl(value, art);
        const setze = (n: number | null) => onChange(fuehrungZahlSetzen(value, art, n));
        return (
          <Field key={art} label={art === 'disciplinary' ? 'Disziplinarisch geführt' : 'Fachlich geführt'} field={feld}>
            <div className="flex flex-wrap items-center gap-1.5">
              {groessen && GROESSEN.map((n, i) => (
                <button key={n} type="button" onClick={() => setze(n)}
                  className={cn('rounded-md border px-2 py-0.5 text-xs', zahl === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                  {GROESSEN_LABEL[i]}
                </button>
              ))}
              <div className="w-36"><NumberField field={feld} value={zahl} onChange={setze} suffix="Personen" /></div>
            </div>
          </Field>
        );
      })}
    </div>
  );
}
