import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationRequest {
  submissionId: string;
  meetingFormat: 'teams' | 'meet' | 'video' | 'phone' | 'onsite';
  durationMinutes: number;
  proposedSlots: string[];
  clientMessage?: string;
  meetingLink?: string;
  onsiteAddress?: string;
}

const MEETING_FORMAT_LABELS: Record<string, string> = {
  teams: 'Microsoft Teams (Video)',
  meet: 'Google Meet (Video)',
  video: 'Video-Interview',
  phone: 'Telefon-Interview',
  onsite: 'Vor-Ort-Interview',
};

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function generateSlotTableHtml(slots: string[], duration: number): string {
  return slots.map(slot => `
    <tr style="border-top: 1px solid #e2e8f0;">
      <td style="padding: 10px 16px;">${formatDate(slot)}</td>
      <td style="padding: 10px 16px; font-weight: 600;">${formatTime(slot)} Uhr</td>
      <td style="padding: 10px 16px; color: #64748b;">${duration} Min</td>
    </tr>
  `).join('');
}

function generateEmailHtml(params: {
  candidateName: string;
  jobTitle: string;
  companyDescription: string;
  meetingFormat: string;
  duration: number;
  clientMessage?: string;
  slots: string[];
  acceptUrl: string;
  counterUrl: string;
  declineUrl: string;
}): string {
  const { candidateName, jobTitle, companyDescription, meetingFormat, duration, clientMessage, slots, acceptUrl, counterUrl, declineUrl } = params;
  
  const clientMessageHtml = clientMessage ? `
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 3px solid #0284c7; margin: 16px 0;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">Nachricht vom Unternehmen:</p>
      <p style="margin: 8px 0 0; font-style: italic;">„${clientMessage}"</p>
    </div>
  ` : '';

  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a2332 0%, #0f172a 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">Interview-Einladung</h1>
        <p style="margin: 8px 0 0; opacity: 0.8;">${jobTitle}</p>
      </div>

      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 16px;">Hallo ${candidateName},</p>
        <p style="margin: 0 0 16px;">ein ${companyDescription} möchte Sie gerne kennenlernen.</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 120px;">Position:</td>
            <td style="padding: 8px 0; font-weight: 600;">${jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Format:</td>
            <td style="padding: 8px 0;">${meetingFormat}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Dauer:</td>
            <td style="padding: 8px 0;">${duration} Minuten</td>
          </tr>
        </table>

        ${clientMessageHtml}

        <h3 style="margin: 24px 0 12px;">Terminvorschläge:</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px 16px; text-align: left; font-weight: 500;">Tag</th>
              <th style="padding: 10px 16px; text-align: left; font-weight: 500;">Uhrzeit</th>
              <th style="padding: 10px 16px; text-align: left; font-weight: 500;">Dauer</th>
            </tr>
          </thead>
          <tbody>
            ${generateSlotTableHtml(slots, duration)}
          </tbody>
        </table>

        <div style="margin: 32px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 0 8px 8px;">
            ✅ Termin annehmen
          </a>
          <a href="${counterUrl}" style="display: inline-block; background: white; color: #1e293b; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid #e2e8f0; margin: 0 8px 8px;">
            🔄 Gegenvorschlag
          </a>
          <a href="${declineUrl}" style="display: inline-block; background: white; color: #dc2626; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid #fecaca; margin: 0 8px 8px;">
            ❌ Absagen
          </a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          🔒 Ihre Daten werden erst nach Ihrer Zustimmung freigegeben (DSGVO-konform).
        </p>
      </div>

      <div style="background: #f8fafc; padding: 16px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          Versendet über Matchunt • Datenschutz-konform
        </p>
      </div>
    </div>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get auth header for user context
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const body: InvitationRequest = await req.json();
    const { submissionId, meetingFormat, durationMinutes, proposedSlots, clientMessage, meetingLink, onsiteAddress } = body;

    // Validate input
    if (!submissionId || !meetingFormat || !durationMinutes || !proposedSlots?.length) {
      throw new Error("Missing required fields");
    }

    // Fetch submission with candidate and job data
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select(`
        id,
        candidate_id,
        job_id,
        recruiter_id,
        stage,
        candidates!inner(id, full_name, email),
        jobs!inner(id, title, company_name, industry)
      `)
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      throw new Error("Submission not found");
    }

    const candidate = submission.candidates as any;
    const job = submission.jobs as any;

    // Generate response token
    const responseToken = generateToken();

    // Create interview record
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .insert({
        submission_id: submissionId,
        status: 'pending_response',
        proposed_slots: proposedSlots.map(datetime => ({ datetime, status: 'available' })),
        duration_minutes: durationMinutes,
        meeting_format: meetingFormat,
        meeting_type: meetingFormat,
        meeting_link: meetingLink,
        onsite_address: onsiteAddress,
        client_message: clientMessage,
        response_token: responseToken,
        pending_opt_in: true,
      })
      .select()
      .single();

    if (interviewError) {
      console.error('Interview creation error:', interviewError);
      throw new Error("Failed to create interview record");
    }

    // Update submission stage
    await supabase
      .from('submissions')
      .update({ 
        stage: 'interview_requested',
        status: 'interview'
      })
      .eq('id', submissionId);

    // Generate URLs
    const baseUrl = Deno.env.get("VITE_SUPABASE_URL")?.replace('.supabase.co', '') || 'https://matchunt.ai';
    const frontendUrl = baseUrl.includes('supabase') ? 'https://matchunt.ai' : baseUrl;
    
    const acceptUrl = `${frontendUrl}/interview/respond/${responseToken}?action=accept`;
    const counterUrl = `${frontendUrl}/interview/respond/${responseToken}?action=counter`;
    const declineUrl = `${frontendUrl}/interview/respond/${responseToken}?action=decline`;

    // Generate anonymized company description
    const companyDescription = job.industry 
      ? `${job.industry}-Unternehmen` 
      : 'Technologie-Unternehmen';

    // Send email to candidate
    if (resendApiKey && candidate.email) {
      const resend = new Resend(resendApiKey);
      
      const emailHtml = generateEmailHtml({
        candidateName: candidate.full_name.split(' ')[0], // First name only
        jobTitle: job.title,
        companyDescription,
        meetingFormat: MEETING_FORMAT_LABELS[meetingFormat] || meetingFormat,
        duration: durationMinutes,
        clientMessage,
        slots: proposedSlots,
        acceptUrl,
        counterUrl,
        declineUrl,
      });

      await resend.emails.send({
        from: "Matchunt <noreply@matchunt.ai>",
        to: [candidate.email],
        subject: `Interview-Einladung: ${job.title}`,
        html: emailHtml,
      });
    }

    // Create notification for recruiter
    await supabase
      .from('notifications')
      .insert({
        user_id: submission.recruiter_id,
        type: 'interview_requested',
        title: 'Interview-Einladung gesendet',
        message: `Interview-Einladung für ${job.title} wurde an den Kandidaten gesendet.`,
        metadata: {
          submission_id: submissionId,
          interview_id: interview.id,
          job_title: job.title,
        },
      });

    return new Response(
      JSON.stringify({ 
        success: true, 
        interviewId: interview.id,
        responseToken,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in send-interview-invitation:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
