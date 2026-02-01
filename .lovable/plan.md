
# Plan: Plattform-Umbenennung von TalentBridge zu Matchunt

## Übersicht

Die Plattform soll von **TalentBridge** zu **Matchunt** umbenannt werden.
- Neue Domain: **matchunt.ai**
- Neue E-Mail-Domain: **@matchunt.ai**

---

## Gefundene Stellen (112 Matches in 13 Dateien)

### 1. Kernkomponenten (Logo + Name sichtbar)

| Datei | Zeile | Aktueller Text | Neuer Text |
|-------|-------|----------------|------------|
| `src/components/layout/Navbar.tsx` | 156 | `TalentBridge` | `Matchunt` |
| `src/components/layout/Navbar.tsx` | 294 | `TalentBridge` | `Matchunt` |
| `src/components/layout/DashboardLayout.tsx` | 146 | `TalentBridge` | `Matchunt` |
| `src/components/landing/FooterSection.tsx` | 42 | `TalentBridge` | `Matchunt` |
| `src/components/landing/FooterSection.tsx` | 120 | `TalentBridge - eine Marke der...` | `Matchunt - eine Marke der...` |

### 2. Auth & Onboarding

| Datei | Zeile | Aktueller Text | Neuer Text |
|-------|-------|----------------|------------|
| `src/pages/Auth.tsx` | 161 | `Join TalentBridge and start...` | `Join Matchunt and start...` |

### 3. Admin-Einstellungen (Standard-Werte)

| Datei | Zeile | Aktueller Text | Neuer Text |
|-------|-------|----------------|------------|
| `src/pages/admin/AdminSettings.tsx` | 47 | `platform_name: 'TalentBridge'` | `platform_name: 'Matchunt'` |
| `src/pages/admin/AdminSettings.tsx` | 54 | `sender_email: 'noreply@talentbridge.de'` | `sender_email: 'noreply@matchunt.ai'` |
| `src/pages/admin/AdminSettings.tsx` | 55 | `sender_name: 'TalentBridge Team'` | `sender_name: 'Matchunt Team'` |

### 4. Public Pages (Marketing/Info)

| Datei | Beschreibung | Änderungen |
|-------|--------------|------------|
| `src/pages/public/About.tsx` | Zeile 58 | `TalentBridge wurde gegründet...` → `Matchunt wurde gegründet...` |
| `src/pages/public/Careers.tsx` | Zeile 65 | `Warum TalentBridge?` → `Warum Matchunt?` |
| `src/pages/public/Guides.tsx` | Zeile 8 | `Erste Schritte mit TalentBridge` → `Erste Schritte mit Matchunt` |
| `src/pages/public/Guides.tsx` | Zeile 47 | `...Erfolg mit TalentBridge` → `...Erfolg mit Matchunt` |
| `src/pages/public/Docs.tsx` | Zeile 21 | `Verbinden Sie TalentBridge mit...` → `Verbinden Sie Matchunt mit...` |
| `src/pages/public/Docs.tsx` | Zeile 47 | `...Nutzung von TalentBridge` → `...Nutzung von Matchunt` |

### 5. Contact & Press (E-Mail-Adressen)

| Datei | Zeile | Aktuell | Neu |
|-------|-------|---------|-----|
| `src/pages/public/Contact.tsx` | 100 | `hello@talentbridge.de` | `hello@matchunt.ai` |
| `src/pages/public/Contact.tsx` | 101 | `support@talentbridge.de` | `support@matchunt.ai` |
| `src/pages/public/Contact.tsx` | 120 | `TalentBridge GmbH` | `Matchunt GmbH` |
| `src/pages/public/Help.tsx` | 99 | `support@talentbridge.de` | `support@matchunt.ai` |
| `src/pages/public/Press.tsx` | 8-20 | 3x `TalentBridge` in News | 3x `Matchunt` |
| `src/pages/public/Press.tsx` | 109 | `press@talentbridge.de` | `press@matchunt.ai` |

### 6. Impressum

| Datei | Zeile | Aktuell | Neu |
|-------|-------|---------|-----|
| `src/pages/public/Impressum.tsx` | 25 | `TalentBridge - eine Marke der...` | `Matchunt - eine Marke der...` |

### 7. index.html (Meta-Tags)

| Datei | Zeile | Aktuell | Neu |
|-------|-------|---------|-----|
| `index.html` | 6 | `<title>7a26b296...</title>` | `<title>Matchunt - Perfect Match. Perfect Hire.</title>` |
| `index.html` | 7 | `content="Lovable Generated..."` | `content="Matchunt - KI-gestütztes Recruiting"` |
| `index.html` | 10 | `og:title` | `Matchunt` |
| `index.html` | 11 | `og:description` | `Perfect Match. Perfect Hire.` |

---

## Zusammenfassung der Änderungen

| Kategorie | Anzahl Dateien | Anzahl Änderungen |
|-----------|----------------|-------------------|
| **Navigation/Layout** | 3 | 5 |
| **Auth** | 1 | 1 |
| **Admin Settings** | 1 | 3 |
| **Public Pages** | 7 | ~15 |
| **index.html** | 1 | 4 |
| **TOTAL** | **13 Dateien** | **~28 Text-Änderungen** |

---

## Keine Änderungen notwendig

- **Edge Functions**: Kein hartcodierter Plattformname gefunden
- **Datenbank**: Plattformname kommt aus `platform_settings` Tabelle (dynamisch)
- **Supabase Config**: Keine Änderungen notwendig

---

## Dateien die geändert werden

1. `index.html` - Meta-Tags
2. `src/components/layout/Navbar.tsx`
3. `src/components/layout/DashboardLayout.tsx`
4. `src/components/landing/FooterSection.tsx`
5. `src/pages/Auth.tsx`
6. `src/pages/admin/AdminSettings.tsx`
7. `src/pages/public/About.tsx`
8. `src/pages/public/Careers.tsx`
9. `src/pages/public/Contact.tsx`
10. `src/pages/public/Docs.tsx`
11. `src/pages/public/Guides.tsx`
12. `src/pages/public/Help.tsx`
13. `src/pages/public/Impressum.tsx`
14. `src/pages/public/Press.tsx`

---

## Technische Details

Die Umbenennung ist ein einfaches Such-und-Ersetzen:
- `TalentBridge` → `Matchunt`
- `talentbridge.de` → `matchunt.ai`
- `@talentbridge.de` → `@matchunt.ai`

