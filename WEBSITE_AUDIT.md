# Matchunt Website-Audit — Ehrliches Urteil & Verbesserungsplan

*Erstellt: 2026-06-10 · Methode: 3 Persona-Kaltlesetests (5-Sekunden-Test), 4 Spezialisten-Audits (Positioning, Copywriting, Conversion, UX/UI inkl. Live-Seite + Mobile), 3 Research-Tracks (Best-in-Class-Marktplätze, CRO State of the Art 2025/26, DACH-Wettbewerb), 11 Agenten, alle Code-Findings manuell verifiziert.*

---

## 1. Ehrliches Gesamturteil: 4/10

Die Seite ist handwerklich poliert (sauberes Designsystem, korrekte Dramaturgie, interaktives Dashboard-Mockup), aber strategisch austauschbar und an drei Stellen **aktiv selbstbeschädigend**:

1. **Erfundener Social Proof** (Fake-Logos „TechCorp", „InnovateCo"…, anonymes Testimonial, widersprüchliche Zahlen: 12.000+ Recruiter vs. 500+ Placements = 0,04 Placements/Recruiter) zerstört genau das Vertrauen, von dem ein Provisions-Marktplatz lebt — und ist nach §5 UWG abmahnfähig.
2. **Der Funnel ist technisch gebrochen**: Fast alle CTAs übergeben Query-Parameter, die `Auth.tsx` nicht liest — Neukunden landen auf einem **Login-Formular** statt der Registrierung.
3. **Der Kern-Differenzierer (Triple-Blind) ist unsichtbar**: Keine einzige Test-Persona hat ihn erwähnt. Die Headline „Perfect Match. Perfect Hire." sagt nichts, „submittieren" killt die DACH-Glaubwürdigkeit.

Das Research zeigt: Anonymisierung als Positionierung ist im DACH-Markt **unbesetzt**, und die Kategorie ist durch Paraform ($65M Series B) validiert. Die Chance ist real — sie wird nur verschenkt. Mit den Quick Wins (1 Woche) ist eine 6 erreichbar, mit der strategischen Neupositionierung eine 8+.

## 2. Versteht man, worum es geht? (5-Sekunden-Tests)

**Was ankommt:** Alle drei Personas (Head of TA Scale-up, Freelance-Recruiter, skeptischer Mittelstands-GF) verstanden das Grundmodell — zweiseitiger Marktplatz, erfolgsbasiert. Aber ausschließlich über die kleine **Subline**, nicht die Headline (Klarheit 5–6/10).

**Was NICHT ankommt:**
- **Triple-Blind**: von niemandem erwähnt — existiert im Erstkontakt nicht
- **Was die KI tut**: „KI-gestützt" wurde als Buzzword abgetan („so aussagekräftig wie ‚jetzt mit Internet'")
- **Was es kostet**: Alle drei würden zuerst „Pricing" klicken und erwarten dort eine Zahl — steht da keine, sind sie weg
- **Wer dahintersteht**: Vertrauen einheitlich 3/10 (Fake-Proof, fehlende DSGVO-Signale, „submittieren": „Wer so schreibt, dem traue ich keine sauberen Kandidatenprofile zu")
- **Für wen die Seite ist**: Der DE/EN-Mix ließ alle zweifeln, ob DACH überhaupt bedient wird
- Der Recruiter fürchtet **Disintermediation/Kandidaten-Klau** — exakt die Angst, die Triple-Blind beantworten würde, wenn es sichtbar wäre

## 3. Top-Probleme (priorisiert)

### P0 — schadet aktiv Vertrauen/Verständnis

| # | Problem | Aufwand |
|---|---------|---------|
| 1 | **Erfundener Social Proof**: 10 Fake-Logos, anonymes Testimonial, widersprüchliche Zahlen (§5 UWG!) | Stunden |
| 2 | **Funnel gebrochen**: Hero sendet `?type=`, Sektionen `?tab=register` — `Auth.tsx` liest nur `mode`+`role`. ~23 von 25 CTAs landen auf Login statt Signup | Stunden |
| 3 | **Datenschutz & AGB verlinken auf /auth** (`FooterSection.tsx:72-73`) — Art. 13 DSGVO verlangt öffentliche Datenschutzerklärung, abmahnfähig. ~10 weitere Footer-Links zeigen auf /auth statt existierender Routen | Tage |
| 4 | **Unhaltbare Compliance-Claims**: „DSGVO + SOC2", „End-to-End Encryption" (`TrustSecuritySection.tsx:6-7`) — SOC2 ohne Audit ist falsche Tatsachenbehauptung; echte E2E ist bei KI-Matching technisch nicht gegeben | Stunden |
| 5 | **Hero sagt nichts**: „Perfect Match. Perfect Hire." austauschbar; „submittieren" als Glaubwürdigkeits-Killer; Shine-Animation macht „Perfect Hire." phasenweise unleserlich | Tage |
| 6 | **Fünf tote CTA-Buttons** ohne onClick/Link: „AI in Aktion sehen", „Integrationen ansehen", „Analytics entdecken", „Mehr Erfolge ansehen", „Mehr über Sicherheit" | Stunden |

### P1 — kostet messbar Conversion

| # | Problem | Aufwand |
|---|---------|---------|
| 7 | **Triple-Blind vergraben**: taucht erst in Sektion 4 als Listenpunkt 3/5 auf, ohne Erklärung; der stärkste Recruiter-Benefit (Umgehungsschutz) wird verschwiegen | Tage |
| 8 | **Pricing claimt Transparenz, versteckt jede Zahl**: „Transparente Gebühren" ohne eine einzige Zahl; FAQ sagt, Provision werde erst „vor Beginn des Prozesses" kommuniziert. Instaffo (12–15%) und Workwise (14–22% + Geld-zurück-Staffel) zeigen öffentlich Preise | Tage |
| 9 | **Sprach-/Anrede-Chaos**: EN-Headlines, DE-Body, Sie/Du gemischt | Tage |
| 10 | **Recruiter-Seite (Supply) als Nachgedanke**: eine Sektion mit fiktiver Persona („Jana Doering, 47 Placements/Jahr"), CTA auf Login, FAQ ignoriert Recruiter | Wochen |
| 11 | **Kein sanfter Conversion-Pfad**: nichts zwischen „anonym" und „registriert" — kein Demo-Buchen, kein Lead-Magnet, keine Produkt-Tour | Wochen |

### P2 — Politur

| # | Problem | Aufwand |
|---|---------|---------|
| 12 | **Seite doppelt so lang wie nötig**: 15 Sektionen (~24.000px mobil), „3,8 Tage" 3×, Escrow 4×, DSGVO 3×; Pricing/FAQ erst bei 75–90% Scrolltiefe; Count-up-Counter rendern ohne Trigger dauerhaft „0,0" (auch für Crawler) | Tage |

## 4. Research-Highlights

- **Paraform** ($65M Series B) ist die Blaupause: Outcome-Hero („Hire on easy mode"), getrennte Seiten für Companies/Recruiters, radikal transparente Recruiter-Earnings (80% Fee-Split, Verdienst-Kalkulator). Die Recruiter-Seite wird wie ein eigenes Produkt behandelt. *(paraform.com)*
- **Anonymisierung ist im DACH nur Feature, nie Positionierung**: ONE HIRING (Privacy-Mechanik), anonyfy (Nischen-Tool), juucy/Vermio (gar nicht). **Triple-Blind als Kategorie-Claim ist unbesetzt — Matchunts größter Hebel.**
- **Preistransparenz ist DACH-Benchmark**: Instaffo 12–15%, Workwise 14–22% inkl. gestaffelter Geld-zurück-Garantie (M1: 100%, M2: 66%, M3: 33%). Wer den Preis versteckt, wirkt wie die 27,8%-Personalberatung (BDU-Schnitt), gegen die alle positionieren.
- **Warnsignal generisches Positioning**: Hired.com (2024 in LHH aufgelöst), A.Team (wegpivotiert), Talentlotsen/MoBerries (Crowd-Modell verlassen). Überlebende haben einen harten Claim (Toptal „Top 3%"), ein überlegenes Anreizmodell (Paraform 80%-Split) oder eine SEO-Maschine (Wellfound).
- **Toptal-Vorlage**: EIN quantifizierter, mechanisch belegter Claim mit eigener Beweisseite trägt eine ganze Marke → Vorlage für „So funktioniert Triple-Blind: wer sieht was wann".
- **Ungated interaktive Produkt-Demos**: 89% Interaktionsrate, 3× Demo-zu-Opportunity (Navattic 2025). Matchunts existierendes Job-Parsing ist der perfekte Aha-Moment.
- **DSGVO/EU-Hosting/AVV als aktiver Conversion-Hebel** im deutschen B2B: 15–20% höhere Abschlussraten bei datensensiblen Kunden.
- **Early-Stage-Proof über Spezifität statt Bekanntheit**: Eine kleine echte Zahl schlägt eine große erfundene; Founder's Note + Beta-Zitat mit messbarem Ergebnis schlagen Logo-Wände.

## 5. Hero-Vorschläge (3 Varianten)

**A — Mechanismus-Kategorie (Triple-Blind-first):**
> **Der erste Triple-Blind-Recruiting-Marktplatz.**
> Geprüfte Recruiter schlagen anonymisierte, KI-vorqualifizierte Kandidaten auf Ihre Stelle vor. Fairer für Kandidaten. Sicherer für Recruiter. Bezahlt wird erst bei Einstellung.
> [Job kostenlos ausschreiben] [So funktioniert Triple-Blind]

*Besetzt den nachgewiesenen DACH-Whitespace (Toptal-Logik: eigener Mechanismus-Begriff + Beweisseite). Voraussetzung: Triple-Blind-Enforcement muss deployed sein.*

**B — Outcome + Risikoumkehr (Paraform-Logik):**
> **Qualifizierte Kandidaten in Tagen. Bezahlt wird erst bei Einstellung.**
> Matchunt bringt Ihre Stelle zu spezialisierten Recruitern im DACH-Raum. Unsere KI prüft jeden Vorschlag auf Passung — anonymisiert und DSGVO-konform. Keine Retainer, keine Fixkosten.
> [Job in 60 Sekunden posten] [Tour ansehen]

**C — Netzwerk + Preisangriff (gegen die 30%-Personalberatung):**
> **Viele Recruiter. Eine Provision. Erst bei Einstellung.**
> Statt einem Headhunter arbeiten geprüfte Spezial-Recruiter im Wettbewerb an Ihrer Stelle. Sie bewerten anonymisierte Kandidaten nach Fit — zu einer Provision deutlich unter den 25–35% klassischer Personalberater.
> [Job kostenlos ausschreiben] [Preise ansehen]

## 6. Der Plan

### Phase 1 — Quick Wins (diese Woche, je Stunden)

1. **Fake-Logos, anonymes Testimonial, unbelegbare Zahlen (12.000+, 500+, 42%) löschen** — jede Stunde online ist Abmahnrisiko. Ersatz: ehrlicher Early-Stage-Claim + Founder's Note.
2. **Query-Param-Fix**: alle CTAs auf `/auth?mode=signup&role=...`, `Auth.tsx` akzeptiert `tab=register`/`type` als Aliase.
3. **/datenschutz + /agb anlegen** (analog /impressum), Footer-Links auf echte Routen korrigieren, Platzhalter raus.
4. **Compliance-Claims auf Belegbares reduzieren**: „DSGVO-konform: EU-Hosting, AVV inklusive, TLS 1.3 + AES-256 at rest. SOC 2 in Vorbereitung."
5. **„submittieren" → „Recruiter schlagen Kandidaten vor"** (15 Minuten, von allen 3 Personas als Killer genannt).
6. **Fünf tote Buttons verdrahten oder entfernen.**
7. **Navbar eindeutschen** („Anmelden", „Kostenlos starten"), seitenweit EIN CTA-Paar in EINER Größe.
8. **Counter mit Endwert initialisieren** (Animation nur als Progressive Enhancement), `prefers-reduced-motion` respektieren.
9. **Hero-Shine-Animation entschärfen** (Gradient-Minimum anheben, mobil statisch).

### Phase 2 — Strategische Moves (2–6 Wochen)

1. **Triple-Blind zur Kategorie machen**: Signature-Sektion direkt nach dem Problem (Drei-Parteien-Diagramm: wer sieht was wann), Begriff in Hero-Badge + Subline, später Beweisseite nach Toptal-Vorbild. *Erst claimen, wenn das Enforcement (Branch `fix/auth-privilege-escalation`) deployed ist.*
2. **Getrennte Landingpages /unternehmen und /recruiter** (Paraform-Muster); Homepage primär auf die zahlende Demand-Seite. Demo-led für Unternehmen, Self-Serve für Recruiter.
3. **Radikale Preistransparenz als Angriffswaffe**: öffentliche Provisions-Range gegen den 25–35%-Anker, Rechenbeispiel (80.000 € Gehalt), gestaffelte Probezeit-Garantie (Workwise-Muster), **Recruiter-Split offenlegen** (zeigt im DACH niemand).
4. **Ungated Job-Parsing-Demo** auf der Landingpage (Jobbeschreibung rein → KI-Analyse live) — Feature existiert bereits im Produkt, löst den toten „AI in Aktion sehen"-Button.
5. **Ehrliches Proof-System**: Design-Partner-Programm (3–5 Pilotkunden mit Logo-Freigabe gegen Rabatt), echte Live-Zahlen aus der DB („14 aktive Mandate diese Woche"), Diskretion offensiv als Proof framen.
6. **DSGVO auf die Startseite**: Trust-Block „Datenschutz ist unser Produkt" (EU-Hosting, AVV automatisch, Anonymität technisch erzwungen statt nur Policy).
7. **Seite von 15 auf 8–9 Sektionen kürzen**, EINE Kategorie konsequent: „Der erfolgsbasierte Triple-Blind-Recruiting-Marktplatz für DACH" (statt Wirrwarr aus Marktplatz / „Operating System" / SaaS / Agentur-Ersatz).

### Sprachregel (ab sofort)

Deutsch als Leitsprache, Englisch nur für etablierte Fachbegriffe (Triple-Blind, Escrow, ATS). Unternehmens-Funnel konsequent **Sie**, Recruiter-Funnel darf **Du** — nie gemischt.

---

*Vollständige Agenten-Rohdaten: `/private/tmp/claude-501/-Users-markobenkomac-Projekte-hire-speedy-ai/35bd8654-8f99-4aec-9185-6fefa2b26310/tasks/wspuidbd8.output`*
