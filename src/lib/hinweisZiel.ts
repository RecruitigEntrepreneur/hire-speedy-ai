/**
 * Wohin ein Hinweis aus der Glocke führt (15.11.2026, Etappe 1). Eine Liste für Glocke und
 * „Alle ansehen“, bisher gab es zwei verschiedene. Ziel ist immer die Seite, auf der man
 * weitermacht, und wo möglich liegt das passende Fenster gleich offen darüber
 * (Parameter wie ?angebot=1, die die Seite beim Laden auswertet).
 *
 * Die Tabelle `notifications` hat kein Link-Feld: Das Ziel ergibt sich aus Art, related_type und
 * related_id. Angebot, Vertrag, Nachgespräch und Einsatz tragen nur die Kandidaten-ID; welcher
 * Vorgang gemeint ist, sucht die Profilseite dann selbst.
 */

import { supabase } from '@/integrations/supabase/client';

export interface HinweisRef {
  id?: string;
  type: string;
  title?: string | null;
  message?: string | null;
  related_type: string | null;
  related_id: string | null;
}

type Rolle = string | null | undefined;

/** `vorgang`: Ziel ist das Profil des Kandidaten dieser Einreichung, erst nachschlagen. */
export type HinweisZiel = { pfad: string } | { vorgang: string } | null;

const ANGEBOT = new Set(['offer_received', 'offer_update', 'offer_callback', 'offer_confirmed', 'offer_not_confirmed', 'offer_answer']);
const VERTRAG = new Set(['contract_update', 'contract_check', 'contract_followup']);
const TERMIN = new Set(['booking_created', 'booking_moved', 'booking_cancelled']);

/** Fragen des Headhunters zur Stelle: beim Kunden ein Fenster in den Aufgaben (gleiche Regel wie client-tasks). */
function istFrageAnKunden(n: HinweisRef): boolean {
  if (n.type === 'recruiter_job_questions') return true;
  return n.type === 'recruiter_nudge' && /Frage/.test(n.title ?? '') && (n.message ?? '').includes('\n– ');
}

function headhunterZiel(n: HinweisRef, art: string, id: string): HinweisZiel {
  if (art === 'candidate') {
    const profil = `/recruiter/candidates/${id}`;
    if (ANGEBOT.has(n.type)) return { pfad: `${profil}?angebot=1` };
    if (VERTRAG.has(n.type)) return { pfad: `${profil}?vertrag=1` };
    if (n.type === 'interview_feedback') return { pfad: `${profil}?nachgespraech=1` };
    if (n.type === 'engagement_requested') return { pfad: `${profil}?vorgang=1` };
    // Lebenslauf über die Terminseite: Hat das Auslesen nicht geklappt, gleich die Akte zum Ergänzen.
    if (n.type === 'cv_received' && /nicht/i.test(n.message ?? '')) return { pfad: `${profil}?akte=bearbeiten` };
    if (TERMIN.has(n.type)) return { pfad: `${profil}?zeigen=einladen` };
    return { pfad: profil };
  }
  switch (art) {
    case 'submission': return { vorgang: id };
    case 'job': return { pfad: `/recruiter/jobs/${id}` };
    case 'conversation': return { pfad: `/recruiter/messages?c=${id}` };
    case 'interview': return { pfad: `/recruiter/interviews?interview=${id}` };
    case 'placement': return { pfad: `/recruiter/earnings?besetzung=${id}` };
    // Buchhaltung (11.11.2026): Auszahlungen sind jetzt Gutschriften unter Verdienste
    case 'payout': return { pfad: '/recruiter/earnings?reiter=gutschriften' };
    case 'liga_season': return { pfad: `/recruiter/liga?saison=${id}` };
    default: return null;
  }
}

function kundenZiel(n: HinweisRef, art: string, id: string): HinweisZiel {
  if (art === 'job' && n.id && istFrageAnKunden(n)) return { pfad: `/dashboard/aufgaben?aufgabe=${encodeURIComponent(`question:${n.id}`)}&stelle=${id}` };
  if (art === 'submission' && n.type === 'invoice_issued') return { pfad: `/dashboard/rechnungen?beleg=${id}` };
  switch (art) {
    case 'submission': return { pfad: `/dashboard/candidates/${id}` };
    case 'job': return { pfad: `/dashboard/jobs/${id}` };
    case 'conversation': return { pfad: `/dashboard/messages?c=${id}` };
    case 'interview': return { pfad: `/dashboard/interviews?interview=${id}` };
    case 'placement': return { pfad: '/dashboard/besetzungen' };
    case 'invoice': return { pfad: `/dashboard/rechnungen?beleg=${id}` };
    case 'client_company': return { pfad: '/dashboard/settings#firmendaten' };
    default: return null;
  }
}

function adminZiel(n: HinweisRef, art: string, id: string): HinweisZiel {
  switch (art) {
    case 'client_company': return { pfad: `/admin?firma=${id}` };
    case 'feedback': return { pfad: `/admin/feedback/${id}` };
    case 'contract': return { pfad: '/admin/vertraege' };
    case 'admin_review': return { pfad: '/admin/recruiters#pruefungen' };
    // Buchhaltung (11.11.2026): Fahrplan der Besetzungen bzw. Rechnungen
    case 'placement': return { pfad: '/admin/besetzungen?reiter=faelle' };
    case 'invoice': return { pfad: '/admin/besetzungen?reiter=rechnungen' };
    default: return kundenZiel(n, art, id);
  }
}

export function hinweisZiel(n: HinweisRef, rolle: Rolle): HinweisZiel {
  const art = n.related_type;
  const id = n.related_id;
  if (!art || !id) return null;
  if (rolle === 'recruiter') return headhunterZiel(n, art, id);
  if (rolle === 'admin') return adminZiel(n, art, id);
  return kundenZiel(n, art, id);
}

/** Pfad zum Hinweis; schlägt bei Einreichungen den Kandidaten nach (Profil statt Prozess-Seite). */
export async function hinweisPfad(n: HinweisRef, rolle: Rolle): Promise<string | null> {
  const ziel = hinweisZiel(n, rolle);
  if (!ziel) return null;
  if ('pfad' in ziel) return ziel.pfad;
  const { data } = await supabase.from('submissions').select('candidate_id').eq('id', ziel.vorgang).maybeSingle();
  const kandidat = (data as { candidate_id?: string | null } | null)?.candidate_id;
  return kandidat ? `/recruiter/candidates/${kandidat}?vorgang=${ziel.vorgang}` : `/recruiter/submissions/${ziel.vorgang}`;
}
