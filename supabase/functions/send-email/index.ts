import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mailFrom } from "../_shared/intake-mail.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normLang, type Lang } from "../_shared/i18n.ts";
import { pick } from "../_shared/mail-i18n.ts";
import { candidateLanguage, languageOfEmail } from "../_shared/recipient-language.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  /** Sprache des Empfängers (de, en, sv, nb …); ohne Angabe ermittelt der Server sie */
  lang?: string;
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
// Mehrsprachigkeit (13.11.2026): jede Vorlage in de, en, sv, nb. Die Sprache kommt aus body.lang,
// sonst aus dem Profil der Empfängeradresse, sonst (Kandidat ohne Konto) vom Headhunter der
// Bewerbung, sonst Deutsch – Deutsch bleibt wortgleich wie bisher.
type Tpl = { subject: string; html: (data: Record<string, any>) => string };
type T4 = (de: string, en: string, sv: string, nb: string) => string;

const BTN = (href: string, label: string, color = '#3b82f6') =>
  `<a href="${href}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">${label}</a>`;

function templatesFor(lang: Lang): Record<string, Tpl> {
  const T: T4 = (de, en, sv, nb) => pick(lang, { de, en, sv, nb });
  const regards = T('Mit freundlichen Grüßen,<br/>Das Recruiting-Team', 'Kind regards,<br/>The recruiting team', 'Vänliga hälsningar,<br/>Rekryteringsteamet', 'Vennlig hilsen<br/>Rekrutteringsteamet');
  const good = T('Viel Erfolg!<br/>Das Recruiting-Team', 'Good luck!<br/>The recruiting team', 'Lycka till!<br/>Rekryteringsteamet', 'Lykke til!<br/>Rekrutteringsteamet');
  const dearRecruiter = T('Sehr geehrte(r) Recruiter,', 'Dear recruiter,', 'Hej,', 'Hei,');
  const dear = (name: unknown) => T(`Sehr geehrte(r) ${name},`, `Dear ${name},`, `Hej ${name},`, `Hei ${name},`);
  const position = T('Position', 'Position', 'Tjänst', 'Stilling');
  const company = T('Unternehmen', 'Company', 'Företag', 'Firma');
  const candidate = T('Kandidat', 'Candidate', 'Kandidat', 'Kandidat');
  return {
  interview_invitation: {
    subject: T("Interview-Einladung: {jobTitle}", "Interview invitation: {jobTitle}", "Inbjudan till intervju: {jobTitle}", "Invitasjon til intervju: {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Interview-Einladung', 'Interview invitation', 'Inbjudan till intervju', 'Invitasjon til intervju')}</h1>
        <p>${dear(data.candidateName)}</p>
        <p>${T(`wir freuen uns, Ihnen mitteilen zu können, dass Sie für ein Interview für die Position <strong>${data.jobTitle}</strong> ausgewählt wurden.`, `we are pleased to let you know that you have been selected for an interview for the position <strong>${data.jobTitle}</strong>.`, `vi är glada att kunna meddela att du har valts ut till en intervju för tjänsten <strong>${data.jobTitle}</strong>.`, `vi er glade for å kunne fortelle at du er valgt ut til et intervju for stillingen <strong>${data.jobTitle}</strong>.`)}</p>
        <p><strong>${T('Details', 'Details', 'Detaljer', 'Detaljer')}:</strong></p>
        <ul>
          <li>${T('Datum', 'Date', 'Datum', 'Dato')}: ${data.date}</li>
          <li>${T('Uhrzeit', 'Time', 'Tid', 'Tid')}: ${data.time}</li>
          <li>Format: ${data.meetingType || T('Video-Call', 'Video call', 'Videosamtal', 'Videosamtale')}</li>
          ${data.meetingLink ? `<li>Link: <a href="${data.meetingLink}">${data.meetingLink}</a></li>` : ''}
        </ul>
        <p>${T('Bei Fragen wenden Sie sich bitte an Ihren Recruiter.', 'If you have any questions, please contact your recruiter.', 'Har du frågor kan du vända dig till din rekryterare.', 'Har du spørsmål, kan du kontakte rekruttereren din.')}</p>
        <p>${regards}</p>
      </div>
    `,
  },
  opt_in_request: {
    subject: T("Identitätsfreigabe angefordert für {jobTitle}", "Identity release requested for {jobTitle}", "Begäran om identitet för {jobTitle}", "Forespørsel om identitet for {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Identitätsfreigabe angefordert', 'Identity release requested', 'Begäran om identitet', 'Forespørsel om identitet')}</h1>
        <p>${dearRecruiter}</p>
        <p>${T(`Ein Unternehmen hat die Freigabe der Kandidatenidentität für die Position <strong>${data.jobTitle}</strong> angefordert.`, `A company has requested the release of the candidate’s identity for the position <strong>${data.jobTitle}</strong>.`, `Ett företag har begärt att få se kandidatens identitet för tjänsten <strong>${data.jobTitle}</strong>.`, `Et firma har bedt om å få se kandidatens identitet for stillingen <strong>${data.jobTitle}</strong>.`)}</p>
        <p><strong>${candidate}:</strong> ${data.candidateName}</p>
        <p><strong>${company}:</strong> ${data.companyName}</p>
        <p>${T('Bitte bestätigen Sie die Freigabe in Ihrem Dashboard.', 'Please confirm the release in your dashboard.', 'Bekräfta frisläppandet i din översikt.', 'Bekreft frigivelsen i oversikten din.')}</p>
        ${BTN(data.dashboardUrl, T('Zum Dashboard', 'Go to dashboard', 'Till översikten', 'Til oversikten'))}
        <p>${regards}</p>
      </div>
    `,
  },
  submission_received: {
    subject: T("Neuer Kandidat eingereicht für {jobTitle}", "New candidate submitted for {jobTitle}", "Ny kandidat för {jobTitle}", "Ny kandidat til {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Neuer Kandidatenvorschlag', 'New candidate proposal', 'Nytt kandidatförslag', 'Nytt kandidatforslag')}</h1>
        <p>${dear(data.clientName)}</p>
        <p>${T(`Ein neuer Kandidat wurde für Ihre Stelle <strong>${data.jobTitle}</strong> vorgeschlagen.`, `A new candidate has been proposed for your role <strong>${data.jobTitle}</strong>.`, `En ny kandidat har föreslagits för din tjänst <strong>${data.jobTitle}</strong>.`, `En ny kandidat er foreslått til stillingen din <strong>${data.jobTitle}</strong>.`)}</p>
        <p><strong>${T('Match-Score', 'Match score', 'Matchningspoäng', 'Matchpoeng')}:</strong> ${data.matchScore}%</p>
        <p><strong>${T('Erfahrung', 'Experience', 'Erfarenhet', 'Erfaring')}:</strong> ${data.experienceYears} ${T('Jahre', 'years', 'år', 'år')}</p>
        <p>${T('Sehen Sie sich den Kandidaten in Ihrem Dashboard an.', 'Take a look at the candidate in your dashboard.', 'Titta på kandidaten i din översikt.', 'Se på kandidaten i oversikten din.')}</p>
        ${BTN(data.dashboardUrl, T('Kandidat ansehen', 'View candidate', 'Visa kandidat', 'Se kandidat'))}
        <p>${regards}</p>
      </div>
    `,
  },
  rejection_notice: {
    subject: T("Absage: {jobTitle}", "Rejection: {jobTitle}", "Avslag: {jobTitle}", "Avslag: {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Statusupdate zu Ihrer Bewerbung', 'Status update on your application', 'Statusuppdatering för ansökan', 'Statusoppdatering for søknaden')}</h1>
        <p>${dearRecruiter}</p>
        <p>${T(`Leider müssen wir Ihnen mitteilen, dass der Kandidat <strong>${data.candidateName}</strong> für die Position <strong>${data.jobTitle}</strong> nicht weiter berücksichtigt werden konnte.`, `Unfortunately, the candidate <strong>${data.candidateName}</strong> could not be considered further for the position <strong>${data.jobTitle}</strong>.`, `Tyvärr kunde kandidaten <strong>${data.candidateName}</strong> inte gå vidare för tjänsten <strong>${data.jobTitle}</strong>.`, `Dessverre kunne kandidaten <strong>${data.candidateName}</strong> ikke gå videre for stillingen <strong>${data.jobTitle}</strong>.`)}</p>
        ${data.reason ? `<p><strong>${T('Begründung', 'Reason', 'Motivering', 'Begrunnelse')}:</strong> ${data.reason}</p>` : ''}
        <p>${T('Vielen Dank für Ihre Bemühungen.', 'Thank you for your efforts.', 'Tack för din insats.', 'Takk for innsatsen.')}</p>
        <p>${regards}</p>
      </div>
    `,
  },
  interview_reminder: {
    subject: T("Erinnerung: Interview morgen - {jobTitle}", "Reminder: interview tomorrow - {jobTitle}", "Påminnelse: intervju i morgon - {jobTitle}", "Påminnelse: intervju i morgen - {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Interview-Erinnerung', 'Interview reminder', 'Påminnelse om intervju', 'Påminnelse om intervju')}</h1>
        <p>${dear(data.recipientName)}</p>
        <p>${T('Dies ist eine freundliche Erinnerung an Ihr bevorstehendes Interview:', 'This is a friendly reminder of your upcoming interview:', 'Det här är en vänlig påminnelse om din kommande intervju:', 'Dette er en vennlig påminnelse om det kommende intervjuet ditt:')}</p>
        <p><strong>${position}:</strong> ${data.jobTitle}</p>
        <p><strong>${T('Datum', 'Date', 'Datum', 'Dato')}:</strong> ${data.date}</p>
        <p><strong>${T('Uhrzeit', 'Time', 'Tid', 'Tid')}:</strong> ${data.time}</p>
        ${data.meetingLink ? `<p><strong>${T('Meeting-Link', 'Meeting link', 'Möteslänk', 'Møtelenke')}:</strong> <a href="${data.meetingLink}">${data.meetingLink}</a></p>` : ''}
        <p>${regards}</p>
      </div>
    `,
  },
  candidate_support: {
    subject: T("Vorbereitungsmaterial: {jobTitle}", "Preparation material: {jobTitle}", "Förberedelsematerial: {jobTitle}", "Forberedelsesmateriell: {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${data.contentTitle}</h1>
        <p>${dear(data.candidateName)}</p>
        <p>${T(`Ihr Recruiter hat Ihnen folgendes Vorbereitungsmaterial für Ihre Bewerbung${data.jobTitle ? ` bei ${data.jobTitle}` : ''} zugesandt:`, `Your recruiter has sent you the following preparation material for your application${data.jobTitle ? ` for ${data.jobTitle}` : ''}:`, `Din rekryterare har skickat följande förberedelsematerial för din ansökan${data.jobTitle ? ` till ${data.jobTitle}` : ''}:`, `Rekruttereren din har sendt deg følgende forberedelsesmateriell for søknaden din${data.jobTitle ? ` til ${data.jobTitle}` : ''}:`)}</p>
        <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0; white-space: pre-wrap;">
${data.content}
        </div>
        <p>${T('Bei Fragen stehen wir Ihnen gerne zur Verfügung.', 'We are happy to help if you have any questions.', 'Hör gärna av dig om du har frågor.', 'Ta gjerne kontakt hvis du har spørsmål.')}</p>
        <p>${good}</p>
      </div>
    `,
  },
  prep_material: {
    subject: T("Vorbereitung für Ihr Interview: {jobTitle}", "Preparing for your interview: {jobTitle}", "Förberedelse inför din intervju: {jobTitle}", "Forberedelse til intervjuet ditt: {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Interview-Vorbereitung', 'Interview preparation', 'Förberedelse inför intervjun', 'Forberedelse til intervjuet')}</h1>
        <p>${dear(data.candidateName)}</p>
        <p>${T(`Ihr Interview für die Position <strong>${data.jobTitle}</strong> steht bevor. Hier sind einige hilfreiche Ressourcen zur Vorbereitung:`, `Your interview for the position <strong>${data.jobTitle}</strong> is coming up. Here are some helpful resources to prepare:`, `Din intervju för tjänsten <strong>${data.jobTitle}</strong> närmar sig. Här är några användbara resurser för att förbereda dig:`, `Intervjuet ditt for stillingen <strong>${data.jobTitle}</strong> nærmer seg. Her er noen nyttige ressurser til forberedelsene:`)}</p>
        <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <h3 style="margin-top: 0;">📋 ${T('Checkliste', 'Checklist', 'Checklista', 'Sjekkliste')}:</h3>
          <ul>
            <li>${T('Recherchieren Sie das Unternehmen', 'Research the company', 'Läs på om företaget', 'Les deg opp på firmaet')}</li>
            <li>${T('Bereiten Sie Fragen vor', 'Prepare questions', 'Förbered frågor', 'Forbered spørsmål')}</li>
            <li>${T('Überprüfen Sie die Stellenbeschreibung', 'Review the job description', 'Gå igenom tjänstebeskrivningen', 'Gå gjennom stillingsbeskrivelsen')}</li>
            <li>${T('Testen Sie Ihre Technik (bei Video-Interviews)', 'Test your equipment (for video interviews)', 'Testa tekniken (vid videointervjuer)', 'Test teknikken (ved videointervjuer)')}</li>
          </ul>
        </div>
        ${BTN(data.prepLink, T('Vollständiges Vorbereitungsmaterial ansehen', 'View the full preparation material', 'Visa hela förberedelsematerialet', 'Se hele forberedelsesmateriellet'))}
        <p>${good}</p>
      </div>
    `,
  },
  // New templates for Talent Hub workflow automation
  interview_request_to_recruiter: {
    subject: T("Interview-Anfrage für Kandidat #{candidateAnonymId}", "Interview request for candidate #{candidateAnonymId}", "Intervjuförfrågan för kandidat #{candidateAnonymId}", "Intervjuforespørsel for kandidat #{candidateAnonymId}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">🎯 ${T('Interview-Anfrage', 'Interview request', 'Intervjuförfrågan', 'Intervjuforespørsel')}</h1>
        <p>${dearRecruiter}</p>
        <p>${T('Ein Kunde möchte ein Interview mit einem Ihrer Kandidaten führen.', 'A client would like to interview one of your candidates.', 'En kund vill intervjua en av dina kandidater.', 'En kunde ønsker å intervjue en av kandidatene dine.')}</p>
        
        <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #3b82f6;">
          <p style="margin: 0 0 8px 0;"><strong>${position}:</strong> ${data.jobTitle}</p>
          <p style="margin: 0 0 8px 0;"><strong>${company}:</strong> ${data.companyName}</p>
          <p style="margin: 0;"><strong>${candidate}:</strong> ${data.candidateAnonymId}</p>
        </div>
        
        ${data.message ? `
        <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>${T('Nachricht des Kunden', 'Message from the client', 'Meddelande från kunden', 'Melding fra kunden')}:</strong></p>
          <p style="margin: 0; color: #666;">${data.message}</p>
        </div>
        ` : ''}
        
        ${data.proposedSlots && data.proposedSlots.length > 0 ? `
        <div style="margin: 16px 0;">
          <p><strong>${T('Vorgeschlagene Termine', 'Proposed times', 'Föreslagna tider', 'Foreslåtte tidspunkter')}:</strong></p>
          <ul>
            ${data.proposedSlots.map((slot: string) => `<li>${slot}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <p><strong>${T('Nächster Schritt', 'Next step', 'Nästa steg', 'Neste steg')}:</strong> ${T('Bitte holen Sie die Zustimmung des Kandidaten ein und bestätigen Sie die Teilnahme im Dashboard.', 'Please obtain the candidate’s consent and confirm participation in the dashboard.', 'Inhämta kandidatens samtycke och bekräfta deltagandet i översikten.', 'Innhent kandidatens samtykke og bekreft deltakelsen i oversikten.')}</p>
        
        ${BTN(data.dashboardUrl || '#', T('Im Dashboard bestätigen', 'Confirm in the dashboard', 'Bekräfta i översikten', 'Bekreft i oversikten'))}
        
        <p>${regards}</p>
      </div>
    `,
  },
  opt_in_confirmed_to_client: {
    subject: T("✅ Kandidat hat zugestimmt: {jobTitle}", "✅ Candidate has agreed: {jobTitle}", "✅ Kandidaten har tackat ja: {jobTitle}", "✅ Kandidaten har takket ja: {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">🎉 ${T('Kandidat hat zugestimmt!', 'Candidate has agreed!', 'Kandidaten har tackat ja!', 'Kandidaten har takket ja!')}</h1>
        <p>${T('Gute Nachrichten! Der Kandidat hat der Interview-Anfrage zugestimmt.', 'Good news! The candidate has accepted the interview request.', 'Goda nyheter! Kandidaten har tackat ja till intervjuförfrågan.', 'Gode nyheter! Kandidaten har takket ja til intervjuforespørselen.')}</p>
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
          <p style="margin: 0 0 8px 0;"><strong>Name:</strong> ${data.candidateName}</p>
          <p style="margin: 0 0 8px 0;"><strong>${T('E-Mail', 'Email', 'E-post', 'E-post')}:</strong> ${data.candidateEmail}</p>
          ${data.candidatePhone ? `<p style="margin: 0 0 8px 0;"><strong>${T('Telefon', 'Phone', 'Telefon', 'Telefon')}:</strong> ${data.candidatePhone}</p>` : ''}
          <p style="margin: 0;"><strong>${position}:</strong> ${data.jobTitle}</p>
        </div>
        
        <p>${T('Sie können jetzt den Interview-Termin finalisieren und direkten Kontakt aufnehmen.', 'You can now finalise the interview time and get in touch directly.', 'Nu kan du bestämma intervjutiden och ta kontakt direkt.', 'Nå kan du fastsette intervjutidspunktet og ta kontakt direkte.')}</p>
        
        ${BTN(data.dashboardUrl || '#', T('Interview planen', 'Plan interview', 'Planera intervju', 'Planlegg intervju'), '#22c55e')}
        
        <p>${regards}</p>
      </div>
    `,
  },
  candidate_moved_to_recruiter: {
    subject: T("📈 Kandidat weitergeleitet: {candidateName}", "📈 Candidate moved forward: {candidateName}", "📈 Kandidaten går vidare: {candidateName}", "📈 Kandidaten går videre: {candidateName}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">📈 ${T('Fortschritt im Prozess', 'Progress in the process', 'Framsteg i processen', 'Fremgang i prosessen')}</h1>
        <p>${dearRecruiter}</p>
        <p>${T('Gute Nachrichten! Ihr Kandidat wurde im Bewerbungsprozess weitergeleitet.', 'Good news! Your candidate has moved forward in the process.', 'Goda nyheter! Din kandidat har gått vidare i processen.', 'Gode nyheter! Kandidaten din har gått videre i prosessen.')}</p>
        
        <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #22c55e;">
          <p style="margin: 0 0 8px 0;"><strong>${candidate}:</strong> ${data.candidateName}</p>
          <p style="margin: 0 0 8px 0;"><strong>${position}:</strong> ${data.jobTitle}</p>
          <p style="margin: 0 0 8px 0;"><strong>${company}:</strong> ${data.companyName}</p>
          <p style="margin: 0;"><strong>${T('Neue Phase', 'New stage', 'Ny fas', 'Ny fase')}:</strong> ${data.oldStage} → <strong style="color: #22c55e;">${data.newStage}</strong></p>
        </div>
        
        <p>${T('Der Prozess läuft wie geplant. Wir halten Sie über weitere Entwicklungen auf dem Laufenden.', 'The process is running as planned. We will keep you posted on further developments.', 'Processen går som planerat. Vi håller dig uppdaterad.', 'Prosessen går som planlagt. Vi holder deg oppdatert.')}</p>
        
        ${BTN(data.dashboardUrl || '#', T('Details im Dashboard', 'Details in the dashboard', 'Detaljer i översikten', 'Detaljer i oversikten'))}
        
        <p>${regards}</p>
      </div>
    `,
  },
  candidate_rejected_to_recruiter: {
    subject: T("Absage: {candidateName} für {jobTitle}", "Rejection: {candidateName} for {jobTitle}", "Avslag: {candidateName} för {jobTitle}", "Avslag: {candidateName} for {jobTitle}"),
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">${T('Absage erhalten', 'Rejection received', 'Avslag mottaget', 'Avslag mottatt')}</h1>
        <p>${dearRecruiter}</p>
        <p>${T('Leider wurde Ihr Kandidat für diese Position nicht weiter berücksichtigt.', 'Unfortunately, your candidate was not considered further for this position.', 'Tyvärr gick din kandidat inte vidare för den här tjänsten.', 'Dessverre gikk kandidaten din ikke videre for denne stillingen.')}</p>
        
        <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
          <p style="margin: 0 0 8px 0;"><strong>${candidate}:</strong> ${data.candidateName}</p>
          <p style="margin: 0 0 8px 0;"><strong>${position}:</strong> ${data.jobTitle}</p>
          <p style="margin: 0;"><strong>${company}:</strong> ${data.companyName}</p>
        </div>
        
        ${data.rejectionReason ? `
        <div style="background: #fafafa; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0;"><strong>${T('Begründung', 'Reason', 'Motivering', 'Begrunnelse')}:</strong></p>
          <p style="margin: 0; color: #666;">${data.rejectionReason}</p>
          ${data.rejectionCategory ? `<p style="margin: 8px 0 0 0; color: #888; font-size: 14px;">${T('Kategorie', 'Category', 'Kategori', 'Kategori')}: ${data.rejectionCategory}</p>` : ''}
        </div>
        ` : ''}
        
        <p>${T('Der Kandidat bleibt in Ihrem Talent Pool und kann für andere passende Stellen vorgeschlagen werden.', 'The candidate stays in your talent pool and can be proposed for other suitable roles.', 'Kandidaten finns kvar i din talangpool och kan föreslås för andra passande tjänster.', 'Kandidaten blir værende i talentpoolen din og kan foreslås til andre passende stillinger.')}</p>
        
        ${BTN(data.dashboardUrl || '#', T('Weitere Stellen finden', 'Find more roles', 'Hitta fler tjänster', 'Finn flere stillinger'))}
        
        <p>${regards}</p>
      </div>
    `,
  },
  };
}

/** Sprache des Empfängers: Angabe im Aufruf, sonst Profil der Adresse, sonst Headhunter der Bewerbung (Kandidat), sonst Deutsch. */
async function recipientLang(db: SupabaseClient, body: { lang?: unknown; to?: string; submissionId?: string }): Promise<Lang> {
  const given = normLang(body.lang);
  if (given) return given;
  const byEmail = await languageOfEmail(db, body.to);
  if (byEmail) return byEmail;
  if (body.submissionId) {
    try {
      const { data } = await db.from('submissions').select('recruiter_id').eq('id', body.submissionId).maybeSingle();
      if ((data as { recruiter_id?: string } | null)?.recruiter_id) return await candidateLanguage(db, (data as { recruiter_id: string }).recruiter_id);
    } catch { /* Deutsch */ }
  }
  return 'de';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, template, data, submissionId, candidateId, lang: wanted }: EmailRequest = await req.json();

    console.log(`Sending email: template=${template}, to=${to}, submissionId=${submissionId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get template (in der Sprache des Empfängers)
    const lang = await recipientLang(supabase, { lang: wanted, to, submissionId });
    const emailTemplate = templatesFor(lang)[template];
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
      from: mailFrom(),
      to: [to],
      subject,
      html,
    });

    // Resend wirft nicht, sondern liefert { error } -- vorher galt jede Mail als verschickt.
    if (emailResponse.error) {
      console.error("Resend lehnte die Mail ab:", emailResponse.error);
      if (emailEventId) {
        await supabase.from("email_events").update({ status: "failed", error_message: String(emailResponse.error.message ?? emailResponse.error).slice(0, 400) }).eq("id", emailEventId);
      }
      throw new Error("E-Mail konnte nicht verschickt werden");
    }
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