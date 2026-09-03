import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, AiError } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * intake-questions — voll-KI-dynamisches Briefing (ULTIMATE_INTAKE_PLAN Phase 2).
 *
 * STATELESS: kein DB-Zugriff, kein Service-Role. Input = aktueller Job-Entwurf
 * + bisherige Antworten; Output = nächste Fragen + normalisierte Felder.
 * Der Client persistiert selbst per eigenem JWT (RLS deckt es).
 *
 * Encodiert die Orchestrierung aus dem Plan:
 * - Fork auf contract_type (Festanstellung vs. Contracting)
 * - Gate auf Seniorität/search_difficulty (drängt, Muss-Liste zu kürzen)
 * - Tension-Flags (Anforderungen vs. Budget vs. Markt)
 * - De-Anonymisierungs-Guardrail (Green-/Red-List für den Recruiter-Text)
 * - Frage-Ökonomie: Pflichtblöcke zuerst (Muss-Kriterien, Reveal/Protect,
 *   Ziel-/No-Go-Firmen), max. wenige, hochwertige Fragen pro Runde
 */

interface AnsweredQuestion {
  id: string;
  chapter: string;
  question: string;
  answer: string; // "__unknown__" = "Weiß ich nicht"
}

interface RequestBody {
  contract_type: 'full-time' | 'freelance';
  job_draft: Record<string, unknown>;
  answers: AnsweredQuestion[];
  asked_ids: string[];
  max_questions?: number;
}

const CHAPTERS = [
  'Rolle & Scope',
  'Muss & Kann & Anti-Profil',
  'Harte K.O.-Kriterien',
  'Vergütung & Flexibilität',
  'Arbeitsmodell & Kultur',
  'Timing & Vertrag',
  'Sell & Story (EVP)',
  'Prozess & Entscheider',
  'Sourcing-Hinweise',
  'Risiken & Ehrlichkeit',
  'Triple-Blind & Reveal',
];

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    next_questions: {
      type: 'array',
      description: 'Die 1-3 wertvollsten nächsten Fragen. Leer, wenn das Briefing vollständig genug ist.',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'stabiler snake_case-Schlüssel, z.B. comp_ceiling' },
          chapter: { type: 'string', enum: CHAPTERS },
          question: { type: 'string', description: 'Die Frage, Sie-Form, konkret auf DIESEN Job bezogen' },
          why: { type: 'string', description: '1 Satz: warum diese Frage den Recruitern hilft' },
          chips: { type: 'array', items: { type: 'string' }, description: '2-6 kurze, wahrscheinliche Antwortoptionen' },
          multi: {
            type: 'boolean',
            description: 'true, wenn die Frage eine Aufzaehlung verlangt und mehrere '
              + 'Chips zugleich zutreffen koennen (z.B. "welche 3 Hauptaufgaben", '
              + '"welche Benefits", "welche Systeme"). false bei Entweder-oder-Fragen.',
          },
        },
        required: ['id', 'chapter', 'question', 'chips'],
      },
    },
    weighted_completeness: { type: 'integer', description: '0-100, gewichtet: Pflichtblöcke (Muss-Kriterien, K.O., Vergütung, Reveal) zählen doppelt' },
    chapter_progress: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chapter: { type: 'string', enum: CHAPTERS },
          state: { type: 'string', enum: ['done', 'partial', 'open', 'skipped'] },
        },
        required: ['chapter', 'state'],
      },
    },
    typed_fields: {
      type: 'object',
      description: 'Normalisierte Matching-Felder, NUR wenn aus Antworten ableitbar',
      properties: {
        visa_sponsorship: { type: 'boolean' },
        experience_min: { type: 'integer' },
        experience_max: { type: 'integer' },
        onsite_required: { type: 'boolean' },
        search_difficulty: { type: 'string', enum: ['low', 'medium', 'high'] },
        required_languages: {
          type: 'array',
          items: { type: 'object', properties: { code: { type: 'string' }, minLevel: { type: 'string' } }, required: ['code', 'minLevel'] },
        },
        required_certifications: { type: 'array', items: { type: 'string' } },
        target_companies: { type: 'array', items: { type: 'string' } },
        nogo_companies: { type: 'array', items: { type: 'string' } },
      },
    },
    skill_requirements: {
      type: 'array',
      description: 'Muss/Kann als strukturierte Anforderungen',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          kind: { type: 'string', enum: ['must', 'nice'] },
          min_years: { type: 'integer' },
          proficiency: { type: 'string' },
          recency: { type: 'string' },
        },
        required: ['skill', 'kind'],
      },
    },
    skill_suggestions: {
      type: 'array',
      description:
        'Skills, die zu dieser Rolle typischerweise gehoeren, aber im Entwurf NOCH NICHT stehen. '
        + 'Vorschlaege zum Anklicken, keine Behauptungen -- der Kunde entscheidet.',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          // Warum dieser Vorschlag: erlaubt dem Kunden, ihn in einer Sekunde
          // zu beurteilen, statt eine Liste unbegruendeter Woerter zu sehen.
          because: { type: 'string', description: 'Kurz: warum passt das hier? Max. 8 Woerter.' },
          kind: { type: 'string', enum: ['must', 'nice'] },
        },
        required: ['skill', 'because'],
      },
    },
    intake_payload_patch: { type: 'object', description: 'Narrative Erkenntnisse aus den letzten Antworten (recruiter-privat), snake_case-Keys' },
    reveal_envelope_patch: {
      type: 'object',
      properties: {
        descriptor: { type: 'string', description: 'anonymer Firmen-Descriptor, z.B. "Cloud-Beratung, 200 MA, Rhein-Main"' },
        green_list: { type: 'array', items: { type: 'string' }, description: 'darf anonym genannt werden' },
        red_list: { type: 'array', items: { type: 'string' }, description: 'würde die Firma de-anonymisieren — NIE in Recruiter-Texte' },
      },
    },
    tension_flags: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          message: {
            type: 'string',
            description: 'Der Zielkonflikt in EINEM Satz, hoechstens 25 Woerter. Nenne die EINE '
              + 'Zahl und den EINEN Punkt, der klemmt. KEINE Aufzaehlung aller Kriterien, keine '
              + 'Wiederholung von Titel, Sprache, Herkunftsfirmen. Beispiel: '
              + '"140-160k ist fuer fuenf Jahre Channel-Aufbau plus Compliance-Verantwortung knapp."',
          },
          suggestion: {
            type: 'string',
            description: 'Der Hebel in EINEM Satz, hoechstens 20 Woerter, beginnt mit einem Verb. '
              + 'Nennt eine konkrete Alternative, nicht "pruefen Sie". Beispiel: '
              + '"Decke auf 175k anheben -- oder Compliance-Verantwortung zu Kann machen."',
          },
          move_skill_to_nice: { type: 'string', description: 'falls der Vorschlag ist, genau diesen Skill zu "Kann" zu verschieben' },
        },
        required: ['id', 'message', 'suggestion'],
      },
    },
  },
  required: ['next_questions', 'weighted_completeness', 'chapter_progress'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { contract_type, job_draft, answers = [], asked_ids = [], max_questions = 2 } = body;

    if (!job_draft) {
      return new Response(JSON.stringify({ error: 'job_draft required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Du bist der beste Recruiting-Briefing-Experte im DACH-Raum und führst die Jobaufnahme für eine Triple-Blind-Recruiting-Plattform (Kandidaten anonym bis Opt-In, Firma anonym gegenüber Recruitern bis Reveal).

DEINE AUFGABE: Entscheide, welche ${max_questions} Fragen JETZT den größten Wert für gezieltes, blindes Sourcing haben — und normalisiere alles bereits Beantwortete in strukturierte Felder.

DIE 11 KAPITEL: ${CHAPTERS.join(' · ')}

REGELN:
1. FORK: contract_type="${contract_type}". Bei "freelance" gelten Tagessatz/Dauer/Verlängerung/Auslastung statt Gehalt/Karrierepfad; frage danach.
2. PFLICHT VOR KÜR — diese Themen MÜSSEN abgedeckt sein, bevor du Kür-Fragen stellst:
   a) DIE ROLLE KONKRET: Welche 3 Aufgaben füllen die Woche? Woran arbeitet die Person in den ersten 3 Monaten (konkretes Projekt)? Hands-on-Anteil vs. Steuern? Woran wird nach 12 Monaten Erfolg gemessen? Ein Recruiter, der das nicht weiß, sucht blind.
   b) SKILL-TIEFE: Für jeden wichtigen Muss-Skill aus dem Entwurf nachbohren, wie tief er sitzen muss (täglich genutzt, Projekte verantwortet oder selbst eingeführt?). Bei Fach-Skills (z. B. SAP FI/CO) nach Kontext fragen: welche Module/Umgebung/Größenordnung.
   c) HARTE K.O.: Sprache mit Niveau, Visa, Vor-Ort-Pflicht.
   d) VERGÜTUNGS-FLEXIBILITÄT: die echte Decke für den Top-Kandidaten.
   e) SUCHBILD: Aus welcher Rolle/welchen Firmen kommt der Ideal-Kandidat? Anti-Persona?
   f) TRIPLE-BLIND-REVEAL: was darf anonym genannt werden, was verrät die Firma.
3. GATE: Bei Senior+/vielen Muss-Kriterien/engem Budget → search_difficulty=high setzen und aktiv drängen, Muss-Kriterien zu kürzen oder Budget zu flexibilisieren (Tension-Flag mit konkretem Vorschlag).
3a. FORM DER SPANNUNG: message = ein Satz, höchstens 25 Wörter, EINE Zahl, EIN Konflikt. suggestion = ein Satz, höchstens 20 Wörter, beginnt mit einem Verb und nennt eine Alternative. Zähle NIE alle Anforderungen auf — der Kunde kennt sie. Ein Absatz, der Titel, Jahre, Herkunftsfirmen, Zielrolle und Sprachniveau aneinanderreiht, wird nicht gelesen und ändert nichts. Höchstens EIN Flag je Antwort.
4. FRAGE-QUALITÄT: Jede Frage konkret auf DIESEN Entwurf bezogen (Zahlen/Skills aus dem Entwurf zitieren), Sie-Form, mit 2-4 realistischen Antwort-Chips.
4a. EINE ODER MEHRERE ANTWORTEN: Verlangt die Frage eine Aufzählung ("welche 3 Hauptaufgaben", "welche Benefits", "welche Systeme", "was davon trifft zu"), setze multi=true und biete bis zu 6 Chips an — der Kunde kann dann mehrere anklicken. Bei Entweder-oder-Fragen ("wer entscheidet", "wie viele Gespräche") setze multi=false. Eine Frage, die drei Dinge erfragt, aber nur eine Antwort zulässt, verliert zwei Drittel der Auskunft. Niemals bereits Beantwortetes oder asked_ids erneut fragen. "Weiß ich nicht"-Antworten (__unknown__) NICHT wiederholen — Kapitel als skipped markieren.
5. DE-ANONYMISIERUNGS-GUARDRAIL: Alles, was die Firma identifizieren könnte (Name, einzigartige Produkte, exakte Adresse, "Marktführer für X in Y") gehört auf die red_list und NIE in Texte, die Recruiter sehen. Baue den anonymen Descriptor aus Branche+Größe+Region.
6. NORMALISIERUNG: Antworten in typed_fields (exakte Shapes!), skill_requirements (jeder Muss-Skill mit min_years wenn genannt), intake_payload_patch (narrativ) und reveal_envelope_patch übersetzen.
7. SKILL-VORSCHLAEGE: Nenne in skill_suggestions bis zu 6 Skills, die zu dieser Rolle
   ueblicherweise gehoeren, aber im Entwurf fehlen -- mit einer kurzen Begruendung.
   Leite sie aus dem AB, was schon dasteht: Java -> Spring Boot, Maven, JUnit;
   Kubernetes -> Docker, Helm; SAP FI -> SAP CO, Migrationserfahrung.
   Erfinde nichts Rollenfremdes und wiederhole nichts, was bereits im Entwurf steht.
   Sind keine sinnvollen Ergaenzungen erkennbar, gib eine leere Liste zurueck --
   eine schlechte Empfehlung kostet mehr Vertrauen als eine fehlende.
8. FERTIG IST FERTIG: weighted_completeness ≥ 85 und keine Pflichtlücken → next_questions = [] (leer).
9. DOKUMENT & PROFIL RESPEKTIEREN: Alles, was bereits im job_draft steht (aus der hochgeladenen Anzeige extrahiert) und alles in job_draft.company_defaults (aus dem Firmenprofil des Kunden), gilt als beantwortet — frage es NIE erneut ab. Bei vagen Angaben nur gezielt nachschärfen („Die Anzeige nennt SAP — welche Module produktiv?"). Bei Abweichungspotenzial vom Firmenstandard formuliere als Bestätigungsfrage („Ihr Standard ist hybrid mit 2 Bürotagen — gilt das auch hier?"). job_draft.flexibility zeigt je Muss-Kriterium die Verhandelbarkeit (fix/negotiable/flexible) — nutze sie für Tension-Abwägungen.

Antworte NUR mit dem JSON-Objekt gemäß Schema.`;

    const userPrompt = `JOB-ENTWURF:
${JSON.stringify(job_draft, null, 2)}

BISHERIGE ANTWORTEN (${answers.length}):
${answers.map((a) => `[${a.chapter}] ${a.question}\n→ ${a.answer === '__unknown__' ? '(weiß ich nicht)' : a.answer}`).join('\n\n') || '(noch keine)'}

BEREITS GESTELLTE FRAGE-IDS (nicht wiederholen): ${asked_ids.join(', ') || '(keine)'}`;

    // Der Anbieter steht seit dem 02.09.2026 an einer Stelle (_shared/ai.ts),
    // nicht mehr in jeder Function einzeln. Genau diese Streuung war die
    // Ursache: hier stand OpenRouter, dessen Schluessel nicht gesetzt war,
    // waehrend 28 andere Functions den Lovable-Gateway nutzten. Die
    // Fragengenerierung fiel dadurch still auf den statischen Katalog zurueck.
    let parsed: Record<string, unknown>;
    try {
      const antwort = await aiChat({
        system: systemPrompt,
        user: userPrompt,
        temperature: 0.3,
        tool: {
          name: 'next_intake_step',
          description: 'Nächste Briefing-Fragen + normalisierte Felder',
          parameters: OUTPUT_SCHEMA,
        },
      });

      const raw = antwort.toolArguments ?? antwort.content;
      if (!raw) throw new AiError('Die Antwort war leer.');
      parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
    } catch (e) {
      const detail = e instanceof AiError
        ? `${e.message}${e.detail ? ` — ${e.detail}` : ''}`
        : e instanceof Error ? e.message : String(e);
      // Den Anbieter und seinen Wortlaut protokollieren. Ein blosses
      // "AI gateway error" liess offen, ob der Schluessel fehlte, das Modell
      // unbekannt war oder das Kontingent erschoepft.
      console.error('[intake-questions] KI-Aufruf:', detail);
      return new Response(JSON.stringify({ error: 'AI gateway error', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Defensive Defaults, damit das Frontend nie an fehlenden Keys scheitert
    const result = {
      next_questions: Array.isArray(parsed.next_questions)
        ? parsed.next_questions.slice(0, max_questions).map((q: Record<string, unknown>) => ({
            ...q,
            // Ohne feste Umwandlung kaeme mal true, mal "true", mal nichts --
            // die Oberflaeche wuerde dann mal umschalten und mal sofort senden.
            multi: q.multi === true || q.multi === 'true',
          }))
        : [],
      weighted_completeness: typeof parsed.weighted_completeness === 'number' ? Math.max(0, Math.min(100, parsed.weighted_completeness)) : 0,
      chapter_progress: Array.isArray(parsed.chapter_progress) ? parsed.chapter_progress : [],
      typed_fields: parsed.typed_fields ?? {},
      skill_requirements: Array.isArray(parsed.skill_requirements) ? parsed.skill_requirements : [],
      skill_suggestions: Array.isArray(parsed.skill_suggestions)
        ? parsed.skill_suggestions.slice(0, 6) : [],
      intake_payload_patch: parsed.intake_payload_patch ?? {},
      reveal_envelope_patch: parsed.reveal_envelope_patch ?? {},
      tension_flags: Array.isArray(parsed.tension_flags) ? parsed.tension_flags : [],
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('intake-questions error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
