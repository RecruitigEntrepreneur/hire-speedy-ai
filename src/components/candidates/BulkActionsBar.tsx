import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('candidates');
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-[calc(var(--handy-leiste,0px)+1.5rem)] left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1rem)]">
      {/* Apple-Stil (24.11.2026): weiße Leiste, Knöpfe ohne Symbole, Löschen nur in roter Schrift */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background px-3 py-2.5 shadow-lg">
        <span className="px-1 text-sm font-medium">{t('bulk.selected', { count: selectedCount })}</span>

        {/* Assign Tag */}
        {tags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                {t('bulk.assignTag')}
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
                {t('bulk.removeTag')}
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
          {t('actions.talentPool')}
        </Button>

        {/* Export */}
        <Button variant="outline" size="sm" onClick={onExport}>
          {t('bulk.export')}
        </Button>

        {/* Delete */}
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
          {t('actions.delete')}
        </Button>

        {/* Clear Selection */}
        <Button variant="ghost" size="icon" onClick={onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
