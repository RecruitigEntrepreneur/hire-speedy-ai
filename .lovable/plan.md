

# Plan: Kalender-Verbindung direkt im Interview-Wizard

## Problem

Im Interview-Wizard Step 2 (Termine) wird angezeigt:
- 🟠 "Kein Kalender verbunden"

Aber es gibt **keinen Button zum Verbinden**! Der User muss erst zu `/dashboard/integrations` navigieren, was umständlich ist und oft übersehen wird.

---

## Lösung

In Step 2 einen **"Jetzt verbinden"** Button hinzufügen, der direkt den OAuth-Flow startet:

```text
┌─────────────────────────────────────────────────────────────────┐
│  📅 Terminvorschläge                                            │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🟠 Kein Kalender verbunden                               │  │
│  │                                                            │  │
│  │  Mit verbundenem Kalender sehen Sie belegte Zeiten und    │  │
│  │  Termine werden automatisch eingetragen.                  │  │
│  │                                                            │  │
│  │  [🔷 Outlook verbinden] [🟢 Google verbinden]             │  │
│  │                                                            │  │
│  │  oder [Später verbinden ↗]                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [🤖 Smart Suggest - 5 freie Slots vorschlagen]                │
│  ...                                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technische Umsetzung

### Datei: `InterviewWizardStep2Slots.tsx`

**1. Neue Imports hinzufügen:**
```typescript
import { useMicrosoftAuth } from '@/hooks/useMicrosoftAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Link } from 'lucide-react';
```

**2. Hooks nutzen:**
```typescript
const { isConnected: msConnected, connectMicrosoft, loading: msLoading } = useMicrosoftAuth();
const { isConnected: googleConnected, connectGoogle, loading: googleLoading } = useGoogleAuth();
```

**3. Calendar Status Section erweitern (Zeilen 60-79):**

Aktuell nur ein kleiner Status-Indikator. Neu: Prominente Connection-Box wenn nicht verbunden.

```typescript
{/* Calendar Connection Banner */}
{!isConnected && (
  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
    <div className="flex items-start gap-3">
      <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</span>
      <div className="flex-1">
        <h4 className="font-medium text-amber-800 dark:text-amber-300">
          Kein Kalender verbunden
        </h4>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
          Mit verbundenem Kalender sehen Sie belegte Zeiten und Termine werden automatisch eingetragen.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button 
            size="sm" 
            onClick={connectMicrosoft}
            disabled={msLoading}
            className="bg-[#0078d4] hover:bg-[#0078d4]/90"
          >
            {msLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <span className="mr-2">🔷</span> Outlook verbinden
          </Button>
          <Button 
            size="sm"
            variant="outline"
            onClick={connectGoogle}
            disabled={googleLoading}
          >
            {googleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <span className="mr-2">🟢</span> Google verbinden
          </Button>
        </div>
        <Link 
          to="/dashboard/integrations" 
          className="text-xs text-amber-600 hover:underline mt-2 inline-flex items-center gap-1"
        >
          Später in Einstellungen verbinden
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  </div>
)}

{/* Connected Status */}
{isConnected && (
  <div className="flex items-center gap-2 text-sm bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
    <span className="w-2 h-2 rounded-full bg-green-500" />
    <span className="text-green-700 dark:text-green-400">
      Kalender verbunden: {provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}
    </span>
  </div>
)}
```

---

## Erwartetes Ergebnis

1. **Ohne verbundenen Kalender:**
   - Prominente gelbe Info-Box mit Erklärung
   - Zwei Buttons: "Outlook verbinden" und "Google verbinden"
   - Link zu Einstellungen falls später gewünscht

2. **Mit verbundenem Kalender:**
   - Grüne Bestätigung mit Provider-Name
   - Smart Suggest nutzt echte Verfügbarkeit
   - Belegte Zeiten werden ausgegraut

3. **Nach Klick auf "Verbinden":**
   - OAuth-Flow startet
   - Nach Rückkehr wird User zu `/dashboard/integrations` geleitet (dort sieht er Bestätigung)
   - Beim nächsten Wizard-Öffnen ist Kalender verbunden

---

## Geänderte Dateien

| Datei | Änderung |
|-------|----------|
| `src/components/dialogs/interview-wizard/InterviewWizardStep2Slots.tsx` | Kalender-Verbindungs-Banner hinzufügen |

