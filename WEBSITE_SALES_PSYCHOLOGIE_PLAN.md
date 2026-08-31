# Website Sales-Psychologie — Analyse & Umsetzungsplan

Stand: 2026-08-31 · Objekt: `src/pages/Index.tsx` (15 Sektionen), `src/pages/Auth.tsx`, `src/pages/onboarding/ClientOnboarding.tsx`
Vollversion mit Begründungen: Artifact "matchunt Conversion-Audit"

## Kernbefund

Die Seite verkauft die Plattform. Der Kunde will die Stelle loswerden.
5 von 15 Sektionen erklären Technologie. Keine beziffert, was die offene Stelle kostet.
Die Sektion "Pricing" enthält keinen Preis. Und hinter jedem CTA steht eine Vertragsunterschrift.

Zielgruppe (Festlegung): GF/Inhaber und HR-Leitung im Mittelstand, 20–250 MA.
Nicht Enterprise — Procurement und Referenzpflicht sind vor dem Launch nicht gewinnbar.

## Priorisierte Maßnahmen

| # | Maßnahme | Typ | Dateien |
|---|---|---|---|
| 1 | Job zuerst, Vertrag später — Intake ohne Konto | Flow | Index, Auth, ClientOnboarding, Routing |
| 2 | Preis nennen + Nachbesetzungsgarantie | Copy + AGB | de.ts, PricingSection, AGB.tsx |
| 3 | Hero auf Handlung + Risikoumkehr | Copy | de.ts, HeroSection |
| 4 | Vakanzkosten-Rechner statt "Hiring is Broken" | Feature | ProblemSection (neu) |
| 5 | Beweis ersetzen: Gründer, GmbH, prüfbare Fakten | Copy | de.ts, SocialProofSection |
| 6 | 15 → 9 Sektionen, neue Reihenfolge | Struktur | Index.tsx, neue Routes |
| 7 | Durchgängig Deutsch + Umlaut-Fix | Copy | de.ts (`waere`, `Praezision`) |
| 8 | Telefonnummer / Rückruf sichtbar | Struktur | Navbar, FinalCTA |
| 9 | FAQ härten (8 statt 6 Fragen) | Copy | de.ts, FAQSection |

## 1 — Der Commitment-Bruch (größter Hebel)

Ist-Zustand: Button verspricht "Job kostenlos ausschreiben" / "Job in 60 Sekunden posten" /
"Jetzt risikofrei starten" / "Keine Kreditkarte erforderlich".

Tatsächlicher Pfad nach dem Klick:
1. Konto anlegen (Name, E-Mail, Passwort, Rolle)
2. AGB akzeptieren
3. **Vertrag unterzeichnen**  ← Rechtsverbindlichkeit vor jedem Nutzen
4. **Handelsregisternummer + USt-ID**  ← kennt niemand auswendig, Session-Killer
5. erst dann: Stelle beschreiben

Prinzip: Commitment eskaliert, es startet nicht. Der Nutzer hat gerade Ja gesagt
und wird für sein Ja sofort bestraft.

Soll-Zustand:
1. CTA öffnet direkt den Intake, ohne Login. Feld 1: Link / PDF / ein Satz.
2. KI parst live und zeigt, was sie verstanden hat → Aha-Moment + Endowment-Effekt.
3. Erst zum Speichern: E-Mail. Ein Feld.
4. AGB + Vertrag + HRB/USt-ID erst beim ersten Kandidaten-Opt-In.
   Juristisch tragbar, weil bis dahin nichts geschuldet ist (erfolgsbasiert).

Hinweis: Das geplante Kunden-Einladungs-Feature läuft in dieselbe Falle,
wenn es auf demselben Onboarding landet.

## 2 — Preis

`pricing.*` enthält vier Verneinungen und keine Zahl. FAQ sagt "transparent kommuniziert".
Der Leser kennt 25–33 % aus der Branche. Ohne Zahl unterstellt er den oberen Rand.
Wenn ihr bei 18–25 % liegt, ist eure Zahl das beste Verkaufsargument — und ihr versteckt es.

Neu: Zahl + Marktvergleich + Rechenbeispiel + Nachbesetzungsgarantie.
Die Garantie fehlt komplett und ist der wichtigste Einwandkiller der Branche
("ich zahle 14k und der ist nach drei Monaten weg").

## Neue Seitenarchitektur (Index.tsx)

1. Hero — Handlung + Risikoumkehr (neu)
2. HowItWorks — vorgezogen
3. Vakanzkosten-Rechner — ersetzt ProblemSection
4. ForCompanies — vorgezogen
5. Pricing mit Zahl + Garantie
6. TripleBlind gekürzt → "Ihre Suche wird nicht öffentlich"
7. Wer dahintersteht — ersetzt SocialProof
8. FAQ (8 Fragen)
9. FinalCTA

Auf Unterseiten: EngineSection, FeaturesSection, AnalyticsSection → `/plattform`;
ForRecruitersSection → `/fuer-personalberater`. Code bleibt, nur Route ändert sich.

## Querschnittsbefunde

- **Sprachbruch:** 8 von 15 Sektionsüberschriften englisch, Fließtext deutsch.
  Beim Mittelständler erzeugt das Distanz, nicht Modernität. "Escrow" → "Treuhandkonto".
- **Keine Verlustaversion:** Seite argumentiert nur mit Gewinn. Nirgends steht,
  was die Vakanz kostet. Vakanzkostenrechner ist die Antwort.
- **Ehrliche Verknappung ungenutzt:** "Maximal fünf Berater pro Stelle" ist ein echter
  Qualitätsmechanismus und wirkt gleichzeitig als Knappheit.
- **Nur ein Weg:** Kein Telefon, kein Kalenderlink, kein Rückruf außer `/kontakt` im Footer.
  Im Mittelstand ist die Rufnummer im Header ein Conversion-Element.
- **Kein Gesicht:** "bluewater & Bridge GmbH" steht nur im Footer-Copyright (kleines b, korrigieren).

## Nicht bauen

Erfundene Logos, "143 Unternehmen vertrauen uns", Countdowns, künstliche Restplätze,
gefälschte Bewertungen, simulierter Chat. UWG-abmahnbar und markenschädlich in einem Markt,
in dem sich Personalentscheider kennen. Jeder Hebel oben funktioniert ohne unwahre Aussage.

## Vor dem Launch klären

- Prozentsatz in der Preis-Sektion muss zur Kalkulation UND zur AGB passen (ist ein Angebot).
- Nachbesetzungsgarantie muss in der AGB stehen, bevor sie auf der Startseite steht.
- Vakanzkosten-Spanne (300–800 €/Tag) braucht zitierfähige Quelle oder offengelegte Rechenlogik.

## Fertige Copy

Die vollständigen, paste-ready `de.ts`-Blöcke (hero, problem, socialProof, pricing,
tripleBlind, howItWorks, faq, finalCta, trustSecurity, footer) stehen im Artifact
"matchunt Conversion-Audit" mit Kopieren-Buttons pro Block.
