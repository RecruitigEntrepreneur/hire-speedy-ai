import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  template: string;
  data: Record<string, string>;
  submissionId?: string;
  candidateId?: string;
}

// Generate tracking pixel URL
const getTrackingPixelUrl = (emailEventId: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/functions/v1/track-candidate-engagement?type=email_open&event_id=${emailEventId}`;
};

// Wrap links for click tracking
const wrapLinksForTracking = (html: string, emailEventId: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingBaseUrl = `${supabaseUrl}/functions/v1/track-candidate-engagement`;
  
  // Replace href links with tracking redirects
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      const encodedUrl = encodeURIComponent(url);
      return `href="${trackingBaseUrl}?type=link_click&event_id=${emailEventId}&redirect=${encodedUrl}"`;
    }
  );
};

// Email templates
const templates: Record<string, { subject: string; html: (data: Record<string, any>) => string }> = {
  interview_invitation: {
    subject: "Interview-Einladung: {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Interview-Einladung</h1>
        <p>Sehr geehrte(r) ${data.candidateName},</p>
        <p>wir freuen uns, Ihnen mitteilen zu können, dass Sie für ein Interview für die Position <strong>${data.jobTitle}</strong> ausgewählt wurden.</p>
        <p><strong>Details:</strong></p>
        <ul>
          <li>Datum: ${data.date}</li>
          <li>Uhrzeit: ${data.time}</li>
          <li>Format: ${data.meetingType || 'Video-Call'}</li>
          ${data.meetingLink ? `<li>Link: <a href="${data.meetingLink}">${data.meetingLink}</a></li>` : ''}
        </ul>
        <p>Bei Fragen wenden Sie sich bitte an Ihren Recruiter.</p>
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  opt_in_request: {
    subject: "Identitätsfreigabe angefordert für {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Identitätsfreigabe angefordert</h1>
        <p>Sehr geehrte(r) Recruiter,</p>
        <p>Ein Unternehmen hat die Freigabe der Kandidatenidentität für die Position <strong>${data.jobTitle}</strong> angefordert.</p>
        <p><strong>Kandidat:</strong> ${data.candidateName}</p>
        <p><strong>Unternehmen:</strong> ${data.companyName}</p>
        <p>Bitte bestätigen Sie die Freigabe in Ihrem Dashboard.</p>
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Zum Dashboard</a>
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  submission_received: {
    subject: "Neuer Kandidat eingereicht für {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Neuer Kandidatenvorschlag</h1>
        <p>Sehr geehrte(r) ${data.clientName},</p>
        <p>Ein neuer Kandidat wurde für Ihre Stelle <strong>${data.jobTitle}</strong> vorgeschlagen.</p>
        <p><strong>Match-Score:</strong> ${data.matchScore}%</p>
        <p><strong>Erfahrung:</strong> ${data.experienceYears} Jahre</p>
        <p>Sehen Sie sich den Kandidaten in Ihrem Dashboard an.</p>
        <a href="${data.dashboardUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Kandidat ansehen</a>
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  rejection_notice: {
    subject: "Absage: {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Statusupdate zu Ihrer Bewerbung</h1>
        <p>Sehr geehrte(r) Recruiter,</p>
        <p>Leider müssen wir Ihnen mitteilen, dass der Kandidat <strong>${data.candidateName}</strong> für die Position <strong>${data.jobTitle}</strong> nicht weiter berücksichtigt werden konnte.</p>
        ${data.reason ? `<p><strong>Begründung:</strong> ${data.reason}</p>` : ''}
        <p>Vielen Dank für Ihre Bemühungen.</p>
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  interview_reminder: {
    subject: "Erinnerung: Interview morgen - {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Interview-Erinnerung</h1>
        <p>Sehr geehrte(r) ${data.recipientName},</p>
        <p>Dies ist eine freundliche Erinnerung an Ihr bevorstehendes Interview:</p>
        <p><strong>Position:</strong> ${data.jobTitle}</p>
        <p><strong>Datum:</strong> ${data.date}</p>
        <p><strong>Uhrzeit:</strong> ${data.time}</p>
        ${data.meetingLink ? `<p><strong>Meeting-Link:</strong> <a href="${data.meetingLink}">${data.meetingLink}</a></p>` : ''}
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  candidate_support: {
    subject: "Vorbereitungsmaterial: {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${data.contentTitle}</h1>
        <p>Sehr geehrte(r) ${data.candidateName},</p>
        <p>Ihr Recruiter hat Ihnen folgendes Vorbereitungsmaterial für Ihre Bewerbung${data.jobTitle ? ` bei ${data.jobTitle}` : ''} zugesandt:</p>
        <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap;">
${data.content}
        </div>
        <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        <p>Viel Erfolg!<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  prep_material: {
    subject: "Vorbereitung für Ihr Interview: {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Interview-Vorbereitung</h1>
        <p>Sehr geehrte(r) ${data.candidateName},</p>
        <p>Ihr Interview für die Position <strong>${data.jobTitle}</strong> steht bevor. Hier sind einige hilfreiche Ressourcen zur Vorbereitung:</p>
        <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">📋 Checkliste:</h3>
          <ul>
            <li>Recherchieren Sie das Unternehmen</li>
            <li>Bereiten Sie Fragen vor</li>
            <li>Überprüfen Sie die Stellenbeschreibung</li>
            <li>Testen Sie Ihre Technik (bei Video-Interviews)</li>
          </ul>
        </div>
        <a href="${data.prepLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Vollständiges Vorbereitungsmaterial ansehen</a>
        <p>Viel Erfolg!<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  // New templates for Talent Hub workflow automation
  interview_request_to_recruiter: {
    subject: "Interview-Anfrage für Kandidat #{candidateAnonymId}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">🎯 Interview-Anfrage</h1>
        <p>Sehr geehrte(r) Recruiter,</p>
        <p>Ein Kunde möchte ein Interview mit einem Ihrer Kandidaten führen.</p>
        
        <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0 0 8px 0;"><strong>Position:</strong> ${data.jobTitle}</p>
          <p style="margin: 0 0 8px 0;"><strong>Unternehmen:</strong> ${data.companyName}</p>
          <p style="margin: 0;"><strong>Kandidat:</strong> ${data.candidateAnonymId}</p>
        </div>
        
        ${data.message ? `
        <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Nachricht des Kunden:</strong></p>
          <p style="margin: 0; color: #666;">${data.message}</p>
        </div>
        ` : ''}
        
        ${data.proposedSlots && data.proposedSlots.length > 0 ? `
        <div style="margin: 16px 0;">
          <p><strong>Vorgeschlagene Termine:</strong></p>
          <ul>
            ${data.proposedSlots.map((slot: string) => `<li>${slot}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <p><strong>Nächster Schritt:</strong> Bitte holen Sie die Zustimmung des Kandidaten ein und bestätigen Sie die Teilnahme im Dashboard.</p>
        
        <a href="${data.dashboardUrl || '#'}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Im Dashboard bestätigen</a>
        
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  opt_in_confirmed_to_client: {
    subject: "✅ Kandidat hat zugestimmt: {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">🎉 Kandidat hat zugestimmt!</h1>
        <p>Gute Nachrichten! Der Kandidat hat der Interview-Anfrage zugestimmt.</p>
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${data.candidateName}</p>
          <p style="margin: 0 0 8px 0;"><strong>E-Mail:</strong> ${data.candidateEmail}</p>
          ${data.candidatePhone ? `<p style="margin: 0 0 8px 0;"><strong>Telefon:</strong> ${data.candidatePhone}</p>` : ''}
          <p style="margin: 0;"><strong>Position:</strong> ${data.jobTitle}</p>
        </div>
        
        <p>Sie können jetzt den Interview-Termin finalisieren und direkten Kontakt aufnehmen.</p>
        
        <a href="${data.dashboardUrl || '#'}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Interview planen</a>
        
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  candidate_moved_to_recruiter: {
    subject: "📈 Kandidat weitergeleitet: {candidateName}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">📈 Fortschritt im Prozess</h1>
        <p>Sehr geehrte(r) Recruiter,</p>
        <p>Gute Nachrichten! Ihr Kandidat wurde im Bewerbungsprozess weitergeleitet.</p>
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
          <p style="margin: 0 0 8px 0;"><strong>Kandidat:</strong> ${data.candidateName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Position:</strong> ${data.jobTitle}</p>
          <p style="margin: 0 0 8px 0;"><strong>Unternehmen:</strong> ${data.companyName}</p>
          <p style="margin: 0;"><strong>Neue Phase:</strong> ${data.oldStage} → <strong style="color: #22c55e;">${data.newStage}</strong></p>
        </div>
        
        <p>Der Prozess läuft wie geplant. Wir halten Sie über weitere Entwicklungen auf dem Laufenden.</p>
        
        <a href="${data.dashboardUrl || '#'}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Details im Dashboard</a>
        
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
  candidate_rejected_to_recruiter: {
    subject: "Absage: {candidateName} für {jobTitle}",
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Absage erhalten</h1>
        <p>Sehr geehrte(r) Recruiter,</p>
        <p>Leider wurde Ihr Kandidat für diese Position nicht weiter berücksichtigt.</p>
        
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0 0 8px 0;"><strong>Kandidat:</strong> ${data.candidateName}</p>
          <p style="margin: 0 0 8px 0;"><strong>Position:</strong> ${data.jobTitle}</p>
          <p style="margin: 0;"><strong>Unternehmen:</strong> ${data.companyName}</p>
        </div>
        
        ${data.rejectionReason ? `
        <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>Begründung:</strong></p>
          <p style="margin: 0; color: #666;">${data.rejectionReason}</p>
          ${data.rejectionCategory ? `<p style="margin: 8px 0 0 0; color: #888; font-size: 14px;">Kategorie: ${data.rejectionCategory}</p>` : ''}
        </div>
        ` : ''}
        
        <p>Der Kandidat bleibt in Ihrem Talent Pool und kann für andere passende Stellen vorgeschlagen werden.</p>
        
        <a href="${data.dashboardUrl || '#'}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Weitere Stellen finden</a>
        
        <p>Mit freundlichen Grüßen,<br/>Das Recruiting-Team</p>
      </div>
    `,
  },
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, template, data, submissionId, candidateId }: EmailRequest = await req.json();

    console.log(`Sending email: template=${template}, to=${to}, submissionId=${submissionId}`);

    // Get template
    const emailTemplate = templates[template];
    if (!emailTemplate) {
      throw new Error(`Unknown template: ${template}`);
    }

    // Replace placeholders in subject
    let subject = emailTemplate.subject;
    Object.entries(data).forEach(([key, value]) => {
      subject = subject.replace(`{${key}}`, value);
    });

    // Generate HTML
    let html = emailTemplate.html(data);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Create email event first to get ID for tracking
    const { data: emailEvent, error: eventError } = await supabase
      .from("email_events")
      .insert({
        to_email: to,
        template_name: template,
        subject,
        status: "pending",
        metadata: { data, submissionId, candidateId },
      })
      .select()
      .single();

    if (eventError) {
      console.error("Error creating email event:", eventError);
    }

    const emailEventId = emailEvent?.id;

    // Add tracking if we have an event ID and submission/candidate
    if (emailEventId && (submissionId || candidateId)) {
      // Wrap links for click tracking
      html = wrapLinksForTracking(html, emailEventId);

      // Add tracking pixel before closing body
      const trackingPixel = `<img src="${getTrackingPixelUrl(emailEventId)}" width="1" height="1" style="display:none;" alt="" />`;
      html = html.replace('</div>', `${trackingPixel}</div>`);
    }

    // Send email
    const emailResponse = await resend.emails.send({
      from: "Recruiting Platform <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    // Update email event with success
    if (emailEventId) {
      await supabase
        .from("email_events")
        .update({
          status: "sent",
          metadata: { resend_id: emailResponse.data?.id, data, submissionId, candidateId },
        })
        .eq("id", emailEventId);
    }

    // Update candidate_behavior emails_sent counter if submissionId provided
    if (submissionId) {
      const { data: behavior } = await supabase
        .from("candidate_behavior")
        .select("emails_sent")
        .eq("submission_id", submissionId)
        .single();

      if (behavior) {
        await supabase
          .from("candidate_behavior")
          .update({ 
            emails_sent: (behavior.emails_sent || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq("submission_id", submissionId);
      }
    }

    return new Response(JSON.stringify({ success: true, id: emailResponse.data?.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-email function:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Log error to database
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const body = await req.clone().json().catch(() => ({}));
      await supabase.from("email_events").insert({
        to_email: body.to || "unknown",
        template_name: body.template || "unknown",
        status: "failed",
        error_message: errorMessage,
      });
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);