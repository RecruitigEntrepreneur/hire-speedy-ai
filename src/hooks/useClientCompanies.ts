import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

/**
 * Die Firmen eines Kundenkontos (Haupt-, Tochter-, Schwester-, Mutterfirma).
 * Stellen gibt es nur für verifizierte Firmen; den Status setzt nur Matchunt.
 * Lesen per RLS (Inhaber und Teammitglieder), Schreiben nur über
 * client_request_company (Migration 20261015100000).
 */
export type CompanyRole = 'main' | 'subsidiary' | 'sister' | 'parent';
export type CompanyStatus = 'pending' | 'verified' | 'rejected';

export interface CompanyData {
  name: string;
  legal_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  registration_number: string | null;
  vat_id: string | null;
  website: string | null;
}

export interface ClientCompany extends CompanyData {
  id: string;
  owner_id: string;
  organization_id: string | null;
  role: CompanyRole;
  status: CompanyStatus;
  proof_path: string | null;
  requested_at: string;
  decided_at: string | null;
  reject_reason: string | null;
  admin_question: string | null;
  /** Beantragte Änderung einer verifizierten Firma; bis zur Freigabe gelten die alten Daten. */
  pending_change: (CompanyData & { role?: CompanyRole }) | null;
}

export const ROLE_LABEL: Record<CompanyRole, string> = {
  main: 'Hauptfirma',
  subsidiary: 'Tochterfirma',
  sister: 'Schwesterfirma',
  parent: 'Muttergesellschaft',
};

export const isVerified = (c: Pick<ClientCompany, 'status'> | null | undefined) => c?.status === 'verified';

/** „Muster GmbH“ – so heißt die Firma in Stelle und Vertrag. */
export const companyLabel = (c: Pick<CompanyData, 'name' | 'legal_name'>) => c.legal_name?.trim() || c.name;

export function companyAddress(c: Pick<CompanyData, 'street' | 'postal_code' | 'city'>): string {
  const ort = [c.postal_code, c.city].filter(Boolean).join(' ');
  return [c.street, ort].filter(Boolean).join(', ');
}

/** „HRB 123 · USt-IdNr. DE… · Straße, PLZ Ort“ */
export function companyFacts(c: CompanyData): string {
  return [c.registration_number, c.vat_id ? `USt-IdNr. ${c.vat_id}` : null, companyAddress(c)].filter(Boolean).join(' · ');
}

const ROLE_ORDER: Record<CompanyRole, number> = { main: 0, parent: 1, subsidiary: 2, sister: 3 };

export interface CompanyRequest extends CompanyData {
  id?: string | null;
  role: CompanyRole;
}

export function useClientCompanies() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ['client-companies', user?.id];

  const query = useQuery({
    queryKey: key,
    enabled: !!user,
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<ClientCompany[]> => {
      const { data, error } = await (supabase as any)
        .from('client_companies')
        .select('id, owner_id, organization_id, role, name, legal_name, street, postal_code, city, country, registration_number, vat_id, website, status, proof_path, requested_at, decided_at, reject_reason, admin_question, pending_change')
        .order('requested_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as ClientCompany[]).sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
    },
  });

  /** Beantragen oder ändern; der Beleg (optional) liegt im eigenen Ordner. */
  const request = async (input: CompanyRequest, proof?: File | null): Promise<string> => {
    if (!user) throw new Error('Bitte anmelden.');
    let proofPath: string | null = null;
    if (proof) {
      const safe = proof.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
      proofPath = `${user.id}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from('company-proofs').upload(proofPath, proof, { contentType: proof.type || undefined });
      if (error) throw new Error('Der Beleg konnte nicht hochgeladen werden.');
    }
    const { data, error } = await (supabase as any).rpc('client_request_company', {
      p_id: input.id ?? null,
      p_name: input.name,
      p_legal_name: input.legal_name,
      p_street: input.street,
      p_postal_code: input.postal_code,
      p_city: input.city,
      p_country: input.country,
      p_registration_number: input.registration_number,
      p_vat_id: input.vat_id,
      p_website: input.website,
      p_role: input.role,
      p_proof_path: proofPath,
    });
    if (error) throw new Error(error.message || 'Das hat nicht geklappt.');
    await qc.invalidateQueries({ queryKey: ['client-companies'] });
    return data as string;
  };

  return {
    companies: query.data ?? [],
    loading: query.isLoading,
    /** Die Tabelle fehlt (Migration noch nicht live) oder das Lesen scheitert. */
    unavailable: query.isError,
    request,
  };
}
