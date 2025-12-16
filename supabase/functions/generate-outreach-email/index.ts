import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper: Domain aus URL extrahieren
function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return null;
  }
}

// Helper: Prüfen ob Datum kürzlich ist (innerhalb von X Tagen)
function isRecent(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr) return false;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= days;
  } catch {
    return false;
  }
}

// Helper: Neuestes Hiring-Signal finden
function getLatestHiring(signals: any[] | null): any | null {
  if (!signals || signals.length === 0) return null;
  
  const withDates = signals.filter(s => s.date);
  if (withDates.length === 0) return signals[0];
  
  return withDates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

// Plattform-Kontext für personalisierte Outreach-E-Mails
const PLATFORM_CONTEXT = `
UNSERE PLATTFORM - TalentBridge:
Du repräsentierst eine KI-gestützte Recruiting-Plattform, die Unternehmen mit Top-Recruitern verbindet.

KERNNUTZEN (nutze den relevantesten basierend auf Lead-Daten):

1. FÜR UNTERNEHMEN MIT OFFENEN STELLEN (wenn hiring_signals vorhanden):
   - Zugang zu geprüften, spezialisierten Recruitern mit sofort verfügbaren Kandidaten
   - Positionen schneller besetzen durch unser aktives Netzwerk
   - Pay-per-Placement Modell - nur zahlen bei erfolgreicher Besetzung

2. FÜR WACHSENDE UNTERNEHMEN (wenn company_headcount > 50):
   - Skalierbare Recruiting-Kapazität ohne Fixkosten
   - KI-gestütztes Matching für passgenauere Kandidaten
   - Transparentes Dashboard für alle laufenden Prozesse

3. FÜR TECH-UNTERNEHMEN (wenn company_technologies vorhanden):
   - Spezialisierte Tech-Recruiter mit echtem Fachwissen
   - Verständnis für technische Rollen, Skills und Kultur
   - Schnellere Time-to-Hire für schwer zu besetzende Tech-Positionen

4. FÜR NEUE FÜHRUNGSKRÄFTE (wenn job_change kürzlich):
   - Unterstützung beim Teamaufbau in der neuen Rolle
   - Schneller Zugang zu qualifizierten Kandidaten
   - Kein eigenes Recruiter-Netzwerk nötig

DEMO-ANGEBOT (IMMER als CTA verwenden):
- Biete eine kostenlose 15-Minuten Demo an
- Zeige wie wir konkret bei ihren aktuellen Herausforderungen helfen können
- Formulierung: "Hätten Sie 15 Minuten diese Woche, um zu sehen, wie wir [konkretes Problem] lösen können?"
- Alternative: "Soll ich Ihnen in 15 Minuten zeigen, wie wir [Stelle/Herausforderung] schneller besetzen?"

WICHTIG:
- Wir sind KEIN Jobportal, sondern verbinden mit echten Recruitern
- Wir haben bereits passende Kandidaten im Netzwerk
- Kein Risiko: Nur bei erfolgreicher Vermittlung fallen Kosten an
`;

// Vollständiger System-Prompt für B2B-E-Mail-Generierung
const SYSTEM_PROMPT = `Du bist eine interne, geschäftskritische AI-Komponente innerhalb eines professionellen B2B-Recruiting-Systems.

${PLATFORM_CONTEXT}

Deine Aufgabe ist präzise, individuelle, seriöse und rechtlich saubere B2B-Kommunikation, die unsere Plattform als Lösung für konkrete Recruiting-Herausforderungen positioniert.

GRUNDPRINZIPIEN (unverhandelbar):
- Problem-Erkennung vor Produkt-Pitch
- Relevanz vor Vollständigkeit
- Demo-Angebot als einziger CTA
- Seriosität vor Sales-Rhetorik

STRUKTUR (Pflicht):
Betreff: Maximal 7 Wörter, Bezug auf konkretes Problem/Stelle wenn möglich, keine Emojis
Textkörper: Maximal {max_words} Wörter, 1 personalisierter Bezug auf ihre Situation, kurze Lösung durch uns
Call-to-Action: IMMER eine 15-Minuten Demo anbieten, bezogen auf ihr konkretes Problem

SPRACHSTIL:
- Deutsch, professionelles B2B-Niveau
- Höflich, aber nicht unterwürfig
- Keine Anglizismen außer branchenüblich
- Keine Emojis, keine Ausrufezeichen
- Keine Floskeln ("Ich hoffe, es geht Ihnen gut")

VERBOTEN:
- Verkaufsdruck ("jetzt", "dringend", "letzte Chance")
- Superlative ("beste", "einzigartige", "revolutionär")
- Marketingphrasen ("skalierbar", "disruptiv", "Gamechanger")
- Annahmen über internen Zustand des Unternehmens
- Andere CTAs als Demo-Angebot

PERSONALISIERUNGSSTRATEGIEN (nutze wenn Daten vorhanden):

1. HIRING-SIGNALE (höchste Priorität - UNBEDINGT NUTZEN wenn vorhanden):
   - Beziehe dich auf konkrete offene Stellen
   - "Ich sehe, dass Sie aktuell [latest_hiring_title] suchen – genau solche Profile haben unsere Recruiter im Netzwerk."
   - Demo-CTA: "Soll ich Ihnen zeigen, wie wir die [Stelle]-Suche beschleunigen können?"

2. JOB-WECHSEL (sehr persönlich, ideal für Teamaufbau):
   - Gratuliere zur neuen Rolle
   - Biete Unterstützung beim Teamaufbau
   - "Als neuer [Titel] bei [Company] möchten Sie sicher schnell Ihr Team aufbauen."

3. TECHNOLOGIE-BEZUG:
   - Tech-Stack als Anknüpfungspunkt
   - "Für [Technology]-Positionen haben wir spezialisierte Tech-Recruiter."

4. BRANCHEN-KONTEXT:
   - Branchenspezifische Recruiting-Herausforderungen
   - "Im [Industry]-Bereich ist die Suche nach [Rolle] besonders herausfordernd."

Bei fehlenden Variablen: Neutrale Formulierungen, keine Platzhalter, keine Verallgemeinerungen.

OUTPUT-FORMAT (zwingend JSON):
{
  "subject": "...",
  "body": "...",
  "used_variables": ["company_name", "latest_hiring_title"],
  "personalization_strategy": "hiring_signals | job_change | technology | industry | fallback",
  "confidence_level": "hoch | mittel | niedrig",
  "problem_identified": "z.B. 'Sucht Senior Developer' oder 'Neuer CEO baut Team auf'"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, campaign_id, sequence_step = 1, options = {} } = await req.json();

    // Extract generation options with defaults
    const {
      tone = 'professional',
      length = 'medium',
      focus = 'demo',
      customInstruction = '',
      isVariant = false
    } = options;

    // Map length to word count
    const lengthToWords: Record<string, number> = {
      short: 70,
      medium: 100,
      long: 150
    };
    const targetWordCount = lengthToWords[length] || 100;

    console.log(`Generating email for lead ${lead_id}, campaign ${campaign_id}, step ${sequence_step}`);
    console.log(`Options: tone=${tone}, length=${length}, focus=${focus}, isVariant=${isVariant}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Lead-Daten laden (alle neuen Felder)
    const { data: lead, error: leadError } = await supabase
      .from("outreach_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      throw new Error("Lead nicht gefunden");
    }

    // Kampagnen-Daten laden
    const { data: campaign, error: campaignError } = await supabase
      .from("outreach_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found:", campaignError);
      throw new Error("Kampagne nicht gefunden");
    }

    // Hiring-Signale parsen
    const hiringSignals = lead.hiring_signals || [];
    const latestHiring = getLatestHiring(hiringSignals);
    
    // Job Change Data parsen
    const jobChangeData = lead.job_change_data || {};
    const hasRecentJobChange = isRecent(jobChangeData.date, 90);
    
    // Location Move Data parsen
    const locationMoveData = lead.location_move_data || {};
    const hasRecentMove = isRecent(locationMoveData.date, 90);

    // Vollständige Variablen für AI-Personalisierung (80+)
    const availableVariables: Record<string, any> = {
      // === PERSON (Basis) ===
      first_name: lead.first_name,
      last_name: lead.last_name,
      full_name: lead.first_name && lead.last_name 
        ? `${lead.first_name} ${lead.last_name}` 
        : lead.contact_name,
      contact_name: lead.contact_name,
      contact_email: lead.contact_email,
      job_title: lead.contact_role,
      contact_role: lead.contact_role,
      seniority: lead.seniority,
      department: lead.department,
      
      // === PERSON (Kontakt) ===
      mobile_phone: lead.mobile_phone,
      direct_phone: lead.direct_phone,
      office_phone: lead.office_phone,
      personal_linkedin_url: lead.personal_linkedin_url,
      education: lead.education,
      
      // === COMPANY (Basis) ===
      company_name: lead.company_name,
      company_alias: lead.company_alias,
      company_type: lead.company_type,
      company_description: lead.company_description,
      company_website: lead.company_website,
      company_domain: lead.company_domain || extractDomain(lead.company_website),
      company_headcount: lead.company_headcount,
      company_industries: lead.company_industries,
      company_technologies: lead.company_technologies,
      company_financials: lead.company_financials,
      company_linkedin_url: lead.company_linkedin_url,
      company_founded_year: lead.company_founded_year,
      
      // === COMPANY (Adresse) ===
      company_address_line: lead.company_address_line,
      company_city: lead.company_city,
      company_zip: lead.company_zip,
      company_state: lead.company_state,
      company_country: lead.company_country,
      
      // === HQ ===
      hq_name: lead.hq_name,
      hq_address_line: lead.hq_address_line,
      hq_city: lead.hq_city,
      hq_zip: lead.hq_zip,
      hq_state: lead.hq_state,
      hq_country: lead.hq_country,
      
      // === HIRING-SIGNALE (Trigger-relevant!) ===
      hiring_signals: hiringSignals,
      hiring_count: hiringSignals.length,
      has_hiring_signals: hiringSignals.length > 0,
      latest_hiring_title: latestHiring?.title,
      latest_hiring_url: latestHiring?.url,
      latest_hiring_location: latestHiring?.location,
      latest_hiring_date: latestHiring?.date,
      hiring_titles_all: hiringSignals.map((h: any) => h.title).filter(Boolean).join(', '),
      
      // === JOB-WECHSEL-SIGNALE (Super-Personalisierung!) ===
      has_recent_job_change: hasRecentJobChange,
      job_change_prev_company: jobChangeData.prev_company,
      job_change_prev_title: jobChangeData.prev_title,
      job_change_new_company: jobChangeData.new_company,
      job_change_new_title: jobChangeData.new_title,
      job_change_date: jobChangeData.date,
      
      // === STANDORT-WECHSEL-SIGNALE ===
      has_recent_move: hasRecentMove,
      moved_from_country: locationMoveData.from_country,
      moved_from_state: locationMoveData.from_state,
      moved_to_country: locationMoveData.to_country,
      moved_to_state: locationMoveData.to_state,
      moved_date: locationMoveData.date,
      
      // === LOCATION (Person) ===
      country: lead.country,
      region: lead.region,
      city: lead.city || lead.company_city,
      
      // === META ===
      list_name: lead.list_name,
      segment: lead.segment,
      priority: lead.priority,
      language: lead.language || 'de',
      lead_source: lead.lead_source,
      
      // === LEGACY (Rückwärtskompatibilität) ===
      industry: lead.industry,
      company_size: lead.company_size,
      recruiting_challenges: lead.recruiting_challenges,
      current_ats: lead.current_ats,
      hiring_volume: lead.hiring_volume,
      revenue_range: lead.revenue_range,
    };

    // Nur gefüllte Variablen für den Prompt
    const filledVariables = Object.entries(availableVariables)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '' && v !== false && 
              !(Array.isArray(v) && v.length === 0) &&
              !(typeof v === 'object' && Object.keys(v).length === 0))
      .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join('\n');

    // Bestimme Personalisierungsstrategie
    let suggestedStrategy = 'fallback';
    if (hiringSignals.length > 0) suggestedStrategy = 'hiring_signals';
    else if (hasRecentJobChange) suggestedStrategy = 'job_change';
    else if (lead.company_technologies?.length > 0) suggestedStrategy = 'technology';
    else if (lead.company_industries?.length > 0 || lead.industry) suggestedStrategy = 'industry';

    // User-Prompt mit vollem Kontext
    const sequenceType = sequence_step === 1 ? 'Erstkontakt' : `Follow-up ${sequence_step - 1}`;
    
    // Map tone to German descriptions
    const toneDescriptions: Record<string, string> = {
      formal: 'Sehr formell und höflich, distanzierte Ansprache mit "Sie"',
      professional: 'Professionell und sachlich, Standard-B2B-Kommunikation',
      casual: 'Locker und freundlich, nahbar aber respektvoll',
      direct: 'Direkt und auf den Punkt, kurze prägnante Sätze'
    };
    
    // Map focus to CTA types
    const focusCTAs: Record<string, string> = {
      demo: 'Eine 15-Minuten Demo anbieten: "Hätten Sie 15 Minuten für eine kurze Demo?"',
      meeting: 'Ein persönliches Gespräch/Meeting anbieten: "Wollen wir uns kurz austauschen?"',
      info: 'Weitere Informationen anbieten: "Soll ich Ihnen mehr Details zusenden?"',
      'case-study': 'Eine Erfolgsgeschichte/Case Study teilen: "Ich zeige Ihnen gerne, wie wir [ähnliches Unternehmen] geholfen haben"'
    };
    
    const userPrompt = `
KAMPAGNEN-KONTEXT:
- Ziel: ${campaign.goal}
- Zielgruppe: ${campaign.target_segment}
- Sequenz-Schritt: ${sequence_step} (${sequenceType})
- Verbotene Wörter: ${JSON.stringify(campaign.forbidden_words || [])}

GENERIERUNGS-OPTIONEN (WICHTIG!):
- Tonalität: ${tone.toUpperCase()} - ${toneDescriptions[tone] || toneDescriptions.professional}
- Ziel-Wortanzahl: ${targetWordCount} Wörter (${length === 'short' ? 'kurz und knapp' : length === 'long' ? 'ausführlicher' : 'mittellang'})
- CTA-Fokus: ${focusCTAs[focus] || focusCTAs.demo}
${isVariant ? '- VARIANTE: Dies ist eine alternative Version. Wähle einen anderen Einstieg und Ansatz als die Standard-Version.' : ''}
${customInstruction ? `- ZUSÄTZLICHE ANWEISUNG: ${customInstruction}` : ''}

EMPFOHLENE PERSONALISIERUNGSSTRATEGIE: ${suggestedStrategy}

VERFÜGBARE LEAD-DATEN:
${filledVariables}

ABSENDER:
- Name: ${campaign.sender_name}
- Signatur: ${campaign.sender_signature || 'Mit freundlichen Grüßen'}

${sequence_step > 1 ? `
WICHTIG: Dies ist ein Follow-up. Beziehe dich kurz auf die vorherige E-Mail, ohne aufdringlich zu sein. Variiere den Ansatz leicht.
` : ''}

${hiringSignals.length > 0 ? `
🎯 PROBLEM ERKANNT - HIRING-BEDARF (HÖCHSTE PRIORITÄT!):
Das Unternehmen sucht aktuell ${hiringSignals.length} Stelle(n):
${hiringSignals.map((h: any, i: number) => `  ${i + 1}. ${h.title || 'Position'} ${h.location ? `in ${h.location}` : ''}`).join('\n')}

DEIN ANSATZ:
- Beziehe dich auf die konkrete(n) Stelle(n)
- Zeige dass unsere Recruiter bereits passende Kandidaten haben
` : ''}

${hasRecentJobChange ? `
🎯 PROBLEM ERKANNT - NEUE FÜHRUNGSKRAFT:
${lead.contact_name || 'Die Person'} ist kürzlich ${jobChangeData.new_title ? `als ${jobChangeData.new_title}` : ''} zu ${jobChangeData.new_company || lead.company_name} gewechselt.
${jobChangeData.prev_company ? `Vorher: ${jobChangeData.prev_company}${jobChangeData.prev_title ? ` als ${jobChangeData.prev_title}` : ''}` : ''}

DEIN ANSATZ:
- Gratuliere zur neuen Rolle
- Biete Unterstützung beim Teamaufbau
` : ''}

${!hiringSignals.length && !hasRecentJobChange && lead.company_technologies?.length > 0 ? `
🎯 PROBLEM ERKANNT - TECH-UNTERNEHMEN:
Das Unternehmen nutzt: ${JSON.stringify(lead.company_technologies)}

DEIN ANSATZ:
- Tech-Recruiting ist komplex und zeitaufwändig
- Unsere Recruiter verstehen den Tech-Stack
` : ''}

${!hiringSignals.length && !hasRecentJobChange && !lead.company_technologies?.length ? `
FALLBACK-ANSATZ:
Wenig spezifische Daten verfügbar. Nutze:
- Branche/Industrie wenn bekannt
- Allgemeine Recruiting-Herausforderungen
` : ''}

Generiere jetzt eine E-Mail die:
1. Das identifizierte Problem anspricht
2. Unsere Plattform als Lösung positioniert
3. Mit dem gewünschten CTA endet (${focus})
4. Die gewünschte Tonalität (${tone}) und Länge (~${targetWordCount} Wörter) einhält
`;

    console.log("Calling Lovable AI with strategy:", suggestedStrategy);
    console.log("Variables count:", Object.keys(availableVariables).filter(k => availableVariables[k]).length);

    // AI-Generierung via Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT.replace("{max_words}", String(campaign.max_word_count)) },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error("AI-Generierung fehlgeschlagen");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    console.log("AI Response received:", content?.substring(0, 200));

    // JSON aus Response extrahieren
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No valid JSON in AI response:", content);
      throw new Error("Kein valides JSON in AI-Antwort");
    }

    const emailData = JSON.parse(jsonMatch[0]);

    // Qualitätsprüfung
    const forbiddenWords = campaign.forbidden_words || [];
    const foundForbidden = forbiddenWords.filter((word: string) =>
      emailData.body.toLowerCase().includes(word.toLowerCase()) ||
      emailData.subject.toLowerCase().includes(word.toLowerCase())
    );

    if (foundForbidden.length > 0) {
      console.warn("Verbotene Wörter gefunden:", foundForbidden);
      emailData.confidence_level = "niedrig";
    }

    const wordCount = emailData.body.split(/\s+/).length;
    if (wordCount > campaign.max_word_count) {
      console.warn(`Wortanzahl überschritten: ${wordCount}/${campaign.max_word_count}`);
      emailData.confidence_level = "niedrig";
    }

    // E-Mail in Datenbank speichern
    const { data: savedEmail, error: saveError } = await supabase
      .from("outreach_emails")
      .insert({
        lead_id,
        campaign_id,
        subject: emailData.subject,
        body: emailData.body,
        used_variables: emailData.used_variables,
        confidence_level: emailData.confidence_level,
        sequence_step,
        status: "review",
        generation_prompt: userPrompt,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving email:", saveError);
      throw saveError;
    }

    console.log(`Email generated and saved: ${savedEmail.id}`);
    console.log(`Strategy used: ${emailData.personalization_strategy || suggestedStrategy}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: savedEmail,
        quality_check: {
          forbidden_words_found: foundForbidden,
          word_count: wordCount,
          max_words: campaign.max_word_count,
          personalization_strategy: emailData.personalization_strategy || suggestedStrategy,
          variables_used: emailData.used_variables?.length || 0,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error generating email:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
