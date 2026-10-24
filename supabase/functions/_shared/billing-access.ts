// deno-lint-ignore-file no-explicit-any
// Wer sieht die Rechnungen eines Kunden, wer ändert seine Rechnungsdaten?
// (Etappe 1 „Besetzungen und Rechnungen“, 25.10.2026)
//
//   owner/admin/hr der Firma        sehen alle Rechnungen der Firma
//   Rolle Buchhaltung ('finance')   sieht alle Rechnungen, sonst nichts (keine
//                                   Kandidaten, keine Stellen)
//   hiring_manager / viewer         sehen keine Rechnungen
//   Rechnungsdaten ändern           owner/admin/finance
//   Bestand ohne Organisation       der Kunde selbst (jobs.client_id)
//
// Die Rechnungsdaten (Anschrift, USt-ID, Rechnungs-Mail, Bestellnummer) liegen
// im Firmenprofil des Inhabers der Organisation, ohne Organisation in dem des
// Kunden selbst.

interface DbLike {
  from: (table: string) => any;
}

export interface BillingScope {
  userId: string;
  isAdmin: boolean;
  /** Stellen, deren Rechnungen der Nutzer sieht */
  jobIds: string[];
  /** Darf Rechnungsdaten ändern */
  canManage: boolean;
  /** Firmenprofil mit den Rechnungsdaten (Inhaber der Organisation oder der Kunde selbst) */
  ownerId: string;
  /** Nutzer ist nur Buchhaltung (sieht keine Kandidaten und Stellen) */
  financeOnly: boolean;
}

const BILLING_ROLES = ['owner', 'admin', 'hr', 'finance'];
const MANAGE_ROLES = ['owner', 'admin', 'finance'];

export async function billingScope(db: DbLike, userId: string): Promise<BillingScope> {
  const { data: adminRole } = await db.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
  const jobIds = new Set<string>();
  const { data: ownJobs } = await db.from('jobs').select('id, organization_id').eq('client_id', userId);
  for (const j of (ownJobs ?? []) as any[]) if (!j.organization_id) jobIds.add(j.id);

  const orgIds = new Set<string>();
  let canManage = false;
  let ownerId: string | null = null;
  let roles: string[] = [];
  try {
    const { data: owned } = await db.from('organizations').select('id, owner_id').eq('owner_id', userId).eq('type', 'client');
    for (const o of (owned ?? []) as any[]) { orgIds.add(o.id); canManage = true; ownerId ??= o.owner_id; roles.push('owner'); }
    const { data: members } = await db.from('organization_members').select('organization_id, role').eq('user_id', userId).eq('status', 'active');
    for (const m of (members ?? []) as any[]) {
      roles.push(m.role);
      if (!BILLING_ROLES.includes(m.role)) continue;
      orgIds.add(m.organization_id);
      if (MANAGE_ROLES.includes(m.role)) canManage = true;
    }
    if (orgIds.size) {
      const { data: orgJobs } = await db.from('jobs').select('id').in('organization_id', [...orgIds]);
      for (const j of (orgJobs ?? []) as any[]) jobIds.add(j.id);
      if (!ownerId) {
        const { data: org } = await db.from('organizations').select('owner_id').eq('id', [...orgIds][0]).maybeSingle();
        ownerId = (org as any)?.owner_id ?? null;
      }
    }
  } catch (_e) {
    // Team-Tabellen fehlen (alter Stand): nur eigene Stellen
    roles = [];
    for (const j of (ownJobs ?? []) as any[]) jobIds.add(j.id);
  }
  // Ohne Organisation verwaltet der Kunde seine Rechnungsdaten selbst
  if (!orgIds.size && (ownJobs ?? []).length) canManage = true;
  const financeOnly = roles.length > 0 && roles.every((r) => r === 'finance');
  return { userId, isAdmin: !!adminRole, jobIds: [...jobIds], canManage, ownerId: ownerId ?? userId, financeOnly };
}

/** Darf der Nutzer diese Rechnung sehen (Liste, PDF, Überweisung melden)? */
export function canSeeInvoice(scope: BillingScope, inv: { client_id?: string | null; job_id?: string | null }): boolean {
  if (scope.isAdmin) return true;
  if (inv.job_id && scope.jobIds.includes(inv.job_id)) return true;
  return !inv.job_id && inv.client_id === scope.userId;
}

/** Firmenprofil mit den Rechnungsdaten zu einer Stelle: Inhaber der Organisation, sonst der Kunde. */
export async function billingOwnerOfJob(db: DbLike, job: { client_id: string; organization_id?: string | null }): Promise<string> {
  if (!job.organization_id) return job.client_id;
  try {
    const { data: org } = await db.from('organizations').select('owner_id').eq('id', job.organization_id).maybeSingle();
    return (org as any)?.owner_id ?? job.client_id;
  } catch (_e) {
    return job.client_id;
  }
}
