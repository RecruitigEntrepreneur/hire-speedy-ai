import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { canUserActOnJob } from "../_shared/team-access.ts";
import { intlLocale, tr, type Lang } from "../_shared/i18n.ts";
import { candidateLanguage } from "../_shared/recipient-language.ts";
import { withLang } from "../_shared/mail-i18n.ts";

// Mehrsprachigkeit (13.11.2026): Die Einladung geht in der Sprache des Kandidaten raus
// (= die seines Headhunters). Ohne Sprache Deutsch, wortgleich wie bisher.
type Tx = (de: string, en: string, sv: string, nb: string, vars?: Record<string, string | number>) => string;
const txFor = (lang: Lang): Tx => (de, en, sv, nb, vars) => tr(lang, { de, en, sv, nb }, vars);

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
const MEETING_FORMAT_LABELS_IN: Record<string, { en: string; sv: string; nb: string }> = {
  teams: { en: 'Microsoft Teams (video)', sv: 'Microsoft Teams (video)', nb: 'Microsoft Teams (video)' },
  meet: { en: 'Google Meet (video)', sv: 'Google Meet (video)', nb: 'Google Meet (video)' },
  video: { en: 'Video interview', sv: 'Videointervju', nb: 'Videointervju' },
  phone: { en: 'Phone interview', sv: 'Telefonintervju', nb: 'Telefonintervju' },
  onsite: { en: 'On-site interview', sv: 'Intervju på plats', nb: 'Intervju på stedet' },
};
const formatLabelIn = (format: string, lang: Lang) => {
  const de = MEETING_FORMAT_LABELS[format];
  const other = MEETING_FORMAT_LABELS_IN[format];
  return de && other ? tr(lang, { de, ...other }) : format;
};

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatDate(isoString: string, lang: Lang = 'de'): string {
  const date = new Date(isoString);
  if (lang === 'en' || lang === 'sv' || lang === 'nb') {
    return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  }
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${days[date.getDay()]}, ${date.getDate()}. ${months[date.getMonth()]}`;
}

function formatTime(isoString: string, lang: Lang = 'de'): string {
  const date = new Date(isoString);
  if (lang === 'en' || lang === 'sv' || lang === 'nb') {
    return new Intl.DateTimeFormat(intlLocale(lang), { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function generateSlotTableHtml(slots: string[], duration: number, lang: Lang = 'de'): string {
  const t = txFor(lang);
  return slots.map(slot => `
    <tr style="border-top: 1px solid #e2e8f0;">
      <td style="padding: 10px 16px;">${formatDate(slot, lang)}</td>
      <td style="padding: 10px 16px; font-weight: 600;">${t('{t} Uhr', '{t}', 'kl. {t}', 'kl. {t}', { t: formatTime(slot, lang) })}</td>
      <td style="padding: 10px 16px; color: #64748b;">${duration} Min</td>
    </tr>
  `).join('');
}

function generateEmailHtml(params: {
  candidateName: string;
  jobTitle: string;
  companyDescription: string;
  companyName?: string | null;
  meetingFormat: string;
  duration: number;
  clientMessage?: string;
  slots: string[];
  acceptUrl: string;
  counterUrl: string;
  declineUrl: string;
  lang?: Lang;
}): string {
  const { candidateName, jobTitle, companyDescription, companyName, meetingFormat, duration, clientMessage, slots, acceptUrl, counterUrl, declineUrl } = params;
  const lang = params.lang ?? 'de';
  const t = txFor(lang);

  // Produktentscheidung 2026-07: Der Kandidat sieht die Firma direkt in der
  // Anfrage. Seine eigene Identität bleibt bis zur aktiven Zustimmung anonym.
  const inviterHtml = companyName
    ? t('die Firma <strong>{c}</strong>', 'The company <strong>{c}</strong>', 'Företaget <strong>{c}</strong>', 'Selskapet <strong>{c}</strong>', { c: companyName })
    : t('ein {d}', 'A {d}', 'Ett {d}', 'Et {d}', { d: companyDescription });
  const companyRowHtml = companyName
    ? `<tr>
            <td style="padding: 8px 0; color: #64748b;">${t('Unternehmen:', 'Company:', 'Företag:', 'Selskap:')}</td>
            <td style="padding: 8px 0; font-weight: 600;">${companyName}</td>
          </tr>`
    : '';
  
  const clientMessageHtml = clientMessage ? `
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border-left: 3px solid #0284c7; margin: 16px 0;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">${t('Nachricht vom Unternehmen:', 'Message from the company:', 'Meddelande från företaget:', 'Melding fra selskapet:')}</p>
      <p style="margin: 8px 0 0; font-style: italic;">„${clientMessage}"</p>
    </div>
  ` : '';

  return `
    <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #1a2332 0%, #0f172a 100%); color: white; padding: 32px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">${t('Interview-Einladung', 'Interview invitation', 'Inbjudan till intervju', 'Invitasjon til intervju')}</h1>
        <p style="margin: 8px 0 0; opacity: 0.8;">${jobTitle}</p>
      </div>

      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 16px;">${t('Hallo {n},', 'Hello {n},', 'Hej {n},', 'Hei {n},', { n: candidateName })}</p>
        <p style="margin: 0 0 16px;">${t('{i} möchte Sie gerne kennenlernen.', '{i} would like to meet you.', '{i} vill gärna träffa dig.', '{i} vil gjerne møte deg.', { i: inviterHtml })}</p>

        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          ${companyRowHtml}
          <tr>
            <td style="padding: 8px 0; color: #64748b; width: 120px;">${t('Position:', 'Position:', 'Tjänst:', 'Stilling:')}</td>
            <td style="padding: 8px 0; font-weight: 600;">${jobTitle}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">Format:</td>
            <td style="padding: 8px 0;">${meetingFormat}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b;">${t('Dauer:', 'Duration:', 'Längd:', 'Varighet:')}</td>
            <td style="padding: 8px 0;">${t('{d} Minuten', '{d} minutes', '{d} minuter', '{d} minutter', { d: duration })}</td>
          </tr>
        </table>

        ${clientMessageHtml}

        <h3 style="margin: 24px 0 12px;">${t('Terminvorschläge:', 'Proposed times:', 'Föreslagna tider:', 'Foreslåtte tidspunkter:')}</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 10px 16px; text-align: left; font-weight: 500;">${t('Tag', 'Day', 'Dag', 'Dag')}</th>
              <th style="padding: 10px 16px; text-align: left; font-weight: 500;">${t('Uhrzeit', 'Time', 'Tid', 'Tid')}</th>
              <th style="padding: 10px 16px; text-align: left; font-weight: 500;">${t('Dauer', 'Duration', 'Längd', 'Varighet')}</th>
            </tr>
          </thead>
          <tbody>
            ${generateSlotTableHtml(slots, duration, lang)}
          </tbody>
        </table>

        <div style="margin: 32px 0; text-align: center;">
          <a href="${acceptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 0 8px 8px;">
            ✅ ${t('Termin annehmen', 'Accept time', 'Tacka ja till tiden', 'Godta tidspunktet')}
          </a>
          <a href="${counterUrl}" style="display: inline-block; background: white; color: #1e293b; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid #e2e8f0; margin: 0 8px 8px;">
            🔄 ${t('Gegenvorschlag', 'Suggest another time', 'Föreslå annan tid', 'Foreslå et annet tidspunkt')}
          </a>
          <a href="${declineUrl}" style="display: inline-block; background: white; color: #dc2626; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; border: 1px solid #fecaca; margin: 0 8px 8px;">
            ❌ ${t('Absagen', 'Decline', 'Tacka nej', 'Takk nei')}
          </a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
          🔒 ${t(`Ihre persönlichen Daten (Name, Kontakt, Lebenslauf) werden dem Unternehmen erst freigegeben,
          nachdem Sie auf der Antwortseite aktiv zugestimmt haben (DSGVO-konform).`,
          'Your personal data (name, contact details, CV) is only shared with the company after you have actively agreed on the response page (GDPR-compliant).',
          'Dina personuppgifter (namn, kontaktuppgifter, CV) delas med företaget först när du aktivt har godkänt det på svarssidan (enligt GDPR).',
          'Personopplysningene dine (navn, kontaktinformasjon, CV) deles med selskapet først når du aktivt har samtykket på svarsiden (i tråd med GDPR).')}
        </p>
      </div>

      <div style="background: #f8fafc; padding: 16px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          ${t('Versendet über Matchunt • Datenschutz-konform', 'Sent via Matchunt • Privacy-compliant', 'Skickat via Matchunt • Integritetssäkert', 'Sendt via Matchunt • Personvernsikkert')}
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

    // Aufrufer verifizieren (vorher wurde nur die EXISTENZ des Headers geprüft
    // → IDOR: jeder eingeloggte Nutzer konnte für fremde Submissions einladen)
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Autorisierung: nur Client-Seite dieses Jobs (Ersteller, Org-Admin/HR,
    // zugewiesener Hiring Manager) oder Plattform-Admin — Viewer sind read-only.
    const allowed = await canUserActOnJob(supabase, user.id, submission.job_id);
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Not authorized for this job' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      // Nur stage schreiben — status leitet der DB-Trigger ab.
      .update({ 
        stage: 'interview_requested'
      })
      .eq('id', submissionId);

    // Generate URLs
    const baseUrl = Deno.env.get("VITE_SUPABASE_URL")?.replace('.supabase.co', '') || 'https://matchunt.ai';
    const frontendUrl = baseUrl.includes('supabase') ? 'https://matchunt.ai' : baseUrl;
    
    const lang = await candidateLanguage(supabase, submission.recruiter_id);
    const t = txFor(lang);
    const acceptUrl = withLang(`${frontendUrl}/interview/respond/${responseToken}?action=accept`, lang);
    const counterUrl = withLang(`${frontendUrl}/interview/respond/${responseToken}?action=counter`, lang);
    const declineUrl = withLang(`${frontendUrl}/interview/respond/${responseToken}?action=decline`, lang);

    // Generate anonymized company description
    const companyDescription = job.industry 
      ? t('{i}-Unternehmen', '{i} company', 'företag inom {i}', 'selskap innen {i}', { i: job.industry })
      : t('Technologie-Unternehmen', 'technology company', 'teknikföretag', 'teknologiselskap');

    // Send email to candidate.
    // WICHTIG: Das Resend-SDK wirft bei Versandfehlern KEINE Exception, sondern
    // liefert { error } zurück – ohne Prüfung wäre ein Fehlschlag unsichtbar.
    let emailSent = false;
    let emailError: string | null = null;

    if (!resendApiKey) {
      emailError = 'RESEND_API_KEY ist nicht gesetzt – keine E-Mail versendet.';
      console.warn(emailError);
    } else if (!candidate.email) {
      emailError = 'Kandidat hat keine E-Mail-Adresse hinterlegt.';
      console.warn(emailError);
    } else {
      const resend = new Resend(resendApiKey);

      const emailHtml = generateEmailHtml({
        candidateName: candidate.full_name.split(' ')[0], // First name only
        jobTitle: job.title,
        companyDescription,
        companyName: job.company_name || null,
        meetingFormat: formatLabelIn(meetingFormat, lang),
        duration: durationMinutes,
        clientMessage,
        slots: proposedSlots,
        acceptUrl,
        counterUrl,
        declineUrl,
        lang,
      });

      const { data: sendResult, error: sendError } = await resend.emails.send({
        from: "Matchunt <noreply@matchunt.ai>",
        to: [candidate.email],
        subject: job.company_name
          ? t('Interview-Einladung: {job} bei {co}', 'Interview invitation: {job} at {co}', 'Inbjudan till intervju: {job} hos {co}', 'Invitasjon til intervju: {job} hos {co}', { job: job.title, co: job.company_name })
          : t('Interview-Einladung: {job}', 'Interview invitation: {job}', 'Inbjudan till intervju: {job}', 'Invitasjon til intervju: {job}', { job: job.title }),
        html: emailHtml,
      });

      if (sendError) {
        emailError = `Resend-Fehler: ${JSON.stringify(sendError)}`;
        console.error('E-Mail-Versand fehlgeschlagen:', sendError);
      } else {
        emailSent = true;
        console.log('Einladungs-E-Mail versendet, Resend-ID:', sendResult?.id);
      }
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

    // Create influence_alert so recruiter gets a task to obtain candidate opt-in
    await supabase
      .from('influence_alerts')
      .insert({
        submission_id: submissionId,
        recruiter_id: submission.recruiter_id,
        alert_type: 'opt_in_pending',
        priority: 'critical',
        title: `Interview-Anfrage: ${candidate.full_name} – ${job.title}`,
        message: `Ein Kunde möchte ${candidate.full_name} für "${job.title}" interviewen.`,
        recommended_action: 'Kontaktieren Sie den Kandidaten und holen Sie die Zustimmung (Opt-In) ein.',
      });

    return new Response(
      JSON.stringify({
        success: true,
        interviewId: interview.id,
        responseToken,
        emailSent,
        emailError,
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
