import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { spezialistenTagessatz } from "../_shared/contracting-konditionen.ts";
import { isServiceRole, requireAdmin } from "../_shared/admin-auth.ts";
import {
  ANZEIGE_FASSUNG, betragFunde, namensFunde, textDerAnzeige, verboteneBegriffe,
  type Ansprache, type Anzeige,
} from "../_shared/recruiter-anzeige.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FormattedContent {
  headline: string;
  highlights: string[];
  role_summary: string;
  ideal_candidate: string;
  selling_points: string[];
  urgency_note: string | null;
  anonymous_company_pitch: string;
  quick_facts: {
    team_size: string | null;
    growth_stage: string | null;
    culture_keywords: string[];
    interview_process: string | null;
  };
  /** Anzeige & Ansprache (29.09.2026), siehe _shared/recruiter-anzeige.ts. */
  anzeige?: Anzeige;
  ansprache?: Ansprache;
  fassung?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // entwurf: true -> in job_recruiter_text_drafts statt live in
    // jobs.formatted_content. Matchunt prüft den Entwurf im Freigabe-Dialog
    // bzw. in Admin > Jobs und übernimmt ihn selbst.
    const { jobId, entwurf } = await req.json();

    if (!jobId) return json({ error: "jobId is required" }, 400);

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Bisher konnte jeder angemeldete Nutzer den Recruiter-Text jeder Stelle
    // neu erzeugen lassen. Aufrufer ist allein der Admin (Freigabe-Dialog,
    // Admin > Jobs) oder unser eigenes Backend.
    let erzeugtVon: string | null = null;
    if (!isServiceRole(req)) {
      // Die Function hängt an supabase-js 2.49.1, admin-auth an @2 -- nur der Typ weicht ab.
      const admin = await requireAdmin(req, supabase as unknown as Parameters<typeof requireAdmin>[1]);
      if (!admin.ok) return json({ error: admin.message ?? "Keine Berechtigung." }, 403);
      erzeugtVon = admin.userId ?? null;
    }
    
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build prompt for AI formatting with ANONYMIZATION
    const prompt = `Du bist ein professioneller Recruiter-Marketing-Spezialist. Formatiere diese Stellenanzeige so, dass sie für Recruiter besonders attraktiv und übersichtlich ist.

⚠️ KRITISCH - TRIPLE-BLIND ANONYMISIERUNG:
- Nenne NIEMALS den Firmennamen "${job.company_name}" in deinen Texten!
- Ersetze alle Firmenreferenzen durch "das Unternehmen" oder "der Arbeitgeber"
- Vermeide spezifische Firmen-Produkte, Marken oder bekannte Projekte die zur Identifikation führen könnten
- Fokussiere auf die Rolle und Aufgaben, NICHT auf die Firma
- Die Branche darf genannt werden, aber keine identifizierenden Details

BEISPIEL FALSCH: "Bei Trivium eSolutions arbeiten Sie an innovativen Lösungen..."
BEISPIEL RICHTIG: "In diesem wachsenden IT-Unternehmen arbeiten Sie an innovativen Lösungen..."

STELLENINFORMATIONEN:
- Titel: ${job.title}
- Branche: ${job.industry || 'Nicht angegeben'}
- Standort: ${job.location || 'Flexibel'}
- Remote: ${job.remote_type || 'Hybrid'}
- Anstellung: ${job.employment_type || 'Vollzeit'}
- Erfahrung: ${job.experience_level || 'Mid-Level'}
${job.employment_type === 'freelance'
  ? `- Verguetung: siehe CONTRACTING unten (Tagessatz, kein Gehalt)`
  : `- Gehalt: ${job.salary_min ? `€${job.salary_min.toLocaleString()}` : 'k.A.'} - ${job.salary_max ? `€${job.salary_max.toLocaleString()}` : 'k.A.'}
- Recruiter-Fee: ${job.recruiter_fee_percentage || 15}%`}
- Unternehmensgröße: ${job.company_size_band || 'Nicht angegeben'}
- Funding-Stage: ${job.funding_stage || 'Nicht angegeben'}
- Tech-Stack: ${job.tech_environment?.join(', ') || 'Nicht angegeben'}

BESCHREIBUNG (ANONYMISIERE DIESE):
${job.description || 'Keine Beschreibung vorhanden.'}

ANFORDERUNGEN:
${job.requirements || 'Keine spezifischen Anforderungen.'}

SKILLS:
${job.skills?.join(', ') || 'Keine Skills angegeben'}

MUST-HAVES:
${job.must_haves?.join(', ') || 'Keine Must-Haves'}

NICE-TO-HAVES:
${job.nice_to_haves?.join(', ') || 'Keine Nice-to-Haves'}

${[
  '',
  'WAS DER KUNDE SELBST GESAGT HAT:',
  '',
  'Alles unter dieser Ueberschrift stammt aus der Aufnahme -- der Kunde hat es',
  'beantwortet oder bestaetigt. Es ist KEINE Vermutung. Nutze es bevorzugt vor',
  'allem, was du aus der Beschreibung ableiten koenntest. Wo hier etwas steht,',
  'erfinde nichts Eigenes daneben.',
  '',
  job.unique_selling_points?.length
    ? `- Alleinstellungsmerkmale (WOERTLICH vom Kunden, bevorzugt fuer die Selling Points):\n  ${(Array.isArray(job.unique_selling_points) ? job.unique_selling_points : [job.unique_selling_points]).join('\n  ')}`
    : null,
  job.position_advantages?.length
    ? `- Vorteile der Position, die nur ein Fachmann schaetzt:\n  ${(Array.isArray(job.position_advantages) ? job.position_advantages : [job.position_advantages]).join('\n  ')}`
    : null,
  job.daily_routine ? `- Arbeitsalltag: ${job.daily_routine}` : null,
  job.task_focus ? `- Schwerpunkt der Position: ${job.task_focus}` : null,
  job.vacancy_reason ? `- Warum die Stelle offen ist: ${job.vacancy_reason}` : null,
  job.negative_impact_if_unfilled ? `- Was passiert, wenn sie offen bleibt: ${job.negative_impact_if_unfilled}` : null,
  job.team_size != null ? `- Teamgroesse: ${job.team_size}` : null,
  job.reports_to ? `- Berichtet an: ${job.reports_to}` : null,
  job.decision_makers?.length ? `- Entscheider: ${job.decision_makers.join(', ')}` : null,
  job.success_profile ? `- Wer hier Erfolg hat: ${job.success_profile}` : null,
  job.failure_profile ? `- Wer hier gescheitert ist: ${job.failure_profile}` : null,
  job.company_culture ? `- Kultur / Zusammenarbeit: ${job.company_culture}` : null,
  job.career_path ? `- Entwicklungsmoeglichkeiten: ${job.career_path}` : null,
  job.benefits?.length ? `- Benefits (angeklickt, nicht geraten): ${job.benefits.join(', ')}` : null,
  /* Kategorie und Uhrzeit zusammen -- "Gleitzeit mit Kernzeit" allein
     beantwortet die Frage des Kandidaten nicht. */
  job.core_hours
    ? `- Arbeitszeit: ${job.core_hours}${job.core_hours_detail ? `, ${job.core_hours_detail}` : ''}`
    : null,
  job.overtime_policy ? `- Ueberstunden: ${job.overtime_policy}` : null,
  job.onsite_days_required != null ? `- Tage vor Ort pro Woche: ${job.onsite_days_required}` : null,
  job.required_languages?.length
    ? `- Sprachen: ${job.required_languages.map((l: Record<string, unknown>) => `${l.code} ${l.minLevel ?? ''}`.trim()).join(', ')}`
    : null,
  job.experience_min != null ? `- Mindesterfahrung: ${job.experience_min} Jahre` : null,
  job.contract_creation_days != null ? `- Vom Ja bis zum Vertrag: ${job.contract_creation_days} Tage` : null,
  job.industry_opportunities ? `- Chancen der Branche: ${job.industry_opportunities}` : null,
  job.industry_challenges ? `- Herausforderungen der Branche: ${job.industry_challenges}` : null,
].filter(Boolean).join('\n')}

${job.employment_type === 'freelance' ? [
  'CONTRACTING -- DIESE STELLE IST KEINE FESTANSTELLUNG:',
  '',
  'Schreibe NIEMALS von Gehalt, Jahresgehalt, Karrierepfad, Benefits im Sinne',
  'von Urlaub oder Altersvorsorge, unbefristeter Anstellung oder langfristiger',
  'Entwicklung. Die Leitwaehrung ist der Tagessatz, die Leitgroesse die',
  'Laufzeit. Formuliere die Selling Points fuer einen Freiberufler: Technik,',
  'Referenz, Entscheidungsspielraum, Aussicht auf Anschluss.',
  '',
  // Die Stelle traegt das Budget des Kunden (all-in). Recruiter und Kandidaten
  // sehen nur den Satz des Spezialisten -- das Budget darf nicht in den Text.
  job.day_rate_min || job.day_rate_max
    ? `- Tagessatz fuer den Spezialisten: ${job.day_rate_min ? `${spezialistenTagessatz(job.day_rate_min)} EUR` : 'k.A.'} bis ${job.day_rate_max ? `${spezialistenTagessatz(job.day_rate_max)} EUR` : 'k.A.'} (nenne nur diesen Satz, nie einen anderen Betrag pro Tag)`
    : '- Tagessatz: nicht angegeben -- erfinde KEINEN und schreibe auch keine Floskel wie "wettbewerbsfaehig"',
  job.contract_duration_months != null ? `- Laufzeit: ${job.contract_duration_months} Monate` : null,
  job.utilization_days_per_week != null ? `- Auslastung: ${job.utilization_days_per_week} Tage pro Woche` : null,
  typeof job.extension_possible === 'boolean'
    ? `- Verlaengerung: ${job.extension_possible ? 'moeglich' : 'nicht vorgesehen'}` : null,
  job.contract_sensitive_topics?.length
    ? `- Sensible Vertragsthemen: ${(Array.isArray(job.contract_sensitive_topics) ? job.contract_sensitive_topics : [job.contract_sensitive_topics]).join(', ')}`
    : null,
].filter(Boolean).join('\n') : ''}

Erstelle eine ansprechende Formatierung mit:
1. Eine catchy Headline (max 60 Zeichen) - OHNE Firmennamen!
2. 3-4 Key Highlights (kurze Bulletpoints, die Recruiter ansprechen)
3. Eine prägnante Rollenbeschreibung (2-3 Sätze) - ANONYMISIERT
4. Beschreibung des idealen Kandidaten (2-3 Sätze)
5. 3-5 Selling Points (Benefits, die Kandidaten überzeugen)
6. NEUE PFLICHTFELDER:
   - anonymous_company_pitch: 2-3 Sätze über das Unternehmen OHNE Firmennamen zu nennen (z.B. "Innovatives IT-Unternehmen im Benelux-Raum mit Fokus auf Enterprise-Lösungen...")
   - quick_facts: Team-Größe, Wachstumsphase, Kultur-Keywords, Interview-Prozess
7. ANZEIGE (anzeige): eine vollständige, gut lesbare Stellenanzeige, die der Headhunter einem Kandidaten schicken kann. Du-Form, sachlich-warm, keine Floskeln.
   - einleitung: 3-5 Sätze "Worum es geht" -- Aufhänger, Rolle, was sie besonders macht
   - unternehmen: 2-4 Sätze über das Unternehmen, ANONYM (Branche, Größe, Region grob, was es auszeichnet)
   - aufgaben: 4-8 konkrete Aufgaben
   - arbeitsalltag: 1-3 Sätze, wie ein typischer Tag/Woche aussieht (leer lassen, wenn nichts bekannt)
   - profil_zwingend: was zwingend nötig ist; profil_vorteil: was von Vorteil ist
   - angebot: 3-6 Punkte, was die Stelle bzw. das Projekt bietet
   - team: 1-2 Sätze zu Team und Zusammenarbeit (leer lassen, wenn nichts bekannt)
   - ablauf: Schritte des Auswahlprozesses NUR soweit aus den Angaben bekannt, sonst leeres Array
8. ANSPRACHE (ansprache): fertige Texte für den Headhunter, Du-Form
   - linkedin: Kontaktanfrage, höchstens 280 Zeichen, beginnt mit "Hallo {VORNAME},"
   - email_betreff: kurz, ohne Firmennamen
   - email_text: 4-7 Sätze, beginnt mit "Hallo {VORNAME},", endet mit der Frage nach einem kurzen Gespräch (ohne Grußformel, die setzt das System)
   - telefon: einstieg (1 Satz), argumente (3 kurze Punkte), fragen (3 Fragen zur Passung aus den Muss-Kriterien)

REGELN FÜR ANZEIGE UND ANSPRACHE:
- Schreibe KEINE Geldbeträge, keine Zahlen mit €, EUR oder "k". Wo die Vergütung genannt werden soll, schreibe genau {VERGUETUNG}. Die Zahl setzt das System ein.
- Nenne nie Honorar, Provision, Fee, Marge, Konkurrenzlage oder warum frühere Kandidaten abgesprungen sind.
- Nutze nur, was oben steht. Was nicht in den Angaben steht, lässt du weg -- lieber kürzer als erfunden.
- Kein Firmenname, keine Produkt- oder Personennamen des Kunden, keine Domain.

WICHTIG: Antworte NUR mit dem JSON-Objekt, keine anderen Texte!`;

    // Call Lovable AI Gateway
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du bist ein Experte für Recruiter-Marketing. Du erstellst ansprechende, professionelle Job-Formatierungen. Antworte immer nur mit validem JSON." },
          { role: "user", content: prompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "format_job",
              description: "Formatiere die Stellenanzeige für Recruiter - OHNE Firmennamen zu nennen!",
              parameters: {
                type: "object",
                properties: {
                  headline: { 
                    type: "string", 
                    description: "Catchy headline für die Stelle, max 60 Zeichen, OHNE Firmennamen!" 
                  },
                  highlights: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "3-4 Key Highlights als kurze Bulletpoints" 
                  },
                  role_summary: { 
                    type: "string", 
                    description: "Prägnante Rollenbeschreibung, 2-3 Sätze, ANONYMISIERT ohne Firmennamen" 
                  },
                  ideal_candidate: { 
                    type: "string", 
                    description: "Beschreibung des idealen Kandidaten, 2-3 Sätze" 
                  },
                  selling_points: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "3-5 Benefits/Selling Points" 
                  },
                  urgency_note: { 
                    type: "string", 
                    description: "Optionaler Urgency-Hinweis falls dringend" 
                  },
                  anonymous_company_pitch: {
                    type: "string",
                    description: "2-3 Sätze über das Unternehmen OHNE den Firmennamen zu nennen. Beispiel: 'Innovatives IT-Unternehmen im Benelux-Raum...'"
                  },
                  quick_facts: {
                    type: "object",
                    properties: {
                      team_size: { type: "string", description: "z.B. '5-10 Entwickler'" },
                      growth_stage: { type: "string", description: "z.B. 'Wachstumsphase', 'Etabliert', 'Startup'" },
                      culture_keywords: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "3-5 Kultur-Keywords wie 'agil', 'remote-friendly', 'international'" 
                      },
                      interview_process: { type: "string", description: "z.B. '3-stufig, ca. 2 Wochen'" }
                    },
                    required: ["growth_stage", "culture_keywords"]
                  },
                  anzeige: {
                    type: "object",
                    description: "Vollständige anonyme Stellenanzeige in Du-Form, ohne Geldbeträge (dafür {VERGUETUNG})",
                    properties: {
                      einleitung: { type: "string" },
                      unternehmen: { type: "string" },
                      aufgaben: { type: "array", items: { type: "string" } },
                      arbeitsalltag: { type: "string" },
                      profil_zwingend: { type: "array", items: { type: "string" } },
                      profil_vorteil: { type: "array", items: { type: "string" } },
                      angebot: { type: "array", items: { type: "string" } },
                      team: { type: "string" },
                      ablauf: { type: "array", items: { type: "string" } }
                    },
                    required: ["einleitung", "unternehmen", "aufgaben", "profil_zwingend", "angebot"]
                  },
                  ansprache: {
                    type: "object",
                    description: "Kurzansprachen in Du-Form mit {VORNAME} und {VERGUETUNG}, ohne Geldbeträge",
                    properties: {
                      linkedin: { type: "string", description: "max. 280 Zeichen" },
                      email_betreff: { type: "string" },
                      email_text: { type: "string" },
                      telefon: {
                        type: "object",
                        properties: {
                          einstieg: { type: "string" },
                          argumente: { type: "array", items: { type: "string" } },
                          fragen: { type: "array", items: { type: "string" } }
                        },
                        required: ["einstieg", "argumente", "fragen"]
                      }
                    },
                    required: ["linkedin", "email_betreff", "email_text", "telefon"]
                  }
                },
                required: ["headline", "highlights", "role_summary", "ideal_candidate", "selling_points", "anonymous_company_pitch", "quick_facts", "anzeige", "ansprache"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "format_job" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error("AI Gateway error");
    }

    const aiResponse = await response.json();
    
    // Extract the formatted content from tool call
    let formattedContent: FormattedContent | null = null;

    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        formattedContent = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        console.error("Error parsing tool call arguments:", parseError);
      }
    }

    // Fallback: Try to parse from content if tool call failed
    if (!formattedContent && aiResponse.choices?.[0]?.message?.content) {
      try {
        const content = aiResponse.choices[0].message.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          formattedContent = JSON.parse(jsonMatch[0]);
        }
      } catch (parseError) {
        console.error("Error parsing content:", parseError);
      }
    }

    // Generate fallback content if AI fails
    if (!formattedContent) {
      const industryContext = job.industry ? `im Bereich ${job.industry}` : '';
      const locationContext = job.location ? `in der Region ${job.location.split(',')[0]}` : '';
      
      formattedContent = {
        headline: job.title,
        highlights: [
          job.remote_type === 'remote' ? '100% Remote möglich' : `${job.location || 'Flexibler Standort'}`,
          ...(job.employment_type === 'freelance'
            ? [job.day_rate_max ? `Tagessatz bis ${spezialistenTagessatz(job.day_rate_max)} €` : 'Contracting nach Einsatztagen']
            : [
                job.salary_max ? `Gehalt bis €${job.salary_max.toLocaleString()}` : 'Wettbewerbsfähiges Gehalt',
                `${job.recruiter_fee_percentage || 15}% Recruiter-Fee`,
              ]),
        ],
        role_summary: job.description?.substring(0, 200) + '...' || 'Spannende Position mit Entwicklungsmöglichkeiten.',
        ideal_candidate: `Erfahrung auf ${job.experience_level || 'Mid'}-Level mit Skills in ${job.skills?.slice(0, 3).join(', ') || 'relevanten Technologien'}.`,
        selling_points: job.nice_to_haves?.slice(0, 5) || ['Attraktive Vergütung', 'Moderne Arbeitsumgebung', 'Entwicklungsmöglichkeiten'],
        urgency_note: null,
        anonymous_company_pitch: `Etabliertes Unternehmen ${industryContext} ${locationContext} sucht Verstärkung für das Team.`.trim(),
        quick_facts: {
          team_size: null,
          growth_stage: job.funding_stage || 'Etabliert',
          culture_keywords: ['professionell'],
          interview_process: null
        }
      };
    }

    formattedContent.fassung = ANZEIGE_FASSUNG;

    // Prüfungen für Matchunt. Sie enthalten den Firmennamen und gehören
    // deshalb NIE in formatted_content (das lesen Recruiter), nur in den
    // Entwurf, den allein Admins lesen.
    const domains: string[] = [];
    if (job.intake_draft_id) {
      const { data: d } = await supabase.from('intake_drafts')
        .select('company_domain, company_website').eq('id', job.intake_draft_id).maybeSingle();
      if (d) domains.push(d.company_domain, d.company_website);
    }
    const begriffe = verboteneBegriffe(job.company_name, job.reveal_envelope?.red_list, domains);
    const texte = textDerAnzeige(formattedContent);
    const fakten = prompt.slice(prompt.indexOf('STELLENINFORMATIONEN:'), prompt.indexOf('Erstelle eine ansprechende Formatierung'));
    const pruefung = {
      begriffe,
      namensFunde: namensFunde(texte, begriffe),
      betragFunde: betragFunde(texte),
      ohneGrundlage: await ohneGrundlage(LOVABLE_API_KEY, fakten, texte),
      erzeugtAm: new Date().toISOString(),
    };

    if (entwurf) {
      const { error: draftError } = await supabase.from('job_recruiter_text_drafts').upsert({
        job_id: jobId, content: formattedContent, pruefung, created_by: erzeugtVon, created_at: pruefung.erzeugtAm,
      }, { onConflict: 'job_id' });
      if (draftError) throw new Error(`Entwurf nicht gespeichert: ${draftError.message}`);
    } else {
      await supabase
        .from('jobs')
        .update({ formatted_content: formattedContent })
        .eq('id', jobId);
    }

    return json({ formattedContent, pruefung });

  } catch (error) {
    console.error("Error in format-job-for-recruiters:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/**
 * Belegprüfung: eine zweite KI liest Anzeige und Ansprache gegen die Angaben
 * des Kunden und nennt Sätze mit Behauptungen ohne Grundlage. Sie findet viel,
 * aber nicht garantiert alles -- deshalb liest Matchunt vor der Freigabe mit.
 * Scheitert sie, blockiert das nichts (null = nicht geprüft).
 */
async function ohneGrundlage(apiKey: string, fakten: string, texte: string[]): Promise<string[] | null> {
  if (!texte.length) return [];
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Du prüfst Stellentexte auf Tatsachenbehauptungen ohne Beleg. Antworte nur über das Werkzeug." },
          { role: "user", content: `ANGABEN DES KUNDEN:\n${fakten}\n\nTEXTE:\n${texte.map((t, i) => `[${i + 1}] ${t}`).join('\n')}\n\nNenne jeden Satz aus den TEXTEN, der eine konkrete Tatsache behauptet (Zahl, Häufigkeit, Werkzeug, Ablauf, Eigenschaft des Unternehmens), die sich NICHT aus den ANGABEN ergibt. Allgemeine Formulierungen ohne Tatsachenbehauptung und die Platzhalter {VORNAME} und {VERGUETUNG} zählen nicht. Gib die Sätze wörtlich zurück; gibt es keine, eine leere Liste.` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "ergebnis",
            parameters: {
              type: "object",
              properties: { ohne_grundlage: { type: "array", items: { type: "string" } } },
              required: ["ohne_grundlage"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "ergebnis" } },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const liste = args ? JSON.parse(args).ohne_grundlage : null;
    return Array.isArray(liste) ? liste.map(String).filter(Boolean).slice(0, 20) : null;
  } catch (e) {
    console.error("Belegprüfung fehlgeschlagen:", e);
    return null;
  }
}
