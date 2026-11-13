import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronUp,
  ExternalLink
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
  const { user } = useAuth();
  const { t } = useTranslation('candidates');
  const [step, setStep] = useState<'fetch' | 'select' | 'gdpr' | 'importing' | 'complete'>('fetch');
  const [contacts, setContacts] = useState<HubSpotContact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ imported: number; skipped: number; failed: number }>({ imported: 0, skipped: 0, failed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [gdprLegalBasis, setGdprLegalBasis] = useState(false);
  const [gdprCandidateInformed, setGdprCandidateInformed] = useState(false);
  const [gdprDataRelevant, setGdprDataRelevant] = useState(false);
  const [gdprInfoExpanded, setGdprInfoExpanded] = useState(false);
  const gdprAllChecked = gdprLegalBasis && gdprCandidateInformed && gdprDataRelevant;

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
        throw new Error(t('hubspot.noContacts'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('hubspot.loadError'));
      toast.error(t('hubspot.loadErrorToast'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error(t('hubspot.selectAtLeastOne'));
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

    // Log GDPR consent for the import batch
    if (imported > 0 && user?.id) {
      await supabase.from('consents').insert({
        subject_id: user.id,
        subject_type: 'recruiter',
        consent_type: 'candidate_data_processing',
        granted: true,
        granted_at: new Date().toISOString(),
        scope: `hubspot_import_${imported}_contacts`,
        version: '1.0',
      }).then(({ error: consentError }) => {
        if (consentError) console.error('Failed to log GDPR consent:', consentError);
      });
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
    setGdprLegalBasis(false);
    setGdprCandidateInformed(false);
    setGdprDataRelevant(false);
    setGdprInfoExpanded(false);
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
            {t('hubspot.title')}
          </DialogTitle>
          <DialogDescription>
            {t('hubspot.description')}
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
                  {t('hubspot.retry')}
                </Button>
              </>
            ) : (
              <>
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">
                  {t('hubspot.intro')}
                </p>
                <Button onClick={fetchContacts} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('hubspot.loading')}
                    </>
                  ) : (
                    t('hubspot.load')
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
                  {t('hubspot.selectAll', { selected: selectedIds.size, total: contacts.length })}
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
                {t('actions.cancel')}
              </Button>
              <Button onClick={() => setStep('gdpr')} disabled={selectedIds.size === 0}>
                {t('actions.next')}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'gdpr' && (
          <div className="space-y-5 py-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm">
                    {t('gdpr.responsibility')}
                  </p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={() => setGdprInfoExpanded(!gdprInfoExpanded)}
                  >
                    {t('gdpr.learnMore')}
                    {gdprInfoExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {gdprInfoExpanded && (
                    <ul className="text-xs text-muted-foreground space-y-1.5 pt-2 border-t mt-2">
                      <li>{t('gdpr.deletionHint')}</li>
                      <li>{t('gdpr.talentPoolHint')}</li>
                      <li className="pt-1">
                        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                          {t('gdpr.privacyPolicy')} <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={gdprLegalBasis} onCheckedChange={(v) => setGdprLegalBasis(v === true)} className="mt-0.5" />
                <span className="text-sm leading-snug">
                  {t('gdpr.legalBasis')}
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={gdprCandidateInformed} onCheckedChange={(v) => setGdprCandidateInformed(v === true)} className="mt-0.5" />
                <span className="text-sm leading-snug">
                  {t('gdpr.informed')}
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox checked={gdprDataRelevant} onCheckedChange={(v) => setGdprDataRelevant(v === true)} className="mt-0.5" />
                <span className="text-sm leading-snug">
                  {t('gdpr.relevant')}
                </span>
              </label>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>
                {t('actions.back')}
              </Button>
              <Button onClick={handleImport} disabled={!gdprAllChecked}>
                <Upload className="h-4 w-4 mr-2" />
                {t('hubspot.importCount', { count: selectedIds.size })}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <p className="font-medium">{t('hubspot.importing')}</p>
            <Progress value={progress} className="max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground">
              {t('hubspot.progress', { percent: Math.round(progress) })}
            </p>
          </div>
        )}

        {step === 'complete' && (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="font-medium">{t('hubspot.done')}</p>
            
            <div className="flex justify-center gap-4">
              {results.imported > 0 && (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  {t('hubspot.imported', { count: results.imported })}
                </Badge>
              )}
              {results.skipped > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  {t('hubspot.skipped', { count: results.skipped })}
                </Badge>
              )}
              {results.failed > 0 && (
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {t('hubspot.failed', { count: results.failed })}
                </Badge>
              )}
            </div>

            {results.skipped > 0 && (
              <Alert>
                <AlertDescription className="text-sm">
                  {t('hubspot.skippedHint')}
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter className="sm:justify-center">
              <Button onClick={() => handleClose(false)}>
                {t('actions.close')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
