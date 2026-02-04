

# Fix: Fließtext automatisch als Bullet Points formatieren

## Problem

Die Karriere-Timeline zeigt **keinen formatierten Text**, weil:

1. **Die Daten enthalten Fließtext** - keine `•` oder `- ` Zeichen
2. Die Frontend-Logik (Zeile 157) erkennt nur explizite Bullet-Marker
3. Der Text wird als Fließtext mit `line-clamp-2` angezeigt

**Datenbankinhalt für Juliane Hotarek:**
```
"Etablierung von Scrum und Kanban in zwei Entwicklungsteams und Weiterentwicklung 
der Teams durch alle Team-Phasen. Optimierung der Team-Performance durch 
proaktive Beseitigung von Impediments..."
```

→ Kein `•`, kein `- ` → Frontend zeigt Fließtext statt Bullet Points

---

## Lösung: Intelligente Satz-Erkennung

### Änderung in `CandidateExperienceTimeline.tsx`

Auch **Sätze** (getrennt durch `. `) als Bullet Points behandeln:

```typescript
// Zeile 155-210 ersetzen mit verbesserter Logik:

{exp.description && (
  <div className="mt-3">
    {(() => {
      // Prüfe ob bereits Bullet Points vorhanden
      const hasBullets = exp.description.includes('•') || exp.description.includes('\n- ');
      
      // Oder: Mehrere Sätze → als Bullets formatieren
      const sentences = exp.description
        .split(/[.;]/)
        .map(s => s.trim())
        .filter(s => s.length > 10);  // Nur sinnvolle Sätze
      
      const shouldFormatAsBullets = hasBullets || sentences.length >= 3;
      
      if (shouldFormatAsBullets) {
        // Bullet Points aus • oder Sätzen
        const items = hasBullets 
          ? exp.description.split(/[•]|\n-\s/).filter(s => s.trim())
          : sentences;
        
        const visibleItems = expandedIds.has(exp.id) ? items : items.slice(0, 3);
        
        return (
          <>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              {visibleItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>{item.trim()}</span>
                </li>
              ))}
            </ul>
            {items.length > 3 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-0 h-auto text-xs mt-2 text-muted-foreground"
                onClick={() => toggleExpanded(exp.id)}
              >
                {expandedIds.has(exp.id) ? (
                  <>Weniger <ChevronUp className="h-3 w-3 ml-1" /></>
                ) : (
                  <>{items.length - 3} weitere <ChevronDown className="h-3 w-3 ml-1" /></>
                )}
              </Button>
            )}
          </>
        );
      } else {
        // Kurzer Text: als Fließtext mit line-clamp
        return (
          <>
            <p className={cn(
              "text-sm text-muted-foreground",
              !expandedIds.has(exp.id) && "line-clamp-2"
            )}>
              {exp.description}
            </p>
            {exp.description.length > 150 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="p-0 h-auto text-xs mt-2"
                onClick={() => toggleExpanded(exp.id)}
              >
                {expandedIds.has(exp.id) ? 'Weniger' : 'Mehr anzeigen'}
              </Button>
            )}
          </>
        );
      }
    })()}
  </div>
)}
```

---

## Logik-Zusammenfassung

| Text-Typ | Erkennung | Anzeige |
|----------|-----------|---------|
| Bullet Points (`•`) | `includes('•')` | Als `<ul>` mit max 3 Items |
| Markdown (`- `) | `includes('\n- ')` | Als `<ul>` mit max 3 Items |
| Sätze (≥3 Sätze) | `split(/[.;]/).length >= 3` | Als `<ul>` mit max 3 Items |
| Kurzer Text | < 3 Sätze | Fließtext mit `line-clamp-2` |

---

## Datei

| Datei | Änderung |
|-------|----------|
| `src/components/candidates/CandidateExperienceTimeline.tsx` | Intelligente Satz-Erkennung für Bullet-Formatierung |

---

## Erwartetes Ergebnis

### Vorher (aktuell):
```
Etablierung von Scrum und Kanban in zwei Entwicklungsteams und 
Weiterentwicklung der Teams durch alle Team-Phasen. Optimierung...
[Mehr anzeigen]
```

### Nachher:
```
• Etablierung von Scrum und Kanban in zwei Entwicklungsteams
• Optimierung der Team-Performance durch Impediment-Management
• Moderation und Facilitation mit starker Methodenkompetenz

[4 weitere ▼]
```

---

## Alternative Option

Falls du lieber möchtest, dass die **AI die Daten neu generiert** (mit echten Bullet Points):

→ Klicke auf **"CV erneut parsen"** für Juliane Hotarek

Der neue Prompt fordert jetzt explizit `MAX 3-4 Stichpunkte mit •` an.

