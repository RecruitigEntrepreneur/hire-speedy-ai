/**
 * Klickpfad und Netzwerkfehler für die Feedback-Lasche (Entscheidung 19.10.2026).
 *
 * Damit das Entwickler-Team echte Schritte zum Nachstellen bekommt statt
 * geratener: die letzten 25 Seitenwechsel, Klicks und Feldwechsel, dazu die
 * letzten 15 fehlgeschlagenen Server-Aufrufe.
 *
 * Datenschutz: Es werden NIE getippte Werte gelesen — nur Beschriftungen von
 * Knöpfen und Feldern. Von Adressen nur der Pfad, ohne Abfrageteil (dort
 * stehen bei Supabase Filter wie email=eq.…).
 *
 * Muss vor dem Supabase-Client geladen werden: supabase-js merkt sich fetch
 * beim Anlegen. Deshalb importiert main.tsx ./install als Allererstes.
 */
import { redactedPath } from './pageContext';

export interface TrailEntry {
  t: string;
  type: 'nav' | 'click' | 'field' | 'submit' | 'error';
  label: string;
}

export interface NetworkEntry {
  t: string;
  method: string;
  url: string;
  status: number;
  ms: number;
}

const MAX_TRAIL = 25;
const MAX_NETWORK = 15;
const trail: TrailEntry[] = [];
const network: NetworkEntry[] = [];
let installed = false;
let lastPath = '';

const clip = (s: string, n = 60) => {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const insideFeedback = (el: Element | null) => !!el?.closest('[data-feedback-ignore]');

function push(type: TrailEntry['type'], label: string) {
  if (!label) return;
  trail.push({ t: new Date().toISOString(), type, label: clip(label, 120) });
  if (trail.length > MAX_TRAIL) trail.shift();
}

/** Beschriftung eines Elements — nie sein Wert. */
export function labelOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return clip(aria);
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    const label = el.labels?.[0]?.textContent;
    if (label?.trim()) return clip(label);
    const placeholder = 'placeholder' in el ? el.placeholder : '';
    return clip(placeholder || el.name || el.id || el.type || 'Feld');
  }
  // innerText trennt Blöcke („Kritische Deals (5) candidate response“), textContent klebt sie zusammen.
  const text = el instanceof HTMLElement ? el.innerText : el.textContent ?? '';
  if (text?.trim()) return clip(text);
  return clip(el.getAttribute('title') || el.getAttribute('alt') || el.tagName.toLowerCase());
}

const CLICKABLE =
  'button, a[href], summary, label, [role="button"], [role="tab"], [role="link"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [role="radio"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"]';

function onNavigate() {
  const path = window.location.pathname;
  if (path === lastPath) return;
  lastPath = path;
  push('nav', `Seite ${redactedPath()}`);
}

function shortUrl(raw: string): string {
  try {
    const u = new URL(raw, window.location.href);
    const path = u.pathname.replace(/^\/+/, '');
    if (u.host.endsWith('.supabase.co') || u.host === window.location.host) return path;
    return `${u.host}/${path}`;
  } catch {
    return raw.split('?')[0].slice(0, 200);
  }
}

function recordNetwork(method: string, url: string, status: number, started: number) {
  if (url.includes('/functions/v1/product-feedback')) return;
  const entry: NetworkEntry = {
    t: new Date().toISOString(),
    method,
    url: shortUrl(url),
    status,
    ms: Math.round(performance.now() - started),
  };
  network.push(entry);
  if (network.length > MAX_NETWORK) network.shift();
  push('error', `${method} ${entry.url} → ${status || 'keine Verbindung'}`);
}

export function installSessionTrail() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  onNavigate();
  for (const name of ['pushState', 'replaceState'] as const) {
    const original = history[name].bind(history);
    history[name] = ((...args: Parameters<History['pushState']>) => {
      const result = original(...args);
      onNavigate();
      return result;
    }) as History['pushState'];
  }
  window.addEventListener('popstate', onNavigate);

  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as Element | null)?.closest?.(CLICKABLE);
      if (!target || insideFeedback(target)) return;
      push('click', `Klick „${labelOf(target)}“`);
    },
    true,
  );
  document.addEventListener(
    'change',
    (e) => {
      const target = e.target as Element | null;
      if (!target || insideFeedback(target)) return;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
      if (target instanceof HTMLInputElement && ['checkbox', 'radio', 'submit', 'button'].includes(target.type)) return;
      push('field', `Feld „${labelOf(target)}“ geändert`);
    },
    true,
  );
  document.addEventListener(
    'submit',
    (e) => {
      const form = e.target as Element | null;
      if (!form || insideFeedback(form)) return;
      push('submit', 'Formular abgeschickt');
    },
    true,
  );

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const started = performance.now();
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      const response = await originalFetch(input, init);
      if (!response.ok) recordNetwork(method, url, response.status, started);
      return response;
    } catch (error) {
      recordNetwork(method, url, 0, started);
      throw error;
    }
  };
}

export const recentTrail = (): TrailEntry[] => [...trail];
export const recentNetworkErrors = (): NetworkEntry[] => [...network];
