import { useMemo, useState } from 'react';
import { Check, Copy, FileText, MessageSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/** „Per E-Mail weiterleiten“ aus dem Menü „Kandidaten anlegen“: die persönliche Eingangsadresse. */
export function PerMailWeiterleitenDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const { t } = useTranslation('candidates');
  const [copied, setCopied] = useState(false);

  const inboundEmail = useMemo(() => {
    if (!user?.id) return '';
    const shortId = user.id.replace(/-/g, '').slice(0, 8);
    return `r_${shortId}@inbound.matchunt.ai`;
  }, [user?.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inboundEmail);
      setCopied(true);
      toast.success(t('perMail.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('perMail.copyFailed'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('perMail.title')}</DialogTitle>
          <DialogDescription>
            {t('perMail.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-md px-3 py-2.5 text-sm font-mono select-all truncate border border-border/50">
              {inboundEmail}
            </div>
            <Button size="sm" variant="outline" className="shrink-0 h-9 w-9 p-0" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground space-y-2 bg-muted/30 rounded-lg p-3">
            <div className="flex gap-2">
              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{t('perMail.hintPdf')}</span>
            </div>
            <div className="flex gap-2">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{t('perMail.hintNotes')}</span>
            </div>
            <div className="flex gap-2">
              <Users className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{t('perMail.hintNoCv')}</span>
            </div>
            <div className="flex gap-2">
              <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{t('perMail.hintExisting')}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
