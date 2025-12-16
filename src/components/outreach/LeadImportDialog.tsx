import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TARGET_FIELDS = [
  { value: 'company_name', label: 'Firmenname', required: true },
  { value: 'contact_name', label: 'Kontaktperson', required: true },
  { value: 'contact_email', label: 'E-Mail', required: true },
  { value: 'contact_role', label: 'Position' },
  { value: 'company_website', label: 'Website' },
  { value: 'industry', label: 'Branche' },
  { value: 'company_size', label: 'Unternehmensgröße' },
  { value: 'country', label: 'Land' },
  { value: 'city', label: 'Stadt' },
  { value: 'segment', label: 'Segment' },
  { value: 'priority', label: 'Priorität' },
  { value: 'score', label: 'Score' },
  { value: 'skip', label: '— Überspringen —' },
];

export function LeadImportDialog({ open, onOpenChange }: LeadImportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, errors: 0, duplicates: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setProgress(0);
    setResults({ success: 0, errors: 0, duplicates: 0 });
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
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

  const handleFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setCsvData(parsed.slice(1));
        
        // Auto-map columns
        const autoMapping: Record<string, string> = {};
        parsed[0].forEach((header, index) => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('firma') || lowerHeader.includes('company')) {
            autoMapping[index.toString()] = 'company_name';
          } else if (lowerHeader.includes('name') && !lowerHeader.includes('firma')) {
            autoMapping[index.toString()] = 'contact_name';
          } else if (lowerHeader.includes('email') || lowerHeader.includes('mail')) {
            autoMapping[index.toString()] = 'contact_email';
          } else if (lowerHeader.includes('position') || lowerHeader.includes('role') || lowerHeader.includes('titel')) {
            autoMapping[index.toString()] = 'contact_role';
          } else if (lowerHeader.includes('website') || lowerHeader.includes('url')) {
            autoMapping[index.toString()] = 'company_website';
          } else if (lowerHeader.includes('branche') || lowerHeader.includes('industry')) {
            autoMapping[index.toString()] = 'industry';
          } else if (lowerHeader.includes('größe') || lowerHeader.includes('size') || lowerHeader.includes('mitarbeiter')) {
            autoMapping[index.toString()] = 'company_size';
          } else if (lowerHeader.includes('land') || lowerHeader.includes('country')) {
            autoMapping[index.toString()] = 'country';
          } else if (lowerHeader.includes('stadt') || lowerHeader.includes('city') || lowerHeader.includes('ort')) {
            autoMapping[index.toString()] = 'city';
          }
        });
        setMapping(autoMapping);
        setStep('mapping');
      }
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFile(droppedFile);
    } else {
      toast.error('Bitte eine CSV-Datei hochladen');
    }
  }, [handleFile]);

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    
    const leads = csvData.map(row => {
      const lead: Record<string, any> = {
        status: 'new',
        segment: 'unknown',
        priority: 'medium',
        score: 50,
      };
      
      Object.entries(mapping).forEach(([colIndex, field]) => {
        if (field !== 'skip' && row[parseInt(colIndex)]) {
          const value = row[parseInt(colIndex)];
          if (field === 'score') {
            lead[field] = parseInt(value) || 50;
          } else {
            lead[field] = value;
          }
        }
      });
      
      return lead;
    }).filter(lead => lead.company_name && lead.contact_name && lead.contact_email);

    let success = 0;
    let errors = 0;
    let duplicates = 0;

    for (let i = 0; i < leads.length; i++) {
      try {
        // Check for duplicate
        const { data: existing } = await supabase
          .from('outreach_leads')
          .select('id')
          .eq('contact_email', leads[i].contact_email)
          .single();

        if (existing) {
          duplicates++;
        } else {
          const { error } = await supabase
            .from('outreach_leads')
            .insert(leads[i] as any);
          
          if (error) {
            errors++;
          } else {
            success++;
          }
        }
      } catch {
        errors++;
      }
      
      setProgress(Math.round(((i + 1) / leads.length) * 100));
    }

    setResults({ success, errors, duplicates });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
    queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
  };

  const requiredFieldsMapped = () => {
    const mappedFields = Object.values(mapping);
    return mappedFields.includes('company_name') && 
           mappedFields.includes('contact_name') && 
           mappedFields.includes('contact_email');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Leads importieren
          </DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">CSV-Datei hierher ziehen</p>
            <p className="text-sm text-muted-foreground mb-4">oder</p>
            <Button variant="outline" onClick={() => document.getElementById('csv-input')?.click()}>
              Datei auswählen
            </Button>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {csvData.length} Zeilen gefunden in <span className="font-medium">{file?.name}</span>
              </p>
              <div className="flex gap-2">
                {!requiredFieldsMapped() && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Pflichtfelder fehlen
                  </Badge>
                )}
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">CSV-Spalte</TableHead>
                    <TableHead className="w-[200px]">Zielfeld</TableHead>
                    <TableHead>Vorschau</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((header, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{header}</TableCell>
                      <TableCell>
                        <Select
                          value={mapping[index.toString()] || 'skip'}
                          onValueChange={(value) => setMapping(prev => ({ ...prev, [index.toString()]: value }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_FIELDS.map(field => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                                {field.required && <span className="text-destructive ml-1">*</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm truncate max-w-[300px]">
                        {csvData.slice(0, 3).map(row => row[index]).filter(Boolean).join(' | ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="text-destructive">*</span> Pflichtfelder: Firmenname, Kontaktperson, E-Mail
            </p>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Importiere Leads...</p>
              <p className="text-sm text-muted-foreground">{progress}% abgeschlossen</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Import abgeschlossen</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{results.success}</p>
                <p className="text-sm text-muted-foreground">Erfolgreich</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{results.duplicates}</p>
                <p className="text-sm text-muted-foreground">Duplikate</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{results.errors}</p>
                <p className="text-sm text-muted-foreground">Fehler</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Zurück</Button>
              <Button onClick={handleImport} disabled={!requiredFieldsMapped()}>
                {csvData.length} Leads importieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { resetState(); onOpenChange(false); }}>Schließen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
