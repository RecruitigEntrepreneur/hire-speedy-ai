import { useState, useRef, useCallback } from 'react';
import { useWizardContext } from '../JobWizard';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  FileUp,
  Link2,
  Type,
  Loader2,
  Sparkles,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

type ImportTab = 'pdf' | 'url' | 'text';

interface RecognizedField {
  label: string;
  value: string;
  confidence: number;
}

export function SmartImport() {
  const { applyImportData, jobParsing, pdfParsing, nextStep } = useWizardContext();

  const [activeTab, setActiveTab] = useState<ImportTab>('pdf');
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [recognizedFields, setRecognizedFields] = useState<RecognizedField[]>([]);
  const [importDone, setImportDone] = useState(false);
  const [trackSuggestion, setTrackSuggestion] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isImporting = jobParsing.parsing || pdfParsing.isLoading;

  const handleImportResult = useCallback((data: any) => {
    if (!data) return;

    applyImportData(data);

    // Build recognized fields for preview
    const fields: RecognizedField[] = [];
    if (data.title) fields.push({ label: 'Titel', value: data.title, confidence: 95 });
    if (data.company_name) fields.push({ label: 'Firma', value: data.company_name, confidence: 90 });
    if (data.location) fields.push({ label: 'Standort', value: data.location, confidence: 85 });
    if (data.experience_level) fields.push({ label: 'Level', value: data.experience_level, confidence: 80 });
    if (data.skills?.length) fields.push({ label: 'Skills', value: data.skills.slice(0, 5).join(', '), confidence: 75 });
    if (data.salary_min && data.salary_max) {
      fields.push({ label: 'Gehalt', value: `${data.salary_min} - ${data.salary_max}`, confidence: 70 });
    }
    if (data.remote_type) fields.push({ label: 'Remote', value: data.remote_type, confidence: 80 });

    setRecognizedFields(fields);
    setImportDone(true);

    // Detect track suggestion
    if (data.employment_type?.includes('freelance') || data.description?.toLowerCase().includes('freelanc')) {
      setTrackSuggestion('freelance');
    }

    toast.success(`${fields.length} Felder erkannt`);
  }, [applyImportData]);

  // PDF Upload
  const handlePdfUpload = useCallback(async (file: File) => {
    if (!file.name.match(/\.(pdf|docx?)$/i)) {
      toast.error('Nur PDF und DOCX Dateien');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Maximale Dateigröße: 10 MB');
      return;
    }

    try {
      const result = await pdfParsing.uploadAndParsePdf(file);
      handleImportResult(result);
    } catch {
      toast.error('Fehler beim Verarbeiten der Datei');
    }
  }, [pdfParsing, handleImportResult]);

  // URL Parse
  const handleUrlParse = useCallback(async () => {
    if (!urlInput.trim()) {
      toast.error('Bitte URL eingeben');
      return;
    }
    try {
      const result = await jobParsing.parseJobUrl(urlInput.trim());
      handleImportResult(result);
    } catch {
      toast.error('Fehler beim Verarbeiten der URL');
    }
  }, [urlInput, jobParsing, handleImportResult]);

  // Text Parse
  const handleTextParse = useCallback(async () => {
    if (!textInput.trim()) {
      toast.error('Bitte Text eingeben');
      return;
    }
    try {
      const result = await jobParsing.parseJobText(textInput.trim());
      handleImportResult(result);
    } catch {
      toast.error('Fehler beim Verarbeiten des Texts');
    }
  }, [textInput, jobParsing, handleImportResult]);

  // Drag & Drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfUpload(file);
  }, [handlePdfUpload]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Stellenbeschreibung importieren</h2>
        <p className="text-sm text-muted-foreground">
          Sparen Sie Zeit — AI füllt die Felder automatisch aus
        </p>
      </div>

      {/* Tabs + Preview Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Import Area (3/5) */}
        <div className="lg:col-span-3">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ImportTab)}>
            <TabsList className="w-full">
              <TabsTrigger value="pdf" className="flex-1 gap-1.5">
                <FileUp className="h-4 w-4" /> PDF
              </TabsTrigger>
              <TabsTrigger value="url" className="flex-1 gap-1.5">
                <Link2 className="h-4 w-4" /> URL
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1 gap-1.5">
                <Type className="h-4 w-4" /> Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-all',
                  dragActive
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePdfUpload(file);
                  }}
                />
                {isImporting ? (
                  <div className="space-y-3">
                    <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">AI analysiert Ihre Stellenbeschreibung...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-medium">PDF oder DOCX hierher ziehen</p>
                      <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
                    </div>
                    <p className="text-xs text-muted-foreground">.pdf, .docx — max 10 MB</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="https://www.stepstone.de/stellenangebote/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={isImporting}
                />
                <p className="text-xs text-muted-foreground">
                  Unterstützt: StepStone, Indeed, LinkedIn, XING und weitere Jobportale
                </p>
              </div>
              <Button onClick={handleUrlParse} disabled={isImporting || !urlInput.trim()}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                URL analysieren
              </Button>
            </TabsContent>

            <TabsContent value="text" className="mt-4 space-y-4">
              <Textarea
                placeholder="Fügen Sie hier die Stellenbeschreibung als Text ein..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={isImporting}
                rows={8}
              />
              <Button onClick={handleTextParse} disabled={isImporting || !textInput.trim()}>
                {isImporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Text analysieren
              </Button>
            </TabsContent>
          </Tabs>

          {/* Manual skip */}
          <button
            onClick={nextStep}
            className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Manuell ausfüllen <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right: Preview Panel (2/5) */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg p-4 space-y-4 sticky top-6">
            <h3 className="text-sm font-semibold text-muted-foreground">Erkannte Felder</h3>

            {recognizedFields.length === 0 ? (
              <div className="text-center py-8">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Importieren Sie eine Stellenbeschreibung — AI erkennt die Felder automatisch
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {recognizedFields.map((field) => (
                  <div key={field.label} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{field.label}</p>
                      <p className="text-sm font-medium truncate">{field.value}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {field.confidence}%
                    </Badge>
                  </div>
                ))}

                {/* Track suggestion */}
                {trackSuggestion && (
                  <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 text-sm">
                      <AlertTriangle className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        AI erkennt: {trackSuggestion === 'freelance' ? 'Freelancer-Projekt' : 'ANÜ'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Möchten Sie den Track wechseln?
                    </p>
                  </div>
                )}
              </div>
            )}

            {importDone && (
              <div className="pt-3 border-t flex items-center gap-2 text-sm text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Import erfolgreich
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
