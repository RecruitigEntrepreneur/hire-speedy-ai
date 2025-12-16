import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Building2, Users, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useImportCompanies, useImportContacts, CompanyImportRow, ContactImportRow } from '@/hooks/useCompanyImport';

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportMode = 'select' | 'companies' | 'contacts';
type Step = 'mode' | 'upload' | 'mapping' | 'importing' | 'done';

// Field definitions for each mode
const COMPANY_FIELDS = [
  { value: 'name', label: 'Firmenname', required: true },
  { value: 'website', label: 'Website' },
  { value: 'domain', label: 'Domain' },
  { value: 'industry', label: 'Branche' },
  { value: 'city', label: 'Stadt' },
  { value: 'headcount', label: 'Mitarbeiterzahl' },
  { value: 'skip', label: '– Überspringen –' },
];

const CONTACT_FIELDS = [
  { value: 'name', label: 'Name', required: true },
  { value: 'email', label: 'E-Mail', required: true },
  { value: 'role', label: 'Position/Rolle' },
  { value: 'company_name', label: 'Firmenname' },
  { value: 'decision_level', label: 'Entscheider-Level' },
  { value: 'functional_area', label: 'Funktionsbereich' },
  { value: 'phone', label: 'Telefon' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'skip', label: '– Überspringen –' },
];

// Auto-mapping patterns
const autoMapColumn = (header: string, mode: ImportMode): string => {
  const lower = header.toLowerCase().trim();
  
  if (mode === 'companies') {
    if (lower.includes('firmenname') || lower.includes('company') || lower === 'name' || lower === 'firma') return 'name';
    if (lower.includes('website') || lower.includes('url') || lower.includes('homepage')) return 'website';
    if (lower.includes('domain')) return 'domain';
    if (lower.includes('branche') || lower.includes('industry') || lower.includes('sector')) return 'industry';
    if (lower.includes('stadt') || lower.includes('city') || lower.includes('ort')) return 'city';
    if (lower.includes('mitarbeiter') || lower.includes('headcount') || lower.includes('employee') || lower.includes('size')) return 'headcount';
  }
  
  if (mode === 'contacts') {
    if (lower.includes('name') && !lower.includes('company') && !lower.includes('firma')) return 'name';
    if (lower.includes('email') || lower.includes('e-mail') || lower.includes('mail')) return 'email';
    if (lower.includes('position') || lower.includes('role') || lower.includes('titel') || lower.includes('title')) return 'role';
    if (lower.includes('firma') || lower.includes('company') || lower.includes('unternehmen')) return 'company_name';
    if (lower.includes('entscheider') || lower.includes('decision')) return 'decision_level';
    if (lower.includes('funktion') || lower.includes('function') || lower.includes('bereich')) return 'functional_area';
    if (lower.includes('phone') || lower.includes('telefon') || lower.includes('mobil')) return 'phone';
    if (lower.includes('linkedin')) return 'linkedin_url';
  }
  
  return 'skip';
};

export function SmartImportDialog({ open, onOpenChange }: SmartImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>('select');
  const [step, setStep] = useState<Step>('mode');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);

  const importCompanies = useImportCompanies();
  const importContacts = useImportContacts();

  const resetState = () => {
    setMode('select');
    setStep('mode');
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setProgress(0);
    setResults(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    
    const text = await uploadedFile.text();
    const parsed = parseCSV(text);
    
    if (parsed.length < 2) {
      toast.error('CSV muss mindestens eine Header-Zeile und eine Datenzeile enthalten');
      return;
    }

    const fileHeaders = parsed[0];
    const data = parsed.slice(1);
    
    setHeaders(fileHeaders);
    setCsvData(data);
    
    // Auto-map columns
    const autoMapping: Record<string, string> = {};
    fileHeaders.forEach((header) => {
      autoMapping[header] = autoMapColumn(header, mode);
    });
    setMapping(autoMapping);
    
    setStep('mapping');
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFileUpload(droppedFile);
    } else {
      toast.error('Bitte eine CSV-Datei hochladen');
    }
  }, [handleFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileUpload(selectedFile);
    }
  };

  const startImport = async () => {
    setStep('importing');
    setProgress(0);

    const fields = mode === 'companies' ? COMPANY_FIELDS : CONTACT_FIELDS;
    const requiredFields = fields.filter(f => f.required).map(f => f.value);
    
    // Check required mappings
    const mappedFields = Object.values(mapping).filter(v => v !== 'skip');
    const missingRequired = requiredFields.filter(f => !mappedFields.includes(f));
    
    if (missingRequired.length > 0) {
      toast.error(`Pflichtfelder fehlen: ${missingRequired.join(', ')}`);
      setStep('mapping');
      return;
    }

    // Build data rows
    const rows = csvData.map(row => {
      const item: Record<string, any> = {};
      headers.forEach((header, index) => {
        const targetField = mapping[header];
        if (targetField && targetField !== 'skip') {
          item[targetField] = row[index];
        }
      });
      return item;
    });

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90));
    }, 200);

    try {
      if (mode === 'companies') {
        const result = await importCompanies.mutateAsync(rows as CompanyImportRow[]);
        setResults(result);
      } else {
        const result = await importContacts.mutateAsync(rows as ContactImportRow[]);
        setResults(result);
      }
      
      clearInterval(progressInterval);
      setProgress(100);
      setStep('done');
    } catch (error) {
      clearInterval(progressInterval);
      toast.error('Import fehlgeschlagen');
      setStep('mapping');
    }
  };

  const renderModeSelection = () => (
    <div className="grid grid-cols-2 gap-4 py-6">
      <button
        onClick={() => { setMode('companies'); setStep('upload'); }}
        className="flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-all"
      >
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Unternehmen</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Firmen ohne Kontakte hinzufügen
          </p>
          <Badge variant="secondary" className="mt-2">Status: Kontakte fehlen</Badge>
        </div>
      </button>

      <button
        onClick={() => { setMode('contacts'); setStep('upload'); }}
        className="flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-all"
      >
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Kontakte</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ansprechpartner importieren
          </p>
          <Badge variant="secondary" className="mt-2">Firma wird automatisch erstellt</Badge>
        </div>
      </button>
    </div>
  );

  const renderUpload = () => (
    <div
      className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-lg font-medium">CSV-Datei hierher ziehen</p>
      <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
      
      <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left text-sm">
        <p className="font-medium mb-2">Erwartete Spalten ({mode === 'companies' ? 'Unternehmen' : 'Kontakte'}):</p>
        <div className="flex flex-wrap gap-2">
          {(mode === 'companies' ? COMPANY_FIELDS : CONTACT_FIELDS)
            .filter(f => f.value !== 'skip')
            .map(f => (
              <Badge key={f.value} variant={f.required ? 'default' : 'outline'}>
                {f.label} {f.required && '*'}
              </Badge>
            ))}
        </div>
      </div>
    </div>
  );

  const renderMapping = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>{file?.name}</span>
        <Badge variant="secondary">{csvData.length} Zeilen</Badge>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">CSV-Spalte</TableHead>
              <TableHead className="w-[200px]">Zuordnung</TableHead>
              <TableHead>Vorschau</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header, index) => (
              <TableRow key={header}>
                <TableCell className="font-medium">{header}</TableCell>
                <TableCell>
                  <Select
                    value={mapping[header] || 'skip'}
                    onValueChange={(value) => setMapping(prev => ({ ...prev, [header]: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(mode === 'companies' ? COMPANY_FIELDS : CONTACT_FIELDS).map(field => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label} {field.required && '*'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {csvData.slice(0, 2).map(row => row[index]).filter(Boolean).join(', ').slice(0, 50)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderImporting = () => (
    <div className="py-12 text-center">
      <Progress value={progress} className="mb-4" />
      <p className="text-muted-foreground">
        Importiere {mode === 'companies' ? 'Unternehmen' : 'Kontakte'}... {progress}%
      </p>
    </div>
  );

  const renderDone = () => (
    <div className="py-8 text-center">
      <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
        <Check className="h-8 w-8 text-green-500" />
      </div>
      <h3 className="text-lg font-semibold mb-4">Import abgeschlossen</h3>
      
      {results && mode === 'companies' && (
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{results.created}</p>
            <p className="text-muted-foreground">Erstellt</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{results.skipped}</p>
            <p className="text-muted-foreground">Übersprungen</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{results.errors}</p>
            <p className="text-muted-foreground">Fehler</p>
          </div>
        </div>
      )}
      
      {results && mode === 'contacts' && (
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{results.contacts_created}</p>
            <p className="text-muted-foreground">Kontakte</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{results.companies_created}</p>
            <p className="text-muted-foreground">Firmen erstellt</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{results.duplicates}</p>
            <p className="text-muted-foreground">Duplikate</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'mode' && 'Was möchten Sie importieren?'}
            {step === 'upload' && (
              <>
                {mode === 'companies' ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                {mode === 'companies' ? 'Unternehmen importieren' : 'Kontakte importieren'}
              </>
            )}
            {step === 'mapping' && 'Felder zuordnen'}
            {step === 'importing' && 'Import läuft...'}
            {step === 'done' && 'Import abgeschlossen'}
          </DialogTitle>
        </DialogHeader>

        {step === 'mode' && renderModeSelection()}
        {step === 'upload' && renderUpload()}
        {step === 'mapping' && renderMapping()}
        {step === 'importing' && renderImporting()}
        {step === 'done' && renderDone()}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => setStep('mode')}>
              Zurück
            </Button>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Zurück
              </Button>
              <Button onClick={startImport}>
                {csvData.length} {mode === 'companies' ? 'Unternehmen' : 'Kontakte'} importieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>
              Schließen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
