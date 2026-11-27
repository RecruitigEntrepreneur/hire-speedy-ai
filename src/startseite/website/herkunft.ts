// Herkunft weitergeben, ohne etwas im Browser zu speichern (Stufe 1, ohne Einwilligung):
// Kam der Besucher über einen Kampagnen-Link (?quelle=…), wandert die Quelle in der Adresse mit –
// zu den eigenen Seiten und in die App (/start, Anmelden). Die App bekommt dazu die Sprache (?lang=).

const ist = (host: string) => host === "matchunt.ai" || host.endsWith(".matchunt.ai");

export function mitHerkunft(ziel: string): string {
  if (typeof window === "undefined" || !ziel || ziel.startsWith("#") || ziel.startsWith("mailto:") || ziel.startsWith("tel:")) return ziel;
  let u: URL;
  try { u = new URL(ziel, window.location.href); } catch { return ziel; }
  const app = ist(u.hostname);
  const eigen = u.origin === window.location.origin;
  if (!app && !eigen) return ziel; // fremde Seiten bekommen nichts mit
  const quelle = new URLSearchParams(window.location.search).get("quelle");
  if (quelle && !u.searchParams.has("quelle")) u.searchParams.set("quelle", quelle);
  const code = document.querySelector<HTMLElement>("[data-mu-sprache]")?.dataset.muSprache;
  if (app && code && !u.searchParams.has("lang")) u.searchParams.set("lang", code);
  return eigen ? `${u.pathname}${u.search}${u.hash}` : u.toString();
}
