import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  Plus, 
  Pin, 
  PinOff, 
  MoreVertical, 
  Trash2,
  Lock,
  Users,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface CandidateNotesProps {
  candidateId: string;
}

interface CandidateNote {
  id: string;
  candidate_id: string;
  recruiter_id: string;
  content: string;
  category: string | null;
  is_private: boolean;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  soft_skills: { label: 'Soft Skills', color: 'bg-blue-100 text-blue-700' },
  interview_impression: { label: 'Intervieweindruck', color: 'bg-purple-100 text-purple-700' },
  risks: { label: 'Risiken', color: 'bg-red-100 text-red-700' },
  strengths: { label: 'Stärken', color: 'bg-green-100 text-green-700' },
  special_wishes: { label: 'Besondere Wünsche', color: 'bg-amber-100 text-amber-700' },
  general: { label: 'Allgemein', color: 'bg-gray-100 text-gray-700' },
};

export function CandidateNotes({ candidateId }: CandidateNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [isPrivate, setIsPrivate] = useState(true);
  const [showAddNote, setShowAddNote] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  const { data: notes, isLoading } = useQuery({
    queryKey: ['candidate-notes', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_notes')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CandidateNote[];
    },
    enabled: !!candidateId,
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('candidate_notes')
        .insert({
          candidate_id: candidateId,
          recruiter_id: user.id,
          content: newNote,
          category: newCategory,
          is_private: isPrivate,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-notes', candidateId] });
      setNewNote('');
      setShowAddNote(false);
      toast.success('Notiz hinzugefügt');
    },
    onError: () => {
      toast.error('Fehler beim Speichern der Notiz');
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ noteId, isPinned }: { noteId: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('candidate_notes')
        .update({ is_pinned: !isPinned })
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-notes', candidateId] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('candidate_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-notes', candidateId] });
      toast.success('Notiz gelöscht');
    },
  });

  const filteredNotes = notes?.filter(note => 
    !filterCategory || note.category === filterCategory
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Notizen
          {notes && notes.length > 0 && (
            <Badge variant="secondary">{notes.length}</Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filterCategory ? categoryConfig[filterCategory]?.label : 'Alle'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterCategory(null)}>
                Alle anzeigen
              </DropdownMenuItem>
              {Object.entries(categoryConfig).map(([key, config]) => (
                <DropdownMenuItem key={key} onClick={() => setFilterCategory(key)}>
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" onClick={() => setShowAddNote(!showAddNote)}>
            <Plus className="h-4 w-4 mr-2" />
            Notiz
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddNote && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <Textarea
              placeholder="Neue Notiz eingeben..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm">Kategorie:</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryConfig).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
                <Label htmlFor="private" className="text-sm flex items-center gap-1">
                  {isPrivate ? <Lock className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                  {isPrivate ? 'Privat' : 'Geteilt'}
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddNote(false)}>
                Abbrechen
              </Button>
              <Button 
                size="sm" 
                onClick={() => addNoteMutation.mutate()}
                disabled={!newNote.trim() || addNoteMutation.isPending}
              >
                Speichern
              </Button>
            </div>
          </div>
        )}

        {(!filteredNotes || filteredNotes.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto opacity-50 mb-3" />
            <p>Keine Notizen vorhanden</p>
            <p className="text-sm">Füge deine erste Notiz hinzu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotes.map((note) => {
              const category = categoryConfig[note.category || 'general'] || categoryConfig.general;
              
              return (
                <div
                  key={note.id}
                  className={`border rounded-lg p-4 ${note.is_pinned ? 'bg-amber-50/50 border-amber-200' : ''}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {note.is_pinned && <Pin className="h-4 w-4 text-amber-600" />}
                      <Badge className={category.color}>{category.label}</Badge>
                      {note.is_private ? (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Users className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(note.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => togglePinMutation.mutate({ noteId: note.id, isPinned: note.is_pinned })}
                          >
                            {note.is_pinned ? (
                              <>
                                <PinOff className="h-4 w-4 mr-2" />
                                Lösen
                              </>
                            ) : (
                              <>
                                <Pin className="h-4 w-4 mr-2" />
                                Anpinnen
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
