

# Plan: "Your Talent Submissions" Widget im Recruiter Dashboard

## Analyse

Das aktuelle Recruiter Dashboard zeigt:
- Stats (inkl. Submissions-Anzahl)
- Quick-Action Link zu `/recruiter/submissions`

Es fehlt: **Eine sofortige Übersicht der aktuellen Submissions mit Status und wichtigen Infos** - der Recruiter muss erst auf eine andere Seite navigieren.

## Empfehlung: Platzierung

**Beste Position: Zwischen "Available Jobs" und "Quick Actions"**

Begründung:
- Jobs anzeigen → Submissions dazu → Aktionen durchführen = natürlicher Workflow
- Der Recruiter sieht sofort: "Was läuft gerade?" ohne extra Navigation
- Konsistent mit dem restlichen Dashboard-Layout (Card-basiert)

```text
+--------------------------------------------------+
|  Header + Verification Banner                    |
+--------------------------------------------------+
|  Performance Score        |   Compact Task List  |
+--------------------------------------------------+
|  Stats Grid (4 Cards)                            |
+--------------------------------------------------+
|  Available Jobs                                  |
|  (neueste Job-Opportunities)                     |
+--------------------------------------------------+
|  📋 YOUR TALENT SUBMISSIONS  ← NEU               |
|  (neueste Einreichungen mit Status)              |
+--------------------------------------------------+
|  Quick Actions (3 Cards)                         |
+--------------------------------------------------+
```

## Wichtige Infos für Recruiter

Basierend auf der bestehenden `RecruiterSubmissions.tsx` und den Anforderungen:

| Information | Warum wichtig |
|-------------|---------------|
| **Kandidatenname** | Identifikation |
| **Job-Titel** | Welche Stelle? |
| **Status-Badge** | Wo steht der Prozess? |
| **Match Score** | Qualität der Einreichung |
| **Tage seit letztem Update** | Handlungsbedarf? |
| **Interview-Termin** | Wenn geplant |
| **Alerts-Badge** | Kritische Aktionen nötig? |
| **Client-Feedback** | Rückmeldung vom Kunden |

## Technische Umsetzung

### Neue Komponente: `RecentSubmissionsCard.tsx`

```text
src/components/recruiter/RecentSubmissionsCard.tsx
```

**Features:**
- Zeigt die letzten 5 Submissions
- Kompakte Karten-Ansicht mit wichtigsten Infos
- Status-farbcodierte Badges
- Quick-Actions (Anrufen, Email, Detail-Link)
- "Alle anzeigen" Link zur vollen Seite
- Alert-Indikator für Kandidaten mit offenen Tasks

### Struktur pro Submission-Item:

```text
+----------------------------------------------------------+
| [Avatar] Max Mustermann                    ⚠️ 2 Alerts   |
|          Senior Developer → Buchhalter (m/w/d)           |
| -------------------------------------------------------- |
| [🟢 In Prüfung]  Match: 85%   📅 Interview: 30.01.      |
| -------------------------------------------------------- |
| 📝 "Interessanter Kandidat, bitte Gehaltsvorstellung..." |
| -------------------------------------------------------- |
| [📞] [✉️] [→ Details]                     Vor 2 Tagen   |
+----------------------------------------------------------+
```

### Integration in Dashboard

**Datei:** `src/pages/recruiter/RecruiterDashboard.tsx`

1. Neue State-Variable für `recentSubmissions`
2. Fetch in `fetchDashboardData()` erweitern
3. Neue Card-Sektion nach "Available Jobs" einfügen

### Daten-Query

```sql
SELECT 
  s.*,
  c.full_name, c.email, c.phone,
  j.title as job_title, j.company_name,
  (SELECT COUNT(*) FROM influence_alerts WHERE submission_id = s.id AND status = 'active') as alert_count,
  i.scheduled_at as interview_date
FROM submissions s
JOIN candidates c ON s.candidate_id = c.id
JOIN jobs j ON s.job_id = j.id
LEFT JOIN interviews i ON i.submission_id = s.id AND i.status = 'scheduled'
WHERE s.recruiter_id = :user_id
ORDER BY s.updated_at DESC
LIMIT 5
```

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/components/recruiter/RecentSubmissionsCard.tsx` | **NEU** - Wiederverwendbare Komponente für Submissions-Vorschau |
| `src/pages/recruiter/RecruiterDashboard.tsx` | Import + Fetch + Rendering der neuen Komponente |

## Erwartetes Ergebnis

1. **Sofortige Übersicht:** Recruiter sieht die 5 neuesten Submissions direkt im Dashboard
2. **Handlungsorientiert:** Status, Alerts und nächste Schritte auf einen Blick
3. **Quick Actions:** Direkte Kontaktmöglichkeiten ohne Navigation
4. **Konsistentes Design:** Passt zum bestehenden Dashboard-Stil
5. **Performance:** Nur 5 Items geladen, keine zusätzliche Navigation nötig

