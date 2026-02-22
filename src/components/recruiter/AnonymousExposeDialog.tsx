import { useState } from 'react';
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

  const generateExpose = async () => {
    setLoading(true);
    setExpose(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-expose', {
        body: { jobId },
      });
      if (error) throw error;
      setExpose(data?.expose || 'Kein Exposé generiert.');
    } catch (err) {
      console.error('Error generating expose:', err);
      toast({ title: 'Fehler', description: 'Exposé konnte nicht generiert werden.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!expose) return;
    await navigator.clipboard.writeText(expose);
    setCopied(true);
    toast({ title: 'Kopiert!', description: 'Exposé wurde in die Zwischenablage kopiert.' });
    setTimeout(() => setCopied(false), 2000);
  };

  // Auto-generate when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (isOpen && !expose && !loading) {
      generateExpose();
    }
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
            KI-generiertes, anonymisiertes Stellenexposé – ohne Firmennamen, ideal für die Kandidatenansprache.
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
          ) : null}
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
