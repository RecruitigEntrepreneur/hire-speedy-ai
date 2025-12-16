import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo, useState } from 'react';

export interface FilteredLead {
  id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  decision_level: string | null;
  functional_area: string | null;
  contact_outreach_status: string | null;
  contact_linkedin: string | null;
  company_id: string | null;
  company_name: string | null;
  company_domain: string | null;
  industry: string | null;
  company_city: string | null;
}

export interface LeadFilters {
  search: string;
  roles: string[];
  decisionLevels: string[];
  functionalAreas: string[];
  outreachStatuses: string[];
}

const DEFAULT_FILTERS: LeadFilters = {
  search: '',
  roles: [],
  decisionLevels: [],
  functionalAreas: [],
  outreachStatuses: [],
};

export function useFilteredLeads() {
  const [filters, setFilters] = useState<LeadFilters>(DEFAULT_FILTERS);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['outreach-leads-all'],
    queryFn: async () => {
      const { data: leadsData, error: leadsError } = await supabase
        .from('outreach_leads')
        .select('id, contact_name, first_name, last_name, contact_email, contact_role, decision_level, functional_area, contact_outreach_status, contact_linkedin, company_id, company_name, company_domain, industry, company_city');

      if (leadsError) throw leadsError;

      return (leadsData || []) as FilteredLead[];
    },
  });

  // Get unique filter options from data
  const filterOptions = useMemo(() => {
    const roles = new Set<string>();
    const decisionLevels = new Set<string>();
    const functionalAreas = new Set<string>();
    const outreachStatuses = new Set<string>();

    leads.forEach(lead => {
      if (lead.contact_role) roles.add(lead.contact_role);
      if (lead.decision_level) decisionLevels.add(lead.decision_level);
      if (lead.functional_area) functionalAreas.add(lead.functional_area);
      if (lead.contact_outreach_status) outreachStatuses.add(lead.contact_outreach_status);
    });

    return {
      roles: Array.from(roles).sort(),
      decisionLevels: Array.from(decisionLevels).sort(),
      functionalAreas: Array.from(functionalAreas).sort(),
      outreachStatuses: Array.from(outreachStatuses).sort(),
    };
  }, [leads]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          lead.contact_name?.toLowerCase().includes(searchLower) ||
          lead.contact_email?.toLowerCase().includes(searchLower) ||
          lead.contact_role?.toLowerCase().includes(searchLower) ||
          lead.company_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (filters.roles.length > 0 && !filters.roles.includes(lead.contact_role || '')) {
        return false;
      }

      // Decision level filter
      if (filters.decisionLevels.length > 0 && !filters.decisionLevels.includes(lead.decision_level || '')) {
        return false;
      }

      // Functional area filter
      if (filters.functionalAreas.length > 0 && !filters.functionalAreas.includes(lead.functional_area || '')) {
        return false;
      }

      // Outreach status filter
      if (filters.outreachStatuses.length > 0 && !filters.outreachStatuses.includes(lead.contact_outreach_status || '')) {
        return false;
      }

      return true;
    });
  }, [leads, filters]);

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const updateFilter = <K extends keyof LeadFilters>(key: K, value: LeadFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return {
    leads: filteredLeads,
    allLeads: leads,
    isLoading,
    filters,
    filterOptions,
    updateFilter,
    resetFilters,
    setFilters,
  };
}
