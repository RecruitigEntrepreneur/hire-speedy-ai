import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Eye, Edit, Trash2, Tag, UserPlus } from 'lucide-react';
import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';

interface CandidateTableViewProps {
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

export function CandidateTableView({
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
}: CandidateTableViewProps) {
  const allSelected = candidates.length > 0 && selectedIds.length === candidates.length;

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAll(!!checked)}
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>E-Mail</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead className="text-right">Erfahrung</TableHead>
            <TableHead className="text-right">Gehalt</TableHead>
            <TableHead>Skills</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead>Hinzugefügt</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => {
            const tags = getCandidateTags(candidate.id);
            const isSelected = selectedIds.includes(candidate.id);

            return (
              <TableRow
                key={candidate.id}
                className={isSelected ? 'bg-primary/5' : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => onSelect(candidate.id, !!checked)}
                  />
                </TableCell>
                <TableCell
                  className="font-medium cursor-pointer hover:text-primary"
                  onClick={() => onView(candidate)}
                >
                  {candidate.full_name}
                </TableCell>
                <TableCell>{candidate.email}</TableCell>
                <TableCell>{candidate.phone || '-'}</TableCell>
                <TableCell className="text-right">
                  {candidate.experience_years !== null ? `${candidate.experience_years}J` : '-'}
                </TableCell>
                <TableCell className="text-right">
                  {candidate.expected_salary
                    ? `${(candidate.expected_salary / 1000).toFixed(0)}k €`
                    : '-'}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[150px]">
                    {candidate.skills?.slice(0, 2).map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {(candidate.skills?.length || 0) > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{candidate.skills!.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 2).map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-xs"
                        style={{
                          backgroundColor: tag.color + '30',
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                    {tags.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{tags.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {format(new Date(candidate.created_at), 'dd.MM.yy', { locale: de })}
                </TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            );
          })}
          {candidates.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                Keine Kandidaten gefunden
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
