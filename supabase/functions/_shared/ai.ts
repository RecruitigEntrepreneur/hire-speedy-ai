/**
 * Der eine Ort, an dem steht, wer unsere KI-Aufrufe beantwortet.
 *
 * BEFUND (02.09.2026): Der Anbieter stand an 30 Stellen fest im Code -- 28-mal
 * der Lovable-Gateway, 2-mal OpenRouter. Welcher verwendet wurde, entschied
 * nicht eine Ueberlegung, sondern wer die Datei zuletzt angefasst hatte. Genau
 * daran ist die dynamische Fragengenerierung ausgefallen: sie rief OpenRouter,
 * dessen Schluessel nicht gesetzt war, und fiel still auf einen statischen
 * Fragenkatalog zurueck. Niemand hat es bemerkt.
 *
 * Mit diesem Modul ist die Anbieterwahl EINE Einstellung. Ob Lovable, ob
 * OpenRouter, ob spaeter etwas anderes -- ein Wechsel ist dann eine Zeile und
 * kein Umbau in 30 Dateien. Das ist wichtiger als die Frage, welcher Anbieter
 * heute der beste ist: Sie muessen die Antwort spaeter aendern koennen.
 *
 * AI_PROVIDER waehlt: 'lovable' (Vorgabe) oder 'openrouter'.
 * Beide sind in der Datenschutzerklaerung benannt.
 */

export type AiProvider = 'lovable' | 'openrouter';

export interface AiCall {
  model?: string;
  system?: string;
  user: string;
  temperature?: number;
  /** Antwort als JSON-Objekt erzwingen. */
  json?: boolean;
  /** Werkzeugaufruf erzwingen -- fuer strukturierte Ausgaben. */
  tool?: { name: string; description?: string; parameters: unknown };
  signal?: AbortSignal;
}

export interface AiResult {
  /** Freitext, wenn ohne Werkzeug gerufen. */
  content: string | null;
  /** Argumente des Werkzeugaufrufs, bereits geparst. */
  toolArguments: Record<string, unknown> | null;
  provider: AiProvider;
  model: string;
}

/**
 * Vorgabemodell.
 *
 * GEWECHSELT AM 04.09.2026 von `google/gemini-2.5-flash` auf
 * `google/gemini-3.6-flash`.
 *
 * Der Anlass war die neue Aufgabenteilung in der Aufnahme: die Fragen kommen
 * jetzt aus dem Katalog (src/lib/briefCatalog.ts), das Modell erntet nur noch
 * Felder aus freien Antworten und stellt hoechstens EINE Nachfrage. Beides
 * verlangt Verstehen statt Formulieren -- genau dort war 2.5-flash schwach:
 * es hat 97 Fragen gestellt, ohne aus den Antworten Felder zu fuellen.
 *
 * ZUR MODELLWAHL, abgefragt am 04.09.2026 ueber ai.gateway.lovable.dev/v1/models:
 *   gemini-2.5-flash    deprecated  (die bisherige Vorgabe)
 *   gemini-3.5-flash    deprecated  (ausdruecklich gewuenscht, aber abgekuendigt)
 *   gemini-3.6-flash    aktuell     <- diese Wahl
 *   gemini-3.1-pro-preview          staerker, aber Vorschau und teurer
 * Auf ein abgekuendigtes Modell zu wechseln waere derselbe Fehler noch einmal;
 * 3.6-flash ist der aktuelle Stand derselben Reihe.
 *
 * AI_MODEL bleibt als Uebersteuerung bestehen: ein Supabase-Secret setzen und
 * der naechste Aufruf laeuft ohne Deploy auf einem anderen Modell. Welches
 * Modell wirklich geantwortet hat, steht im Feld `model` jeder Antwort und im
 * Ereignisprotokoll -- ein Wechsel ist damit pruefbar und nicht geglaubt.
 */
const DEFAULT_MODEL = 'google/gemini-3.6-flash';

/** Umgebungsvorgabe. Leerer String zaehlt als nicht gesetzt. */
function envModel(): string | undefined {
  const m = Deno.env.get('AI_MODEL')?.trim();
  return m && m.length > 0 ? m : undefined;
}

function provider(): AiProvider {
  const p = (Deno.env.get('AI_PROVIDER') ?? 'lovable').toLowerCase();
  return p === 'openrouter' ? 'openrouter' : 'lovable';
}

function endpoint(p: AiProvider): { url: string; key: string | undefined; keyName: string } {
  return p === 'openrouter'
    ? { url: 'https://openrouter.ai/api/v1/chat/completions',
        key: Deno.env.get('OPENROUTER_API_KEY'), keyName: 'OPENROUTER_API_KEY' }
    : { url: 'https://ai.gateway.lovable.dev/v1/chat/completions',
        key: Deno.env.get('LOVABLE_API_KEY'), keyName: 'LOVABLE_API_KEY' };
}

export class AiError extends Error {
  constructor(message: string, readonly status?: number, readonly detail?: string) {
    super(message);
    this.name = 'AiError';
  }
}

export async function aiChat(call: AiCall): Promise<AiResult> {
  const p = provider();
  const { url, key, keyName } = endpoint(p);
  if (!key) {
    // Beim Namen nennen: "AI gateway error" hat uns heute eine Stunde gekostet.
    throw new AiError(`${keyName} ist nicht gesetzt (Anbieter: ${p}).`);
  }

  // Reihenfolge: was die Function ausdruecklich waehlt, schlaegt die
  // Umgebung; die Umgebung schlaegt die Vorgabe. Eine Function, die bewusst
  // ein bestimmtes Modell braucht, wird durch ein Experiment nicht umgebogen.
  const model = call.model ?? envModel() ?? DEFAULT_MODEL;
  const messages = [
    ...(call.system ? [{ role: 'system', content: call.system }] : []),
    { role: 'user', content: call.user },
  ];

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: call.temperature ?? 0.3,
  };
  if (call.json && !call.tool) body.response_format = { type: 'json_object' };
  if (call.tool) {
    body.tools = [{
      type: 'function',
      function: {
        name: call.tool.name,
        description: call.tool.description,
        parameters: call.tool.parameters,
      },
    }];
    body.tool_choice = { type: 'function', function: { name: call.tool.name } };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(p === 'openrouter'
        ? { 'HTTP-Referer': Deno.env.get('SUPABASE_URL') ?? 'https://matchunt.ai' }
        : {}),
    },
    body: JSON.stringify(body),
    signal: call.signal,
  });

  const text = await res.text();
  if (!res.ok) {
    // Der Anbieter und sein Wortlaut gehoeren in die Meldung. Ein blosses
    // "AI gateway error" laesst offen, ob der Schluessel fehlt, das Modell
    // unbekannt ist oder das Kontingent erschoepft.
    throw new AiError(
      `${p} antwortete ${res.status}.`, res.status, text.slice(0, 400));
  }

  let data: Record<string, any>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AiError(`${p} lieferte keine gültige Antwort.`, res.status, text.slice(0, 200));
  }

  const message = data?.choices?.[0]?.message ?? {};
  let toolArguments: Record<string, unknown> | null = null;
  const raw = message?.tool_calls?.[0]?.function?.arguments;
  if (raw) {
    try {
      toolArguments = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      throw new AiError(`${p}: Werkzeugantwort war kein gültiges JSON.`);
    }
  }

  return {
    content: message?.content ?? null,
    toolArguments,
    provider: p,
    model,
  };
}
