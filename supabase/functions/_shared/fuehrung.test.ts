import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { fuehrungKiText } from "./fuehrung.ts";

Deno.test("Führung für die KI: beide Arten mit eigener Zahl", () => {
  assertEquals(
    fuehrungKiText({ leadership_scope: "disciplinary", leadership_team_size: 4, leadership_also_functional: true, leadership_functional_size: 12 }, "Mitarbeitende"),
    "disziplinarisch, 4 Mitarbeitende; fachlich zusätzlich 12 Personen",
  );
});

Deno.test("Führung für die KI: alte Einträge wie bisher", () => {
  assertEquals(fuehrungKiText({ leadership_scope: "disciplinary", leadership_team_size: 16 }), "disziplinarisch, 16 Personen");
  assertEquals(fuehrungKiText({ leadership_scope: "functional", leadership_team_size: 12 }), "fachlich, 12 Personen");
  assertEquals(fuehrungKiText({ leadership_scope: "none" }), null);
  assertEquals(fuehrungKiText(null), null);
});
