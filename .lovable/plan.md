

# Client Job-Formular bereinigen: Admin-Felder entfernen und Workflow korrigieren

## Analyse

Beim Durchgehen des gesamten `JobEditDialog.tsx` (das Client-Formular) fallen mehrere Probleme auf:

### 1. Vermittlungsfee (Zeilen 578-604) -- FALSCH im Client-Formular
Der Vermittlungsfee-Slider (10-30%) inkl. der Gebuehrenberechnung wird dem Client angezeigt. Laut Workflow wird die Fee ausschliesslich vom Admin im `JobApprovalDialog` festgelegt. Der Client sollte weder sehen noch aendern koennen, wie hoch die Vermittlungsgebuehr ist.

**Aenderung:** Vermittlungsfee-Slider und Gebuehrenberechnung komplett aus dem Conditions-Tab entfernen.

### 2. Dringlichkeit (Zeilen 382-398) -- FRAGWUERDIG im Client-Formular
Laut dem Approval-Workflow setzt der Admin die Dringlichkeit (Standard/Urgent/Hot). Der Client gibt zwar an, wie dringend es fuer ihn ist, aber die offizielle Urgency fuer Recruiter wird vom Admin gesetzt. Es kann Sinn machen, dem Client trotzdem eine Dringlichkeits-Angabe zu lassen (als Input fuer den Admin), aber die Werte sollten client-freundlicher benannt sein.

**Aenderung:** Dringlichkeit im Client-Formular als "Wunsch-Zeitrahmen" umbenennen mit verstaendlicheren Optionen (z.B. "Keine Eile", "Innerhalb 3 Monate", "Schnellstmoeglich", "Sofort").

### 3. "Veroeffentlichen"-Button (Zeile 614-622) -- FALSCH
Der Client kann aktuell direkt "Veroeffentlichen" klicken, was den Status auf `published` setzt und den Admin-Approval-Workflow umgeht. Der korrekte Flow waere: Client reicht den Job zur Pruefung ein (Status: `pending_approval`), der Admin genehmigt.

**Aenderung:** "Veroeffentlichen"-Button in "Zur Pruefung einreichen" umbenennen und Status auf `pending_approval` statt `published` setzen.

## Zusammenfassung der Aenderungen

**`src/components/jobs/JobEditDialog.tsx`**

| Was | Aenderung |
|---|---|
| Vermittlungsfee-Slider (Zeile 578-592) | Komplett entfernen |
| Gebuehren-Vorschau (Zeile 594-604) | Komplett entfernen |
| `fee_percentage` aus formData | Entfernen (nicht mehr im Update-Query) |
| `fee_percentage` aus handleSave | Entfernen (Admin setzt das) |
| Dringlichkeit (Zeile 382-398) | Umbenennen zu "Gewuenschter Einstellungszeitraum" mit client-freundlichen Optionen |
| "Veroeffentlichen"-Button | Text zu "Zur Pruefung einreichen", Status `pending_approval` statt `published` |

