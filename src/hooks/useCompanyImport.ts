import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CompanyImportRow {
  name: string;
  website?: string;
  domain?: string;
  industry?: string;
  city?: string;
  headcount?: number;
}

export interface ContactImportRow {
  name: string;
  email: string;
  role?: string;
  company_name?: string;
  decision_level?: string;
  functional_area?: string;
  phone?: string;
  linkedin_url?: string;
}

// Extract domain from email or website
export function extractDomain(input: string): string {
  if (!input) return '';
  
  // If it's an email
  if (input.includes('@')) {
    const parts = input.split('@');
    return parts.length > 1 ? parts[1].toLowerCase() : '';
  }
  
  // If it's a URL
  try {
    let url = input;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    const parsed = new URL(url);
    return parsed.hostname.replace('www.', '').toLowerCase();
  } catch {
    return input.toLowerCase().replace('www.', '');
  }
}

// Find or create company by domain
export function useFindOrCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      domain: string; 
      name: string; 
      website?: string;
      industry?: string;
      city?: string;
      headcount?: number;
    }) => {
      // Search for existing company
      const { data: existing, error: fetchError } = await supabase
        .from('outreach_companies')
        .select('id, name')
        .eq('domain', data.domain)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        return { id: existing.id, name: existing.name, created: false };
      }

      // Create new company
      const { data: newCompany, error: createError } = await supabase
        .from('outreach_companies')
        .insert({
          domain: data.domain,
          name: data.name,
          website: data.website || `https://${data.domain}`,
          industry: data.industry,
          city: data.city,
          headcount: data.headcount,
          outreach_status: 'neu',
          warm_score: 0,
        })
        .select('id, name')
        .single();

      if (createError) throw createError;
      return { id: newCompany.id, name: newCompany.name, created: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
    },
  });
}

// Create contact linked to company
export function useCreateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      company_id: string;
      contact_name: string;
      contact_email: string;
      contact_role?: string;
      decision_level?: string;
      functional_area?: string;
      mobile_phone?: string;
      personal_linkedin_url?: string;
    }) => {
      // Check for duplicate email
      const { data: existing } = await supabase
        .from('outreach_leads')
        .select('id')
        .eq('contact_email', data.contact_email)
        .maybeSingle();

      if (existing) {
        return { id: existing.id, duplicate: true };
      }

      const { data: newContact, error } = await supabase
        .from('outreach_leads')
        .insert({
          company_id: data.company_id,
          contact_name: data.contact_name,
          contact_email: data.contact_email,
          contact_role: data.contact_role,
          decision_level: data.decision_level || 'unknown',
          functional_area: data.functional_area || 'unknown',
          mobile_phone: data.mobile_phone,
          personal_linkedin_url: data.personal_linkedin_url,
          outreach_status: 'not_contacted',
        } as any)
        .select('id')
        .single();

      if (error) throw error;
      return { id: newContact.id, duplicate: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
    },
  });
}

// Bulk import companies
export function useImportCompanies() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companies: CompanyImportRow[]) => {
      const results = { created: 0, skipped: 0, errors: 0 };

      for (const company of companies) {
        try {
          const domain = extractDomain(company.website || company.domain || company.name);
          
          if (!domain) {
            results.errors++;
            continue;
          }

          // Check if exists
          const { data: existing } = await supabase
            .from('outreach_companies')
            .select('id')
            .eq('domain', domain)
            .maybeSingle();

          if (existing) {
            results.skipped++;
            continue;
          }

          // Create company
          const { error } = await supabase
            .from('outreach_companies')
            .insert({
              domain,
              name: company.name,
              website: company.website || `https://${domain}`,
              industry: company.industry,
              city: company.city,
              headcount: company.headcount,
              outreach_status: 'neu',
              warm_score: 0,
            });

          if (error) {
            results.errors++;
          } else {
            results.created++;
          }
        } catch {
          results.errors++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      toast.success(`${results.created} Unternehmen importiert, ${results.skipped} übersprungen`);
    },
    onError: (error: Error) => {
      toast.error(`Import-Fehler: ${error.message}`);
    },
  });
}

// Bulk import contacts (Company-First)
export function useImportContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contacts: ContactImportRow[]) => {
      const results = { 
        contacts_created: 0, 
        companies_created: 0,
        duplicates: 0, 
        errors: 0 
      };

      for (const contact of contacts) {
        try {
          if (!contact.email) {
            results.errors++;
            continue;
          }

          const domain = extractDomain(contact.email);
          
          if (!domain) {
            results.errors++;
            continue;
          }

          // Find or create company
          let companyId: string;
          const { data: existingCompany } = await supabase
            .from('outreach_companies')
            .select('id')
            .eq('domain', domain)
            .maybeSingle();

          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            // Create company from contact data
            const companyName = contact.company_name || domain.split('.')[0];
            const { data: newCompany, error: companyError } = await supabase
              .from('outreach_companies')
              .insert({
                domain,
                name: companyName.charAt(0).toUpperCase() + companyName.slice(1),
                website: `https://${domain}`,
                outreach_status: 'neu',
                warm_score: 0,
              })
              .select('id')
              .single();

            if (companyError) {
              results.errors++;
              continue;
            }
            companyId = newCompany.id;
            results.companies_created++;
          }

          // Check for duplicate contact
          const { data: existingContact } = await supabase
            .from('outreach_leads')
            .select('id')
            .eq('contact_email', contact.email)
            .maybeSingle();

          if (existingContact) {
            results.duplicates++;
            continue;
          }

          // Create contact
          const { error: contactError } = await supabase
            .from('outreach_leads')
            .insert({
              company_id: companyId,
              contact_name: contact.name,
              contact_email: contact.email,
              contact_role: contact.role,
              decision_level: contact.decision_level || 'unknown',
              functional_area: contact.functional_area || 'unknown',
              mobile_phone: contact.phone,
              personal_linkedin_url: contact.linkedin_url,
              outreach_status: 'not_contacted',
            } as any);

          if (contactError) {
            results.errors++;
          } else {
            results.contacts_created++;
          }
        } catch {
          results.errors++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      toast.success(
        `${results.contacts_created} Kontakte importiert` +
        (results.companies_created > 0 ? `, ${results.companies_created} Unternehmen erstellt` : '') +
        (results.duplicates > 0 ? `, ${results.duplicates} Duplikate` : '')
      );
    },
    onError: (error: Error) => {
      toast.error(`Import-Fehler: ${error.message}`);
    },
  });
}

// Update company warm score based on contacts
export function useRecalculateWarmScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      // Get all contacts for company
      const { data: contacts, error } = await supabase
        .from('outreach_leads')
        .select('outreach_status')
        .eq('company_id', companyId);

      if (error) throw error;

      if (!contacts || contacts.length === 0) {
        return 0;
      }

      // Calculate warm score
      let score = 0;
      const statusScores: Record<string, number> = {
        'replied_positive': 100,
        'replied': 80,
        'opened': 40,
        'sent': 20,
        'not_contacted': 0,
      };

      contacts.forEach((contact: any) => {
        const status = contact.outreach_status || 'not_contacted';
        score += statusScores[status] || 0;
      });

      const warmScore = Math.round(score / contacts.length);

      // Determine company status
      let outreachStatus = 'neu';
      if (contacts.some((c: any) => c.outreach_status === 'replied_positive')) {
        outreachStatus = 'qualifiziert';
      } else if (contacts.some((c: any) => c.outreach_status === 'replied')) {
        outreachStatus = 'in_kontakt';
      } else if (contacts.some((c: any) => c.outreach_status === 'sent' || c.outreach_status === 'opened')) {
        outreachStatus = 'in_kontakt';
      }

      // Update company
      await supabase
        .from('outreach_companies')
        .update({ 
          warm_score: warmScore,
          outreach_status: outreachStatus,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', companyId);

      return warmScore;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
    },
  });
}
