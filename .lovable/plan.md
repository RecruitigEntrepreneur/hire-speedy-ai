

# Plan: Karriere-Timeline Beschreibung kürzen

## Problem

Die Job-Beschreibung im CV wird als langer Fließtext angezeigt:

> "Etablierung von Scrum und Kanban in zwei Entwicklungsteams und Weiterentwicklung der Teams durch alle Team-Phasen. Optimierung der Team-Performance durch proaktive Beseitigung von Impediments..."

Das ist zu viel für eine Timeline-Übersicht. Details kann man im CV selbst nachlesen.

---

## Lösung: Zwei Maßnahmen

### 1. AI-Prompt anpassen (Quelle)

**Datei:** `supabase/functions/parse-cv/index.ts`

Im Schema für `description` eine klare Anweisung hinzufügen:

```typescript
// Zeile 83-94 ändern:
experiences: {
  type: "array",
  items: {
    type: "object",
    properties: {
      company_name: { type: "string" },
      job_title: { type: "string" },
      start_date: { type: "string" },
      end_date: { type: "string" },
      is_current: { type: "boolean" },
      description: { 
        type: "string",
        description: "Fasse die Tätigkeit in MAX 3-4 kurzen Stichpunkten zusammen (Bullet Points mit •). Keine langen Fließtexte!"
      }
    },
    required: ["company_name", "job_title", "description"]
  }
}
```

**Zusätzlich im System-Prompt (Zeile 36-49) ergänzen:**

```typescript
const systemPrompt = `Du bist ein erfahrener HR-Experte und CV-Parser...

REGELN:
...
- Experience-Beschreibungen: MAX 3-4 Bullet Points (•), kurz und prägnant. KEINE Fließtexte!
...`;
```

### 2. Frontend mit Collapsible (Fallback)

**Datei:** `src/components/candidates/CandidateExperienceTimeline.tsx`

Falls die AI doch längere Texte liefert, zeige nur die ersten 2-3 Zeilen mit "Mehr anzeigen":

```typescript
// Neuer State für expandierte Items
const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

// Render-Logik für Beschreibung
{exp.description && (
  <div className="mt-3">
    {/* Beschreibung als Bullet Points formatieren oder kürzen */}
    {exp.description.includes('•') || exp.description.includes('-') ? (
      // Bullet Points direkt anzeigen
      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
        {exp.description
          .split(/[•\-]/)
          .filter(item => item.trim())
          .slice(0, expandedIds.has(exp.id) ? undefined : 3)
          .map((item, i) => (
            <li key={i} className="text-sm">{item.trim()}</li>
          ))}
      </ul>
    ) : (
      // Fließtext: Kürzen auf 150 Zeichen
      <p className={cn(
        "text-sm text-muted-foreground",
        !expandedIds.has(exp.id) && "line-clamp-2"
      )}>
        {exp.description}
      </p>
    )}
    
    {/* "Mehr/Weniger" Button */}
    {exp.description.length > 150 && (
      <Button 
        variant="ghost" 
        size="sm" 
        className="p-0 h-auto text-xs mt-1"
        onClick={() => toggleExpanded(exp.id)}
      >
        {expandedIds.has(exp.id) ? 'Weniger' : 'Mehr anzeigen'}
      </Button>
    )}
  </div>
)}
```

---

## Dateien

| Datei | Änderung |
|-------|----------|
| `supabase/functions/parse-cv/index.ts` | Prompt-Anweisung für kurze Bullet Points |
| `src/components/candidates/CandidateExperienceTimeline.tsx` | Collapsible + Bullet Point Formatierung |

---

## Erwartetes Ergebnis

### Vorher:
```
Scrum Master & Agile Coach
Team Internet AG | Juni 2023 – Heute

Etablierung von Scrum und Kanban in zwei Entwicklungsteams und 
Weiterentwicklung der Teams durch alle Team-Phasen. Optimierung 
der Team-Performance durch proaktive Beseitigung von Impediments 
und Flow-Optimierung. Moderation und Facilitation...
[sehr langer Text]
```

### Nachher:
```
Scrum Master & Agile Coach  
Team Internet AG | Juni 2023 – Heute

• Scrum & Kanban für 2 Entwicklungsteams etabliert
• Team-Performance durch Impediment-Management optimiert
• PO-Coaching (Story-Splitting, Priorisierung, Backlogs)

[Mehr anzeigen] ← falls mehr als 3 Punkte
```

---

## Nach Implementierung

Für bestehende Kandidaten mit langen Beschreibungen:
- **"CV erneut parsen"** Button klicken → AI generiert neue, kurze Bullet Points
- Alternativ: Frontend kürzt automatisch mit "Mehr anzeigen"

