import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Phone,
  Mail,
  Linkedin,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Tag,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';

interface CandidateListViewProps {
  candidates: Candidate[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  getCandidateTags: (candidateId: string) => CandidateTag[];
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
  onView: (candidate: Candidate) => void;
  onAssignTag: (candidateId: string) => void;
  onAddToPool: (candidate: Candidate) => void;
}

export function CandidateListView({
  candidates,
  selectedIds,
  onSelect,
  onSelectAll,
  getCandidateTags,
  onEdit,
  onDelete,
  onView,
  onAssignTag,
  onAddToPool,
}: CandidateListViewProps) {
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 p-3 bg-muted/50 border-b text-sm font-medium">
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => onSelectAll(!!checked)}
        />
        <div className="flex-1">Kandidat</div>
        <div className="w-32 hidden md:block">Erfahrung</div>
        <div className="w-32 hidden lg:block">Gehalt</div>
        <div className="w-24 hidden xl:block">Tags</div>
        <div className="w-32">Aktionen</div>
      </div>

      {/* Rows */}
      {candidates.map((candidate) => {
        const tags = getCandidateTags(candidate.id);
        const isSelected = selectedIds.includes(candidate.id);

        return (
          <div
            key={candidate.id}
            className={`flex items-center gap-4 p-3 border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
              isSelected ? 'bg-primary/5' : ''
            }`}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect(candidate.id, !!checked)}
            />
            <div
              className="flex-1 flex items-center gap-3 cursor-pointer"
              onClick={() => onView(candidate)}
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {candidate.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{candidate.full_name}</p>
                <p className="text-sm text-muted-foreground truncate">{candidate.email}</p>
              </div>
            </div>
            <div className="w-32 hidden md:block text-sm text-muted-foreground">
              {candidate.experience_years !== null
                ? `${candidate.experience_years} Jahre`
                : '-'}
            </div>
            <div className="w-32 hidden lg:block text-sm text-muted-foreground">
              {candidate.expected_salary
                ? `${(candidate.expected_salary / 1000).toFixed(0)}k €`
                : '-'}
            </div>
            <div className="w-24 hidden xl:block">
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 2).map((tag) => (
                  <div
                    key={tag.id}
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                    title={tag.name}
                  />
                ))}
                {tags.length > 2 && (
                  <span className="text-xs text-muted-foreground">+{tags.length - 2}</span>
                )}
              </div>
            </div>
            <div className="w-32 flex items-center gap-1">
              {candidate.phone && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.location.href = `tel:${candidate.phone}`}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.location.href = `mailto:${candidate.email}`}
              >
                <Mail className="h-4 w-4" />
              </Button>
              {candidate.linkedin_url && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                >
                  <Linkedin className="h-4 w-4" />
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(candidate)}>
                    <Eye className="h-4 w-4 mr-2" />
                    Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit(candidate)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Bearbeiten
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAssignTag(candidate.id)}>
                    <Tag className="h-4 w-4 mr-2" />
                    Tags
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAddToPool(candidate)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Talent Pool
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(candidate)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {candidates.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Keine Kandidaten gefunden
        </div>
      )}
    </div>
  );
}
