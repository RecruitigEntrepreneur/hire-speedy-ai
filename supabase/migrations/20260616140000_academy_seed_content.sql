-- ============================================================================
-- Matchunt Akademie — Voll ausgearbeitete Kursinhalte (Seed)
-- ----------------------------------------------------------------------------
-- Ersetzt den Demo-Seed der Foundation-Migration durch das echte Curriculum
-- aus der Wettbewerbsanalyse: Stufe 1 (Recruiter-Grundlagen, FREE) +
-- Stufe 2 (Zertifizierter Matchunt-Recruiter, PREMIUM).
-- Idempotent: löscht die betroffenen Kurse (CASCADE) und legt sie neu an.
-- ============================================================================

BEGIN;

DELETE FROM public.academy_courses WHERE id IN (
  'a0000000-0000-4000-8000-000000000001', -- Demo-Seed der Foundation-Migration
  'a0000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001', -- dieser Seed (re-runnable)
  'a2000000-0000-4000-8000-000000000002'
);

-- ============================================================================
-- KURS 1 — Recruiter-Grundlagen (Stufe 1, FREE)
-- ============================================================================
INSERT INTO public.academy_courses (id, slug, title, description, level, is_premium, published, sort_order) VALUES
('a1000000-0000-4000-8000-000000000001', 'recruiter-grundlagen', 'Recruiter-Grundlagen',
 'Der kostenlose Einstieg in die moderne Personalvermittlung: Geschäftsmodell, Triple-Blind & DSGVO, Anforderungsprofil, Active Sourcing und die Erstansprache, die beantwortet wird. Nach diesem Kurs verstehst du den gesamten Recruiting-Funnel und kannst deine erste Kandidatenansprache schreiben.',
 'beginner', false, true, 1);

INSERT INTO public.academy_modules (id, course_id, title, sort_order) VALUES
('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Branche & Geschäftsmodell Personalvermittlung', 1),
('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'Triple-Blind & DSGVO-konformes Recruiting', 2),
('b1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'Anforderungsprofil & Intake', 3),
('b1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'Active Sourcing Basics', 4),
('b1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'Erstansprache & Candidate Experience', 5);

INSERT INTO public.academy_lessons (module_id, title, content_type, body, duration_min, is_premium, sort_order) VALUES
-- M1
('b1000000-0000-4000-8000-000000000001', 'Was Headhunter wirklich verdienen', 'text',
 E'Personalvermittlung wird über ein Honorar bezahlt, das ein Unternehmen für eine erfolgreiche Besetzung zahlt. Üblich sind 20 bis 33 Prozent des Bruttojahresgehalts der vermittelten Person. Bei einer Position mit 80.000 Euro Jahresgehalt entspricht das einem Honorar von etwa 16.000 bis 26.000 Euro pro Besetzung.\n\nEntscheidend ist nicht das einzelne hohe Honorar, sondern die Verlässlichkeit über das Jahr. Erfolgreiche Recruiter denken in Pipeline und Abschlussquote, nicht in Einzeldeals. Wer drei bis fünf Besetzungen pro Monat schafft, bewegt sich schnell in einem sechsstelligen Jahresumsatz.\n\nAuf Matchunt verdienst du als angedockter Recruiter an realen Platzierungen mit. Die Akademie bildet dich dafür aus, und der Abschluss ist die Eintrittskarte zu echten Mandaten.',
 8, false, 1),
('b1000000-0000-4000-8000-000000000001', 'Contingency vs. Retained — die zwei Modelle', 'text',
 E'Im Contingency-Modell zahlt der Kunde nur bei Erfolg, also bei tatsächlicher Einstellung. Das Risiko liegt beim Recruiter, dafür ist der Einstieg für Kunden niederschwellig. Dieses Modell dominiert das Volumengeschäft und ist der Normalfall auf modernen Marktplätzen.\n\nIm Retained-Modell zahlt der Kunde vorab einen Teil des Honorars und beauftragt exklusiv. Das ist typisch für Executive Search und schwer zu besetzende Spezialrollen. Der Recruiter arbeitet planbarer, muss aber echte Suchtiefe und Marktkenntnis liefern.\n\nMatchunt arbeitet erfolgsbasiert: Du wirst bezahlt, wenn du platzierst. Das richtet deine Anreize sauber auf das aus, was zählt — eine erfolgreiche, dauerhafte Besetzung.',
 9, false, 2),
('b1000000-0000-4000-8000-000000000001', 'Die Provisionsrealität — warum viele scheitern', 'text',
 E'Zwischen 43 und 50 Prozent der Branche verlassen den Beruf wieder, meist im ersten Jahr. Der häufigste Grund ist nicht fehlendes Talent, sondern eine falsche Erwartung: Das Geld kommt verzögert und unregelmäßig, während die Arbeit sofort anfällt.\n\nEine Besetzung durchläuft Sourcing, Ansprache, Qualifizierung, Interviews und Vertragsphase. Vom ersten Kontakt bis zur Unterschrift vergehen oft sechs bis zwölf Wochen. Wer das nicht einplant und keine volle Pipeline hält, gerät in einen Cashflow- und Motivationsknick.\n\nDie Lösung ist Systematik: konstant sourcen, viele Gespräche führen, Ablehnung als Normalfall behandeln. Genau diese Resilienz und Pipeline-Disziplin trainieren wir in den weiterführenden Modulen.',
 10, false, 3),
-- M2
('b1000000-0000-4000-8000-000000000002', 'Was Triple-Blind bedeutet', 'text',
 E'Triple-Blind ist das Anonymisierungsprinzip von Matchunt. In der ersten Stufe sind Kandidat und Unternehmen füreinander vollständig anonym: Recruiter sehen anonymisierte Firmenprofile, Unternehmen sehen anonymisierte Kandidatenprofile.\n\nDie Identität wird stufenweise freigegeben — erst der Firmenname nach dem Opt-In des Kandidaten, dann der Vollzugriff nach bestätigtem Interview. Das schützt beide Seiten vor verfrühter Offenlegung und reduziert Bias im Auswahlprozess.\n\nFür dich als Recruiter heißt das: Du verkaufst die Substanz — Skills, Erfahrung, Passung — bevor Namen ins Spiel kommen. Das ist ein Qualitätsfilter und ein Vertrauensanker zugleich.',
 7, false, 1),
('b1000000-0000-4000-8000-000000000002', 'DSGVO & AGG im Recruiting-Alltag', 'text',
 E'Du verarbeitest personenbezogene Daten und brauchst dafür eine Rechtsgrundlage — in der Regel die Einwilligung des Kandidaten oder ein berechtigtes Interesse mit sauberer Dokumentation. Speichere nur, was du brauchst, und lösche, was du nicht mehr brauchst.\n\nDas Allgemeine Gleichbehandlungsgesetz verbietet Benachteiligung wegen Alter, Geschlecht, Herkunft, Religion, Behinderung oder sexueller Identität. Anforderungsprofile und Ansprachen müssen sich strikt auf fachliche Eignung beziehen.\n\nTriple-Blind hilft dir hier doppelt: Anonymisierung reduziert unbewussten Bias und sorgt dafür, dass die Eignung im Vordergrund steht. Im Zertifizierungskurs vertiefen wir die konkreten Fallstricke beim Sourcing.',
 9, false, 2),
-- M3
('b1000000-0000-4000-8000-000000000003', 'Das perfekte Intake-Gespräch', 'text',
 E'Das Intake-Gespräch mit dem Auftraggeber entscheidet über den Erfolg der gesamten Suche. Ziel ist nicht eine Stellenanzeige, sondern ein präzises Verständnis: Welches Problem löst diese Rolle, und woran wird Erfolg in sechs Monaten gemessen?\n\nFrage nach den must-haves und den nice-to-haves und lass sie klar trennen. Frage nach Beispielprofilen, die der Kunde gut findet, und nach No-Gos. Kläre Gehalt, Prozessgeschwindigkeit und Entscheidungswege, bevor du suchst.\n\nEin gutes Intake spart dir später Dutzende Stunden Fehlsuche. Recruiter, die hier schludern, präsentieren am Bedarf vorbei und verbrennen Vertrauen beim Kunden.',
 10, false, 1),
('b1000000-0000-4000-8000-000000000003', 'Vom Briefing zum Anforderungsprofil', 'text',
 E'Aus dem Intake formst du ein verwertbares Anforderungsprofil. Übersetze schwammige Wünsche in beobachtbare Kriterien: Statt "Teamplayer" definierst du, in welchen Konstellationen die Person nachweislich erfolgreich war.\n\nGewichte die Kriterien. Drei bis fünf echte must-haves reichen — alles andere ist Bonus. Ein überladenes Profil mit fünfzehn Pflichtkriterien beschreibt eine Person, die es nicht gibt, und blockiert jede realistische Suche.\n\nDas fertige Profil ist deine Suchlandkarte und gleichzeitig dein Maßstab bei der Bewertung. In Matchunt fließt es direkt in das Matching und die spätere Begründung deiner Empfehlung ein.',
 9, false, 2),
-- M4
('b1000000-0000-4000-8000-000000000004', 'Wo passive Kandidaten leben', 'text',
 E'Die besten Kandidaten suchen nicht aktiv — sie sind in ihrem Job zufrieden genug, um nicht zu wechseln, aber offen für das richtige Angebot. Diese passiven Talente erreichst du nicht über Anzeigen, sondern über gezielte Direktansprache.\n\nDeine Hauptkanäle sind berufliche Netzwerke wie LinkedIn und XING, dazu fachspezifische Quellen: GitHub und Stack Overflow für Entwickler, Branchenverzeichnisse, Fachcommunities, Konferenz-Speakerlisten und Veröffentlichungen.\n\nDer Schlüssel ist, dort zu suchen, wo deine Zielgruppe ihre fachliche Identität zeigt. Wer nur eine Plattform nutzt, sieht nur einen Ausschnitt des Marktes.',
 8, false, 1),
('b1000000-0000-4000-8000-000000000004', 'Boolean Search Grundlagen', 'text',
 E'Boolean Search kombiniert Suchbegriffe mit den Operatoren AND, OR und NOT, um Trefferlisten gezielt einzugrenzen oder zu erweitern. AND verknüpft Pflichtbegriffe, OR fängt Synonyme ein, NOT schließt Störbegriffe aus.\n\nEin Beispiel: ("Java" OR "Kotlin") AND "Microservices" NOT "Praktikant" findet erfahrene JVM-Entwickler mit Microservices-Erfahrung und filtert Praktika heraus. Klammern steuern die Reihenfolge, Anführungszeichen halten Wortgruppen zusammen.\n\nDenke in Synonymen und Jobtitel-Varianten: Dieselbe Rolle heißt je nach Firma anders. Gute Strings entstehen iterativ — du verfeinerst sie anhand der Treffer. Im Profikurs automatisieren wir genau diesen Schritt mit KI.',
 11, false, 2),
-- M5
('b1000000-0000-4000-8000-000000000005', 'Die Ansprache, die beantwortet wird', 'text',
 E'Eine gute Erstansprache ist kurz, persönlich und konkret. Sie zeigt in den ersten zwei Sätzen, dass du das Profil wirklich gelesen hast, und nennt einen spezifischen Grund, warum genau diese Person passt.\n\nVermeide generische Massenbotschaften — sie werden ignoriert. Beziehe dich auf ein konkretes Projekt, einen Tech-Stack oder eine Station im Lebenslauf. Formuliere einen klaren, niedrigschwelligen nächsten Schritt: ein kurzes Gespräch, nicht sofort eine Bewerbung.\n\nMiss deine Antwortrate. Liegt sie unter dem Branchenschnitt, liegt es fast immer an zu wenig Personalisierung oder einem unklaren Mehrwert. Teste Betreffzeilen und Einstiege systematisch.',
 9, false, 1),
('b1000000-0000-4000-8000-000000000005', 'Candidate Experience als Wettbewerbsvorteil', 'text',
 E'Kandidaten erinnern sich an das Wie, nicht nur an das Ob. Schnelle Reaktionszeiten, ehrliche Erwartungen und respektvolle Absagen entscheiden darüber, ob jemand dich weiterempfiehlt oder warnt.\n\nHalte Kandidaten proaktiv auf dem Laufenden, auch wenn es gerade nichts Neues gibt. Gib konkretes, wertschätzendes Feedback. Eine gute Absage kann einen künftigen Kandidaten oder sogar einen künftigen Auftraggeber schaffen.\n\nGerade im anonymisierten Triple-Blind-Prozess ist deine Verlässlichkeit das, was Vertrauen aufbaut. Eine starke Candidate Experience ist kein Soft Skill, sondern dein wichtigster Reputationshebel.',
 8, false, 2);

-- ============================================================================
-- KURS 2 — Zertifizierter Matchunt-Recruiter (Stufe 2, PREMIUM)
-- ============================================================================
INSERT INTO public.academy_courses (id, slug, title, description, level, is_premium, published, sort_order) VALUES
('a2000000-0000-4000-8000-000000000002', 'zertifizierter-matchunt-recruiter', 'Zertifizierter Matchunt-Recruiter (CMR)',
 'Die Vollausbildung zum eigenständigen Headhunter: Active Sourcing auf Profi-Niveau, KI-gestütztes Recruiting mit konkreten Prompts, 360-Grad-Agentur-Skills von Business Development bis Honorar-Verhandlung, Plattform-Mastery und ein praktisches Capstone an einem echten anonymisierten Mandat. Der Abschluss ist die Voraussetzung, um dich als bezahlter Matchunt-Recruiter zu bewerben.',
 'advanced', true, true, 2);

INSERT INTO public.academy_modules (id, course_id, title, sort_order) VALUES
('b2000000-0000-4000-8000-000000000006', 'a2000000-0000-4000-8000-000000000002', 'Active Sourcing Deep Dive', 1),
('b2000000-0000-4000-8000-000000000007', 'a2000000-0000-4000-8000-000000000002', 'KI-gestütztes Recruiting', 2),
('b2000000-0000-4000-8000-000000000008', 'a2000000-0000-4000-8000-000000000002', 'Interview & Assessment', 3),
('b2000000-0000-4000-8000-000000000009', 'a2000000-0000-4000-8000-000000000002', '360-Recruiting & Agentur-BD', 4),
('b2000000-0000-4000-8000-00000000000a', 'a2000000-0000-4000-8000-000000000002', 'Candidate- & Client-Management bis zum Placement', 5),
('b2000000-0000-4000-8000-00000000000b', 'a2000000-0000-4000-8000-000000000002', 'Matchunt-Plattform-Mastery', 6),
('b2000000-0000-4000-8000-00000000000c', 'a2000000-0000-4000-8000-000000000002', 'Capstone — echtes Mandat', 7);

INSERT INTO public.academy_lessons (module_id, title, content_type, body, duration_min, is_premium, sort_order) VALUES
-- M6 (erste Lektion als kostenlose Vorschau)
('b2000000-0000-4000-8000-000000000006', 'Mehrkanaliges Sourcing & X-Ray Search (Vorschau)', 'text',
 E'X-Ray Search nutzt eine externe Suchmaschine, um gezielt in einem Netzwerk zu suchen, ohne dessen Limitierungen. Mit site:linkedin.com/in kombiniert mit Skill- und Ortsbegriffen findest du Profile, die in der internen Suche verborgen bleiben.\n\nProfis bleiben nie auf einem Kanal. Sie kombinieren Netzwerke, Fachplattformen, GitHub-Mitwirkende, Konferenz-Speaker und Branchenverzeichnisse zu einer Multi-Source-Suche. Jeder Kanal zeigt einen anderen Ausschnitt desselben Talentmarkts.\n\nDiese Lektion ist deine kostenlose Vorschau auf den Zertifizierungskurs. Die folgenden Module sind Teil der Premium-Ausbildung und führen dich bis zum CMR-Zertifikat.',
 10, false, 1),
('b2000000-0000-4000-8000-000000000006', 'Den Sourcing-zu-Hire-Funnel messen', 'text',
 E'Was du nicht misst, kannst du nicht verbessern. Erfasse pro Suche, wie viele Profile du gesichtet, angesprochen, beantwortet bekommen und in Interviews gebracht hast. Aus diesen Zahlen ergibt sich deine Conversion entlang des Funnels.\n\nTypische Engpässe verraten sich sofort: Eine niedrige Antwortrate deutet auf schwache Ansprachen hin, ein Abbruch nach dem Erstgespräch auf falsche Erwartungen oder schlechte Passung. So weißt du, an welcher Stelle du nachjustieren musst.\n\nDiese Kennzahlen sind auch dein Verkaufsargument gegenüber Kunden: Du argumentierst mit Daten statt mit Bauchgefühl und wirkst dadurch sofort professioneller.',
 9, true, 2),
-- M7
('b2000000-0000-4000-8000-000000000007', 'KI für Sourcing-Strings & Boolean', 'text',
 E'Künstliche Intelligenz beschleunigt die mühsamsten Teile des Sourcings. Statt Boolean-Strings manuell zu basteln, lässt du sie generieren und verfeinern — inklusive Synonymen, Jobtitel-Varianten und ausgeschlossenen Störbegriffen.\n\nEin nutzbarer Prompt lautet sinngemäß: "Erstelle einen Boolean-Suchstring für LinkedIn für eine Senior-Frontend-Entwicklerin mit React und TypeScript im Raum München. Berücksichtige Synonyme und alternative Jobtitel und schließe Praktika und Junior-Rollen aus."\n\nKI liefert dir einen Startpunkt, kein Endergebnis. Du prüfst die Treffer und iterierst. Die Zeitersparnis ist erheblich, die Verantwortung für Qualität bleibt bei dir.',
 11, true, 1),
('b2000000-0000-4000-8000-000000000007', 'Outreach-Personalisierung mit KI — mit Prompts', 'text',
 E'KI hilft dir, Ansprachen in großem Maßstab persönlich zu halten. Du gibst ihr die Eckdaten eines Profils und lässt einen ersten Entwurf erstellen, den du dann mit einem echten, spezifischen Detail veredelst.\n\nEin bewährter Prompt: "Schreibe eine kurze, persönliche LinkedIn-Erstansprache an einen DevOps-Engineer mit Kubernetes-Erfahrung. Maximal 80 Wörter, kein Verkaufston, ein konkreter Aufhänger und ein niedrigschwelliger nächster Schritt."\n\nWichtig: Die KI ersetzt nicht deine Recherche. Der eine echte, individuelle Satz, den nur ein Mensch findet, entscheidet über die Antwortrate. KI liefert das Gerüst, du lieferst die Relevanz.',
 12, true, 2),
('b2000000-0000-4000-8000-000000000007', 'Grenzen, Bias & DSGVO-Fallen der KI', 'text',
 E'KI-Modelle können Verzerrungen aus ihren Trainingsdaten übernehmen und reproduzieren. Wenn du Vorauswahl oder Bewertung an ein Modell delegierst, riskierst du systematische Benachteiligung — ein direkter Konflikt mit dem AGG.\n\nGib niemals unnötige personenbezogene Daten in externe KI-Dienste ein. Matchunt setzt vor der KI-Verarbeitung eine PII-Pseudonymisierung ein, damit Klarnamen und Kontaktdaten nicht an Dritte gelangen. Diese Logik ist dein Best-Practice-Vorbild.\n\nDie Regel lautet: KI unterstützt die Recherche und das Texten, aber Eignungsentscheidungen trifft der Mensch — nachvollziehbar, begründet und diskriminierungsfrei.',
 10, true, 3),
-- M8
('b2000000-0000-4000-8000-000000000008', 'Strukturierte, kompetenzbasierte Interviews', 'text',
 E'Strukturierte Interviews stellen allen Kandidaten dieselben, vorab definierten Fragen entlang der Anforderungskriterien. Das macht Bewertungen vergleichbar und reduziert Bauchentscheidungen und Bias deutlich.\n\nArbeite mit verhaltensbasierten Fragen: Lass dir konkrete vergangene Situationen schildern statt hypothetischer Selbsteinschätzungen. "Erzähl mir von einem Projekt, in dem ein Deadline-Konflikt eskalierte — was hast du konkret getan?" zeigt mehr als jede Skala von eins bis zehn.\n\nAchte auf Red Flags: vage Antworten ohne eigenen Beitrag, widersprüchliche Zeitlinien, fehlende Reflexion. Dokumentiere strukturiert, damit deine Empfehlung an den Kunden belastbar und begründet ist.',
 11, true, 1),
-- M9
('b2000000-0000-4000-8000-000000000009', 'Business Development & Mandatsakquise', 'text',
 E'Ohne Mandate kein Geschäft. Business Development ist die Kunst, an gute Aufträge zu kommen — durch gezielte Ansprache von Unternehmen mit echtem Bedarf, nicht durch wahlloses Anrufen. Recherchiere Wachstum, offene Stellen und Auslöser wie Finanzierungsrunden.\n\nIm Erstkontakt verkaufst du nicht den Lebenslauf, sondern die Lösung eines Problems: schneller besetzen, besser besetzen, Zugang zu passiven Kandidaten. Cold Calling funktioniert, wenn du in den ersten Sekunden Relevanz zeigst und eine konkrete Frage stellst.\n\nAuf einem Marktplatz wie Matchunt ist ein Teil dieser Akquise bereits gelöst: Die Mandate sind da, du konkurrierst über Qualität und Geschwindigkeit. Die BD-Skills bleiben trotzdem dein Fundament für eine eigenständige Karriere.',
 12, true, 1),
('b2000000-0000-4000-8000-000000000009', 'Honorar-Verhandlung & Closing', 'text',
 E'Über Honorar zu verhandeln heißt, deinen Wert souverän zu vertreten. Nenne deinen Satz selbstbewusst und begründe ihn mit Ergebnis und Risiko, nicht mit Aufwand. Wer sich beim Preis sofort drücken lässt, signalisiert Unsicherheit.\n\nClosing ist kein Trick, sondern das saubere Wegräumen von Hindernissen. Frage früh nach Bedenken, mach den nächsten Schritt immer explizit und halte das Momentum. Ein Angebot, das tagelang unkommentiert liegt, stirbt langsam.\n\nGerade in der Schlussphase sind Counter-Offers und Gegenangebote die größten Deal-Killer. Bereite Kandidaten und Kunden früh darauf vor, statt überrascht zu werden.',
 11, true, 2),
('b2000000-0000-4000-8000-000000000009', 'Rejection-Resilienz & Pipeline-Management', 'text',
 E'Ablehnung ist im Recruiting der Normalfall, nicht die Ausnahme. Die meisten Angesprochenen antworten nicht, viele Prozesse platzen kurz vor dem Ziel. Wer das persönlich nimmt, brennt aus — wer es als Statistik behandelt, bleibt handlungsfähig.\n\nDie Antwort auf Ablehnung ist eine volle Pipeline. Wenn an jeder Stelle des Funnels genug läuft, kostet dich ein einzelner Absprung weder Umsatz noch Nerven. Arbeite mit klaren Wiedervorlagen und lass nie eine Stufe leerlaufen.\n\nDiese Disziplin ist der eigentliche Unterschied zwischen den 50 Prozent, die scheitern, und denen, die langfristig gut verdienen. Resilienz ist trainierbar — durch System, nicht durch Willenskraft allein.',
 10, true, 3),
-- M10
('b2000000-0000-4000-8000-00000000000a', 'Counter-Offer-Handling & Vertragsphase', 'text',
 E'Die Vertragsphase ist die gefährlichste Phase. Sobald ein Kandidat kündigt, kommt häufig ein Gegenangebot des aktuellen Arbeitgebers. Wer darauf nicht vorbereitet ist, verliert die Besetzung in der letzten Minute.\n\nThematisiere das Gegenangebot proaktiv, lange bevor es kommt. Kläre mit dem Kandidaten die wahren Wechselgründe — geht es nur ums Geld, oder um Entwicklung, Führung, Sinn? Geld allein hält selten, und das weißt du, also adressiere die echten Motive.\n\nBegleite die Vertragsphase eng: Start-Termin, Onboarding, offene Fragen. Ein Deal ist erst sicher, wenn die Person den ersten Arbeitstag hinter sich hat. Bis dahin bist du aktiver Begleiter, nicht Zuschauer.',
 9, true, 1),
-- M11
('b2000000-0000-4000-8000-00000000000b', 'Ein Mandat end-to-end im Triple-Blind-Tool', 'text',
 E'In diesem Modul führst du ein Mandat vollständig durch die Matchunt-Plattform: vom anonymisierten Job über die Kandidaten-Submission, das Match-Scoring und die Interview-Koordination bis zur Platzierung. Du lernst, wo welche Information sichtbar wird und warum.\n\nDie stufenweise Identitätsfreigabe ist kein Hindernis, sondern dein Werkzeug. Du baust den Fall auf Substanz auf und gibst Namen erst frei, wenn beide Seiten Interesse signalisiert haben. So bleibt der Prozess sauber und bias-arm.\n\nWer die Plattform beherrscht, arbeitet schneller und macht weniger Fehler. Diese Mastery ist die direkte Brücke zu deinen ersten echten Mandaten nach dem Andocken.',
 10, true, 1),
-- M12 Capstone (quiz-Typ als Gate-Marker)
('b2000000-0000-4000-8000-00000000000c', 'Capstone-Briefing: dein echtes anonymisiertes Mandat', 'quiz',
 E'Das Capstone ist deine Abschlussprüfung und gleichzeitig dein Eintritt in die Praxis. Du bearbeitest ein echtes, vollständig anonymisiertes Matchunt-Mandat: Du entwickelst eine Sourcing-Strategie, erstellst eine begründete Shortlist und formulierst eine Empfehlung, als würdest du sie einem Kunden vorlegen.\n\nBewertet wird von einem erfahrenen Recruiter oder Admin entlang klarer Kriterien: Qualität der Suchstrategie, Passgenauigkeit der Shortlist, Stärke der Begründung und Sauberkeit im Umgang mit den Daten. Du hast unbegrenzte Versuche nach dem Mastery-Prinzip.\n\nBesteht du das Capstone, erhältst du das CMR-Zertifikat — und damit die Berechtigung, dich als bezahlter Matchunt-Recruiter zu bewerben. Dein Abschluss endet nicht im Papier, sondern in echten Mandaten und echtem Verdienst.',
 25, true, 1);

COMMIT;
