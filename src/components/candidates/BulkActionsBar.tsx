import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tag, Trash2, Download, X, ChevronDown, UserPlus } from 'lucide-react';
import { CandidateTag } from '@/hooks/useCandidateTags';

interface BulkActionsBarProps {
  selectedCount: number;
  tags: CandidateTag[];
  onClearSelection: () => void;
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onExport: () => void;
  onDelete: () => void;
  onAddToPool: () => void;
}

export function BulkActionsBar({
  selectedCount,
  tags,
  onClearSelection,
  onAssignTag,
  onRemoveTag,
  onExport,
  onDelete,
  onAddToPool,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-3 bg-card border shadow-lg rounded-lg px-4 py-3">
        <Badge variant="secondary" className="font-medium">
          {selectedCount} ausgewählt
        </Badge>

        {/* Assign Tag */}
        {tags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Tag className="h-4 w-4 mr-2" />
                Tag zuweisen
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {tags.map((tag) => (
                <DropdownMenuItem key={tag.id} onClick={() => onAssignTag(tag.id)}>
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Remove Tag */}
        {tags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Tag className="h-4 w-4 mr-2" />
                Tag entfernen
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {tags.map((tag) => (
                <DropdownMenuItem key={tag.id} onClick={() => onRemoveTag(tag.id)}>
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Add to Pool */}
        <Button variant="outline" size="sm" onClick={onAddToPool}>
          <UserPlus className="h-4 w-4 mr-2" />
          Talent Pool
        </Button>

        {/* Export */}
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-2" />
          Exportieren
        </Button>

        {/* Delete */}
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Löschen
        </Button>

        {/* Clear Selection */}
        <Button variant="ghost" size="icon" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
