import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { intlLocale } from '@/i18n/languages';
import {
  chipLabelT, frageIntroT, frageKurzT, frageTextT, frageWhyT, slotLabelT, wertAnzeigeT,
} from '@/lib/briefCatalogText';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  BRIEF_QUESTIONS, DIALOG_QUESTIONS, EMPTY_CATALOG_STATE, bedingungGilt, chipTreffer, completeness,
  frageKurz, frageNach, frageText, hatWert, nextQuestion, sizeBand, slotChipWert, slotChips, slotLabel,
  type BriefPlace, type BriefQuestion, type BriefSlot, type CatalogState, type Known, type SlotState,
} from '@/lib/briefCatalog';
import { CatalogFields, type AufbauVorschlaege } from '@/components/dashboard/intake/CatalogFields';
import { SlotEingabe } from '@/components/dashboard/intake/CatalogBriefing';
import { EuroSpanne, SkillList, type FlexibilityMap, type SkillVorschlag } from '@/components/dashboard/intake/ProfileSections';
import { Textarea } from '@/components/ui/textarea';
import type { BuiltJob, FreelanceTerms } from '@/components/dashboard/intake/types';
import type { Answers } from '@/components/dashboard/IntakeBriefing';
import { BENEFIT_GRUPPEN, CONTRACTING_GRUPPEN, benefitAnzeige, benefitGruppeAnzeige } from './BenefitsBlock';
import { CompanyBlock, type CompanyDraft, type Anreicherung } from './CompanyBlock';
import type { CaptureState } from './CaptureStep';
import { SEKUNDEN } from './etappenZeit';
import { AnzeigeEtikett } from './AnzeigeEtikett';
import { gleicherWert } from '@/lib/anzeigeZitat';
import { aufbauAlsText, istAufbau } from '../../../../supabase/functions/_shared/abteilung';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Sparkles, X } from 'lucide-react';

/**
 * Die Aufnahme in Etappen (J12, 04.11.2026; Standard seit 11.11.2026).
 *
 * Dieselbe Aufnahme wie die zweispaltige Ansicht, nur Schritt fuer Schritt:
 * dieselben Fragen im Wortlaut des Katalogs, dieselben Felder, derselbe
 * Zustand (CaptureState), dieselbe Speicherung, dieselben Sperren beim
 * Weitergehen. Nichts an Regeln oder Daten ist neu.
 *
 * Seit 11.11.2026 der Standard fuer Dashboard und /start. Die alte
 * zweispaltige Ansicht erscheint nur noch mit `ansicht="bisher"`.
 *
 * Reihenfolge: das Formular wie bisher (Eckdaten, Verguetung, Anforderungen,
 * Rahmendaten), die Briefing-Fragen dort eingestreut, wo sie am besten
 * hinpassen (Entscheidung Marko, 02.11.2026). Wireframes:
 * ux-analyse-2026-10/realistisch/echt_j12_leer_*.html.
 */

type Etappe = 0 | 1 | 2 | 3;
// Nur Schlüssel -- die Texte stehen in den Sprachdateien (intake: etappen.stage.*).
const ETAPPEN = ['eckdaten', 'verguetung', 'anforderungen', 'rahmendaten'] as const;
type T = TFunction<['intake', 'intakeCatalog']>;
const etappenName = (t: T, e: Etappe, freelance: boolean) =>
  t(`etappen.stage.${freelance && e === 1 ? 'konditionen' : ETAPPEN[e]}`);

type Teil =
  | { art: 'eckdaten' }
  | { art: 'dialog'; frage: string }
  | { art: 'felder'; place: BriefPlace; nur: string[] }
  | { art: 'verguetung' }
  | { art: 'kriterien' }
  | { art: 'benefits' }
  | { art: 'firma' };

interface Schritt {
  id: string;
  etappe: Etappe;
  /** Der Titel steht in den Sprachdateien: etappen.step.<id>, bei Contracting etappen.stepContracting.<id>. */
  titelContracting?: true;
  teile: Teil[];
}

const SCHRITTE: Schritt[] = [
  { id: 'worum', etappe: 0, teile: [{ art: 'eckdaten' }] },
  { id: 'warum', etappe: 0, teile: [{ art: 'dialog', frage: 'vakanz' }] },
  { id: 'alltag', etappe: 0, teile: [{ art: 'dialog', frage: 'alltag' }] },
  { id: 'abteilung', etappe: 0, teile: [{ art: 'felder', place: 'eckdaten', nur: ['department_structure', 'team_size'] }] },
  { id: 'entscheidung', etappe: 0, teile: [{ art: 'dialog', frage: 'entscheidung' }] },
  {
    id: 'vertrag', etappe: 0, titelContracting: true,
    teile: [{ art: 'felder', place: 'eckdaten', nur: ['remote_days', 'contract_limitation'] }, { art: 'dialog', frage: 'vertrag' }],
  },
  { id: 'verguetung', etappe: 1, titelContracting: true, teile: [{ art: 'verguetung' }] },
  { id: 'foerderung', etappe: 1, teile: [{ art: 'dialog', frage: 'foerderung' }] },
  { id: 'kriterien', etappe: 2, teile: [{ art: 'kriterien' }] },
  { id: 'passung', etappe: 2, teile: [{ art: 'dialog', frage: 'passung' }] },
  { id: 'sourcing', etappe: 2, teile: [{ art: 'dialog', frage: 'sourcing' }] },
  { id: 'firma', etappe: 3, teile: [{ art: 'firma' }] },
  { id: 'benefits', etappe: 3, teile: [{ art: 'benefits' }] },
  { id: 'usp', etappe: 3, titelContracting: true, teile: [{ art: 'dialog', frage: 'usp' }] },
  { id: 'kultur', etappe: 3, titelContracting: true, teile: [{ art: 'dialog', frage: 'kultur' }] },
  { id: 'branche', etappe: 3, teile: [{ art: 'dialog', frage: 'branche' }] },
  { id: 'arbeitszeit', etappe: 3, titelContracting: true, teile: [{ art: 'felder', place: 'arbeitszeit', nur: ['arbeitszeit'] }] },
  { id: 'auswahl', etappe: 3, teile: [{ art: 'dialog', frage: 'auswahlprozess' }] },
  {
    id: 'gremien', etappe: 3, titelContracting: true,
    teile: [{ art: 'felder', place: 'arbeitszeit', nur: ['gremien', 'vertragstempo'] }],
  },
  {
    id: 'erlaubnis', etappe: 3,
    teile: [{ art: 'felder', place: 'arbeitszeit', nur: ['arbeitserlaubnis', 'abwerbeschutz'] }],
  },
  { id: 'einwaende', etappe: 3, teile: [{ art: 'dialog', frage: 'einwaende' }] },
];

const PRUEFEN = 'pruefen';

/** Hoechstens so viele KI-Nachfragen je Aufnahme -- wie im Briefing. */
const MAX_NACHFRAGEN = 5;

/** Herkünfte mit Hinweis -- der Text steht unter intake: shared.source.<herkunft>. */
const QUELLEN = ['ad', 'enrich', 'inherit', 'derive'];

const frage = (key: string) => BRIEF_QUESTIONS.find((q) => q.key === key);
const SLOT = new Map(BRIEF_QUESTIONS.flatMap((q) => q.slots.map((s) => [s.key, { s, q }] as const)));

/**
 * Der Wert als deutscher Text -- NUR fuer die Antwort, die an die KI geht
 * (`schrittAbschliessen`). Auf dem Bildschirm steht `wertAnzeigeT`.
 */
const zeige = (v: unknown): string => {
  // Gewichtung der Aufgaben kommt als [{ bereich, anteil }] -- sonst stand
  // in der Pruefliste nur "[object Object]" bzw. "angegeben" (13.11.2026).
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (x && typeof x === 'object' && 'bereich' in x) {
        const o = x as { bereich?: unknown; anteil?: unknown };
        return o.anteil != null ? `${String(o.bereich)} ${String(o.anteil)} %` : String(o.bereich);
      }
      return String(x);
    }).join(' · ');
  }
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('min' in o || 'max' in o) {
      const a = o.min ? Number(o.min).toLocaleString('de-DE') : null;
      const b = o.max ? Number(o.max).toLocaleString('de-DE') : null;
      return a && b ? `${a} – ${b}` : (a ?? b ?? '—');
    }
    // Gewichtung der Aufgaben: { "Außendienst": 80, "Werkstatt": 20 }
    const teile = Object.entries(o);
    if (teile.length && teile.every(([, x]) => typeof x === 'number')) return teile.map(([k, x]) => `${k} ${x} %`).join(' · ');
    if (istAufbau(o)) return aufbauAlsText(o) || 'angegeben';
    return 'angegeben';
  }
  return String(v ?? '');
};

interface FollowUp {
  id: string;
  question: string;
  why: string;
  chips: string[];
  multi: boolean;
  fills_slot: string | null;
}

interface Props {
  state: CaptureState;
  onState: (updater: (prev: CaptureState) => CaptureState) => void;
  /** Die Firmenzeile -- dieselbe wie in der bisherigen Ansicht. */
  firmaZeile: React.ReactNode;
  /** "Festanstellung · ändern" */
  onVertragsart: () => void;
  /** Zurueck zur Startauswahl (Anzeige doch einfuegen). */
  onZurAuswahl: () => void;
  katalogKnown: Known;
  setKatalog: (key: string, value: unknown) => void;
  setKatalogVon: (key: string, value: unknown, from: SlotState['from']) => void;
  bestaetige: (key: string) => void;
  ausAnzeigeOffen: string[];
  aufbauVorschlaege: AufbauVorschlaege;
  jobDraft: Record<string, unknown>;
  askAi: (payload: Record<string, unknown>) => Promise<Record<string, any>>;
  sperren: { key: string; label: string; kurz?: string }[];
  weiter: () => void;
  nextLabel: string;
  onResumeLater: () => void;
  firmaFest: unknown;
  company: Partial<CompanyDraft>;
  onCompany: (patch: Partial<CompanyDraft>) => void;
  onEnrich: (domain?: string) => Promise<Anreicherung | { reason: string; message: string }>;
  openQuestions: { id: string; text: string; chapter: string; weight: number }[];
  answers: Answers;
  erfasst: number;
  feldGesamt: number;
  /** "✓ Gespeichert" bzw. "Speichert …" -- steht im Kopf dieser Ansicht. */
  speicherStand?: React.ReactNode;
  /** Rechts oben im Kopf, z. B. der Ablauf "1 Position — 2 Paket & Anfragen" (Dashboard). */
  kopfRechts?: React.ReactNode;
  /** Meldet, solange dieser Kopf sichtbar ist -- der Fensterkopf blendet dann seinen Titel aus. */
  onKopf?: (sichtbar: boolean) => void;
}

export function EtappenAnsicht({
  state, onState, firmaZeile, onVertragsart, onZurAuswahl, katalogKnown, setKatalog, setKatalogVon, bestaetige,
  ausAnzeigeOffen, aufbauVorschlaege, jobDraft, askAi, sperren, weiter, nextLabel, onResumeLater, firmaFest,
  company, onCompany, onEnrich, speicherStand, kopfRechts, onKopf,
}: Props) {
  const { t, i18n } = useTranslation(['intake', 'intakeCatalog']);
  /** Deutscher Wortlaut -- fuer die Zitat-Suche in einer deutschen Anzeige bei anderer Oberflaechensprache. */
  const tDe = i18n.getFixedT('de', 'intake');
  useEffect(() => {
    onKopf?.(true);
    return () => onKopf?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { type, built: b, freelance, flexibility, dyn } = state;
  const built = b as BuiltJob;
  const katalog: CatalogState = dyn.catalog ?? EMPTY_CATALOG_STATE;
  const asked = katalog.askedQuestions ?? [];
  const isFreelance = type === 'freelance';

  /** Der Katalogzustand -- dieselbe Stelle, an die das Briefing schreibt. */
  const setCatalog = useCallback(
    (updater: (p: CatalogState) => CatalogState) =>
      onState((s) => ({ ...s, dyn: { ...s.dyn, catalog: updater(s.dyn.catalog ?? EMPTY_CATALOG_STATE) } })),
    [onState],
  );
  const setBuilt = (patch: Partial<BuiltJob>) =>
    onState((s) => (s.built ? { ...s, built: { ...s.built, ...patch } } : s));

  // ---- Welche Schritte es fuer diese Aufnahme gibt -----------------------
  const teilSichtbar = (t: Teil): boolean => {
    if (t.art === 'firma') return !firmaFest;
    if (t.art === 'dialog') {
      const q = frage(t.frage);
      return !!q && (!q.only || q.only === type) && q.slots.some((s) => !s.only || s.only === type);
    }
    if (t.art === 'felder') {
      return BRIEF_QUESTIONS.some((q) =>
        q.place === t.place && (!q.only || q.only === type) &&
        q.slots.some((s) => (!s.only || s.only === type) && !s.imFormular && (t.nur.includes(q.key) || t.nur.includes(s.key))));
    }
    return true;
  };
  const schritte = useMemo(
    () => SCHRITTE
      .map((s) => ({ ...s, teile: s.teile.filter(teilSichtbar) }))
      .filter((s) => s.teile.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, !!firmaFest],
  );

  /** Zu welchem Schritt gehoert eine Zeile des Katalogs? */
  const schrittVonSlot = useMemo(() => {
    const m = new Map<string, string>();
    for (const st of schritte) {
      for (const t of st.teile) {
        if (t.art === 'dialog') frage(t.frage)?.slots.forEach((s) => m.set(s.key, st.id));
        if (t.art === 'felder') {
          BRIEF_QUESTIONS.filter((q) => q.place === t.place).forEach((q) =>
            q.slots.forEach((s) => { if (t.nur.includes(q.key) || t.nur.includes(s.key)) m.set(s.key, st.id); }));
        }
        if (t.art === 'verguetung') frage('verguetung')?.slots.forEach((s) => m.set(s.key, st.id));
        if (t.art === 'kriterien') frage('kriterien')?.slots.forEach((s) => m.set(s.key, st.id));
        if (t.art === 'firma') frage('firmengroesse')?.slots.forEach((s) => m.set(s.key, st.id));
      }
    }
    return m;
  }, [schritte]);

  // Der Schritt steht im Entwurf (`__schritt`, keine Spalte) -- wer spaeter
  // weitermacht, beginnt dort, wo er aufgehoert hat.
  const [aktiv, setAktiv] = useState<string>(() => {
    const gemerkt = String(katalogKnown.__schritt?.value ?? '');
    return gemerkt === PRUEFEN || schritte.some((x) => x.id === gemerkt) ? gemerkt : schritte[0]?.id ?? 'worum';
  });
  const istPruefen = aktiv === PRUEFEN;
  // Faellt ein Schritt weg (Vertragsart gewechselt), steht der erste da.
  const index = istPruefen ? schritte.length : Math.max(0, schritte.findIndex((s) => s.id === aktiv));
  const schritt: Schritt | null = istPruefen ? null : schritte[index] ?? null;
  const oben = useRef<HTMLDivElement>(null);
  const inhalt = useRef<HTMLDivElement>(null);
  /** Erst nach einem Klick auf "Weiter" sagt der Schritt, was fehlt -- vorher keine Warnung. */
  const [versucht, setVersucht] = useState(false);
  /** Nach dem Wechsel beginnt der Schritt oben, die erste Antwort hat den Fokus. */
  const nachOben = () => {
    let el: HTMLElement | null = oben.current?.parentElement ?? null;
    while (el) {
      const st = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight) { el.scrollTop = 0; return; }
      el = el.parentElement;
    }
    window.scrollTo({ top: 0 });
  };
  const geheZu = (id: string) => {
    setAktiv(id);
    setVersucht(false);
    if (katalogKnown.__schritt?.value !== id) setKatalog('__schritt', id);
    // Zweimal: einmal sofort, einmal nach dem Zeichnen -- sonst blieb der
    // Ausschnitt manchmal halb unten stehen (Durchklick 04.11.2026).
    window.setTimeout(nachOben, 0);
    window.setTimeout(() => {
      nachOben();
      inhalt.current
        ?.querySelector<HTMLElement>('input:not([type=checkbox]):not([type=hidden]), textarea, [data-feld] button')
        ?.focus({ preventScroll: true });
    }, 60);
  };
  /** Ohne Anzeige ist nichts vorgewaehlt: gewaehlt ist, was der Kunde angeklickt hat oder die Anzeige sagt. */
  const ausAnzeige = Object.values(katalogKnown).some((v) => v?.from === 'ad');
  /** Wortlaut der Anzeige fuer die Zitate (13.11.2026). */
  const anzeigeText = (state.dyn as { anzeigeText?: string | null }).anzeigeText ?? null;
  /** Was die Anzeige je Feld sagte -- bleibt, auch nach einer anderen Wahl (13.11.2026). */
  const anzeigeWerte = (state.dyn as { anzeigeWerte?: Record<string, unknown> }).anzeigeWerte ?? {};
  const adVon = (k: string): unknown =>
    k in anzeigeWerte ? anzeigeWerte[k] : katalogKnown[k]?.from === 'ad' ? katalogKnown[k]?.value : undefined;
  const adRemote = ('remote_type' in anzeigeWerte ? anzeigeWerte.remote_type
    : ausAnzeige && !katalogKnown.remote_type__gewaehlt?.value ? built.remote_type || 'hybrid' : undefined) as string | undefined;
  const adErfahrung = ('experience_level' in anzeigeWerte ? anzeigeWerte.experience_level
    : ausAnzeige && !katalogKnown.experience_level__gewaehlt?.value ? built.experience_level || 'mid' : undefined) as string | undefined;
  const gewaehlt = (feld: 'remote_type' | 'experience_level' | 'extension_possible') =>
    (feld !== 'extension_possible' && ausAnzeige) || !!katalogKnown[`${feld}__gewaehlt`]?.value;

  // ---- Fortschritt: dieselbe Rechnung wie bisher -------------------------
  const fortschritt = useMemo(() => completeness(katalogKnown, type), [katalogKnown, type]);

  // Die gerechnete Zahl wandert in den Zustand -- der Autosave nimmt sie mit
  // (intake_drafts.completeness). Bisher erledigt das CatalogBriefing, das in
  // dieser Ansicht nicht gerendert wird.
  useEffect(() => {
    if (katalog.completeness !== fortschritt.pct) setCatalog((p) => ({ ...p, completeness: fortschritt.pct }));
  }, [fortschritt.pct, katalog.completeness, setCatalog]);

  const kriterien = useMemo(() => {
    const alle = [...(built.must_haves ?? []), ...(built.nice_to_haves ?? [])];
    return [...new Set(alle.map((s) => String(s).trim()))].filter(Boolean);
  }, [built.must_haves, built.nice_to_haves]);
  const kriterienFertig = kriterien.length >= 3 && kriterien.every((k) => flexibility[k]) && kriterien.some((k) => flexibility[k] === 'fix');

  /** Was in einem Schritt noch offen ist -- Pflichtzeilen wie im Zaehler. */
  const offenIn = (st: { id: string; teile: Teil[] }) => {
    // Die Kriterien zaehlen nach der Regel ihres Schritts (3, alle eingestuft,
    // eins unverzichtbar) -- nicht ueber "Was kann nachgeschult werden?".
    let n = fortschritt.offen.filter((s) => s.q.key !== 'kriterien' && schrittVonSlot.get(s.key) === st.id).length;
    for (const t of st.teile) {
      if (t.art === 'eckdaten') {
        if (!built.title?.trim()) n++;
        if (!built.location?.trim() && built.remote_type !== 'remote') n++;
      }
      if (t.art === 'kriterien' && !kriterienFertig) n++;
      if (t.art === 'firma' && !String(company.company_name ?? '').trim()) n++;
    }
    return n;
  };
  const offenEtappe = (e: Etappe) => schritte.filter((s) => s.etappe === e).reduce((n, s) => n + offenIn(s), 0);

  const sekundenOffen = useMemo(() => {
    let sek = 0;
    let schritteOffen = 0;
    for (const st of schritte) {
      let s = 0;
      for (const sl of fortschritt.offen) if (sl.q.key !== 'kriterien' && schrittVonSlot.get(sl.key) === st.id) s += SEKUNDEN[sl.form] ?? 10;
      for (const t of st.teile) {
        if (t.art === 'eckdaten') s += (built.title?.trim() ? 0 : 10) + (built.location?.trim() ? 0 : 10);
        if (t.art === 'kriterien' && !kriterienFertig) s += 60;
        if (t.art === 'benefits' && !(built.benefits ?? []).length) s += 30;
      }
      if (s > 0) { sek += s; schritteOffen++; }
    }
    return sek + schritteOffen * 6;
  }, [schritte, fortschritt.offen, schrittVonSlot, built, kriterienFertig]);
  const minuten = Math.max(1, Math.round(sekundenOffen / 60));

  /** Der Speicherwert eines Chips ("Nein" -> false usw.), wie im Katalog. */
  const chipWertVon = (key: string, chip: string) => {
    const e = SLOT.get(key);
    return e ? slotChipWert(e.s, type, chip) : chip;
  };

  /**
   * Benefits: Was der Kunde schon gesagt hat, ist angehakt (A13). Homeoffice
   * kam in "Homeoffice und Vertrag", der Bonus in "Verguetung". Je Benefit
   * nur einmal -- nimmt der Kunde den Haken heraus, bleibt er draussen.
   */
  // Gemerkt im Entwurf (`__benefits_auto`): was einmal automatisch angehakt
  // wurde, kommt nicht wieder, wenn der Kunde den Haken herausnimmt.
  const automatisch = Array.isArray(katalogKnown.__benefits_auto?.value) ? (katalogKnown.__benefits_auto!.value as string[]) : [];
  useEffect(() => {
    if (aktiv !== 'benefits' || isFreelance) return;
    const hat = built.benefits ?? [];
    const dazu: string[] = [];
    const tage = katalogKnown.remote_days?.value;
    if (hatWert(katalogKnown, 'remote_days') && Number(tage) !== 0) dazu.push('Home-Office möglich');
    const bonus = katalogKnown.bonus_structure?.value;
    if (hatWert(katalogKnown, 'bonus_structure') && bonus !== chipWertVon('bonus_structure', 'Nein') && bonus !== false) {
      dazu.push('Bonus / Prämien');
    }
    const neu = dazu.filter((x) => !hat.includes(x) && !automatisch.includes(x));
    if (neu.length) {
      setBuilt({ benefits: [...hat, ...neu] });
      setKatalog('__benefits_auto', [...automatisch, ...neu]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv]);

  // ---- KI: dieselben Aufrufe wie im Briefing -----------------------------
  const nr = useRef(0);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [fuAuswahl, setFuAuswahl] = useState<string[]>([]);
  const [fuText, setFuText] = useState('');

  const ernten = useCallback(
    async (q: BriefQuestion | null, antwort: string, offen: BriefSlot[], known: Known) => {
      const meine = ++nr.current;
      try {
        const request = {
          contract_type: type,
          job_draft: jobDraft,
          question: q
            ? { key: q.key, text: frageText(q, type), slots: q.slots.map((s) => ({ key: s.key, label: slotLabel(s, type), form: s.form, chips: slotChips(s, type) })) }
            : undefined,
          answer: antwort,
          open_slots: offen.map((s) => ({ key: s.key, label: slotLabel(s, type), form: s.form, chips: slotChips(s, type) })),
          known: Object.fromEntries(Object.entries(known).map(([k, v]) => [k, v?.value])),
          asked_followups: katalog.askedFollowups,
        };
        const data = await askAi(request);
        if (meine !== nr.current) return;
        if (!data || data.error) throw new Error(data?.error ?? 'no data');
        setCatalog((p) => {
          const k: Known = { ...p.known };
          for (const [key, roh] of Object.entries(data.slot_values ?? {})) {
            if (k[key]) continue;
            const v = chipTreffer(key, roh, type);
            if (v === undefined || v === null) continue;
            k[key] = { value: v, from: 'derive' };
          }
          return {
            ...p,
            known: k,
            aiAvailable: true,
            model: data.model ?? p.model,
            // Wie im Briefing: kein Widerspruch, wenn nur Chip (Ebene) und
            // Wortlaut der Anzeige (Rolle) auseinanderliegen.
            conflicts: [
              ...p.conflicts,
              ...(Array.isArray(data.conflicts) ? data.conflicts : []).filter((c: { slot?: string; existing?: unknown; neu?: unknown }) => {
                const w = p.known[`${c?.slot}__wortlaut`]?.value;
                if (typeof w !== 'string') return true;
                const lw = w.toLowerCase();
                return ![c?.existing, c?.neu].some((x) => String(x ?? '').toLowerCase().includes(lw));
              }),
            ],
            skillSuggestions: Array.isArray(data.skill_suggestions) ? data.skill_suggestions : [],
            answerSuggestions: {
              ...(p.answerSuggestions ?? {}),
              ...(data.answer_suggestions && typeof data.answer_suggestions === 'object' ? data.answer_suggestions : {}),
            },
            envelopePatch: { ...p.envelopePatch, ...(data.reveal_envelope_patch ?? {}) },
          };
        });
        const fu = data.follow_up as FollowUp | null | undefined;
        const schonBeantwortet = !!fu?.fills_slot && known[fu.fills_slot]?.from === 'answer';
        if (q && fu && !schonBeantwortet && katalog.askedFollowups.length < MAX_NACHFRAGEN) setFollowUp(fu);
      } catch (e) {
        if (meine !== nr.current) return;
        console.warn('[EtappenAnsicht] KI nicht erreichbar — die Aufnahme laeuft ohne weiter:', e);
        setCatalog((p) => ({ ...p, aiAvailable: false }));
      }
    },
    [type, jobDraft, askAi, katalog.askedFollowups, setCatalog],
  );

  // Erster Aufruf wie im Briefing: aus dem Entwurf ernten.
  const geerntet = useRef(false);
  useEffect(() => {
    if (geerntet.current) return;
    geerntet.current = true;
    const offen = DIALOG_QUESTIONS.flatMap((q) => q.slots).filter((s) => katalogKnown[s.key]?.from !== 'answer');
    void ernten(null, '', offen, katalogKnown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Vorschlaege fuer die Freitextzeilen des Schritts, der gerade dasteht --
   * derselbe kleine Nachruf wie im Briefing je Frage. Ohne KI bleiben die
   * festen Chips des Katalogs (SlotEingabe, `kiAus`).
   */
  const vorschlagGeholt = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (katalog.aiAvailable === false || !schritt) return;
    for (const q of dialogFragen(schritt)) {
      if (vorschlagGeholt.current.has(q.key)) continue;
      const fehlen = q.slots.filter((sl) => (sl.form === 'ai' || sl.form === 'text') && !(katalog.answerSuggestions?.[sl.key]?.length));
      if (!fehlen.length) continue;
      vorschlagGeholt.current.add(q.key);
      askAi({
        contract_type: type,
        job_draft: jobDraft,
        question: { key: q.key, text: frageText(q, type), slots: q.slots.map((sl) => ({ key: sl.key, label: slotLabel(sl, type), form: sl.form, chips: slotChips(sl, type) })) },
        answer: '',
        open_slots: fehlen.map((sl) => ({ key: sl.key, label: slotLabel(sl, type), form: sl.form, chips: slotChips(sl, type) })),
        known: Object.fromEntries(Object.entries(katalogKnown).map(([k, v]) => [k, v?.value])),
        asked_followups: katalog.askedFollowups,
      })
        .then((data) => {
          const neu = data?.answer_suggestions;
          if (!neu || typeof neu !== 'object') return;
          setCatalog((p) => ({ ...p, answerSuggestions: { ...(p.answerSuggestions ?? {}), ...(neu as Record<string, string[]>) } }));
        })
        .catch((e) => console.warn('[EtappenAnsicht] Vorschlaege nicht geladen:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktiv, katalog.aiAvailable]);

  // ---- Weiter ------------------------------------------------------------
  function dialogFragen(st: Schritt | null) {
    return (st?.teile ?? []).filter((t): t is { art: 'dialog'; frage: string } => t.art === 'dialog')
      .map((t) => frage(t.frage)!)
      .filter(Boolean);
  }
  const sichtbareSlots = (q: BriefQuestion) =>
    q.slots.filter((s) => (!s.only || s.only === type) && bedingungGilt(katalogKnown, s));

  /** Pflichtzeilen der Gespraechsfragen dieses Schritts, die noch leer sind. */
  const fehlendeImSchritt = (st: Schritt | null) =>
    dialogFragen(st)
      .filter((q) => !asked.includes(q.key))
      .flatMap((q) => sichtbareSlots(q).filter((s) => s.required && !hatWert(katalogKnown, s.key)));

  const fehlend = fehlendeImSchritt(schritt);
  /**
   * Schritt 1 haelt ohne Titel und Ort an -- ohne Titel wird der Entwurf gar
   * nicht gespeichert (N1, Nachtest 05.11.2026). Hier gibt es kein "Weiß ich nicht".
   */
  const fehltEck = schritt?.teile.some((t) => t.art === 'eckdaten')
    ? [
        ...(!built.title?.trim() ? [{ key: 'title', label: t('shared.jobTitle') }] : []),
        ...(!built.location?.trim() ? [{ key: 'location', label: t('shared.location') }] : []),
      ]
    : [];

  /**
   * Was das Briefing bei "Weiter" tut, je Gespraechsfrage des Schritts:
   * vorbefuellte Werte werden zur Antwort, die Frage gilt als gestellt, und
   * die KI erntet im Hintergrund.
   */
  const schrittAbschliessen = (st: Schritt | null, weissNicht = false) => {
    const fragen = dialogFragen(st);
    if (fragen.length === 0) return;
    const known: Known = { ...katalogKnown };
    const worte: string[] = [];
    for (const q of fragen) {
      if (asked.includes(q.key) && !weissNicht) continue;
      for (const s of sichtbareSlots(q)) {
        const v = known[s.key]?.value;
        if (weissNicht || v === undefined || v === null || (Array.isArray(v) && v.length === 0) || String(v).trim?.() === '') continue;
        if (known[s.key]?.from !== 'answer') setKatalog(s.key, v);
        known[s.key] = { value: v, from: 'answer' };
        worte.push(`${slotLabel(s, type)}: ${zeige(v)}`);
      }
    }
    setCatalog((p) => ({ ...p, askedQuestions: [...new Set([...(p.askedQuestions ?? []), ...fragen.map((q) => q.key)])] }));
    const antwort = worte.join('\n');
    if (antwort) {
      const restOffen = DIALOG_QUESTIONS.flatMap((q) => q.slots).filter((s) => known[s.key]?.from !== 'answer');
      void ernten(fragen[0], antwort, restOffen, known);
    }
  };

  /** Variante A (13.11.2026): "Weiter" uebernimmt, was aus der Anzeige im Schritt steht. */
  const uebernimmAusAnzeige = (st: Schritt | null) => {
    if (!st) return;
    for (const k of ausAnzeigeOffen) if (schrittVonSlot.get(k) === st.id) bestaetige(k);
    if (ausAnzeige && st.teile.some((t) => t.art === 'eckdaten')) {
      if (!katalogKnown.remote_type__gewaehlt?.value) setKatalog('remote_type__gewaehlt', true);
      if (!katalogKnown.experience_level__gewaehlt?.value) setKatalog('experience_level__gewaehlt', true);
    }
  };

  const vor = () => {
    if (fehltEck.length > 0 || fehlend.length > 0) {
      setVersucht(true);
      const el = inhalt.current?.querySelector<HTMLElement>(`[data-feld="${fehltEck[0]?.key ?? fehlend[0].key}"]`);
      // Ohne weiches Scrollen: das lief sonst noch, waehrend der naechste
      // Schritt schon nach oben wollte.
      el?.scrollIntoView({ block: 'nearest' });
      return;
    }
    schrittAbschliessen(schritt);
    uebernimmAusAnzeige(schritt);
    const naechster = schritte[index + 1];
    geheZu(naechster ? naechster.id : PRUEFEN);
  };
  const zurueck = () => {
    if (index > 0) geheZu(schritte[index - 1].id);
  };

  const followUpAbsenden = (ueberspringen = false) => {
    if (!followUp) return;
    const teile = [...fuAuswahl];
    if (fuText.trim()) teile.push(fuText.trim());
    const text = teile.join(' · ');
    const fu = followUp;
    setCatalog((p) => {
      const known: Known = { ...p.known };
      if (!ueberspringen && fu.fills_slot && text) known[fu.fills_slot] = { value: text, from: 'answer' };
      return { ...p, known, askedFollowups: [...p.askedFollowups, fu.id] };
    });
    setFollowUp(null);
    setFuAuswahl([]);
    setFuText('');
  };

  /** Ein Sprungziel aus der Liste "fehlt noch" -- der Schritt, in dem es steht. */
  const schrittFuer = (key: string): string | null => {
    if (key === 'title' || key === 'location') return 'worum';
    if (key === 'company_name') return schritte.some((s) => s.id === 'firma') ? 'firma' : 'worum';
    if (key === 'kriterien') return 'kriterien';
    if (key === 'briefing') {
      const n = nextQuestion(katalogKnown, type, asked);
      return n ? schritte.find((s) => s.teile.some((t) => t.art === 'dialog' && t.frage === n.frage.key))?.id ?? null : null;
    }
    return schrittVonSlot.get(key) ?? null;
  };

  // ---- Darstellung -------------------------------------------------------
  const titelVon = (s: Schritt) => t(isFreelance && s.titelContracting ? `etappen.stepContracting.${s.id}` : `etappen.step.${s.id}`);


  /**
   * Was aus der Anzeige kam und noch nicht uebernommen ist (Variante A,
   * 13.11.2026): je Schritt, je Etappe und insgesamt. Arbeitsmodell und
   * Erfahrung zaehlen zu Schritt 1, bis der Kunde sie waehlt oder weitergeht.
   */
  const offenAusAnzeige = (stId: string) => {
    let n = ausAnzeigeOffen.filter((k) => schrittVonSlot.get(k) === stId).length;
    if (ausAnzeige && schritte.find((x) => x.id === stId)?.teile.some((t) => t.art === 'eckdaten')) {
      if (!katalogKnown.remote_type__gewaehlt?.value) n += 1;
      if (!katalogKnown.experience_level__gewaehlt?.value) n += 1;
    }
    return n;
  };
  const ausAnzeigeAnzahl = schritte.reduce((n, st) => n + offenAusAnzeige(st.id), 0);
  const ausAnzeigeEtappe = (e: Etappe) => schritte.filter((st) => st.etappe === e).reduce((n, st) => n + offenAusAnzeige(st.id), 0);

  const teilRendern = (teil: Teil, i: number) => {
    switch (teil.art) {
      case 'eckdaten':
        return (
          <div key={i} className="space-y-3">
            <p className="text-base font-semibold">{t('etappen.whatAbout')}</p>
            {/* Variante A (Entscheidung Marko 13.11.2026): statt einer langen
                Liste ein Satz -- geprueft wird dort, wo die Frage steht. */}
            {ausAnzeigeAnzahl > 0 && (
              <p className="rounded-lg border px-3 py-2 text-xs text-muted-foreground">
                {t('etappen.anzeige.taken', { count: ausAnzeigeAnzahl })}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className={cn('mb-1 text-sm font-medium', versucht && !built.title?.trim() && 'text-amber-600')}>{t('shared.jobTitle')}</p>
                <Input data-feld="title" value={built.title} onChange={(e) => setBuilt({ title: e.target.value })} placeholder={t('etappen.titlePlaceholder')} />
              </div>
              <div>
                <p className={cn('mb-1 text-sm font-medium', versucht && !built.location?.trim() && 'text-amber-600')}>{t('shared.location')}</p>
                <Input data-feld="location" value={built.location} onChange={(e) => setBuilt({ location: e.target.value })} placeholder={t('etappen.locationPlaceholder')} />
              </div>
            </div>
            <div data-feld="remote_type" data-aus-anzeige={ausAnzeige && !katalogKnown.remote_type__gewaehlt?.value ? 'ja' : undefined}>
              <p className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium">
                {t('shared.workModel')}
                {adRemote && (
                  <AnzeigeEtikett anzeige={anzeigeText} wert={t(`shared.remote.${adRemote}`)} alternativen={[tDe(`shared.remote.${adRemote}`)]} abweichend={(built.remote_type || 'hybrid') !== adRemote} />
                )}
              </p>
              <ChipWahl
                optionen={[['remote', t('shared.remote.remote')], ['hybrid', t('shared.remote.hybrid')], ['onsite', t('shared.remote.onsite')]]}
                wert={gewaehlt('remote_type') ? built.remote_type || 'hybrid' : ''}
                onWahl={(v) => { setBuilt({ remote_type: v }); setKatalog('remote_type__gewaehlt', true); }}
                anzeige={adRemote}
              />
            </div>
            <div data-feld="experience_level" data-aus-anzeige={ausAnzeige && !katalogKnown.experience_level__gewaehlt?.value ? 'ja' : undefined}>
              <p className="mb-1.5 flex items-baseline gap-1.5 text-sm font-medium">
                {t('shared.experience')}
                {adErfahrung && (
                  <AnzeigeEtikett anzeige={anzeigeText} wert={t(`shared.level.${adErfahrung}`)} alternativen={[tDe(`shared.level.${adErfahrung}`)]} abweichend={(built.experience_level || 'mid') !== adErfahrung} />
                )}
              </p>
              <ChipWahl
                optionen={[['junior', t('shared.level.junior')], ['mid', t('shared.level.mid')], ['senior', t('shared.level.senior')], ['lead', t('shared.level.lead')]]}
                wert={gewaehlt('experience_level') ? built.experience_level || 'mid' : ''}
                onWahl={(v) => { setBuilt({ experience_level: v }); setKatalog('experience_level__gewaehlt', true); }}
                anzeige={adErfahrung}
              />
            </div>
            <div className="sm:w-1/2">
              <p className="mb-1 text-sm font-medium">{t('shared.industry')}</p>
              <Input value={built.industry} onChange={(e) => setBuilt({ industry: e.target.value })} placeholder={t('etappen.industryPlaceholder')} />
            </div>
          </div>
        );

      case 'dialog': {
        const q = frage(teil.frage)!;
        const slots = sichtbareSlots(q);
        const istGestellt = asked.includes(q.key);
        const unbeantwortet = slots.filter((s) => s.required && !hatWert(katalogKnown, s.key));
        const hatPflicht = q.slots.some((s) => s.required && (!s.only || s.only === type));
        return (
          <div key={i} className="space-y-3">
            {q.intro && <p className="text-xs italic text-muted-foreground">{frageIntroT(q)}</p>}
            <p className="text-base font-semibold leading-snug">{frageTextT(q, type)}</p>
            <div className="space-y-3">
              {slots.map((s) => (
                <div key={s.key} data-feld={s.key} tabIndex={-1} className="scroll-mt-24 outline-none"
                     data-aus-anzeige={katalogKnown[s.key]?.from === 'ad' ? 'ja' : undefined}>
                  <p className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
                    <span className={cn('text-sm font-medium', versucht && s.required && !istGestellt && !hatWert(katalogKnown, s.key) ? 'text-amber-600' : 'text-foreground')}>
                      {slotLabelT(s, type)}
                    </span>
                    {!s.required && <span className="text-[10px]">{t('shared.optional')}</span>}
                    {adVon(s.key) !== undefined ? (
                      <AnzeigeEtikett anzeige={anzeigeText} wert={adVon(s.key)} anzeigeText={wertAnzeigeT(s.key, adVon(s.key), type)} abweichend={!gleicherWert(katalogKnown[s.key]?.value, adVon(s.key))} />
                    ) : QUELLEN.includes(katalogKnown[s.key]?.from ?? '') && (
                      <span className="rounded-full border border-input px-1.5 py-px text-[10px] font-normal text-muted-foreground">{t(`shared.source.${katalogKnown[s.key]!.from}`)}</span>
                    )}
                  </p>
                  {typeof katalogKnown[`${s.key}__wortlaut`]?.value === 'string' && (
                    <p className="-mt-1 mb-1.5 text-[10px] text-muted-foreground">
                      {t('etappen.adWording', { text: String(katalogKnown[`${s.key}__wortlaut`]!.value) })}
                    </p>
                  )}
                  {(s.form === 'ai' || s.form === 'text') ? (
                    <BausteinFeld
                      wert={katalogKnown[s.key]?.value}
                      angebote={katalog.answerSuggestions?.[s.key]?.length
                        ? katalog.answerSuggestions[s.key]
                        : s.form === 'ai' && katalog.aiAvailable !== false ? [] : (slotChips(s, type) ?? [])}
                      onSet={(v) => setKatalog(s.key, v)}
                      anzeige={(a) => chipLabelT(s, type, a)}
                    />
                  ) : (
                  <SlotEingabe
                    contract={type}
                    slot={s}
                    wert={katalogKnown[s.key]?.value}
                    quelle={katalogKnown[s.key]?.from}
                    anzeigeWert={adVon(s.key)}
                    vorschlaege={katalog.answerSuggestions?.[s.key]}
                    onSet={(v) => setKatalog(s.key, typeof v === 'string' && v === '' ? undefined : v)}
                    onToggle={(c) => {
                      const cur = Array.isArray(katalogKnown[s.key]?.value) ? (katalogKnown[s.key]!.value as string[]) : [];
                      // Der erste Klick auf einen markierten Wert aus der Anzeige
                      // bestaetigt ihn -- wie bei Feldern mit einer Auswahl. Vorher
                      // entfernte er ihn (Durchklick 13.11.2026).
                      if (katalogKnown[s.key]?.from === 'ad' && cur.includes(c)) { setKatalog(s.key, cur); return; }
                      setKatalog(s.key, cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);
                    }}
                    kiAus={katalog.aiAvailable === false}
                  />
                  )}
                </div>
              ))}
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" /> {frageWhyT(q)}
            </p>
            {hatPflicht && istGestellt && unbeantwortet.length > 0 && (
              <p className="text-[11px] text-muted-foreground">{t('etappen.notedDontKnow')}</p>
            )}
          </div>
        );
      }

      case 'felder':
        return (
          <div key={i}>
            <CatalogFields
              place={teil.place}
              nur={teil.nur}
              known={katalogKnown}
              onSet={setKatalog}
              onConfirm={bestaetige}
              contract={type}
              mustHaves={built.must_haves ?? []}
              aufbauVorschlaege={aufbauVorschlaege}
              treppeOhneWeiter
              gross
              anzeige={anzeigeText}
              anzeigeWerte={anzeigeWerte}
            />
            {teil.nur.map((k) => frage(k)).filter((q): q is BriefQuestion => !!q && (!q.only || q.only === type)).map((q) => (
              <p key={q.key} className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" /> {frageWhyT(q)}
              </p>
            ))}
            {teil.nur.includes('department_structure') && frage('team')?.why && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" /> {frageWhyT(frage('team')!)}
              </p>
            )}
          </div>
        );

      case 'verguetung': {
        const q = frage('verguetung');
        return (
          <div key={i} className="space-y-4">
            {/* Der Katalog hat fuer Contracting keine eigene Fassung dieser
                Frage ("Fixgehalt") -- dort steht die Zeile selbst als Frage. */}
            {q && !isFreelance && <p className="text-base font-semibold leading-snug">{frageTextT(q, type)}</p>}
            {isFreelance ? (
              <div className="space-y-3">
                <div>
                  <p className="mb-1.5 text-base font-semibold">{t('profile.budgetPerDay')}</p>
                  <EuroSpanne
                    feld="day_rate_range" von={freelance.dayRateMin} bis={freelance.dayRateMax} einheit={t('profile.perDay')}
                    onVon={(n) => onState((s) => ({ ...s, freelance: { ...s.freelance, dayRateMin: n } }))}
                    onBis={(n) => onState((s) => ({ ...s, freelance: { ...s.freelance, dayRateMax: n } }))}
                  />
                </div>
                <div className="sm:w-1/2">
                  <p className="mb-1 text-sm font-medium">{t('profile.duration')}</p>
                  <Input
                    data-feld="contract_duration_months" inputMode="numeric" placeholder={t('etappen.durationPlaceholder')}
                    value={freelance.durationMonths ?? ''}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '');
                      onState((s) => ({ ...s, freelance: { ...s.freelance, durationMonths: v ? Number(v) : null } }));
                    }}
                  />
                </div>
                <div data-feld="utilization_days_per_week">
                  <p className="mb-1.5 text-sm font-medium">{t('profile.utilization')}</p>
                  <ChipWahl
                    optionen={[1, 2, 3, 4, 5].map((d) => [String(d), t('profile.daysPerWeek', { count: d })] as [string, string])}
                    wert={freelance.utilizationDaysPerWeek ? String(freelance.utilizationDaysPerWeek) : ''}
                    onWahl={(v) => onState((s) => ({ ...s, freelance: { ...s.freelance, utilizationDaysPerWeek: Number(v) } }))}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-sm font-medium">{t('profile.extension')} <span className="text-xs font-normal text-muted-foreground">{t('shared.optional')}</span></p>
                  {/* Nichts vorgewaehlt: der Haken stand vorher schon drin. */}
                  <ChipWahl
                    optionen={[['ja', t('shared.yes')], ['nein', t('shared.no')]]}
                    wert={gewaehlt('extension_possible') ? (freelance.extensionPossible ? 'ja' : 'nein') : ''}
                    onWahl={(v) => {
                      onState((s) => ({ ...s, freelance: { ...s.freelance, extensionPossible: v === 'ja' } }));
                      setKatalog('extension_possible__gewaehlt', true);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="sm:w-2/3">
                <p className="mb-1 text-sm font-medium">{t('profile.salaryRange')}</p>
                <EuroSpanne
                  feld="salary_range" von={built.salary_min} bis={built.salary_max} einheit={t('profile.perYear')}
                  onVon={(n) => setBuilt({ salary_min: n })} onBis={(n) => setBuilt({ salary_max: n })}
                />
              </div>
            )}
            <CatalogFields place="verguetung" known={katalogKnown} onSet={setKatalog} onConfirm={bestaetige} contract={type} gross anzeige={anzeigeText} anzeigeWerte={anzeigeWerte} />
            {q?.why && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" /> {frageWhyT(q)}
              </p>
            )}
          </div>
        );
      }

      case 'kriterien':
        return <KriterienTeil key={i} state={state} onState={onState} />;

      case 'benefits':
        return (
          <BenefitsTeil
            key={i}
            type={type}
            gewaehlt={built.benefits ?? []}
            automatisch={automatisch.filter((x) => (built.benefits ?? []).includes(x))}
            onChange={(v) => {
              setBuilt({ benefits: v });
              // Ein Haken bei Gleitzeit fuellt die Arbeitszeit vor -- als
              // Vorschlag, den der Kunde dort bestaetigt.
              if (!isFreelance && v.includes('Gleitzeit ohne Kernzeit') && !hatWert(katalogKnown, 'core_hours')) {
                setKatalogVon('core_hours', chipWertVon('core_hours', 'Gleitzeit ohne Kernzeit'), 'derive');
              }
            }}
          />
        );

      case 'firma':
        return (
          <div key={i} className="space-y-3">
            <p className="text-base font-semibold">{t('etappen.companyHeading')}</p>
            <CompanyBlock
              werte={company}
              ausAnzeige={{ company_name: built.company_name, industry: built.industry }}
              onChange={onCompany}
              onEnrich={onEnrich}
              onHeadcount={(n) => setKatalogVon('company_size_band', sizeBand(n), 'enrich')}
            />
            <div className="border-t pt-4">
              <CatalogFields place="firma" known={katalogKnown} onSet={setKatalog} onConfirm={bestaetige} contract={type} gross anzeige={anzeigeText} anzeigeWerte={anzeigeWerte} />
            </div>
            <p className="text-xs text-muted-foreground">{t('etappen.companyNote')}</p>
          </div>
        );
    }
  };

  const etappeVon = schritt?.etappe ?? null;
  const inEtappe = etappeVon === null ? [] : schritte.filter((s) => s.etappe === etappeVon);
  const posInEtappe = schritt ? inEtappe.findIndex((s) => s.id === schritt.id) + 1 : 0;
  // ---- Kopf wie eine Stellenanzeige: Initialen und Kaertchen ------------
  const firmenName = String((firmaFest as { name?: string } | null)?.name || company?.company_name || built.company_name || '');
  const initialen = firmenName.split(/\s+/).filter((w) => /^[A-Za-zÄÖÜ0-9]/.test(w) && !/^(gmbh|ag|kg|se|ug|co\.?|&)$/i.test(w))
    .slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '·';
  const euro = (n?: number | null) => (n ? `${Number(n).toLocaleString(intlLocale(i18n.language))} €` : null);
  const spanne = (a?: number | null, b?: number | null) => (a && b ? `${euro(a)} – ${euro(b)}` : euro(a) ?? euro(b));
  const gehalt = isFreelance ? spanne(freelance.dayRateMin, freelance.dayRateMax) : spanne(built.salary_min, built.salary_max);
  const monate = katalogKnown.salary_months?.value;
  const befristung = katalogKnown.contract_limitation?.value;
  const kaertchen: { key: string; leer: string; wert: string | null }[] = [
    { key: 'remote', leer: t('shared.workModel'), wert: gewaehlt('remote_type') ? t(`shared.remote.${built.remote_type || 'hybrid'}`) : null },
    { key: 'erfahrung', leer: t('shared.experience'), wert: gewaehlt('experience_level') ? t(`shared.level.${built.experience_level || 'mid'}`) : null },
    isFreelance
      ? { key: 'budget', leer: t('etappen.kopf.budgetPerDay'), wert: gehalt ? t('etappen.kopf.perDay', { value: gehalt }) : null }
      : { key: 'gehalt', leer: t('etappen.kopf.salary'), wert: gehalt ? `${gehalt}${monate ? ` · ${t('etappen.kopf.salaries', { n: String(monate) })}` : ''}` : null },
    ...(befristung && !isFreelance ? [{ key: 'befristung', leer: '', wert: String(wertAnzeigeT('contract_limitation', befristung, type)) }] : []),
  ];

  const ortZeile = istPruefen ? t('etappen.review')
    : etappeVon !== null ? t('etappen.placeLine', { stage: etappenName(t, etappeVon, isFreelance), pos: posInEtappe, total: inEtappe.length }) : '';

  return (
    /* Gewaehlt = hell gefuellt, auf einen Blick (gilt fuer alle Knoepfe dieser Ansicht).
       min-h-full + mt-auto: die Fussleiste steht immer unten und wandert nicht
       mit dem Inhalt -- vorher lief der erste Klick auf "Weiter" ins Leere,
       wenn sich darueber etwas verschob (Durchklick 04.11.2026). */
    <div
      ref={oben}
      className={cn(
        'flex min-h-full flex-col gap-3 [&_.border-primary]:border-foreground [&_.border-primary]:bg-foreground [&_.border-primary]:text-background',
        // Farbe 2A (13.11.2026): Was aus der Anzeige kommt und noch nicht
        // uebernommen ist, traegt einen blauen Rand -- Orange bleibt "fehlt noch".
        '[&_[data-aus-anzeige=ja]_.border-primary]:ring-2 [&_[data-aus-anzeige=ja]_.border-primary]:ring-blue-500/70',
        '[&_[data-aus-anzeige=ja]_textarea]:border-blue-500/60 [&_[data-aus-anzeige=ja]_input]:border-blue-500/60',
        '[&_[data-aus-anzeige=ja]_.bg-foreground]:ring-2 [&_[data-aus-anzeige=ja]_.bg-foreground]:ring-blue-500/70',
      )}
    >
      {/* ---- Kopf wie eine Stellenanzeige (Entscheidung Marko 13.11.2026, J1) ----
          Logo, Titel, Firma und Ort, darunter Kaertchen, die sich aus den
          Antworten fuellen -- leere sind gestrichelt. Der Titel steht nur hier
          (nicht noch einmal im Fensterkopf), die Firmenzeile kam aus der Leiste. */}
      <div className="shrink-0 border-b">
        <div className="flex items-start gap-3 pb-3 pr-8">
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary sm:flex" aria-hidden>
            {initialen}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">{built.title || t('etappen.newPosition')}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground [&>*]:mt-0">{firmaZeile}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onVertragsart}
                className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-accent"
              >
                {t('etappen.changeKind', { kind: isFreelance ? t('shared.contracting') : t('shared.permanent') })}
              </button>
              {kaertchen.map((k) => (
                <span
                  key={k.key}
                  className={cn(
                    'rounded-md border px-2 py-0.5 text-xs',
                    k.wert ? 'bg-muted/40 text-foreground' : 'border-dashed text-muted-foreground/70',
                  )}
                >
                  {k.wert ?? k.leer}
                </span>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {kopfRechts}
            <span className="text-xs text-muted-foreground">
              {!istPruefen && sekundenOffen > 0 && t('etappen.minutesLeft', { minutes: minuten })}
              {!istPruefen && sekundenOffen > 0 && speicherStand && ' · '}
              {speicherStand}
            </span>
          </div>
        </div>
        <div className="h-[3px] bg-muted" title={`${fortschritt.pct} %`}>
          <div className="h-full bg-foreground/70 transition-all" style={{ width: `${fortschritt.pct}%` }} />
        </div>
      </div>

      <div className="grid flex-1 gap-5 md:grid-cols-[11.5rem_minmax(0,1fr)] md:items-start">
        {/* ---- Leiste links: nur wo man steht, ohne Farben und Zahlen ---- */}
        <nav className="hidden space-y-0.5 md:sticky md:top-0 md:block" aria-label={t('etappen.stagesAria')}>
          {([0, 1, 2, 3] as Etappe[]).map((e) => {
            const erster = schritte.find((s) => s.etappe === e);
            if (!erster) return null;
            const istAktiv = etappeVon === e;
            const fertig = offenEtappe(e) === 0;
            return (
              <div key={e}>
                <button
                  type="button"
                  onClick={() => geheZu(erster.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
                    // Hover nur ueber die Schrift: sonst sahen zwei Eintraege aktiv aus (N3, 05.11.2026).
                    istAktiv ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {fertig && !istAktiv ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
                  {etappenName(t, e, isFreelance)}
                  {ausAnzeigeEtappe(e) > 0 && (
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground" title={t('etappen.anzeige.countTitle')}>
                      {ausAnzeigeEtappe(e)}
                    </span>
                  )}
                </button>
                {istAktiv && (
                  <p className="pb-1 pl-8 pt-0.5 text-xs text-muted-foreground">{t('etappen.stepOf', { pos: posInEtappe, total: inEtappe.length })}</p>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => geheZu(PRUEFEN)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
              istPruefen ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="w-3.5 shrink-0" />
            {t('etappen.review')}
          </button>
          {ausAnzeigeAnzahl > 0 && <p className="px-2.5 pt-1 text-[10px] text-muted-foreground">{t('etappen.anzeige.countLegend')}</p>}
          <button
            type="button"
            onClick={onZurAuswahl}
            className="mt-4 px-2.5 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('etappen.backToChoice')}
          </button>
        </nav>

        {/* ---- Der Schritt ---- */}
        <div className="min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground md:hidden">
            {ortZeile}{!istPruefen && sekundenOffen > 0 && <> · {t('etappen.minutesLeft', { minutes: minuten })}</>}
          </p>
          <div ref={inhalt} className="space-y-4 rounded-xl border bg-card p-4">
            {/* Die Nachfrage der KI zur letzten Antwort -- sichtbar als solche. */}
            {followUp && !istPruefen && (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3 w-3" /> {t('etappen.followUpHead')}
                </p>
                <p className="mb-2.5 text-sm font-medium leading-snug">{followUp.question}</p>
                {followUp.chips.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {followUp.chips.map((c) => (
                      <button key={c} type="button"
                        onClick={() => setFuAuswahl((p) => (followUp.multi ? (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]) : [c]))}
                        className={cn('rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                          fuAuswahl.includes(c) ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input value={fuText} onChange={(e) => setFuText(e.target.value)} placeholder={t('etappen.followUpPlaceholder')} className="h-7 text-xs" />
                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => followUpAbsenden(true)}>{t('shared.skip')}</Button>
                  <Button size="sm" className="h-7 px-3 text-xs" onClick={() => followUpAbsenden()}>{t('shared.ok')}</Button>
                </div>
              </div>
            )}

            {katalog.conflicts.map((c, i) => (
              <div key={`${c.slot}-${i}`} className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-xs">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>{c.note || t('etappen.conflict', { slot: c.slot, existing: c.existing, neu: c.neu })}</span>
                <button type="button" className="ml-auto shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setCatalog((p) => ({ ...p, conflicts: p.conflicts.filter((_, j) => j !== i) }))}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {istPruefen ? (
              <Pruefen
                state={state}
                // Statt "Briefing (2 von 10 Fragen)" die Schritte mit offenen
                // Fragen beim Namen, je mit Sprung dorthin (N5, 06.11.2026).
                sperren={sperren.flatMap((x) => {
                  if (x.key !== 'briefing') return [x];
                  const offeneSchritte = schritte.filter((st) => fehlendeImSchritt(st).length > 0);
                  return offeneSchritte.length > 0
                    ? offeneSchritte.map((st) => ({ key: `schritt:${st.id}`, label: titelVon(st) }))
                    : [x];
                })}
                onSprung={(k) => {
                  const z = k.startsWith('schritt:') ? k.slice('schritt:'.length) : schrittFuer(k);
                  if (z) geheZu(z);
                }}
                vorbelegt={[...(!gewaehlt('remote_type') ? ['remote_type'] : []), ...(!gewaehlt('experience_level') ? ['experience_level'] : [])]}
              />
            ) : (
              schritt?.teile.map((t, i) => (
                <div key={`${schritt.id}-${i}`} className={cn(i > 0 && 'border-t pt-4')}>{teilRendern(t, i)}</div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---- Fussleiste: ein einziges "Weiter", immer unten ---- */}
      <div className="sticky -bottom-5 z-20 -mx-4 -mb-5 mt-auto flex shrink-0 items-center gap-3 border-t bg-background px-4 pb-8 pt-3 md:-mx-6 md:px-6">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={zurueck} disabled={index <= 0}>
          <ArrowLeft className="h-4 w-4" /> {t('shared.back')}
        </Button>
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs">
          {istPruefen && sperren.length > 0 && (
            <span className="truncate text-muted-foreground">{t('etappen.fillFirst')}</span>
          )}
          {!istPruefen && !(versucht && (fehltEck.length > 0 || fehlend.length > 0)) && schritt && offenAusAnzeige(schritt.id) > 0 && (
            <span className="truncate text-muted-foreground">{t('etappen.anzeige.prefilledHint')}</span>
          )}
          {/* Erst nach einem Klick auf "Weiter": was fehlt, und der Ausweg. */}
          {!istPruefen && versucht && fehltEck.length > 0 && (
            <span className="truncate text-amber-600">{t('shared.stillMissing', { fields: fehltEck.map((x) => x.label).join(', ') })}</span>
          )}
          {!istPruefen && versucht && fehltEck.length === 0 && fehlend.length > 0 && (
            <>
              <span className="truncate text-amber-600">{t('shared.stillMissing', { fields: fehlend.map((x) => slotLabelT(x, type)).join(', ') })}</span>
              <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs" onClick={() => { schrittAbschliessen(schritt, true); uebernimmAusAnzeige(schritt); geheZu(schritte[index + 1]?.id ?? PRUEFEN); }}>
                {t('shared.dontKnow')}
              </Button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onResumeLater}
          className="shrink-0 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {t('shared.resumeLater')}
        </button>
        {istPruefen ? (
          <Button
            onClick={weiter}
            disabled={sperren.length > 0}
            className={cn('shrink-0 gap-2', sperren.length > 0 && 'border border-input bg-muted text-muted-foreground opacity-100')}
          >
            {nextLabel} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={vor} className="shrink-0 gap-2">
            {t('shared.next')} <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ChipWahl({ optionen, wert, onWahl, anzeige }: { optionen: [string, string][]; wert: string; onWahl: (v: string) => void; anzeige?: string }) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  return (
    <div className="flex flex-wrap gap-1.5">
      {optionen.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onWahl(v)}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
            wert === v ? 'border-primary bg-primary/10 text-foreground'
              // Was die Anzeige sagt, bleibt gestrichelt sichtbar (13.11.2026).
              : anzeige === v ? 'border-dashed border-blue-500/70 text-blue-600 hover:bg-accent dark:text-blue-300'
              : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          title={anzeige === v && wert !== v ? t('etappen.anzeige.optionTitle') : undefined}
        >
          {wert === v && <Check className="h-2.5 w-2.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Freitext mit Vorschlaegen: ein angeklickter Vorschlag steht als Baustein im
 * Feld, mit x zum Entfernen; daneben eigene Worte. Gespeichert wird derselbe
 * Text wie bisher ("Baustein · Baustein · eigene Worte").
 */
/**
 * Die Gewichtung der Aufgaben steht als { Bereich: Anteil } im Entwurf -- so
 * liest sie die Karte des Recruiters. Im Feld stand dadurch "[object Object]"
 * (Durchklick 13.11.2026). Gezeigt wird "Bereich 80 % · …"; bleibt die Form
 * beim Aendern erhalten, wird wieder ein Objekt daraus.
 */
const istAnteile = (w: unknown): w is Record<string, number> =>
  !!w && typeof w === 'object' && !Array.isArray(w) && Object.values(w).length > 0
  && Object.values(w).every((x) => typeof x === 'number');
const anteileAusText = (text: string): Record<string, number> | null => {
  const teile = text.split('·').map((x) => x.trim()).filter(Boolean).map((x) => x.match(/^(.+?)\s+(\d{1,3})\s*%$/));
  return teile.length && teile.every(Boolean) ? Object.fromEntries(teile.map((m) => [m![1], Number(m![2])])) : null;
};

function BausteinFeld({ wert, angebote, onSet, anzeige }: {
  wert: unknown;
  angebote: string[];
  onSet: (v: unknown) => void;
  /** Beschriftung eines Bausteins in der Sprache des Lesers; gespeichert wird der Baustein selbst. */
  anzeige: (baustein: string) => string;
}) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  const anteile = istAnteile(wert);
  const text = Array.isArray(wert)
    ? wert.filter(Boolean).join(' · ')
    : anteile
      ? Object.entries(wert).map(([k, x]) => `${k} ${x} %`).join(' · ')
      : String(wert ?? '');
  const teile = text ? text.split(' · ') : [];
  let n = 0;
  while (n < teile.length && angebote.includes(teile[n].trim())) n++;
  const bausteine = teile.slice(0, n).map((t) => t.trim());
  const frei = teile.slice(n).join(' · ');
  const schreibe = (b: string[], f: string) => {
    const v = [...b, ...(f.trim() ? [f] : [])].join(' · ');
    const alsAnteile = anteile ? anteileAusText(v) : null;
    onSet(alsAnteile ?? (v || undefined));
  };
  const offen = angebote.filter((a) => !bausteine.includes(a));
  return (
    <div className="space-y-2">
      {offen.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {offen.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => schreibe([...bausteine, a], frei)}
              className="rounded-full border border-dashed border-input px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              + {anzeige(a)}
            </button>
          ))}
        </div>
      )}
      <div className="rounded-md border border-input bg-background px-2.5 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {bausteine.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {bausteine.map((b) => (
              <span key={b} className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-0.5 text-xs text-background">
                {anzeige(b)}
                <button type="button" aria-label={t('etappen.block.remove', { name: anzeige(b) })} onClick={() => schreibe(bausteine.filter((x) => x !== b), frei)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <Textarea
          value={frei}
          rows={2}
          onChange={(e) => schreibe(bausteine, e.target.value)}
          placeholder={bausteine.length ? t('etappen.block.andOwn') : angebote.length ? t('etappen.block.clickOrWrite') : t('etappen.block.ownWords')}
          className="min-h-0 resize-none border-0 p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>
    </div>
  );
}

/**
 * Benefits: alle offen, nach Gruppen (Freigabe Marko 05.11.2026). Schon
 * Beantwortetes ist angehakt und traegt "aus Ihren Angaben"; darunter ein
 * Feld fuer eigene Benefits.
 */
function BenefitsTeil({ type, gewaehlt, automatisch, onChange }: {
  type: 'full-time' | 'freelance';
  gewaehlt: string[];
  automatisch: string[];
  onChange: (v: string[]) => void;
}) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  const [eigenes, setEigenes] = useState('');
  const gruppen = type === 'freelance' ? CONTRACTING_GRUPPEN : BENEFIT_GRUPPEN;
  const bekannt = gruppen.flatMap((g) => g.items);
  const eigene = gewaehlt.filter((g) => !bekannt.includes(g));
  const um = (b: string) => onChange(gewaehlt.includes(b) ? gewaehlt.filter((x) => x !== b) : [...gewaehlt, b]);
  const dazu = () => {
    const t = eigenes.trim();
    if (t && !gewaehlt.includes(t)) onChange([...gewaehlt, t]);
    setEigenes('');
  };
  const knopf = (b: string) => (
    <button
      key={b}
      type="button"
      onClick={() => um(b)}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors',
        gewaehlt.includes(b) ? 'border-primary bg-primary/10 text-foreground' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {gewaehlt.includes(b) && <Check className="h-2.5 w-2.5" />}
      {benefitAnzeige(b)}
      {automatisch.includes(b) && <span className="ml-1 text-[10px] opacity-70">{t('etappen.benefits.fromYourDetails')}</span>}
    </button>
  );
  return (
    <div className="space-y-3">
      <p className="text-base font-semibold">{t('etappen.benefits.heading')} <span className="text-xs font-normal text-muted-foreground">{t('shared.optional')}</span></p>
      <div className="space-y-2">
        {gruppen.map((g) => (
          <div key={g.titel} className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-2">
            <span className="pt-1 text-xs text-muted-foreground">{benefitGruppeAnzeige(g.titel, type)}</span>
            <div className="flex flex-wrap gap-1.5">{g.items.map(knopf)}</div>
          </div>
        ))}
        {eigene.length > 0 && (
          <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-start gap-2">
            <span className="pt-1 text-xs text-muted-foreground">{t('etappen.benefits.own')}</span>
            <div className="flex flex-wrap gap-1.5">{eigene.map(knopf)}</div>
          </div>
        )}
      </div>
      <div className="flex gap-2 sm:w-2/3">
        <Input
          value={eigenes}
          onChange={(e) => setEigenes(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); dazu(); } }}
          placeholder={t('etappen.benefits.morePlaceholder')}
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" disabled={!eigenes.trim()} onClick={dazu}>
          {t('etappen.benefits.addButton')}
        </Button>
      </div>
    </div>
  );
}

// Nur die Werte -- die Beschriftung steht unter intake: shared.flex.<wert>.
const STUFEN = ['fix', 'negotiable', 'flexible'] as const;

/** Die Kriterien -- dieselbe Liste und dieselben drei Stufen wie in ProfileSections. */
function KriterienTeil({ state, onState }: { state: CaptureState; onState: Props['onState'] }) {
  const { t } = useTranslation(['intake', 'intakeCatalog']);
  const built = state.built as BuiltJob;
  const flexibility = state.flexibility as FlexibilityMap;
  const set = (patch: Partial<BuiltJob>) => onState((s) => (s.built ? { ...s, built: { ...s.built, ...patch } } : s));
  const setFlex = (f: FlexibilityMap) => onState((s) => ({ ...s, flexibility: f }));
  const q = frageNach('kriterien');

  const kriterien = [...new Set([...(built.must_haves ?? []), ...(built.nice_to_haves ?? [])].map((s) => String(s).trim()))].filter(Boolean);
  const nach = (w: string) => kriterien.filter((s) => flexibility[s] === w);
  const unmarkiert = kriterien.filter((s) => !flexibility[s]);

  const schonDa = [...kriterien, ...(built.skills ?? [])].map((x) => String(x ?? '').toLowerCase().trim()).filter(Boolean);
  const istDoppelt = (roh: string) => {
    const n = String(roh ?? '').toLowerCase().trim();
    return !n || schonDa.some((v) => v === n || (v.length >= 5 && n.includes(v)) || (n.length >= 5 && v.includes(n)));
  };
  const vorschlaege = (state.dyn.catalog?.skillSuggestions ?? []).filter((v) => v?.skill && !istDoppelt(v.skill)).slice(0, 6);
  const eingabe: SkillVorschlag[] = [
    ...(built.skills ?? []).filter((s) => !istDoppelt(s)).map((s) => ({ wert: s, quelle: 'ad' as const })),
    ...vorschlaege.map((v) => ({ wert: v.skill, quelle: 'ai' as const, grund: v.because })),
  ];

  return (
    <div className="space-y-3 [&_input]:w-full sm:[&_input]:w-96" data-feld="kriterien" tabIndex={-1}>
      {/* Markos ganzer Satz steht immer da -- er verschwand vorher, sobald
          ein Kriterium eingetragen war (Durchklick 04.11.2026). */}
      {q?.intro && <p className="text-xs italic text-muted-foreground">{frageIntroT(q)}</p>}
      <p className="text-base font-semibold leading-snug">{q ? frageTextT(q, state.type) : ''}</p>
      {kriterien.length > 0 && q && frageKurz(q, state.type) && (
        <p className="-mt-1 text-xs text-muted-foreground">{frageKurzT(q, state.type)}</p>
      )}

      {/* Voller Name, darunter EINE Auswahl je Zeile -- statt abgeschnittener
          Namen und vier einzelner Ziele. */}
      <div>
        {kriterien.map((s) => {
          const flex = flexibility[s];
          return (
            /* Immer dieselbe Ordnung: Name oben, Stufen darunter. Vorher standen
               die Stufen bei kurzen Namen rechts, bei langen darunter (N2, 05.11.2026). */
            <div key={s} className="space-y-1.5 border-b py-2 last:border-b-0">
              <p className="min-w-0 text-sm">{s}</p>
              <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-md border text-xs">
                {STUFEN.map((wert) => (
                  <button
                    key={wert}
                    type="button"
                    onClick={() => setFlex({ ...flexibility, [s]: flex === wert ? undefined : wert } as FlexibilityMap)}
                    className={cn(
                      'border-r px-2.5 py-1 transition-colors',
                      flex === wert ? 'bg-foreground font-medium text-background' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {t(`shared.flex.${wert}`)}
                  </button>
                ))}
              </div>
                <button
                  type="button"
                  onClick={() => {
                    set({ must_haves: built.must_haves.filter((x) => x !== s), nice_to_haves: (built.nice_to_haves ?? []).filter((x) => x !== s) });
                    const rest = { ...flexibility };
                    delete rest[s];
                    setFlex(rest);
                  }}
                  className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  {t('shared.remove')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SkillList
        label={t('profile.addCriterion')}
        items={[]}
        onRemove={() => undefined}
        onAdd={(s) => set({ must_haves: [...built.must_haves, s] })}
        vorschlaege={eingabe}
      />

      {vorschlaege.length > 0 && (
        <div className="rounded-lg border border-dashed p-2.5">
          <p className="mb-1.5 text-xs text-muted-foreground">{t('profile.suggestHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {vorschlaege.map((v) => (
              <button
                key={v.skill}
                type="button"
                title={v.because}
                onClick={() => {
                  set({ must_haves: [...(built.must_haves ?? []), v.skill] });
                  onState((s) => ({
                    ...s,
                    dyn: { ...s.dyn, catalog: { ...(s.dyn.catalog ?? EMPTY_CATALOG_STATE), skillSuggestions: (s.dyn.catalog?.skillSuggestions ?? []).filter((x) => x.skill !== v.skill) } },
                  }));
                }}
                className="rounded-full border border-input bg-secondary/60 px-2.5 py-1 text-xs transition-colors hover:bg-accent"
              >
                + {v.skill}
              </button>
            ))}
          </div>
        </div>
      )}

      {nach('fix').length >= 8 && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('profile.tooManyFix', { n: nach('fix').length })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {unmarkiert.length > 0
          ? t('profile.countsUnrated', { fix: nach('fix').length, negotiable: nach('negotiable').length, flexible: nach('flexible').length, unrated: unmarkiert.length })
          : t('profile.counts', { fix: nach('fix').length, negotiable: nach('negotiable').length, flexible: nach('flexible').length })}
      </p>
      {q?.why && (
        <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" /> {frageWhyT(q)}
        </p>
      )}
    </div>
  );
}

/** Der letzte Schritt: was die Headhunter bekommen, und was noch fehlt. */
function Pruefen({
  state, sperren, onSprung, vorbelegt,
}: {
  state: CaptureState;
  sperren: { key: string; label: string }[];
  onSprung: (key: string) => void;
  /** Felder, die nur vorbelegt sind und niemand gewaehlt hat. */
  vorbelegt: string[];
}) {
  const { t, i18n } = useTranslation(['intake', 'intakeCatalog']);
  const built = state.built as BuiltJob;
  const f: FreelanceTerms = state.freelance;
  const isFreelance = state.type === 'freelance';
  const euro = (n: number | null | undefined) => (n ? `${n.toLocaleString(intlLocale(i18n.language))} €` : '');
  const muss = [...(built.must_haves ?? []), ...(built.nice_to_haves ?? [])].filter((k) => state.flexibility[k] === 'fix');
  const zeilen: [string, string][] = [
    [t('etappen.pruefen.position'), built.title],
    [t('shared.location'), [
      built.location,
      vorbelegt.includes('remote_type') ? t('etappen.pruefen.workModelNotChosen')
        : ['remote', 'hybrid', 'onsite'].includes(built.remote_type || 'hybrid') ? t(`shared.remote.${built.remote_type || 'hybrid'}`) : undefined,
    ].filter(Boolean).join(' · ')],
    [t('shared.experience'), vorbelegt.includes('experience_level') ? ''
      : ['junior', 'mid', 'senior', 'lead'].includes(built.experience_level || 'mid') ? t(`shared.level.${built.experience_level || 'mid'}`) : ''],
    isFreelance
      ? [t('etappen.pruefen.budgetPerDay'), [euro(f.dayRateMin), euro(f.dayRateMax)].filter(Boolean).join(' – ')]
      : [t('etappen.pruefen.salaryBand'), [euro(built.salary_min), euro(built.salary_max)].filter(Boolean).join(' – ')],
    [t('etappen.pruefen.essential'), muss.join(' · ')],
    [t('etappen.pruefen.contractKind'), isFreelance ? t('shared.contracting') : t('shared.permanent')],
  ];
  return (
    <div className="space-y-4">
      <p className="text-base font-semibold">{t('etappen.pruefen.title')}</p>
      <p className="text-xs text-muted-foreground">{t('etappen.pruefen.lead')}</p>
      <div className="rounded-lg border p-3">
        {zeilen.map(([l, v]) => (
          <p key={l} className="flex justify-between gap-3 py-0.5 text-sm">
            <span className="text-muted-foreground">{l}</span>
            <span className={cn('text-right', !v && 'text-muted-foreground')}>{v || '—'}</span>
          </p>
        ))}
      </div>
      {sperren.length > 0 ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <p className="mb-1.5 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> {t('etappen.pruefen.missingHead')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sperren.map((x) => (
              <button key={x.key} type="button" onClick={() => onSprung(x.key)}
                className="rounded-full border border-amber-500/40 px-2.5 py-0.5 text-xs hover:bg-amber-500/10">
                {x.label} →
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-emerald-600">
          <CheckCircle2 className="h-4 w-4" /> {t('etappen.pruefen.allSet')}
        </p>
      )}
    </div>
  );
}
