import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Pencil, Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'date' | 'textarea' | 'select' | 'switch' | 'tags';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface EditableSectionCardProps {
  title: string;
  icon?: React.ReactNode;
  fields: FieldConfig[];
  values: Record<string, unknown>;
  onSave: (changes: Record<string, unknown>) => Promise<void>;
  onLogActivity?: (title: string, changes: { field: string; old: unknown; new: unknown }[]) => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function EditableSectionCard({
  title,
  icon,
  fields,
  values,
  onSave,
  onLogActivity,
  children,
  className,
}: EditableSectionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const handleOpenEdit = () => {
    const initial: Record<string, unknown> = {};
    fields.forEach(f => {
      initial[f.key] = values[f.key] ?? (f.type === 'tags' ? [] : f.type === 'switch' ? false : '');
    });
    setEditValues(initial);
    setTagInputs({});
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Track changes for logging
      const changes: { field: string; old: unknown; new: unknown }[] = [];
      const updates: Record<string, unknown> = {};

      fields.forEach(f => {
        const oldVal = values[f.key];
        const newVal = editValues[f.key];
        
        // Convert types for comparison
        let oldCompare = oldVal;
        let newCompare = newVal;
        
        if (f.type === 'number') {
          oldCompare = oldVal ?? null;
          newCompare = newVal ? Number(newVal) : null;
        }
        
        const hasChanged = JSON.stringify(oldCompare) !== JSON.stringify(newCompare);
        
        if (hasChanged) {
          changes.push({ field: f.label, old: oldVal, new: newVal });
          updates[f.key] = f.type === 'number' ? (newVal ? Number(newVal) : null) : newVal;
        }
      });

      if (Object.keys(updates).length > 0) {
        await onSave(updates);
        
        if (onLogActivity && changes.length > 0) {
          await onLogActivity(`${title} bearbeitet`, changes);
        }
        
        toast.success('Änderungen gespeichert');
      }
      
      setIsEditing(false);
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = (fieldKey: string) => {
    const input = tagInputs[fieldKey]?.trim();
    if (!input) return;
    
    const currentTags = (editValues[fieldKey] as string[]) || [];
    if (!currentTags.includes(input)) {
      setEditValues(prev => ({
        ...prev,
        [fieldKey]: [...currentTags, input],
      }));
    }
    setTagInputs(prev => ({ ...prev, [fieldKey]: '' }));
  };

  const handleRemoveTag = (fieldKey: string, tag: string) => {
    const currentTags = (editValues[fieldKey] as string[]) || [];
    setEditValues(prev => ({
      ...prev,
      [fieldKey]: currentTags.filter(t => t !== tag),
    }));
  };

  const renderField = (field: FieldConfig) => {
    const value = editValues[field.key];

    switch (field.type) {
      case 'text':
      case 'email':
      case 'number':
      case 'date':
        return (
          <Input
            type={field.type}
            value={(value as string) ?? ''}
            onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={(value as string) ?? ''}
            onChange={e => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
            placeholder={field.placeholder}
            rows={3}
          />
        );

      case 'select':
        return (
          <Select
            value={(value as string) ?? ''}
            onValueChange={v => setEditValues(prev => ({ ...prev, [field.key]: v }))}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Auswählen...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'switch':
        return (
          <Switch
            checked={(value as boolean) ?? false}
            onCheckedChange={v => setEditValues(prev => ({ ...prev, [field.key]: v }))}
          />
        );

      case 'tags':
        const tags = (value as string[]) || [];
        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={tagInputs[field.key] || ''}
                onChange={e => setTagInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag(field.key))}
              />
              <Button type="button" size="icon" variant="outline" onClick={() => handleAddTag(field.key)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag, i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(field.key, tag)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3 relative">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-3 right-3 h-7 w-7 opacity-60 hover:opacity-100"
            onClick={handleOpenEdit}
            title="Bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>

      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {icon}
              {title} bearbeiten
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className={field.type === 'switch' ? 'flex items-center gap-3' : ''}>
                  {field.label}
                  {field.type === 'switch' && renderField(field)}
                </Label>
                {field.type !== 'switch' && renderField(field)}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
