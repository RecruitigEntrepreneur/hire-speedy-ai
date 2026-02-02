import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ResponseRequest {
  action: 'accept' | 'counter' | 'decline';
  responseToken: string;
  selectedSlotIndex?: number;
  counterSlots?: string[];
  declineReason?: string;
  message?: string;
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function generateICalEvent(params: {
  title: string;
  startTime: string;
  durationMinutes: number;
  description: string;
  location?: string;
}): string {
  const { title, startTime, durationMinutes, description, location } = params;
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  
  const formatICalDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Matchunt//Interview//DE
BEGIN:VEVENT
UID:${Date.now()}@matchunt.ai
DTSTAMP:${formatICalDate(new Date())}
DTSTART:${formatICalDate(start)}
DTEND:${formatICalDate(end)}
SUMMARY:${title}
DESCRIPTION:${description}
${location ? `LOCATION:${location}` : ''}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
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

    const body: ResponseRequest = await req.json();
    const { action, responseToken, selectedSlotIndex, counterSlots, declineReason, message } = body;

    // Validate input
    if (!action || !responseToken) {
      throw new Error("Missing required fields");
    }

    // Fetch interview with related data
    const { data: interview, error: interviewError } = await supabase
      .from('interviews')
      .select(`
        id,
        submission_id,
        proposed_slots,
        duration_minutes,
        meeting_format,
        meeting_link,
        onsite_address,
        status,
        submissions!inner(
          id,
          recruiter_id,
          candidates!inner(id, full_name, email, phone),
          jobs!inner(id, title, company_name, client_id)
        )
      `)
      .eq('response_token', responseToken)
      .single();

    if (interviewError || !interview) {
      throw new Error("Invalid or expired response token");
    }

    // Check if already processed
    if (interview.status !== 'pending_response') {
      throw new Error("This invitation has already been processed");
    }

    const submission = interview.submissions as any;
    const candidate = submission.candidates;
    const job = submission.jobs;
    const proposedSlots = interview.proposed_slots as { datetime: string; status: string }[];

    let responseData: any = {};

    switch (action) {
      case 'accept': {
        if (selectedSlotIndex === undefined || selectedSlotIndex < 0 || selectedSlotIndex >= proposedSlots.length) {
          throw new Error("Invalid slot selection");
        }

        const selectedSlot = proposedSlots[selectedSlotIndex];
        const scheduledAt = selectedSlot.datetime;

        // Update interview
        await supabase
          .from('interviews')
          .update({
            status: 'scheduled',
            scheduled_at: scheduledAt,
            selected_slot_index: selectedSlotIndex,
            candidate_confirmed: true,
            candidate_message: message,
          })
          .eq('id', interview.id);

        // Update submission - reveal identity (Triple-Blind Stage 2)
        await supabase
          .from('submissions')
          .update({
            stage: 'interview_scheduled',
            identity_unlocked: true,
            identity_unlocked_at: new Date().toISOString(),
            company_revealed: true,
            company_revealed_at: new Date().toISOString(),
            full_access_granted: true,
            full_access_granted_at: new Date().toISOString(),
          })
          .eq('id', submission.id);

        // Generate iCal
        const icalContent = generateICalEvent({
          title: `Interview: ${job.title}`,
          startTime: scheduledAt,
          durationMinutes: interview.duration_minutes,
          description: `Interview für die Position ${job.title} bei ${job.company_name}`,
          location: interview.onsite_address || interview.meeting_link,
        });

        // Send confirmation emails
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          // Email to candidate
          await resend.emails.send({
            from: "Matchunt <noreply@matchunt.ai>",
            to: [candidate.email],
            subject: `Interview bestätigt: ${job.title}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">✅ Interview bestätigt!</h2>
                <p>Ihr Interview für <strong>${job.title}</strong> bei <strong>${job.company_name}</strong> wurde bestätigt.</p>
                <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 16px 0;">
                  <p><strong>📅 Datum:</strong> ${formatDate(scheduledAt)}</p>
                  <p><strong>⏰ Uhrzeit:</strong> ${formatTime(scheduledAt)} Uhr</p>
                  <p><strong>⏱️ Dauer:</strong> ${interview.duration_minutes} Minuten</p>
                  ${interview.meeting_link ? `<p><strong>🔗 Link:</strong> <a href="${interview.meeting_link}">${interview.meeting_link}</a></p>` : ''}
                  ${interview.onsite_address ? `<p><strong>📍 Adresse:</strong> ${interview.onsite_address}</p>` : ''}
                </div>
                <p style="font-size: 12px; color: #64748b;">Sie finden den Termin auch im angehängten Kalender-Event (.ics).</p>
              </div>
            `,
            attachments: [{
              filename: 'interview.ics',
              content: btoa(icalContent),
            }],
          });

          // Email to recruiter
          const { data: recruiterProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', submission.recruiter_id)
            .single();

          if (recruiterProfile?.email) {
            await resend.emails.send({
              from: "Matchunt <noreply@matchunt.ai>",
              to: [recruiterProfile.email],
              subject: `Interview bestätigt: ${candidate.full_name} für ${job.title}`,
              html: `
                <div style="font-family: sans-serif;">
                  <h2>✅ Interview bestätigt</h2>
                  <p><strong>${candidate.full_name}</strong> hat das Interview für <strong>${job.title}</strong> bestätigt.</p>
                  <p><strong>Termin:</strong> ${formatDate(scheduledAt)} um ${formatTime(scheduledAt)} Uhr</p>
                </div>
              `,
            });
          }

          // Email to Client with FULL candidate data (identity reveal)
          if (job.client_id) {
            const { data: clientProfile } = await supabase
              .from('profiles')
              .select('email, full_name')
              .eq('user_id', job.client_id)
              .single();

            if (clientProfile?.email) {
              await resend.emails.send({
                from: "Matchunt <noreply@matchunt.ai>",
                to: [clientProfile.email],
                subject: `Interview bestätigt: ${candidate.full_name} für ${job.title}`,
                html: `
                  <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #16a34a;">✅ Interview bestätigt</h2>
                    <p>Der Kandidat hat das Interview für <strong>${job.title}</strong> bestätigt.</p>
                    
                    <h3 style="margin-top: 24px; font-size: 16px;">Kandidaten-Details (freigeschaltet)</h3>
                    <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 12px 0;">
                      <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${candidate.full_name}</p>
                      <p style="margin: 0 0 8px 0;"><strong>E-Mail:</strong> ${candidate.email}</p>
                      ${candidate.phone ? `<p style="margin: 0;"><strong>Telefon:</strong> ${candidate.phone}</p>` : ''}
                    </div>
                    
                    <h3 style="margin-top: 24px; font-size: 16px;">Termin-Details</h3>
                    <div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 12px 0;">
                      <p style="margin: 0 0 8px 0;"><strong>📅 Datum:</strong> ${formatDate(scheduledAt)}</p>
                      <p style="margin: 0 0 8px 0;"><strong>⏰ Uhrzeit:</strong> ${formatTime(scheduledAt)} Uhr</p>
                      <p style="margin: 0 0 8px 0;"><strong>⏱️ Dauer:</strong> ${interview.duration_minutes} Minuten</p>
                      ${interview.meeting_link ? `<p style="margin: 0;"><strong>🔗 Link:</strong> <a href="${interview.meeting_link}">${interview.meeting_link}</a></p>` : ''}
                      ${interview.onsite_address ? `<p style="margin: 0;"><strong>📍 Adresse:</strong> ${interview.onsite_address}</p>` : ''}
                    </div>
                    
                    <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
                      Sie finden den Termin auch im angehängten Kalender-Event (.ics).
                    </p>
                  </div>
                `,
                attachments: [{
                  filename: 'interview.ics',
                  content: btoa(icalContent),
                }],
              });
            }
          }
        }

        // Create notifications
        await supabase.from('notifications').insert([
          {
            user_id: submission.recruiter_id,
            type: 'interview_confirmed',
            title: 'Interview bestätigt',
            message: `${candidate.full_name} hat das Interview für ${job.title} bestätigt.`,
            metadata: { interview_id: interview.id, scheduled_at: scheduledAt },
          },
          ...(job.client_id ? [{
            user_id: job.client_id,
            type: 'interview_confirmed',
            title: 'Interview bestätigt',
            message: `Der Kandidat hat das Interview für ${job.title} bestätigt.`,
            metadata: { interview_id: interview.id, scheduled_at: scheduledAt },
          }] : []),
        ]);

        responseData = { scheduledAt };
        break;
      }

      case 'counter': {
        if (!counterSlots?.length) {
          throw new Error("Counter slots are required");
        }

        // Update interview
        await supabase
          .from('interviews')
          .update({
            status: 'counter_proposed',
            counter_slots: counterSlots.map(datetime => ({ datetime })),
            candidate_message: message,
          })
          .eq('id', interview.id);

        // Update submission stage
        await supabase
          .from('submissions')
          .update({ stage: 'interview_counter_proposed' })
          .eq('id', submission.id);

        // Notify recruiter and client
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          const { data: recruiterProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', submission.recruiter_id)
            .single();

          if (recruiterProfile?.email) {
            await resend.emails.send({
              from: "Matchunt <noreply@matchunt.ai>",
              to: [recruiterProfile.email],
              subject: `Gegenvorschlag: ${candidate.full_name} für ${job.title}`,
              html: `
                <div style="font-family: sans-serif;">
                  <h2>🔄 Gegenvorschlag eingegangen</h2>
                  <p><strong>${candidate.full_name}</strong> hat alternative Termine für das Interview vorgeschlagen.</p>
                  ${message ? `<p><em>"${message}"</em></p>` : ''}
                  <h3>Vorgeschlagene Termine:</h3>
                  <ul>
                    ${counterSlots.map(slot => `<li>${formatDate(slot)} um ${formatTime(slot)} Uhr</li>`).join('')}
                  </ul>
                </div>
              `,
            });
          }
        }

        // Create notification
        await supabase.from('notifications').insert({
          user_id: submission.recruiter_id,
          type: 'interview_counter',
          title: 'Gegenvorschlag für Interview',
          message: `${candidate.full_name} hat alternative Termine für ${job.title} vorgeschlagen.`,
          metadata: { interview_id: interview.id, counter_slots: counterSlots },
        });

        responseData = { counterSlots };
        break;
      }

      case 'decline': {
        // Update interview
        await supabase
          .from('interviews')
          .update({
            status: 'declined',
            decline_reason: declineReason,
            candidate_message: message,
          })
          .eq('id', interview.id);

        // Update submission stage
        await supabase
          .from('submissions')
          .update({ stage: 'interview_declined' })
          .eq('id', submission.id);

        // Notify recruiter
        if (resendApiKey) {
          const resend = new Resend(resendApiKey);
          
          const { data: recruiterProfile } = await supabase
            .from('profiles')
            .select('email')
            .eq('user_id', submission.recruiter_id)
            .single();

          if (recruiterProfile?.email) {
            await resend.emails.send({
              from: "Matchunt <noreply@matchunt.ai>",
              to: [recruiterProfile.email],
              subject: `Interview abgesagt: ${candidate.full_name} für ${job.title}`,
              html: `
                <div style="font-family: sans-serif;">
                  <h2>❌ Interview abgesagt</h2>
                  <p><strong>${candidate.full_name}</strong> hat das Interview für <strong>${job.title}</strong> abgesagt.</p>
                  ${declineReason ? `<p><strong>Grund:</strong> ${declineReason}</p>` : ''}
                  ${message ? `<p><em>"${message}"</em></p>` : ''}
                </div>
              `,
            });
          }
        }

        // Create notification
        await supabase.from('notifications').insert({
          user_id: submission.recruiter_id,
          type: 'interview_declined',
          title: 'Interview abgesagt',
          message: `${candidate.full_name} hat das Interview für ${job.title} abgesagt.`,
          metadata: { interview_id: interview.id, reason: declineReason },
        });

        break;
      }

      default:
        throw new Error("Invalid action");
    }

    return new Response(
      JSON.stringify({ success: true, action, ...responseData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in process-interview-response:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
