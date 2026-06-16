import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  labelKey: string;
  beforeKey: string;
  afterKey: string;
  revealed: boolean; // becomes visible only after opt-in
}

interface Party {
  id: string;
  icon: typeof Building2;
  roleKey: string;
  taglineKey: string;
  fields: FieldRow[];
}

const PARTIES: Party[] = [
  {
    id: "company",
    icon: Building2,
    roleKey: "parties.company_role",
    taglineKey: "parties.company_tagline",
    fields: [
      { labelKey: "parties.company_field1_label", beforeKey: "parties.company_field1_before", afterKey: "parties.company_field1_after", revealed: false },
      { labelKey: "parties.company_field2_label", beforeKey: "parties.company_field2_before", afterKey: "parties.company_field2_after", revealed: false },
      { labelKey: "parties.company_field3_label", beforeKey: "parties.company_field3_before", afterKey: "parties.company_field3_after", revealed: false },
      { labelKey: "parties.company_field4_label", beforeKey: "parties.company_field4_before", afterKey: "parties.company_field4_after", revealed: true },
    ],
  },
  {
    id: "recruiter",
    icon: UserSearch,
    roleKey: "parties.recruiter_role",
    taglineKey: "parties.recruiter_tagline",
    fields: [
      { labelKey: "parties.recruiter_field1_label", beforeKey: "parties.recruiter_field1_before", afterKey: "parties.recruiter_field1_after", revealed: false },
      { labelKey: "parties.recruiter_field2_label", beforeKey: "parties.recruiter_field2_before", afterKey: "parties.recruiter_field2_after", revealed: false },
      { labelKey: "parties.recruiter_field3_label", beforeKey: "parties.recruiter_field3_before", afterKey: "parties.recruiter_field3_after", revealed: true },
      { labelKey: "parties.recruiter_field4_label", beforeKey: "parties.recruiter_field4_before", afterKey: "parties.recruiter_field4_after", revealed: false },
    ],
  },
  {
    id: "candidate",
    icon: Briefcase,
    roleKey: "parties.candidate_role",
    taglineKey: "parties.candidate_tagline",
    fields: [
      { labelKey: "parties.candidate_field1_label", beforeKey: "parties.candidate_field1_before", afterKey: "parties.candidate_field1_after", revealed: true },
      { labelKey: "parties.candidate_field2_label", beforeKey: "parties.candidate_field2_before", afterKey: "parties.candidate_field2_after", revealed: false },
      { labelKey: "parties.candidate_field3_label", beforeKey: "parties.candidate_field3_before", afterKey: "parties.candidate_field3_after", revealed: false },
      { labelKey: "parties.candidate_field4_label", beforeKey: "parties.candidate_field4_before", afterKey: "parties.candidate_field4_after", revealed: true },
    ],
  },
];

const BENEFITS = [
  {
    icon: Scale,
    partyKey: "benefits.item1_party",
    titleKey: "benefits.item1_title",
    textKey: "benefits.item1_text",
  },
  {
    icon: ShieldCheck,
    partyKey: "benefits.item2_party",
    titleKey: "benefits.item2_title",
    textKey: "benefits.item2_text",
  },
  {
    icon: Lock,
    partyKey: "benefits.item3_party",
    titleKey: "benefits.item3_title",
    textKey: "benefits.item3_text",
  },
];

const PhaseToggle = ({ phase, setPhase }: { phase: Phase; setPhase: (p: Phase) => void }) => {
  const { t } = useTranslation();
  return (
    <div className="inline-flex items-center rounded-full border border-border/60 bg-card p-1">
      {(
        [
          { id: "before" as Phase, labelKey: "toggle.before", icon: EyeOff },
          { id: "after" as Phase, labelKey: "toggle.after", icon: Eye },
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
            {t(`tripleBlind.${opt.labelKey}`)}
          </button>
        );
      })}
    </div>
  );
};

const PartyCard = ({ party, phase, index }: { party: Party; phase: Phase; index: number }) => {
  const { t } = useTranslation();
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
          <h3 className="text-lg font-bold text-foreground leading-tight">{t(`tripleBlind.${party.roleKey}`)}</h3>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5">{t(`tripleBlind.${party.taglineKey}`)}</p>

      <ul className="space-y-2.5">
        {party.fields.map((f) => {
          const value = phase === "before" ? t(`tripleBlind.${f.beforeKey}`) : t(`tripleBlind.${f.afterKey}`);
          // a revealed field is locked in phase "before", unlocked in "after"
          const locked = f.revealed && phase === "before";
          const justRevealed = f.revealed && phase === "after";
          return (
            <li
              key={f.labelKey}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-all duration-500 ${
                locked
                  ? "border-border/40 bg-muted/40"
                  : justRevealed
                  ? "border-foreground/30 bg-foreground/[0.06]"
                  : "border-border/40 bg-muted/20"
              }`}
            >
              <span className="text-muted-foreground">{t(`tripleBlind.${f.labelKey}`)}</span>
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
  const { t } = useTranslation();
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
            <span className="font-medium">{t("tripleBlind.badge")}</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
            {t("tripleBlind.headline1")}
            <br />
            <span className="text-muted-foreground">{t("tripleBlind.headline2")}</span>
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {t("tripleBlind.subline")}
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
              {t("tripleBlind.caption_before")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              {t("tripleBlind.caption_after")}
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
              {t("tripleBlind.cta")}
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

const BenefitCard = ({ benefit, index }: { benefit: (typeof BENEFITS)[0]; index: number }) => {
  const { t } = useTranslation();
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
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t(`tripleBlind.${benefit.partyKey}`)}</p>
      <h3 className="text-xl font-bold text-foreground mb-3">{t(`tripleBlind.${benefit.titleKey}`)}</h3>
      <p className="text-muted-foreground leading-relaxed">{t(`tripleBlind.${benefit.textKey}`)}</p>
    </div>
  );
};
