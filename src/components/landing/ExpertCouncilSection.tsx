import { Sparkles } from "lucide-react";

const experts = [
  {
    name: "Dr. Lena Richter",
    title: "AI Matching Architect",
    focus: "Talent-Graph, semantische Skill-Embeddings, LLM-Reranking.",
    action: "Unified Talent Graph + Hybrid Ranking (Vector + Regeln + Feedback).",
  },
  {
    name: "Maya Chen",
    title: "Growth & Activation",
    focus: "Activation Funnels, Trial-to-Value, A/B Testing.",
    action: "1-Wochen Activation Sprint mit messbaren Aha-Momenten.",
  },
  {
    name: "Jonas Becker",
    title: "Marketplace Liquidity",
    focus: "Recruiter/Client-Matching, Angebotsdichte, Time-to-First-Submission.",
    action: "Liquidity Heatmap + dynamische Preis/Anreiz-Engine.",
  },
  {
    name: "Sofia Alvarez",
    title: "Candidate Experience",
    focus: "Frictionless Bewerbungsflow, Mobile-First, Consent-UX.",
    action: "1-Click-Profile + Smart Consent Timeline.",
  },
  {
    name: "David König",
    title: "Product Ops",
    focus: "Feature Delivery, Roadmap Hygiene, KPI-Operating System.",
    action: "Weekly KPI Review + Shipping Cadence (2w).",
  },
  {
    name: "Priya Nair",
    title: "Data & Analytics",
    focus: "End-to-End Tracking, Attribution, Cohort Health.",
    action: "Event Taxonomy + North Star Dashboard.",
  },
  {
    name: "Leon Müller",
    title: "Security & Compliance",
    focus: "GDPR, Audit Trails, Triple Blind Policies.",
    action: "Privacy-by-Design Review + DPA Template Pack.",
  },
  {
    name: "Amir Hassan",
    title: "Infrastructure & Scale",
    focus: "Latency, Reliability, Cost Efficiency.",
    action: "SLOs + Cost/Query Benchmarking.",
  },
  {
    name: "Clara Vogt",
    title: "Trust & Safety",
    focus: "Fraud Prevention, Identity Verification, Escrow Safety.",
    action: "Risk Scoring + Anomaly Alerts für Deals.",
  },
  {
    name: "Nico Weber",
    title: "Recruiter Ops",
    focus: "Enablement, Playbooks, Submission Quality.",
    action: "Recruiter Scorecards + Coaching Loops.",
  },
  {
    name: "Eva Stein",
    title: "Revenue Architecture",
    focus: "Pricing, Usage Tiers, Margin Protection.",
    action: "Value-based Pricing + Dynamic Commission Rules.",
  },
  {
    name: "Tomás Silva",
    title: "Integrations Lead",
    focus: "ATS/HRIS Ecosystem, OAuth, Data Sync.",
    action: "Top-5 ATS Deep Integration + Bi-Directional Sync.",
  },
  {
    name: "Isabelle Schmidt",
    title: "UX Research",
    focus: "Persona Journeys, Conversion Bottlenecks.",
    action: "3 Persona Labs + Rapid UX Fixes.",
  },
  {
    name: "Khaled Mansour",
    title: "AI Safety & Eval",
    focus: "Bias Audits, Explainability, Model Governance.",
    action: "Bias Benchmark + Explainable Match Cards.",
  },
  {
    name: "Luca Romano",
    title: "International Expansion",
    focus: "Localization, Multi-Currency, Legal Readiness.",
    action: "DE/UK Launch Pack + Local Partner Playbook.",
  },
  {
    name: "Hanna Fischer",
    title: "Customer Success",
    focus: "Retention, Renewal, Executive QBRs.",
    action: "Outcome Roadmaps pro Kunde + Health Scoring.",
  },
  {
    name: "Marcel Dubois",
    title: "Sales Engineering",
    focus: "Pre-Sales, Demo Excellence, POCs.",
    action: "Instant Demo Environments + ROI Calculator.",
  },
  {
    name: "Yuki Tanaka",
    title: "Automation & Workflow",
    focus: "Scheduling, Messaging, Offer Automation.",
    action: "End-to-End Smart Workflow Templates.",
  },
  {
    name: "Sarah Olsen",
    title: "Community & Network Effects",
    focus: "Recruiter Community, Referrals, Reputation Graph.",
    action: "Reputation Badges + Referral Flywheel.",
  },
  {
    name: "Maximilian Roth",
    title: "Founder & Strategy",
    focus: "Vision, Capital Efficiency, Competitive Moat.",
    action: "Moat Map + 12-Monats Execution Plan.",
  },
];

const levers = [
  "Matching-Qualität verdoppeln mit Hybrid Ranking + Feedback Loops",
  "Time-to-Hire halbieren durch automatisierte Scheduling & Offers",
  "Marketplace-Liquidität erhöhen via dynamische Anreize",
  "Vertrauen maximieren mit Triple-Blind & Compliance Tooling",
  "Revenue skalieren mit Value-based Pricing & Margin Guards",
  "Global Ready: Lokalisierung, Multi-Currency, lokale Partner",
];

export const ExpertCouncilSection = () => {
  return (
    <section className="py-24 bg-muted/20">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald/10 border border-emerald/20 text-sm text-emerald mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="font-medium">20 Expert:innen an einem Tisch</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Maximale Plattform-Optimierung durch ein Elite-Team
          </h2>
          <p className="text-lg text-muted-foreground">
            Jede Person steht für ein entscheidendes Kompetenzfeld, damit wir das Maximum des heute weltweit Möglichen
            erreichen — Produkt, Growth, KI, Compliance, Operations und globale Skalierung.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {experts.map((expert) => (
            <div
              key={expert.name}
              className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <p className="text-sm text-emerald font-semibold uppercase tracking-wide">{expert.title}</p>
              <h3 className="text-xl font-bold mt-2">{expert.name}</h3>
              <p className="text-sm text-muted-foreground mt-3">{expert.focus}</p>
              <div className="mt-4 rounded-xl bg-muted/40 p-4 text-sm">
                <span className="font-semibold text-foreground">Sofortmaßnahme:</span> {expert.action}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-3xl border border-emerald/20 bg-gradient-to-br from-emerald/10 to-transparent p-8">
          <h3 className="text-2xl md:text-3xl font-bold mb-4">Die 6 Hebel für das globale Maximum</h3>
          <ul className="grid gap-3 md:grid-cols-2 text-base text-muted-foreground">
            {levers.map((lever) => (
              <li key={lever} className="flex gap-2">
                <span className="text-emerald font-bold">•</span>
                <span>{lever}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
