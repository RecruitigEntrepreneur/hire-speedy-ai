import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Building2,
  UserSearch,
  Briefcase,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type Phase = "before" | "after";

// What each party can see in each phase — mirrors the real anonymization
// pipeline (src/lib/anonymization.ts): identity, exact location, salary and
// employer are masked until both sides opt in.
interface FieldRow {
  label: string;
  before: string;
  after: string;
  revealed: boolean; // becomes visible only after opt-in
}

interface Party {
  id: string;
  icon: typeof Building2;
  role: string;
  tagline: string;
  fields: FieldRow[];
}

const PARTIES: Party[] = [
  {
    id: "company",
    icon: Building2,
    role: "Unternehmen",
    tagline: "Bewertet Eignung, nicht Lebensläufe.",
    fields: [
      { label: "Skills & Fit-Score", before: "Vollständig sichtbar", after: "Vollständig sichtbar", revealed: false },
      { label: "Erfahrung & Gehalt", before: "Als Range", after: "Als Range", revealed: false },
      { label: "Region", before: "Süddeutschland", after: "Süddeutschland", revealed: false },
      { label: "Name & Kontakt", before: "Verborgen", after: "Freigegeben", revealed: true },
    ],
  },
  {
    id: "recruiter",
    icon: UserSearch,
    role: "Recruiter",
    tagline: "Behält den eigenen Kandidaten.",
    fields: [
      { label: "Mandat & Anforderungen", before: "Vollständig sichtbar", after: "Vollständig sichtbar", revealed: false },
      { label: "Eigener Kandidat", before: "Exklusiv zugeordnet", after: "Exklusiv zugeordnet", revealed: false },
      { label: "Auftraggeber", before: "[Branche] Unternehmen", after: "Offengelegt", revealed: true },
      { label: "Provisionsschutz", before: "Garantiert", after: "Garantiert", revealed: false },
    ],
  },
  {
    id: "candidate",
    icon: Briefcase,
    role: "Kandidat",
    tagline: "Sucht diskret, behält die Kontrolle.",
    fields: [
      { label: "Identität", before: "Anonym (Kandidat #A1B2)", after: "Selbst freigegeben", revealed: true },
      { label: "Passende Rollen", before: "Vollständig sichtbar", after: "Vollständig sichtbar", revealed: false },
      { label: "Aktueller Arbeitgeber", before: "Geschützt", after: "Geschützt", revealed: false },
      { label: "Datenfreigabe", before: "Nur mit Zustimmung", after: "Erteilt", revealed: true },
    ],
  },
];

const BENEFITS = [
  {
    icon: Scale,
    party: "Für Unternehmen",
    title: "Bias-freie, faire Auswahl",
    text: "Sie sehen Skills und Fit — nicht Name, Foto oder Herkunft. Vorurteile werden ausgeschlossen, bevor sie entstehen können. Datenschutz nach DSGVO ist im Prozess eingebaut, nicht aufgesetzt.",
  },
  {
    icon: ShieldCheck,
    party: "Für Recruiter",
    title: "Ihr Kandidat bleibt Ihr Kandidat",
    text: "Das Unternehmen sieht Ihren Kandidaten erst, wenn der Deal über Matchunt läuft. Kein Backdoor-Hiring an Ihnen vorbei — Ihre Provision ist abgesichert.",
  },
  {
    icon: Lock,
    party: "Für Kandidaten",
    title: "Diskrete Suche ohne Risiko",
    text: "Anonym auf dem Markt, ohne dass der aktuelle Arbeitgeber etwas mitbekommt. Sie entscheiden selbst, wer welche Daten wann sieht.",
  },
];

const PhaseToggle = ({ phase, setPhase }: { phase: Phase; setPhase: (p: Phase) => void }) => (
  <div className="inline-flex items-center rounded-full border border-border/60 bg-card p-1">
    {(
      [
        { id: "before" as Phase, label: "Vor dem Match", icon: EyeOff },
        { id: "after" as Phase, label: "Nach beidseitigem Opt-In", icon: Eye },
      ]
    ).map((opt) => {
      const active = phase === opt.id;
      return (
        <button
          key={opt.id}
          onClick={() => setPhase(opt.id)}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all ${
            active ? "bg-foreground text-background shadow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <opt.icon className="w-4 h-4" />
          {opt.label}
        </button>
      );
    })}
  </div>
);

const PartyCard = ({ party, phase, index }: { party: Party; phase: Phase; index: number }) => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`relative flex flex-col rounded-2xl border border-border/50 bg-card p-6 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-foreground/10">
          <party.icon className="h-5 w-5 text-foreground" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground leading-tight">{party.role}</h3>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5">{party.tagline}</p>

      <ul className="space-y-2.5">
        {party.fields.map((f) => {
          const value = phase === "before" ? f.before : f.after;
          // a revealed field is locked in phase "before", unlocked in "after"
          const locked = f.revealed && phase === "before";
          const justRevealed = f.revealed && phase === "after";
          return (
            <li
              key={f.label}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-all duration-500 ${
                locked
                  ? "border-border/40 bg-muted/40"
                  : justRevealed
                  ? "border-foreground/30 bg-foreground/[0.06]"
                  : "border-border/40 bg-muted/20"
              }`}
            >
              <span className="text-muted-foreground">{f.label}</span>
              <span className={`flex items-center gap-1.5 font-medium ${locked ? "text-muted-foreground/70" : "text-foreground"}`}>
                {locked ? (
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                ) : justRevealed ? (
                  <Unlock className="h-3.5 w-3.5 shrink-0" />
                ) : null}
                <span className={locked ? "blur-[3px] select-none" : ""}>{value}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const TripleBlindSection = () => {
  const [phase, setPhase] = useState<Phase>("before");
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="triple-blind" className="py-24 bg-background relative overflow-hidden">
      {/* faint grid backdrop */}
      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div
          ref={ref}
          className={`max-w-3xl mx-auto text-center mb-12 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-foreground/5 border border-border/40 text-sm text-muted-foreground mb-6">
            <EyeOff className="w-4 h-4" />
            <span className="font-medium">Triple-Blind</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            Niemand sieht mehr,
            <br />
            <span className="text-muted-foreground">als er muss.</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Der einzige Recruiting-Marktplatz im DACH-Raum, der alle drei Seiten schützt –
            bis beide Seiten Ja sagen. Sehen Sie selbst, wer was wann sieht.
          </p>
        </div>

        {/* Phase toggle */}
        <div className="flex justify-center mb-10">
          <PhaseToggle phase={phase} setPhase={setPhase} />
        </div>

        {/* Three-party diagram */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mb-8">
          {PARTIES.map((party, i) => (
            <PartyCard key={party.id} party={party} phase={phase} index={i} />
          ))}
        </div>

        {/* phase caption */}
        <p className="text-center text-sm text-muted-foreground mb-20 transition-all duration-500">
          {phase === "before" ? (
            <span className="inline-flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Vor dem Match bleiben Identität, Auftraggeber und Kontaktdaten verborgen.
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              Erst wenn beide Seiten zustimmen, werden die geschützten Felder freigegeben.
            </span>
          )}
        </p>

        {/* Benefits per party */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {BENEFITS.map((b, i) => {
            return <BenefitCard key={i} benefit={b} index={i} />;
          })}
        </div>

        <div className="text-center mt-14">
          <Button asChild size="lg" className="bg-foreground text-background hover:bg-foreground/90 px-8 py-6 text-lg shadow-lg">
            <Link to="/auth?mode=signup&role=client">
              Triple-Blind starten
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

const BenefitCard = ({ benefit, index }: { benefit: (typeof BENEFITS)[0]; index: number }) => {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`rounded-2xl border border-border/50 bg-card p-7 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/10 mb-5">
        <benefit.icon className="h-6 w-6 text-foreground" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{benefit.party}</p>
      <h3 className="text-xl font-bold text-foreground mb-3">{benefit.title}</h3>
      <p className="text-muted-foreground leading-relaxed">{benefit.text}</p>
    </div>
  );
};
