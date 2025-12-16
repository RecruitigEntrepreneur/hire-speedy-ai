import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadRow {
  company_name?: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  revenue_range?: string;
  founding_year?: number;
  contact_name?: string;
  contact_role?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_linkedin?: string;
  country?: string;
  region?: string;
  city?: string;
  recruiting_challenges?: string[];
  current_ats?: string;
  hiring_volume?: string;
  open_positions_estimate?: number;
  lead_source?: string;
  segment?: string;
  priority?: string;
  notes?: string;
  [key: string]: any;
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

    let successful = 0;
    let failed = 0;
    let duplicates = 0;
    const errorLog: any[] = [];

    // Batch processing
    const BATCH_SIZE = 50;
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE);
      
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
            // Use row directly if no mapping
            Object.assign(mappedRow, row);
          }

          // Validate required fields
          if (!mappedRow.contact_email) {
            throw new Error("E-Mail-Adresse fehlt");
          }
          if (!mappedRow.company_name) {
            throw new Error("Firmenname fehlt");
          }
          if (!mappedRow.contact_name) {
            throw new Error("Kontaktname fehlt");
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(mappedRow.contact_email)) {
            throw new Error("Ungültige E-Mail-Adresse");
          }

          // Check for duplicates
          const { data: existing } = await supabase
            .from("outreach_leads")
            .select("id")
            .eq("contact_email", mappedRow.contact_email.toLowerCase())
            .single();

          if (existing) {
            duplicates++;
            console.log(`Duplicate: ${mappedRow.contact_email}`);
            continue;
          }

          // Get user ID from job
          const { data: job } = await supabase
            .from("outreach_import_jobs")
            .select("created_by")
            .eq("id", job_id)
            .single();

          // Prepare lead data
          const leadData = {
            company_name: mappedRow.company_name,
            company_website: mappedRow.company_website || null,
            industry: mappedRow.industry || null,
            company_size: mappedRow.company_size || null,
            revenue_range: mappedRow.revenue_range || null,
            founding_year: mappedRow.founding_year ? parseInt(String(mappedRow.founding_year)) : null,
            contact_name: mappedRow.contact_name,
            contact_role: mappedRow.contact_role || null,
            contact_email: mappedRow.contact_email.toLowerCase(),
            contact_phone: mappedRow.contact_phone || null,
            contact_linkedin: mappedRow.contact_linkedin || null,
            country: mappedRow.country || "DE",
            region: mappedRow.region || null,
            city: mappedRow.city || null,
            recruiting_challenges: mappedRow.recruiting_challenges || [],
            current_ats: mappedRow.current_ats || null,
            hiring_volume: mappedRow.hiring_volume || null,
            open_positions_estimate: mappedRow.open_positions_estimate ? parseInt(String(mappedRow.open_positions_estimate)) : null,
            lead_source: mappedRow.lead_source || "import",
            segment: mappedRow.segment || "hiring_company",
            priority: mappedRow.priority || "warm",
            notes: mappedRow.notes || null,
            created_by: job?.created_by || null,
            status: "new"
          };

          // Insert lead
          const { error: insertError } = await supabase
            .from("outreach_leads")
            .insert(leadData);

          if (insertError) {
            throw insertError;
          }

          successful++;

        } catch (rowError: any) {
          failed++;
          errorLog.push({
            row: i + batch.indexOf(row) + 1,
            email: row.contact_email || row.email || "unknown",
            error: rowError.message
          });
          console.error(`Error importing row:`, rowError.message);
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
        error_log: errorLog
      })
      .eq("id", job_id);

    console.log(`Import complete: ${successful} successful, ${failed} failed, ${duplicates} duplicates`);

    return new Response(
      JSON.stringify({
        success: true,
        total: leads.length,
        successful,
        failed,
        duplicates,
        errors: errorLog.slice(0, 10) // Return first 10 errors
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Import error:", error);

    // Update job as failed if job_id provided
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
