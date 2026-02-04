
# Plan: Fix CV-Anzeige & Karriere-Timeline Parsing

## Analyse der Probleme

### Problem 1: "Bucket not found" Fehler
**Ursache gefunden:**
- Der Bucket `cv-documents` ist **privat** (`public: false`)
- Der Code verwendet `getPublicUrl()` zum Generieren der URLs
- Private Buckets erlauben keine Public URLs - daher der 404 Fehler

**Datenbank-Beweis:**
```sql
-- Bucket ist privat:
SELECT public FROM storage.buckets WHERE name = 'cv-documents'
-- Ergebnis: public = false

-- RLS Policies existieren für authentifizierte Nutzer:
-- "Users can read CV documents" (SELECT) für authenticated role
```

### Problem 2: Abgeschnittener Job-Titel
**Ursache:** `truncate` CSS-Klasse in `CandidateKeyFactsGrid.tsx` Zeile 175

### Problem 3: Leere Karriere-Timeline
**Ursache:** CV wurde geparst, aber Experiences wurden nicht in die Datenbank gespeichert. Es gibt keine Einträge in `candidate_experiences` für diesen Kandidaten.

---

## Lösung

### 1. Signed URLs statt Public URLs verwenden

**Datei:** `src/hooks/useCandidateDocuments.ts`

Statt `getPublicUrl()` eine Funktion nutzen, die signierte URLs generiert:

```typescript
// NEU: Helper-Funktion für signierte URLs
const getSignedUrl = async (filePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('cv-documents')
    .createSignedUrl(filePath, 3600); // 1 Stunde gültig
  
  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  return data.signedUrl;
};
```

**Änderung in `fetchDocuments`:**
```typescript
const fetchDocuments = useCallback(async () => {
  if (!candidateId) return;
  setLoading(true);
  try {
    const { data, error } = await supabase
      .from('candidate_documents')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('document_type')
      .order('version', { ascending: false });

    if (error) throw error;
    
    // NEU: Signierte URLs für alle Dokumente generieren
    const docsWithSignedUrls = await Promise.all(
      (data || []).map(async (doc) => {
        // Extrahiere den Pfad aus der gespeicherten URL
        const urlPath = doc.file_url.split('/cv-documents/')[1];
        if (urlPath) {
          const signedUrl = await getSignedUrl(decodeURIComponent(urlPath));
          return { ...doc, file_url: signedUrl || doc.file_url };
        }
        return doc;
      })
    );
    
    setDocuments(docsWithSignedUrls as CandidateDocument[]);
  } catch (error) {
    console.error('Error fetching documents:', error);
  } finally {
    setLoading(false);
  }
}, [candidateId]);
```

**Änderung in `uploadDocument`:** Speichere den Pfad, nicht die Public URL:
```typescript
// Statt:
const { data: { publicUrl } } = supabase.storage
  .from('cv-documents')
  .getPublicUrl(fileName);

// Speichere den Storage-Pfad:
const storageUrl = `https://dngycrrhbnwdohbftpzq.supabase.co/storage/v1/object/cv-documents/${fileName}`;
```

---

### 2. Job-Titel mit Tooltip und Mehrzeiligkeit

**Datei:** `src/components/candidates/CandidateKeyFactsGrid.tsx`

```typescript
// Import hinzufügen
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Interface erweitern
interface KeyFactTile {
  icon: LucideIcon;
  label: string;
  value: string | null;
  fullValue?: string | null; // NEU: Voller Wert für Tooltip
  missing?: boolean;
  highlight?: 'green' | 'blue' | 'amber';
}

// Helper-Funktion
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Tile-Definition anpassen
{ 
  icon: User, 
  label: 'Rolle', 
  value: candidate.job_title ? truncateText(candidate.job_title, 25) : null,
  fullValue: candidate.job_title, // Für Tooltip
  missing: !candidate.job_title 
}

// Rendering mit Tooltip (ersetze die p-Zeile):
<TooltipProvider delayDuration={300}>
  <Tooltip>
    <TooltipTrigger asChild>
      <p className={cn(
        "text-sm font-medium mt-0.5 line-clamp-2",
        tile.missing && "text-amber-600 dark:text-amber-400"
      )}>
        {tile.value || 'Fehlt'}
      </p>
    </TooltipTrigger>
    {tile.fullValue && tile.fullValue !== tile.value && (
      <TooltipContent side="bottom" className="max-w-[200px]">
        <p className="text-sm">{tile.fullValue}</p>
      </TooltipContent>
    )}
  </Tooltip>
</TooltipProvider>
```

---

### 3. Re-Parse Button für Karriere-Timeline

**Datei:** `src/components/candidates/CandidateExperienceTimeline.tsx`

Props erweitern und Re-Parse-Funktion hinzufügen:

```typescript
interface CandidateExperienceTimelineProps {
  candidateId: string;
  onReparse?: () => void; // NEU: Callback für Re-Parse
}

// Besserer Leer-Zustand mit Button:
if (!experiences || experiences.length === 0) {
  return (
    <div className="text-center py-6 text-muted-foreground space-y-3">
      <Building2 className="h-10 w-10 mx-auto opacity-40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Keine Berufserfahrung hinterlegt</p>
        <p className="text-xs">
          Die Karriere-Stationen wurden nicht aus dem CV extrahiert
        </p>
      </div>
      {onReparse && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onReparse}
          className="mt-2"
        >
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          CV erneut parsen
        </Button>
      )}
    </div>
  );
}
```

**Datei:** `src/components/candidates/CandidateProfileTab.tsx`

Re-Parse-Handler implementieren:

```typescript
// Import useCvParsing Hook
import { useCvParsing } from '@/hooks/useCvParsing';

// Im Component:
const { parseCV, extractTextFromPdf, saveParsedCandidate, parsing } = useCvParsing();

const handleReparse = async () => {
  // Hole aktuelles CV-Dokument
  const { data: docs } = await supabase
    .from('candidate_documents')
    .select('*')
    .eq('candidate_id', candidate.id)
    .eq('document_type', 'cv')
    .eq('is_current', true)
    .single();
  
  if (!docs) {
    toast.error('Kein CV zum Parsen gefunden');
    return;
  }
  
  // Extrahiere Pfad und parse
  const urlPath = docs.file_url.split('/cv-documents/')[1];
  if (!urlPath) return;
  
  const text = await extractTextFromPdf(decodeURIComponent(urlPath));
  if (!text) return;
  
  const parsed = await parseCV(text);
  if (!parsed) return;
  
  // Speichere mit existierender Kandidaten-ID
  await saveParsedCandidate(parsed, text, user.id, candidate.id);
  
  // Query invalidieren
  queryClient.invalidateQueries(['candidate-experiences', candidate.id]);
};

// In der Timeline-Komponente:
<CandidateExperienceTimeline 
  candidateId={candidate.id} 
  onReparse={handleReparse}
/>
```

---

## Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `src/hooks/useCandidateDocuments.ts` | Signed URLs statt Public URLs |
| `src/components/candidates/CandidateKeyFactsGrid.tsx` | Tooltip + line-clamp-2 für Job-Titel |
| `src/components/candidates/CandidateExperienceTimeline.tsx` | Re-Parse Button im Leer-Zustand |
| `src/components/candidates/CandidateProfileTab.tsx` | Re-Parse Handler implementieren |

---

## Technische Details

### Signed URL Generierung

Die `createSignedUrl` Funktion erstellt eine temporäre URL mit Authentifizierung:
- Gültig für 1 Stunde (3600 Sekunden)
- Funktioniert mit privaten Buckets
- Erfordert authentifizierten Supabase-Client

### Pfad-Extraktion

Die gespeicherte `file_url` enthält den vollen Public-URL-Pfad:
```
https://dngycrrhbnwdohbftpzq.supabase.co/storage/v1/object/public/cv-documents/9ee0e9d4.../file.pdf
```

Daraus extrahieren wir:
```
9ee0e9d4.../file.pdf
```

Und generieren eine signierte URL dafür.

---

## Erwartetes Ergebnis

1. **CV öffnet sich** - Signierte URLs funktionieren mit privatem Bucket
2. **Job-Titel lesbar** - 2 Zeilen erlaubt + Tooltip zeigt vollen Text
3. **Re-Parse möglich** - Button in leerer Timeline startet CV-Parsing erneut
4. **Experiences werden gespeichert** - Nach Re-Parse sind Karriere-Stationen sichtbar
