import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  User, 
  Briefcase, 
  GraduationCap, 
  Languages, 
  Sparkles,
  Edit2,
  X,
  AlertCircle,
  File
} from 'lucide-react';
import { useCvParsing, ParsedCVData } from '@/hooks/useCvParsing';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CvUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCandidateCreated?: (candidateId: string) => void;
  existingCandidateId?: string;
}

type Step = 'upload' | 'extracting' | 'parsing' | 'review' | 'saving';
type UploadMode = 'pdf' | 'text';

export function CvUploadDialog({ 
  open, 
  onOpenChange, 
  onCandidateCreated,
  existingCandidateId 
}: CvUploadDialogProps) {
  const { user } = useAuth();
  const { parseCV, extractTextFromPdf, saveParsedCandidate, parsing, extractingPdf, saving } = useCvParsing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<Step>('upload');
  const [uploadMode, setUploadMode] = useState<UploadMode>('pdf');
  const [cvText, setCvText] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedCVData | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Nur PDF-Dateien werden unterstützt');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Die Datei darf maximal 10MB groß sein');
      return;
    }

    setSelectedFile(file);
  };

  const handlePdfUploadAndParse = async () => {
    if (!selectedFile || !user?.id) return;

    try {
      setUploading(true);
      setStep('extracting');

      // Upload PDF to storage
      const fileName = `${user.id}/${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('cv-documents')
        .upload(fileName, selectedFile);

      if (uploadError) {
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
      }

      console.log('PDF uploaded to:', fileName);

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('cv-documents')
        .getPublicUrl(fileName);

      // Store file info for later saving to candidate_documents
      setUploadedFileInfo({
        fileName: selectedFile.name,
        fileUrl: publicUrl,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
      });

      // Extract text from PDF
      const extractedText = await extractTextFromPdf(fileName);
      
      if (!extractedText) {
        throw new Error('Text-Extraktion fehlgeschlagen');
      }

      setRawText(extractedText);
      setStep('parsing');

      // Parse the extracted text
      const result = await parseCV(extractedText);
      
      if (result) {
        setParsedData(result);
        setStep('review');
      } else {
        setStep('upload');
      }
    } catch (error) {
      console.error('PDF processing error:', error);
      toast.error(error instanceof Error ? error.message : 'Fehler bei der PDF-Verarbeitung');
      setStep('upload');
    } finally {
      setUploading(false);
    }
  };

  const handleTextParse = async () => {
    if (!cvText.trim()) return;
    
    setStep('parsing');
    setRawText(cvText);
    
    const result = await parseCV(cvText);
    
    if (result) {
      setParsedData(result);
      setStep('review');
    } else {
      setStep('upload');
    }
  };

  const handleSave = async () => {
    if (!parsedData || !user?.id) return;
    
    setStep('saving');
    
    const candidateId = await saveParsedCandidate(
      parsedData,
      rawText,
      user.id,
      existingCandidateId,
      uploadedFileInfo || undefined
    );
    
    if (candidateId) {
      onCandidateCreated?.(candidateId);
      handleClose();
    } else {
      setStep('review');
    }
  };

  const handleClose = () => {
    setStep('upload');
    setUploadMode('pdf');
    setCvText('');
    setRawText('');
    setParsedData(null);
    setEditMode(false);
    setSelectedFile(null);
    setUploadedFileInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  const updateParsedField = useCallback((field: keyof ParsedCVData, value: unknown) => {
    if (!parsedData) return;
    setParsedData({ ...parsedData, [field]: value });
  }, [parsedData]);

  const proficiencyLabels: Record<string, string> = {
    native: 'Muttersprache',
    fluent: 'Fließend',
    advanced: 'Fortgeschritten',
    intermediate: 'Gut',
    basic: 'Grundkenntnisse',
  };

  const seniorityLabels: Record<string, string> = {
    junior: 'Junior',
    mid: 'Mid-Level',
    senior: 'Senior',
    lead: 'Lead',
    director: 'Director',
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {existingCandidateId ? 'CV aktualisieren' : 'Kandidat aus CV erstellen'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Laden Sie eine PDF-Datei hoch oder fügen Sie den CV-Text ein.'}
            {step === 'extracting' && 'PDF wird verarbeitet...'}
            {step === 'parsing' && 'CV wird analysiert...'}
            {step === 'review' && 'Überprüfen und bearbeiten Sie die extrahierten Daten.'}
            {step === 'saving' && 'Kandidat wird gespeichert...'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {['upload', 'extracting', 'parsing', 'review', 'saving'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s 
                  ? 'bg-primary text-primary-foreground' 
                  : ['extracting', 'parsing', 'review', 'saving'].indexOf(step) > ['extracting', 'parsing', 'review', 'saving'].indexOf(s as Step)
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}>
                {step === s && (s === 'extracting' || s === 'parsing' || s === 'saving') ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : ['extracting', 'parsing', 'review', 'saving'].indexOf(step) > ['extracting', 'parsing', 'review', 'saving'].indexOf(s as Step) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 4 && <div className="w-8 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Upload Mode Tabs */}
            <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as UploadMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pdf" className="flex items-center gap-2">
                  <File className="h-4 w-4" />
                  PDF hochladen
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Text einfügen
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pdf" className="space-y-4 mt-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    selectedFile ? 'border-primary bg-primary/5' : 'bg-muted/50 hover:border-primary/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <>
                      <CheckCircle2 className="h-12 w-12 mx-auto text-primary mb-4" />
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Entfernen
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="font-medium">PDF-Datei auswählen</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Klicken oder per Drag & Drop (max. 10MB)
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Abbrechen
                  </Button>
                  <Button 
                    onClick={handlePdfUploadAndParse} 
                    disabled={!selectedFile || uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    PDF analysieren
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>CV-Text einfügen</Label>
                  <Textarea
                    placeholder="Fügen Sie hier den vollständigen Lebenslauf-Text ein..."
                    value={cvText}
                    onChange={(e) => setCvText(e.target.value)}
                    className="min-h-[250px] font-mono text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Abbrechen
                  </Button>
                  <Button onClick={handleTextParse} disabled={!cvText.trim()}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    CV analysieren
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {step === 'extracting' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">PDF wird verarbeitet...</p>
            <p className="text-sm text-muted-foreground">Text wird aus der PDF extrahiert.</p>
          </div>
        )}

        {step === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">CV wird analysiert...</p>
            <p className="text-sm text-muted-foreground">Dies kann einige Sekunden dauern.</p>
          </div>
        )}

        {step === 'review' && parsedData && (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-6">
              {/* Header Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium">Daten erfolgreich extrahiert</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  {editMode ? 'Bearbeitung beenden' : 'Bearbeiten'}
                </Button>
              </div>

              {/* AI Summary */}
              {parsedData.cv_ai_summary && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI-Zusammenfassung
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {editMode ? (
                      <Textarea
                        value={parsedData.cv_ai_summary}
                        onChange={(e) => updateParsedField('cv_ai_summary', e.target.value)}
                        className="min-h-[100px]"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{parsedData.cv_ai_summary}</p>
                    )}
                    {parsedData.cv_ai_bullets.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {parsedData.cv_ai_bullets.map((bullet, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="personal" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="personal" className="text-xs">
                    <User className="h-3 w-3 mr-1" />
                    Stammdaten
                  </TabsTrigger>
                  <TabsTrigger value="experience" className="text-xs">
                    <Briefcase className="h-3 w-3 mr-1" />
                    Erfahrung
                  </TabsTrigger>
                  <TabsTrigger value="education" className="text-xs">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    Ausbildung
                  </TabsTrigger>
                  <TabsTrigger value="skills" className="text-xs">
                    <Languages className="h-3 w-3 mr-1" />
                    Skills
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      {editMode ? (
                        <Input
                          value={parsedData.full_name || ''}
                          onChange={(e) => updateParsedField('full_name', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded">{parsedData.full_name || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>E-Mail</Label>
                      {editMode ? (
                        <Input
                          value={parsedData.email || ''}
                          onChange={(e) => updateParsedField('email', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded">{parsedData.email || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Telefon</Label>
                      {editMode ? (
                        <Input
                          value={parsedData.phone || ''}
                          onChange={(e) => updateParsedField('phone', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded">{parsedData.phone || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Standort</Label>
                      {editMode ? (
                        <Input
                          value={parsedData.location || ''}
                          onChange={(e) => updateParsedField('location', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded">{parsedData.location || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Aktuelle Rolle</Label>
                      {editMode ? (
                        <Input
                          value={parsedData.current_title || ''}
                          onChange={(e) => updateParsedField('current_title', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded">{parsedData.current_title || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Aktuelle Firma</Label>
                      {editMode ? (
                        <Input
                          value={parsedData.current_company || ''}
                          onChange={(e) => updateParsedField('current_company', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm p-2 bg-muted rounded">{parsedData.current_company || '-'}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Berufserfahrung</Label>
                      <p className="text-sm p-2 bg-muted rounded">
                        {parsedData.experience_years ? `${parsedData.experience_years} Jahre` : '-'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Seniority</Label>
                      <p className="text-sm p-2 bg-muted rounded">
                        {parsedData.seniority ? seniorityLabels[parsedData.seniority] || parsedData.seniority : '-'}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gehaltsvorstellung</Label>
                      <p className="text-sm p-2 bg-muted rounded">
                        {parsedData.salary_expectation_min || parsedData.salary_expectation_max 
                          ? `${parsedData.salary_expectation_min?.toLocaleString() || '?'} - ${parsedData.salary_expectation_max?.toLocaleString() || '?'} €`
                          : '-'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Kündigungsfrist</Label>
                      <p className="text-sm p-2 bg-muted rounded">{parsedData.notice_period || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Remote-Präferenz</Label>
                      <p className="text-sm p-2 bg-muted rounded">{parsedData.remote_preference || '-'}</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Umzugsbereit</Label>
                      <p className="text-sm p-2 bg-muted rounded">{parsedData.relocation_ready ? 'Ja' : 'Nein'}</p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="experience" className="space-y-4 mt-4">
                  {parsedData.experiences.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>Keine Berufserfahrung extrahiert</p>
                    </div>
                  ) : (
                    parsedData.experiences.map((exp, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{exp.job_title}</h4>
                              <p className="text-sm text-muted-foreground">{exp.company_name}</p>
                              {exp.location && (
                                <p className="text-xs text-muted-foreground">{exp.location}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm">
                                {exp.start_date || '?'} - {exp.is_current ? 'Heute' : exp.end_date || '?'}
                              </p>
                              {exp.is_current && (
                                <Badge variant="secondary" className="mt-1">Aktuell</Badge>
                              )}
                            </div>
                          </div>
                          {exp.description && (
                            <p className="text-sm text-muted-foreground mt-2">{exp.description}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="education" className="space-y-4 mt-4">
                  {parsedData.educations.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>Keine Ausbildung extrahiert</p>
                    </div>
                  ) : (
                    parsedData.educations.map((edu, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-medium">{edu.institution}</h4>
                              {edu.degree && (
                                <p className="text-sm text-muted-foreground">
                                  {edu.degree}{edu.field_of_study ? ` - ${edu.field_of_study}` : ''}
                                </p>
                              )}
                            </div>
                            {edu.graduation_year && (
                              <p className="text-sm text-muted-foreground">{edu.graduation_year}</p>
                            )}
                          </div>
                          {edu.grade && (
                            <p className="text-xs text-muted-foreground mt-1">Note: {edu.grade}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="skills" className="space-y-4 mt-4">
                  <div>
                    <h4 className="font-medium mb-2">Skills ({parsedData.skills.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {parsedData.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {skill.name}
                          {skill.level && (
                            <span className="text-xs opacity-70">({skill.level})</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium mb-2">Sprachen ({parsedData.languages.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {parsedData.languages.map((lang, index) => (
                        <Badge key={index} variant="outline">
                          {lang.language} - {proficiencyLabels[lang.proficiency] || lang.proficiency}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {parsedData.target_roles.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Wunschrollen</h4>
                        <div className="flex flex-wrap gap-2">
                          {parsedData.target_roles.map((role, index) => (
                            <Badge key={index} variant="default">{role}</Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-16 w-16 animate-spin text-primary mb-4" />
            <p className="text-lg font-medium">Kandidat wird gespeichert...</p>
          </div>
        )}

        {/* Footer Actions for Review Step */}
        {step === 'review' && (
          <div className="flex justify-between pt-4 border-t">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Zurück
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClose}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {existingCandidateId ? 'Kandidat aktualisieren' : 'Kandidat erstellen'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
