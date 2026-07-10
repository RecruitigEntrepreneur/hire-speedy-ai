// Team-Zugriffslogik für Edge Functions (Service-Role-Client).
// Spiegelt die SQL-Helfer can_edit_job / can_access_job aus der Migration
// 20260710130000_client_team_foundation.sql:
//   * Job ohne Organisation → nur der Ersteller (client_id)
//   * Job mit Organisation  → owner/admin/hr der Org; hiring_manager nur mit
//     job_collaborators-Eintrag (viewer = read-only, darf NICHT handeln)
// Fällt auf das Legacy-Verhalten (client_id) zurück, wenn die Team-Tabellen
// noch nicht migriert sind.

// deno-lint-ignore-file no-explicit-any

interface SupabaseLike {
  from: (table: string) => any;
}

/** Darf der User auf diesem Job HANDELN (Interview anfragen, ablehnen, ...)? */
export async function canUserActOnJob(
  supabase: SupabaseLike,
  userId: string,
  jobId: string,
): Promise<boolean> {
  const { data: job } = await supabase
    .from('jobs')
    .select('client_id, organization_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job) return false;

  // Plattform-Admins dürfen immer
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  if (adminRole) return true;

  if (!job.organization_id) {
    return job.client_id === userId;
  }

  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('owner_id')
      .eq('id', job.organization_id)
      .maybeSingle();
    if (org?.owner_id === userId) return true;

    const { data: membership } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', job.organization_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership) return false;
    if (['owner', 'admin', 'hr'].includes(membership.role)) return true;
    if (membership.role === 'hiring_manager') {
      const { data: collab } = await supabase
        .from('job_collaborators')
        .select('id')
        .eq('job_id', jobId)
        .eq('user_id', userId)
        .maybeSingle();
      return !!collab;
    }
    return false;
  } catch (_e) {
    // Team-Tabellen noch nicht migriert → Legacy
    return job.client_id === userId;
  }
}

/**
 * Alle Job-IDs, die der User (lesend) sehen darf — für Dashboard-Aggregation.
 * owner/admin/hr: alle Org-Jobs; hiring_manager/viewer: zugewiesene Jobs;
 * zusätzlich immer selbst erstellte Jobs ohne Organisation.
 */
export async function getAccessibleJobIds(
  supabase: SupabaseLike,
  userId: string,
): Promise<string[]> {
  const ids = new Set<string>();

  // Legacy/Ersteller-Pfad
  const { data: ownJobs } = await supabase
    .from('jobs')
    .select('id, organization_id')
    .eq('client_id', userId);
  for (const j of ownJobs ?? []) {
    if (!j.organization_id) ids.add(j.id);
  }

  try {
    const adminOrgIds = new Set<string>();
    const scopedOrgIds = new Set<string>();

    const { data: ownedOrgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('owner_id', userId)
      .eq('type', 'client');
    for (const o of ownedOrgs ?? []) adminOrgIds.add(o.id);

    const { data: memberships } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', userId)
      .eq('status', 'active');
    for (const m of memberships ?? []) {
      if (['owner', 'admin', 'hr'].includes(m.role)) adminOrgIds.add(m.organization_id);
      else if (['hiring_manager', 'viewer'].includes(m.role)) scopedOrgIds.add(m.organization_id);
    }

    if (adminOrgIds.size) {
      const { data: orgJobs } = await supabase
        .from('jobs')
        .select('id')
        .in('organization_id', [...adminOrgIds]);
      for (const j of orgJobs ?? []) ids.add(j.id);
    }

    if (scopedOrgIds.size) {
      const { data: collabs } = await supabase
        .from('job_collaborators')
        .select('job_id, jobs!inner(id, organization_id)')
        .eq('user_id', userId)
        .in('jobs.organization_id', [...scopedOrgIds]);
      for (const c of collabs ?? []) ids.add(c.job_id);
    }
  } catch (_e) {
    // Team-Tabellen noch nicht migriert → Legacy: alle selbst erstellten Jobs
    for (const j of ownJobs ?? []) ids.add(j.id);
  }

  return [...ids];
}
