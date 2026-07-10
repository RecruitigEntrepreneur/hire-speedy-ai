import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { type BuiltJob, type FreelanceTerms, type JobType, type RevealSetup, REVEAL_TRIGGER_LABELS } from './types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Building2, Coins, Lock, MapPin, Plus, Sparkles, X } from 'lucide-react';

/** Flexibilitätsmatrix: wie hart ist jedes Muss-Kriterium wirklich? */
export type Flexibility = 'fix' | 'negotiable' | 'flexible';
export type FlexibilityMap = Record<string, Flexibility>;

const FLEX_CYCLE: Flexibility[] = ['fix', 'negotiable', 'flexible'];
const FLEX_LABEL: Record<Flexibility, string> = { fix: 'fix', negotiable: 'verhandelbar', flexible: 'flexibel' };
const FLEX_CLS: Record<Flexibility, string> = {
  fix: 'border-primary/40 text-primary',
  negotiable: 'border-amber-500/50 text-amber-600',
  flexible: 'border-border text-muted-foreground',
};

interface Props {
  type: JobType;
  built: BuiltJob;
  onChange: (b: BuiltJob) => void;
  freelance: FreelanceTerms;
  onFreelanceChange: (f: FreelanceTerms) => void;
  reveal: RevealSetup;
  onRevealChange: (r: RevealSetup) => void;
  flexibility: FlexibilityMap;
  onFlexibilityChange: (f: FlexibilityMap) => void;
}

function Section({ title, icon: Icon, children, className }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('border-b p-4 last:border-b-0', className)}>
      <p className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </p>
      {children}
    </div>
  );
}

function SkillList({ label, items, onRemove, onAdd, accent }: { label: string; items: string[]; onRemove: (s: string) => void; onAdd: (s: string) => void; accent?: boolean }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft('');
  };
  return (
    <div className="mb-2">
      <p className="mb-1.5 text-[11px] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((s) => (
          <Badge key={s} variant={accent ? 'default' : 'secondary'} className="gap-1 pr-1">
            {s}
            <button onClick={() => onRemove(s)} aria-label={`${s} entfernen`} className="rounded-full p-0.5 hover:bg-background/20">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="+ Skill"
            className="h-7 w-28 text-xs"
          />
          {draft.trim() && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={add} aria-label="Skill hinzufügen">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(/\D/g, '')) || null);

/** Linke Studio-Spalte: das KI-gefüllte Profil, in Sektionen editierbar. */
export function ProfileSections({
  type, built, onChange, freelance, onFreelanceChange, reveal, onRevealChange, flexibility, onFlexibilityChange,
}: Props) {
  const set = (patch: Partial<BuiltJob>) => onChange({ ...built, ...patch });
  const isFreelance = type === 'freelance';

  const cycleFlex = (skill: string) => {
    const current = flexibility[skill] ?? 'fix';
    const next = FLEX_CYCLE[(FLEX_CYCLE.indexOf(current) + 1) % FLEX_CYCLE.length];
    onFlexibilityChange({ ...flexibility, [skill]: next });
  };

  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b p-4 pb-3">
        <Badge variant="outline" className="mb-2 gap-1 text-xs">
          <Sparkles className="h-3 w-3 text-primary" /> KI-Entwurf · alles editierbar
        </Badge>
        <Input
          value={built.title}
          onChange={(e) => set({ title: e.target.value })}
          className="h-auto border-0 px-0 text-lg font-bold shadow-none focus-visible:ring-0"
          placeholder="Jobtitel"
        />
      </div>

      <Section title="Eckdaten" icon={MapPin}>
        <div className="grid grid-cols-2 gap-2">
          <Input value={built.location} onChange={(e) => set({ location: e.target.value })} placeholder="Standort" className="h-8 text-xs" />
          <Select value={built.remote_type || 'hybrid'} onValueChange={(v) => set({ remote_type: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">Vor Ort</SelectItem>
            </SelectContent>
          </Select>
          <Select value={built.experience_level || 'mid'} onValueChange={(v) => set({ experience_level: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="junior">Junior</SelectItem>
              <SelectItem value="mid">Mid-Level</SelectItem>
              <SelectItem value="senior">Senior</SelectItem>
              <SelectItem value="lead">Lead</SelectItem>
            </SelectContent>
          </Select>
          <Input value={built.industry} onChange={(e) => set({ industry: e.target.value })} placeholder="Branche" className="h-8 text-xs" />
        </div>
      </Section>

      <Section title={isFreelance ? 'Konditionen (Contracting)' : 'Vergütung'} icon={Coins}>
        {isFreelance ? (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={freelance.dayRateMin ?? ''}
              onChange={(e) => onFreelanceChange({ ...freelance, dayRateMin: numOrNull(e.target.value) })}
              placeholder="Tagessatz von (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Input
              value={freelance.dayRateMax ?? ''}
              onChange={(e) => onFreelanceChange({ ...freelance, dayRateMax: numOrNull(e.target.value) })}
              placeholder="Tagessatz bis (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Input
              value={freelance.durationMonths ?? ''}
              onChange={(e) => onFreelanceChange({ ...freelance, durationMonths: numOrNull(e.target.value) })}
              placeholder="Dauer (Monate)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Select
              value={String(freelance.utilizationDaysPerWeek ?? '')}
              onValueChange={(v) => onFreelanceChange({ ...freelance, utilizationDaysPerWeek: Number(v) })}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Auslastung" /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((d) => (
                  <SelectItem key={d} value={String(d)}>{d} Tage/Woche</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={freelance.extensionPossible}
                onChange={(e) => onFreelanceChange({ ...freelance, extensionPossible: e.target.checked })}
                className="h-3.5 w-3.5"
              />
              Verlängerung möglich
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={built.salary_min ?? ''}
              onChange={(e) => set({ salary_min: numOrNull(e.target.value) })}
              placeholder="Gehalt von (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
            <Input
              value={built.salary_max ?? ''}
              onChange={(e) => set({ salary_max: numOrNull(e.target.value) })}
              placeholder="Gehalt bis (€)"
              inputMode="numeric"
              className="h-8 text-xs"
            />
          </div>
        )}
      </Section>

      <Section title="Skills" icon={Sparkles}>
        <p className="mb-1.5 text-[11px] text-muted-foreground">
          Muss-Kriterien — klicken Sie das Label, um die Verhandelbarkeit zu setzen (fix → verhandelbar → flexibel):
        </p>
        <div className="mb-2 space-y-1">
          {built.must_haves.map((s) => {
            const flex = flexibility[s] ?? 'fix';
            return (
              <div key={s} className="flex items-center gap-2">
                <Badge variant="default" className="gap-1 pr-1">
                  {s}
                  <button
                    onClick={() => set({ must_haves: built.must_haves.filter((x) => x !== s) })}
                    aria-label={`${s} entfernen`}
                    className="rounded-full p-0.5 hover:bg-background/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
                <button
                  onClick={() => cycleFlex(s)}
                  className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors', FLEX_CLS[flex])}
                  aria-label={`Verhandelbarkeit von ${s}: ${FLEX_LABEL[flex]}`}
                >
                  {FLEX_LABEL[flex]}
                </button>
              </div>
            );
          })}
        </div>
        <SkillList
          label="Weiteres Muss-Kriterium"
          items={[]}
          accent
          onRemove={() => undefined}
          onAdd={(s) => set({ must_haves: [...built.must_haves, s] })}
        />
        {built.must_haves.length >= 8 && (
          <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              {built.must_haves.length} Muss-Kriterien — ab 8 schrumpft der erreichbare Markt erheblich.
              Welche 2 sind ehrlich „verhandelbar"?
            </p>
          </div>
        )}
        <SkillList
          label="Kann (nice to have)"
          items={built.nice_to_haves}
          onRemove={(s) => set({ nice_to_haves: built.nice_to_haves.filter((x) => x !== s) })}
          onAdd={(s) => set({ nice_to_haves: [...built.nice_to_haves, s] })}
        />
      </Section>

      <Section title="Firma & Reveal (Triple-Blind)" icon={Lock} className="bg-muted/30">
        <p className="mb-1.5 text-[11px] text-muted-foreground">
          So sehen Recruiter Ihre Firma, bis Sie die Identität freigeben:
        </p>
        <Input
          value={reveal.descriptor}
          onChange={(e) => onRevealChange({ ...reveal, descriptor: e.target.value })}
          placeholder={`z. B. „${built.industry || 'Unternehmen'}, Mittelstand, Region ${built.location || 'DACH'}"`}
          className="mb-2 h-8 text-xs"
        />
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <Select value={reveal.trigger} onValueChange={(v) => onRevealChange({ ...reveal, trigger: v as RevealSetup['trigger'] })}>
            <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REVEAL_TRIGGER_LABELS) as RevealSetup['trigger'][]).map((k) => (
                <SelectItem key={k} value={k}>Firmen-Reveal: {REVEAL_TRIGGER_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>
    </div>
  );
}
