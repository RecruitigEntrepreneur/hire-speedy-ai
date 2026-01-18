import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export type NoteType = 'general' | 'strength' | 'concern' | 'question';

export interface InterviewNote {
  id: string;
  interview_id: string;
  user_id: string;
  content: string;
  note_type: NoteType;
  is_pinned: boolean;
  timestamp_seconds: number | null;
  created_at: string;
}

export function useLiveInterviewNotes(interviewId: string | null) {
  const [notes, setNotes] = useState<InterviewNote[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fetchNotes = useCallback(async () => {
    if (!interviewId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('interview_notes')
        .select('*')
        .eq('interview_id', interviewId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      // Cast the note_type to our NoteType
      const typedNotes: InterviewNote[] = (data || []).map(note => ({
        ...note,
        note_type: note.note_type as NoteType,
      }));
      setNotes(typedNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = useCallback(async (
    content: string, 
    noteType: NoteType = 'general',
    timestampSeconds?: number
  ) => {
    if (!interviewId || !user?.id || !content.trim()) return null;

    try {
      const { data, error } = await supabase
        .from('interview_notes')
        .insert({
          interview_id: interviewId,
          user_id: user.id,
          content: content.trim(),
          note_type: noteType,
          timestamp_seconds: timestampSeconds ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      
      const typedNote: InterviewNote = {
        ...data,
        note_type: data.note_type as NoteType,
      };
      setNotes(prev => [...prev, typedNote]);
      return typedNote;
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('Notiz konnte nicht gespeichert werden');
      return null;
    }
  }, [interviewId, user?.id]);

  const updateNote = useCallback(async (noteId: string, updates: Partial<Pick<InterviewNote, 'content' | 'is_pinned' | 'note_type'>>) => {
    try {
      const { error } = await supabase
        .from('interview_notes')
        .update(updates)
        .eq('id', noteId);

      if (error) throw error;
      
      setNotes(prev => prev.map(n => n.id === noteId ? { ...n, ...updates } : n));
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Notiz konnte nicht aktualisiert werden');
    }
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('interview_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Notiz konnte nicht gelöscht werden');
    }
  }, []);

  const togglePin = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      await updateNote(noteId, { is_pinned: !note.is_pinned });
    }
  }, [notes, updateNote]);

  const pinnedNotes = notes.filter(n => n.is_pinned);
  const regularNotes = notes.filter(n => !n.is_pinned);

  return {
    notes,
    pinnedNotes,
    regularNotes,
    loading,
    addNote,
    updateNote,
    deleteNote,
    togglePin,
    refetch: fetchNotes,
  };
}
