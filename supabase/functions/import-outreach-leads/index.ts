import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadRow {
  // Person / Contact
  profile_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  contact_email?: string;
  email_verification_status?: string;
  email_quality?: string;
  mobile_phone?: string;
  direct_phone?: string;
  office_phone?: string;
  personal_linkedin_url?: string;
  contact_linkedin?: string;
  education?: string;
  job_title?: string;
  contact_role?: string;
  seniority?: string;
  department?: string;
  lead_source?: string;
  country?: string;
  state?: string;
  region?: string;
  city?: string;
  
  // Company
  company_name?: string;
  company_alias?: string;
  company_type?: string;
  company_description?: string;
  company_domain?: string;
  company_website?: string;
  website?: string;
  company_linkedin_url?: string;
  headcount?: string;
  company_size?: string;
  company_headcount?: string;
  industries?: string;
  industry?: string;
  company_industries?: string;
  technologies?: string;
  company_technologies?: string;
  financials?: string;
  revenue_range?: string;
  founded_year?: string;
  founding_year?: number;
  
  // Company Address
  company_address_line?: string;
  company_city?: string;
  company_zip?: string;
  company_state?: string;
  company_country?: string;
  hq_address_line?: string;
  hq_city?: string;
  hq_zip?: string;
  hq_state?: string;
  hq_country?: string;
  
  // Hiring Signals
  hiring_title_1?: string;
  hiring_url_1?: string;
  hiring_location_1?: string;
  hiring_date_1?: string;
  hiring_title_2?: string;
  hiring_url_2?: string;
  hiring_location_2?: string;
  hiring_date_2?: string;
  hiring_title_3?: string;
  hiring_url_3?: string;
  hiring_location_3?: string;
  hiring_date_3?: string;
  
  // Change Signals
  location_move_from_country?: string;
  location_move_from_state?: string;
  location_move_to_country?: string;
  location_move_to_state?: string;
  location_move_date?: string;
  job_change_previous_company?: string;
  job_change_previous_title?: string;
  job_change_new_company?: string;
  job_change_new_title?: string;
  job_change_date?: string;
  
  // Legacy fields
  contact_name?: string;
  contact_phone?: string;
  recruiting_challenges?: string[];
  current_ats?: string;
  hiring_volume?: string;
  open_positions_estimate?: number;
  segment?: string;
  priority?: string;
  notes?: string;
  
  [key: string]: any;
}

// Helper: Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Helper: Parse hiring signals into structured format
function parseHiringSignals(row: LeadRow): any[] {
  const signals = [];
  
  for (let i = 1; i <= 5; i++) {
    const title = row[`hiring_title_${i}`];
    if (title) {
      signals.push({
        title,
        url: row[`hiring_url_${i}`] || null,
        location: row[`hiring_location_${i}`] || null,
        date: row[`hiring_date_${i}`] || null
      });
    }
  }
  
  return signals;
}

// Helper: Build job change data JSONB
function buildJobChangeData(row: LeadRow): any | null {
  if (!row.job_change_previous_company && !row.job_change_new_company && !row.job_change_date) {
    return null;
  }
  return {
    previous_company: row.job_change_previous_company || null,
    previous_title: row.job_change_previous_title || null,
    new_company: row.job_change_new_company || null,
    new_title: row.job_change_new_title || null,
    date: row.job_change_date || null
  };
}

// Helper: Build location move data JSONB
function buildLocationMoveData(row: LeadRow): any | null {
  if (!row.location_move_from_country && !row.location_move_to_country && !row.location_move_date) {
    return null;
  }
  return {
    from_country: row.location_move_from_country || null,
    from_state: row.location_move_from_state || null,
    to_country: row.location_move_to_country || null,
    to_state: row.location_move_to_state || null,
    date: row.location_move_date || null
  };
}

// Helper: Parse array or string to array
function parseToArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    // Handle comma-separated or semicolon-separated values
    return value.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

// Helper: Parse headcount to number
function parseHeadcount(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Handle ranges like "50-100" -> take lower bound
    const match = value.match(/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { job_id, leads, column_mapping } = await req.json();

    console.log(`Processing import job ${job_id} with ${leads?.length || 0} leads`);

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      throw new Error("Keine Leads zum Importieren");
    }

    // Update job status
    await supabase
      .from("outreach_import_jobs")
      .update({
        status: "processing",
        total_rows: leads.length
      })
      .eq("id", job_id);

    // Pre-fetch suppression list for efficiency
    const { data: suppressionList } = await supabase
      .from("outreach_suppression_list")
      .select("email");
    
    const suppressedEmails = new Set(
      (suppressionList || []).map(s => s.email.toLowerCase())
    );
    console.log(`Loaded ${suppressedEmails.size} suppressed emails`);

    // Pre-fetch existing emails for deduplication
    const { data: existingLeads } = await supabase
      .from("outreach_leads")
      .select("id, contact_email");
    
    const existingEmails = new Map(
      (existingLeads || []).map(l => [l.contact_email.toLowerCase(), l.id])
    );
    console.log(`Found ${existingEmails.size} existing leads`);

    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    let suppressed = 0;
    const errorLog: any[] = [];

    // Get user ID from job
    const { data: job } = await supabase
      .from("outreach_import_jobs")
      .select("created_by")
      .eq("id", job_id)
      .single();

    // Batch processing
    const BATCH_SIZE = 50;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      const leadsToInsert = [];
      
      for (const row of batch) {
        try {
          // Map columns if mapping provided
          const mappedRow: LeadRow = {};
          
          if (column_mapping && Object.keys(column_mapping).length > 0) {
            for (const [targetField, sourceField] of Object.entries(column_mapping)) {
              if (sourceField && row[sourceField as string] !== undefined) {
                mappedRow[targetField] = row[sourceField as string];
              }
            }
          } else {
            Object.assign(mappedRow, row);
          }

          // Normalize email field
          const email = (
            mappedRow.contact_email || 
            mappedRow.email || 
            ''
          ).toLowerCase().trim();
          
          // Normalize contact name
          const contactName = mappedRow.contact_name || 
            mappedRow.full_name ||
            (mappedRow.first_name && mappedRow.last_name 
              ? `${mappedRow.first_name} ${mappedRow.last_name}` 
              : mappedRow.first_name || '');

          // Validate required fields
          if (!email) {
            throw new Error("E-Mail-Adresse fehlt");
          }
          if (!isValidEmail(email)) {
            throw new Error("Ungültige E-Mail-Adresse");
          }
          if (!mappedRow.company_name) {
            throw new Error("Firmenname fehlt");
          }
          if (!contactName) {
            throw new Error("Kontaktname fehlt");
          }

          // === GUARDRAIL: Check suppression list ===
          if (suppressedEmails.has(email)) {
            suppressed++;
            console.log(`Suppressed: ${email}`);
            errorLog.push({
              row: i + batch.indexOf(row) + 1,
              email,
              error: "E-Mail ist auf der Sperrliste (DNC)"
            });
            continue;
          }

          // === GUARDRAIL: Check for duplicates ===
          if (existingEmails.has(email)) {
            duplicates++;
            console.log(`Duplicate: ${email}`);
            continue;
          }

          // Parse hiring signals
          const hiringSignals = parseHiringSignals(mappedRow);

          // Build JSONB data structures
          const jobChangeData = buildJobChangeData(mappedRow);
          const locationMoveData = buildLocationMoveData(mappedRow);

          // Parse arrays for industries and technologies
          const companyIndustries = parseToArray(
            mappedRow.company_industries || mappedRow.industries || mappedRow.industry
          );
          const companyTechnologies = parseToArray(
            mappedRow.company_technologies || mappedRow.technologies
          );
          const companyHeadcount = parseHeadcount(
            mappedRow.company_headcount || mappedRow.headcount || mappedRow.company_size
          );

          // Prepare lead data with CORRECT column names matching the database
          const leadData = {
            // Company Info
            company_name: mappedRow.company_name,
            company_website: mappedRow.company_website || mappedRow.website || mappedRow.company_domain || null,
            industry: mappedRow.industry || mappedRow.industries || null,
            company_industries: companyIndustries,
            company_size: mappedRow.company_size || mappedRow.headcount || null,
            company_headcount: companyHeadcount,
            revenue_range: mappedRow.revenue_range || mappedRow.financials || null,
            founding_year: mappedRow.founding_year || (mappedRow.founded_year ? parseInt(String(mappedRow.founded_year)) : null),
            company_description: mappedRow.company_description || null,
            company_linkedin_url: mappedRow.company_linkedin_url || null,
            company_technologies: companyTechnologies,
            
            // Company Address
            company_address_line: mappedRow.company_address_line || null,
            company_city: mappedRow.company_city || null,
            company_state: mappedRow.company_state || mappedRow.state || null,
            company_country: mappedRow.company_country || null,
            company_zip: mappedRow.company_zip || null,
            
            // HQ Address
            hq_address_line: mappedRow.hq_address_line || mappedRow.company_address_line || null,
            hq_city: mappedRow.hq_city || mappedRow.company_city || null,
            hq_state: mappedRow.hq_state || mappedRow.company_state || mappedRow.state || null,
            hq_country: mappedRow.hq_country || mappedRow.company_country || null,
            hq_zip: mappedRow.hq_zip || mappedRow.company_zip || null,
            
            // Contact Info
            contact_name: contactName,
            contact_role: mappedRow.contact_role || mappedRow.job_title || null,
            contact_email: email,
            contact_phone: mappedRow.contact_phone || mappedRow.mobile_phone || mappedRow.direct_phone || mappedRow.office_phone || null,
            contact_linkedin: mappedRow.contact_linkedin || mappedRow.personal_linkedin_url || null,
            seniority: mappedRow.seniority || null,
            department: mappedRow.department || null,
            
            // Phone fields
            office_phone: mappedRow.office_phone || null,
            mobile_phone: mappedRow.mobile_phone || null,
            direct_phone: mappedRow.direct_phone || null,
            
            // Location
            country: mappedRow.country || mappedRow.company_country || mappedRow.hq_country || "DE",
            region: mappedRow.region || mappedRow.state || mappedRow.company_state || mappedRow.hq_state || null,
            city: mappedRow.city || mappedRow.company_city || mappedRow.hq_city || null,
            
            // Hiring Signals
            hiring_signals: hiringSignals.length > 0 ? hiringSignals : null,
            
            // Change Signals as JSONB
            job_change_data: jobChangeData,
            location_move_data: locationMoveData,
            
            // Legacy/Other
            recruiting_challenges: mappedRow.recruiting_challenges || [],
            current_ats: mappedRow.current_ats || null,
            hiring_volume: mappedRow.hiring_volume || null,
            open_positions_estimate: mappedRow.open_positions_estimate ? parseInt(String(mappedRow.open_positions_estimate)) : null,
            lead_source: mappedRow.lead_source || "import",
            segment: mappedRow.segment || "hiring_company",
            priority: mappedRow.priority || "warm",
            notes: mappedRow.notes || null,
            
            // Validation
            email_validated: false,
            email_validation_status: mappedRow.email_verification_status || mappedRow.email_quality || null,
            is_suppressed: false,
            
            // Metadata
            created_by: job?.created_by || null,
            status: "new"
          };

          leadsToInsert.push(leadData);
          
          // Add to existing set to prevent duplicates within same import
          existingEmails.set(email, 'pending');

        } catch (rowError: any) {
          failed++;
          errorLog.push({
            row: i + batch.indexOf(row) + 1,
            email: row.contact_email || row.email || "unknown",
            error: rowError.message
          });
          console.error(`Error processing row:`, rowError.message);
        }
      }

      // Bulk insert leads
      if (leadsToInsert.length > 0) {
        const { data: insertedLeads, error: insertError } = await supabase
          .from("outreach_leads")
          .insert(leadsToInsert)
          .select("id");

        if (insertError) {
          console.error("Bulk insert error:", insertError);
          // Try individual inserts as fallback
          for (const lead of leadsToInsert) {
            const { error: singleError } = await supabase
              .from("outreach_leads")
              .insert(lead);
            
            if (singleError) {
              failed++;
              errorLog.push({
                email: lead.contact_email,
                error: singleError.message
              });
              console.error(`Single insert error for ${lead.contact_email}:`, singleError.message);
            } else {
              successful++;
            }
          }
        } else {
          successful += insertedLeads?.length || leadsToInsert.length;
        }
      }

      // Update progress
      await supabase
        .from("outreach_import_jobs")
        .update({
          processed_rows: Math.min(i + BATCH_SIZE, leads.length),
          successful_rows: successful,
          failed_rows: failed,
          duplicate_rows: duplicates,
          suppressed_rows: suppressed,
          error_log: errorLog
        })
        .eq("id", job_id);
    }

    // Mark job as complete
    await supabase
      .from("outreach_import_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        processed_rows: leads.length,
        successful_rows: successful,
        failed_rows: failed,
        duplicate_rows: duplicates,
        suppressed_rows: suppressed,
        error_log: errorLog
      })
      .eq("id", job_id);

    console.log(`Import complete: ${successful} successful, ${failed} failed, ${duplicates} duplicates, ${suppressed} suppressed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: leads.length,
        successful,
        failed,
        duplicates,
        suppressed,
        errors: errorLog.slice(0, 10)
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Import error:", error);

    try {
      const body = await req.clone().json();
      if (body.job_id) {
        await supabase
          .from("outreach_import_jobs")
          .update({
            status: "failed",
            error_log: [{ error: error.message }]
          })
          .eq("id", body.job_id);
      }
    } catch {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
