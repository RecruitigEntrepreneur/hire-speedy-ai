/**
 * PDF → Text über das multimodale Modell (wie parse-pdf, ohne dessen Schwächen):
 * Base64 in Blöcken statt O(n²), mehr Ausgabe-Tokens für lange Lebensläufe,
 * Rückfall auf das bewährte Modell, wenn das aktuelle die Datei ablehnt.
 */

const MODELS = ['google/gemini-3.6-flash', 'google/gemini-2.5-flash'];

export class PdfTextError extends Error {}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function pdfToText(bytes: Uint8Array): Promise<{ text: string; model: string }> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new PdfTextError('LOVABLE_API_KEY ist nicht gesetzt.');
  const data = `data:application/pdf;base64,${bytesToBase64(bytes)}`;
  let lastError = '';
  for (const model of MODELS) {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 16000,
        messages: [
          {
            role: 'system',
            content: 'Gib den vollständigen Text dieses Lebenslaufs wieder, Wort für Wort, in Lesereihenfolge. '
              + 'Jede Zeile des Dokuments als eigene Zeile, Tabellen als „Bezeichnung: Wert". Nichts weglassen, nichts zusammenfassen, keine Kommentare.',
          },
          { role: 'user', content: [{ type: 'text', text: 'Text des Lebenslaufs:' }, { type: 'image_url', image_url: { url: data } }] },
        ],
      }),
    });
    const body = await res.text();
    if (!res.ok) { lastError = `${model}: ${res.status} ${body.slice(0, 200)}`; continue; }
    const text = JSON.parse(body)?.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.trim().length > 40) return { text: text.trim(), model };
    lastError = `${model}: leere Antwort`;
  }
  throw new PdfTextError(`PDF konnte nicht gelesen werden (${lastError}).`);
}
