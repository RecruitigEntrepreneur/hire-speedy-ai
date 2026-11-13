// Fragenkatalog der Kundenaufnahme in der Sprache des Lesers (nur Anzeige).
// Wortgleich mit src/lib/briefCatalog.ts und BenefitsBlock.tsx: der deutsche Wortlaut steht dort
// und ist zugleich Speicherwert. Diese Datei muss wortgleich sein (briefCatalogText.test.ts).
// Schlüssel: siehe src/lib/briefCatalogText.ts.
const de = {
  q: {
    firmengroesse: {
      text: 'Wie viele Mitarbeiter beschäftigen Sie aktuell?',
      why: 'Der Kandidat fragt es im ersten Gespräch, und der Recruiter braucht es für die Ansprache.',
      chapter: 'Unternehmen',
    },
    verguetung: {
      text: 'In was für eine Range befindet sich das Fixgehalt?',
      why: 'Ohne Band kann kein Recruiter ansprechen — es ist die erste Frage jedes Kandidaten.',
      chapter: 'Vergütung',
    },
    kriterien: {
      text: 'Welche 3 Kriterien muss der Kandidat erfüllen, damit Sie ihn direkt produktiv einsetzen können und 100 % kennenlernen wollen?',
      kurz: 'Wie hart ist jedes dieser Kriterien?',
      intro: 'Basierend auf dem, was wir gerade besprochen haben in Bezug auf Arbeitsalltag und Herausforderungen:',
      why: 'Macht aus einer Wunschliste eine Suchvorgabe. Alles andere ist verhandelbar.',
      chapter: 'Skills',
    },
    team: {
      text: 'Wie strukturiert sich die Abteilung von der Position?',
      textFreelance: 'Wie ist das Projektteam aufgestellt, und wer arbeitet noch extern mit?',
      why: 'Ein Alleinkämpfer-Job braucht einen anderen Menschen als eine Rolle im 15er-Team.',
      chapter: 'Eckdaten',
    },
    arbeitszeit: {
      text: 'Wie gestalten sich die Arbeitszeiten (Kernarbeitszeit) im Unternehmen? Wie gehen Sie mit Homeoffice und Überstunden um?',
      textFreelance: 'Wie frei teilt sich die Person die Zeit ein — und wie weisen Sie die Leistung nach?',
      why: 'Der häufigste Absagegrund im Endspurt — Kandidaten fragen früh danach.',
      chapter: 'Arbeitszeit & Prozess',
    },
    gremien: {
      text: 'Existiert in Ihrem Unternehmen ein Betriebsrat? (Falls ja, wann tagt dieser Betriebsrat?)',
      why: 'Bestimmt die Dauer bis zur Zusage stärker als jeder andere Prozessschritt.',
      chapter: 'Arbeitszeit & Prozess',
    },
    vertragstempo: {
      text: 'Wie lange benötigen Sie für die Erstellung des Vertrags? (Wird dieser digital versendet?)',
      why: 'Zwischen Zusage und Vertrag verliert man Kandidaten an schnellere Wettbewerber.',
      chapter: 'Arbeitszeit & Prozess',
    },
    arbeitserlaubnis: {
      text: 'Braucht der Kandidat eine Arbeitserlaubnis, oder unterstützen Sie ein Visum?',
      why: 'Ein K.-o.-Kriterium: ohne die Antwort spricht der Recruiter Kandidaten an, die nicht anfangen dürfen.',
      chapter: 'Arbeitszeit & Prozess',
    },
    abwerbeschutz: {
      text: 'Bei welchen Unternehmen dürfen wir auf keinen Fall abwerben?',
      why: 'Wer beim Kunden des Kunden abwirbt, beschädigt die Geschäftsbeziehung. Nur der Recruiter sieht das, erst wenn er sucht.',
      chapter: 'Arbeitszeit & Prozess',
    },
    vakanz: {
      text: 'Warum ist die Stelle vakant? Bis wann muss sie besetzt sein und welche negativen Auswirkungen könnte es haben, falls sie länger offenbleibt?',
      textFreelance: 'Warum brauchen Sie die Kapazität von außen? Ab wann — und was passiert, wenn niemand da ist?',
      why: 'Bestimmt Story, Dringlichkeit und Risiko — und steht in keiner Anzeige.',
      chapter: 'Timing & Vertrag',
    },
    alltag: {
      text: 'Können Sie mir ein Bild des Arbeitsalltags des Kandidaten malen?',
      why: 'Der Recruiter erzählt diesen Alltag im Kandidatengespräch. Ohne ihn bleibt die Rolle abstrakt.',
      chapter: 'Rolle & Scope',
    },
    entscheidung: {
      text: 'An wen berichtet der Kandidat und ist jemand außer Ihnen in den finalen Entscheidungsprozess involviert?',
      why: 'Wer das weiß, argumentiert im Gespräch auf die richtige Person hin.',
      chapter: 'Prozess & Entscheider',
    },
    auswahlprozess: {
      text: 'Wie läuft Ihr Auswahlprozess ab: wie viele Gespräche, mit wem, gibt es eine Fallstudie oder einen Probetag?',
      why: 'Kandidaten fragen das im ersten Gespräch. Wer den Ablauf kennt, springt seltener ab.',
      chapter: 'Prozess & Entscheider',
    },
    passung: {
      text: 'Welche Art Mensch hat langfristig Erfolg bei Ihnen im Unternehmen, oder einfacher gesagt: wer hatte in der Vergangenheit keinen Erfolg?',
      textFreelance: 'Was macht einen Externen bei Ihnen erfolgreich — und woran ist schon einer gescheitert?',
      why: 'Beschreibt den Menschen, nach dem gesucht wird — und erspart Gespräche, die nicht enden können.',
      chapter: 'Arbeitsmodell & Kultur',
    },
    sourcing: {
      text: 'Aus welchen Unternehmen kommen gute Kandidaten für diese Rolle typischerweise?',
      why: 'Hier sucht Ihr Headhunter zuerst. Nur er sieht das, und erst wenn er für Sie sucht.',
      chapter: 'Sourcing',
    },
    usp: {
      text: 'Welche Alleinstellungsmerkmale können Sie als Unternehmen anbieten und welche Vorteile bietet die Position selbst, die möglicherweise nur ein Experte zu schätzen weiß, wie zum Beispiel keine Kaltakquise bei Vertriebspositionen?',
      textFreelance: 'Was macht dieses Projekt attraktiv — Technik, Referenz, oder die Aussicht auf Anschluss?',
      why: 'Das Argument, mit dem der Recruiter jemanden überzeugt, der gar nicht sucht.',
      chapter: 'Sell & Story (EVP)',
    },
    kultur: {
      text: 'Wie beschreiben Sie Ihre Unternehmenskultur?',
      textFreelance: 'Wie arbeitet man bei Ihnen zusammen — worauf sollte sich ein Externer einstellen?',
      why: 'Der Recruiter muss sie glaubhaft schildern, ohne die Firma zu nennen.',
      chapter: 'Arbeitsmodell & Kultur',
    },
    foerderung: {
      text: 'Welche konkreten Schritte unternehmen Sie im Unternehmen, um Mitarbeiter zu fördern, insbesondere in Bezug auf Gehaltsentwicklung und Karrierechancen?',
      why: 'Ohne Antwort wirkt die Stelle als Sackgasse.',
      chapter: 'Sell & Story (EVP)',
    },
    vertrag: {
      text: 'Wie ist der Arbeitsvertrag gestaltet? Gibt es möglicherweise Themen darin, die sensibel sind oder die Kandidaten abschrecken könnten?',
      textFreelance: 'Wie ist der Dienstvertrag gestaltet? Gibt es Klauseln, die Freiberufler abschrecken?',
      why: 'Besser der Recruiter weiß es vorher, als der Kandidat springt beim Unterschreiben ab.',
      chapter: 'Timing & Vertrag',
    },
    einwaende: {
      text: 'Was würde ein Kandidat an der Stelle kritisch sehen, und was antworten Sie darauf?',
      why: 'Wer die Einwände vorher kennt, verliert Kandidaten nicht erst beim Angebot.',
      chapter: 'Timing & Vertrag',
    },
    branche: {
      text: 'Was läuft aktuell gut in Ihrer Branche? Mit welchen Herausforderungen sind Sie aktuell in Ihrer Branche konfrontiert?',
      why: 'Das Argument, mit dem der Recruiter einen zufriedenen Kandidaten überhaupt erreicht.',
      chapter: 'Sell & Story (EVP)',
    },
    pipeline: {
      text: 'Wie viele Kandidaten haben Sie aktuell im Prozess, bzw. hatten im Prozess? Sind bei Ihnen in der Angebotsphase schon einmal Kandidaten abgesprungen? Falls ja, warum?',
      why: 'Sagt dem Recruiter, gegen wen er antritt und welchen Einwand er vorwegnehmen muss.',
      chapter: 'Risiken & Ehrlichkeit',
    },
  },
  slot: {
    company_headcount: {
      label: 'Mitarbeitende',
    },
    company_size_band: {
      label: 'Größenklasse',
    },
    salary_range: {
      label: 'Gehalt von / bis (€)',
    },
    day_rate_range: {
      label: 'Budget je Tag, alles inklusive (€)',
    },
    contract_duration_months: {
      label: 'Laufzeit (Monate)',
    },
    utilization_days_per_week: {
      label: 'Auslastung (Tage pro Woche)',
    },
    extension_possible: {
      label: 'Verlängerung möglich',
    },
    salary_months: {
      label: 'Wie viele Monatsgehälter gibt es?',
    },
    bonus_structure: {
      label: 'Gibt es einen Bonus?',
    },
    bonus_basis: {
      label: 'Wovon hängt er ab?',
    },
    salary_flex: {
      label: 'Wie viel Spielraum haben Sie beim Gehalt für den richtigen Kandidaten?',
    },
    must_have_criteria: {
      label: 'Die drei, ohne die es nicht geht',
    },
    trainable_skills: {
      label: 'Was kann nachgeschult werden?',
    },
    department_structure: {
      label: 'Aufbau der Abteilung',
    },
    team_size: {
      label: 'Teamgröße',
      placeholder: 'Anzahl Personen',
    },
    remote_days: {
      label: 'Homeoffice-Tage pro Woche',
      labelFreelance: 'Tage remote pro Woche',
    },
    contract_limitation: {
      label: 'Ist der Vertrag unbefristet?',
    },
    core_hours: {
      label: 'Kernarbeitszeit',
      labelFreelance: 'Anwesenheit',
    },
    core_hours_detail: {
      label: 'Von wann bis wann?',
      labelFreelance: 'Welche Zeiten genau?',
      placeholder: 'z. B. 09:00–15:00',
    },
    overtime_policy: {
      label: 'Überstunden werden …',
    },
    time_tracking_method: {
      label: 'Wie wird die Zeit erfasst in Ihrem Unternehmen?',
      labelFreelance: 'Wie wird die Leistung nachgewiesen?',
    },
    works_council: {
      label: 'Betriebsrat',
    },
    works_council_meeting_schedule: {
      label: 'Wann tagt er?',
    },
    contract_creation_days: {
      label: 'Vom Ja bis zum Vertrag (Tage)',
      placeholder: 'z. B. 7',
    },
    contract_sent_digitally: {
      label: 'Wird dieser digital versendet?',
    },
    visa_sponsorship: {
      label: 'Arbeitserlaubnis oder Visum',
    },
    nogo_companies: {
      label: 'Nicht abwerben bei',
      placeholder: 'Firmenname eingeben',
    },
    vacancy_reason: {
      label: 'Warum vakant',
      labelFreelance: 'Warum von außen',
    },
    hiring_deadline: {
      label: 'Bis wann besetzt',
    },
    negative_impact_if_unfilled: {
      label: 'Negative Auswirkungen bei Verzug',
    },
    max_notice_period: {
      label: 'Welche Kündigungsfrist können Sie höchstens abwarten?',
    },
    daily_routine: {
      label: 'Der Arbeitsalltag',
    },
    task_focus: {
      label: 'Was ist der Schwerpunkt der Position?',
    },
    task_breakdown: {
      label: 'Wie ist die prozentuale Gewichtung der Aufgaben?',
    },
    reports_to: {
      label: 'Berichtet an',
    },
    decision_makers: {
      label: 'Außerdem in der finalen Entscheidung',
    },
    interview_process: {
      label: 'Der Auswahlprozess',
    },
    success_profile: {
      label: 'Hat langfristig Erfolg',
      labelFreelance: 'Liefert bei uns',
    },
    failure_profile: {
      label: 'Hatte keinen Erfolg',
      labelFreelance: 'Hat bei uns nicht funktioniert',
    },
    target_companies: {
      label: 'Gute Kandidaten kommen aus',
      placeholder: 'Firmenname eingeben',
    },
    unique_selling_points: {
      label: 'Alleinstellungsmerkmale des Unternehmens',
      labelFreelance: 'Was das Projekt attraktiv macht',
    },
    position_advantages: {
      label: 'Vorteile der Position, die nur ein Experte schätzt',
      labelFreelance: 'Was nur ein Fachmann zu schätzen weiß',
    },
    company_culture: {
      label: 'Unternehmenskultur',
      labelFreelance: 'Zusammenarbeit im Projekt',
    },
    career_path: {
      label: 'Konkrete Schritte',
    },
    career_example: {
      label: 'Geben Sie mir doch bitte hierzu ein konkretes Beispiel!',
    },
    contract_sensitive_topics: {
      label: 'Sensible Themen',
    },
    candidate_concerns: {
      label: 'Was kritisch gesehen wird',
      placeholder: 'Eigenen Punkt eingeben',
    },
    candidate_concerns_answer: {
      label: 'Ihre Antwort darauf',
      placeholder: 'z. B. Gleitzeit ohne Kernzeit gleicht die Präsenz aus',
    },
    industry_opportunities: {
      label: 'Was läuft gut',
    },
    industry_challenges: {
      label: 'Herausforderungen',
    },
    candidates_in_pipeline: {
      label: 'Aktuell im Prozess',
    },
    candidates_dropped_reason: {
      label: 'Absprünge in der Angebotsphase',
    },
  },
  chips: {
    company_size_band: {
      c0: 'bis 50',
      c1: '50–250',
      c2: '250–1.000',
      c3: '1.000–5.000',
      c4: 'mehr als 5.000',
    },
    extension_possible: {
      c0: 'Ja',
      c1: 'Nein',
    },
    salary_months: {
      c0: '12',
      c1: '12 + Urlaubsgeld',
      c2: '13',
      c3: '13,5',
      c4: '14',
    },
    bonus_structure: {
      c0: 'Nein',
      c1: 'bis 10 %',
      c2: 'bis 20 %',
      c3: 'mehr als 20 %',
    },
    bonus_basis: {
      c0: 'Unternehmensergebnis',
      c1: 'Persönliche Ziele',
      c2: 'Teamziele',
      c3: 'Umsatz',
    },
    salary_flex: {
      c0: 'Keiner, die Range ist fest',
      c1: 'bis 5 % darüber',
      c2: 'bis 10 % darüber',
      c3: 'verhandelbar',
    },
    remote_days: {
      c0: '0',
      c1: '1',
      c2: '2',
      c3: '3',
      c4: '4',
      c5: '5',
      c6: 'frei wählbar',
    },
    contract_limitation: {
      c0: 'Unbefristet',
      c1: 'Befristet mit Aussicht',
      c2: 'Befristet',
      c3: 'Projektvertrag',
    },
    core_hours: {
      c0: 'Gleitzeit ohne Kernzeit',
      c1: 'Gleitzeit mit Kernzeit',
      c2: 'Feste Arbeitszeiten',
      c3: 'Vertrauensarbeitszeit',
      c4: 'Schichtbetrieb',
    },
    overtime_policy: {
      c0: 'ausgeglichen (Freizeit)',
      c1: 'ausgezahlt',
      c2: 'mit dem Gehalt abgegolten',
      c3: 'fallen kaum an',
    },
    time_tracking_method: {
      c0: 'digital',
      c1: 'selbst aufgeschrieben',
      c2: 'Stempeluhr',
      c3: 'gar nicht',
    },
    works_council: {
      c0: 'Ja',
      c1: 'Nein',
    },
    works_council_meeting_schedule: {
      c0: 'Wöchentlich',
      c1: 'Alle zwei Wochen',
      c2: 'Monatlich',
      c3: 'Nach Bedarf',
    },
    contract_sent_digitally: {
      c0: 'Ja',
      c1: 'Nein',
    },
    visa_sponsorship: {
      c0: 'Arbeitserlaubnis für Deutschland nötig',
      c1: 'Visum unterstützen wir',
    },
    nogo_companies: {
      c0: 'Unsere Kunden',
      c1: 'Unsere Lieferanten',
      c2: 'Konzerngesellschaften',
      c3: 'Keine Einschränkung',
    },
    vacancy_reason: {
      c0: 'Wachstum / neu geschaffen',
      c1: 'Nachbesetzung',
      c2: 'Ablösung',
      c3: 'Elternzeit-Vertretung',
      c4: 'Nachfolge / Ruhestand',
    },
    hiring_deadline: {
      c0: 'So schnell wie möglich',
      c1: 'In 1–3 Monaten',
      c2: 'In 3–6 Monaten',
      c3: 'Zeitlich flexibel',
    },
    negative_impact_if_unfilled: {
      c0: 'Die Arbeit bleibt am Team hängen',
      c1: 'Wir zahlen extern dazu',
      c2: 'Projekte verzögern sich',
      c3: 'Das Team ist ohne Leitung',
      c4: 'Abschlüsse geraten in Verzug',
    },
    max_notice_period: {
      c0: '1 Monat',
      c1: '3 Monate',
      c2: '6 Monate',
      c3: 'egal',
    },
    daily_routine: {
      c0: 'Feste Routine am Morgen',
      c1: 'Wechsel zwischen Projekt und Tagesgeschäft',
      c2: 'Viel Abstimmung im Team',
      c3: 'Termine außer Haus',
      c4: 'Störungen bestimmen den Tag',
    },
    task_focus: {
      c0: 'Operativ / hands-on',
      c1: 'Steuernd / koordinierend',
      c2: 'Aufbauend / verändernd',
      c3: 'Führend / entwickelnd',
    },
    task_breakdown: {
      c0: 'Überwiegend operativ',
      c1: 'Überwiegend Steuerung',
      c2: 'Halb Projekt, halb Tagesgeschäft',
      c3: 'Ein Drittel Abstimmung',
    },
    reports_to: {
      c0: 'Geschäftsführung',
      c1: 'Bereichsleitung',
      c2: 'Abteilungsleitung',
      c3: 'Teamleitung',
    },
    decision_makers: {
      c0: 'Niemand — ich entscheide',
      c1: 'Geschäftsführung',
      c2: 'HR',
      c3: 'Fachbereich',
      c4: 'Das Team',
    },
    interview_process: {
      c0: 'Erstgespräch HR',
      c1: 'Zweitgespräch Fachbereich',
      c2: 'Zweitgespräch Geschäftsführung',
      c3: 'Fallstudie',
      c4: 'Probetag',
    },
    success_profile: {
      c0: 'Packt selbst an',
      c1: 'Kommt aus dem Mittelstand',
      c2: 'Arbeitet gern eigenverantwortlich',
      c3: 'Sucht kurze Wege statt Prozess',
    },
    failure_profile: {
      c0: 'Wartet auf Anweisungen',
      c1: 'Kam aus dem Konzern und vermisste Zuarbeit',
      c2: 'Zu wenig Hands-on',
      c3: 'Passte menschlich nicht ins Team',
    },
    target_companies: {
      c0: 'Wettbewerber',
      c1: 'Beratungen',
      c2: 'Konzerne der Branche',
      c3: 'Mittelstand der Branche',
      c4: 'Zulieferer',
    },
    unique_selling_points: {
      c0: 'Inhabergeführt, keine Investoren',
      c1: 'Eigenes Produkt, eigene Fertigung',
      c2: 'Marktführer in einer Nische',
      c3: 'Kurze Wege bis zur Geschäftsführung',
      c4: 'Sicherer Arbeitsplatz, wenig Fluktuation',
    },
    position_advantages: {
      c0: 'Volle Verantwortung statt Zuarbeit',
      c1: 'Direkter Draht zur Geschäftsführung',
      c2: 'Aufbau statt Verwaltung',
      c3: 'Moderne Systeme im Einsatz',
    },
    company_culture: {
      c0: 'Wir duzen uns',
      c1: 'Wir siezen uns',
      c2: 'Kurze Wege, wenig Abstimmung',
      c3: 'Feste Zuständigkeiten, klare Prozesse',
      c4: 'Familiär, wenig Fluktuation',
    },
    career_path: {
      c0: 'Jährliches Entwicklungsgespräch',
      c1: 'Gehalt wird dabei festgelegt, nicht auf Nachfrage',
      c2: 'Weiterbildungsbudget pro Jahr',
      c3: 'Fachliche Führung möglich',
      c4: 'Führungslaufbahn möglich',
    },
    career_example: {
      c0: 'Jemand ist intern aufgestiegen',
      c1: 'Jemand hat die Fachverantwortung übernommen',
      c2: 'Jemand hat den Bereich gewechselt',
    },
    contract_sensitive_topics: {
      c0: 'Nichts davon',
      c1: 'Wettbewerbsverbot',
      c2: 'Rückzahlungsklausel (Weiterbildung)',
      c3: 'Verschwiegenheit / NDA',
      c4: 'Bereitschaftsdienst',
      c5: 'Reisepflicht',
    },
    candidate_concerns: {
      c0: 'Präsenzpflicht',
      c1: 'Arbeitsweg',
      c2: 'Gehalt',
      c3: 'Kein Bonus',
      c4: 'Rückzahlungsklausel',
      c5: 'Reisetätigkeit',
    },
    industry_opportunities: {
      c0: 'Die Auftragslage ist gut',
      c1: 'Investitionen ziehen an',
      c2: 'Förderprogramme helfen',
      c3: 'Wir gewinnen Marktanteile',
    },
    industry_challenges: {
      c0: 'Fachkräfte sind schwer zu finden',
      c1: 'Lieferzeiten sind lang',
      c2: 'Der Preisdruck nimmt zu',
      c3: 'Die Regulatorik wird aufwendiger',
    },
  },
  chipsFreelance: {
    core_hours: {
      c0: 'Frei einteilbar',
      c1: 'Feste Termine, sonst frei',
      c2: 'Kernzeiten einzuhalten',
      c3: 'Schicht- oder Dienstplan',
    },
    time_tracking_method: {
      c0: 'Timesheet digital',
      c1: 'Timesheet auf Papier',
      c2: 'Monatsbericht',
      c3: 'Keine Erfassung',
    },
    vacancy_reason: {
      c0: 'Neues Projekt',
      c1: 'Lastspitze',
      c2: 'Ausfall überbrücken',
      c3: 'Know-how fehlt intern',
      c4: 'Bis zur Festbesetzung',
    },
    negative_impact_if_unfilled: {
      c0: 'Der Termin beim Kunden wackelt',
      c1: 'Wir zahlen extern teurer dazu',
      c2: 'Das Projekt verzögert sich',
      c3: 'Die Anlage geht später in Betrieb',
      c4: 'Interne Leute werden abgezogen',
    },
    daily_routine: {
      c0: 'Fester Platz im Projektteam',
      c1: 'Abstimmung mit dem Fachbereich',
      c2: 'Eigenständig, wenig Abstimmung',
      c3: 'Vor Ort an der Anlage',
    },
    reports_to: {
      c0: 'Projektleitung',
      c1: 'Fachbereichsleitung',
      c2: 'Bereichsleitung',
      c3: 'Geschäftsführung',
    },
    success_profile: {
      c0: 'Liefert ab Tag eins ohne Einarbeitung',
      c1: 'Holt die Fachbereiche ab',
      c2: 'Dokumentiert für die Übergabe',
      c3: 'Arbeitet selbstständig ohne Rückfragen',
    },
    failure_profile: {
      c0: 'Brauchte zu lange bis zur Produktivität',
      c1: 'Hat beraten statt umgesetzt',
      c2: 'Hinterließ keine Dokumentation',
      c3: 'Kam mit unseren Prozessen nicht zurecht',
    },
    unique_selling_points: {
      c0: 'Moderne Technik statt Altbestand',
      c1: 'Referenzfähiges Vorhaben',
      c2: 'Klarer Auftrag, keine Politik',
      c3: 'Aussicht auf Anschlussprojekte',
    },
    position_advantages: {
      c0: 'Entscheidungen ohne Gremienschleife',
      c1: 'Zugriff auf die Systeme ab Tag eins',
      c2: 'Fachlich sauber aufgesetztes Projekt',
      c3: 'Ansprechpartner mit Entscheidungsbefugnis',
    },
    company_culture: {
      c0: 'Kurze Wege, wenig Abstimmung',
      c1: 'Feste Termine, klare Zuständigkeiten',
      c2: 'Konzernprozesse, viele Beteiligte',
      c3: 'Wir siezen uns',
      c4: 'Wir duzen uns',
    },
    contract_sensitive_topics: {
      c0: 'Nichts davon',
      c1: 'Wettbewerbsverbot',
      c2: 'Haftung / Versicherungsnachweis',
      c3: 'Verschwiegenheit / NDA',
      c4: 'Vor-Ort-Pflicht ohne Ausnahme',
      c5: 'Reisepflicht',
    },
  },
  benefits: {
    c0: '30 Tage Urlaub',
    c1: 'Mehr als 30 Tage Urlaub',
    c2: 'Home-Office möglich',
    c3: 'Gleitzeit ohne Kernzeit',
    c4: 'Teilzeit möglich',
    c5: 'Workation / Arbeiten aus dem Ausland',
    c6: 'Sabbatical',
    c7: 'Bonus / Prämien',
    c8: 'Betriebliche Altersvorsorge',
    c9: 'Vermögenswirksame Leistungen',
    c10: 'Mitarbeiterbeteiligung',
    c11: 'Umzugsunterstützung',
    c12: 'Jobrad / Fahrradleasing',
    c13: 'Deutschlandticket / Fahrtkostenzuschuss',
    c14: 'Firmenwagen',
    c15: 'Parkplatz oder Ladesäule',
    c16: 'Weiterbildungsbudget',
    c17: 'Konferenzen und Zertifizierungen',
    c18: 'Coaching / Mentoring',
    c19: 'Essenszuschuss oder Kantine',
    c20: 'Sportangebot (Wellpass, Urban Sports)',
    c21: 'Gesundheitsvorsorge / Betriebsarzt',
    c22: 'Kinderbetreuung oder Kita-Zuschuss',
    c23: 'Moderne Hardware, Gerätewahl',
    c24: 'Mitarbeiterrabatte',
  },
  benefitsContracting: {
    c0: 'Reisekosten werden erstattet',
    c1: 'Übernachtung wird gestellt',
    c2: 'Remote-Anteil möglich',
    c3: 'Vor-Ort-Tage flexibel',
    c4: 'Keine Kernzeitpflicht',
    c5: 'Eigene Zeiteinteilung',
    c6: 'Eigener Arbeitsplatz',
    c7: 'Hardware wird gestellt',
    c8: 'Parkplatz oder Ladesäule',
    c9: 'Kantine nutzbar',
    c10: 'Referenz zugesagt',
    c11: 'Anschlussprojekte in Aussicht',
    c12: 'Zugang zu Schulungen und Zertifizierungen',
  },
  benefitGroups: {
    c0: 'Zeit & Ort',
    c1: 'Geld',
    c2: 'Mobilität',
    c3: 'Entwicklung',
    c4: 'Alltag',
  },
  benefitGroupsContracting: {
    c0: 'Konditionen',
    c1: 'Einteilung',
    c2: 'Vor Ort',
    c3: 'Nach dem Projekt',
  },
  value: {
    yes: 'Ja',
    no: 'Nein',
    given: 'angegeben',
  },
};

export default de;
