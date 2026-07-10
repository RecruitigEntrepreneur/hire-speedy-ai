// Gebündelte Akademie-Inhalte für den DEMO-MODUS (kein Backend nötig).
// Spiegelt die Seed-Migration 20260616140000_academy_seed_content.sql.
// Sobald die DB-Tabellen existieren, werden diese Daten automatisch durch
// die echten DB-Inhalte ersetzt (siehe useAcademy.ts -> academyDbAvailable()).

import type { AcademyCourse, AcademyLesson, AcademyModuleWithLessons } from './useAcademy';

interface DemoModule { id: string; title: string; lessons: Omit<AcademyLesson, 'module_id'>[]; }
interface DemoCourse { course: AcademyCourse; modules: DemoModule[]; }

const RAW: DemoCourse[] = [
  {
    course: {
      id: 'demo-c1', slug: 'recruiter-grundlagen', title: 'Recruiter-Grundlagen',
      description: 'Der kostenlose Einstieg in die moderne Personalvermittlung: Geschäftsmodell, Triple-Blind & DSGVO, Anforderungsprofil, Active Sourcing und die Erstansprache, die beantwortet wird. Nach diesem Kurs verstehst du den gesamten Recruiting-Funnel und kannst deine erste Kandidatenansprache schreiben.',
      level: 'beginner', is_premium: false, published: true, cover_image_url: null, sort_order: 1,
    },
    modules: [
      {
        id: 'demo-c1-m1', title: 'Branche & Geschäftsmodell Personalvermittlung',
        lessons: [
          { id: 'demo-c1-m1-l1', title: 'Was Headhunter wirklich verdienen', content_type: 'text', duration_min: 8, is_premium: false, sort_order: 1, video_url: null,
            body: 'Personalvermittlung wird über ein Honorar bezahlt, das ein Unternehmen für eine erfolgreiche Besetzung zahlt. Üblich sind 20 bis 33 Prozent des Bruttojahresgehalts der vermittelten Person. Bei einer Position mit 80.000 Euro Jahresgehalt entspricht das einem Honorar von etwa 16.000 bis 26.000 Euro pro Besetzung.\n\nEntscheidend ist nicht das einzelne hohe Honorar, sondern die Verlässlichkeit über das Jahr. Erfolgreiche Recruiter denken in Pipeline und Abschlussquote, nicht in Einzeldeals. Wer drei bis fünf Besetzungen pro Monat schafft, bewegt sich schnell in einem sechsstelligen Jahresumsatz.\n\nAuf Matchunt verdienst du als angedockter Recruiter an realen Platzierungen mit. Die Akademie bildet dich dafür aus, und der Abschluss ist die Eintrittskarte zu echten Mandaten.' },
          { id: 'demo-c1-m1-l2', title: 'Contingency vs. Retained — die zwei Modelle', content_type: 'text', duration_min: 9, is_premium: false, sort_order: 2, video_url: null,
            body: 'Im Contingency-Modell zahlt der Kunde nur bei Erfolg, also bei tatsächlicher Einstellung. Das Risiko liegt beim Recruiter, dafür ist der Einstieg für Kunden niederschwellig. Dieses Modell dominiert das Volumengeschäft und ist der Normalfall auf modernen Marktplätzen.\n\nIm Retained-Modell zahlt der Kunde vorab einen Teil des Honorars und beauftragt exklusiv. Das ist typisch für Executive Search und schwer zu besetzende Spezialrollen. Der Recruiter arbeitet planbarer, muss aber echte Suchtiefe und Marktkenntnis liefern.\n\nMatchunt arbeitet erfolgsbasiert: Du wirst bezahlt, wenn du platzierst. Das richtet deine Anreize sauber auf das aus, was zählt — eine erfolgreiche, dauerhafte Besetzung.' },
          { id: 'demo-c1-m1-l3', title: 'Die Provisionsrealität — warum viele scheitern', content_type: 'text', duration_min: 10, is_premium: false, sort_order: 3, video_url: null,
            body: 'Zwischen 43 und 50 Prozent der Branche verlassen den Beruf wieder, meist im ersten Jahr. Der häufigste Grund ist nicht fehlendes Talent, sondern eine falsche Erwartung: Das Geld kommt verzögert und unregelmäßig, während die Arbeit sofort anfällt.\n\nEine Besetzung durchläuft Sourcing, Ansprache, Qualifizierung, Interviews und Vertragsphase. Vom ersten Kontakt bis zur Unterschrift vergehen oft sechs bis zwölf Wochen. Wer das nicht einplant und keine volle Pipeline hält, gerät in einen Cashflow- und Motivationsknick.\n\nDie Lösung ist Systematik: konstant sourcen, viele Gespräche führen, Ablehnung als Normalfall behandeln. Genau diese Resilienz und Pipeline-Disziplin trainieren wir in den weiterführenden Modulen.' },
        ],
      },
      {
        id: 'demo-c1-m2', title: 'Triple-Blind & DSGVO-konformes Recruiting',
        lessons: [
          { id: 'demo-c1-m2-l1', title: 'Was Triple-Blind bedeutet', content_type: 'text', duration_min: 7, is_premium: false, sort_order: 1, video_url: null,
            body: 'Triple-Blind ist das Anonymisierungsprinzip von Matchunt. In der ersten Stufe sind Kandidat und Unternehmen füreinander vollständig anonym: Recruiter sehen anonymisierte Firmenprofile, Unternehmen sehen anonymisierte Kandidatenprofile.\n\nDie Identität wird stufenweise freigegeben — erst der Firmenname nach dem Opt-In des Kandidaten, dann der Vollzugriff nach bestätigtem Interview. Das schützt beide Seiten vor verfrühter Offenlegung und reduziert Bias im Auswahlprozess.\n\nFür dich als Recruiter heißt das: Du verkaufst die Substanz — Skills, Erfahrung, Passung — bevor Namen ins Spiel kommen. Das ist ein Qualitätsfilter und ein Vertrauensanker zugleich.' },
          { id: 'demo-c1-m2-l2', title: 'DSGVO & AGG im Recruiting-Alltag', content_type: 'text', duration_min: 9, is_premium: false, sort_order: 2, video_url: null,
            body: 'Du verarbeitest personenbezogene Daten und brauchst dafür eine Rechtsgrundlage — in der Regel die Einwilligung des Kandidaten oder ein berechtigtes Interesse mit sauberer Dokumentation. Speichere nur, was du brauchst, und lösche, was du nicht mehr brauchst.\n\nDas Allgemeine Gleichbehandlungsgesetz verbietet Benachteiligung wegen Alter, Geschlecht, Herkunft, Religion, Behinderung oder sexueller Identität. Anforderungsprofile und Ansprachen müssen sich strikt auf fachliche Eignung beziehen.\n\nTriple-Blind hilft dir hier doppelt: Anonymisierung reduziert unbewussten Bias und sorgt dafür, dass die Eignung im Vordergrund steht. Im Zertifizierungskurs vertiefen wir die konkreten Fallstricke beim Sourcing.' },
        ],
      },
      {
        id: 'demo-c1-m3', title: 'Anforderungsprofil & Intake',
        lessons: [
          { id: 'demo-c1-m3-l1', title: 'Das perfekte Intake-Gespräch', content_type: 'text', duration_min: 10, is_premium: false, sort_order: 1, video_url: null,
            body: 'Das Intake-Gespräch mit dem Auftraggeber entscheidet über den Erfolg der gesamten Suche. Ziel ist nicht eine Stellenanzeige, sondern ein präzises Verständnis: Welches Problem löst diese Rolle, und woran wird Erfolg in sechs Monaten gemessen?\n\nFrage nach den must-haves und den nice-to-haves und lass sie klar trennen. Frage nach Beispielprofilen, die der Kunde gut findet, und nach No-Gos. Kläre Gehalt, Prozessgeschwindigkeit und Entscheidungswege, bevor du suchst.\n\nEin gutes Intake spart dir später Dutzende Stunden Fehlsuche. Recruiter, die hier schludern, präsentieren am Bedarf vorbei und verbrennen Vertrauen beim Kunden.' },
          { id: 'demo-c1-m3-l2', title: 'Vom Briefing zum Anforderungsprofil', content_type: 'text', duration_min: 9, is_premium: false, sort_order: 2, video_url: null,
            body: 'Aus dem Intake formst du ein verwertbares Anforderungsprofil. Übersetze schwammige Wünsche in beobachtbare Kriterien: Statt "Teamplayer" definierst du, in welchen Konstellationen die Person nachweislich erfolgreich war.\n\nGewichte die Kriterien. Drei bis fünf echte must-haves reichen — alles andere ist Bonus. Ein überladenes Profil mit fünfzehn Pflichtkriterien beschreibt eine Person, die es nicht gibt, und blockiert jede realistische Suche.\n\nDas fertige Profil ist deine Suchlandkarte und gleichzeitig dein Maßstab bei der Bewertung. In Matchunt fließt es direkt in das Matching und die spätere Begründung deiner Empfehlung ein.' },
        ],
      },
      {
        id: 'demo-c1-m4', title: 'Active Sourcing Basics',
        lessons: [
          { id: 'demo-c1-m4-l1', title: 'Wo passive Kandidaten leben', content_type: 'text', duration_min: 8, is_premium: false, sort_order: 1, video_url: null,
            body: 'Die besten Kandidaten suchen nicht aktiv — sie sind in ihrem Job zufrieden genug, um nicht zu wechseln, aber offen für das richtige Angebot. Diese passiven Talente erreichst du nicht über Anzeigen, sondern über gezielte Direktansprache.\n\nDeine Hauptkanäle sind berufliche Netzwerke wie LinkedIn und XING, dazu fachspezifische Quellen: GitHub und Stack Overflow für Entwickler, Branchenverzeichnisse, Fachcommunities, Konferenz-Speakerlisten und Veröffentlichungen.\n\nDer Schlüssel ist, dort zu suchen, wo deine Zielgruppe ihre fachliche Identität zeigt. Wer nur eine Plattform nutzt, sieht nur einen Ausschnitt des Marktes.' },
          { id: 'demo-c1-m4-l2', title: 'Boolean Search Grundlagen', content_type: 'text', duration_min: 11, is_premium: false, sort_order: 2, video_url: null,
            body: 'Boolean Search kombiniert Suchbegriffe mit den Operatoren AND, OR und NOT, um Trefferlisten gezielt einzugrenzen oder zu erweitern. AND verknüpft Pflichtbegriffe, OR fängt Synonyme ein, NOT schließt Störbegriffe aus.\n\nEin Beispiel: ("Java" OR "Kotlin") AND "Microservices" NOT "Praktikant" findet erfahrene JVM-Entwickler mit Microservices-Erfahrung und filtert Praktika heraus. Klammern steuern die Reihenfolge, Anführungszeichen halten Wortgruppen zusammen.\n\nDenke in Synonymen und Jobtitel-Varianten: Dieselbe Rolle heißt je nach Firma anders. Gute Strings entstehen iterativ — du verfeinerst sie anhand der Treffer. Im Profikurs automatisieren wir genau diesen Schritt mit KI.' },
        ],
      },
      {
        id: 'demo-c1-m5', title: 'Erstansprache & Candidate Experience',
        lessons: [
          { id: 'demo-c1-m5-l1', title: 'Die Ansprache, die beantwortet wird', content_type: 'text', duration_min: 9, is_premium: false, sort_order: 1, video_url: null,
            body: 'Eine gute Erstansprache ist kurz, persönlich und konkret. Sie zeigt in den ersten zwei Sätzen, dass du das Profil wirklich gelesen hast, und nennt einen spezifischen Grund, warum genau diese Person passt.\n\nVermeide generische Massenbotschaften — sie werden ignoriert. Beziehe dich auf ein konkretes Projekt, einen Tech-Stack oder eine Station im Lebenslauf. Formuliere einen klaren, niedrigschwelligen nächsten Schritt: ein kurzes Gespräch, nicht sofort eine Bewerbung.\n\nMiss deine Antwortrate. Liegt sie unter dem Branchenschnitt, liegt es fast immer an zu wenig Personalisierung oder einem unklaren Mehrwert. Teste Betreffzeilen und Einstiege systematisch.' },
          { id: 'demo-c1-m5-l2', title: 'Candidate Experience als Wettbewerbsvorteil', content_type: 'text', duration_min: 8, is_premium: false, sort_order: 2, video_url: null,
            body: 'Kandidaten erinnern sich an das Wie, nicht nur an das Ob. Schnelle Reaktionszeiten, ehrliche Erwartungen und respektvolle Absagen entscheiden darüber, ob jemand dich weiterempfiehlt oder warnt.\n\nHalte Kandidaten proaktiv auf dem Laufenden, auch wenn es gerade nichts Neues gibt. Gib konkretes, wertschätzendes Feedback. Eine gute Absage kann einen künftigen Kandidaten oder sogar einen künftigen Auftraggeber schaffen.\n\nGerade im anonymisierten Triple-Blind-Prozess ist deine Verlässlichkeit das, was Vertrauen aufbaut. Eine starke Candidate Experience ist kein Soft Skill, sondern dein wichtigster Reputationshebel.' },
        ],
      },
    ],
  },
  {
    course: {
      id: 'demo-c2', slug: 'zertifizierter-matchunt-recruiter', title: 'Zertifizierter Matchunt-Recruiter (CMR)',
      description: 'Die Vollausbildung zum eigenständigen Headhunter: Active Sourcing auf Profi-Niveau, KI-gestütztes Recruiting mit konkreten Prompts, 360-Grad-Agentur-Skills von Business Development bis Honorar-Verhandlung, Plattform-Mastery und ein praktisches Capstone an einem echten anonymisierten Mandat. Der Abschluss ist die Voraussetzung, um dich als bezahlter Matchunt-Recruiter zu bewerben.',
      level: 'advanced', is_premium: true, published: true, cover_image_url: null, sort_order: 2,
    },
    modules: [
      {
        id: 'demo-c2-m6', title: 'Active Sourcing Deep Dive',
        lessons: [
          { id: 'demo-c2-m6-l1', title: 'Mehrkanaliges Sourcing & X-Ray Search (Vorschau)', content_type: 'text', duration_min: 10, is_premium: false, sort_order: 1, video_url: null,
            body: 'X-Ray Search nutzt eine externe Suchmaschine, um gezielt in einem Netzwerk zu suchen, ohne dessen Limitierungen. Mit site:linkedin.com/in kombiniert mit Skill- und Ortsbegriffen findest du Profile, die in der internen Suche verborgen bleiben.\n\nProfis bleiben nie auf einem Kanal. Sie kombinieren Netzwerke, Fachplattformen, GitHub-Mitwirkende, Konferenz-Speaker und Branchenverzeichnisse zu einer Multi-Source-Suche. Jeder Kanal zeigt einen anderen Ausschnitt desselben Talentmarkts.\n\nDiese Lektion ist deine kostenlose Vorschau auf den Zertifizierungskurs. Die folgenden Module sind Teil der Premium-Ausbildung und führen dich bis zum CMR-Zertifikat.' },
          { id: 'demo-c2-m6-l2', title: 'Den Sourcing-zu-Hire-Funnel messen', content_type: 'text', duration_min: 9, is_premium: true, sort_order: 2, video_url: null,
            body: 'Was du nicht misst, kannst du nicht verbessern. Erfasse pro Suche, wie viele Profile du gesichtet, angesprochen, beantwortet bekommen und in Interviews gebracht hast. Aus diesen Zahlen ergibt sich deine Conversion entlang des Funnels.\n\nTypische Engpässe verraten sich sofort: Eine niedrige Antwortrate deutet auf schwache Ansprachen hin, ein Abbruch nach dem Erstgespräch auf falsche Erwartungen oder schlechte Passung. So weißt du, an welcher Stelle du nachjustieren musst.\n\nDiese Kennzahlen sind auch dein Verkaufsargument gegenüber Kunden: Du argumentierst mit Daten statt mit Bauchgefühl und wirkst dadurch sofort professioneller.' },
        ],
      },
      {
        id: 'demo-c2-m7', title: 'KI-gestütztes Recruiting',
        lessons: [
          { id: 'demo-c2-m7-l1', title: 'KI für Sourcing-Strings & Boolean', content_type: 'text', duration_min: 11, is_premium: true, sort_order: 1, video_url: null,
            body: 'Künstliche Intelligenz beschleunigt die mühsamsten Teile des Sourcings. Statt Boolean-Strings manuell zu basteln, lässt du sie generieren und verfeinern — inklusive Synonymen, Jobtitel-Varianten und ausgeschlossenen Störbegriffen.\n\nEin nutzbarer Prompt lautet sinngemäß: "Erstelle einen Boolean-Suchstring für LinkedIn für eine Senior-Frontend-Entwicklerin mit React und TypeScript im Raum München. Berücksichtige Synonyme und alternative Jobtitel und schließe Praktika und Junior-Rollen aus."\n\nKI liefert dir einen Startpunkt, kein Endergebnis. Du prüfst die Treffer und iterierst. Die Zeitersparnis ist erheblich, die Verantwortung für Qualität bleibt bei dir.' },
          { id: 'demo-c2-m7-l2', title: 'Outreach-Personalisierung mit KI — mit Prompts', content_type: 'text', duration_min: 12, is_premium: true, sort_order: 2, video_url: null,
            body: 'KI hilft dir, Ansprachen in großem Maßstab persönlich zu halten. Du gibst ihr die Eckdaten eines Profils und lässt einen ersten Entwurf erstellen, den du dann mit einem echten, spezifischen Detail veredelst.\n\nEin bewährter Prompt: "Schreibe eine kurze, persönliche LinkedIn-Erstansprache an einen DevOps-Engineer mit Kubernetes-Erfahrung. Maximal 80 Wörter, kein Verkaufston, ein konkreter Aufhänger und ein niedrigschwelliger nächster Schritt."\n\nWichtig: Die KI ersetzt nicht deine Recherche. Der eine echte, individuelle Satz, den nur ein Mensch findet, entscheidet über die Antwortrate. KI liefert das Gerüst, du lieferst die Relevanz.' },
          { id: 'demo-c2-m7-l3', title: 'Grenzen, Bias & DSGVO-Fallen der KI', content_type: 'text', duration_min: 10, is_premium: true, sort_order: 3, video_url: null,
            body: 'KI-Modelle können Verzerrungen aus ihren Trainingsdaten übernehmen und reproduzieren. Wenn du Vorauswahl oder Bewertung an ein Modell delegierst, riskierst du systematische Benachteiligung — ein direkter Konflikt mit dem AGG.\n\nGib niemals unnötige personenbezogene Daten in externe KI-Dienste ein. Matchunt setzt vor der KI-Verarbeitung eine PII-Pseudonymisierung ein, damit Klarnamen und Kontaktdaten nicht an Dritte gelangen. Diese Logik ist dein Best-Practice-Vorbild.\n\nDie Regel lautet: KI unterstützt die Recherche und das Texten, aber Eignungsentscheidungen trifft der Mensch — nachvollziehbar, begründet und diskriminierungsfrei.' },
        ],
      },
      {
        id: 'demo-c2-m8', title: 'Interview & Assessment',
        lessons: [
          { id: 'demo-c2-m8-l1', title: 'Strukturierte, kompetenzbasierte Interviews', content_type: 'text', duration_min: 11, is_premium: true, sort_order: 1, video_url: null,
            body: 'Strukturierte Interviews stellen allen Kandidaten dieselben, vorab definierten Fragen entlang der Anforderungskriterien. Das macht Bewertungen vergleichbar und reduziert Bauchentscheidungen und Bias deutlich.\n\nArbeite mit verhaltensbasierten Fragen: Lass dir konkrete vergangene Situationen schildern statt hypothetischer Selbsteinschätzungen. "Erzähl mir von einem Projekt, in dem ein Deadline-Konflikt eskalierte — was hast du konkret getan?" zeigt mehr als jede Skala von eins bis zehn.\n\nAchte auf Red Flags: vage Antworten ohne eigenen Beitrag, widersprüchliche Zeitlinien, fehlende Reflexion. Dokumentiere strukturiert, damit deine Empfehlung an den Kunden belastbar und begründet ist.' },
        ],
      },
      {
        id: 'demo-c2-m9', title: '360-Recruiting & Agentur-BD',
        lessons: [
          { id: 'demo-c2-m9-l1', title: 'Business Development & Mandatsakquise', content_type: 'text', duration_min: 12, is_premium: true, sort_order: 1, video_url: null,
            body: 'Ohne Mandate kein Geschäft. Business Development ist die Kunst, an gute Aufträge zu kommen — durch gezielte Ansprache von Unternehmen mit echtem Bedarf, nicht durch wahlloses Anrufen. Recherchiere Wachstum, offene Stellen und Auslöser wie Finanzierungsrunden.\n\nIm Erstkontakt verkaufst du nicht den Lebenslauf, sondern die Lösung eines Problems: schneller besetzen, besser besetzen, Zugang zu passiven Kandidaten. Cold Calling funktioniert, wenn du in den ersten Sekunden Relevanz zeigst und eine konkrete Frage stellst.\n\nAuf einem Marktplatz wie Matchunt ist ein Teil dieser Akquise bereits gelöst: Die Mandate sind da, du konkurrierst über Qualität und Geschwindigkeit. Die BD-Skills bleiben trotzdem dein Fundament für eine eigenständige Karriere.' },
          { id: 'demo-c2-m9-l2', title: 'Honorar-Verhandlung & Closing', content_type: 'text', duration_min: 11, is_premium: true, sort_order: 2, video_url: null,
            body: 'Über Honorar zu verhandeln heißt, deinen Wert souverän zu vertreten. Nenne deinen Satz selbstbewusst und begründe ihn mit Ergebnis und Risiko, nicht mit Aufwand. Wer sich beim Preis sofort drücken lässt, signalisiert Unsicherheit.\n\nClosing ist kein Trick, sondern das saubere Wegräumen von Hindernissen. Frage früh nach Bedenken, mach den nächsten Schritt immer explizit und halte das Momentum. Ein Angebot, das tagelang unkommentiert liegt, stirbt langsam.\n\nGerade in der Schlussphase sind Counter-Offers und Gegenangebote die größten Deal-Killer. Bereite Kandidaten und Kunden früh darauf vor, statt überrascht zu werden.' },
          { id: 'demo-c2-m9-l3', title: 'Rejection-Resilienz & Pipeline-Management', content_type: 'text', duration_min: 10, is_premium: true, sort_order: 3, video_url: null,
            body: 'Ablehnung ist im Recruiting der Normalfall, nicht die Ausnahme. Die meisten Angesprochenen antworten nicht, viele Prozesse platzen kurz vor dem Ziel. Wer das persönlich nimmt, brennt aus — wer es als Statistik behandelt, bleibt handlungsfähig.\n\nDie Antwort auf Ablehnung ist eine volle Pipeline. Wenn an jeder Stelle des Funnels genug läuft, kostet dich ein einzelner Absprung weder Umsatz noch Nerven. Arbeite mit klaren Wiedervorlagen und lass nie eine Stufe leerlaufen.\n\nDiese Disziplin ist der eigentliche Unterschied zwischen den 50 Prozent, die scheitern, und denen, die langfristig gut verdienen. Resilienz ist trainierbar — durch System, nicht durch Willenskraft allein.' },
        ],
      },
      {
        id: 'demo-c2-m10', title: 'Candidate- & Client-Management bis zum Placement',
        lessons: [
          { id: 'demo-c2-m10-l1', title: 'Counter-Offer-Handling & Vertragsphase', content_type: 'text', duration_min: 9, is_premium: true, sort_order: 1, video_url: null,
            body: 'Die Vertragsphase ist die gefährlichste Phase. Sobald ein Kandidat kündigt, kommt häufig ein Gegenangebot des aktuellen Arbeitgebers. Wer darauf nicht vorbereitet ist, verliert die Besetzung in der letzten Minute.\n\nThematisiere das Gegenangebot proaktiv, lange bevor es kommt. Kläre mit dem Kandidaten die wahren Wechselgründe — geht es nur ums Geld, oder um Entwicklung, Führung, Sinn? Geld allein hält selten, und das weißt du, also adressiere die echten Motive.\n\nBegleite die Vertragsphase eng: Start-Termin, Onboarding, offene Fragen. Ein Deal ist erst sicher, wenn die Person den ersten Arbeitstag hinter sich hat. Bis dahin bist du aktiver Begleiter, nicht Zuschauer.' },
        ],
      },
      {
        id: 'demo-c2-m11', title: 'Matchunt-Plattform-Mastery',
        lessons: [
          { id: 'demo-c2-m11-l1', title: 'Ein Mandat end-to-end im Triple-Blind-Tool', content_type: 'text', duration_min: 10, is_premium: true, sort_order: 1, video_url: null,
            body: 'In diesem Modul führst du ein Mandat vollständig durch die Matchunt-Plattform: vom anonymisierten Job über die Kandidaten-Submission, das Match-Scoring und die Interview-Koordination bis zur Platzierung. Du lernst, wo welche Information sichtbar wird und warum.\n\nDie stufenweise Identitätsfreigabe ist kein Hindernis, sondern dein Werkzeug. Du baust den Fall auf Substanz auf und gibst Namen erst frei, wenn beide Seiten Interesse signalisiert haben. So bleibt der Prozess sauber und bias-arm.\n\nWer die Plattform beherrscht, arbeitet schneller und macht weniger Fehler. Diese Mastery ist die direkte Brücke zu deinen ersten echten Mandaten nach dem Andocken.' },
        ],
      },
      {
        id: 'demo-c2-m12', title: 'Capstone — echtes Mandat',
        lessons: [
          { id: 'demo-c2-m12-l1', title: 'Capstone-Briefing: dein echtes anonymisiertes Mandat', content_type: 'quiz', duration_min: 25, is_premium: true, sort_order: 1, video_url: null,
            body: 'Das Capstone ist deine Abschlussprüfung und gleichzeitig dein Eintritt in die Praxis. Du bearbeitest ein echtes, vollständig anonymisiertes Matchunt-Mandat: Du entwickelst eine Sourcing-Strategie, erstellst eine begründete Shortlist und formulierst eine Empfehlung, als würdest du sie einem Kunden vorlegen.\n\nBewertet wird von einem erfahrenen Recruiter oder Admin entlang klarer Kriterien: Qualität der Suchstrategie, Passgenauigkeit der Shortlist, Stärke der Begründung und Sauberkeit im Umgang mit den Daten. Du hast unbegrenzte Versuche nach dem Mastery-Prinzip.\n\nBesteht du das Capstone, erhältst du das CMR-Zertifikat — und damit die Berechtigung, dich als bezahlter Matchunt-Recruiter zu bewerben. Dein Abschluss endet nicht im Papier, sondern in echten Mandaten und echtem Verdienst.' },
        ],
      },
    ],
  },
];

export const DEMO_COURSES: AcademyCourse[] = RAW.map((c) => c.course);

export function getDemoCourseContent(slug: string | undefined): {
  course: AcademyCourse; modules: AcademyModuleWithLessons[]; lessons: AcademyLesson[];
} | null {
  const found = RAW.find((c) => c.course.slug === slug);
  if (!found) return null;
  const modules: AcademyModuleWithLessons[] = found.modules.map((m) => ({
    id: m.id, course_id: found.course.id, title: m.title, sort_order: 0,
    lessons: m.lessons.map((l) => ({ ...l, module_id: m.id })),
  }));
  const lessons = modules.flatMap((m) => m.lessons);
  return { course: found.course, modules, lessons };
}

export function getDemoLessonIds(courseId: string): string[] {
  const found = RAW.find((c) => c.course.id === courseId);
  if (!found) return [];
  return found.modules.flatMap((m) => m.lessons.map((l) => l.id));
}

export function getDemoCourseById(courseId: string): AcademyCourse | undefined {
  return DEMO_COURSES.find((c) => c.id === courseId);
}
