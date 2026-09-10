import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnonymousExposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}

export function AnonymousExposeDialog({ open, onOpenChange, jobId }: AnonymousExposeDialogProps) {
  const [expose, setExpose] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const request = useRef(0);

  useEffect(() => {
    request.current += 1;
    setExpose(null);
    setCopied(false);
    setLoading(false);
  }, [jobId, open]);

  const generateExpose = async () => {
    const currentRequest = ++request.current;
    setLoading(true);
    setExpose(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-expose', {
        body: { jobId },
      });
      if (error) throw error;
      if (request.current === currentRequest) setExpose(data?.expose || 'Kein Exposé generiert.');
    } catch (err) {
      console.error('Error generating expose:', err);
      if (request.current === currentRequest) toast({ title: 'Fehler', description: 'Exposé konnte nicht generiert werden.', variant: 'destructive' });
    } finally {
      if (request.current === currentRequest) setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!expose) return;
    try {
      await navigator.clipboard.writeText(expose);
      setCopied(true);
      toast({ title: 'Kopiert!', description: 'Exposé wurde in die Zwischenablage kopiert.' });
    } catch {
      toast({ title: 'Kopieren nicht möglich', description: 'Bitte markiere den Text und kopiere ihn manuell.', variant: 'destructive' });
    }
  };

  // Auto-generate when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setExpose(null);
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Anonymes Exposé</DialogTitle>
          <DialogDescription>
            Erstelle einen Entwurf für die Kandidatenansprache. Prüfe die Aussagen und die Anonymisierung vor der Weitergabe.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Exposé wird generiert...</p>
            </div>
          ) : expose ? (
            <ScrollArea className="h-[400px] rounded-lg border border-border p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                {expose}
              </div>
            </ScrollArea>
          ) : <div className="space-y-4 py-6 text-center"><p className="text-sm leading-6 text-muted-foreground">Das Exposé wird erst auf deinen Klick erstellt. Anschließend kannst du den vollständigen Text prüfen und kopieren.</p><Button onClick={generateExpose}>Exposé generieren</Button></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Schließen
          </Button>
          {expose && (
            <Button onClick={handleCopy} disabled={copied}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              {copied ? 'Kopiert' : 'Kopieren'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
