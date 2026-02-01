

# Plan: Dashboard-Ladeprobleme beheben

## Problem-Analyse

Nach eingehender Untersuchung habe ich folgende Probleme identifiziert:

### 1. React forwardRef Warnung (JobHealthIndicator)
Die `Badge`-Komponente wird als `TooltipTrigger` mit `asChild` verwendet, aber `Badge` unterstützt keine Refs. Dies verursacht eine React-Warnung, blockiert aber nicht das Dashboard.

**Betroffene Datei**: `src/components/jobs/JobHealthIndicator.tsx`

### 2. useFunnelMetrics Query Problem  
Die Query gibt `undefined` zurück wenn keine Daten gefunden werden, was React Query als Fehler behandelt.

**Betroffene Datei**: `src/hooks/useFunnelAnalytics.ts`

### 3. Potentielles Auth-State Timing Problem
Die `role` wird asynchron nach dem User geladen, was zu Rendering-Problemen führen kann.

## Geplante Änderungen

### Schritt 1: Badge-Komponente mit forwardRef erweitern

```text
Datei: src/components/ui/badge.tsx

Änderung:
- Umwandlung von function Badge zu React.forwardRef
- Ermöglicht dass Radix UI Refs korrekt weiterleiten kann
```

### Schritt 2: useFunnelMetrics Query-Fix

```text
Datei: src/hooks/useFunnelAnalytics.ts

Änderung:
- Rückgabewert von undefined zu null ändern
- null ist ein erlaubter Wert in React Query, undefined nicht
```

### Schritt 3: Auth-State Absicherung (optional)

Falls das Problem weiterhin besteht, können wir:
- Loading-State in ProtectedRoute verbessern
- Sicherstellen dass role geladen wird bevor Dashboard rendert

---

## Technische Details

### Badge.tsx - Vorher:
```typescript
function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

### Badge.tsx - Nachher:
```typescript
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  }
);
Badge.displayName = "Badge";
```

### useFunnelAnalytics.ts - Vorher:
```typescript
return data?.[0] as FunnelMetrics | null;
```

### useFunnelAnalytics.ts - Nachher:
```typescript
return (data?.[0] ?? null) as FunnelMetrics | null;
```

---

## Erwartetes Ergebnis

Nach den Änderungen:
- Keine React-Warnungen mehr in der Konsole
- Dashboard lädt ohne Probleme
- Query-Fehler werden vermieden

