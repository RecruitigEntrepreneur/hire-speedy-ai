

# Dashboard Preview: Mehr Interaktivitaet und Inhalt

## Aktuelle Situation

Das Dashboard-Preview hat 3 Tabs (Dashboard, Jobs, Kandidaten) mit statischen Daten. Zwei Sidebar-Items (Analytics, Settings) sind deaktiviert. Die Karten haben nur Hover-Effekte, aber keine echten Klick-Interaktionen.

## Geplante Verbesserungen

### 1. Zwei neue Tabs aktivieren

**Analytics-Tab** -- klickbar ueber Sidebar:
- Mini-Balkendiagramm (reine CSS-Bars, kein Recharts noetig) fuer "Submissions pro Woche"
- Drei KPIs: Time-to-Hire (23 Tage), Cost-per-Hire (2.4k), Offer-Accept-Rate (87%)
- Kleines Funnel-Diagramm (4 Stufen: 248 -> 94 -> 18 -> 6) als abnehmende Balken

**Messages-Tab** -- neuer Sidebar-Eintrag:
- 3 Mock-Chatnachrichten (Recruiter-Name, letzte Nachricht, Zeitstempel)
- Unread-Badge (rotes Dot) im Sidebar-Item
- Klick auf Nachricht zeigt Mini-Chat-Bubble-Animation

### 2. Klickbare Kandidaten-Karten

Im Dashboard-Tab (Pipeline-Bereich) und Kandidaten-Tab:
- **Klick auf einen Kandidaten** oeffnet ein kleines Inline-Detail-Panel unterhalb der Karte
- Zeigt: Kurzprofil, 3 Skills als Tags, und zwei Mini-Buttons ("Interview" / "Ablehnen")
- Klick auf einen anderen Kandidaten schliesst das vorherige Panel
- Smooth Height-Animation beim Oeffnen/Schliessen

### 3. Micro-Interactions auf Job-Karten

Im Jobs-Tab:
- Jeder Job bekommt einen kleinen "..." Button rechts
- Klick oeffnet ein Mini-Dropdown (Boost, Pause, Details) -- rein visuell, keine echte Aktion
- Das Dropdown verschwindet nach 2 Sekunden oder bei Klick woanders

### 4. Live-Notification-Badge

- Im Browser-Chrome-Bereich: kleines Glocken-Icon rechts oben
- Pulsierender roter Dot (Badge mit "3")
- Klick zeigt ein Mini-Notifications-Dropdown mit 3 Eintraegen:
  - "Neuer Kandidat: Sarah B. -- 96% Match"
  - "Interview morgen: Thomas K."
  - "Job geschlossen: UX Designer"

### 5. Typing-Indicator im Suchfeld

- Im Browser-Chrome: Die URL-Bar wird zu einem klickbaren Suchfeld
- Klick darauf zeigt einen blinkenden Cursor und simuliert Auto-Typing von "Senior Frontend..."
- Nach 2s erscheinen 2 Mock-Suchergebnisse darunter (dann fade out)

---

## Technische Details

### Dateiaenderungen

| Datei | Aenderung |
|---|---|
| `src/components/landing/DashboardPreview.tsx` | Komplett ueberarbeitet: neue Tabs, klickbare Karten, Notifications, Suchfeld |

### Neue Daten-Konstanten

- `ANALYTICS_WEEKLY`: Array mit 7 Werten fuer Balkendiagramm
- `FUNNEL_DATA`: 4-Stufen-Funnel (Submitted -> Reviewed -> Interview -> Hired)
- `MESSAGES`: 3 Mock-Chat-Nachrichten mit Name, Text, Zeitstempel
- `NOTIFICATIONS`: 3 Notification-Eintraege

### Neuer State

- `activeTab`: Erweitert um `"analytics" | "messages"`
- `expandedCandidate`: `number | null` -- welcher Kandidat aufgeklappt ist
- `showNotifications`: `boolean` -- Notification-Dropdown offen
- `showSearch`: `boolean` -- Suchfeld aktiv
- `showJobMenu`: `number | null` -- welches Job-Dropdown offen ist

### Sidebar-Erweiterung

`SIDEBAR_ITEMS` bekommt:
- `{ label: "Analytics", tab: "analytics" }` -- jetzt klickbar
- `{ label: "Messages", tab: "messages", badge: 2 }` -- mit Unread-Badge

Settings bleibt deaktiviert (zeigt ein Tooltip "Coming soon" bei Hover).

### CSS-Animationen

- `expand-panel`: `max-height: 0 -> 120px` mit `ease-out` fuer Kandidaten-Detail
- `typing-cursor`: Blinkender Cursor im Suchfeld
- `notification-slide`: Dropdown gleitet von oben rein

### Performance

Alles ist reines CSS + React State -- kein externer State, keine API-Calls, keine zusaetzlichen Dependencies. Die Animationen nutzen CSS transitions statt JS-basierter Animation.

