

# Job-Qualitaetsscore: Realistischere Berechnung

## Problem

Der Score zeigt 30/100 obwohl der Job gut ausgefuellt ist (Gehalt, 2.500+ Zeichen Beschreibung, Branche, Remote-Type). Das liegt an zwei Ursachen:

1. **`intake_completeness` ist NULL** und zaehlt 40% -- der groesste Brocken faellt komplett weg
2. **Viele ausgefuellte Felder werden ignoriert**: Industry, Remote-Type, Employment-Type, Location fliessen nicht in den Score ein
3. **Skills ist ein leeres Array** obwohl im Text Skills beschrieben sind

## Loesung: Scoring-Formel ueberarbeiten

Statt sich auf `intake_completeness` zu verlassen (das oft NULL ist), berechnen wir den Score aus den tatsaechlich vorhandenen Feldern.

### Neue Gewichtung (100 Punkte gesamt)

| Kriterium | Punkte | Logik |
|-----------|--------|-------|
| Gehalt angegeben | 20 | salary_min oder salary_max vorhanden |
| Beschreibung | 15 | >200 Zeichen: 15, >50: 10, sonst 0 |
| Anforderungen | 10 | requirements vorhanden und >50 Zeichen |
| Skills definiert | 15 | skills Array hat Eintraege |
| Benefits | 10 | hasBenefits = true |
| Branche angegeben | 5 | industry nicht leer |
| Remote-Type angegeben | 5 | remote_type nicht leer |
| Beschaeftigungsart | 5 | employment_type nicht leer |
| Standort angegeben | 5 | location nicht leer |
| Intake-Daten | 10 | intake_completeness > 0 (Bonus, nicht Pflicht) |

### Aenderungen

**`src/components/client/JobQualityScoreCard.tsx`**

- Interface erweitern: `industry`, `remote_type`, `employment_type`, `location` als optionale Props aufnehmen
- `calculateQualityScore` komplett ueberarbeiten mit der neuen Gewichtung
- Neue Checklist-Items hinzufuegen: Branche, Remote-Type, Standort
- Suggestions ergaenzen fuer fehlende Felder

**`src/pages/dashboard/ClientJobDetail.tsx`**

- Die neuen Felder (`industry`, `remote_type`, `employment_type`, `location`) an die `JobQualityScoreCard` durchreichen -- diese sind bereits im `job`-Objekt vorhanden

### Erwartetes Ergebnis fuer den aktuellen Job

Mit der neuen Formel:
- Gehalt: +20
- Beschreibung (2.500+ Zeichen): +15
- Anforderungen (980 Zeichen): +10
- Remote-Type (onsite): +5
- Employment-Type (full-time): +5
- Branche (Militar, Maschinenbau): +5
- Skills (leer): +0
- Benefits: +0 oder +10
- Intake: +0
- Location (leer): +0

**Neuer Score: 60-70 statt 30** -- deutlich realistischer.

