// Test-Helfer (G + H, 25.10.2026): Zusage gilt nur, wenn der Kandidat sie bestätigt.
// Der Headhunter meldet sie, der Kandidat klickt den Link aus der Mail „Haben Sie zugesagt?“.
// deno-lint-ignore-file no-explicit-any
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { respondOffer } from '../../functions/_shared/offer-service.ts';
import { candidateAnswer } from '../../functions/_shared/offer-candidate.ts';

/** Token der Antwortseite aus der zuletzt verschickten Mail einer Vorlage */
export function tokenFrom(sent: any[], template: string): string {
  const mail = [...sent].reverse().find((m) => m.template === template);
  const token = mail ? /\/angebot\/([A-Za-z0-9_-]+)/.exec(String(mail.text ?? mail.html ?? ''))?.[1] : null;
  if (!token) throw new Error(`Keine Mail ${template} mit Link gefunden`);
  return token;
}

/** Zusage melden (Headhunter) und bestätigen (Kandidat) */
export async function acceptAsCandidate(ctx: any, sent: any[], recruiter: User, offerId: string, extra: Record<string, unknown> = {}) {
  await respondOffer(ctx, recruiter, { offerId, way: 'accepted', ...extra });
  await candidateAnswer(ctx, { token: tokenFrom(sent, 'offer_candidate_confirm'), way: 'confirmed' });
}
