import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface RecruiterVerification {
  id: string;
  recruiter_id: string;
  info_acknowledged: boolean;
  info_acknowledged_at: string | null;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  terms_version: string;
  nda_accepted: boolean;
  nda_accepted_at: string | null;
  nda_version: string;
  contract_signed: boolean;
  contract_signed_at: string | null;
  digital_signature: string | null;
  contract_version: string;
  company_name: string | null;
  tax_id: string | null;
  iban: string | null;
  profile_complete: boolean;
  profile_completed_at: string | null;
  verification_status: 'pending' | 'in_review' | 'verified' | 'rejected';
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function useRecruiterVerification() {
  const { user, role } = useAuth();
  const [verification, setVerification] = useState<RecruiterVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = useCallback(async () => {
    if (!user || role !== 'recruiter') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('recruiter_verifications')
        .select('*')
        .eq('recruiter_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      setVerification(data as RecruiterVerification | null);
    } catch (err) {
      console.error('Error fetching recruiter verification:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, role]);

  useEffect(() => {
    fetchVerification();
  }, [fetchVerification]);

  const createVerification = useCallback(async () => {
    if (!user) return null;

    try {
      const { data, error: createError } = await supabase
        .from('recruiter_verifications')
        .insert({ recruiter_id: user.id })
        .select()
        .single();

      if (createError) throw createError;
      
      setVerification(data as RecruiterVerification);
      return data;
    } catch (err) {
      console.error('Error creating recruiter verification:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [user]);

  const acknowledgeInfo = useCallback(async () => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('recruiter_verifications')
        .update({
          info_acknowledged: true,
          info_acknowledged_at: new Date().toISOString(),
        })
        .eq('recruiter_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error acknowledging info:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  const acceptTerms = useCallback(async (version: string = '1.0') => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('recruiter_verifications')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: version,
        })
        .eq('recruiter_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error accepting terms:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  const acceptNda = useCallback(async (version: string = '1.0') => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('recruiter_verifications')
        .update({
          nda_accepted: true,
          nda_accepted_at: new Date().toISOString(),
          nda_version: version,
        })
        .eq('recruiter_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error accepting NDA:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  const signContract = useCallback(async (signature: string, version: string = '1.0') => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('recruiter_verifications')
        .update({
          contract_signed: true,
          contract_signed_at: new Date().toISOString(),
          digital_signature: signature,
          contract_version: version,
        })
        .eq('recruiter_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error signing contract:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  const completeProfile = useCallback(async (
    companyName: string,
    taxId: string,
    iban: string
  ) => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('recruiter_verifications')
        .update({
          company_name: companyName,
          tax_id: taxId,
          iban: iban,
          profile_complete: true,
          profile_completed_at: new Date().toISOString(),
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .eq('recruiter_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error completing profile:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  // Check if recruiter is fully verified
  const isFullyVerified = verification?.info_acknowledged && 
                          verification?.terms_accepted && 
                          verification?.nda_accepted &&
                          verification?.contract_signed && 
                          verification?.profile_complete &&
                          verification?.verification_status === 'verified';

  // Check if recruiter can submit candidates (after contract signed)
  const canSubmitCandidates = verification?.info_acknowledged &&
                              verification?.terms_accepted && 
                              verification?.nda_accepted &&
                              verification?.contract_signed;

  // Get current verification step (1-6)
  const currentStep = !verification 
    ? 0 
    : !verification.info_acknowledged 
      ? 1 
      : !verification.terms_accepted 
        ? 2 
        : !verification.nda_accepted
          ? 3
          : !verification.contract_signed 
            ? 4 
            : !verification.profile_complete
              ? 5
              : 6;

  return {
    verification,
    loading,
    error,
    createVerification,
    acknowledgeInfo,
    acceptTerms,
    acceptNda,
    signContract,
    completeProfile,
    isFullyVerified,
    canSubmitCandidates,
    currentStep,
    refetch: fetchVerification,
  };
}
