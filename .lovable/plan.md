

# T-002 Fix: SimilarCandidates Route-Bug + Kandidatenhoheit-Pruefung

## Analyse-Ergebnis

### Problem 1: Falscher Link -- BESTAETIGT
Die Komponente verlinkt auf `/dashboard/candidates/${candidate.id}` (Client-Route). Muss `/recruiter/candidates/${candidate.id}` sein.

### Problem 2: Kandidatenhoheit -- KEIN PROBLEM (RLS schuetzt bereits)

Die Pruefung der Datenbank ergibt:

**RLS-Policy auf `candidates`-Tabelle:**
```
"Recruiters can manage their own candidates" → auth.uid() = recruiter_id
```

**Alle 3 RPC-Funktionen sind `SECURITY INVOKER` (nicht `SECURITY DEFINER`):**

| Funktion | Security Definer? |
|----------|-------------------|
| `find_similar_candidates` | Nein (INVOKER) |
| `find_similar_candidates_by_skills` | Nein (INVOKER) |
| `search_candidates_hybrid` | Nein (INVOKER) |

Das bedeutet: Die RPC-Funktionen laufen mit den Rechten des Aufrufers. Die RLS-Policy `auth.uid() = recruiter_id` greift automatisch. **Recruiter A sieht nur seine eigenen Kandidaten als "aehnlich"** -- niemals die von Recruiter B.

Auch der erste Schritt im Hook (Embedding des Quell-Kandidaten laden) ist RLS-geschuetzt:
```typescript
supabase.from('candidates').select('embedding').eq('id', candidateId).single()
```
Ein Recruiter kann nur das Embedding seiner eigenen Kandidaten laden.

**Ergebnis: Keine DB-Aenderung noetig. Kandidatenhoheit ist gewahrt.**

---

## Aenderungen

### Datei 1: `src/components/candidates/SimilarCandidates.tsx`

**Einzige Aenderung** -- Zeile 75, Route-Fix:

Vorher:
```tsx
to={`/dashboard/candidates/${candidate.id}`}
```

Nachher:
```tsx
to={`/recruiter/candidates/${candidate.id}`}
```

### Keine weiteren Aenderungen noetig

- `useSimilarCandidates.ts`: Keine Aenderung (RLS schuetzt)
- DB-Funktionen: Keine Aenderung (SECURITY INVOKER + RLS = korrekt)
- `useHybridCandidateSearch`: Keine Aenderung (gleicher Schutz)

---

## Zusammenfassung

| Was | Status | Aufwand |
|-----|--------|---------|
| Route-Fix `/dashboard/` zu `/recruiter/` | Fix noetig | XS (1 Zeile) |
| Kandidatenhoheit via RLS | Bereits geschuetzt | Keiner |
| DB-Funktionen aendern | Nicht noetig | Keiner |

