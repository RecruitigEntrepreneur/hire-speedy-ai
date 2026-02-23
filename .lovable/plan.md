

# Aufgaben als Ticket-Grid: 3-4 Kacheln pro Reihe

## Konzept

```text
+------------------+  +------------------+  +------------------+  +------------------+
| Interview-Anfrage|  | Opt-In ueberfaellig| | Follow-up       |  | Gehalt erfragen  |
| Andreas P.       |  | Maria S.          |  | Thomas K.       |  | Lisa M.          |
| Buchhalter @ HT  |  | DevOps @ TC       |  | PM @ StartupXY  |  | Designer @ AZ    |
| [ph] [ma] [done] |  | [ph] [OptIn][done]|  | [ma]     [done] |  | [ph]      [done] |
+------------------+  +------------------+  +------------------+  +------------------+
```

## Technische Umsetzung

### 1. `src/components/influence/CompactTaskList.tsx` (Dashboard)

**Grid-Container** statt `space-y-2`:
- `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2`
- Gilt fuer beide Sektionen (Dringend + Offen)

**TaskRow wird zur Ticket-Kachel:**
- Kompakte Karte: `border rounded-lg p-2.5 bg-card`
- Zeile 1: Typ-Badge (text-[10px]) + Erledigt-Icon (rechts oben)
- Zeile 2: Kandidatenname (text-sm, font-medium, truncate)
- Zeile 3: Job @ Company (text-xs, muted, truncate)
- Zeile 4: Icon-Only Buttons (phone/mail) am unteren Rand
- Message-Text komplett entfernen
- Dringend: `border-l-2 border-l-amber-500 bg-amber-500/5`
- Normal: `border border-border`

**Icon-Only Buttons** mit Tooltips:
- Phone, Mail, Check -- je `h-6 w-6` oder `h-7 w-7`
- Importiert aus `@/components/ui/tooltip`

**Section-Header** ("DRINGEND" / "OFFEN"):
- Bleiben als volle Breite ueber dem Grid (`col-span-full` nicht noetig, sie stehen ausserhalb)
- Amber statt Rot fuer "DRINGEND"

### 2. `src/components/candidates/CandidateTasksSection.tsx` (Kandidaten-Detail)

Gleiche Grid-Behandlung:
- `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2`
- Expose-Tasks und DB-Tasks im selben Grid
- Icon-Box verkleinern, Beschreibungstext entfernen
- Spezial-Buttons (Opt-In, CV Upload, Interview) als kompakte Mini-Buttons

### Responsive Breakpoints

| Breite | Spalten |
|--------|---------|
| < 640px (sm) | 2 Spalten |
| >= 640px (sm) | 3 Spalten |
| >= 1024px (lg) | 4 Spalten |

### Keine Aenderungen an:
- Props/Interface beider Komponenten
- Daten-Logik, Filter, Sortierung
- Eltern-Komponenten

## Erwartetes Ergebnis
- 8 Tasks passen in 2 Reihen statt 8 (75% weniger Scroll)
- Jede Kachel ist schmal und eigenstaendig scanbar
- Alle Aktionen bleiben erhalten via Icon-Buttons + Tooltips

