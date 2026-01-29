

# Plan: "Heute zu tun" als horizontale Ticket-Karten

## Aktuelles Problem

Die "Heute zu tun" Tasks werden aktuell als **vertikale Listen-Zeilen** dargestellt:
- Jeder Task ist eine einzelne Zeile mit komprimiertem Text
- Wenig visuelle Differenzierung zwischen Tasks
- Prioritäts-Sektionen untereinander gestapelt

## Neue Lösung: Horizontale Ticket-Karten

Statt vertikaler Zeilen werden Tasks als **Karten nebeneinander** dargestellt:

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Heute zu tun                                        [5]  [2 kritisch] [3 hoch] │
├──────────────────────────────────────────────────────────────────────────────────┤
│  Hoch                                                                            │
│  ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐         │
│  │ ⚠️ Ulf Jaeger       │  │ ⚠️ Boris Becker    │  │ ⚠️ Dmitrii Shadrin │  →     │
│  │ Senior Java & AWS   │  │ Senior Java & AWS   │  │ Product Manager    │         │
│  │ @ Trivium eSolutions│  │ @ Trivium eSolutions│  │ @ InnoSoft Sol.    │         │
│  ├────────────────────┤  ├────────────────────┤  ├────────────────────┤         │
│  │ [Kontaktieren]     │  │ [Kontaktieren]     │  │ [Kontaktieren]     │         │
│  │ [📞] [✉️] [✓]      │  │ [📞] [✉️] [✓]      │  │ [📞] [✉️] [✓]      │         │
│  └────────────────────┘  └────────────────────┘  └────────────────────┘         │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Ticket-Karten Design

Jede Karte enthält:

| Element | Beschreibung |
|---------|--------------|
| **Prioritäts-Indikator** | Farbcodierter Rand (rot=kritisch, amber=hoch) |
| **Kandidatenname** | Prominent oben |
| **Job-Kontext** | Position @ Firma |
| **Action-Badge** | "Kontaktieren", "Nachfassen", etc. |
| **Quick Actions** | Telefon, Email, Erledigt-Buttons |

## Technische Änderungen

### Datei: `src/components/influence/CompactTaskList.tsx`

**Änderungen:**
1. **Layout-Umstellung:** Von `space-y-1.5` (vertikal) zu horizontalem Flex-Container mit `ScrollArea`
2. **Neue Karten-Komponente:** `TaskCard` statt `renderTaskRow` 
3. **Horizontales Scrolling:** Mit `ScrollBar orientation="horizontal"`
4. **Responsive:** Auf Mobile 2 Karten sichtbar, Desktop 3-4 Karten

### Neue Karten-Struktur:

```text
┌─────────────────────────┐
│ [⚠️ Icon] Ulf Jaeger    │  ← Name + Priority-Icon
│ Senior Java & AWS Lead  │  ← Job Title
│ @ Trivium eSolutions    │  ← Company
├─────────────────────────┤
│ [Kontaktieren]          │  ← Action Badge
├─────────────────────────┤
│ [📞 Anrufen] [✉️ Email] │  ← Quick Actions
│        [✓ Erledigt]     │
└─────────────────────────┘
```

## Erwartetes Ergebnis

1. **Visuelle Klarheit:** Jeder Task ist eine eigene Karte mit allen wichtigen Infos
2. **Horizontales Scrolling:** Bei vielen Tasks scrollbar nach rechts
3. **Prioritäts-Gruppierung:** Kritische Tasks in roter Sektion, hohe in amber
4. **Bessere Quick Actions:** Mehr Platz für Buttons pro Karte
5. **Ticket-Feeling:** Wie Kanban-Cards/Tickets die man abarbeiten kann

