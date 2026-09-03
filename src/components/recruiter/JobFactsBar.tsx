import { Badge } from '@/components/ui/badge';
import { MapPin, Euro, Languages, CalendarClock, Building2, Award } from 'lucide-react';

/**
 * Die Eckdaten in EINER Zeile.
 *
 * Vorher standen hier vier grosse Kacheln aus `RecruiterQuickFacts` --
 * Teamgroesse, Wachstumsphase, Kultur, Interview-Prozess. Fuer keines dieser
 * vier Felder bekommt das Modell Daten; es erfindet sie also. Gemessen an einem
 * echten Job stand dort "Effizienter Prozess, ca. 2-3 Wochen", ohne dass
 * irgendjemand das je gesagt haette -- und der Headhunter erzaehlt es dem
 * Kandidaten weiter.
 *
 * Diese Leiste zeigt ausschliesslich Spalten, die tatsaechlich gefuellt sind.
 * Was fehlt, erscheint nicht als Platzhalter, sondern gar nicht -- und taucht
 * stattdessen unter "Nicht erhoben" auf.
 */

export interface JobFacts {
  salaryMin: number | null;
  salaryMax: number | null;
  dayRateMin?: number | null;
  dayRateMax?: number | null;
  onsiteRequired?: boolean | null;
  onsiteDaysRequired?: number | null;
  remotePolicy?: string | null;
  remoteType?: string | null;
  requiredLanguages?: unknown;
  requiredCertifications?: unknown;
  experienceLevel?: string | null;
  companySizeBand?: string | null;
  deadline?: string | null;
}

const LEVEL: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead',
  principal: 'Principal',
};

const k = (n: number) => `${Math.round(n / 1000)}k`;

/**
 * Sprachen und Zertifikate liegen als jsonb vor und haben historisch zwei
 * Formen: eine schlichte Liste von Texten und die normalisierte Form
 * `[{ code, minLevel }]` aus der Aufnahme. Beide muessen lesbar werden.
 */
const SPRACHE: Record<string, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch' };

function alsListe(wert: unknown): string[] {
  if (!Array.isArray(wert)) return [];
  return wert
    .map((e) => {
      if (typeof e === 'string') return e.trim();
      if (e && typeof e === 'object') {
        const o = e as Record<string, unknown>;
        const name = SPRACHE[String(o.code ?? '').toLowerCase()] ?? String(o.name ?? o.code ?? '');
        const stufe = o.minLevel ?? o.level ?? '';
        return [name, stufe].filter(Boolean).join(' ').trim();
      }
      return '';
    })
    .filter(Boolean);
}

function geld(min: number | null | undefined, max: number | null | undefined, suffix = '') {
  if (min && max) return `${k(min)} – ${k(max)} €${suffix}`;
  if (max) return `bis ${k(max)} €${suffix}`;
  if (min) return `ab ${k(min)} €${suffix}`;
  return null;
}

function vorOrt(f: JobFacts): string | null {
  if (f.onsiteDaysRequired != null) {
    return f.onsiteDaysRequired === 0 ? 'frei wählbar' : `${f.onsiteDaysRequired} Tage / Woche`;
  }
  if (f.onsiteRequired === true) return 'Präsenz erforderlich';
  if (f.remotePolicy) return f.remotePolicy;
  if (f.remoteType === 'remote') return 'remote';
  return null;
}

function frist(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
}

export function JobFactsBar({ facts }: { facts: JobFacts }) {
  const eintraege: { icon: typeof Euro; label: string; wert: string }[] = [];

  const tagessatz = geld(facts.dayRateMin, facts.dayRateMax, ' / Tag');
  const gehalt = geld(facts.salaryMin, facts.salaryMax);
  if (tagessatz) eintraege.push({ icon: Euro, label: 'Tagessatz', wert: tagessatz });
  else if (gehalt) eintraege.push({ icon: Euro, label: 'Gehalt', wert: gehalt });

  const ort = vorOrt(facts);
  if (ort) eintraege.push({ icon: MapPin, label: 'Vor Ort', wert: ort });

  if (facts.experienceLevel) {
    eintraege.push({ icon: Award, label: 'Level', wert: LEVEL[facts.experienceLevel] ?? facts.experienceLevel });
  }

  const sprachen = alsListe(facts.requiredLanguages);
  if (sprachen.length) {
    eintraege.push({ icon: Languages, label: 'Sprachen', wert: sprachen.join(', ') });
  }

  if (facts.companySizeBand) {
    eintraege.push({ icon: Building2, label: 'Größe', wert: facts.companySizeBand });
  }

  const bis = frist(facts.deadline);
  if (bis) eintraege.push({ icon: CalendarClock, label: 'Besetzt bis', wert: bis });

  const zertifikate = alsListe(facts.requiredCertifications);

  if (eintraege.length === 0 && zertifikate.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/30 bg-card px-4 py-2.5">
      {eintraege.map(({ icon: Icon, label, wert }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm font-medium tabular-nums">{wert}</span>
        </div>
      ))}
      {zertifikate.length ? (
        <div className="flex items-center gap-1.5">
          {zertifikate.map((c) => (
            <Badge key={c} variant="outline" className="text-[11px]">{c}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
