// German is the default locale. Auto-merged from section keymaps.
// eslint-disable
const de = {
  "team": {
    "title": "Team-Verwaltung",
    "tabs": {
      "members": "Mitglieder",
      "audit": "Audit-Log",
      "settings": "Einstellungen"
    },
    "roles": {
      "owner": "Inhaber",
      "admin": "Administrator",
      "hr": "HR / Recruiting",
      "hiring_manager": "Hiring Manager",
      "viewer": "Betrachter",
      "finance": "Finanzen",
      "admin_desc": "Kann Nutzer verwalten und sieht alle Jobs & Kandidaten",
      "hr_desc": "Sieht alle Jobs & Kandidaten des Unternehmens, keine Nutzerverwaltung",
      "hiring_manager_desc": "Sieht nur zugewiesene Jobs: Intake, Kandidaten-Review, Interviews",
      "viewer_desc": "Nur Lesezugriff auf zugewiesene Jobs, darf kommentieren"
    },
    "activate": {
      "title": "Team aktivieren",
      "description": "Laden Sie Kolleginnen und Kollegen ein — z. B. Hiring Manager aus dem Fachbereich, die ihre Stellen selbst betreuen.",
      "button": "Team aktivieren"
    },
    "invite": {
      "button": "Mitglied einladen",
      "title": "Teammitglied einladen",
      "description": "Die Einladung wird per E-Mail verschickt und ist 7 Tage gültig.",
      "email": "E-Mail-Adresse",
      "role": "Rolle",
      "role_placeholder": "Rolle auswählen",
      "jobs": "Zugewiesene Jobs",
      "jobs_hint": "Hiring Manager und Betrachter sehen nur die hier zugewiesenen Jobs.",
      "no_jobs": "Noch keine Jobs vorhanden — die Zuweisung kann später erfolgen.",
      "cancel": "Abbrechen",
      "submit": "Einladung senden",
      "sent_title": "Einladung verschickt",
      "sent_hint": "Sie können den Einladungslink zusätzlich direkt teilen.",
      "created_title": "Einladung erstellt",
      "created_hint": "Der E-Mail-Versand war nicht möglich — teilen Sie den Link direkt.",
      "done": "Fertig",
      "link_copied": "Link kopiert"
    },
    "invites": {
      "title": "Ausstehende Einladungen",
      "expires": "Läuft ab",
      "job": "Job",
      "jobs": "Jobs",
      "revoke": "Einladung zurückziehen"
    },
    "members": {
      "title": "Teammitglieder",
      "updated": "Mitglied aktualisiert",
      "update_error": "Fehler beim Aktualisieren",
      "deactivate_confirm": "Dieses Mitglied deaktivieren? Der Zugriff erlischt sofort.",
      "unknown": "Unbekannt",
      "you": "Sie",
      "deactivated": "Deaktiviert",
      "last_login": "Letzter Login",
      "never_logged_in": "Noch nie eingeloggt",
      "change_role": "Rolle ändern",
      "reactivate": "Reaktivieren",
      "deactivate": "Deaktivieren",
      "empty": "Keine Teammitglieder gefunden"
    },
    "audit": {
      "title": "Audit-Log",
      "description": "Team-Ereignisse und Kandidaten-Datenzugriffe Ihrer Organisation",
      "empty": "Noch keine Einträge",
      "member_added": "Mitglied hinzugefügt ({{role}})",
      "role_changed": "Rolle geändert: {{from}} → {{to}}",
      "member_deactivated": "Mitglied deaktiviert",
      "member_reactivated": "Mitglied reaktiviert",
      "invite_created": "Einladung erstellt an {{email}}",
      "invite_accepted": "Einladung angenommen von {{email}}",
      "invite_deleted": "Einladung zurückgezogen ({{email}})",
      "candidate_viewed": "Kandidatenprofil eingesehen"
    },
    "settings": {
      "saved": "Einstellungen gespeichert",
      "save_error": "Fehler beim Speichern",
      "intake_title": "Intake-Freigabe",
      "intake_description": "Steuert, ob Stellenaufnahmen von Hiring Managern intern freigegeben werden müssen, bevor sie an uns gehen.",
      "intake_label": "Interne Freigabe erforderlich",
      "intake_on_hint": "Intakes von Hiring Managern gehen erst an Admin/HR zur Freigabe.",
      "intake_off_hint": "Intakes von Hiring Managern gehen direkt an uns.",
      "org_title": "Organisation",
      "org_name": "Name",
      "billing_email": "Billing E-Mail",
      "save": "Speichern"
    },
    "accept": {
      "loading": "Einladung wird geprüft…",
      "success_title": "Erfolgreich beigetreten!",
      "success_hint": "Sie werden weitergeleitet…",
      "expired_title": "Einladung abgelaufen",
      "expired_hint": "Diese Einladung ist leider abgelaufen. Bitte fordern Sie eine neue an.",
      "invalid_title": "Einladung ungültig",
      "invalid_hint": "Diese Einladung ist ungültig oder wurde bereits verwendet.",
      "to_home": "Zur Startseite",
      "title": "Sie wurden eingeladen",
      "description": "{{org}} möchte Sie als Teammitglied hinzufügen",
      "an_organization": "Eine Organisation",
      "your_role": "Ihre Rolle",
      "invited_as": "Eingeladen als",
      "assigned_jobs": "Zugewiesene Jobs",
      "valid_until": "Gültig bis",
      "accept_button": "Einladung annehmen",
      "login_button": "Anmelden und annehmen",
      "login_hint": "Für diese E-Mail existiert bereits ein Konto. Bitte melden Sie sich an.",
      "full_name": "Ihr Name",
      "password": "Passwort",
      "password_min": "Mindestens 8 Zeichen",
      "password_confirm": "Passwort bestätigen",
      "password_mismatch": "Passwörter stimmen nicht überein",
      "create_account_button": "Konto erstellen & beitreten"
    }
  },
  "nav": {
    "features": "Funktionen",
    "solutions": "Lösungen",
    "pricing": "Preise",
    "resources": "Ressourcen",
    "company": "Unternehmen",
    "signIn": "Anmelden",
    "startNow": "Kostenlos starten",
    "dashboard": "Dashboard",
    "settings": "Einstellungen",
    "signOut": "Abmelden",
    "features_items": {
      "matching": "KI-Matching-Engine",
      "matching_desc": "KI-gestützte Kandidatenauswahl",
      "interview": "Automatisierter Interview-Flow",
      "interview_desc": "Vollautomatisierte Prozesse",
      "network": "Recruiter-Netzwerk",
      "network_desc": "Persönlich verifizierte Recruiter",
      "escrow": "Escrow & Zahlungen",
      "escrow_desc": "Sichere Zahlungsabwicklung",
      "compliance": "Compliance & DSGVO",
      "compliance_desc": "DSGVO-konform, EU-Hosting",
      "analytics": "Analytics & Reporting",
      "analytics_desc": "Echtzeit-Insights"
    },
    "solutions_items": {
      "companies": "Für Unternehmen",
      "companies_desc": "Schneller die besten Talente finden",
      "recruiters": "Für Recruiter & Agenturen",
      "recruiters_desc": "Höhere Provisionen, bessere Deals",
      "smb": "Für KMU & Startups",
      "smb_desc": "Erfolgsbasiert ohne Fixkosten",
      "enterprise": "Für Enterprise",
      "enterprise_desc": "Individuelle Lösungen auf Anfrage"
    },
    "resources_items": {
      "blog": "Blog",
      "blog_desc": "Insights & Best Practices",
      "guides": "Guides",
      "guides_desc": "Schritt-für-Schritt-Anleitungen",
      "faq": "FAQ",
      "faq_desc": "Häufige Fragen",
      "help": "Hilfe-Center",
      "help_desc": "Support & Hilfe",
      "docs": "Dokumentation",
      "docs_desc": "Technische Dokumentation"
    },
    "company_items": {
      "about": "Über uns",
      "about_desc": "Unsere Mission & Team",
      "careers": "Karriere",
      "careers_desc": "Werde Teil des Teams",
      "press": "Presse",
      "press_desc": "News & Media Kit",
      "contact": "Kontakt",
      "contact_desc": "Sprechen Sie mit uns"
    }
  },
  "hero": {
    "badge": "Triple-Blind · Erfolgsbasiert · DACH",
    "headline1": "Perfect Match.",
    "headline2": "Perfect Hire.",
    "subline_1": "Geprüfte Recruiter schlagen passende Kandidaten vor – anonymisiert. Unternehmen stellen ein.",
    "subline_strong": "Bezahlt wird nur bei Erfolg.",
    "ctaPrimary": "Job kostenlos ausschreiben",
    "ctaSecondary": "Recruiter werden",
    "microProof": "Keine Fixkosten · Bezahlung nur bei Einstellung · DSGVO-konform",
    "scroll": "Scroll"
  },
  "auth": {
    "backToHome": "Zurück zur Startseite",
    "signupTitle": "Konto erstellen",
    "signinTitle": "Willkommen zurück",
    "signupDesc": "Werden Sie Teil von Matchunt – einstellen oder vermitteln",
    "signinDesc": "Melden Sie sich an, um Ihr Dashboard zu öffnen",
    "tabSignin": "Anmelden",
    "tabSignup": "Registrieren",
    "fullName": "Vollständiger Name",
    "fullNamePlaceholder": "Max Mustermann",
    "iAmA": "Ich bin...",
    "email": "E-Mail",
    "emailPlaceholder": "sie@beispiel.de",
    "password": "Passwort",
    "createAccount": "Konto erstellen",
    "signinButton": "Anmelden",
    "secure": "Ihre Daten sind sicher und verschlüsselt",
    "role": {
      "client": "Unternehmen",
      "clientDesc": "Ich möchte einstellen",
      "recruiter": "Recruiter",
      "recruiterDesc": "Ich möchte Kandidaten vorschlagen"
    },
    "errors": {
      "email": "Bitte geben Sie eine gültige E-Mail-Adresse ein",
      "password": "Das Passwort muss mindestens 6 Zeichen haben",
      "fullName": "Der Name muss mindestens 2 Zeichen haben"
    },
    "toast": {
      "signupSuccess": "Konto erfolgreich erstellt!",
      "welcomeBack": "Willkommen zurück!",
      "alreadyRegistered": "Diese E-Mail ist bereits registriert. Bitte melden Sie sich an.",
      "invalidCredentials": "E-Mail oder Passwort ungültig. Bitte versuchen Sie es erneut.",
      "unexpected": "Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
    }
  },
  "socialProof": {
    "eyebrow": "Gebaut mit Recruitern und Hiring-Teams aus dem DACH-Markt",
    "heading": "Drei Prinzipien statt großer Versprechen",
    "marqueeText": "Schneller · Präziser · Fairer · Ergebnisorientiert · ",
    "principles": {
      "item1_title": "Erfolgsbasiert",
      "item1_description": "Keine Fixkosten, keine Retainer. Bezahlt wird ausschließlich bei erfolgreicher Einstellung – abgesichert über Escrow.",
      "item2_title": "Geprüfte Recruiter",
      "item2_description": "Jeder Recruiter auf der Plattform wird persönlich verifiziert, bevor er Kandidaten vorschlagen darf.",
      "item3_title": "Diskretion by Design",
      "item3_description": "Triple-Blind-Anonymisierung schützt Kandidaten, Recruiter und Unternehmen. Deshalb nennen wir auch keine Kundennamen – Diskretion ist unser Produkt."
    }
  },
  "problem": {
    "headline_main": "Hiring is Broken.",
    "headline_accent": "Everywhere.",
    "intro": "Das heutige Recruiting-System ist ein Flickenteppich aus Tools, E-Mails, ATS-Systemen, Freelancern, Agenturen und Zufällen.",
    "tagline": "Wir ersetzen Chaos durch Klarheit.",
    "cta": "So lösen wir das Problem",
    "painPoints": {
      "item1_title": "Zeitverlust",
      "item1_description": "Prozesse, die Wochen dauern, statt Minuten. Jeder Tag ohne Besetzung kostet Geld und Produktivität.",
      "item2_title": "Unkontrollierte Kommunikation",
      "item2_description": "Kandidaten springen ab. Recruiter funktionieren im Blindflug. Niemand weiß, wo der Prozess steht.",
      "item3_title": "Fehlanreize",
      "item3_description": "Kein Alignment zwischen Unternehmen, Recruitern und Kandidaten. Das System belohnt Quantität, nicht Qualität."
    }
  },
  "tripleBlind": {
    "badge": "Triple-Blind",
    "headline1": "Niemand sieht mehr,",
    "headline2": "als er muss.",
    "subline": "Der einzige Recruiting-Marktplatz im DACH-Raum, der alle drei Seiten schützt – bis beide Seiten Ja sagen. Sehen Sie selbst, wer was wann sieht.",
    "cta": "Triple-Blind starten",
    "caption_before": "Vor dem Match bleiben Identität, Auftraggeber und Kontaktdaten verborgen.",
    "caption_after": "Erst wenn beide Seiten zustimmen, werden die geschützten Felder freigegeben.",
    "toggle": {
      "before": "Vor dem Match",
      "after": "Nach beidseitigem Opt-In"
    },
    "parties": {
      "company_role": "Unternehmen",
      "company_tagline": "Bewertet Eignung, nicht Lebensläufe.",
      "company_field1_label": "Skills & Fit-Score",
      "company_field1_before": "Vollständig sichtbar",
      "company_field1_after": "Vollständig sichtbar",
      "company_field2_label": "Erfahrung & Gehalt",
      "company_field2_before": "Als Range",
      "company_field2_after": "Als Range",
      "company_field3_label": "Region",
      "company_field3_before": "Süddeutschland",
      "company_field3_after": "Süddeutschland",
      "company_field4_label": "Name & Kontakt",
      "company_field4_before": "Verborgen",
      "company_field4_after": "Freigegeben",
      "recruiter_role": "Recruiter",
      "recruiter_tagline": "Behält den eigenen Kandidaten.",
      "recruiter_field1_label": "Mandat & Anforderungen",
      "recruiter_field1_before": "Vollständig sichtbar",
      "recruiter_field1_after": "Vollständig sichtbar",
      "recruiter_field2_label": "Eigener Kandidat",
      "recruiter_field2_before": "Exklusiv zugeordnet",
      "recruiter_field2_after": "Exklusiv zugeordnet",
      "recruiter_field3_label": "Auftraggeber",
      "recruiter_field3_before": "[Branche] Unternehmen",
      "recruiter_field3_after": "Offengelegt",
      "recruiter_field4_label": "Provisionsschutz",
      "recruiter_field4_before": "Garantiert",
      "recruiter_field4_after": "Garantiert",
      "candidate_role": "Kandidat",
      "candidate_tagline": "Sucht diskret, behält die Kontrolle.",
      "candidate_field1_label": "Identität",
      "candidate_field1_before": "Anonym (Kandidat #A1B2)",
      "candidate_field1_after": "Selbst freigegeben",
      "candidate_field2_label": "Passende Rollen",
      "candidate_field2_before": "Vollständig sichtbar",
      "candidate_field2_after": "Vollständig sichtbar",
      "candidate_field3_label": "Aktueller Arbeitgeber",
      "candidate_field3_before": "Geschützt",
      "candidate_field3_after": "Geschützt",
      "candidate_field4_label": "Datenfreigabe",
      "candidate_field4_before": "Nur mit Zustimmung",
      "candidate_field4_after": "Erteilt"
    },
    "benefits": {
      "item1_party": "Für Unternehmen",
      "item1_title": "Bias-freie, faire Auswahl",
      "item1_text": "Sie sehen Skills und Fit — nicht Name, Foto oder Herkunft. Vorurteile werden ausgeschlossen, bevor sie entstehen können. Datenschutz nach DSGVO ist im Prozess eingebaut, nicht aufgesetzt.",
      "item2_party": "Für Recruiter",
      "item2_title": "Ihr Kandidat bleibt Ihr Kandidat",
      "item2_text": "Das Unternehmen sieht Ihren Kandidaten erst, wenn der Deal über Matchunt läuft. Kein Backdoor-Hiring an Ihnen vorbei — Ihre Provision ist abgesichert.",
      "item3_party": "Für Kandidaten",
      "item3_title": "Diskrete Suche ohne Risiko",
      "item3_text": "Anonym auf dem Markt, ohne dass der aktuelle Arbeitgeber etwas mitbekommt. Sie entscheiden selbst, wer welche Daten wann sieht."
    }
  },
  "engine": {
    "heading1": "Das Betriebssystem",
    "heading2": "fürs Recruiting",
    "subline1": "Eine Plattform. Ein Netzwerk. Ein automatisierter Hiring-Stack.",
    "subline2": "Alles orchestriert durch KI, abgesichert durch Prozesse – gebaut für Ergebnisorientierung.",
    "layer1_title": "KI-Matching-Layer",
    "layer1_description": "Versteht Rollen. Versteht Menschen. Versteht Passung.",
    "layer2_title": "Recruiter-Performance-Marktplatz",
    "layer2_description": "Top-Recruiter, algorithmisch ausgewählt, leistungsbasiert gerankt.",
    "layer3_title": "Triple-Blind Identitätsschutz",
    "layer3_description": "Keine Vorurteile. Keine Umgehung. Keine Compliance-Risiken.",
    "layer4_title": "Workflow-Automatisierung",
    "layer4_description": "WhatsApp, SMS, E-Mail, Interviews, Angebote, Escrow. Alles ohne manuell einen Finger zu rühren.",
    "layer5_title": "Analyse-Layer",
    "layer5_description": "Arbeitgeber-Score. Kandidaten-Readiness. Conversion-Analytics. Jeder Schritt ist messbar.",
    "cta": "Technologie entdecken"
  },
  "howItWorks": {
    "eyebrow": "So funktioniert's",
    "heading": "Die 60-Sekunden-Journey",
    "subline": "Von der Jobbeschreibung zum unterschriebenen Vertrag – vollautomatisiert.",
    "steps": {
      "item1_title": "Upload",
      "item1_subtitle": "Sie geben uns Ihren Job",
      "item1_description": "Link, PDF oder Text – unsere KI extrahiert Must-Haves, Skills, Gehaltsdaten und seniority-basierte Anforderungen automatisch.",
      "item1_detail1": "URL-Parsing",
      "item1_detail2": "PDF-Extraktion",
      "item1_detail3": "Freitext-Analyse",
      "item1_detail4": "Skill-Mapping",
      "item2_title": "Geprüfte Einreichungen",
      "item2_subtitle": "Geprüfte Recruiter liefern",
      "item2_description": "Triple-Blind. Fair. Performance-basiert. Nur die besten Recruiter mit den passendsten Kandidaten erreichen Sie.",
      "item2_detail1": "AI-Matching",
      "item2_detail2": "Anonymisierung",
      "item2_detail3": "Quality Score",
      "item2_detail4": "Behavior Tracking",
      "item3_title": "Interview & Hire",
      "item3_subtitle": "Automatisiert bis zum Offer",
      "item3_description": "Das System plant automatisch Interviews, sendet Reminder, sammelt Feedback und führt Sie bis zum unterschriebenen Offer.",
      "item3_detail1": "Auto-Scheduling",
      "item3_detail2": "Multi-Channel",
      "item3_detail3": "Escrow Payment",
      "item3_detail4": "Digital Signing"
    },
    "quote_part1": "Bereit in Minuten.",
    "quote_part2": "Ergebnisse in Tagen.",
    "cta": "Job jetzt starten"
  },
  "features": {
    "eyebrow": "Deep Features",
    "headline1": "The Tools that Make You",
    "headline2": "Faster than Your Competition",
    "item1_title": "AI Matching & Readiness Score",
    "item1_description": "Unsere KI bewertet nicht nur Skills. Sie versteht Motivation, Verhalten, kulturelle Passung und die Wahrscheinlichkeit eines Angebots.",
    "item1_score1_label": "Skill Match",
    "item1_score2_label": "Experience Fit",
    "item1_score3_label": "Salary Fit",
    "item1_score4_label": "Readiness Score",
    "item1_score5_label": "Closing Probability",
    "item1_cta": "AI in Aktion sehen",
    "item2_title": "Identity Protection / Triple Blind",
    "item2_description": "Kandidaten werden anonymisiert, bis sie zustimmen. Recruiter sehen keine Unternehmen. Unternehmen sehen keine Daten, bevor der Kandidat es erlaubt.",
    "item2_subtext": "Das ist Fairness. Das ist Compliance. Das ist die Zukunft.",
    "item3_title": "Workflow Automation Engine",
    "item3_description": "Interviews planen sich selbst. Angebote verschicken sich selbst. Payments laufen automatisch. Erinnerungen eliminieren Ghosting.",
    "item3_automation1_label": "Auto-Scheduling",
    "item3_automation2_label": "Email Sequences",
    "item3_automation3_label": "WhatsApp & SMS",
    "item3_automation4_label": "Escrow Payments",
    "item4_title": "ATS Integrationen",
    "item4_description": "Ihre Prozesse bleiben, wo sie sind. Integrationen mit gängigen ATS-Systemen entstehen nach Kundenbedarf.",
    "tripleBlind_role1_label": "Kandidat",
    "tripleBlind_role1_sub": "anonymisiert",
    "tripleBlind_role2_label": "Recruiter",
    "tripleBlind_role2_sub": "blind",
    "tripleBlind_role3_label": "Unternehmen",
    "tripleBlind_role3_sub": "geschützt",
    "tripleBlind_compliance": "DSGVO-konform, EU-Hosting",
    "automation_footer": "Vollautomatisch – Zero Admin Work",
    "integrations_footer": "+ weitere Integrationen auf Anfrage"
  },
  "forCompanies": {
    "eyebrow": "Für Unternehmen",
    "headline": "Hire with Precision",
    "subline": "Die schnellste und effektivste Art, Top-Talente zu finden und einzustellen.",
    "cta": "Job starten",
    "benefits": {
      "item1_title": "Bewerber in Tagen, nicht Wochen",
      "item1_description": "Erste qualifizierte Kandidatenvorschläge typischerweise innerhalb weniger Tage – statt wochenlanger Wartezeit.",
      "item2_title": "Erfolgsbasiertes Modell",
      "item2_description": "Sie zahlen nur, wenn Sie tatsächlich einstellen. Keine Fixkosten, keine Retainer.",
      "item3_title": "Transparenz & volle Kontrolle",
      "item3_description": "Sehen Sie jeden Schritt im Prozess. Jederzeit. In Echtzeit.",
      "item4_title": "Deep Analytics & Funnel Insights",
      "item4_description": "Verstehen Sie, wo Kandidaten abspringen und optimieren Sie Ihre Hiring-Pipeline."
    }
  },
  "forRecruiters": {
    "eyebrow": "Für Recruiter",
    "headline1": "Earn More.",
    "headline2": "Work Smarter.",
    "headline3": "Close Faster.",
    "intro": "Zugang zu exklusiven Mandaten. Intelligente Tools für bessere Platzierungen. Faire Vergütung bei voller Transparenz.",
    "benefits": {
      "item1_text": "Top-Jobs jeden Tag",
      "item2_text": "Intelligentes CRM",
      "item3_text": "Coaching Engine für mehr Placements",
      "item4_text": "Zero Admin Work",
      "item5_text": "Höchste Fairness & Transparenz"
    },
    "cta": "Recruiter werden",
    "cockpit_title": "Ihr Recruiter-Cockpit",
    "cockpit_subtitle": "So sieht Ihr Arbeitstag aus",
    "stat1_title": "Transparent",
    "stat1_text": "Provision vor Mandats-Annahme sichtbar",
    "stat2_title": "Abgesichert",
    "stat2_text": "Auszahlung über Escrow",
    "notifications": {
      "item1_text": "Neues Mandat verfügbar",
      "item2_text": "Interview bestätigt",
      "item3_text": "Payout freigegeben"
    },
    "badge": "Ihr Kandidat bleibt Ihr Kandidat"
  },
  "analytics": {
    "eyebrow": "Analytics",
    "headline1": "Clarity is",
    "headline2": "Power",
    "subline": "Sehen Sie jeden Schritt. Verstehen Sie Engpässe. Optimieren Sie Entscheidungen. Mit Echtzeit-Analytics haben Sie volle Kontrolle über Ihre Hiring-Pipeline.",
    "cta": "Analytics entdecken",
    "features": {
      "item1_text": "Time to Interview Tracking",
      "item2_text": "Offer Acceptance Rate",
      "item3_text": "Funnel Conversion Analysis",
      "item4_text": "Recruiter Performance Heatmap"
    },
    "dashboard": {
      "title": "Hiring Dashboard",
      "period": "Letzte 30 Tage"
    },
    "metrics": {
      "item1_label": "Time to Interview",
      "item1_unit": "Tage",
      "item1_trend": "↓ 24% vs. Vormonat",
      "item2_label": "Offer Acceptance",
      "item2_unit": "%",
      "item2_trend": "↑ 12% vs. Vormonat",
      "item3_label": "Aktive Kandidaten",
      "item3_unit": "",
      "item3_trend": "+18 diese Woche",
      "item4_label": "Placements",
      "item4_unit": "",
      "item4_trend": "Ziel: 10"
    },
    "funnel": {
      "title": "Funnel Conversion",
      "item1_label": "Submitted",
      "item2_label": "Opt-In",
      "item3_label": "Interview",
      "item4_label": "Offer",
      "item5_label": "Placed"
    }
  },
  "pricing": {
    "eyebrow": "Pricing",
    "headline1": "Simple, Fair,",
    "headline2": "Aligned with You",
    "modelBadge": "Erfolgsbasiertes Modell",
    "cta": "Jetzt risikofrei starten",
    "ctaNote": "Keine Kreditkarte erforderlich • Kostenlose Registrierung",
    "features": {
      "item1": "Keine Fixkosten",
      "item2": "Keine Retainer",
      "item3": "Keine Überraschungen",
      "item4": "Sie zahlen nur, wenn Sie wirklich einstellen"
    },
    "trustFeatures": {
      "item1_text": "Automatisiertes Escrow",
      "item2_text": "Digitale Rechnungen",
      "item3_text": "Transparente Gebühren"
    }
  },
  "trustSecurity": {
    "eyebrow": "Trust & Security",
    "headline1": "Built for Enterprise.",
    "headline2": "Ready for Scale.",
    "subline": "Höchste Sicherheitsstandards für Ihre sensibelsten Recruiting-Daten.",
    "ctaPrivacy": "Mehr zum Datenschutz",
    "features": {
      "item1_title": "DSGVO-konform",
      "item1_description": "EU-Hosting, Auftragsverarbeitungsvertrag (AVV) inklusive",
      "item2_title": "Verschlüsselung",
      "item2_description": "Daten werden bei Übertragung und Speicherung verschlüsselt",
      "item3_title": "Identity Protection",
      "item3_description": "Triple-Blind Anonymisierung schützt alle Parteien",
      "item4_title": "Escrow Engine",
      "item4_description": "Sichere Zahlungsabwicklung mit Treuhandservice",
      "item5_title": "Audit Logs",
      "item5_description": "Lückenlose Dokumentation aller Aktivitäten",
      "item6_title": "EU Data Centers",
      "item6_description": "Daten werden ausschließlich in der EU gespeichert"
    }
  },
  "faq": {
    "eyebrow": "FAQ",
    "title": "Häufig gestellte Fragen",
    "subtitle": "Alles, was Sie wissen müssen, bevor Sie starten.",
    "faqs": {
      "item1_question": "Wie schnell bekomme ich Kandidaten?",
      "item1_answer": "In der Regel erhalten Sie innerhalb weniger Tage die ersten qualifizierten Kandidatenvorschläge. Unser Netzwerk verifizierter Recruiter arbeitet sofort nach Freischaltung Ihrer Stellenanzeige an passenden Matches.",
      "item2_question": "Wie sicher sind meine Daten und die der Kandidaten?",
      "item2_answer": "Wir sind DSGVO-konform: Alle Daten werden ausschließlich in EU-Rechenzentren gespeichert, bei Übertragung und Speicherung verschlüsselt, und ein Auftragsverarbeitungsvertrag (AVV) ist inklusive. Die Triple-Blind-Anonymisierung schützt zusätzlich alle Beteiligten.",
      "item3_question": "Was kostet die Nutzung der Plattform?",
      "item3_answer": "Unser Modell ist rein erfolgsbasiert – Sie zahlen nur bei erfolgreicher Einstellung. Keine Fixkosten, keine Retainer, keine versteckten Gebühren. Die genaue Provision wird transparent vor Beginn des Prozesses kommuniziert und über unser Escrow-System sicher abgewickelt.",
      "item4_question": "Was, wenn kein passender Kandidat dabei ist?",
      "item4_answer": "Sollten die vorgeschlagenen Kandidaten nicht Ihren Anforderungen entsprechen, entstehen Ihnen keine Kosten. Unser AI-Matching und die Performance-basierten Recruiter-Rankings sind darauf ausgelegt, nur wirklich passende Kandidaten vorzuschlagen. Bei Bedarf optimieren wir die Suchkriterien gemeinsam.",
      "item5_question": "Wie wird die Qualität der Kandidaten garantiert?",
      "item5_answer": "Qualität wird durch mehrere Mechanismen sichergestellt: AI-gestützte Match-Scores, verifizierte Recruiter mit Performance-Tracking, strukturierte Kandidatenprofile mit Skills-Assessment und transparentes Feedback-System. Nur Recruiter mit nachgewiesener Top-Performance erhalten Zugang zu Ihren Mandaten.",
      "item6_question": "Kann ich die Plattform mit meinem ATS integrieren?",
      "item6_answer": "Integrationen mit gängigen ATS-Systemen (z. B. Personio, Greenhouse, Lever) sind im Aufbau. Sprechen Sie uns an, welches System Sie nutzen – wir priorisieren Integrationen nach Bedarf unserer Kunden."
    }
  },
  "finalCta": {
    "badge": "Bringen Sie Praezision in Ihr Hiring",
    "headline1": "Starten Sie Ihr Hiring, als waere es",
    "headlineYearNew": "2030",
    "headline2": "Nicht, als waere es 2010.",
    "subline": "Die Zukunft des Recruitings ist hier. Und sie wartet nicht.",
    "ctaPrimary": "Job in 60 Sekunden posten",
    "reassurance": "Keine Kosten. Keine Bindung. Nur Ergebnisse."
  },
  "footer": {
    "tagline": "The Recruiting Operating System. Powered by AI. Delivered by Experts. Engineered for Results.",
    "colTitle_company": "Unternehmen",
    "colTitle_recruiter": "Recruiter",
    "colTitle_platform": "Plattform",
    "colTitle_info": "Info",
    "links_company_forCompanies": "Für Unternehmen",
    "links_company_pricing": "Pricing",
    "links_company_enterprise": "Enterprise",
    "links_recruiter_forRecruiters": "Für Recruiter",
    "links_recruiter_guides": "Guides",
    "links_recruiter_helpCenter": "Help Center",
    "links_platform_features": "Features",
    "links_platform_security": "Sicherheit",
    "links_platform_documentation": "Dokumentation",
    "links_info_about": "Über uns",
    "links_info_careers": "Karriere",
    "links_info_press": "Presse",
    "links_info_contact": "Kontakt",
    "copyright": "Matchunt - eine Marke der bluewater & Bridge GmbH. Alle Rechte vorbehalten.",
    "legal_privacy": "Datenschutz",
    "legal_terms": "AGB",
    "legal_imprint": "Impressum"
  },
  "bewerber": {
    "title": "Bewerber",
    "header": {
      "empty": "Noch keine aktiven Bewerber",
      "all_done": "Alles erledigt — {{count}} Bewerber in Arbeit",
      "your_turn_single": "1 Bewerber wartet auf Ihre Aktion · {{rest}} weitere in Arbeit",
      "your_turn_plural": "{{count}} Bewerber warten auf Ihre Aktion · {{rest}} weitere in Arbeit"
    },
    "sections": {
      "mine": "Sie sind am Zug",
      "others": "Wartet auf andere"
    },
    "state": {
      "wait_today": "Neu · heute",
      "wait_yesterday": "Seit gestern",
      "wait_days": "Seit {{days}} Tagen",
      "wait_warn": "Wartet seit {{days}} Tagen",
      "wait_crit": "Überfällig · {{days}} Tage",
      "pruefung": "In Prüfung durch Recruiter",
      "opted_in": "Hat zugestimmt — Termin wählen",
      "wartet_kandidat": "Wartet auf Kandidat",
      "terminvorschlag": "Neuer Terminvorschlag",
      "abgesagt": "Kandidat hat abgesagt",
      "termin_abgesagt": "Termin abgesagt",
      "no_show": "Termin nicht wahrgenommen",
      "geplant": "Interview · {{date}}",
      "feedback": "Feedback fällig · war {{date}}",
      "feedback_nodate": "Feedback fällig",
      "interview_phase": "Im Interviewprozess",
      "offer_prep": "Angebot in Vorbereitung",
      "offer_sent": "Angebot gesendet",
      "offer_viewed": "Angebot angesehen",
      "offer_negotiating": "Gegenvorschlag erhalten",
      "offer_rejected": "Angebot abgelehnt",
      "offer_expired": "Angebot abgelaufen",
      "offer_accepted": "Angebot angenommen"
    },
    "tabs": {
      "neu": "Neu",
      "pruefung": "In Prüfung",
      "interview": "Interview",
      "angebot": "Angebot",
      "alle": "Alle",
      "archiv": "Archiv"
    },
    "filter": {
      "search": "Suchen …",
      "all_jobs": "Alle Stellen"
    },
    "sort": {
      "newest": "Neueste zuerst",
      "match": "Beste Passung",
      "waiting": "Längste Wartezeit"
    },
    "loaded_hint": "{{loaded}} von {{total}} geladen",
    "select_prompt": "Wählen Sie links einen Bewerber aus",
    "card": {
      "no_role": "Profil ohne Rollenangabe"
    },
    "actions": {
      "request_interview": "Interview anfragen",
      "plan_interview": "Interview planen",
      "rerequest": "Neu anfragen",
      "review_proposal": "Vorschlag prüfen",
      "view_appointment": "Termin ansehen",
      "view_request": "Anfrage ansehen",
      "give_feedback": "Feedback geben",
      "view_interviews": "Interviews ansehen",
      "view_offer": "Angebot ansehen",
      "review_counter": "Gegenvorschlag prüfen",
      "reject": "Ablehnen",
      "ask_recruiter": "Rückfrage an Recruiter"
    },
    "notes": {
      "title": "Team-Notizen",
      "empty": "Noch keine Notizen.",
      "placeholder": "Notiz für Ihr Team schreiben …",
      "save": "Speichern",
      "save_error": "Die Notiz konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      "visibility": "Sichtbar für Ihr Team und Ihren Recruiter — nicht für den Kandidaten.",
      "author_you": "Sie",
      "author_member": "Teammitglied"
    },
    "chips": {
      "salary_locked": "Gehalt nach Zustimmung"
    },
    "ai": {
      "more": "Mehr anzeigen",
      "less": "Weniger anzeigen"
    },
    "skills": {
      "less": "Weniger anzeigen"
    },
    "detail": {
      "back": "Zurück zu Bewerbern",
      "unlocked_hint": "Profil freigegeben durch den Kandidaten · Kürzel {{code}}",
      "locked_hint": "Anonymes Profil — Name, Kontakt und Lebenslauf nach Interview-Zusage",
      "match": "{{score}} % Passung",
      "ctx": {
        "wait_new": "Neuer Vorschlag Ihres Recruiters — entscheiden Sie, ob Sie diesen Kandidaten kennenlernen möchten.",
        "wait_old": "Dieser Vorschlag wartet seit {{days}} Tagen auf Ihre Entscheidung.",
        "pruefung": "Ihr Recruiter klärt gerade offene Fragen zu diesem Kandidaten — Sie können trotzdem schon entscheiden.",
        "opted_in": "Der Kandidat hat zugestimmt und wartet auf Ihre Terminauswahl.",
        "wartet_kandidat": "Ihre Interview-Anfrage ist noch unbeantwortet — der Ball liegt beim Kandidaten.",
        "terminvorschlag": "Der Kandidat schlägt einen anderen Termin vor — bitte prüfen Sie den Vorschlag.",
        "geplant": "Das Interview ist bestätigt für {{date}}.",
        "feedback": "Das Interview fand am {{date}} statt — Ihr Feedback entscheidet den nächsten Schritt.",
        "feedback_nodate": "Das Interview ist vorbei — Ihr Feedback entscheidet den nächsten Schritt.",
        "abgesagt": "Der Kandidat hat den Termin abgesagt. Sie können neue Termine vorschlagen oder absagen.",
        "termin_abgesagt": "Der Termin wurde abgesagt. Sie können neue Termine vorschlagen.",
        "no_show": "Der Kandidat ist nicht erschienen. Sie können neu anfragen oder absagen.",
        "interview_phase": "Der Interviewprozess läuft — Details in der Interview-Agenda.",
        "offer_prep": "Bereiten Sie das Angebot vor — der Kandidat hat die Interviews durchlaufen.",
        "offer_sent": "Ihr Angebot ist beim Kandidaten — Entscheidung steht aus.",
        "offer_viewed": "Der Kandidat hat Ihr Angebot angesehen — Entscheidung steht aus.",
        "offer_negotiating": "Der Kandidat hat einen Gegenvorschlag gemacht — bitte prüfen.",
        "offer_rejected": "Der Kandidat hat das Angebot abgelehnt.",
        "offer_expired": "Das Angebot ist abgelaufen — Sie können ein neues senden.",
        "offer_accepted": "Der Kandidat hat das Angebot angenommen.",
        "archiv": "Diese Bewerbung ist abgeschlossen."
      },
      "agenda": "Zur Agenda",
      "cv_open": "Lebenslauf öffnen",
      "cv_locked": "Lebenslauf nach Interview-Zusage",
      "cv_missing": "Kein Lebenslauf hinterlegt — fragen Sie Ihren Recruiter",
      "profile": "Profil",
      "career": "Werdegang",
      "verlauf": "Verlauf",
      "verlauf_submitted": "Eingereicht von Ihrem Recruiter",
      "verlauf_iv_requested": "Interview angefragt",
      "verlauf_iv_scheduled": "Termin bestätigt · {{time}} Uhr",
      "verlauf_iv_completed": "Interview durchgeführt",
      "verlauf_iv_cancelled": "Termin abgesagt",
      "verlauf_iv_declined": "Kandidat hat abgesagt",
      "verlauf_iv_pending": "Wartet auf Antwort des Kandidaten",
      "verlauf_offer_created": "Angebot erstellt",
      "verlauf_offer_sent": "Angebot versendet",
      "branchen": "Branchen",
      "zielrollen": "Zielrollen",
      "karriereziele": "Karriereziele",
      "sprachen": "Sprachen",
      "zertifikate": "Zertifikate",
      "companies_after_optin": "Firmennamen nach Interview-Zusage",
      "readonly": "Nur Lesezugriff"
    },
    "identity_unlocked": "Identität freigegeben",
    "error": {
      "load": "Die Bewerber konnten nicht geladen werden.",
      "retry": "Erneut versuchen"
    },
    "empty": {
      "search_title": "Keine Treffer für „{{query}}“",
      "search_text": "Prüfen Sie den Suchbegriff oder setzen Sie die Suche zurück.",
      "neu_title": "Alles entschieden",
      "neu_text": "Neue Bewerber erscheinen hier, sobald Ihr Recruiter Kandidaten einreicht. Sie werden per E-Mail benachrichtigt.",
      "pruefung_title": "Niemand in Prüfung",
      "pruefung_text": "Bewerber landen hier, während Ihr Recruiter offene Fragen klärt — bevor Sie entscheiden.",
      "interview_title": "Noch kein Interview geplant",
      "interview_text": "Sobald Sie bei einem neuen Bewerber „Interview anfragen“ wählen, sehen Sie hier Termin und Status.",
      "angebot_title": "Noch kein Angebot unterwegs",
      "angebot_text": "Wenn Sie einem Kandidaten nach den Interviews ein Angebot machen, verfolgen Sie hier den Status bis zur Zusage.",
      "archiv_title": "Das Archiv ist leer",
      "archiv_text": "Abgelehnte, eingestellte und zurückgezogene Bewerber landen hier — nichts geht verloren.",
      "alle_title": "Noch keine Bewerber",
      "alle_text": "Ihr Recruiter sucht passende Kandidaten. Neue Vorschläge erscheinen hier."
    },
    "archive": {
      "kind": {
        "abgelehnt": "Abgelehnt",
        "eingestellt": "Eingestellt",
        "zurueckgezogen": "Zurückgezogen",
        "abgelaufen": "Abgelaufen"
      },
      "closed_info": "Diese Bewerbung ist abgeschlossen.",
      "hired_info": "Dieser Kandidat wurde über Matchunt eingestellt.",
      "view_placement": "Placement ansehen",
      "retention_hint": "Archivierte Bewerbungen werden gemäß Aufbewahrungsrichtlinie gelöscht."
    }
  },
  "jobdetail": {
    "back": "Zurück zur Übersicht",
    "not_found": "Job nicht gefunden",
    "error_load": "Fehler beim Laden",
    "error_save": "Speichern fehlgeschlagen — Sie haben dafür möglicherweise keine Berechtigung.",
    "bewerber_error": "Bewerber konnten nicht geladen werden.",
    "toast": {
      "paused": "Stelle pausiert",
      "resumed": "Stelle reaktiviert"
    },
    "state": {
      "aktiv": "Aktiv",
      "pausiert": "Pausiert",
      "geschlossen": "Geschlossen",
      "besetzt": "Besetzt"
    },
    "meta": {
      "live_today": "Seit heute live",
      "live_since_one": "Live seit 1 Tag",
      "live_since": "Live seit {{days}} Tagen",
      "paused_since": "Pausiert seit {{date}}"
    },
    "employment": {
      "full-time": "Vollzeit",
      "part-time": "Teilzeit",
      "contract": "Befristet",
      "freelance": "Freelance",
      "internship": "Praktikum"
    },
    "remote": {
      "remote": "Remote",
      "hybrid": "Hybrid",
      "onsite": "Vor Ort"
    },
    "banner": {
      "pausiert": "Pausiert seit {{date}} — Recruiter sehen diese Stelle nicht. Laufende Bewerbungen bleiben aktiv.",
      "ueberfaellig_single": "Überfällig: Ein Bewerber wartet seit über 21 Tagen auf Ihre Entscheidung.",
      "ueberfaellig_plural": "Überfällig: {{count}} Bewerber warten seit über 21 Tagen auf Ihre Entscheidung.",
      "dringend_single": "Ein Bewerber braucht dringend Ihre Entscheidung.",
      "dringend_plural": "{{count}} Bewerber brauchen dringend Ihre Entscheidung.",
      "feedback_single": "Interview war am {{date}} — Ihr Feedback fehlt.",
      "feedback_single_nodate": "Ein Interview wartet auf Ihr Feedback.",
      "feedback_plural": "{{count}} Interviews warten auf Ihr Feedback.",
      "antwort_single": "Ein Kandidat wartet auf Ihre Antwort.",
      "antwort_plural": "{{count}} Kandidaten warten auf Ihre Antwort.",
      "aktion_single": "Ein neuer Vorschlag wartet auf Ihre Prüfung.",
      "aktion_plural": "{{count}} Vorschläge warten auf Ihre Prüfung.",
      "leer_lang": "Seit {{days}} Tagen live, noch kein Vorschlag. Häufigste Ursache: zu enges Gehaltsband oder zu strenge Muss-Kriterien.",
      "frisch": "Ihre Stelle ist live — Recruiter suchen passende Kandidaten. Neue Vorschläge erscheinen hier zuerst.",
      "laeuft_heute": "Alles in Arbeit — nichts zu tun. Letzter Vorschlag heute.",
      "laeuft_one": "Alles in Arbeit — nichts zu tun. Letzter Vorschlag gestern.",
      "laeuft": "Alles in Arbeit — nichts zu tun. Letzter Vorschlag vor {{days}} Tagen.",
      "laeuft_zaeh": "Seit {{days}} Tagen keine Bewegung. Häufigste Ursache: zu enges Gehaltsband oder zu strenge Muss-Kriterien.",
      "laeuft_stockt": "Seit {{days}} Tagen steht die Suche. Bitte entscheiden Sie: Kriterien lockern, Budget anheben oder Stelle schließen.",
      "geschlossen": "Diese Stelle ist geschlossen — Recruiter sehen sie nicht mehr.",
      "besetzt": "Diese Stelle ist besetzt — die Suche ist abgeschlossen."
    },
    "banner_action": {
      "entscheiden": "Jetzt entscheiden",
      "feedback": "Feedback geben",
      "antworten": "Antworten",
      "pruefen": "Jetzt prüfen",
      "briefing": "Briefing schärfen",
      "reaktivieren": "Reaktivieren"
    },
    "funnel": {
      "hint": "Punkt = wartet auf Sie · Klick öffnet die Bewerber-Inbox, gefiltert auf diese Stelle",
      "hired": "{{count}} eingestellt"
    },
    "wait": {
      "title": "Wartet auf Sie",
      "open_inbox": "In der Inbox öffnen",
      "match": "Passung",
      "more": "+{{count}} weitere in der Inbox"
    },
    "actions": {
      "edit": "Bearbeiten",
      "pause": "Pausieren",
      "resume": "Reaktivieren",
      "invite": "Fachbereich einladen"
    },
    "termine": {
      "title": "Termine & Feedback",
      "all": "Alle Interviews",
      "feedback": "Feedback fällig: {{name}} — Interview war am {{date}}",
      "feedback_nodate": "Feedback fällig: {{name}}",
      "counter": "Terminvorschlag von {{name}} — bitte antworten",
      "next": "Nächstes Interview: {{date}} — {{name}}",
      "waiting": "Einladung an {{name}} — Antwort steht aus",
      "more": "+{{count}} weitere Termine"
    },
    "sections": {
      "stelle": "Stellendetails",
      "konditionen": "Konditionen & Anonymität",
      "team": "Team & Zugriff",
      "verlauf": "Verlauf",
      "verwalten": "Verwalten"
    },
    "stelle": {
      "standort": "Standort",
      "anstellung": "Anstellung",
      "branche": "Branche",
      "onsite_days": "{{count}} Tage vor Ort",
      "muss": "Muss-Kriterien",
      "wunsch": "Wünschenswert",
      "beschreibung": "Beschreibung",
      "mehr": "Mehr anzeigen",
      "weniger": "Weniger anzeigen",
      "edit": "Stellendetails bearbeiten"
    },
    "konditionen": {
      "salary": "Gehaltsband",
      "fee": "Honorar",
      "fee_value": "{{pct}} % vom Zieljahresgehalt — fällig erst bei Einstellung",
      "fee_hint": "Nur für Owner, Admin & Finance sichtbar",
      "reveal": "Identitäts-Freigabe",
      "reveal_opt_in": "Nach Zustimmung des Kandidaten (Opt-in)",
      "reveal_offer": "Erst beim Angebot",
      "reveal_interview": "Nach dem 1. Interview",
      "preview_title": "So sehen Recruiter Ihre Firma",
      "preview_empty": "Anonymer Firmen-Descriptor noch offen",
      "preview_hint": "Ihr Firmenname bleibt verborgen, bis Sie ihn freigeben."
    },
    "team": {
      "empty": "Noch keine Team-Mitglieder mit Zugriff auf diese Stelle.",
      "pending": "· eingeladen"
    },
    "verlauf": {
      "empty": "Noch keine Ereignisse.",
      "published": "Stelle veröffentlicht",
      "vorschlag": "Neuer Vorschlag: {{name}}",
      "interview": "Interview vereinbart: {{name}}, {{date}}",
      "pausiert": "Stelle pausiert",
      "geschlossen": "Stelle geschlossen"
    },
    "verwalten": {
      "hint": "Pausieren und Schließen erklären zuerst die Konsequenz — nichts passiert ohne Bestätigung.",
      "cancel": "Abbrechen",
      "pause_title": "Stelle pausieren?",
      "pause_text": "Recruiter sehen die Stelle nicht mehr und schlagen keine neuen Kandidaten vor. Laufende Bewerbungen und Termine bleiben aktiv. Sie können jederzeit reaktivieren.",
      "close": "Stelle schließen",
      "close_title": "Stelle schließen?",
      "close_text": "Die Suche wird beendet und Recruiter sehen die Stelle nicht mehr. Laufende Bewerbungen bleiben für Sie einsehbar.",
      "close_reason": "Grund",
      "close_reason_placeholder": "Grund auswählen…",
      "close_pause_hint": "Nur vorübergehend? Dann ist Pausieren die bessere Wahl.",
      "close_confirm": "Stelle schließen",
      "reason_filled_matchunt": "Über Matchunt besetzt",
      "reason_filled_elsewhere": "Anderweitig besetzt",
      "reason_on_hold": "Stelle vorerst auf Eis",
      "reason_cancelled": "Stelle entfällt"
    },
    "toast_closed": "Stelle geschlossen"
  },
  "terminsheet": {
    "pill": {
      "counter": "Gegenvorschlag",
      "awaiting": "Wartet auf Antwort",
      "expired": "Slots abgelaufen",
      "scheduled": "Termin bestätigt",
      "requested": "Termin angefragt",
      "feedback": "Feedback fällig",
      "declined": "Vom Kandidaten abgesagt",
      "cancelled": "Abgesagt",
      "no_show": "Nicht erschienen",
      "completed": "Abgeschlossen"
    },
    "ctx_counter": "Ihre Slots passten nicht — der Kandidat schlägt Alternativen vor. Sie sind am Zug.",
    "ctx_awaiting": "Eingeladen vor {{time}} — der Kandidat hat noch nicht geantwortet.",
    "ctx_awaiting_expired": "Eingeladen vor {{time}} — keine Antwort. Alle vorgeschlagenen Termine liegen inzwischen in der Vergangenheit.",
    "ctx_scheduled": "Der Termin ist bestätigt.",
    "ctx_requested": "Termin angefragt — die Bestätigung steht noch aus.",
    "ctx_feedback": "Das Interview war am {{date}} — Ihr Feedback fehlt noch.",
    "ctx_declined": "Der Kandidat hat die Interview-Anfrage abgesagt.",
    "ctx_cancelled": "Dieses Interview wurde abgesagt.",
    "ctx_no_show": "Der Kandidat ist nicht erschienen.",
    "ctx_completed": "Dieses Interview ist abgeschlossen.",
    "slots_title": "Vorgeschlagene Termine",
    "counter_title": "Vorschläge des Kandidaten",
    "expired_tag": "abgelaufen",
    "duration": "{{min}} Min.",
    "meeting_video": "Video-Call",
    "meeting_phone": "Telefon",
    "meeting_onsite": "Vor Ort",
    "join": "Beitreten",
    "msg": "Nachricht des Kandidaten",
    "notes": "Notizen",
    "feedback_title": "Ihr Feedback",
    "actions": {
      "new_slots": "Neue Slots vorschlagen",
      "remind": "Erinnern",
      "withdraw": "Anfrage zurückziehen",
      "respond": "Vorschlag beantworten",
      "reschedule": "Verschieben",
      "cancel": "Termin absagen",
      "edit": "Termin bearbeiten",
      "feedback": "Feedback geben",
      "profile": "Zum Bewerberprofil"
    }
  },
  "recruiterInterviews": {
    "title": "Interviews",
    "subtitle": "Alle Termine deiner Kandidaten — bestätigt, offen und nachzubereiten",
    "stats": {
      "today": "Heute",
      "week": "Diese Woche",
      "unconfirmed": "Unbestätigt",
      "awaiting": "Ohne Termin",
      "debrief": "Debrief fällig"
    },
    "next_up": "Nächster Termin · {{time}}",
    "open_submission": "Einreichung öffnen",
    "sections": {
      "counter": "Gegenvorschlag liegt vor ({{count}})",
      "debrief": "Debrief fällig ({{count}})",
      "awaiting": "Warten auf Terminierung ({{count}})",
      "cancelled": "Abgesagt und nicht erschienen ({{count}})",
      "past": "Vergangene Interviews ({{count}})"
    },
    "empty": "Keine anstehenden Interviews — reiche Kandidaten ein oder fasse offene Einreichungen nach.",
    "cancel_hint": "{{percent}} % deiner Interviews kommen nicht zustande. Ein Blick auf die Gründe zeigt, wo du früher eingreifen kannst.",
    "row": {
      "duration": "{{min}} Min.",
      "unconfirmed": "unbestätigt",
      "slots_expired": "Slots abgelaufen",
      "counter": "Gegenvorschlag",
      "no_show": "nicht erschienen",
      "cancelled": "abgesagt",
      "waiting_since": "Wartet seit {{time}}",
      "join": "Beitreten"
    }
  },
  "recruiterTermin": {
    "pill": {
      "scheduled": "Bestätigt",
      "unconfirmed": "Unbestätigt",
      "awaiting": "Wartet auf Terminwahl",
      "expired": "Termine verstrichen",
      "counter": "Gegenvorschlag",
      "debrief": "Debrief fällig",
      "cancelled": "Abgesagt",
      "no_show": "Nicht erschienen",
      "done": "Abgeschlossen"
    },
    "ctx": {
      "scheduled": "Der Termin steht. Halte deinen Kandidaten warm und erinnere ihn kurz vorher.",
      "unconfirmed": "Der Termin ist noch nicht bestätigt. Kläre mit deinem Kandidaten, ob er kann.",
      "awaiting": "Dein Kandidat hat die Termine seit {{time}} nicht gewählt. Ein Anruf bringt mehr als eine weitere Mail.",
      "expired": "Alle vorgeschlagenen Termine sind verstrichen. Neue Termine kann nur der Kunde schicken — erreiche zuerst deinen Kandidaten.",
      "counter": "Es liegt ein Alternativtermin vor. Über die Annahme entscheidet der Kunde — sorge dafür, dass dein Kandidat verfügbar bleibt.",
      "debrief": "Das Interview vom {{date}} ist gelaufen, dein Eindruck fehlt noch. Frisch ist er am wertvollsten.",
      "cancelled": "Der Termin wurde abgesagt. Prüfe, ob der Prozess weiterläuft oder du den Fall schliessen solltest.",
      "no_show": "Zum Termin ist niemand erschienen. Kläre mit deinem Kandidaten, was passiert ist.",
      "done": "Der Termin ist abgeschlossen."
    },
    "meeting": {
      "video": "Videocall",
      "phone": "Telefon",
      "onsite": "Vor Ort"
    },
    "duration": "{{min}} Min.",
    "no_address": "Keine Adresse hinterlegt — dein Kandidat weiss nicht, wo er hin soll.",
    "slots_title": "Vorgeschlagene Termine",
    "expired_tag": "verstrichen",
    "counter_title": "Alternativtermin",
    "cancel_title": "Grund",
    "no_show_by": {
      "candidate": "Kandidat nicht erschienen",
      "client": "Kunde nicht erschienen",
      "technical": "Technisches Problem",
      "unknown": "Kein Grund hinterlegt"
    },
    "msg": "Nachricht deines Kandidaten",
    "notes": "Notizen zum Termin",
    "client_feedback": "Rückmeldung des Kunden",
    "debrief_title": "Dein Eindruck",
    "debrief_placeholder": "Wie ist das Gespräch gelaufen? Was hält den Kandidaten, was bremst ihn?",
    "debrief_save": "Eindruck festhalten",
    "debrief_update": "Eindruck aktualisieren",
    "recommendation": {
      "next_round": "Weiter",
      "hire": "Einstellen",
      "undecided": "Unklar",
      "reject": "Raus"
    },
    "fee": "Dein Honorar bei Abschluss: ~{{amount}}k €",
    "action": {
      "join": "Meeting beitreten",
      "call": "Kandidat anrufen",
      "mail": "Kandidat anschreiben",
      "call_short": "Anrufen",
      "mail_short": "Mail",
      "submission": "Einreichung",
      "candidate": "Profil"
    }
  }
};

export default de;
