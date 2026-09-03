import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Check, Gift, Plus } from 'lucide-react';

/**
 * Benefits — angeklickt, nicht getippt, und aus einem FESTEN Katalog.
 *
 * Drei Gruende fuer die feste Liste.
 *
 * Erstens: bei einem oeffentlichen Link wissen wir nichts ueber die Firma, und
 * aus einer Stellenanzeige liest man Benefits nicht zuverlaessig -- sie stehen
 * dort als Marketingprosa ("ein Team, das zusammenhaelt").
 *
 * Zweitens: ein Modell erfindet hier. Fragt man eine KI nach Benefit-Optionen,
 * kommen Obstkorb und Kickertisch, weil das in Anzeigen steht. Der Headhunter
 * erzaehlt es dem Kandidaten weiter, und beim Kunden gibt es keinen Kicker.
 *
 * Drittens: Benefits gehoeren zur FIRMA, nicht zur Position -- sie wiederholen
 * sich bei jeder Stelle. Was hier geklickt wird, ist bei der naechsten Aufnahme
 * vorausgewaehlt; der Kunde bestaetigt dann nur.
 *
 * Der Wert landet in jobs.benefits. Diese Spalte steht in recruiter_jobs_view
 * und wurde bisher von keinem Aufnahmepfad je gefuellt -- der Headhunter sah
 * stattdessen KI-erfundene "Selling Points".
 */

export const BENEFIT_GRUPPEN: { titel: string; items: string[] }[] = [
  {
    titel: 'Zeit & Ort',
    items: [
      '30 Tage Urlaub',
      'Mehr als 30 Tage Urlaub',
      'Home-Office möglich',
      'Gleitzeit ohne Kernzeit',
      'Teilzeit möglich',
      'Workation / Arbeiten aus dem Ausland',
      'Sabbatical',
    ],
  },
  {
    titel: 'Geld',
    items: [
      'Bonus / Prämien',
      'Betriebliche Altersvorsorge',
      'Vermögenswirksame Leistungen',
      'Mitarbeiterbeteiligung',
      'Umzugsunterstützung',
    ],
  },
  {
    titel: 'Mobilität',
    items: [
      'Jobrad / Fahrradleasing',
      'Deutschlandticket / Fahrtkostenzuschuss',
      'Firmenwagen',
      'Parkplatz oder Ladesäule',
    ],
  },
  {
    titel: 'Entwicklung',
    items: [
      'Weiterbildungsbudget',
      'Konferenzen und Zertifizierungen',
      'Coaching / Mentoring',
    ],
  },
  {
    titel: 'Alltag',
    items: [
      'Essenszuschuss oder Kantine',
      'Sportangebot (Wellpass, Urban Sports)',
      'Gesundheitsvorsorge / Betriebsarzt',
      'Kinderbetreuung oder Kita-Zuschuss',
      'Moderne Hardware, Gerätewahl',
      'Mitarbeiterrabatte',
    ],
  },
];

const ALLE = BENEFIT_GRUPPEN.flatMap((g) => g.items);

interface Props {
  gewaehlt: string[];
  onChange: (benefits: string[]) => void;
  /** Aus dem Firmenprofil vererbt: dann steht hier "bestätigen" statt "wählen". */
  vererbt?: boolean;
}

export function BenefitsBlock({ gewaehlt, onChange, vererbt }: Props) {
  const [eigen, setEigen] = useState('');
  const an = (b: string) => gewaehlt.includes(b);

  const um = (b: string) =>
    onChange(an(b) ? gewaehlt.filter((x) => x !== b) : [...gewaehlt, b]);

  const eigenesHinzu = () => {
    const t = eigen.trim();
    if (!t || gewaehlt.includes(t)) return;
    onChange([...gewaehlt, t]);
    setEigen('');
  };

  // Selbst eingetragene stehen nicht im Katalog -- sie bekommen eine eigene
  // Reihe, damit sie nicht zwischen den Vorgaben verschwinden.
  const eigene = gewaehlt.filter((b) => !ALLE.includes(b));

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Gift className="h-3.5 w-3.5" /> Benefits
          <span className="hidden font-normal normal-case tracking-normal opacity-70 sm:inline">
            — {vererbt ? 'aus Ihrem Firmenprofil, bitte bestätigen' : 'anklicken, was zutrifft'}
          </span>
        </p>
        {gewaehlt.length > 0 && (
          <span className="shrink-0 text-[11px] text-muted-foreground">{gewaehlt.length} gewählt</span>
        )}
      </div>

      <div className="space-y-2.5 p-4 pt-3">
        {BENEFIT_GRUPPEN.map((g) => (
          <div key={g.titel}>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{g.titel}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => um(b)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                    an(b)
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {an(b) && <Check className="h-2.5 w-2.5 shrink-0" />}
                  {b}
                </button>
              ))}
            </div>
          </div>
        ))}

        {eigene.length > 0 && (
          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Von Ihnen ergänzt</p>
            <div className="flex flex-wrap gap-1.5">
              {eigene.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => um(b)}
                  className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs"
                >
                  <Check className="h-2.5 w-2.5 shrink-0" />
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-0.5">
          <Input
            value={eigen}
            onChange={(e) => setEigen(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); eigenesHinzu(); } }}
            placeholder="Weitere …"
            className="h-7 text-xs"
          />
          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!eigen.trim()} onClick={eigenesHinzu}>
            <Plus className="h-3 w-3" /> Hinzufügen
          </Button>
        </div>
      </div>
    </div>
  );
}
