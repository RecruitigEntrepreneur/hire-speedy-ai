import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildTool, parseFieldValue, quoteInSource, validateExtraction, FIELD_SPECS } from "./dossier-extraction.ts";

const source = `### Quelle 1: Notizen
Telefonat: will 45k, ginge auch mit 42. Kündigung 3 Monate zum Quartalsende.
[Kandidat:in] spricht Deutsch als Muttersprache, Englisch B2.
Hatte einen Burnout.`;

Deno.test("verwirft Werte ohne wörtliches Zitat", () => {
  const r = validateExtraction({
    fields: [
      { key: "expected_salary", value: "45000", quote: "will 45k", confidence: 3 },
      { key: "current_salary", value: "40000", quote: "verdient 40k", confidence: 3 },
    ],
  }, source);
  assertEquals(r.fields.map((f) => f.key), ["expected_salary"]);
  assertEquals(r.dropped, [{ key: "current_salary", reason: "quote" }]);
});

Deno.test("prüft Enum-Werte, Geld und Sprachen", () => {
  const r = validateExtraction({
    fields: [
      { key: "notice_period", value: "3_months_eoq", quote: "Kündigung 3 Monate zum Quartalsende", confidence: 3 },
      { key: "remote_preference", value: "irgendwas", quote: "Telefonat", confidence: 2 },
      { key: "salary_minimum", value: "42", quote: "ginge auch mit 42", confidence: 2 },
      { key: "languages", value: "Deutsch: Muttersprache | Englisch: B2", quote: "Deutsch als Muttersprache, Englisch B2", confidence: 3 },
    ],
    protected_mentions: ["Gesundheit", "Unsinn"],
  }, source);
  const byKey = Object.fromEntries(r.fields.map((f) => [f.key, f]));
  assertEquals(byKey.notice_period.value, "3_months_eoq");
  assertEquals(byKey.remote_preference, undefined);
  assertEquals(byKey.salary_minimum.value, 42000);
  assertEquals(byKey.salary_minimum.sensitive, true);
  assertEquals(byKey.languages.value, [{ language: "Deutsch", proficiency: "Muttersprache" }, { language: "Englisch", proficiency: "B2" }]);
  assertEquals(r.protectedMentions, ["Gesundheit"]);
});

Deno.test("übernimmt keine geschwärzten Platzhalter als Wert", () => {
  const spec = FIELD_SPECS.find((f) => f.key === "job_title")!;
  assertEquals(parseFieldValue(spec, "[Kandidat:in]"), null);
});

Deno.test("Zitatabgleich ignoriert Groß-/Kleinschreibung, Satzzeichen und Leerraum", () => {
  assertEquals(quoteInSource("Will 45K,  ginge auch", source), true);
  assertEquals(quoteInSource("ab", source), false);
});

Deno.test("Werkzeug kennt keine Bewertungsfelder", () => {
  const keys = (buildTool().parameters.properties.fields.items.properties.key as { enum: string[] }).enum;
  for (const forbidden of ["recommendation", "change_readiness", "would_recommend"]) {
    assertEquals(keys.includes(forbidden), false);
  }
});
