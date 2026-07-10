import { supabase } from '@/integrations/supabase/client';

export type IntakeSubmitStatus = 'pending_approval' | 'pending_client_approval';

export interface IntakeSubmitTarget {
  status: IntakeSubmitStatus;
  organizationId: string | null;
  myRole: string | null;
}

/**
 * Entscheidet, wohin ein Intake beim Einreichen geht:
 * Hiring Manager + Org-Setting `intake_approval_required` → interne Freigabe
 * (`pending_client_approval`), sonst direkt an Matchunt (`pending_approval`).
 * Owner/Admin/HR brauchen nie eine interne Freigabe.
 */
export async function resolveIntakeSubmitTarget(userId: string): Promise<IntakeSubmitTarget> {
  const { data: owned } = await supabase
    .from('organizations')
    .select('id')
    .eq('owner_id', userId)
    .eq('type', 'client')
    .order('created_at', { ascending: true })
    .limit(1);
  if (owned?.length) {
    return { status: 'pending_approval', organizationId: owned[0].id, myRole: 'owner' };
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, organization_id, organizations(settings)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return { status: 'pending_approval', organizationId: null, myRole: null };
  }

  const settings = ((membership.organizations as { settings?: unknown } | null)?.settings ??
    {}) as Record<string, unknown>;
  const approvalRequired = settings.intake_approval_required === true;
  const needsApproval = approvalRequired && membership.role === 'hiring_manager';

  return {
    status: needsApproval ? 'pending_client_approval' : 'pending_approval',
    organizationId: membership.organization_id,
    myRole: membership.role,
  };
}

/** Admin/HR der Organisation benachrichtigen: ein Intake wartet auf interne Freigabe. */
export async function notifyApproversOfIntake(
  organizationId: string,
  jobId: string,
  jobTitle: string,
  submitterId?: string,
): Promise<void> {
  const [{ data: org }, { data: members }] = await Promise.all([
    supabase.from('organizations').select('owner_id').eq('id', organizationId).single(),
    supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin', 'hr']),
  ]);

  const recipientIds = new Set<string>();
  if (org?.owner_id) recipientIds.add(org.owner_id);
  (members ?? []).forEach((m) => recipientIds.add(m.user_id));
  if (submitterId) recipientIds.delete(submitterId);

  const rows = [...recipientIds].map((user_id) => ({
    user_id,
    type: 'intake_approval_requested',
    title: 'Stellenaufnahme wartet auf Freigabe',
    message: `„${jobTitle}" wurde vom Fachbereich eingereicht und wartet auf Ihre interne Freigabe.`,
    related_type: 'job',
    related_id: jobId,
  }));
  if (rows.length) {
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) console.warn('Freigabe-Benachrichtigung fehlgeschlagen:', error.message);
  }
}

/** Ersteller benachrichtigen: sein Intake wurde intern freigegeben oder zurückgegeben. */
export async function notifyCreatorOfDecision(
  creatorId: string,
  jobId: string,
  jobTitle: string,
  decision: 'approved' | 'returned',
  note?: string,
): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: creatorId,
    type: decision === 'approved' ? 'intake_approved' : 'intake_returned',
    title:
      decision === 'approved'
        ? 'Ihre Stellenaufnahme wurde freigegeben'
        : 'Ihre Stellenaufnahme wurde zurückgegeben',
    message:
      decision === 'approved'
        ? `„${jobTitle}" wurde intern freigegeben und an Matchunt übergeben.`
        : `„${jobTitle}" wurde zurückgegeben${note ? `: ${note}` : '.'}`,
    related_type: 'job',
    related_id: jobId,
  });
  if (error) console.warn('Entscheidungs-Benachrichtigung fehlgeschlagen:', error.message);
}
