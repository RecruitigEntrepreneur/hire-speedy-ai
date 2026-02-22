

# Kandidaten-Detailseite: Datenstruktur, Informationshierarchie und EU AI Act Konformitaet

## Alle verfuegbaren Kandidatendaten (Bestandsaufnahme)

Wir haben 4 Datenquellen fuer den Client:

### Quelle 1: Kandidaten-Stammdaten (candidates table)
- **Rolle**: job_title, seniority, company
- **Erfahrung**: experience_years, skills[], certifications[], soft_skills, specializations
- **Standort**: city, region (anonymisiert zu "DACH"/"Sueддeutschland" etc.)
- **Gehalt**: expected_salary, salary_expectation_min/max, current_salary, salary_bonus
- **Verfuegbarkeit**: availability_date, notice_period
- **Arbeitsmodell**: remote_preference, remote_possible, remote_days_preferred, commute_mode, max_commute_minutes, relocation_willing
- **Sprachen**: language_skills (JSON)
- **Kontakt** (nur wenn unlocked): email, phone, linkedin_url, cv_url, github_url, portfolio_url, website_url
- **CV-Analyse**: cv_ai_summary, cv_ai_bullets, expose_summary, expose_highlights, expose_certifications, expose_project_highlights
- **Branchenerfahrung**: industry_experience (JSON)
- **Zielvorstellungen**: target_roles, target_industries, target_locations, target_employment_type

### Quelle 2: KI-Einschaetzung (candidate_client_summary table)
- recommendation (strong_yes/yes/maybe/no/strong_no)
- executive_summary (Freitext)
- key_selling_points (JSON Array)
- risk_factors (JSON Array mit severity)
- positive_factors (JSON Array mit strength)
- change_motivation_status + change_motivation_summary
- career_goals
- job_hopper_analysis (is_job_hopper, avg_tenure_months, concern_level)
- fit_assessment
- deal_probability
- role_archetype
- primary_domain

### Quelle 3: Submission-Kontext
- status, stage (Pipeline-Position)
- match_score
- identity_unlocked
- recruiter_notes

### Quelle 4: Deal Health
- drop_off_probability

---

## Was dem Kunden AKTUELL gezeigt wird vs. was MOEGLICH waere

| Daten | Aktuell gezeigt | Verfuegbar aber nicht genutzt |
|---|---|---|
| Rolle + Senioritaet | Ja | - |
| Skills (Top 8) | Ja | certifications, soft_skills, specializations |
| Region (anonymisiert) | Ja | - |
| Gehalt (Range) | Ja | - |
| Verfuegbarkeit | Ja | - |
| Arbeitsmodell | Ja, aber nur "Flexibel" | remote_days_preferred, commute_mode, relocation_willing |
| Sprachen | NEIN | language_skills vorhanden |
| Branchenerfahrung | NEIN | industry_experience vorhanden |
| Ziel-Rollen | NEIN | target_roles, target_industries |
| KI-Empfehlung | Ja (Hero) | - |
| Staerken/Risiken | Ja | - |
| Wechselmotivation | Ja | - |
| Karriereziele | NEIN (im Hook geladen) | career_goals vorhanden |
| Zertifizierungen | NEIN | certifications[], expose_certifications |
| Soft Skills | NEIN | soft_skills (JSON) |
| CV-Summary | NEIN (nur Recruiter) | cv_ai_summary, expose_summary |
| Projekt-Highlights | NEIN | expose_project_highlights |

---

## EU AI Act Konformitaet

Der EU AI Act (in Kraft seit August 2024, volle Anwendbarkeit ab August 2026) klassifiziert KI-Systeme im Recruiting als **Hochrisiko-KI** (Anhang III, Punkt 4). Das betrifft unsere KI-Einschaetzung direkt.

### Pflichten fuer Hochrisiko-KI im Recruiting:

1. **Transparenzpflicht (Art. 13, 52)**: Der Kunde MUSS wissen, dass eine KI die Einschaetzung erstellt hat und welches Modell verwendet wurde.
2. **Menschliche Aufsicht (Art. 14)**: Die KI-Empfehlung darf NICHT als alleinige Entscheidungsgrundlage dienen. Der Mensch muss die finale Entscheidung treffen.
3. **Erklaerbarkeit (Art. 13)**: Der Kunde muss verstehen KOENNEN, warum die KI zu ihrer Einschaetzung kommt.
4. **Nicht-Diskriminierung (Art. 10)**: Keine geschuetzten Merkmale (Alter, Geschlecht, Nationalitaet, Behinderung) duerfen in die Bewertung einfliessen.
5. **Datenminimierung (DSGVO Art. 5)**: Nur relevante Daten zeigen, nichts Uebermaessiges.
6. **Recht auf Erklaerung (Art. 86 DSGVO)**: Kandidat hat Recht zu erfahren, wie die Entscheidung zustande kam.

### Was wir AENDERN muessen:

| Anforderung | Aktuell | Muss |
|---|---|---|
| KI-Kennzeichnung | "KI-Einschaetzung" als Titel | Expliziter Hinweis "Automatisiert erstellt durch KI-Modell [Version]" + Disclaimer |
| Menschliche Aufsicht | Kein Hinweis | Deutlicher Hinweis: "Diese Einschaetzung ist eine Entscheidungshilfe, keine Entscheidung" |
| Erklaerbarkeit | Staerken/Risiken vorhanden | Gut -- aber "Warum nicht geeignet" muss IMMER erklaert werden |
| Modell-Version | Nur intern (model_version) | Fuer den Kunden sichtbar machen |
| Diskriminierung | Alter/Nationalitaet nicht gezeigt | Korrekt -- beibehalten |
| Einspruchsrecht | Nicht vorhanden | "Einschaetzung anfechten" Button oder Hinweistext |

---

## Neue Informationshierarchie (EU AI Act konform)

### Sektion 1: Header (Identitaet + Status + CTAs)
Wie bisher: Avatar, anonymer Name, Ziel-Job, Status, Action-Buttons.
Keine Aenderung noetig.

### Sektion 2: KI-Einschaetzung (Hero, volle Breite)
**Aenderungen fuer EU AI Act:**
- Titel aendern zu: "KI-gestuetzte Einschaetzung"
- Unter dem Titel: "Automatisiert erstellt am [Datum] | Modell: [model_version]"
- **NEU**: Disclaimer-Zeile am unteren Rand der Card:
  "Hinweis gemaess EU AI Act: Diese Einschaetzung wurde automatisiert erstellt und dient ausschliesslich als Entscheidungshilfe. Die finale Personalentscheidung obliegt Ihnen."
- Alles andere (Empfehlung, Summary, Staerken, Risiken, Motivation) bleibt.

### Sektion 3: Profil-Snapshot (ERWEITERT, 60/40 mit Notizen)
Neue Struktur der Profil-Card mit Untergruppen:

**Gruppe A: Berufliches Profil**
- Aktuelle Rolle
- Senioritaet
- Branchenerfahrung (NEU -- aus industry_experience)
- Erfahrung (Jahre/Range)

**Gruppe B: Kompetenzen**
- Top Skills (Badges, max 8)
- Zertifizierungen (NEU -- aus certifications[])
- Sprachen (NEU -- aus language_skills)

**Gruppe C: Rahmenbedingungen**
- Region
- Arbeitsmodell (erweitert: z.B. "Hybrid, 2-3 Tage Remote, umzugsbereit")
- Verfuegbarkeit
- Gehaltsband

**Gruppe D: Karriereziele** (NEU)
- Ziel-Rollen (aus target_roles, wenn vorhanden)
- Karriereziele (aus career_goals, wenn vorhanden)

Jede Gruppe wird mit einem dezenten Label/Separator getrennt.
Leere Gruppen werden komplett ausgeblendet statt Platzhalter zu zeigen.

### Sektion 4: Notizen (rechte Spalte, wie bisher)
Keine Aenderung.

### Sektion 5: Dokumente + Kontakt (nur wenn unlocked)
Keine Aenderung.

### Sektion 6: Compliance-Footer
Ersetzt den bisherigen Anonymitaets-Hinweis. Kombiniert:
- Anonymitaets-Info (wenn nicht unlocked): "Anonymisiertes Profil -- Nach Interview-Zustimmung werden Name, Kontakt und CV freigeschaltet."
- EU AI Act Info: "Die KI-Einschaetzung auf dieser Seite wird gemaess EU AI Act (Verordnung 2024/1689) als Hochrisiko-KI-System betrieben. Bei Fragen wenden Sie sich an Ihren Ansprechpartner."

---

## Technische Umsetzung

### Datei 1: `src/hooks/useClientCandidateView.ts`
Neue Felder in ClientCandidateViewData laden:
- `languageSkills: { language: string; level: string }[]` (aus candidate.language_skills, JSON parsen)
- `certifications: string[]` (aus candidate.certifications)
- `industryExperience: string[]` (aus candidate.industry_experience, JSON parsen)
- `targetRoles: string[]` (aus candidate.target_roles, JSON parsen)
- `relocationWilling: boolean | null` (aus candidate.relocation_willing)
- `remoteDaysPreferred: number | null` (aus candidate.remote_days_preferred)
- `careerGoals: string | null` (bereits geladen aber nicht exponiert in der UI)
- `modelVersion: string | null` (aus summary.model_version)
- `generatedAt: string | null` (aus summary.generated_at)

Supabase-Query erweitern um: `language_skills, certifications, industry_experience, target_roles, relocation_willing, remote_days_preferred`

### Datei 2: `src/pages/dashboard/CandidateDetail.tsx`
Kompletter Umbau der Profil-Sektion:
- Profil-Card bekommt gruppierte Felder (A/B/C/D) mit dezenten Separatoren
- Leere Gruppen komplett ausblenden (nicht "Ausstehend" zeigen)
- Sprachen, Zertifizierungen, Branchenerfahrung als neue Zeilen/Badges
- Arbeitsmodell-Zeile erweitert (Remote-Tage, Umzugsbereitschaft)
- Karriereziele-Gruppe wenn vorhanden

### Datei 3: `src/components/candidates/ClientCandidateSummaryCard.tsx`
EU AI Act Anpassungen:
- Titel aendern: "KI-gestuetzte Einschaetzung"
- Modell-Version unter dem Datum anzeigen (aus summary.model_version)
- Disclaimer-Zeile am Ende der Card hinzufuegen
- Bestehende Struktur (Empfehlung, Summary, Selling Points, Motivation, Staerken/Risiken) bleibt identisch

### Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/hooks/useClientCandidateView.ts` | Neue Felder laden: languageSkills, certifications, industryExperience, targetRoles, relocationWilling, remoteDaysPreferred, modelVersion |
| `src/pages/dashboard/CandidateDetail.tsx` | Profil-Sektion in 4 Gruppen (Beruflich, Kompetenzen, Rahmenbedingungen, Karriereziele), leere Gruppen ausblenden, Compliance-Footer |
| `src/components/candidates/ClientCandidateSummaryCard.tsx` | EU AI Act: Titel, Modell-Anzeige, Disclaimer-Zeile |

