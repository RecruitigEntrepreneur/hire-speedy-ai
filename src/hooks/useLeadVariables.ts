import { useMemo } from 'react';

export interface LeadVariable {
  key: string;
  label: string;
  value: string | null;
  category: 'contact' | 'company' | 'signals' | 'meta';
}

export interface LeadData {
  id: string;
  // Contact fields
  first_name?: string | null;
  last_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_role?: string | null;
  seniority?: string | null;
  department?: string | null;
  decision_level?: string | null;
  functional_area?: string | null;
  education?: string | null;
  mobile_phone?: string | null;
  direct_phone?: string | null;
  office_phone?: string | null;
  contact_phone?: string | null;
  personal_linkedin_url?: string | null;
  contact_linkedin?: string | null;
  // Company fields
  company_name?: string | null;
  company_domain?: string | null;
  company_website?: string | null;
  industry?: string | null;
  company_size?: string | null;
  company_headcount?: number | null;
  company_city?: string | null;
  company_country?: string | null;
  company_state?: string | null;
  company_description?: string | null;
  company_founded_year?: number | null;
  company_linkedin_url?: string | null;
  revenue_range?: string | null;
  company_financials?: string | null;
  company_technologies?: any;
  company_industries?: any;
  // Recruiting Signals
  hiring_activity?: string | null;
  hiring_volume?: string | null;
  live_jobs_count?: number | null;
  live_jobs?: any;
  open_positions_estimate?: number | null;
  current_ats?: string | null;
  recruiting_challenges?: any;
  career_page_url?: string | null;
  hiring_signals?: any;
  // Job Change
  job_change_data?: any;
  // Status
  status?: string | null;
  outreach_status?: string | null;
  contact_outreach_status?: string | null;
  priority?: string | null;
  score?: number | null;
  engagement_score?: number | null;
  // Meta
  language?: string | null;
  region?: string | null;
  segment?: string | null;
  lead_source?: string | null;
  list_name?: string | null;
  notes?: string | null;
  tags?: any;
  email_validated?: boolean | null;
  email_quality?: string | null;
}

export function useLeadVariables(lead: LeadData | null) {
  return useMemo(() => {
    if (!lead) {
      return {
        variables: [] as LeadVariable[],
        variableMap: {} as Record<string, string>,
        filledCount: 0,
        totalCount: 0,
        templateString: '',
      };
    }

    const fullName = lead.contact_name || 
      [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null;

    const allVariables: LeadVariable[] = [
      // Contact
      { key: 'first_name', label: 'Vorname', value: lead.first_name || null, category: 'contact' },
      { key: 'last_name', label: 'Nachname', value: lead.last_name || null, category: 'contact' },
      { key: 'full_name', label: 'Vollständiger Name', value: fullName, category: 'contact' },
      { key: 'email', label: 'E-Mail', value: lead.contact_email || null, category: 'contact' },
      { key: 'role', label: 'Position', value: lead.contact_role || null, category: 'contact' },
      { key: 'seniority', label: 'Seniority', value: lead.seniority || null, category: 'contact' },
      { key: 'department', label: 'Abteilung', value: lead.department || null, category: 'contact' },
      { key: 'decision_level', label: 'Entscheiderlevel', value: lead.decision_level || null, category: 'contact' },
      { key: 'functional_area', label: 'Funktionsbereich', value: lead.functional_area || null, category: 'contact' },
      { key: 'education', label: 'Ausbildung', value: lead.education || null, category: 'contact' },
      { key: 'phone', label: 'Telefon', value: lead.mobile_phone || lead.direct_phone || lead.office_phone || lead.contact_phone || null, category: 'contact' },
      { key: 'linkedin', label: 'LinkedIn', value: lead.personal_linkedin_url || lead.contact_linkedin || null, category: 'contact' },
      
      // Company
      { key: 'company_name', label: 'Firmenname', value: lead.company_name || null, category: 'company' },
      { key: 'company_domain', label: 'Domain', value: lead.company_domain || null, category: 'company' },
      { key: 'company_website', label: 'Website', value: lead.company_website || null, category: 'company' },
      { key: 'industry', label: 'Branche', value: lead.industry || (Array.isArray(lead.company_industries) ? lead.company_industries.join(', ') : null), category: 'company' },
      { key: 'company_size', label: 'Firmengröße', value: lead.company_size || null, category: 'company' },
      { key: 'company_headcount', label: 'Mitarbeiterzahl', value: lead.company_headcount?.toString() || null, category: 'company' },
      { key: 'company_city', label: 'Stadt', value: lead.company_city || null, category: 'company' },
      { key: 'company_country', label: 'Land', value: lead.company_country || null, category: 'company' },
      { key: 'company_description', label: 'Beschreibung', value: lead.company_description || null, category: 'company' },
      { key: 'company_founded', label: 'Gründungsjahr', value: lead.company_founded_year?.toString() || null, category: 'company' },
      { key: 'company_linkedin', label: 'Company LinkedIn', value: lead.company_linkedin_url || null, category: 'company' },
      { key: 'revenue', label: 'Umsatz', value: lead.revenue_range || lead.company_financials || null, category: 'company' },
      { key: 'tech_stack', label: 'Tech-Stack', value: Array.isArray(lead.company_technologies) ? lead.company_technologies.slice(0, 5).join(', ') : null, category: 'company' },
      
      // Recruiting Signals
      { key: 'hiring_activity', label: 'Hiring-Aktivität', value: lead.hiring_activity || null, category: 'signals' },
      { key: 'hiring_volume', label: 'Hiring-Volumen', value: lead.hiring_volume || null, category: 'signals' },
      { key: 'open_positions', label: 'Offene Stellen', value: lead.live_jobs_count?.toString() || lead.open_positions_estimate?.toString() || null, category: 'signals' },
      { key: 'current_ats', label: 'ATS', value: lead.current_ats || null, category: 'signals' },
      { key: 'career_page', label: 'Karriereseite', value: lead.career_page_url || null, category: 'signals' },
      { key: 'recruiting_challenges', label: 'Herausforderungen', value: Array.isArray(lead.recruiting_challenges) ? lead.recruiting_challenges.join(', ') : null, category: 'signals' },
      
      // Meta
      { key: 'language', label: 'Sprache', value: lead.language || null, category: 'meta' },
      { key: 'region', label: 'Region', value: lead.region || null, category: 'meta' },
      { key: 'segment', label: 'Segment', value: lead.segment || null, category: 'meta' },
      { key: 'lead_source', label: 'Quelle', value: lead.lead_source || null, category: 'meta' },
      { key: 'score', label: 'Score', value: lead.score?.toString() || null, category: 'meta' },
    ];

    const filledVariables = allVariables.filter(v => v.value !== null && v.value !== '');
    
    const variableMap: Record<string, string> = {};
    filledVariables.forEach(v => {
      variableMap[v.key] = v.value!;
    });

    const templateString = filledVariables.map(v => `{{${v.key}}}`).join(' ');

    return {
      variables: allVariables,
      variableMap,
      filledCount: filledVariables.length,
      totalCount: allVariables.length,
      templateString,
    };
  }, [lead]);
}

export function replaceVariables(template: string, variableMap: Record<string, string>): string {
  let result = template;
  Object.entries(variableMap).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
    result = result.replace(regex, value);
  });
  return result;
}
