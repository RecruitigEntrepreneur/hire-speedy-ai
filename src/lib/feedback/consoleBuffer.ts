/**
 * Die letzten 20 Fehlermeldungen im Browser, für die Feedback-Lasche.
 *
 * Läuft ab dem ersten Skript (main.tsx), damit auch Fehler beim Laden der
 * Seite dabei sind. Gekürzt auf 500 Zeichen je Eintrag: es geht um den
 * Hinweis, nicht um vollständige Datensätze.
 */
export interface ConsoleEntry {
  t: string;
  m: string;
}

const MAX = 20;
const buffer: ConsoleEntry[] = [];
let installed = false;

function format(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function push(parts: unknown[]) {
  const m = parts.map(format).filter(Boolean).join(' ').slice(0, 500);
  if (!m) return;
  buffer.push({ t: new Date().toISOString(), m });
  if (buffer.length > MAX) buffer.shift();
}

export function installConsoleBuffer() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      push(args);
    } catch {
      /* der Puffer darf nie selbst Fehler werfen */
    }
    original(...args);
  };
  window.addEventListener('error', (e) => {
    push([e.message || 'Skriptfehler', e.filename ? `(${e.filename}:${e.lineno})` : '']);
  });
  window.addEventListener('unhandledrejection', (e) => {
    push(['Unbehandelter Fehler:', e.reason]);
  });
}

export const recentConsoleErrors = (): ConsoleEntry[] => [...buffer];
