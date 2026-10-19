/**
 * Was zur Seite mitgeschickt wird — ohne Zugangs-Token.
 *
 * Aufnahme-, Einladungs- und Interview-Links tragen ihren Token im Pfad. Der
 * ist ein Schlüssel: Wer ihn im Feedback-Eingang anklickt, wäre als Kunde im
 * Entwurf unterwegs. Deshalb wird er vor dem Senden geschwärzt.
 */

const TOKEN_PATHS: RegExp[] = [
  /^(\/start\/)[^/?#]+/,
  /^(\/aufnahme\/rueckfrage\/)[^/?#]+/,
  /^(\/aufnahme\/)(?!unterschrift-fertig\b|rueckfrage\b)[^/?#]+/,
  /^(\/interview\/(?:select|respond|bestaetigen)\/)[^/?#]+/,
  /^(\/offer\/view\/)[^/?#]+/,
  /^(\/invite\/)[^/?#]+/,
  /^(\/reference\/)[^/?#]+/,
];

const SECRET_PARAM = /token|code|key|secret|signature|access|password|state/i;

export function redactedPath(location: Pick<Location, 'pathname' | 'search'> = window.location): string {
  let path = location.pathname;
  for (const re of TOKEN_PATHS) {
    if (re.test(path)) {
      path = path.replace(re, '$1[token]');
      break;
    }
  }
  const params = new URLSearchParams(location.search);
  for (const name of [...params.keys()]) {
    if (SECRET_PARAM.test(name)) params.set(name, '[…]');
  }
  const query = params.toString();
  if (!query) return path;
  try {
    return `${path}?${decodeURIComponent(query)}`;
  } catch {
    return `${path}?${query}`;
  }
}

/** Token aus dem Pfad eines Aufnahme-Links (/start/:token, /aufnahme/:draftToken). */
export function guestTokenFromPath(pathname: string = window.location.pathname): string | null {
  const start = /^\/start\/([^/?#]+)/.exec(pathname);
  if (start) return decodeURIComponent(start[1]);
  const draft = /^\/aufnahme\/(?!unterschrift-fertig\b|rueckfrage\b)([^/?#]+)/.exec(pathname);
  if (draft) return decodeURIComponent(draft[1]);
  return null;
}

export const isGuestIntakePath = (pathname: string) => guestTokenFromPath(pathname) !== null;

export function pageContext() {
  return {
    page_path: redactedPath(),
    page_title: document.title.slice(0, 200),
    viewport: {
      w: document.documentElement.clientWidth,
      h: document.documentElement.clientHeight,
      dpr: window.devicePixelRatio || 1,
    },
    user_agent: navigator.userAgent.slice(0, 400),
    app_version: `${__APP_VERSION__} · ${__APP_BUILT_AT__.slice(0, 16).replace('T', ' ')}`,
  };
}
