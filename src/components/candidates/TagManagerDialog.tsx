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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Plus, X, Tag } from 'lucide-react';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { toast } from 'sonner';

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
];

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string | null;
  tags: CandidateTag[];
  candidateTags: CandidateTag[];
  onCreateTag: (name: string, color: string) => Promise<any>;
  onDeleteTag: (tagId: string) => Promise<boolean>;
  onAssignTag: (candidateId: string, tagId: string) => Promise<boolean>;
  onRemoveTag: (candidateId: string, tagId: string) => Promise<boolean>;
}

export function TagManagerDialog({
  open,
  onOpenChange,
  candidateId,
  tags,
  candidateTags,
  onCreateTag,
  onDeleteTag,
  onAssignTag,
  onRemoveTag,
}: TagManagerDialogProps) {
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsCreating(true);
    const result = await onCreateTag(newTagName.trim(), newTagColor);
    if (result) {
      toast.success('Tag erstellt');
      setNewTagName('');
      setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
    }
    setIsCreating(false);
  };

  const handleToggleTag = async (tagId: string, isAssigned: boolean) => {
    if (!candidateId) return;
    if (isAssigned) {
      await onRemoveTag(candidateId, tagId);
    } else {
      await onAssignTag(candidateId, tagId);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (confirm('Tag wirklich löschen? Er wird von allen Kandidaten entfernt.')) {
      const success = await onDeleteTag(tagId);
      if (success) toast.success('Tag gelöscht');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Tags verwalten
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create New Tag */}
          <div className="space-y-2">
            <Label>Neuen Tag erstellen</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Tag-Name..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              />
              <div className="flex gap-1">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    className={`w-6 h-6 rounded-full border-2 ${
                      newTagColor === color ? 'border-foreground' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewTagColor(color)}
                  />
                ))}
              </div>
              <Button onClick={handleCreateTag} disabled={isCreating || !newTagName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Existing Tags */}
          {candidateId && tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags zuweisen</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {tags.map((tag) => {
                  const isAssigned = candidateTags.some((t) => t.id === tag.id);
                  return (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-2 rounded-lg border"
                    >
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isAssigned}
                          onCheckedChange={() => handleToggleTag(tag.id, isAssigned)}
                        />
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: tag.color + '30',
                            color: tag.color,
                            borderColor: tag.color,
                          }}
                        >
                          {tag.name}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleDeleteTag(tag.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Tags (when not assigning) */}
          {!candidateId && tags.length > 0 && (
            <div className="space-y-2">
              <Label>Alle Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="cursor-pointer group"
                    style={{
                      backgroundColor: tag.color + '30',
                      color: tag.color,
                      borderColor: tag.color,
                    }}
                  >
                    {tag.name}
                    <X
                      className="h-3 w-3 ml-1 opacity-50 group-hover:opacity-100"
                      onClick={() => handleDeleteTag(tag.id)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Noch keine Tags erstellt. Erstelle oben deinen ersten Tag.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
