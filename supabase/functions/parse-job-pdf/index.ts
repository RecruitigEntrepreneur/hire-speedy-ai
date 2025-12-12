import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedJobData {
  title: string;
  company: string;
  description: string;
  requirements: string[];
  nice_to_have: string[];
  technical_skills: string[];
  soft_skills: string[];
  experience_years_min: number | null;
  experience_years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string;
  remote_policy: string;
  employment_type: string;
  benefits: string[];
  company_culture: string;
  industry: string;
  seniority_level: string;
  team_info: string;
  application_process: string;
  ai_summary: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing');
    }

    const { pdfPath, jobText } = await req.json();

    let textToAnalyze = jobText;

    // If PDF path provided, extract text first
    if (pdfPath && !jobText) {
      console.log('Extracting text from PDF:', pdfPath);
      
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('job-documents')
        .download(pdfPath);

      if (downloadError) {
        console.error('Error downloading PDF:', downloadError);
        throw new Error(`Failed to download PDF: ${downloadError.message}`);
      }

      console.log('PDF downloaded, size:', fileData.size);

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer();
      const base64Pdf = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Extract text using AI
      const extractResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'Du bist ein Experte für das Extrahieren von Text aus PDF-Dokumenten. Extrahiere den VOLLSTÄNDIGEN Text aus dem Dokument, bewahre die Struktur und alle Details. Gib NUR den extrahierten Text zurück, keine Kommentare.'
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Extrahiere den kompletten Text aus diesem Stellenanzeigen-PDF:' },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` } }
              ]
            }
          ],
          max_tokens: 8000,
          temperature: 0.1,
        }),
      });

      if (!extractResponse.ok) {
        const errorText = await extractResponse.text();
        console.error('Text extraction error:', extractResponse.status, errorText);
        
        if (extractResponse.status === 429) {
          throw new Error('AI-Service ist ausgelastet. Bitte versuche es in einem Moment erneut.');
        }
        if (extractResponse.status === 402) {
          throw new Error('AI-Credits erschöpft. Bitte kontaktiere den Support.');
        }
        throw new Error(`Textextraktion fehlgeschlagen: ${extractResponse.status}`);
      }

      const extractData = await extractResponse.json();
      textToAnalyze = extractData.choices?.[0]?.message?.content;

      if (!textToAnalyze) {
        throw new Error('Kein Text aus dem PDF extrahiert');
      }

      console.log('Text extracted, length:', textToAnalyze.length);
    }

    if (!textToAnalyze) {
      return new Response(
        JSON.stringify({ error: 'Entweder pdfPath oder jobText muss angegeben werden' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing job description with AI...');

    // Analyze the job description with structured output
    const analysisResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Du bist ein erfahrener HR-Experte und Recruiting-Spezialist für den deutschen Markt.
            
Deine Aufgabe ist es, Stellenanzeigen zu analysieren und strukturierte Jobprofile zu erstellen.

WICHTIGE REGELN:
1. Erkenne typische deutsche Stellenanzeigen-Formate (SAP SuccessFactors, Personio, Workday, etc.)
2. Unterscheide klar zwischen MUSS-Anforderungen und NICE-TO-HAVE
3. Extrahiere implizite Anforderungen (z.B. "dynamisches Team" = Flexibilität erforderlich)
4. Identifiziere die Unternehmenskultur aus dem Schreibstil
5. Erkenne Gehaltsbandbreiten auch wenn sie versteckt sind ("attraktives Gehalt", "übertariflich")
6. Klassifiziere das Senioritätslevel korrekt (Junior/Mid/Senior/Lead/Principal)
7. Identifiziere Remote-Policies (Full Remote, Hybrid, Vor-Ort)
8. Extrahiere Benefits und kategorisiere sie

GEHALTSERKENNUNG:
- Wenn konkrete Zahlen genannt: Extrahiere Min/Max
- Bei "VB" oder "verhandelbar": Schätze basierend auf Rolle und Erfahrung marktübliche Spanne
- Bei "übertariflich" oder "attraktiv": Gib eine marktübliche Schätzung an

OUTPUT: Erstelle ein vollständiges, für Recruiter optimiertes Jobprofil.`
          },
          {
            role: 'user',
            content: `Analysiere diese Stellenanzeige und erstelle ein detailliertes Jobprofil:\n\n${textToAnalyze}`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_job_profile',
              description: 'Erstellt ein strukturiertes Jobprofil aus einer Stellenanzeige',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Bereinigter Jobtitel' },
                  company: { type: 'string', description: 'Firmenname' },
                  description: { type: 'string', description: 'Aufbereitete Stellenbeschreibung (2-3 Sätze)' },
                  requirements: { 
                    type: 'array', 
                    items: { type: 'string' },
                    description: 'MUSS-Anforderungen (Hard Requirements)'
                  },
                  nice_to_have: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Nice-to-Have Anforderungen'
                  },
                  technical_skills: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Technische Skills (Programmiersprachen, Tools, Frameworks)'
                  },
                  soft_skills: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Soft Skills (Kommunikation, Teamarbeit, etc.)'
                  },
                  experience_years_min: { type: 'number', description: 'Minimale Berufserfahrung in Jahren' },
                  experience_years_max: { type: 'number', description: 'Maximale Berufserfahrung in Jahren' },
                  salary_min: { type: 'number', description: 'Mindestgehalt (Brutto/Jahr in EUR)' },
                  salary_max: { type: 'number', description: 'Maximalgehalt (Brutto/Jahr in EUR)' },
                  location: { type: 'string', description: 'Arbeitsort(e)' },
                  remote_policy: { 
                    type: 'string', 
                    enum: ['remote', 'hybrid', 'onsite', 'flexible'],
                    description: 'Remote-Policy'
                  },
                  employment_type: {
                    type: 'string',
                    enum: ['full-time', 'part-time', 'contract', 'freelance'],
                    description: 'Anstellungsart'
                  },
                  benefits: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Benefits und Zusatzleistungen'
                  },
                  company_culture: { type: 'string', description: 'Beschreibung der Unternehmenskultur' },
                  industry: { type: 'string', description: 'Branche des Unternehmens' },
                  seniority_level: {
                    type: 'string',
                    enum: ['junior', 'mid', 'senior', 'lead', 'principal', 'director'],
                    description: 'Senioritätslevel'
                  },
                  team_info: { type: 'string', description: 'Informationen zum Team' },
                  application_process: { type: 'string', description: 'Hinweise zum Bewerbungsprozess' },
                  ai_summary: { type: 'string', description: 'KI-generierte Zusammenfassung für Recruiter (3-4 Sätze)' }
                },
                required: ['title', 'description', 'requirements', 'technical_skills', 'ai_summary']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'create_job_profile' } }
      }),
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('Analysis error:', analysisResponse.status, errorText);
      
      if (analysisResponse.status === 429) {
        throw new Error('AI-Service ist ausgelastet. Bitte versuche es in einem Moment erneut.');
      }
      if (analysisResponse.status === 402) {
        throw new Error('AI-Credits erschöpft. Bitte kontaktiere den Support.');
      }
      throw new Error(`Analyse fehlgeschlagen: ${analysisResponse.status}`);
    }

    const analysisData = await analysisResponse.json();
    console.log('AI analysis complete');

    // Extract the parsed job data from the tool call
    const toolCall = analysisData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall || toolCall.function.name !== 'create_job_profile') {
      throw new Error('KI hat kein gültiges Jobprofil erstellt');
    }

    let parsedJob: ParsedJobData;
    try {
      parsedJob = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      throw new Error('Fehler beim Parsen der KI-Antwort');
    }

    console.log('Job profile created:', parsedJob.title);

    return new Response(
      JSON.stringify({ 
        success: true,
        data: parsedJob,
        extractedText: textToAnalyze.substring(0, 500) + '...'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in parse-job-pdf function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
