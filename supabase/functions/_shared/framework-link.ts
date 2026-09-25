import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getPublicAppUrl } from './app-url.ts';
import { esc, layout, sendIntakeMail } from './intake-mail.ts';

/**
 * Den Rahmenvertrag an die Firma des Kunden hängen.
 *
 * Befund (Live, 25.09.2026, Kanna Medics): Der Rahmenvertrag entsteht beim
 * Absenden der Aufnahme, als es die Firma im System noch nicht gibt. Die legt
 * erst die Annahme an -- und trug sie am Rahmenvertrag nie nach. Alles, was
 * später über die Firma sucht, fand ihn nicht: die Admin-Seite („noch kein
 * Rahmenvertrag“, Knopf „anlegen“) und der Vertragsversand der zweiten Stelle,
 * der einen ZWEITEN Rahmenvertrag erzeugt hätte. Bei Bluewater & Bridge ist das
 * so passiert (RV-2026-001000 und -001001).
 *
 * Nie still überschreiben: Hat die Firma schon einen anderen laufenden oder
 * wirksamen Rahmenvertrag, bleibt alles, wie es ist, und Matchunt entscheidet.
 * Die Datenbank ließe ohnehin nur einen je Firma zu.
 */

/** Rahmenverträge, die noch gelten oder gerade unterschrieben werden. */
export const LIVE_FRAMEWORK_STATES = ['draft', 'pending_release', 'sent', 'customer_signed', 'active'];

export type LinkResult =
  | { linked: true; already?: boolean }
  | { linked: false; reason: 'not_found' }
  | { linked: false; reason: 'conflict'; other: string }
  | { linked: false; reason: 'failed'; error: string };

export async function linkFramework(db: SupabaseClient, args: {
  frameworkId: string | null | undefined;
  organizationId: string | null | undefined;
  clientUserId?: string | null;
}): Promise<LinkResult> {
  if (!args.frameworkId || !args.organizationId) return { linked: false, reason: 'not_found' };
  const { data: rv } = await db.from('client_framework_agreements')
    .select('id,agreement_number,organization_id,client_user_id').eq('id', args.frameworkId).maybeSingle();
  if (!rv) return { linked: false, reason: 'not_found' };

  // Gehört er schon einer anderen Firma, ist das kein Fall zum Nachtragen.
  if (rv.organization_id && rv.organization_id !== args.organizationId) {
    return { linked: false, reason: 'conflict', other: rv.agreement_number };
  }
  const { data: andere } = await db.from('client_framework_agreements')
    .select('agreement_number').eq('organization_id', args.organizationId)
    .in('status', LIVE_FRAMEWORK_STATES).neq('id', rv.id).limit(1);
  if (andere?.length) return { linked: false, reason: 'conflict', other: andere[0].agreement_number };

  const patch: Record<string, string> = {};
  if (!rv.organization_id) patch.organization_id = args.organizationId;
  if (!rv.client_user_id && args.clientUserId) patch.client_user_id = args.clientUserId;
  if (!Object.keys(patch).length) return { linked: true, already: true };
  const { error } = await db.from('client_framework_agreements').update(patch).eq('id', rv.id);
  if (error) {
    console.warn('[framework-link] Rahmenvertrag nicht verknüpft:', error.message);
    return { linked: false, reason: 'failed', error: error.message };
  }
  return { linked: true };
}

/**
 * Zwei Rahmenverträge für eine Firma: Glocke und Mail an Betreuer und Admins,
 * einmal je Aufnahme. Wirft nie.
 */
export async function notifyFrameworkConflict(db: SupabaseClient, draft: Record<string, any>, args: { own: string; other: string },
  deps: { mail: typeof sendIntakeMail; appUrl: () => string } = { mail: sendIntakeMail, appUrl: getPublicAppUrl }) {
  try {
    const { data: schon } = await db.from('notifications').select('id')
      .eq('type', 'framework_conflict').eq('related_id', draft.id).limit(1);
    if (schon?.length) return;
    const firma = draft.company_legal_name || draft.company_name || 'Unbekannte Firma';
    const empfaenger = new Set<string>();
    if (draft.owner_user_id) empfaenger.add(draft.owner_user_id);
    const { data: admins } = await db.from('user_roles').select('user_id').eq('role', 'admin').limit(10);
    (admins ?? []).forEach((r: { user_id: string }) => empfaenger.add(r.user_id));
    if (!empfaenger.size) return;
    await db.from('notifications').insert([...empfaenger].map((user_id) => ({
      user_id,
      type: 'framework_conflict',
      title: 'Zwei Rahmenverträge für eine Firma',
      message: `${firma} · ${args.own} nicht verknüpft, ${args.other} ist schon da`,
      related_type: 'intake_draft',
      related_id: draft.id,
    })));
    const { data: profiles } = await db.from('profiles').select('email').in('user_id', [...empfaenger]);
    for (const p of profiles ?? []) {
      if (!p.email) continue;
      await deps.mail(db, {
        to: p.email,
        subject: `Zwei Rahmenverträge: ${firma}`,
        template: 'framework_conflict_admin',
        meta: { draft_id: draft.id },
        html: layout({
          preheader: `${firma} hat zwei Rahmenverträge.`,
          heading: 'Zwei Rahmenverträge für eine Firma',
          body: `<p style="margin:0 0 16px 0;">Beim Annehmen sollte <strong>${esc(args.own)}</strong> an
              <strong>${esc(firma)}</strong> hängen. Die Firma hat aber schon <strong>${esc(args.other)}</strong>.
              Nichts wurde still verändert.</p>
            <p style="margin:0 0 16px 0;">Bitte entscheiden, welcher Rahmenvertrag gilt.</p>`,
          cta: { label: 'Aufnahme öffnen', url: `${deps.appUrl()}/admin/intakes/${draft.id}` },
        }),
      });
    }
  } catch (e) {
    console.warn('[framework-link] Meldung an Matchunt fehlgeschlagen:', e instanceof Error ? e.message : e);
  }
}
