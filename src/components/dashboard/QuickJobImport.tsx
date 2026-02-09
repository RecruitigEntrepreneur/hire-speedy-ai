import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useJobPdfParsing } from '@/hooks/useJobPdfParsing';
import { useJobParsing } from '@/hooks/useJobParsing';
import { toast } from 'sonner';
import { FileText, Type, Link2, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickJobImportProps {
  className?: string;
}

export function QuickJobImport({ className }: QuickJobImportProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { uploadAndParsePdf, parsing: pdfParsing } = useJobPdfParsing();
  const { parseJobUrl, parseJobText, parsing: textParsing } = useJobParsing();
  
  const [textModalOpen, setTextModalOpen] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [jobText, setJobText] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const isLoading = pdfParsing || textParsing;

  const handleFileSelect = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Bitte laden Sie eine PDF-Datei hoch');
      return;
    }

    const result = await uploadAndParsePdf(file);
    if (result) {
      sessionStorage.setItem('prefillJobData', JSON.stringify(result));
      navigate('/dashboard/jobs/new?prefill=true');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleTextImport = async () => {
    if (!jobText.trim()) {
      toast.error('Bitte geben Sie eine Stellenbeschreibung ein');
      return;
    }

    const result = await parseJobText(jobText);
    if (result) {
      sessionStorage.setItem('prefillJobData', JSON.stringify(result));
      setTextModalOpen(false);
      setJobText('');
      navigate('/dashboard/jobs/new?prefill=true');
    }
  };

  const handleUrlImport = async () => {
    if (!jobUrl.trim()) {
      toast.error('Bitte geben Sie eine URL ein');
      return;
    }

    const result = await parseJobUrl(jobUrl);
    if (result) {
      sessionStorage.setItem('prefillJobData', JSON.stringify(result));
      setUrlModalOpen(false);
      setJobUrl('');
      navigate('/dashboard/jobs/new?prefill=true');
    }
  };

  return (
    <>
      <Card className={cn("border-dashed border-2 border-border/50 bg-muted/30", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Job hinzufügen</h3>
              <p className="text-xs text-muted-foreground">PDF, Text oder URL importieren</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* PDF Upload */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg border border-border/50 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                isDragging && "border-primary bg-primary/10",
                isLoading && "opacity-50 pointer-events-none"
              )}
            >
              {pdfParsing ? (
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              ) : (
                <FileText className="h-5 w-5 text-muted-foreground mb-1" />
              )}
              <span className="text-xs font-medium">PDF</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                className="hidden"
              />
            </div>

            {/* Text Input */}
            <div
              onClick={() => !isLoading && setTextModalOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg border border-border/50 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                isLoading && "opacity-50 pointer-events-none"
              )}
            >
              <Type className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs font-medium">Text</span>
            </div>

            {/* URL Input */}
            <div
              onClick={() => !isLoading && setUrlModalOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-lg border border-border/50 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                isLoading && "opacity-50 pointer-events-none"
              )}
            >
              <Link2 className="h-5 w-5 text-muted-foreground mb-1" />
              <span className="text-xs font-medium">URL</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Text Import Modal */}
      <Dialog open={textModalOpen} onOpenChange={setTextModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Stellenbeschreibung einfügen</DialogTitle>
            <DialogDescription>
              Fügen Sie die komplette Stellenbeschreibung ein. Die KI extrahiert automatisch alle relevanten Informationen.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Stellenbeschreibung hier einfügen..."
            className="min-h-[300px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleTextImport} disabled={textParsing}>
              {textParsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analysiere...
                </>
              ) : (
                'Importieren'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* URL Import Modal */}
      <Dialog open={urlModalOpen} onOpenChange={setUrlModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Von URL importieren</DialogTitle>
            <DialogDescription>
              Geben Sie die URL der Stellenausschreibung ein. Die KI liest die Seite und extrahiert alle Informationen.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            placeholder="https://..."
            type="url"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlModalOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUrlImport} disabled={textParsing}>
              {textParsing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analysiere...
                </>
              ) : (
                'Importieren'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
