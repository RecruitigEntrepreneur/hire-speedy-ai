import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Phone, Mail, FileText, ArrowRightLeft, BookOpen, CheckCircle, Upload } from 'lucide-react';

interface AddActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (activityType: string, title: string, description: string) => void;
  loading?: boolean;
}

const activityTypes = [
  { value: 'call', label: 'Anruf', icon: Phone },
  { value: 'email', label: 'E-Mail', icon: Mail },
  { value: 'note', label: 'Notiz', icon: FileText },
  { value: 'status_change', label: 'Status geändert', icon: ArrowRightLeft },
  { value: 'playbook_used', label: 'Playbook genutzt', icon: BookOpen },
  { value: 'alert_actioned', label: 'Alert bearbeitet', icon: CheckCircle },
];

export function AddActivityDialog({ open, onOpenChange, onSubmit, loading }: AddActivityDialogProps) {
  const [activityType, setActivityType] = useState('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(activityType, title, description);
    setTitle('');
    setDescription('');
    setActivityType('note');
  };

  const selectedType = activityTypes.find(t => t.value === activityType);
  const Icon = selectedType?.icon || FileText;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            Aktivität hinzufügen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Aktivitätstyp</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map((type) => {
                  const TypeIcon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              placeholder="z.B. Erstgespräch durchgeführt"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              placeholder="Details zur Aktivität..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || loading}>
            {loading ? 'Speichere...' : 'Aktivität speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
