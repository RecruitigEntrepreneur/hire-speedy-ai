import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Upload, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  User,
  Mail,
  Phone,
  RefreshCw
} from 'lucide-react';

interface HubSpotContact {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone?: string;
  jobtitle?: string;
  company?: string;
  notes?: string;
}

interface HubSpotImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function HubSpotImportDialog({ open, onOpenChange, onImportComplete }: HubSpotImportDialogProps) {
  const [step, setStep] = useState<'fetch' | 'select' | 'importing' | 'complete'>('fetch');
  const [contacts, setContacts] = useState<HubSpotContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ imported: number; skipped: number; failed: number }>({ imported: 0, skipped: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('hubspot-sync', {
        body: { action: 'fetch_contacts' }
      });

      if (error) throw error;
      
      if (data?.contacts) {
        setContacts(data.contacts);
        setSelectedIds(new Set(data.contacts.map((c: HubSpotContact) => c.id)));
        setStep('select');
      } else {
        throw new Error('Keine Kontakte gefunden');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Kontakte');
      toast.error('Fehler beim Laden der HubSpot-Kontakte');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error('Bitte wählen Sie mindestens einen Kontakt aus');
      return;
    }

    setStep('importing');
    setProgress(0);
    
    const selectedContacts = contacts.filter(c => selectedIds.has(c.id));
    const total = selectedContacts.length;
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < selectedContacts.length; i++) {
      const contact = selectedContacts[i];
      
      try {
        const { data, error } = await supabase.functions.invoke('hubspot-sync', {
          body: { 
            action: 'import_contact',
            contact: contact
          }
        });

        if (error) throw error;
        
        if (data?.skipped) {
          skipped++;
        } else {
          imported++;
        }
      } catch (err) {
        failed++;
        console.error('Failed to import contact:', contact.email, err);
      }

      setProgress(((i + 1) / total) * 100);
    }

    setResults({ imported, skipped, failed });
    setStep('complete');
    
    if (imported > 0) {
      onImportComplete();
    }
  };

  const toggleContact = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const resetDialog = () => {
    setStep('fetch');
    setContacts([]);
    setSelectedIds(new Set());
    setProgress(0);
    setResults({ imported: 0, skipped: 0, failed: 0 });
    setError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      resetDialog();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center">
              <span className="text-lg">🟠</span>
            </div>
            HubSpot Import
          </DialogTitle>
          <DialogDescription>
            Importieren Sie Kontakte aus HubSpot als Kandidaten
          </DialogDescription>
        </DialogHeader>

        {step === 'fetch' && (
          <div className="py-8 text-center space-y-4">
            {error ? (
              <>
                <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                <p className="text-destructive">{error}</p>
                <Button onClick={fetchContacts} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Erneut versuchen
                </Button>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  Klicken Sie auf "Kontakte laden", um Ihre HubSpot-Kontakte abzurufen
                </p>
                <Button onClick={fetchContacts} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Lade Kontakte...
                    </>
                  ) : (
                    'Kontakte laden'
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {step === 'select' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedIds.size === contacts.length}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm text-muted-foreground">
                  Alle auswählen ({selectedIds.size}/{contacts.length})
                </span>
              </div>
            </div>
            
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {contacts.map(contact => (
                  <div 
                    key={contact.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedIds.has(contact.id) 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => toggleContact(contact.id)}
                  >
                    <Checkbox checked={selectedIds.has(contact.id)} />
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {contact.firstname} {contact.lastname}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                      {contact.phone && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                    </div>
                    {contact.jobtitle && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {contact.jobtitle}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleImport} disabled={selectedIds.size === 0}>
                <Upload className="h-4 w-4 mr-2" />
                {selectedIds.size} importieren
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <p className="font-medium">Importiere Kontakte...</p>
            <Progress value={progress} className="max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">
              {Math.round(progress)}% abgeschlossen
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="font-medium">Import abgeschlossen!</p>
            
            <div className="flex justify-center gap-4">
              {results.imported > 0 && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {results.imported} importiert
                </Badge>
              )}
              {results.skipped > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  {results.skipped} übersprungen
                </Badge>
              )}
              {results.failed > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {results.failed} fehlgeschlagen
                </Badge>
              )}
            </div>

            {results.skipped > 0 && (
              <Alert>
                <AlertDescription className="text-sm">
                  Einige Kontakte wurden übersprungen, da sie bereits als Kandidaten existieren.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="sm:justify-center">
              <Button onClick={() => handleClose(false)}>
                Schließen
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
