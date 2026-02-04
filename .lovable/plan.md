
# Plan: KI-Einschätzung - Smart Caching mit Änderungserkennung

## Das Problem

Die KI-Einschätzung (`ClientCandidateSummaryCard`) wird derzeit bei **jedem Laden** automatisch neu generiert, wenn sie als "outdated" erkannt wird. Das führt zu:
- Ständig wechselnden Einschätzungen ohne Datenänderung
- Unnötigem API-Verbrauch
- Inkonsistenten Anzeigen für Recruiter

## Die Lösung

Implementiere ein intelligentes Caching-System das nur dann regeneriert, wenn sich die Quelldaten tatsächlich geändert haben.

---

## Änderungen

### 1. Edge Function - Änderungserkennung

**Datei:** `supabase/functions/client-candidate-summary/index.ts`

Bevor die KI aufgerufen wird, prüfen ob Quelldaten neuer sind als das existierende Summary:

```typescript
// Prüfe ob Summary existiert und ob Quelldaten neuer sind
const { data: existingSummary } = await supabase
  .from('candidate_client_summary')
  .select('generated_at')
  .eq('candidate_id', candidateId)
  .maybeSingle();

if (existingSummary && !force) {
  const summaryDate = new Date(existingSummary.generated_at);
  
  // Prüfe ob Kandidat/Interview neuer als Summary
  const candidateUpdated = new Date(candidate.updated_at);
  const interviewUpdated = interviewNotes ? new Date(interviewNotes.updated_at) : null;
  
  const sourceDataNewer = 
    candidateUpdated > summaryDate ||
    (interviewUpdated && interviewUpdated > summaryDate);
    
  if (!sourceDataNewer) {
    // Daten nicht geändert - verwende existierendes Summary
    return new Response(JSON.stringify({ 
      success: true, 
      cached: true,
      message: 'Summary ist aktuell'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }});
  }
}
```

### 2. Hook - Kein Auto-Regenerate mehr

**Datei:** `src/hooks/useClientCandidateSummary.ts`

- Auto-Regeneration komplett entfernen
- Nur noch manuelles Regenerieren mit "Force"-Option
- Alter-Check bleibt für UI-Hinweis (z.B. "Letzte Aktualisierung vor 30 Tagen")

**Änderungen:**
- Zeile 129-133: `isOutdated` Logik entfernen
- Hook gibt nur noch `summary` zurück, keine Auto-Regeneration

### 3. Component - Nur einmal generieren wenn neu

**Datei:** `src/components/candidates/ClientCandidateSummaryCard.tsx`

- Auto-Generate nur wenn **kein** Summary existiert (erstes Mal)
- Button "Aktualisieren" für manuelle Regenerierung hinzufügen
- Anzeige wann zuletzt generiert wurde

**Änderungen:**
```typescript
// Nur generieren wenn KEIN Summary existiert (nicht bei "outdated")
useEffect(() => {
  if (!loading && !summary && !generating && candidateId && !hasTriedGenerate.current) {
    hasTriedGenerate.current = true;
    generateSummary({ silent: true });
  }
}, [loading, summary, generating, candidateId]);

// Manueller Refresh-Button
<Button 
  variant="ghost" 
  size="sm" 
  onClick={() => generateSummary({ force: true })}
>
  <RefreshCcw className="h-3 w-3 mr-1" />
  Aktualisieren
</Button>

// Anzeige: "Erstellt am {datum}"
<span className="text-xs text-muted-foreground">
  Erstellt {format(new Date(summary.generated_at), 'dd.MM.yyyy')}
</span>
```

---

## Zusammenfassung der Logik

| Situation | Aktion |
|-----------|--------|
| Kein Summary vorhanden | Auto-Generieren (einmalig) |
| Summary existiert, keine Datenänderung | Bestehendes anzeigen |
| Summary existiert, Kandidat/Interview geändert | Edge Function regeneriert |
| Benutzer klickt "Aktualisieren" | Force-Regenerierung |

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `supabase/functions/client-candidate-summary/index.ts` | Änderungserkennung (`updated_at` Vergleich), Skip wenn aktuell |
| `src/hooks/useClientCandidateSummary.ts` | Auto-Regeneration entfernen |
| `src/components/candidates/ClientCandidateSummaryCard.tsx` | Refresh-Button, Datum-Anzeige |

---

## Erwartetes Verhalten nach Änderung

1. **Erster Besuch**: KI-Einschätzung wird automatisch erstellt
2. **Wiederholte Besuche**: Bestehendes Summary wird angezeigt (keine Regenerierung)
3. **Nach Interview-Änderung**: Nächster API-Call erkennt `interview.updated_at > summary.generated_at` und regeneriert
4. **Manuell**: Recruiter kann "Aktualisieren" klicken für Force-Regenerierung
