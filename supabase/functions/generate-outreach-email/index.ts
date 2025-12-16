import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ TYPES ============

type TriggerType = 'hiring' | 'transition' | 'technology' | 'growth' | 'role';
type RoleContext = 'cto' | 'hr' | 'founder' | 'manager' | 'other';
type ConfidenceLevel = 'high' | 'medium' | 'low';

interface TriggerDecision {
  primary: TriggerType;
  secondary?: TriggerType;
  problem: string;
  opener: string;
  roleContext: RoleContext;
  confidence: ConfidenceLevel;
  details: Record<string, any>;
}

interface RoleLanguage {
  focus: string;
  keywords: string[];
  painPoints: string[];
}

// ============ HELPER FUNCTIONS ============

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

function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 999;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

function getLatestHiring(signals: any[] | null): any | null {
  if (!signals || signals.length === 0) return null;
  const withDates = signals.filter(s => s.date);
  if (withDates.length === 0) return signals[0];
  return withDates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

// ============ ROLE DETECTION ============

function detectRole(jobTitle: string | null | undefined): RoleContext {
  if (!jobTitle) return 'other';
  const title = jobTitle.toLowerCase();
  
  // CTO / Tech Leadership
  if (title.includes('cto') || title.includes('chief technology') || 
      title.includes('vp engineering') || title.includes('head of engineering') ||
      title.includes('technical director') || title.includes('engineering director')) {
    return 'cto';
  }
  
  // HR / People / Talent
  if (title.includes('hr') || title.includes('human resource') || 
      title.includes('people') || title.includes('talent') ||
      title.includes('recruiting') || title.includes('recruiter')) {
    return 'hr';
  }
  
  // Founder / CEO / C-Level
  if (title.includes('founder') || title.includes('ceo') || 
      title.includes('chief executive') || title.includes('geschäftsführer') ||
      title.includes('owner') || title.includes('inhaber') ||
      title.includes('coo') || title.includes('chief operating')) {
    return 'founder';
  }
  
  // Manager
  if (title.includes('manager') || title.includes('head of') || 
      title.includes('director') || title.includes('lead') ||
      title.includes('leiter')) {
    return 'manager';
  }
  
  return 'other';
}

// ============ ROLE-BASED LANGUAGE ============

function getRoleLanguage(role: RoleContext): RoleLanguage {
  switch (role) {
    case 'cto':
      return {
        focus: 'Tech-Qualität, Team-Velocity, technisches Verständnis',
        keywords: ['Tech-Expertise', 'passende Skills', 'technisches Verständnis', 'Engineering-Kultur'],
        painPoints: ['Zeit für Screening', 'falsche Tech-Matches', 'langsame Prozesse']
      };
    case 'hr':
      return {
        focus: 'Prozess-Entlastung, Kandidatenqualität, Verlässlichkeit',
        keywords: ['Entlastung', 'vorgeprüfte Kandidaten', 'strukturierter Prozess', 'schnelle Besetzung'],
        painPoints: ['Zeitaufwand', 'zu viele unpassende Bewerbungen', 'lange Time-to-Hire']
      };
    case 'founder':
      return {
        focus: 'Wachstum, Zeit-Fokus, Skalierung',
        keywords: ['schnell skalieren', 'Zeit für Wichtiges', 'Wachstum ermöglichen', 'Team aufbauen'],
        painPoints: ['keine Zeit für Recruiting', 'Fokus auf Kerngeschäft', 'schnelles Wachstum']
      };
    case 'manager':
      return {
        focus: 'Team-Performance, passende Verstärkung, Effizienz',
        keywords: ['Team verstärken', 'passende Ergänzung', 'schnelle Unterstützung'],
        painPoints: ['offene Stelle belastet Team', 'Projekte verzögern sich']
      };
    default:
      return {
        focus: 'Effizienz, Qualität',
        keywords: ['passende Kandidaten', 'schnelle Ergebnisse'],
        painPoints: ['Recruiting-Aufwand']
      };
  }
}

// ============ PREMIUM TRIGGER DECISION (DETERMINISTIC!) ============

function decideTrigger(lead: any): TriggerDecision {
  const hiringSignals = lead.hiring_signals || [];
  const jobChangeData = lead.job_change_data || {};
  const hasRecentJobChange = isRecent(jobChangeData.date, 90);
  const daysJobChange = daysSince(jobChangeData.date);
  const technologies = lead.company_technologies || [];
  const headcount = lead.company_headcount || 0;
  const roleContext = detectRole(lead.contact_role);
  const contactName = lead.first_name || lead.contact_name?.split(' ')[0] || '';
  const companyName = lead.company_name || '';
  
  // ═══════════════════════════════════════════════════════════════
  // PRIORITÄT 1: HIRING-DRUCK (höchste Conversion!)
  // ═══════════════════════════════════════════════════════════════
  if (hiringSignals.length > 0) {
    const latestHiring = getLatestHiring(hiringSignals);
    const hiringTitles = hiringSignals.map((h: any) => h.title).filter(Boolean);
    const titlesText = hiringTitles.slice(0, 3).join(', ');
    
    let opener = '';
    let problem = '';
    
    if (hiringSignals.length >= 3) {
      opener = `${hiringSignals.length} offene Stellen bei ${companyName} – darunter ${latestHiring?.title || 'Schlüsselpositionen'}. In 60 Sekunden an hunderte spezialisierte Recruiter übergeben?`;
      problem = `Sucht ${hiringSignals.length} Stellen parallel: ${titlesText}`;
    } else if (hiringSignals.length === 2) {
      opener = `Sie suchen einen ${hiringTitles[0]} und ${hiringTitles[1]}. Genau solche Profile haben unsere Recruiter im Netzwerk.`;
      problem = `Sucht 2 Stellen: ${titlesText}`;
    } else {
      opener = `Sie suchen aktuell einen ${latestHiring?.title || 'Mitarbeiter'}${latestHiring?.location ? ` in ${latestHiring.location}` : ''} – genau solche Profile haben unsere Recruiter im Netzwerk.`;
      problem = `Sucht ${latestHiring?.title || 'neue Mitarbeiter'}`;
    }
    
    // Check for secondary trigger
    let secondary: TriggerType | undefined;
    if (hasRecentJobChange && daysJobChange <= 60) {
      secondary = 'transition';
    } else if (technologies.length > 2) {
      secondary = 'technology';
    }
    
    return {
      primary: 'hiring',
      secondary,
      problem,
      opener,
      roleContext,
      confidence: 'high',
      details: { hiringCount: hiringSignals.length, latestTitle: latestHiring?.title, titles: hiringTitles }
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIORITÄT 2: TRANSITION (hoher psychologischer Hebel!)
  // ═══════════════════════════════════════════════════════════════
  if (hasRecentJobChange) {
    const newTitle = jobChangeData.new_title || lead.contact_role;
    const newCompany = jobChangeData.new_company || companyName;
    
    let opener = '';
    let problem = '';
    
    if (daysJobChange <= 30) {
      opener = `Herzlichen Glückwunsch zum Start bei ${newCompany}! Die ersten Wochen sind entscheidend – brauchen Sie schnell passende Leute?`;
      problem = `Neuer ${newTitle} (${daysJobChange} Tage) – baut Team auf`;
    } else if (daysJobChange <= 60) {
      opener = `Als neuer ${newTitle} bei ${newCompany} wollen Sie sicher Ihr Team schnell aufbauen. Genau dabei helfen wir.`;
      problem = `Kürzlich ${newTitle} geworden – Team-Aufbau läuft`;
    } else {
      opener = `Nach dem Wechsel zu ${newCompany} stehen viele vor der Frage: Wie schnell das richtige Team finden?`;
      problem = `Vor ${daysJobChange} Tagen gewechselt – potentieller Hiring-Bedarf`;
    }
    
    return {
      primary: 'transition',
      secondary: technologies.length > 2 ? 'technology' : undefined,
      problem,
      opener,
      roleContext,
      confidence: daysJobChange <= 30 ? 'high' : 'medium',
      details: { newTitle, newCompany, daysSinceChange: daysJobChange }
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIORITÄT 3: TECHNOLOGIE (Spezialisierung = Vertrauen)
  // ═══════════════════════════════════════════════════════════════
  if (technologies.length > 0) {
    const techList = Array.isArray(technologies) ? technologies.slice(0, 3).join(', ') : technologies;
    
    const opener = `Für ${techList}-Positionen sind spezialisierte Recruiter Gold wert. Unsere Tech-Recruiter verstehen den Stack.`;
    const problem = `Tech-Company mit ${technologies.length} Technologien – spezialisiertes Recruiting nötig`;
    
    return {
      primary: 'technology',
      secondary: headcount >= 100 ? 'growth' : undefined,
      problem,
      opener,
      roleContext,
      confidence: 'medium',
      details: { technologies: techList, techCount: technologies.length }
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIORITÄT 4: WACHSTUMSPHASE (Company-Kontext)
  // ═══════════════════════════════════════════════════════════════
  if (headcount >= 50 && headcount <= 500) {
    let phase = '';
    if (headcount < 100) phase = 'Scale-up Phase';
    else if (headcount < 250) phase = 'Wachstumsphase';
    else phase = 'Skalierungsphase';
    
    const opener = `In wachsenden Teams Ihrer Größe sehen wir: Recruiting wird schnell zum Engpass. Wir lösen das.`;
    const problem = `${companyName} (${headcount} MA) in ${phase} – skalierbare Recruiting-Kapazität nötig`;
    
    return {
      primary: 'growth',
      problem,
      opener,
      roleContext,
      confidence: 'medium',
      details: { headcount, phase }
    };
  }
  
  // ═══════════════════════════════════════════════════════════════
  // PRIORITÄT 5: ROLLE (Fallback – aber immer noch relevant!)
  // ═══════════════════════════════════════════════════════════════
  const roleLanguage = getRoleLanguage(roleContext);
  let opener = '';
  let problem = '';
  
  switch (roleContext) {
    case 'cto':
      opener = `Tech-Talente zu finden ist zeitaufwändig. Unsere Tech-Recruiter nehmen Ihnen das ab – mit echtem technischen Verständnis.`;
      problem = `CTO/Tech-Lead – typische Recruiting-Herausforderungen im Tech-Bereich`;
      break;
    case 'hr':
      opener = `Recruiting ist Ihr Job – aber muss jede Stelle intern besetzt werden? Unsere Recruiter liefern vorgeprüfte Kandidaten.`;
      problem = `HR/Talent – potentielle Entlastung bei Recruiting-Aufwand`;
      break;
    case 'founder':
      opener = `Als Gründer ist Ihre Zeit kostbar. Recruiting sollte nicht Ihr Hauptjob sein – übergeben Sie es in 60 Sekunden an Experten.`;
      problem = `Founder/CEO – Zeit-Fokus auf Kerngeschäft statt Recruiting`;
      break;
    default:
      opener = `Recruiting ist Zeitfresser #1 für wachsende Unternehmen. In 60 Sekunden an hunderte Recruiter übergeben – klingt das interessant?`;
      problem = `Allgemeiner Recruiting-Bedarf vermutet`;
  }
  
  return {
    primary: 'role',
    problem,
    opener,
    roleContext,
    confidence: 'low',
    details: { roleType: roleContext, painPoints: roleLanguage.painPoints }
  };
}

// ============ FOCUSED SYSTEM PROMPT ============

function buildFocusedPrompt(trigger: TriggerDecision, roleLanguage: RoleLanguage): string {
  return `Du schreibst Premium B2B-Outreach-E-Mails für eine Recruiting-Plattform.

UNSER USP (baue EINEN dieser Punkte ein):
• In 60 Sekunden Job an hunderte spezialisierte Recruiter übergeben
• Passende Kandidaten schnell & qualitativ  
• Nur zahlen bei Erfolg (Pay per Placement)

═══════════════════════════════════════════════════════════════
GOLDENE REGEL: 1 Lead → 1 Haupttrigger → max. 1 Nebentrigger
═══════════════════════════════════════════════════════════════
Nutze NUR den angegebenen Trigger. Keine weiteren Personalisierungen!
Alles andere ist Dekoration und wirkt konstruiert.

E-MAIL-STRUKTUR (strikt einhalten):

1️⃣ KONTEXT-SATZ (Trigger):
   Nutze den vorgegebenen Opener oder variiere ihn leicht.
   Zeigt: "Ich verstehe deine Situation"

2️⃣ RELEVANZ-SATZ (Problem):
   "Gerade bei X sehen wir häufig..." oder "Das kostet Zeit..."
   Zeigt: "Ich kenne dein Problem"

3️⃣ POSITIONIERUNG (USP):
   "Unsere Recruiter..." / "In 60 Sekunden..."
   Zeigt: "Wir haben die Lösung"

4️⃣ MINIMALER CTA:
   "Macht ein kurzer Austausch Sinn?" oder "15 Minuten diese Woche?"
   Kein Druck, nur Angebot.

WORTLIMIT: Maximal 120 Wörter. Nicht verhandelbar.

TONALITÄT FÜR ${trigger.roleContext.toUpperCase()}:
Fokus: ${roleLanguage.focus}
Nutze Wörter wie: ${roleLanguage.keywords.join(', ')}

SPRACHSTIL:
• Deutsch, professionelles B2B
• Kurze, klare Sätze
• Höflich, aber nicht unterwürfig
• Keine Floskeln ("Ich hoffe...")
• Keine Emojis, keine Ausrufezeichen

VERBOTEN:
• Mehrere Personalisierungen mischen
• Verkaufsdruck ("jetzt", "dringend")
• Superlative ("beste", "einzigartige")
• Über 120 Wörter

OUTPUT (JSON):
{
  "subject": "Max 7 Wörter, Bezug auf konkretes Problem",
  "body": "Die E-Mail (max 120 Wörter)",
  "used_variables": ["liste_genutzter_variablen"],
  "confidence_level": "hoch | mittel | niedrig"
}`;
}

// ============ USER PROMPT (SINGLE TRIGGER) ============

function buildUserPrompt(lead: any, campaign: any, trigger: TriggerDecision, options: any): string {
  const contactName = lead.first_name || lead.contact_name?.split(' ')[0] || 'Kontakt';
  const lastName = lead.last_name || lead.contact_name?.split(' ').slice(1).join(' ') || '';
  
  let prompt = `
═══════════════════════════════════════════════════════════════
ENTSCHIEDENER TRIGGER (nicht ändern!)
═══════════════════════════════════════════════════════════════

Typ: ${trigger.primary.toUpperCase()}
Konfidenz: ${trigger.confidence}

🎯 ERKANNTES PROBLEM:
"${trigger.problem}"

💡 VORGESCHLAGENER OPENER (nutze oder adaptiere):
"${trigger.opener}"
`;

  if (trigger.secondary) {
    prompt += `
OPTIONALER NEBENTRIGGER (sanft einbauen, nicht dominant):
${trigger.secondary.toUpperCase()}
`;
  }

  prompt += `
═══════════════════════════════════════════════════════════════
EMPFÄNGER
═══════════════════════════════════════════════════════════════

Name: ${contactName} ${lastName}
Anrede: ${lastName ? `Herr/Frau ${lastName}` : contactName}
Rolle: ${lead.contact_role || 'nicht angegeben'} (${trigger.roleContext})
Firma: ${lead.company_name}
${lead.company_city ? `Standort: ${lead.company_city}` : ''}
${lead.company_headcount ? `Größe: ${lead.company_headcount} Mitarbeiter` : ''}

═══════════════════════════════════════════════════════════════
ABSENDER
═══════════════════════════════════════════════════════════════

Name: ${campaign.sender_name}
Signatur: ${campaign.sender_signature || 'Mit freundlichen Grüßen'}

═══════════════════════════════════════════════════════════════
ANWEISUNGEN
═══════════════════════════════════════════════════════════════

• Nutze NUR den angegebenen Trigger
• Max 120 Wörter
• Struktur einhalten: Kontext → Relevanz → USP → CTA
${options.customInstruction ? `• Zusätzlich: ${options.customInstruction}` : ''}

Generiere jetzt die E-Mail.`;

  return prompt;
}

// ============ MAIN SERVER ============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lead_id, campaign_id, sequence_step = 1, options = {} } = await req.json();
    const { customInstruction = '', isVariant = false } = options;

    console.log(`[Premium Trigger] Generating email for lead ${lead_id}, campaign ${campaign_id}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load lead data
    const { data: lead, error: leadError } = await supabase
      .from("outreach_leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      console.error("Lead not found:", leadError);
      throw new Error("Lead nicht gefunden");
    }

    // Load campaign data
    const { data: campaign, error: campaignError } = await supabase
      .from("outreach_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      console.error("Campaign not found:", campaignError);
      throw new Error("Kampagne nicht gefunden");
    }

    // ═══════════════════════════════════════════════════════════════
    // DETERMINISTIC TRIGGER DECISION (no AI, pure logic!)
    // ═══════════════════════════════════════════════════════════════
    const trigger = decideTrigger(lead);
    const roleLanguage = getRoleLanguage(trigger.roleContext);

    console.log(`[Premium Trigger] Decision: ${trigger.primary.toUpperCase()} (${trigger.confidence})`);
    console.log(`[Premium Trigger] Problem: ${trigger.problem}`);
    console.log(`[Premium Trigger] Role: ${trigger.roleContext}`);

    // Build focused prompts
    const systemPrompt = buildFocusedPrompt(trigger, roleLanguage);
    const userPrompt = buildUserPrompt(lead, campaign, trigger, options);

    // AI Generation via Lovable AI
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI Gateway error:", errorText);
      throw new Error("AI-Generierung fehlgeschlagen");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    console.log("[Premium Trigger] AI Response received:", content?.substring(0, 200));

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No valid JSON in AI response:", content);
      throw new Error("Kein valides JSON in AI-Antwort");
    }

    const emailData = JSON.parse(jsonMatch[0]);

    // Quality check
    const forbiddenWords = campaign.forbidden_words || [];
    const foundForbidden = forbiddenWords.filter((word: string) =>
      emailData.body.toLowerCase().includes(word.toLowerCase()) ||
      emailData.subject.toLowerCase().includes(word.toLowerCase())
    );

    if (foundForbidden.length > 0) {
      console.warn("[Premium Trigger] Verbotene Wörter gefunden:", foundForbidden);
      emailData.confidence_level = "niedrig";
    }

    const wordCount = emailData.body.split(/\s+/).length;
    if (wordCount > 120) {
      console.warn(`[Premium Trigger] Wortanzahl überschritten: ${wordCount}/120`);
      emailData.confidence_level = "niedrig";
    }

    // Save email with trigger tracking
    const { data: savedEmail, error: saveError } = await supabase
      .from("outreach_emails")
      .insert({
        lead_id,
        campaign_id,
        subject: emailData.subject,
        body: emailData.body,
        used_variables: emailData.used_variables,
        confidence_level: emailData.confidence_level || trigger.confidence === 'high' ? 'hoch' : trigger.confidence === 'medium' ? 'mittel' : 'niedrig',
        sequence_step,
        status: "review",
        generation_prompt: userPrompt,
        // NEW: Trigger tracking fields
        trigger_type: trigger.primary,
        trigger_secondary: trigger.secondary || null,
        trigger_problem: trigger.problem,
        trigger_confidence: trigger.confidence,
        recipient_role: trigger.roleContext,
      })
      .select()
      .single();

    if (saveError) {
      console.error("Error saving email:", saveError);
      throw saveError;
    }

    console.log(`[Premium Trigger] Email saved: ${savedEmail.id}`);
    console.log(`[Premium Trigger] Trigger: ${trigger.primary} | Role: ${trigger.roleContext} | Confidence: ${trigger.confidence}`);

    return new Response(
      JSON.stringify({
        success: true,
        email: savedEmail,
        trigger_analysis: {
          primary: trigger.primary,
          secondary: trigger.secondary,
          problem: trigger.problem,
          role: trigger.roleContext,
          confidence: trigger.confidence,
          details: trigger.details,
        },
        quality_check: {
          forbidden_words_found: foundForbidden,
          word_count: wordCount,
          max_words: 120,
          variables_used: emailData.used_variables?.length || 0,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[Premium Trigger] Error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
