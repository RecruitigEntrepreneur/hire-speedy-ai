# Jobaufnahme — Umsetzungspaket Welle A

**Stand:** 2026-08-29 · **Grundlage:** [INTAKE_SCREEN_PERFEKTION.md](INTAKE_SCREEN_PERFEKTION.md), Baureihenfolge des Red Teams
**Umfang:** 7 Maßnahmen · alle Aufwand S · **keine Migration, kein Edge-Function-Deploy, keine DB-Änderung**

Jede Zielspalte dieses Pakets wurde am 29.08. per REST gegen die Produktionsdatenbank geprüft. Es ist bewusst so
geschnitten, dass es **unabhängig** von den offenen Deploy- und Migrationsfragen ausgeliefert werden kann.

---

## Warum diese Reihenfolge

**Maßnahme 1 ist die Voraussetzung für alle anderen.** Solange `parse-job-url` in Produktion mit 404 antwortet,
erreicht kein Kunde die Stufe `built` — die Maßnahmen 2, 3, 4 und 7 würden einen Bildschirm verbessern, den
niemand sieht. Maßnahme 1 macht diesen Bildschirm ohne jeden Deploy erreichbar.

Die Maßnahmen 5 und 6 sind davon unabhängig und wirken sofort auf Screens, die heute schon live sind.

| # | Maßnahme | Screen | Wirkt auf | Abhängig von |
|---|---|---|---|---|
| 1 | Manueller Einstieg | S2 | Erreichbarkeit | — |
| 2 | Kein Feld ohne Speicherziel | S4/S5 | Ehrlichkeit | 1 |
| 3 | Drei Auftragsfragen | S4 | Inhalt | 1 |
| 4 | AGG-Prüfung im Premium-Pfad | S4 | Recht | 1 |
| 5 | Recruiter-Zahl | S1/S9 | Ehrlichkeit | — |
| 6 | Alterung im Zug-Banner | S9 | Ehrlichkeit | — |
| 7 | Verhandelbarkeit folgenreich | S4 | Matching | 1, 3 |

---

## Vorab geprüfte Zielspalten (Produktion, REST, 29.08.)

| Spalte | Status | Verwendet in |
|---|---|---|
| `jobs.vacancy_reason` | ✅ vorhanden | M3 |
| `jobs.hiring_urgency` | ✅ vorhanden | M3 |
| `jobs.decision_makers` (text[]) | ✅ vorhanden | M3 |
| `jobs.team_size`, `candidates_in_pipeline`, `onsite_days_required` | ✅ vorhanden | M2 |
| `jobs.briefing_notes` | ✅ vorhanden | M2 |
| `job_skill_requirements.weight` | ✅ vorhanden | M7 |
| `job_skill_requirements.min_years`, `min_proficiency`, `recency_required` | ✅ vorhanden | M7 |
| `jobs.intake_payload`, `jobs.draft_state` | ❌ **fehlen** | bewusst nicht verwendet |
| `jobs.decision_makers_count` | ❌ **fehlt** | Frage wird auf `decision_makers` gemappt |
| `job_skill_requirements.source` | ❌ fehlt | Welle B |

**Nebenbefund:** `decision_makers_count` wird im alten Pfad erhoben ([QuickQuestionsSection.tsx:46](src/components/jobs/QuickQuestionsSection.tsx:46))
und in [CreateJob.tsx:630-665](src/pages/dashboard/CreateJob.tsx:630) **nicht gespeichert** — die Spalte existiert nicht.
Die Frage „Wer entscheidet?" wird heute in beiden Pfaden gestellt und weggeworfen. M3 behebt das.

---

# M1 · Manueller Einstieg „Ohne Vorlage starten"

**Problem.** `setBuilt` wird ausschließlich in `startBuild` aufgerufen, und `startBuild` bricht ohne KI-Antwort ab
([JobIntakeStudio.tsx:238-243](src/components/dashboard/JobIntakeStudio.tsx:238)). Die Input-Stufe kennt nur „Profil bauen",
„PDF ablegen" und „Link" ([:553-564](src/components/dashboard/JobIntakeStudio.tsx:553)) — alle drei laufen über Edge Functions,
die in Produktion 404 liefern. Der Kunde landet nach jedem Versuch wieder im leeren Feld, mit einer Meldung, die ihm die Schuld gibt.

**Änderung.**

1. `src/components/dashboard/intake/types.ts` — `EMPTY_BUILT` als Konstante ergänzen: alle `BuiltJob`-Felder leer,
   `remote_type: 'hybrid'`, `experience_level: 'mid'`, Arrays leer, Zahlen `null`.
2. `JobIntakeStudio.tsx` — neue Funktion `startManual()`:
   - `built` aus `EMPTY_BUILT` plus `title: text.trim() || 'Neue Stelle'`
   - `setAnswers(prefillFromBuilt(...))` wie in `startBuild`
   - Reveal-Descriptor **nicht** vorbelegen (es gibt keine Quelle)
   - direkt `setStage('built')`, die Aufbau-Stufe wird übersprungen
3. `JobIntakeStudio.tsx:553-564` — vierter Button in der Input-Stufe, gleichrangig neben „Profil bauen":
   **„Ohne Vorlage starten"**, Variante `outline`.
4. `startBuild:240` — die Fehlermeldung ersetzen. Neu, zweizeilig:
   *„Die automatische Analyse ist gerade nicht erreichbar."* + Button *„Ohne Vorlage starten"* im selben Toast
   (`toast.error(..., { action: { label: 'Ohne Vorlage starten', onClick: startManual } })`).
   **Die Schuldzuweisung an den Nutzer entfällt ersatzlos.**

**Prüfschritt.** Dev-Server, Kachel öffnen, „Ohne Vorlage starten" klicken → die zweispaltige Ansicht erscheint mit
leerem Profil und editierbarem Titel. Danach „Profil bauen" mit beliebigem Text → Toast enthält den Ausweichknopf.

**Risiko.** Gering. Rein additiv, kein bestehender Pfad wird verändert.
**Rollback.** Button und Funktion entfernen.

---

# M2 · Kein Feld ohne Speicherziel

**Problem.** `intakeCapture` meldet über `extendedPersisted` bereits, ob die erweiterten Felder gespeichert wurden
([intakeCapture.ts:40,51,57](src/lib/intakeCapture.ts:40)) — aber `JobIntakeStudio.tsx:424` und `:461` destrukturieren
nur `{ data, error }`. Der Kunde sieht „Entwurf gespeichert" und „Stelle eingereicht!", während das Briefing,
die Flexibilitätsmatrix, das Reveal-Envelope und bei Contracting die gesamte Vergütung verworfen wurden.

Zusätzlich: Der Konditionsblock Contracting ([ProfileSections.tsx:139-182](src/components/dashboard/intake/ProfileSections.tsx:139))
sammelt fünf Felder, für die es produktiv keine Spalte gibt.

**Änderung.**

1. `JobIntakeStudio.tsx:421-433` (`handleSaveDraft`) und `:456-476` (`handleSubmit`) — `extendedPersisted` mit
   destrukturieren und auswerten:
   - `true` → Meldung wie bisher
   - `false` → **`toast.warning`** statt `toast.success`, Text: *„Gespeichert — das Briefing konnte nicht mit
     abgelegt werden. Wir haben Ihre Antworten für diese Sitzung behalten; bitte übergeben Sie die Stelle, bevor
     Sie das Fenster schließen."*
2. `JobIntakeStudio.tsx:649-701` (Stufe `submitted`) — unter der Statusleiste eine Zeile, die aufzählt, **was
   tatsächlich gespeichert wurde** (Titel, Eckdaten, Skills, Gehalt) und was nicht. Nur anzeigen, wenn
   `extendedPersisted === false`.
3. `ProfileSections.tsx:139-182` — der Contracting-Block bekommt eine Kopfzeile
   *„Wird derzeit noch nicht gespeichert"* in Bernstein, solange keine Zielspalten existieren.
   **Alternative, sauberer:** Block ausblenden. Empfehlung des Red Teams ist die Kennzeichnung, weil die Felder
   dem Kunden zeigen, dass an Contracting gedacht ist.
4. `JobIntakeStudio.tsx:342-343` — Tagessatz nicht mehr verwerfen: Bei `isFreelance` `salary_min`/`salary_max` mit
   `freelance.dayRateMin`/`dayRateMax` befüllen und in `briefing_notes` eine Zeile
   `Tagessatz: X–Y €/Tag` ergänzen. Damit ist die Vergütung wenigstens vorhanden, statt `null`.
   *(Sauber wird es erst mit eigenen Spalten in Welle B — dies ist die Zwischenlösung, die heute Daten rettet.)*

**Prüfschritt.** In den DevTools eine Stelle bis `built` bringen, „Später weiter" klicken, Netzwerk-Antwort prüfen:
Der zweite Insert ohne Extended-Felder muss den Warn-Toast auslösen. Danach in der Jobliste prüfen, dass der Entwurf
mit Titel und Eckdaten existiert.

**Risiko.** Gering, aber **sichtbar für Bestandskunden** — der Ton ändert sich von Erfolg zu Warnung. Das ist gewollt.
**Rollback.** Auswertung entfernen.

---

# M3 · Die drei Auftragsfragen, deterministisch und vor der KI

**Problem.** Vakanzgrund, Dringlichkeit und Entscheider werden im alten Pfad als Quick Questions erhoben
([QuickQuestionsSection.tsx:24-53](src/components/jobs/QuickQuestionsSection.tsx:24)) und fehlen im Studio vollständig.
Das Question Design Council hat genau diese drei als die wichtigsten fehlenden Fragen benannt — die teuerste
ist „Ist die Stelle freigegeben?", deren nächster Verwandter „Wer entscheidet final?" ist.

Sie dürfen **nicht** der KI überlassen werden: `intake-questions` entscheidet die Reihenfolge selbst und ist
in Produktion nicht erreichbar.

**Änderung.**

1. Neue Komponente `src/components/dashboard/intake/AuftragsFragen.tsx` — drei Chip-Fragen, in dieser Reihenfolge:

   | Frage | Optionen | Zielspalte |
   |---|---|---|
   | Warum ist die Stelle offen? | Wachstum · Nachfolge · Neu geschaffen · Umstrukturierung | `jobs.vacancy_reason` |
   | Wie dringend? | Standard (8+ Wo.) · Dringend (4–8 Wo.) · Sehr dringend (<4 Wo.) | `jobs.hiring_urgency` |
   | Wer entscheidet final? | Nur ich · HR + Fachbereich · Geschäftsführung + Team | `jobs.decision_makers` |

   Wortlaut und Optionen aus `QUICK_QUESTIONS` übernehmen — sie sind erprobt.
   `decision_makers` ist `text[]`: Mapping `'1' → ['Auftraggeber']`, `'2' → ['HR','Fachbereich']`,
   `'3+' → ['Geschäftsführung','Fachbereich','HR']`.

2. `JobIntakeStudio.tsx:606-644` — die Komponente **oberhalb** von `DynamicBriefing` einsetzen. Solange eine der
   drei unbeantwortet ist, wird `DynamicBriefing` **nicht** gerendert. Begründungszeile darüber:
   *„Drei Fragen, dann übernimmt die KI."*

3. `buildRecord` ([:332-354](src/components/dashboard/JobIntakeStudio.tsx:332)) — die drei Werte in `base`
   aufnehmen. `hiring_urgency` nur schreiben, wenn `!== 'standard'` (analog CreateJob.tsx:643).

4. `jobDraft` ([:203-236](src/components/dashboard/JobIntakeStudio.tsx:203)) — die drei Antworten mitgeben, damit
   die KI sie nicht erneut fragt. Der Systemprompt hat dafür bereits Regel 8 („Dokument & Profil respektieren").

**Prüfschritt.** Studio öffnen → drei Fragen erscheinen, Briefing ist verdeckt. Alle drei beantworten → Briefing
erscheint. Speichern → in der Jobliste prüfen, dass `vacancy_reason`, `hiring_urgency` und `decision_makers` gesetzt sind.

**Risiko.** Mittel — es ist die einzige Maßnahme, die dem Kunden **zusätzliche** Arbeit abverlangt. Gegenwert:
drei Antworten in etwa 20 Sekunden, die heute in beiden Pfaden verloren gehen.
**Rollback.** Komponente ausbauen, `base`-Felder entfernen.

---

# M4 · AGG-Prüfung im Premium-Pfad einschalten

**Problem.** Die einzige Rechtsprüfung des Aufnahmeprozesses ([QualityCheck.tsx:55](src/components/dashboard/intake/QualityCheck.tsx:55))
testet ausschließlich `answers.exclusion_criteria`. Im KI-Pfad enthält `answers` nur den Prefill aus `prefillFromBuilt`
— das Feld ist dort strukturell leer. **Sobald die KI-Befragung funktioniert, schaltet sich der AGG-Wächter ab.**

**Änderung.**

1. `QualityCheck.tsx` — neue Prop `dynAnswers?: { question: string; answer: string }[]`.
2. `:55` — das Muster gegen **alle** Textquellen prüfen, nicht nur ein Feld:
   `answerText(answers.exclusion_criteria)` + alle `dynAnswers[].answer` + `built.must_haves.join(' ')` +
   `built.nice_to_haves.join(' ')` + `built.description` + `built.requirements`.
3. `JobIntakeStudio.tsx:635-643` — `dynAnswers={dyn.answers}` durchreichen.
4. Die Meldung präzisieren: statt einer pauschalen Warnung den **Treffer zitieren**
   (*„Der Begriff „jung" in den Anforderungen könnte als Altersbezug gelesen werden."*).

**Prüfschritt.** Im Briefing als Freitext „keine Berufsanfänger über 45" eingeben → Warnung erscheint.
Dasselbe als Muss-Kriterium eintragen → Warnung erscheint ebenfalls.

**Risiko.** Gering. Falsch-Positive sind möglich (`AGG_PATTERN` ist breit) — der Check blockiert nichts, er warnt.
**Rollback.** Prop entfernen, Prüfung auf das alte Feld zurücksetzen.

---

# M5 · Die Recruiter-Zahl aufhören zu fälschen

**Problem.** `activeRecruiters` zählt distinkte `recruiter_id` über **alle** Submissions eines Jobs, inklusive
abgelehnter ([client-dashboard-data/index.ts:285](supabase/functions/client-dashboard-data/index.ts:285)).
Angezeigt wird das als pulsierend grünes *„1 Recruiter arbeitet"*
([RecruiterActivityIndicator.tsx:26-27](src/components/dashboard/RecruiterActivityIndicator.tsx:26)) — auch dann,
wenn die einzige Einreichung vor 187 Tagen kam und abgelehnt wurde.

**Änderung — ohne Function-Deploy, rein im Frontend.**

1. `RecruiterActivityIndicator.tsx` — neue Props `lastSubmittedAt?: string | null` und `activeCount?: number`.
2. Anzeigelogik:
   - kein Datum → *„Noch keine Einreichung"*, neutral
   - letzte Einreichung ≤ 14 Tage → wie bisher, grün, aber ohne `animate-pulse`
   - älter → **bernstein**, Text *„Zuletzt eingereicht vor {n} Tagen"*
3. `LiveJobCard.tsx:52` — das Datum durchreichen. Quelle ist der bereits geladene Submission-Datensatz.
4. `animate-pulse` ([:26](src/components/dashboard/RecruiterActivityIndicator.tsx:26)) **ersatzlos streichen** —
   eine Puls-Animation suggeriert Aktivität in Echtzeit, die es nicht gibt.

**Prüfschritt.** Dashboard öffnen. Für einen Job mit 187 Tage alter, abgelehnter Einreichung muss die Kachel
bernstein sein und das Datum nennen — nicht grün „1 Recruiter arbeitet".

**Risiko.** Gering. Die Edge Function bleibt unangetastet.
**Rollback.** Props ignorieren.

---

# M6 · Alterung im Zug-Banner

**Problem.** `diagnoseJob` kennt im `laeuft`-Zweig **keine Zeitschwelle** ([jobCockpit.ts:174-181](src/lib/jobCockpit.ts:174)).
`days` wird berechnet und nur als Textparameter durchgereicht. Ergebnis auf der Job-Detailseite:
*„Alles in Arbeit — nichts zu tun. Letzter Vorschlag vor 187 Tagen."* in einem **grünen** Banner.

**Änderung.**

1. `src/lib/jobCockpit.ts:180-181` — der letzte `return` bekommt Schwellen:

   | Tage seit letzter Einreichung | key | tone | Aktion |
   |---|---|---|---|
   | ≤ 20 | `laeuft` | `ok` | keine |
   | 21–44 | `laeuft_zaeh` | `warn` | `briefing` (Typ `edit`) |
   | ≥ 45 | `laeuft_stockt` | `alert` | `entscheiden` (Typ `edit`) |

2. `src/i18n/locales/de.ts:808` — zwei neue Schlüssel neben `laeuft`:
   - `laeuft_zaeh`: *„Seit {{days}} Tagen keine Bewegung. Häufigste Ursache: zu enges Gehaltsband oder zu strenge Muss-Kriterien."*
   - `laeuft_stockt`: *„Seit {{days}} Tagen steht die Suche. Bitte entscheiden Sie: Kriterien lockern, Budget anheben oder Stelle schließen."*
   Englische Entsprechungen in `en.ts`.
3. Prüfen, ob der Ton `alert` in der Banner-Komponente bereits existiert; sonst analog zu `warn` ergänzen.

**Prüfschritt.** Job-Detailseite einer Stelle mit >45 Tagen ohne Einreichung öffnen → rotes Banner mit Entscheidungsaufforderung.
Eine frische Stelle → unverändert grün.

**Risiko.** Gering, aber **stark sichtbar**: Viele Bestandsjobs springen sofort auf bernstein oder rot. Das ist der Zweck.
Vorher intern ansehen, damit niemand am Montag erschrickt.
**Rollback.** Schwellen entfernen, ein `return` wie bisher.

---

# M7 · Verhandelbarkeit sichtbar und erstmals folgenreich

**Problem, zweiteilig.**

*Wirkung:* Die Flexibilitätsmatrix landet in `intake_payload.flexibility` ([JobIntakeStudio.tsx:383](src/components/dashboard/JobIntakeStudio.tsx:383))
— eine Spalte, die produktiv nicht existiert. `calculate-match-v3-1:1199` gewichtet jedes Muss mit `req.weight || 1.0`
und wirft bei `mustHaveCoverage < 0.40` komplett aus. **Ein als „flexibel" markiertes Muss killt den Kandidaten
genauso hart wie ein „fix".**

*Bedienung:* Das Label ist ein nacktes Wort in einer Pille ([ProfileSections.tsx:222-228](src/components/dashboard/intake/ProfileSections.tsx:222)),
der Zyklus fix → verhandelbar → flexibel ist nur als Fließtext sechs Zeilen darüber erklärt, und es gibt keinen Rückwärtsweg.

**Änderung.**

1. `JobIntakeStudio.tsx:409-419` (`persistSkillRequirements`):
   - `weight` aus der Flexibilität ableiten: `fix → 1.0`, `negotiable → 0.6`, `flexible → 0.3`; `nice → 0.5` wie bisher
   - `min_years`, `min_proficiency`, `recency_required` aus `dyn.skillRequirements` mitschreiben — **alle drei Spalten existieren**
   - `ignoreDuplicates: true` → `false`, damit eine spätere Umklassifizierung die Zeile aktualisiert statt sie zu ignorieren
   - **Die Funktion auch im Fallback-Pfad aufrufen**: heute läuft sie nur, wenn `dyn.skillRequirements` gefüllt ist,
     also nur im KI-Pfad. Ohne KI bekommt `job_skill_requirements` gar keine Zeilen. Aus `built.must_haves` und
     `built.nice_to_haves` eine Basisliste bauen.
2. `ProfileSections.tsx:220-230` — der Zyklus-Knopf wird ein **Dreiersegment** (Muss · Verhandelbar · Nice),
   ein Klick setzt direkt statt zu rotieren. Der Erklärsatz ([:204-206](src/components/dashboard/intake/ProfileSections.tsx:204)) entfällt.
3. `QualityCheck.tsx:53` — der Hebel „1–2 Muss-Kriterien auf verhandelbar setzen" bekommt endlich eine echte Wirkung
   und darf das auch sagen.

**Prüfschritt.** Eine Stelle mit drei Muss-Kriterien anlegen, eines auf „flexibel" setzen, einreichen.
Dann `job_skill_requirements` für diese `job_id` prüfen: drei Zeilen, Gewichte 1.0 / 1.0 / 0.3.

**Risiko.** Mittel — dies ist die einzige Maßnahme, die **das Matching verändert**. Kandidaten, die bisher
ausgeschlossen wurden, erscheinen künftig. Das ist die Absicht, sollte aber an einer Stelle mit bekanntem
Kandidatenbestand gegengeprüft werden.
**Abhängigkeit:** sinnvoll erst nach M3, weil der Coverage-Gate-Effekt sonst schwer zuzuordnen ist.
**Rollback.** Gewichte wieder hart auf 1.0/0.5.

---

# Begleitende Streichungen

Ohne eigene Maßnahme, aber Teil desselben Auslieferungspakets — jeweils wenige Zeilen:

| Was | Wo | Warum |
|---|---|---|
| Reveal-Timer (7 × 280 ms + 350 ms) | [JobIntakeStudio.tsx:316-324](src/components/dashboard/JobIntakeStudio.tsx:316) | Inszenierte Wartezeit **nach** getaner Arbeit. Der Spinner während des echten Calls bleibt — er ist ehrlich. |
| Toter „Fertig"-Knopf | [DynamicBriefing.tsx:268](src/components/dashboard/intake/DynamicBriefing.tsx:268), [IntakeBriefing.tsx:380](src/components/dashboard/IntakeBriefing.tsx:380) | Beide hängen an `onDone={() => undefined}` ([:632](src/components/dashboard/JobIntakeStudio.tsx:632)). |
| „Keine Auffälligkeiten — die Recruiter haben, was sie brauchen." | [QualityCheck.tsx:113-115](src/components/dashboard/intake/QualityCheck.tsx:113) | Im KI-Pfad **zwingend** bei null Antworten, weil `openQuestions` hart auf `[]` gesetzt wird ([:641](src/components/dashboard/JobIntakeStudio.tsx:641)). |
| **Beide** Fortschrittszahlen | Kopf [:517-520](src/components/dashboard/JobIntakeStudio.tsx:517) und Reife [QualityCheck.tsx:92](src/components/dashboard/intake/QualityCheck.tsx:92) | `0,6 × Briefing + 0,4 × Formularpunkte` steht bei null Antworten und vollem Profil bereits bei 40 und erreicht bei 42 % exakt 65. Ersatz: eine Zeile *„beantwortet: 3 · offen: Vakanzgrund, Erfolg nach 12 Monaten"*. |
| Falscher Boost-Erfolg | [JobBoostDialog.tsx:66-69](src/components/jobs/JobBoostDialog.tsx:66) | `setTimeout(1000)`, Erfolgs-Toast, `// TODO: Implement actual boost notification`. |
| Widersprüchliche SLA-Zusagen | „ca. 4 Std" [JobIntakeStudio.tsx:666-674](src/components/dashboard/JobIntakeStudio.tsx:666) vs. „unter 24 Std" [JobsList.tsx:427](src/pages/dashboard/JobsList.tsx:427) | Faktor 6 für denselben Prüfschritt, beide ungemessen. Bis zur Messung: Zeitangabe streichen. |
| `annual_revenue`, `founded_year` als Vollständigkeitspflicht | [ProfileCompletenessCard.tsx:29-37](src/components/dashboard/ProfileCompletenessCard.tsx:29) | Exaktwerte in einem Produkt, das Anonymität verkauft. Bänder statt Kennzahlen. |
| Duzen | [ProfileCompletenessCard.tsx:65,68,89](src/components/dashboard/ProfileCompletenessCard.tsx:65), [ClientSettings.tsx:197,214,304,344,401](src/pages/dashboard/ClientSettings.tsx:197) | Einziger Screen, der duzt; das übrige Produkt siezt. |
| Unwahrer Nutzensatz im Firmenprofil | [ProfileCompletenessCard.tsx](src/components/dashboard/ProfileCompletenessCard.tsx) | „Diese Infos werden Recruitern angezeigt" — `company_profiles` ist für Recruiter per RLS gesperrt. Ersatz: *„Jede Angabe spart Ihnen bei jeder neuen Stelle eine Frage."* |

---

# Was dieses Paket ausdrücklich **nicht** tut

- **Es leitet `/dashboard/jobs/new` nicht auf das Studio um.** Richtig als Ziel, heute schädlich als Schritt:
  Ohne `parse-job-url` bliebe dem Kunden sonst gar kein funktionierender Weg. Erst nach M1 **und** dem Deploy.
- **Es zeigt keine Marktzahlen.** Weder Reichweite noch Gehaltsvergleich. Für keine der vier vorgeschlagenen
  Varianten konnte ein Agent eine belastbare Bestandszahl vorlegen. Eine erfundene Marktzahl ist schlimmer als keine.
- **Es baut keine Zusammenarbeit** (Kommentare, Versionen, geteilte Links). Die drei Tabellen existieren nicht,
  und keine der Funktionen verändert eine Suchentscheidung des Kunden.
- **Es repariert Contracting nicht.** Fünf Felder ohne Zielspalte werden gekennzeichnet, nicht erweitert.
  Vorher Spalten, dann Kapitel — die andere Reihenfolge vervielfacht den Verlust, und bei AÜG-Fragen sind
  verlorene Antworten juristisch heikel.

---

# Reihenfolge der Auslieferung

```
M5 + M6 + Streichungen   →  wirken sofort auf live sichtbare Screens, unabhängig von allem
M1                       →  macht das Studio erreichbar
M2 + M3                  →  Ehrlichkeit und Inhalt im nun erreichbaren Studio
M4                       →  Rechtsprüfung greift im Premium-Pfad
M7                       →  Matching-Wirkung, zuletzt und einzeln prüfbar
```

Die erste Gruppe kann sofort raus und ist unabhängig testbar. M7 sollte allein ausgeliefert werden, damit die
Matching-Veränderung eindeutig zuzuordnen ist.

---

# Abnahmekriterien für das Gesamtpaket

1. Ein Kunde kann eine Stelle vollständig anlegen und übergeben, **ohne dass eine einzige Edge Function antwortet**.
2. Kein Erfolgs-Toast erscheint für Daten, die nicht gespeichert wurden.
3. Vakanzgrund, Dringlichkeit und Entscheider stehen nach dem Übergeben in `jobs` — nachprüfbar per REST.
4. Ein Ausschlusskriterium mit Altersbezug löst in **beiden** Briefing-Pfaden eine Warnung aus.
5. Kein Job zeigt „Recruiter arbeitet", wenn die letzte Einreichung älter als 14 Tage ist.
6. Kein Job älter als 45 Tage ohne Bewegung zeigt ein grünes Banner.
7. `job_skill_requirements.weight` spiegelt die vom Kunden gesetzte Verhandelbarkeit.
8. `tsc --noEmit` fehlerfrei, `npm run build` grün.
