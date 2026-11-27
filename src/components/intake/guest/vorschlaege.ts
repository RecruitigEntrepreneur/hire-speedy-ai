import { useCallback, useRef, useState } from 'react';
import { BRIEF_QUESTIONS, frageText, slotChips, slotLabel, type Known } from '@/lib/briefCatalog';

/**
 * Antwort-Vorschläge der KI, vorausgeladen (Variante A, Marko 27.11.2026).
 *
 * Der Kunde soll bei einer Frage gleich die passenden Vorschläge sehen -- nicht
 * erst feste, die dann wechseln. Deshalb fragt die Aufnahme die KI, BEVOR die
 * Frage dasteht: während des E-Mail-Schritts für die ersten Fragen, danach immer
 * einen Schritt voraus. Ist die KI noch nicht fertig, zeigt das Feld Platzhalter;
 * kommt nach 8 Sekunden nichts, die festen Vorschläge des Katalogs. Was einmal
 * zu sehen war, bleibt (`gezeigt`).
 *
 * Lebt in CaptureStep, damit es den Wechsel zwischen Code-Schritt und Fragen übersteht.
 */

export type VorschlagStand = 'laeuft' | 'fertig' | 'fehler' | 'zeitum';

const frage = (key: string) => BRIEF_QUESTIONS.find((q) => q.key === key);

export interface Vorschlaege {
  stand: Record<string, VorschlagStand>;
  /** Vorschläge für diese Fragen holen (je Frage einmal). */
  hole: (fragen: string[]) => void;
  /** Die Frage steht seit 8 Sekunden ohne Vorschläge da: feste zeigen. */
  aufgeben: (frage: string) => void;
  /** Was je Antwortzeile schon zu sehen war -- das wechselt nicht mehr. */
  gezeigt: Map<string, string[]>;
}

export function useVorschlaege(args: {
  askAi: (payload: Record<string, unknown>) => Promise<Record<string, any>>;
  type: 'full-time' | 'freelance';
  jobDraft: Record<string, unknown>;
  known: Known;
  askedFollowups: string[];
  answerSuggestions: Record<string, string[]>;
  /** Die KI ist für diese Aufnahme ausgefallen: nichts mehr anfragen. */
  kiAus: boolean;
  onNeu: (neu: Record<string, string[]>) => void;
}): Vorschlaege {
  const [stand, setStand] = useState<Record<string, VorschlagStand>>({});
  const standRef = useRef(stand);
  standRef.current = stand;
  const a = useRef(args);
  a.current = args;
  const gezeigt = useRef(new Map<string, string[]>()).current;

  const setze = (key: string, s: VorschlagStand) => setStand((x) => ({ ...x, [key]: s }));

  const hole = useCallback((fragen: string[]) => {
    const { askAi, type, jobDraft, known, askedFollowups, answerSuggestions, kiAus, onNeu } = a.current;
    if (kiAus) return;
    for (const key of fragen) {
      if (standRef.current[key]) continue;
      const q = frage(key);
      if (!q || (q.only && q.only !== type)) continue;
      const slots = q.slots.filter((s) => (!s.only || s.only === type));
      const fehlen = slots.filter((s) => (s.form === 'ai' || s.form === 'text') && !(answerSuggestions[s.key]?.length));
      if (!fehlen.length) { standRef.current = { ...standRef.current, [key]: 'fertig' }; setze(key, 'fertig'); continue; }
      standRef.current = { ...standRef.current, [key]: 'laeuft' };
      setze(key, 'laeuft');
      const zeile = (s: (typeof slots)[number]) => ({ key: s.key, label: slotLabel(s, type), form: s.form, chips: slotChips(s, type) });
      askAi({
        contract_type: type,
        job_draft: jobDraft,
        question: { key: q.key, text: frageText(q, type), slots: slots.map(zeile) },
        answer: '',
        open_slots: fehlen.map(zeile),
        known: Object.fromEntries(Object.entries(known).map(([k, v]) => [k, v?.value])),
        asked_followups: askedFollowups,
      })
        .then((data) => {
          const neu = data?.answer_suggestions;
          if (neu && typeof neu === 'object') onNeu(neu as Record<string, string[]>);
          if (standRef.current[key] === 'laeuft') setze(key, 'fertig');
        })
        .catch((e) => {
          console.warn('[Vorschläge] nicht geladen:', key, e);
          setze(key, 'fehler');
        });
    }
  }, []);

  const aufgeben = useCallback((key: string) => {
    if (standRef.current[key] === 'laeuft') setze(key, 'zeitum');
  }, []);

  return { stand, hole, aufgeben, gezeigt };
}
