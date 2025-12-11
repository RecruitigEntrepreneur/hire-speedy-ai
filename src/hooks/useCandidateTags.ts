import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface CandidateTag {
  id: string;
  name: string;
  color: string;
  recruiter_id: string;
  created_at: string;
}

export interface TagAssignment {
  tag_id: string;
  candidate_id: string;
  assigned_at: string;
}

export function useCandidateTags() {
  const { user } = useAuth();
  const [tags, setTags] = useState<CandidateTag[]>([]);
  const [assignments, setAssignments] = useState<TagAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('candidate_tags')
      .select('*')
      .eq('recruiter_id', user.id)
      .order('name');

    if (!error && data) {
      setTags(data as CandidateTag[]);
    }
  }, [user]);

  const fetchAssignments = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('candidate_tag_assignments')
      .select('*');

    if (!error && data) {
      setAssignments(data as TagAssignment[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTags();
      fetchAssignments();
    }
  }, [user, fetchTags, fetchAssignments]);

  const createTag = async (name: string, color: string) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('candidate_tags')
      .insert({ name, color, recruiter_id: user.id })
      .select()
      .single();

    if (!error && data) {
      setTags(prev => [...prev, data as CandidateTag]);
      return data;
    }
    return null;
  };

  const deleteTag = async (tagId: string) => {
    const { error } = await supabase
      .from('candidate_tags')
      .delete()
      .eq('id', tagId);

    if (!error) {
      setTags(prev => prev.filter(t => t.id !== tagId));
      setAssignments(prev => prev.filter(a => a.tag_id !== tagId));
    }
    return !error;
  };

  const assignTag = async (candidateId: string, tagId: string) => {
    const { error } = await supabase
      .from('candidate_tag_assignments')
      .insert({ candidate_id: candidateId, tag_id: tagId });

    if (!error) {
      setAssignments(prev => [...prev, { candidate_id: candidateId, tag_id: tagId, assigned_at: new Date().toISOString() }]);
    }
    return !error;
  };

  const removeTag = async (candidateId: string, tagId: string) => {
    const { error } = await supabase
      .from('candidate_tag_assignments')
      .delete()
      .eq('candidate_id', candidateId)
      .eq('tag_id', tagId);

    if (!error) {
      setAssignments(prev => prev.filter(a => !(a.candidate_id === candidateId && a.tag_id === tagId)));
    }
    return !error;
  };

  const getCandidateTags = (candidateId: string) => {
    const tagIds = assignments.filter(a => a.candidate_id === candidateId).map(a => a.tag_id);
    return tags.filter(t => tagIds.includes(t.id));
  };

  return {
    tags,
    assignments,
    loading,
    createTag,
    deleteTag,
    assignTag,
    removeTag,
    getCandidateTags,
    refetch: () => { fetchTags(); fetchAssignments(); },
  };
}
