#!/usr/bin/env node
/**
 * Startseite C aus dem Website-Labor in die App holen (27.11.2026, Marko: „die Website aus dem
 * Builder mit unseren 10 Sektionen … ersetzen und live bringen“).
 *
 * Das Labor (Next.js, ~/Projekte/matchunt-website-labor) bleibt die Werkstatt. Dieses Skript kopiert
 * die zehn Sektionen von Startseite C samt Rahmen (Sprache, Hinweis, Fuß) nach src/startseite/,
 * passt Next-Teile an Vite an und legt Schriften und Bilder nach public/. Läuft beliebig oft:
 * Wird im Labor weitergefeilt, holt ein neuer Lauf den Stand herüber.
 *
 *   node scripts/startseite-aus-labor.mjs            (Labor unter ~/Projekte/matchunt-website-labor)
 *   LABOR=/pfad/zum/labor node scripts/startseite-aus-labor.mjs
 *
 * Bewusst NICHT übernommen: die Einwilligung der Website (die App hat ihren Cookie-Hinweis,
 * „Cookie-Einstellungen“ im Fuß öffnet ihn) und alles, was nur das Labor braucht.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LABOR = process.env.LABOR || path.join(os.homedir(), 'Projekte/matchunt-website-labor');
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const QUELLE = path.join(LABOR, 'src');
const ZIEL = path.join(APP, 'src/startseite');

/** Die zehn Sektionen von Startseite C, in dieser Reihenfolge (Labor: seiten/plan.ts, Seite SC). */
export const SEKTIONEN = [
  ['neu:k12', 'neu/k12-einstieg-suche'],
  ['rm:1@2', 'matchunt/s09-2-logos'],
  ['lo:1@1', 'matchunt/s12-1-klammer'],
  ['le:0@4', 'matchunt/s18-4-satzweg-blau'],
  ['neu:kb3', 'neu/kb3-bahnen'],
  ['un:4@4', 'matchunt/s15-4-preis'],
  ['neu:pf4', 'neu/pf4-plattform'],
  ['co:4', 'matchunt/s39-notizen'],
  ['jo:2', 'matchunt/s42-aufgaben'],
  ['rl:5', 'matchunt/s80-fragen'],
];
/** Die Headhunter-Seite (Labor: Seite H), 27.11.2026 übernommen; Inhalt noch nicht final, Marko geht sie durch. */
export const HEADHUNTER = [
  ['neu:h1', 'neu/h1-einstieg'],
  ['lo:5', 'matchunt/s19-hhschritte'],
  ['r1:7', 'matchunt/s49-hhfilm'],
  // jo:3 „Geflecht“ (matchunt/s61-geflecht) fehlt: braucht die 3D-Bibliothek three, die die App nicht hat.
  ['neu:h2', 'neu/h2-fertig'],
  ['neu:h5', 'neu/h5-werkzeug'],
  ['neu:h7', 'neu/h7-name'],
  ['neu:h4', 'neu/h4-deins'],
  ['neu:h6', 'neu/h6-regeln'],
  ['neu:h9', 'neu/h9-fragen'],
  ['neu:h8', 'neu/h8-start'],
  ['neu:h3', 'neu/h3-verdienst'],
];
const RAHMEN = ['website/Rahmen.tsx', 'website/Fuss.tsx', 'website/SprachHinweis.tsx', 'website/SprachMenue.tsx',
  'website/texte.ts', 'website/sprachen.ts', 'website/herkunft.ts', 'website/kontext.tsx', 'website/website.css',
  'website/Kopf.tsx', 'website/adressen.ts', 'website/Abschluss.tsx', 'matchunt/stil.css', 'seiten/seiten.css'];
/** Karriere-Seite (Labor: neu/kr-karriere), 27.11.2026. */
export const KARRIERE = [['kr', 'neu/kr-karriere']];
/** Adressen der Website-Seiten in der App (ersetzt website/adressen.ts des Labors). */
const APP_SEITEN = {
  start: '/', ablauf: '/#ablauf', honorar: '/#honorar', headhunter: '/headhunter', karriere: '/karriere',
  anmelden: '/auth', anmeldenUnternehmen: '/anmelden', anmeldenHeadhunter: '/recruiter/login',
};
const WEGLASSEN = new Set(['website/einwilligung.ts', 'website/EinwilligungsDialoge.tsx', 'website/NachEinwilligung.tsx']);

if (!fs.existsSync(QUELLE)) { console.error(`Labor nicht gefunden: ${LABOR}`); process.exit(1); }

// ---- 1. Welche Dateien gebraucht werden (Importe verfolgen) -------------------------------
const gesehen = new Set();
const aufloesen = (von, spec) => {
  const basis = spec.startsWith('@/') ? path.join(QUELLE, spec.slice(2)) : path.resolve(path.dirname(von), spec);
  for (const k of [basis, `${basis}.tsx`, `${basis}.ts`, `${basis}.css`, `${basis}/index.tsx`, `${basis}/index.ts`]) {
    if (fs.existsSync(k) && fs.statSync(k).isFile()) return k;
  }
  return null;
};
const IMPORT = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]|@import\s+['"]([^'"]+)['"]/g;
const folge = (datei) => {
  if (!datei) return;
  const rel = path.relative(QUELLE, datei);
  if (gesehen.has(rel) || WEGLASSEN.has(rel)) return;
  gesehen.add(rel);
  const text = fs.readFileSync(datei, 'utf8');
  for (const m of text.matchAll(IMPORT)) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (spec && (spec.startsWith('.') || spec.startsWith('@/'))) folge(aufloesen(datei, spec));
  }
};
for (const [, ordner] of [...SEKTIONEN, ...HEADHUNTER, ...KARRIERE]) folge(aufloesen(path.join(QUELLE, 'x'), `@/${ordner}`));
if (gesehen.has('neu/register.tsx')) throw new Error('neu/register.tsx (Baukasten des Labors) würde mitkopiert – Import in einer Sektion prüfen.');
for (const r of RAHMEN) folge(path.join(QUELLE, r));

// ---- 2. Kopieren und anpassen -----------------------------------------------------------
fs.rmSync(ZIEL, { recursive: true, force: true });
const anpassen = (rel, text) => {
  let t = text
    .replace(/^"use client";\s*\n/m, '')
    .replace(/(['"])@\//g, '$1@/startseite/')
    .replace(/(['"])next\/link\1/g, '$1@/startseite/shims/link$1')
    .replace(/(['"])next\/font\/google\1/g, '$1@/startseite/shims/schriften$1')
    // Eigene Adressen relativ: dann gilt der Knopf auf jeder Umgebung (lokal, Vorschau, live).
    .replace(/https:\/\/matchunt\.ai\/recruiter\/onboarding/g, '/recruiter/onboarding')
    .replace(/https:\/\/matchunt\.ai\/recruiter\/login/g, '/recruiter/login')
    .replace(/https:\/\/matchunt\.ai\/(start|auth|impressum|datenschutz|agb)/g, '/$1')
    // „Für Headhunter“ zeigt im Labor auf dessen Unterseite H; in der App beginnt dort die Bewerbung.
    .replace(/(['"])\/seiten\/h\1/g, '$1/recruiter/onboarding$1')
    // React 18 kennt inert={bool} noch nicht (erst React 19): als Attribut-Text setzen.
    .replace(/\binert=\{([^{}]+)\}/g, (_m, bed) => `{...((${bed}) ? { inert: '' } : {})}`);
  // ?stelle= hängt das Labor seit 27.11.2026 selbst an (Einstieg.tsx, mitStelle) – hier nur prüfen, dass es so bleibt.
  if (rel === 'neu/k1-einstieg/Einstieg.tsx' && !t.includes('mitHerkunft(mitStelle(knopfUrl, stelle))')) {
    throw new Error('Einstieg.tsx: Die getippte Stelle geht nicht mehr als ?stelle= mit – Labor prüfen.');
  }
  if (rel === 'neu/h1-einstieg/index.tsx') {
    // „Für Unternehmen“ zeigt im Labor auf die Website unter /w, in der App auf die Startseite.
    t = t.replace('["Für Unternehmen", "/w"]', '["Für Unternehmen", "/"]');
  }
  if (rel === 'website/Rahmen.tsx') {
    t = t.replace(/^import \{ EinwilligungsDialoge \}.*\n/m, '')
      .replace(/^import \{ Dienste \}.*\n/m, '')
      .replace(/\s*<EinwilligungsDialoge \/>/, '')
      .replace(/\s*<Dienste \/>/, '');
  }
  return t;
};
for (const rel of gesehen) {
  const ziel = path.join(ZIEL, rel);
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, anpassen(rel, fs.readFileSync(path.join(QUELLE, rel), 'utf8')));
}

// ---- 3. Ersatz für Next-Teile -----------------------------------------------------------
const schreibe = (rel, text) => { const z = path.join(ZIEL, rel); fs.mkdirSync(path.dirname(z), { recursive: true }); fs.writeFileSync(z, text); };
schreibe('shims/link.tsx', `// Ersatz für next/link: ein gewöhnlicher Link (die Seite verlässt beim Klick ohnehin die Website).
import type { AnchorHTMLAttributes, ReactNode } from 'react';
export default function Link({ href, children, prefetch: _p, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode; prefetch?: boolean }) {
  return <a href={href} {...rest}>{children}</a>;
}
`);
schreibe('shims/schriften.ts', `// Ersatz für next/font/google: die Schriften liegen als Dateien unter public/fonts/startseite
// (aus dem Labor übernommen, kein Abruf bei Google). Jede „Schrift“ liefert dieselbe Klasse, die die
// Variablen setzt (startseite/schriften.css).
type Schrift = { variable: string; className: string; style: { fontFamily: string } };
const s = (): Schrift => ({ variable: 'mu-schriften', className: 'mu-schriften', style: { fontFamily: 'inherit' } });
export const Figtree = (_o?: unknown) => s();
export const Inter_Tight = (_o?: unknown) => s();
export const Poppins = (_o?: unknown) => s();
export const Source_Serif_4 = (_o?: unknown) => s();
`);
// Kontakt bleibt wie im Labor (dieselben Angaben wie im Impressum); nur die Adressen der Seiten wechseln.
const kontakt = fs.readFileSync(path.join(QUELLE, 'website/adressen.ts'), 'utf8').match(/export const KONTAKT = [^\n]+\n/)?.[0];
if (!kontakt) throw new Error('website/adressen.ts: KONTAKT nicht gefunden – Skript anpassen.');
schreibe('website/adressen.ts', `// Adressen der Website-Seiten in der App (vom Übernahme-Skript geschrieben, im Labor zeigen sie auf /w und /seiten/h).
export const SEITEN = ${JSON.stringify(APP_SEITEN, null, 2)};

/** Kontakt im Fuß – dieselben Angaben wie im Impressum. */
${kontakt}`);
schreibe('website/einwilligung.ts', `// „Cookie-Einstellungen“ im Fuß öffnet den Cookie-Hinweis der App (die Website hat keinen eigenen).
import { setCookieBannerOpen } from '@/lib/cookieBanner';
export const zentraleOeffnen = () => setCookieBannerOpen(true);
`);

// ---- 4. Schriften: Dateien aus dem Labor-Build, nur Latein + Latein erweitert -------------
const VARIABLEN = { Figtree: '--mu-figtree', 'Inter Tight': '--mu-intertight', Poppins: '--font-poppins', 'Source Serif 4': '--font-serif' };
const RUECKFALL = { Figtree: 'system-ui, sans-serif', 'Inter Tight': 'system-ui, sans-serif', Poppins: 'system-ui, sans-serif', 'Source Serif 4': 'Georgia, serif' };
const NEXT = path.join(LABOR, '.next');
const cssDateien = [];
const sammle = (d) => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) sammle(p); else if (f.endsWith('.css')) cssDateien.push(p); } };
sammle(NEXT);
const faces = new Map();
for (const f of cssDateien) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const block = m[1];
    const fam = (block.match(/font-family:\s*([^;]+)/)?.[1] ?? '').replace(/['"]/g, '').trim();
    if (!(fam in VARIABLEN)) continue;
    const url = block.match(/url\(([^)]+)\)/)?.[1]?.replace(/['"]/g, '');
    const range = block.match(/unicode-range:\s*([^;]+)/)?.[1]?.trim() ?? '';
    // Nur Latein (U+0000-00FF …) und Latein erweitert (U+0100-02BA …).
    if (!/U\+0+-0*FF|U\+\?\?|U\+100-2BA|U\+0100-02BA/i.test(range)) continue;
    const gewicht = block.match(/font-weight:\s*([^;]+)/)?.[1]?.trim() ?? '400';
    const stil = block.match(/font-style:\s*([^;]+)/)?.[1]?.trim() ?? 'normal';
    faces.set(`${fam}|${gewicht}|${stil}|${range}`, { fam, url, range, gewicht, stil });
  }
}
const SCHRIFT_ZIEL = path.join(APP, 'public/fonts/startseite');
fs.rmSync(SCHRIFT_ZIEL, { recursive: true, force: true });
fs.mkdirSync(SCHRIFT_ZIEL, { recursive: true });
let css = '/* Schriften der Startseite (aus dem Website-Labor, selbst ausgeliefert). Erzeugt von scripts/startseite-aus-labor.mjs. */\n';
for (const { fam, url, range, gewicht, stil } of faces.values()) {
  const datei = path.basename(url);
  const quelle = [path.join(NEXT, 'static/media', datei), path.join(NEXT, 'dev/static/media', datei)].find((x) => fs.existsSync(x));
  if (!quelle) { console.warn(`Schriftdatei fehlt: ${datei}`); continue; }
  fs.copyFileSync(quelle, path.join(SCHRIFT_ZIEL, datei));
  css += `@font-face{font-family:'MU ${fam}';src:url('/fonts/startseite/${datei}') format('woff2');font-weight:${gewicht};font-style:${stil};font-display:swap;unicode-range:${range};}\n`;
}
css += `.mu-schriften{${Object.entries(VARIABLEN).map(([fam, v]) => `${v}:'MU ${fam}',${RUECKFALL[fam]};`).join('')}}\n`;
schreibe('schriften.css', css);

// ---- 5. Bilder: was die Sektionen aus public/ zeigen --------------------------------------
const bilder = new Set();
for (const rel of gesehen) {
  const text = fs.readFileSync(path.join(QUELLE, rel), 'utf8');
  for (const m of text.matchAll(/["'`](\/(?:headhunter|logos|app|bilder|fotos)\/[^"'`$]*)/g)) bilder.add(m[1]);
}
const PUBLIC_L = path.join(LABOR, 'public'), PUBLIC_A = path.join(APP, 'public');
let kopiert = 0;
for (const b of bilder) {
  const q = path.join(PUBLIC_L, b);
  if (!fs.existsSync(q)) continue;
  const z = path.join(PUBLIC_A, b);
  fs.mkdirSync(path.dirname(z), { recursive: true });
  if (fs.statSync(q).isDirectory()) fs.cpSync(q, z, { recursive: true }); else fs.copyFileSync(q, z);
  kopiert++;
}

console.log(`Startseite übernommen: ${gesehen.size} Dateien nach src/startseite, ${faces.size} Schrift-Schnitte, ${kopiert} Bilder/Ordner.`);
