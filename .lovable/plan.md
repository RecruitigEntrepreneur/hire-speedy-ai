
# Plan: Fix Karriere-Timeline Datums-Parsing

## Problem-Analyse

### Fehler im Console Log
```
Error inserting experiences: {
  "code": "22007",
  "message": "invalid input syntax for type date: \"2023-06\""
}
```

### Ursache
1. Die `candidate_experiences` Tabelle hat `start_date` und `end_date` als **DATE**-Typ
2. PostgreSQL DATE erwartet das Format `YYYY-MM-DD`
3. Die AI gibt Daten wie `"2023-06"` (YYYY-MM) zurück
4. PostgreSQL kann "2023-06" nicht parsen → Insert schlägt fehl → Experiences werden nicht gespeichert

## Lösung

Die Datumsfelder vor dem Speichern normalisieren - unvollständige Daten zu gültigen Dates konvertieren:

| AI-Output | Konvertiert zu |
|-----------|----------------|
| `"2023-06"` | `"2023-06-01"` |
| `"2023"` | `"2023-01-01"` |
| `"Juni 2023"` | `"2023-06-01"` |
| `null` | `null` |

## Änderungen

### Datei: `src/hooks/useCvParsing.ts`

1. **Neue Helper-Funktion für Datums-Normalisierung:**

```typescript
const normalizeDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  
  // Bereits im YYYY-MM-DD Format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // YYYY-MM Format → YYYY-MM-01
  if (/^\d{4}-\d{2}$/.test(dateStr)) {
    return `${dateStr}-01`;
  }
  
  // YYYY Format → YYYY-01-01
  if (/^\d{4}$/.test(dateStr)) {
    return `${dateStr}-01-01`;
  }
  
  // Deutsche Monatsnamen: "Juni 2023" oder "Jun 2023"
  const monthMap: Record<string, string> = {
    'januar': '01', 'jan': '01',
    'februar': '02', 'feb': '02',
    'märz': '03', 'mär': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'mai': '05',
    'juni': '06', 'jun': '06',
    'juli': '07', 'jul': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09',
    'oktober': '10', 'okt': '10', 'oct': '10',
    'november': '11', 'nov': '11',
    'dezember': '12', 'dez': '12', 'dec': '12'
  };
  
  const germanMatch = dateStr.toLowerCase().match(/(\w+)\s+(\d{4})/);
  if (germanMatch) {
    const month = monthMap[germanMatch[1]];
    const year = germanMatch[2];
    if (month && year) {
      return `${year}-${month}-01`;
    }
  }
  
  // Fallback: null wenn nicht parsebar
  console.warn(`Could not parse date: ${dateStr}`);
  return null;
};
```

2. **Anwendung beim Speichern der Experiences (Zeile 225-235):**

```typescript
// VORHER:
const experiencesData = parsedData.experiences.map((exp, index) => ({
  candidate_id: candidateId,
  company_name: exp.company_name,
  job_title: exp.job_title,
  location: exp.location,
  start_date: exp.start_date,          // "2023-06" → FEHLER!
  end_date: exp.end_date,               // "2023-06" → FEHLER!
  is_current: exp.is_current,
  description: exp.description,
  sort_order: index,
}));

// NACHHER:
const experiencesData = parsedData.experiences.map((exp, index) => ({
  candidate_id: candidateId,
  company_name: exp.company_name,
  job_title: exp.job_title,
  location: exp.location,
  start_date: normalizeDate(exp.start_date),   // "2023-06" → "2023-06-01" ✓
  end_date: normalizeDate(exp.end_date),       // "2023-06" → "2023-06-01" ✓
  is_current: exp.is_current,
  description: exp.description,
  sort_order: index,
}));
```

3. **Logging verbessern für Debugging:**

```typescript
if (parsedData.experiences.length > 0) {
  console.log(`Inserting ${parsedData.experiences.length} experiences for candidate ${candidateId}`);
  
  const experiencesData = parsedData.experiences.map((exp, index) => ({
    // ...
  }));
  
  console.log('Experience dates normalized:', experiencesData.map(e => ({
    company: e.company_name,
    start: e.start_date,
    end: e.end_date
  })));

  const { error: expError } = await supabase
    .from('candidate_experiences')
    .insert(experiencesData);

  if (expError) {
    console.error('Error inserting experiences:', expError);
  } else {
    console.log('Experiences inserted successfully');
  }
}
```

## Dateien

| Datei | Änderung |
|-------|----------|
| `src/hooks/useCvParsing.ts` | Helper-Funktion `normalizeDate()` hinzufügen und bei Experience-Insert anwenden |

## Test nach Implementierung

1. Kandidat "Juliane Hotarek" öffnen
2. "CV erneut parsen" Button klicken
3. Karriere-Timeline sollte jetzt die Berufserfahrung anzeigen

## Erwartetes Ergebnis

- Datumsfelder wie "2023-06" werden zu "2023-06-01" normalisiert
- PostgreSQL akzeptiert das Format
- Experiences werden erfolgreich gespeichert
- Karriere-Timeline zeigt die Stationen an
