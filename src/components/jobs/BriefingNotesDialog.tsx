import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { FileText, Loader2 } from 'lucide-react';

interface BriefingNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  initialNotes?: string;
  onSaved?: () => void;
}

export function BriefingNotesDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  initialNotes = '',
  onSaved,
}: BriefingNotesDialogProps) {
  const { t } = useTranslation('recruiterJobEdit');
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ briefing_notes: notes })
        .eq('id', jobId);

      if (error) throw error;

      toast.success(t('notes.saved'));
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      console.error('Error saving briefing notes:', error);
      toast.error(t('notes.saveError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            {t('notes.title')}
          </DialogTitle>
          <DialogDescription>
            {t('notes.description', { title: jobTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">{t('notes.label')}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notes.placeholder')}
              className="min-h-[200px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {t('notes.hint')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('notes.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('notes.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
