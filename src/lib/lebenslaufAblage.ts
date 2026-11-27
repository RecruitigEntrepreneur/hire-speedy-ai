import { useSyncExternalStore } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { dossierFromCv, mergeCvIntoDossier, newStations, type CvExtraction } from '@/lib/cvImport';
import { devMockEnabled, findDuplicate, readCv, saveCvIntoExisting, saveNewCandidateFromCv, uploadCvFile, type CvFileInfo } from '@/hooks/useCvImport';
import { fetchDossier } from '@/hooks/useCandidateDossier';
import { cvFileProblem } from '@/lib/candidateCv';
import type { DossierForm } from '@/lib/candidateDossier';
import { einladungApi, type HinweisErgebnis } from '@/lib/terminApi';
import { term } from '@/lib/candidateTerms';
import i18n from '@/i18n';

// Meldungen beim Aufruf übersetzt (Namespace candidateAblage), nie als Konstante auf Modulebene.
const ta = (key: string, options?: Record<string, unknown>): string => i18n.t(`candidateAblage:${key}`, options) as string;

/**
 * Live-Ablage für Lebensläufe (09.11.2026): Hochladen und Lesen laufen im Hintergrund,
 * höchstens zwei gleichzeitig, weitere warten. Die Ablage überlebt Seitenwechsel und
 * steht in diesem Browser.
 *
 * Seit 12.11.2026 ohne Prüfschritt (Marko: „wieso sollte der Headhunter die aktuelle Stelle
 * anpassen, wenn er den Lebenslauf hochlädt? … höchstens im Interview“): Nach dem Lesen ist
 * der Kandidat angelegt. Gibt es ihn schon, kommt der Lebenslauf in seine Akte und füllt nur
 * leere Felder; Abweichungen bleiben zum Ansehen.
 *
 * Hochladen-Fenster (12.11.2026): ein Lebenslauf je Fenster, drei Häkchen. Die Bestätigung
 * wird nach dem Anlegen als Nachweis gespeichert; ist der Schalter an, schickt Matchunt dem
 * Kandidaten einmalig einen kurzen Hinweis. Kein Matching mehr in der Ablage (AI Act offen).
 */
export type AblageStatus = 'wartet' | 'laedt' | 'liest' | 'legtAn' | 'bereit' | 'doppelt' | 'fehler' | 'unterbrochen' | 'angelegt';

export interface AblageEintrag {
  id: string;
  dateiname: string;
  status: AblageStatus;
  erstellt: number;
  fehler?: string;
  pdfPath?: string;
  text?: string;
  fileInfo?: CvFileInfo | null;
  cv?: CvExtraction | null;
  name?: string;
  kurz?: string;
  dublette?: { id: string; full_name: string };
  kandidatId?: string;
  ergaenzt?: boolean;
  angelegtAm?: number;
  /** Ergänzt: so viele leere Angaben gefüllt bzw. abweichend (zum Ansehen) */
  ergaenztAnzahl?: number;
  abweichungen?: number;
  /** Ohne E-Mail keine Einladung: steht dann in der Zeile */
  ohneEmail?: boolean;
  /** Wahl im Hochladen-Fenster: Matchunt schickt den Hinweis oder der Headhunter sagt es selbst */
  hinweisWahl?: 'matchunt' | 'selbst';
  bestaetigtAm?: number;
  /** Stand des Hinweises; 'test' = lokaler Testmodus, nichts verschickt */
  hinweis?: HinweisErgebnis | 'laeuft' | 'test';
  hinweisAm?: number;
  hinweisFehler?: string;
}

interface Zustand {
  eintraege: AblageEintrag[];
  /** Abgelegt, aber noch nicht bestätigt: das Fenster fragt je Lebenslauf, der erste ist dran. */
  wartenAufZustimmung: File[];
}

const GLEICHZEITIG = 2;
// Angelegte bleiben einen Arbeitstag in der Ablage, damit man sie noch einlädt.
const ANGELEGT_SICHTBAR_MS = 12 * 60 * 60 * 1000;

let userId: string | null = null;
let zustand: Zustand = { eintraege: [], wartenAufZustimmung: [] };

/**
 * Beispiel im Headhunter-Rundgang (19.11.2026): Solange die Bühne offen ist, zeigt die Ablage
 * nur das Beispiel. Der echte Stand ruht in `echt` und kommt danach unverändert zurück. Im
 * Beispiel wird nichts hochgeladen, gelesen, gespeichert oder verschickt: „Hochladen“ spielt
 * die Zustände nur vor (liest, legt an, angelegt) und landet beim Beispielkandidaten.
 */
export interface AblageBeispiel { kandidatId: string; name: string; kurz?: string; datei: string }
let beispiel: AblageBeispiel | null = null;
let echt: Zustand | null = null;
const beispielTimer = new Set<number>();
const leer = (): Zustand => ({ eintraege: [], wartenAufZustimmung: [] });
const dateien = new Map<string, File>();
const hoerer = new Set<() => void>();
let laufend = 0;

const schluessel = (uid: string) => `matchunt.ablage.${uid}`;

function speichern(z: Zustand = zustand) {
  if (!userId) return;
  try {
    const behalten = z.eintraege.filter((e) => e.status !== 'angelegt' || Date.now() - (e.angelegtAm ?? 0) < ANGELEGT_SICHTBAR_MS);
    localStorage.setItem(schluessel(userId), JSON.stringify(behalten));
  } catch { /* Speicher voll oder gesperrt: Ablage gilt dann nur bis zum Neuladen */ }
}

function setzen(next: Partial<Zustand>) {
  zustand = { ...zustand, ...next };
  if (!echt) speichern();
  hoerer.forEach((h) => h());
}

function aendern(id: string, patch: Partial<AblageEintrag>) {
  // Läuft ein echter Lebenslauf noch, während das Beispiel zu sehen ist: Er bekommt seinen Stand trotzdem.
  if (echt && !zustand.eintraege.some((e) => e.id === id)) {
    echt = { ...echt, eintraege: echt.eintraege.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
    speichern(echt);
    return;
  }
  setzen({ eintraege: zustand.eintraege.map((e) => (e.id === id ? { ...e, ...patch } : e)) });
}

/** Einmal je angemeldetem Headhunter: gespeicherte Ablage laden. Liefen beim Neuladen noch Lesevorgänge, gelten sie als unterbrochen. */
export function ablageStarten(uid: string) {
  if (userId === uid) return;
  userId = uid;
  dateien.clear();
  laufend = 0;
  let geladen: AblageEintrag[] = [];
  try { geladen = JSON.parse(localStorage.getItem(schluessel(uid)) ?? '[]') as AblageEintrag[]; } catch { geladen = []; }
  geladen = geladen
    .filter((e) => e.status !== 'angelegt' || Date.now() - (e.angelegtAm ?? 0) < ANGELEGT_SICHTBAR_MS)
    // Alte Stände mit Prüfschritt („bereit“, „doppelt“) laufen neu durch und werden angelegt bzw. ergänzt.
    .map((e) => (['wartet', 'laedt', 'liest', 'legtAn', 'bereit', 'doppelt'].includes(e.status)
      ? (e.pdfPath || e.text
        ? { ...e, status: 'unterbrochen' as const }
        : { ...e, status: 'fehler' as const, fehler: ta('err.uploadInterrupted') })
      : e))
    // Neu geladen, bevor der Hinweis bestätigt war: lieber selbst Bescheid geben.
    .map((e) => (e.hinweis === 'laeuft' ? { ...e, hinweis: 'fehler' as const, hinweisFehler: ta('err.noticeUnsure') } : e));
  if (echt) { echt = { eintraege: geladen, wartenAufZustimmung: [] }; return; }
  zustand = { eintraege: geladen, wartenAufZustimmung: [] };
  hoerer.forEach((h) => h());
}

/** Bühne des Rundgangs auf (mit Beispiel) oder zu (null): echten Stand beiseitelegen bzw. zurückholen. */
export function ablageBeispiel(b: AblageBeispiel | null) {
  beispielTimer.forEach((t) => window.clearTimeout(t));
  beispielTimer.clear();
  if (b) {
    if (!echt) { echt = zustand; zustand = leer(); }
    beispiel = b;
  } else {
    beispiel = null;
    if (!echt) return;
    zustand = echt;
    echt = null;
  }
  hoerer.forEach((h) => h());
  // Zurück im Echten: Lebensläufe, die während des Beispiels warteten, laufen jetzt weiter.
  if (!b) weiter();
}

/**
 * Stand des Beispiels je Schritt: leer, das Fenster mit dem Beispiel-Lebenslauf offen, oder der
 * Kandidat angelegt. „angelegt“ lässt einen laufenden Durchgang (liest …) in Ruhe.
 */
export function ablageBeispielStand(stand: 'leer' | 'fenster' | 'angelegt') {
  if (!beispiel || !echt) return;
  const b = beispiel;
  // Schon ein Eintrag da (etwa noch „liest …“ nach „Hochladen“): weiterlaufen lassen.
  if (stand === 'angelegt' && zustand.eintraege.length) return;
  if (stand === 'fenster' && !zustand.eintraege.length && zustand.wartenAufZustimmung[0]?.name === b.datei) return;
  beispielTimer.forEach((t) => window.clearTimeout(t));
  beispielTimer.clear();
  if (stand === 'leer') zustand = leer();
  if (stand === 'fenster') {
    // Etwa so groß wie ein echter Lebenslauf; der Inhalt wird nie gelesen.
    zustand = { eintraege: [], wartenAufZustimmung: [new File([new Uint8Array(186_000)], b.datei, { type: 'application/pdf' })] };
  }
  if (stand === 'angelegt') {
    zustand = { eintraege: [{ id: crypto.randomUUID(), dateiname: b.datei, status: 'angelegt', erstellt: Date.now(), name: b.name, kurz: b.kurz,
      kandidatId: b.kandidatId, ergaenzt: false, angelegtAm: Date.now(), hinweisWahl: 'matchunt' }], wartenAufZustimmung: [] };
  }
  hoerer.forEach((h) => h());
}

/** „Hochladen“ im Beispiel: Zustände nur vorspielen, nichts geht ins Netz. */
function beispielVerarbeiten(id: string, b: AblageBeispiel) {
  const spaeter = (ms: number, patch: Partial<AblageEintrag>) => {
    const t = window.setTimeout(() => { beispielTimer.delete(t); aendern(id, patch); }, ms);
    beispielTimer.add(t);
  };
  aendern(id, { status: 'liest' });
  spaeter(1500, { status: 'legtAn', name: b.name, kurz: b.kurz });
  spaeter(2100, { status: 'angelegt', kandidatId: b.kandidatId, name: b.name, ergaenzt: false, angelegtAm: Date.now() });
}

/** Abgelegte oder gewählte Dateien: falsche aussortieren, Rest wartet auf die Datenschutz-Frage. */
export function ablageAnfragen(files: File[]): { abgelehnt: { name: string; grund: string }[] } {
  const abgelehnt: { name: string; grund: string }[] = [];
  const ok: File[] = [];
  for (const f of files) {
    const grund = cvFileProblem(f);
    if (grund) abgelehnt.push({ name: f.name, grund }); else ok.push(f);
  }
  if (ok.length) setzen({ wartenAufZustimmung: [...zustand.wartenAufZustimmung, ...ok] });
  return { abgelehnt };
}

/** Drei Häkchen bestätigt: dieser Lebenslauf in die Ablage und lesen; der nächste wartende ist dran. */
export function ablageZustimmen(o: { hinweis: boolean }) {
  const [f, ...rest] = zustand.wartenAufZustimmung;
  if (!f) return;
  const id = crypto.randomUUID();
  const neu: AblageEintrag = { id, dateiname: f.name, status: 'wartet', erstellt: Date.now(), hinweisWahl: o.hinweis ? 'matchunt' : 'selbst', bestaetigtAm: Date.now() };
  if (beispiel && echt) {
    setzen({ eintraege: [neu, ...zustand.eintraege], wartenAufZustimmung: rest });
    beispielVerarbeiten(id, beispiel);
    return;
  }
  dateien.set(id, f);
  setzen({ eintraege: [neu, ...zustand.eintraege], wartenAufZustimmung: rest });
  weiter();
}

/** Abbrechen: dieser Lebenslauf wird nicht hochgeladen, ein weiterer wartender ist dran. */
export function ablageAbbrechen() {
  setzen({ wartenAufZustimmung: zustand.wartenAufZustimmung.slice(1) });
}

/** „Andere Datei“ im Fenster: den aktuellen Lebenslauf austauschen. Liefert den Grund, wenn die Datei nicht geht. */
export function ablageDateiTauschen(f: File): string | null {
  const grund = cvFileProblem(f);
  if (grund) return grund;
  setzen({ wartenAufZustimmung: [f, ...zustand.wartenAufZustimmung.slice(1)] });
  return null;
}

export function ablageEntfernen(id: string) {
  dateien.delete(id);
  setzen({ eintraege: zustand.eintraege.filter((e) => e.id !== id) });
}

export function ablageNochmal(id: string) {
  if (echt) return;
  const e = zustand.eintraege.find((x) => x.id === id);
  if (!e) return;
  if (!e.pdfPath && !e.text && !dateien.has(id)) { aendern(id, { status: 'fehler', fehler: ta('err.fileGone') }); return; }
  aendern(id, { status: 'wartet', fehler: undefined });
  weiter();
}

export function ablageAngelegt(id: string, kandidatId: string, name?: string, ergaenzt = false) {
  const e = zustand.eintraege.find((x) => x.id === id);
  aendern(id, { status: 'angelegt', kandidatId, name: name ?? e?.name, ergaenzt, angelegtAm: Date.now(), cv: null, text: undefined, ...(ergaenzt ? { abweichungen: 0 } : {}) });
  // Von Hand angelegt (Name nicht erkannt): Nachweis und Hinweis wie beim automatischen Anlegen.
  if (e && !ergaenzt && !e.hinweis && !echt) void nachweisUndHinweis(e, kandidatId);
}

const kurzVon = (cv: CvExtraction) => {
  const f = dossierFromCv(cv).form;
  return {
    name: f.full_name.trim() || undefined,
    kurz: [f.job_title, f.experience_years ? i18n.t('candidateTerms:pattern.yearsShort', { n: f.experience_years }) : '', f.city].filter(Boolean).join(' · ') || undefined,
    form: f,
  };
};

/** Neuer Lebenslauf für einen bestehenden Kandidaten: nur leere Felder füllen, neue Stationen dazu. */
async function inAkteLegen(uid: string, candidateId: string, cv: CvExtraction, fileInfo: CvFileInfo | null) {
  const fromCv = dossierFromCv(cv);
  const [{ form: before }, exps, notesRow] = await Promise.all([
    fetchDossier(candidateId),
    supabase.from('candidate_experiences').select('company_name, start_date').eq('candidate_id', candidateId),
    supabase.from('candidate_interview_notes').select('id').eq('candidate_id', candidateId).order('updated_at', { ascending: false, nullsFirst: false }).limit(1),
  ]);
  const { changes } = mergeCvIntoDossier(before, fromCv.form, fromCv.origins);
  const neu = changes.filter((c) => c.kind === 'new');
  const merged: DossierForm = { ...before };
  for (const c of neu) {
    (merged as unknown as Record<string, unknown>)[c.key] = Array.isArray(c.incoming)
      ? [...(before[c.key] as unknown[]), ...(c.incoming as unknown[])]
      : c.incoming;
  }
  const addStations = newStations((exps.data ?? []) as { company_name: string | null; start_date: string | null }[], cv.stations ?? []);
  const notesId = ((notesRow.data ?? [])[0] as { id?: string } | undefined)?.id ?? null;
  await saveCvIntoExisting({ userId: uid, candidateId, before, merged, cv, fileInfo, addStations, notesId });
  return { ergaenzt: neu.length + addStations.length, abweichungen: changes.filter((c) => c.kind === 'conflict').length };
}

/**
 * Nachweis der drei Häkchen speichern und, wenn gewählt, den Hinweis von Matchunt schicken.
 * Läuft nach dem Anlegen; ein Fehler hier macht den Kandidaten nicht rückgängig.
 */
async function nachweisUndHinweis(e: AblageEintrag, candidateId: string) {
  const wahl = e.hinweisWahl ?? 'selbst';
  if (wahl === 'matchunt') aendern(e.id, { hinweis: 'laeuft' });
  try {
    const r = await einladungApi.lebenslaufNachweis({ candidate_id: candidateId, hinweis: wahl === 'matchunt', datei: e.dateiname });
    if (r.hinweis === 'fehler' && devMockEnabled()) { aendern(e.id, { hinweis: 'test', hinweisAm: Date.now() }); return; }
    aendern(e.id, { hinweis: r.hinweis, hinweisAm: r.am ? Date.parse(r.am) : Date.now(), hinweisFehler: r.message });
  } catch (err) {
    if (devMockEnabled()) { aendern(e.id, { hinweis: wahl === 'matchunt' ? 'test' : 'selbst', hinweisAm: Date.now() }); return; }
    aendern(e.id, { hinweis: wahl === 'matchunt' ? 'fehler' : 'selbst', hinweisFehler: err instanceof Error ? err.message : undefined });
  }
}

async function verarbeiten(e: AblageEintrag) {
  const uid = userId;
  if (!uid) return;
  try {
    let { pdfPath, text, fileInfo } = e;
    if (!pdfPath && !text) {
      const datei = dateien.get(e.id);
      if (!datei) throw new Error(ta('err.fileGone'));
      aendern(e.id, { status: 'laedt' });
      const up = await uploadCvFile(uid, datei);
      ({ pdfPath, text, fileInfo } = up);
      aendern(e.id, { pdfPath, text, fileInfo });
      dateien.delete(e.id);
    }
    aendern(e.id, { status: 'liest' });
    const cv = await readCv({ pdfPath, text });
    if (userId !== uid) return;
    const { name, kurz, form } = kurzVon(cv);
    if (!form.full_name.trim()) {
      // Ohne Namen kein Kandidat: von Hand anlegen (der Lebenslauf liegt schon bereit).
      aendern(e.id, { cv, kurz, status: 'fehler', fehler: ta('err.nameUnsure') });
      return;
    }
    aendern(e.id, { cv, name, kurz, status: 'legtAn' });
    const dublette = await findDuplicate(uid, form);
    if (dublette) {
      const r = await inAkteLegen(uid, dublette.id, cv, fileInfo ?? null);
      if (userId !== uid) return;
      // Abweichungen zum Ansehen: dafür bleibt der gelesene Lebenslauf im Eintrag.
      aendern(e.id, {
        status: 'angelegt', kandidatId: dublette.id, name: dublette.full_name, ergaenzt: true, ergaenztAnzahl: r.ergaenzt,
        abweichungen: r.abweichungen, dublette: { id: dublette.id, full_name: dublette.full_name }, angelegtAm: Date.now(),
        cv: r.abweichungen ? cv : null, text: undefined,
      });
      void nachweisUndHinweis(e, dublette.id);
      return;
    }
    const res = await saveNewCandidateFromCv({ userId: uid, form, cv, fileInfo: fileInfo ?? null, stations: cv.stations ?? [] });
    if (userId !== uid) return;
    aendern(e.id, {
      status: 'angelegt', kandidatId: res.candidateId, name: form.full_name.trim(), ergaenzt: false,
      ohneEmail: !form.email.trim(), angelegtAm: Date.now(), cv: null, text: undefined,
      fehler: res.failed.length ? ta('err.notSaved', { list: res.failed.map((x) => term(x)).join(', ') }) : undefined,
    });
    void nachweisUndHinweis(e, res.candidateId);
  } catch (err) {
    if (userId !== uid) return;
    aendern(e.id, { status: 'fehler', fehler: err instanceof Error ? err.message : ta('row.readFailed') });
  }
}

/** Nach „E-Mail ergänzen“ in der Kandidatenkarte. */
export function ablageEmailErgaenzt(id: string) {
  aendern(id, { ohneEmail: false });
}

function weiter() {
  if (echt) return;
  while (laufend < GLEICHZEITIG) {
    const naechster = [...zustand.eintraege].reverse().find((e) => e.status === 'wartet');
    if (!naechster) return;
    laufend += 1;
    aendern(naechster.id, { status: naechster.pdfPath || naechster.text ? 'liest' : 'laedt' });
    void verarbeiten(naechster).finally(() => { laufend -= 1; weiter(); });
  }
}

/** Dateiauswahl des Rechners öffnen, mehrere Dateien möglich. */
export function lebenslaufWaehlen() {
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.accept = '.pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
  input.onchange = () => {
    const files = Array.from(input.files ?? []);
    if (files.length) ablageMelden(ablageAnfragen(files));
  };
  input.click();
}

/** Abgelehnte Dateien melden; wird von der Leiste gesetzt, damit hier kein UI-Import nötig ist. */
let melder: (abgelehnt: { name: string; grund: string }[]) => void = () => {};
export function ablageMelderSetzen(f: typeof melder) { melder = f; }
export function ablageMelden(r: { abgelehnt: { name: string; grund: string }[] }) { if (r.abgelehnt.length) melder(r.abgelehnt); }

const abonnieren = (h: () => void) => { hoerer.add(h); return () => { hoerer.delete(h); }; };
const lesen = () => zustand;

export function useLebenslaufAblage() {
  return useSyncExternalStore(abonnieren, lesen, lesen);
}
