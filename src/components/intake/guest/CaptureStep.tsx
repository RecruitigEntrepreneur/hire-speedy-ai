import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ProfileSections, type FlexibilityMap } from '@/components/dashboard/intake/ProfileSections';
import { DynamicBriefing, EMPTY_DYN_STATE, type DynState } from '@/components/dashboard/intake/DynamicBriefing';
import { QualityCheck } from '@/components/dashboard/intake/QualityCheck';
import {
  briefingProgress, openBriefingQuestions, prefillFromBuilt, serializeBriefing, type Answers,
} from '@/components/dashboard/IntakeBriefing';
import { EMPTY_FREELANCE, type BuiltJob, type FreelanceTerms, type RevealSetup } from '@/components/dashboard/intake/types';
import {
  EMPTY_BUILT, buildAiJobDraft, fromParsedJobData, toBriefBuilt,
} from '@/lib/intakeMapping';
import { isFailure } from '@/hooks/useGuestIntake';
import { ArrowRight, FileText, Link2, Loader2, Sparkles } from 'lucide-react';

/**
 * Die Aufnahme selbst — dieselben Bausteine wie im Dashboard-Studio.
 *
 * ProfileSections, DynamicBriefing, QualityCheck und der 36-Fragen-Katalog aus
 * IntakeBriefing werden unverändert wiederverwendet; sie greifen weder auf
 * useAuth noch direkt auf Supabase zu. Der einzige Unterschied ist der Weg zur
 * KI: statt supabase.functions.invoke('intake-questions') mit dem JWT des
 * Kunden läuft hier der token-geprüfte Proxy (askAi-Prop).
 *
 * Ein zweiter Fragenkatalog wäre der Anfang von zwei Wahrheiten darüber, was
 * eine vollständige Aufnahme ist.
 */

export interface CaptureState {
  type: 'full-time' | 'freelance';
  built: BuiltJob | null;
  answers: Answers;
  dyn: DynState;
  freelance: FreelanceTerms;
  flexibility: FlexibilityMap;
  revealSetup: RevealSetup;
}

export const emptyCapture = (type: 'full-time' | 'freelance'): CaptureState => ({
  type,
  built: null,
  answers: {},
  dyn: EMPTY_DYN_STATE,
  freelance: EMPTY_FREELANCE,
  flexibility: {},
  revealSetup: { descriptor: '', trigger: 'after_first_interview' },
});

interface Props {
  state: CaptureState;
  onState: (updater: (prev: CaptureState) => CaptureState) => void;
  companyDefaults: {
    industry?: string | null;
    size?: string | null;
    company_name?: string | null;
    location?: string | null;
  } | null;
  seedText?: string | null;
  askAi: (payload: Record<string, unknown>) => Promise<Record<string, any>>;
  parseText: (text: string) => Promise<any>;
  parseUrl: (url: string) => Promise<any>;
  onNext: () => void;
}

export function CaptureStep({
  state, onState, companyDefaults, seedText, askAi, parseText, parseUrl, onNext,
}: Props) {
  const [text, setText] = useState(seedText ?? '');
  const [url, setUrl] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [building, setBuilding] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const briefingRef = useRef<HTMLDivElement>(null);

  const { built, answers, dyn, freelance, flexibility, revealSetup, type } = state;

  const staticProg = built
    ? briefingProgress(type, { remote_type: built.remote_type }, answers)
    : { pct: 0, open: 0, totalQ: 0 };

  const jobDraft = useMemo(
    () =>
      built
        ? buildAiJobDraft({
            type, built, freelance, flexibility,
            // Was der Link über das Unternehmen mitbringt, gilt als beantwortet:
            // Regel 8 des Systemprompts fragt company_defaults nie erneut ab.
            companyDefaults: companyDefaults
              ? { industry: companyDefaults.industry, size: companyDefaults.size }
              : null,
          })
        : {},
    [built, type, freelance, flexibility, companyDefaults],
  );

  const openQuestions = useMemo(
    () => (built ? openBriefingQuestions(type, { remote_type: built.remote_type }, answers) : []),
    [built, type, answers],
  );

  const start = (job: BuiltJob) => {
    onState((s) => ({
      ...s,
      built: job,
      answers: prefillFromBuilt(toBriefBuilt(job)),
      revealSetup: s.revealSetup.descriptor
        ? s.revealSetup
        : {
            ...s.revealSetup,
            descriptor: [job.industry || companyDefaults?.industry, job.location && `Region ${job.location}`]
              .filter(Boolean).join(', '),
          },
    }));
  };

  const buildFrom = async (mode: 'text' | 'url') => {
    setBuilding(true);
    setAiNote(null);
    const res = mode === 'url' ? await parseUrl(url.trim()) : await parseText(text.trim());
    setBuilding(false);

    if (isFailure(res)) {
      // Kein Sackgassen-Fehler: der manuelle Weg steht daneben und wird hier
      // ausdrücklich angeboten. Ein Gast hat kein Dashboard zum Ausweichen.
      setAiNote(res.message);
      return;
    }
    const parsed = (res as any)?.data;
    if (!parsed || !parsed.title) {
      setAiNote('Daraus konnten wir keine Position erkennen. Bitte ergänzen Sie den Text — oder tragen Sie die Eckdaten direkt ein.');
      return;
    }
    const job = fromParsedJobData(parsed);
    if (!job.company_name && companyDefaults?.company_name) job.company_name = companyDefaults.company_name;
    if (!job.location && companyDefaults?.location) job.location = companyDefaults.location;
    if (!job.industry && companyDefaults?.industry) job.industry = companyDefaults.industry;
    start(job);
  };

  const startManual = () => {
    const seed = text.trim();
    start({
      ...EMPTY_BUILT,
      title: seed.length > 0 && seed.length <= 120 ? seed : '',
      company_name: companyDefaults?.company_name ?? '',
      location: companyDefaults?.location ?? '',
      industry: companyDefaults?.industry ?? '',
    });
  };

  const moveSkillToNice = (skill: string) => {
    onState((s) =>
      s.built
        ? {
            ...s,
            built: {
              ...s.built,
              must_haves: s.built.must_haves.filter((x) => x.toLowerCase() !== skill.toLowerCase()),
              nice_to_haves: s.built.nice_to_haves.some((x) => x.toLowerCase() === skill.toLowerCase())
                ? s.built.nice_to_haves
                : [...s.built.nice_to_haves, skill],
            },
          }
        : s,
    );
    toast.success(`„${skill}" zu Kann verschoben — größerer Kandidaten-Pool.`);
  };

  // ---- Einstieg -----------------------------------------------------------
  if (!built) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Erzählen Sie uns von der Rolle</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anzeige einfügen, beschreiben oder verlinken — daraus bauen wir ein vollständiges Profil.
            Alles bleibt danach änderbar.
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          className="resize-none text-sm"
          placeholder={'z. B. „Senior Cloud Architect in Frankfurt, hybrid, ~95k, AWS & Kubernetes, ab August …"\n\noder die komplette Stellenanzeige hier einfügen.'}
        />

        {showUrl && (
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://karriere.example.com/job/123"
            className="text-sm"
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="hero"
            className="gap-2"
            disabled={building || (!text.trim() && !url.trim())}
            onClick={() => buildFrom(url.trim() ? 'url' : 'text')}
          >
            {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Profil bauen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowUrl((v) => !v)}>
            <Link2 className="h-4 w-4" /> Link
          </Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={startManual}>
            <FileText className="h-4 w-4" /> Ohne Vorlage starten
          </Button>
        </div>

        {aiNote && (
          <Alert>
            <AlertDescription className="text-xs">
              {aiNote}{' '}
              <button type="button" onClick={startManual} className="underline underline-offset-2">
                Eckdaten direkt eintragen
              </button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  // ---- Aufnahme -----------------------------------------------------------
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{built.title || 'Ihre Position'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Links steht das Profil, rechts die offenen Fragen. Alles ist änderbar.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {dyn.available
            ? `${dyn.answers.length} beantwortet${dyn.chapterProgress.filter((c) => c.state === 'open').length ? ` · ${dyn.chapterProgress.filter((c) => c.state === 'open').length} Kapitel offen` : ''}`
            : `${staticProg.open} von ${staticProg.totalQ} Fragen offen`}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border">
          <ProfileSections
            type={type}
            built={built}
            onChange={(b) => onState((s) => ({ ...s, built: b }))}
            freelance={freelance}
            onFreelanceChange={(f) => onState((s) => ({ ...s, freelance: f }))}
            reveal={revealSetup}
            onRevealChange={(r) => onState((s) => ({ ...s, revealSetup: r }))}
            flexibility={flexibility}
            onFlexibilityChange={(f) => onState((s) => ({ ...s, flexibility: f }))}
          />
        </div>

        <div className="space-y-4" ref={briefingRef}>
          <div className="rounded-xl border p-4">
            <DynamicBriefing
              type={type}
              jobDraft={jobDraft}
              state={dyn}
              onState={(updater) => onState((s) => ({ ...s, dyn: updater(s.dyn) }))}
              onMoveSkillToNice={moveSkillToNice}
              onDone={onNext}
              askAi={askAi as any}
              fallback={{
                built: toBriefBuilt(built),
                value: answers,
                onChange: (a) => onState((s) => ({ ...s, answers: a })),
              }}
            />
          </div>

          <QualityCheck
            type={type}
            built={built}
            freelance={freelance}
            answers={answers}
            openQuestions={openQuestions}
            revealDescriptor={revealSetup.descriptor}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <span className="text-xs text-muted-foreground">
          Reicht Ihnen das? Sie können jederzeit weiter — Lücken lassen sich später ergänzen.
        </span>
        <Button onClick={onNext} disabled={!built.title.trim()} className="gap-2">
          Weiter zu Ihren Kontaktdaten <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Der serialisierte Briefing-Text — identisch zum Dashboard-Weg. */
export const captureBriefingText = (answers: Answers): string | null => serializeBriefing(answers) || null;
