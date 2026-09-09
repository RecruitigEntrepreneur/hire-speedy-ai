import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiChat, AiError } from "../_shared/ai.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * intake-questions — die KI hinter der Jobaufnahme.
 *
 * =====================================================================
 * NEUE AUFGABENTEILUNG (04.09.2026). Die Fragen kommen aus dem Katalog.
 * =====================================================================
 * Bis heute hat diese Function die Fragen selbst erfunden und dabei in EINEM
 * Modellaufruf neun Dinge zugleich liefern sollen: naechste Fragen, Fortschritt,
 * Kapitelstaende, typisierte Felder, Skill-Anforderungen, Skill-Vorschlaege,
 * narrative Erkenntnisse, Anonymitaets-Huelle und Zielkonflikte.
 *
 * Gemessen an einer echten Stelle (FTAPI, 03.09.2026): 97 Fragen ohne
 * Abschluss, danach EIN Muss-Kriterium in der Datenbank, 56 der 97 Fragen
 * bohrten in den eigenen vorherigen Antworten, und der Fortschritt fiel im
 * selben Durchgang von 85 auf 40. Ein Modell, das neun Dinge tun soll und
 * keine Zielliste hat, tut zuverlaessig nur das leichteste davon: die naechste
 * plausible Frage stellen.
 *
 * Die Fragen stehen jetzt in src/lib/briefCatalog.ts, im Wortlaut aus Markos
 * Briefing-Leitfaden. Der Client entscheidet, welche als naechstes kommt.
 * Diese Function hat nur noch zwei Aufgaben -- beide brauchen Verstehen, nicht
 * Formulieren:
 *
 *   1. ERNTEN. Aus einer freien Antwort die Katalogzeilen fuellen, die darin
 *      mitbeantwortet wurden. Wer eine typische Woche beschreibt, beantwortet
 *      Schwerpunkt und Aufgabengewichtung mit -- danach noch einmal zu fragen
 *      ist genau die Sorte Frage, die den Kunden vertrieben hat.
 *
 *   2. EINE NACHFRAGE. Nur wenn die Antwort etwas offen laesst, das fuer die
 *      Suche zaehlt. Hoechstens eine je Frage; der Client kennzeichnet sie
 *      sichtbar als Nachfrage, damit sie nicht mit Markos Fragen verwechselt
 *      wird.
 *
 * Dazu kommt ein Nebenprodukt, das frueher unterging: WIDERSPRUECHE. Steht ein
 * Feld schon anders da, wird das gemeldet statt still ueberschrieben. Im
 * Live-Test hat ein Kunde dreimal Widerspruechliches zum Arbeitsmodell gesagt;
 * zwei Antworten wurden ueberschrieben und niemand hat gefragt.
 *
 * STATELESS bleibt es: kein DB-Zugriff, kein Service-Role. Alles, was gewusst
 * wird, steht im Aufruf.
 */

interface SlotSpec {
  key: string;
  label: string;
  form: string;
  chips?: string[];
}

interface RequestBody {
  contract_type: 'full-time' | 'freelance';
  job_draft: Record<string, unknown>;
  /** Die Katalogfrage, die gerade beantwortet wurde. Fehlt beim Erst-Aufruf. */
  question?: { key: string; text: string; slots: SlotSpec[] };
  /** Was der Kunde geantwortet hat. */
  answer?: string;
  /** Alle noch offenen Zeilen -- hier hinein wird geerntet. */
  open_slots?: SlotSpec[];
  /** Was schon dasteht, fuer Kontext und Widerspruchserkennung. */
  known?: Record<string, unknown>;
  /** Schon gestellte Nachfragen, damit sich keine wiederholt. */
  asked_followups?: string[];
}

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    slot_values: {
      type: 'object',
      description:
        'Die Katalogzeilen, die durch die Antwort belegt sind. Schluessel = slot key aus '
        + 'open_slots oder aus der gestellten Frage. NUR was tatsaechlich gesagt wurde -- '
        + 'nichts ergaenzen, nichts erfinden, nichts aus Berufserfahrung annehmen. '
        + 'Bei form="multi" ein Array, bei form="range" ein Objekt {min,max}, sonst Text.',
      additionalProperties: true,
    },
    follow_up: {
      type: 'object',
      description:
        'HOECHSTENS EINE Nachfrage, und nur wenn die Antwort etwas fuer die Suche '
        + 'Entscheidendes offen laesst. Im Zweifel weglassen: eine ueberfluessige Frage '
        + 'kostet mehr Vertrauen als eine fehlende Auskunft. Niemals etwas fragen, das '
        + 'im Entwurf oder in known bereits steht.',
      properties: {
        id: { type: 'string', description: 'stabiler snake_case-Schluessel' },
        question: {
          type: 'string',
          description:
            'Die Nachfrage, Sie-Form, EIN Satz, hoechstens 20 Woerter. Konkret auf das '
            + 'bezogen, was der Kunde gerade gesagt hat -- zitiere sein Wort. '
            + 'Beispiel: "Sie nennen Konsolidierung DE/CZ -- nach HGB oder IFRS?"',
        },
        why: { type: 'string', description: 'Ein kurzer Satz: warum das dem Recruiter hilft.' },
        chips: {
          type: 'array',
          items: { type: 'string' },
          description: '2-4 kurze, realistische Antwortoptionen. Leer lassen, wenn keine passen.',
        },
        multi: { type: 'boolean', description: 'true, wenn mehrere Optionen zugleich gelten koennen.' },
        /** Damit die Antwort auf die Nachfrage nicht ins Leere laeuft. */
        fills_slot: {
          type: 'string',
          description: 'Welche Katalogzeile die Antwort auf diese Nachfrage fuellen wird, falls eine passt.',
        },
      },
      required: ['id', 'question', 'why'],
    },
    conflicts: {
      type: 'array',
      description:
        'Widersprueche zwischen der neuen Antwort und dem, was in known schon steht. '
        + 'NICHT stillschweigend ueberschreiben -- melden.',
      items: {
        type: 'object',
        properties: {
          slot: { type: 'string' },
          existing: { type: 'string' },
          neu: { type: 'string' },
          note: { type: 'string', description: 'Ein Satz, was sich widerspricht.' },
        },
        required: ['slot', 'existing', 'neu'],
      },
    },
    skill_suggestions: {
      type: 'array',
      description:
        'Skills, die zu DIESER Rolle ueblicherweise gehoeren, aber im Entwurf noch '
        + 'NICHT stehen. Leite sie aus dem ab, was schon dasteht -- Java -> Spring Boot, '
        + 'Maven, JUnit; Kubernetes -> Docker, Helm; SAP FI -> SAP CO, Migration; HGB -> '
        + 'IFRS, Konsolidierung. Erfinde nichts Rollenfremdes und wiederhole nichts, was '
        + 'schon im Entwurf oder in known steht -- auch nicht ANDERS FORMULIERT: '
        + '"Arbeitnehmerueberlassungsgesetz (AUEG)" neben "Personalvermittlung nach '
        + 'AUEG" ist eine Wiederholung, "Expertenwissen Maschinenbau" neben '
        + '"Maschinenbau" auch. Ausgeschrieben statt abgekuerzt, Oberbegriff statt '
        + 'Beispiel, Synonym -- alles Wiederholung. Hoechstens 6. Sind keine sinnvollen '
        + 'Ergaenzungen erkennbar, gib eine LEERE Liste zurueck -- eine schlechte '
        + 'Empfehlung kostet mehr Vertrauen als eine fehlende.',
      items: {
        type: 'object',
        properties: {
          skill: { type: 'string' },
          // Ohne Begruendung waere es eine Liste unbegruendeter Woerter, und der
          // Kunde muesste raten, warum sie dasteht.
          because: { type: 'string', description: 'Kurz: warum passt das hier? Max. 8 Woerter.' },
        },
        required: ['skill', 'because'],
      },
    },
    /**
     * Antwortvorschlaege je offener Zeile.
     *
     * BEFUND (09.09.2026): Sieben Freitextzeilen hatten gar keine Vorschlaege
     * -- darunter "Koennen Sie mir ein Bild des Arbeitsalltags malen?", die
     * schwerste Frage des Gespraechs. Der Kunde sass vor einem leeren Kasten.
     * Die festen Vorschlaege im Katalog fangen das ab, sind aber fuer jede
     * Stelle dieselben: ein Recruiter und ein SPS-Programmierer lasen "Viel am
     * Telefon".
     *
     * Ein Vorschlag ist KEIN vorbelegter Wert: er steht als Chip da, und erst
     * der Klick des Kunden macht ihn zu seiner Aussage. Deshalb darf er
     * spezifisch sein, wo eine Vorbelegung erfinden wuerde.
     */
    answer_suggestions: {
      type: 'object',
      description:
        'Fuer jede Zeile aus open_slots mit form "ai" oder "text": 3 bis 5 kurze '
        + 'Vorschlaege, die zu DIESER Rolle und DIESEM Unternehmen passen -- aus '
        + 'job_draft und known abgeleitet, nicht allgemein. Hoechstens 6 Woerter je '
        + 'Vorschlag, anklickbar formuliert, keine ganzen Saetze. Beispiel fuer eine '
        + 'Recruiter-Stelle bei daily_routine: "Wiedervorlage im CRM am Morgen", '
        + '"Sechs bis acht Telefoninterviews", "Zwei Kundentermine pro Woche". '
        + 'Schluessel ist der slot key. Gibt der Entwurf zu einer Zeile nichts her, '
        + 'lass sie WEG -- ein allgemeiner Vorschlag ist schlechter als keiner, weil '
        + 'der Katalog dann seine eigenen zeigt. Erfinde keine Tatsachen ueber das '
        + 'Unternehmen; formuliere Anlaeufe, keine Behauptungen.',
      additionalProperties: { type: 'array', items: { type: 'string' } },
    },
    reveal_envelope_patch: {
      type: 'object',
      description:
        'Was die Firma verraten wuerde. red_list = darf NIE in Recruiter-Texte '
        + '(Name, einzigartige Produkte, exakte Adresse, "Marktfuehrer fuer X in Y"). '
        + 'descriptor = anonyme Beschreibung aus Branche + Groesse + Region.',
      properties: {
        descriptor: { type: 'string' },
        green_list: { type: 'array', items: { type: 'string' } },
        red_list: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  /**
   * Was das Modell beantworten MUSS -- notfalls leer.
   *
   * BEFUND (09.09.2026, zum dritten Mal dasselbe Muster): `skill_suggestions`
   * und `answer_suggestions` standen nicht hier. In der ersten Ernte nach dem
   * Parsen kamen sie nicht zurueck, im naechsten Aufruf mit denselben Daten
   * schon -- nullable ohne `required` heisst fuer das Modell: darf ich
   * weglassen. Vorher traf es daily_routine im Parser, dann das Gehaltsband.
   * Eine leere Liste ist eine Antwort; ein fehlender Schluessel ist Zufall.
   */
  required: ['slot_values', 'answer_suggestions', 'skill_suggestions', 'conflicts'],
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body: RequestBody = await req.json();
    const {
      contract_type,
      job_draft,
      question,
      answer = '',
      open_slots = [],
      known = {},
      asked_followups = [],
    } = body;

    if (!job_draft) {
      return new Response(JSON.stringify({ error: 'job_draft required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Du unterstuetzt die Jobaufnahme einer Triple-Blind-Recruiting-Plattform (Kandidaten anonym bis Opt-In, Firma anonym gegenueber Recruitern bis zum Reveal).

DU STELLST KEINE FRAGEN AUS EIGENEM ANTRIEB. Die Fragen stehen in einem festen Katalog und werden vom Client gestellt. Du hast drei Aufgaben:

1. ERNTEN — ordne der Antwort des Kunden die passenden Katalogzeilen zu.
   Nur was er WIRKLICH gesagt hat. Keine Ergaenzung aus Berufserfahrung, keine
   plausible Annahme. Sagt er "sechskoepfiges Team", fuelle team_size. Sagt er
   nichts ueber Ueberstunden, fuelle overtime_policy NICHT.
   Eine freie Antwort belegt oft mehrere Zeilen: wer den Arbeitsalltag
   beschreibt, sagt meist auch etwas ueber Schwerpunkt und Gewichtung. Genau
   diese Zeilen mitzufuellen ist der Sinn dieser Aufgabe — sie werden dann
   nicht mehr gefragt.

2. WIDERSPRUCH MELDEN — steht in known etwas anderes als in der neuen Antwort,
   melde es unter conflicts. Nie stillschweigend das eine durch das andere
   ersetzen.

3. HOECHSTENS EINE NACHFRAGE — nur wenn die Antwort etwas fuer die Suche
   Entscheidendes offen laesst. Ein Satz, hoechstens 20 Woerter, Sie-Form, mit
   einem Wort des Kunden darin. Keine Nachfrage zu etwas, das im Entwurf oder
   in known schon steht. Keine Wiederholung aus asked_followups.
   Im Zweifel KEINE Nachfrage: eine ueberfluessige Frage kostet mehr Vertrauen
   als eine fehlende Auskunft. Das ist ausdruecklich erlaubt und der Normalfall.

4. SKILL-VORSCHLAEGE — nenne bis zu sechs Kriterien, die zu dieser Rolle
   ueblicherweise gehoeren, aber im Entwurf fehlen, jeweils mit einer kurzen
   Begruendung. Das ist der einzige Punkt, an dem du etwas VORSCHLAEGST statt
   zu ernten: der Kunde entscheidet per Klick, du behauptest nichts. Im
   Zweifel eine leere Liste.

VERTRAGSART: ${contract_type}. Bei "freelance" gelten Tagessatz, Laufzeit,
Verlaengerung und Auslastung statt Gehalt und Karrierepfad.

DE-ANONYMISIERUNG: alles, was die Firma identifizieren koennte — Name,
einzigartige Produkte, exakte Adresse, uebernommene Werke, "Marktfuehrer fuer X
in Y" — gehoert auf die red_list und nie in Texte, die Recruiter sehen.

Antworte NUR mit dem JSON-Objekt gemaess Schema.`;

    const userPrompt = `STELLENENTWURF:
${JSON.stringify(job_draft, null, 2)}

SCHON BEKANNT:
${Object.keys(known).length ? JSON.stringify(known, null, 2) : '(noch nichts)'}

${question ? `GESTELLTE FRAGE (aus dem Katalog):
"${question.text}"

Erwartete Antwortzeilen dieser Frage:
${question.slots.map((s) => `- ${s.key} (${s.form}): ${s.label}`).join('\n')}

ANTWORT DES KUNDEN:
${answer || '(keine)'}` : 'ERSTER AUFRUF — es wurde noch nichts gefragt. Ernte nur aus dem Stellenentwurf.'}

NOCH OFFENE ZEILEN (hier hinein darf geerntet werden):
${open_slots.map((s) => `- ${s.key} (${s.form}): ${s.label}${s.chips?.length ? ` [${s.chips.join(' | ')}]` : ''}`).join('\n') || '(keine)'}

BEREITS GESTELLTE NACHFRAGEN (nicht wiederholen): ${asked_followups.join(', ') || '(keine)'}`;

    let parsed: Record<string, unknown>;
    let benutztesModell = '';
    try {
      const antwort = await aiChat({
        system: systemPrompt,
        user: userPrompt,
        // Niedriger als zuvor (0.3): hier wird zugeordnet, nicht formuliert.
        // Kreativitaet ist an dieser Stelle ein Fehler, kein Merkmal.
        temperature: 0.1,
        tool: {
          name: 'intake_step',
          description: 'Geerntete Katalogzeilen, Widersprueche und hoechstens eine Nachfrage',
          parameters: OUTPUT_SCHEMA,
        },
      });
      benutztesModell = antwort.model;
      const raw = antwort.toolArguments ?? antwort.content;
      if (!raw) throw new AiError('Die Antwort war leer.');
      parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, unknown>);
    } catch (e) {
      const detail = e instanceof AiError
        ? `${e.message}${e.detail ? ` — ${e.detail}` : ''}`
        : e instanceof Error ? e.message : String(e);
      console.error('[intake-questions] KI-Aufruf:', detail);
      return new Response(JSON.stringify({ error: 'AI gateway error', detail }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Nur Zeilen uebernehmen, die es im Katalog auch gibt. Ohne diese Sperre
    // legt ein Modell gelegentlich eigene Schluessel an, die spaeter nirgends
    // ankommen -- und niemand merkt es.
    const erlaubt = new Set([
      ...open_slots.map((s) => s.key),
      ...(question?.slots ?? []).map((s) => s.key),
    ]);
    const roh = (parsed.slot_values ?? {}) as Record<string, unknown>;
    const slot_values: Record<string, unknown> = {};
    const verworfen: string[] = [];
    for (const [k, v] of Object.entries(roh)) {
      if (!erlaubt.has(k)) { verworfen.push(k); continue; }
      if (v === null || v === undefined || (typeof v === 'string' && !v.trim())) continue;
      slot_values[k] = v;
    }
    if (verworfen.length) {
      console.warn('[intake-questions] unbekannte Zeilen verworfen:', verworfen.join(', '));
    }

    const fu = parsed.follow_up as Record<string, unknown> | undefined;
    const follow_up =
      fu && typeof fu.question === 'string' && fu.question.trim() && !asked_followups.includes(String(fu.id))
        ? {
            id: String(fu.id ?? 'followup'),
            question: String(fu.question).trim(),
            why: String(fu.why ?? ''),
            chips: Array.isArray(fu.chips) ? (fu.chips as string[]).slice(0, 4) : [],
            multi: fu.multi === true,
            fills_slot: typeof fu.fills_slot === 'string' && erlaubt.has(fu.fills_slot)
              ? fu.fills_slot : null,
          }
        : null;

    return new Response(
      JSON.stringify({
        // Welches Modell geantwortet hat. Ohne diese Angabe laesst sich von
        // aussen nicht pruefen, was ein Ergebnis erzeugt hat -- und ein
        // Modellwechsel waere Behauptung statt Messung.
        model: benutztesModell,
        slot_values,
        follow_up,
        conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
        answer_suggestions: (() => {
          const roh = parsed.answer_suggestions;
          if (!roh || typeof roh !== 'object' || Array.isArray(roh)) return {};
          const out: Record<string, string[]> = {};
          for (const [k, v] of Object.entries(roh as Record<string, unknown>)) {
            const liste = (Array.isArray(v) ? v : [])
              .map((x) => String(x ?? '').trim())
              .filter((x) => x && x.length <= 60)
              .slice(0, 6);
            if (liste.length) out[k] = liste;
          }
          return out;
        })(),
        skill_suggestions: Array.isArray(parsed.skill_suggestions)
          ? (parsed.skill_suggestions as Record<string, unknown>[])
              .filter((v) => typeof v?.skill === 'string' && String(v.skill).trim())
              .slice(0, 6)
          : [],
        reveal_envelope_patch: parsed.reveal_envelope_patch ?? {},
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('intake-questions error:', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
