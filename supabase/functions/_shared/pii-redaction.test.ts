// Deno-Unit-Tests für die PII-Redaktion. Lauf: deno test supabase/functions/_shared/
import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { assertNoLeak, generalizeRegion, redactCandidateForLLM } from "./pii-redaction.ts";

function build(overrides: {
  candidate?: Record<string, any>;
  experiences?: any[];
  skills?: any[];
  languages?: any[];
  interviewNotes?: any;
  jobLocation?: string | null;
} = {}) {
  const candidate = {
    full_name: "Anna Müller",
    company: "Globex GmbH",
    city: "München",
    job_title: "Senior Engineer",
    seniority: "Senior",
    experience_years: 8,
    salary_expectation_min: 80000,
    salary_expectation_max: 95000,
    remote_preference: "hybrid",
    skills: ["TypeScript", "SAP"],
    certifications: ["AWS Solutions Architect"],
    email: "anna.mueller@example.com",
    linkedin_url: "https://linkedin.com/in/annamueller",
    cv_ai_summary: "Anna Müller war bei Globex GmbH in München tätig. Erfahrung mit SAP und TypeScript.",
    ...overrides.candidate,
  };
  return redactCandidateForLLM(
    candidate,
    overrides.experiences ?? [],
    overrides.skills ?? [],
    overrides.languages ?? [],
    overrides.interviewNotes ?? null,
    overrides.jobLocation ?? "München",
    "on",
  );
}

Deno.test("Name wird im strukturierten Feld und im Freitext pseudonymisiert", () => {
  const { view } = build();
  assertEquals(view.nameLabel, "[KANDIDAT]");
  assert(!view.cvSummary!.includes("Anna"), "Vorname leakt: " + view.cvSummary);
  assert(!view.cvSummary!.includes("Müller"), "Nachname leakt");
  assertStringIncludes(view.cvSummary!, "[KANDIDAT]");
});

Deno.test("Umlaut-Schreibvariante (Mueller) wird ebenfalls getroffen", () => {
  const { view } = build({
    candidate: { cv_ai_summary: "Frau Mueller leitete das Team. Anna war Ansprechpartnerin." },
  });
  assert(!view.cvSummary!.toLowerCase().includes("mueller"), "Mueller-Variante leakt: " + view.cvSummary);
  assert(!view.cvSummary!.includes("Anna"), "Anna leakt");
});

Deno.test("Arbeitgeber wird durch stabilen Alias ersetzt, Reihenfolge erhalten", () => {
  const { view } = build({
    experiences: [
      { company_name: "Globex GmbH", job_title: "Eng", location: "München", description: "Bei Globex GmbH Systeme gebaut." },
      { company_name: "Initech AG", job_title: "Dev", location: "Berlin", description: "Wechsel zu Initech AG." },
    ],
  });
  assertEquals(view.employer_alias, "[Arbeitgeber A]");
  assertEquals(view.experiences[0].employer_alias, "[Arbeitgeber A]");
  assertEquals(view.experiences[1].employer_alias, "[Arbeitgeber B]");
  assert(!view.experiences[0].description!.includes("Globex"), "Firmenname leakt im Freitext");
  assertStringIncludes(view.experiences[0].description!, "[Arbeitgeber A]");
});

Deno.test("Skill-Kollision: 'SAP' als Arbeitgeber UND Skill bleibt im Freitext erhalten", () => {
  const { view, leakContext } = build({
    candidate: {
      company: "SAP",
      skills: ["SAP", "ABAP"],
      cv_ai_summary: "Tiefe SAP-Kenntnisse, zuletzt im SAP-Umfeld tätig.",
    },
  });
  assertStringIncludes(view.cvSummary!, "SAP");
  // SAP darf NICHT als Leak gewertet werden (Allowlist)
  assert(!leakContext.companyTokens.map((t) => t.toLowerCase()).includes("sap"));
});

Deno.test("Wortgrenze: Stadt 'Berg' zerstört 'Heidelberg' nicht", () => {
  const { view } = build({
    candidate: { city: "Berg", cv_ai_summary: "Tätig in Heidelberg, wohnhaft in Berg." },
  });
  assertStringIncludes(view.cvSummary!, "Heidelberg");
  assert(!/\bBerg\b/.test(view.cvSummary!.replace("Heidelberg", "")), "Berg als ganzes Wort blieb stehen");
});

Deno.test("Kurzer Name 'Le' trifft nicht 'Leitung'/'wurde'", () => {
  const { view } = build({
    candidate: { full_name: "Le Wu", cv_ai_summary: "Die Leitung wurde übernommen. Le war dabei, Wu ebenfalls." },
  });
  assertStringIncludes(view.cvSummary!, "Leitung");
  assertStringIncludes(view.cvSummary!, "wurde");
  assert(!/\bLe\b/u.test(view.cvSummary!), "Le als ganzes Wort blieb stehen");
  assert(!/\bWu\b/u.test(view.cvSummary!), "Wu als ganzes Wort blieb stehen");
});

Deno.test("Regex-Klassen: E-Mail / Telefon / URL / Datum werden entfernt", () => {
  const { view } = build({
    candidate: {
      cv_ai_summary: "Erreichbar unter test.person@firma.de oder +49 170 1234567. Profil: https://example.com/cv. Start am 01.03.2019.",
    },
  });
  const s = view.cvSummary!;
  assert(!s.includes("@firma.de"), "E-Mail leakt");
  assert(!s.includes("1234567"), "Telefon leakt");
  assert(!s.includes("example.com"), "URL leakt");
  assert(!s.includes("01.03.2019"), "Datum leakt");
});

Deno.test("Gehaltszahlen werden NICHT als Telefon entfernt", () => {
  const { view } = build({
    candidate: { cv_ai_summary: "Gehaltsvorstellung 80000 bis 95000 EUR, 8 Jahre Erfahrung seit 2016." },
  });
  assertStringIncludes(view.cvSummary!, "80000");
  assertStringIncludes(view.cvSummary!, "95000");
  assertStringIncludes(view.cvSummary!, "2016");
});

Deno.test("Fachsubstanz bleibt: Skills/Gehalt/Seniority unverändert", () => {
  const { view } = build();
  assertEquals(view.skills, ["TypeScript", "SAP"]);
  assertEquals(view.salary_min, 80000);
  assertEquals(view.seniority, "Senior");
  assertEquals(view.experience_years, 8);
});

Deno.test("Allowlist-Payload enthält keine direkten Identifikatoren als Schlüssel", () => {
  const { view } = build();
  const keys = Object.keys(view);
  for (const forbidden of ["full_name", "email", "phone", "linkedin_url", "address", "nationality", "cv_raw_text"]) {
    assert(!keys.includes(forbidden), `Verbotenes Feld im LLM-View: ${forbidden}`);
  }
});

Deno.test("null/leere Felder brechen nicht", () => {
  const { view } = build({
    candidate: { cv_ai_summary: null, summary: null, city: null },
    experiences: [{ company_name: null, description: null, location: null }],
  });
  assertEquals(view.cvSummary, null);
  assertEquals(view.region, "DACH");
});

Deno.test("generalizeRegion bildet bekannte Städte auf Regionen ab", () => {
  assertEquals(generalizeRegion("München"), "Süddeutschland");
  assertEquals(generalizeRegion("Berlin"), "Norddeutschland");
  assertEquals(generalizeRegion("Köln"), "Westdeutschland");
  assertEquals(generalizeRegion(null), "DACH");
  assertEquals(generalizeRegion("Irgendwo"), "DACH");
});

Deno.test("location_relation: gleiche vs. andere Region", () => {
  const same = build({ candidate: { city: "München" }, jobLocation: "Augsburg" });
  assertStringIncludes(same.view.location_relation, "gleiche Region");
  const diff = build({ candidate: { city: "Hamburg" }, jobLocation: "München" });
  assertStringIncludes(diff.view.location_relation, "andere Region");
});

Deno.test("assertNoLeak: erkennt rohe Tokens, akzeptiert sauberen Prompt", () => {
  const ctx = { nameTokens: ["Müller"], companyTokens: ["Globex GmbH"], cityTokens: ["München"] };
  assertEquals(assertNoLeak("[KANDIDAT] arbeitete bei [Arbeitgeber A] in [Region].", ctx), []);
  assert(assertNoLeak("Anna Müller aus München.", ctx).includes("name"));
  assert(assertNoLeak("Kontakt: a@b.de", { nameTokens: [], companyTokens: [], cityTokens: [] }).includes("email"));
});
