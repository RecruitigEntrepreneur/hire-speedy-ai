import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CandidateProject {
  id: string;
  candidate_id: string;
  project_name: string;
  client_name: string | null;
  client_industry: string | null;
  project_type: string | null;
  budget_range: string | null;
  team_size: number | null;
  duration_months: number | null;
  locations_count: number | null;
  devices_count: number | null;
  technologies: string[];
  responsibilities: string[];
  achievements: string[];
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  sort_order: number;
  is_highlight: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectFormData {
  project_name: string;
  client_name?: string;
  client_industry?: string;
  project_type?: string;
  budget_range?: string;
  team_size?: number;
  duration_months?: number;
  locations_count?: number;
  devices_count?: number;
  technologies?: string[];
  responsibilities?: string[];
  achievements?: string[];
  start_date?: string;
  end_date?: string;
  is_current?: boolean;
  is_highlight?: boolean;
}

export function useCandidateProjects(candidateId?: string) {
  const [projects, setProjects] = useState<CandidateProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchProjects = useCallback(async () => {
    if (!candidateId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_projects')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('sort_order')
        .order('start_date', { ascending: false });

      if (error) throw error;
      
      setProjects((data || []).map(p => ({
        ...p,
        technologies: Array.isArray(p.technologies) ? p.technologies : [],
        responsibilities: Array.isArray(p.responsibilities) ? p.responsibilities : [],
        achievements: Array.isArray(p.achievements) ? p.achievements : [],
      })) as CandidateProject[]);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addProject = async (projectData: ProjectFormData) => {
    if (!candidateId) return null;

    setSaving(true);
    try {
      const maxOrder = projects.length > 0
        ? Math.max(...projects.map(p => p.sort_order))
        : -1;

      const { data, error } = await supabase
        .from('candidate_projects')
        .insert({
          candidate_id: candidateId,
          ...projectData,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Projekt hinzugefügt',
        description: `${projectData.project_name} wurde erfolgreich hinzugefügt.`,
      });

      await fetchProjects();
      return data as CandidateProject;
    } catch (error) {
      console.error('Error adding project:', error);
      toast({
        title: 'Fehler',
        description: 'Das Projekt konnte nicht hinzugefügt werden.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateProject = async (projectId: string, updates: Partial<ProjectFormData>) => {
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('candidate_projects')
        .update(updates)
        .eq('id', projectId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Projekt aktualisiert',
        description: 'Die Änderungen wurden gespeichert.',
      });

      await fetchProjects();
      return data as CandidateProject;
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: 'Fehler',
        description: 'Das Projekt konnte nicht aktualisiert werden.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('candidate_projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Projekt gelöscht',
        description: 'Das Projekt wurde erfolgreich gelöscht.',
      });

      await fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: 'Fehler',
        description: 'Das Projekt konnte nicht gelöscht werden.',
        variant: 'destructive',
      });
    }
  };

  const toggleHighlight = async (projectId: string, isHighlight: boolean) => {
    await updateProject(projectId, { is_highlight: isHighlight });
  };

  const getHighlightedProjects = () => {
    return projects.filter(p => p.is_highlight);
  };

  return {
    projects,
    loading,
    saving,
    refetch: fetchProjects,
    addProject,
    updateProject,
    deleteProject,
    toggleHighlight,
    getHighlightedProjects,
  };
}
