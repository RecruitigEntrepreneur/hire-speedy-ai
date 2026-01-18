import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InterviewType {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  default_duration: number;
  agenda_template: string | null;
  is_system: boolean;
  created_at: string;
}

export function useInterviewTypes(organizationId?: string) {
  const [types, setTypes] = useState<InterviewType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        let query = supabase
          .from('interview_types')
          .select('*')
          .order('is_system', { ascending: false })
          .order('name', { ascending: true });

        // Get system types and org-specific types
        if (organizationId) {
          query = query.or(`is_system.eq.true,organization_id.eq.${organizationId}`);
        } else {
          query = query.eq('is_system', true);
        }

        const { data, error } = await query;

        if (error) throw error;

        setTypes((data || []) as InterviewType[]);
      } catch (error) {
        console.error('Error fetching interview types:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTypes();
  }, [organizationId]);

  const getTypeById = (id: string) => {
    return types.find(t => t.id === id);
  };

  return {
    types,
    loading,
    getTypeById
  };
}
