import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface ClientVerification {
  id: string;
  client_id: string;
  terms_accepted: boolean;
  terms_accepted_at: string | null;
  terms_version: string;
  contract_signed: boolean;
  contract_signed_at: string | null;
  contract_pdf_url: string | null;
  digital_signature: string | null;
  kyc_status: 'pending' | 'in_review' | 'verified' | 'rejected';
  kyc_verified_at: string | null;
  kyc_verified_by: string | null;
  company_registration_number: string | null;
  vat_id: string | null;
  kyc_rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export function useClientVerification() {
  const { user, role } = useAuth();
  const [verification, setVerification] = useState<ClientVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = useCallback(async () => {
    if (!user || role !== 'client') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('client_verifications')
        .select('*')
        .eq('client_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      // Auto-create verification record if it doesn't exist
      if (!data) {
        const { data: newData, error: createError } = await supabase
          .from('client_verifications')
          .insert({ client_id: user.id })
          .select()
          .single();
        
        if (createError) throw createError;
        setVerification(newData as ClientVerification);
      } else {
        setVerification(data as ClientVerification);
      }
    } catch (err) {
      console.error('Error fetching verification:', err);
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
        .from('client_verifications')
        .insert({ client_id: user.id })
        .select()
        .single();

      if (createError) throw createError;
      
      setVerification(data as ClientVerification);
      return data;
    } catch (err) {
      console.error('Error creating verification:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, [user]);

  const acceptTerms = useCallback(async (version: string = '1.0') => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('client_verifications')
        .update({
          terms_accepted: true,
          terms_accepted_at: new Date().toISOString(),
          terms_version: version,
        })
        .eq('client_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error accepting terms:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  const signContract = useCallback(async (signature: string) => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('client_verifications')
        .update({
          contract_signed: true,
          contract_signed_at: new Date().toISOString(),
          digital_signature: signature,
        })
        .eq('client_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error signing contract:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  const submitKycDocuments = useCallback(async (
    companyRegistrationNumber: string,
    vatId: string
  ) => {
    if (!user || !verification) return false;

    try {
      const { error: updateError } = await supabase
        .from('client_verifications')
        .update({
          company_registration_number: companyRegistrationNumber,
          vat_id: vatId,
          kyc_status: 'in_review',
        })
        .eq('client_id', user.id);

      if (updateError) throw updateError;
      
      await fetchVerification();
      return true;
    } catch (err) {
      console.error('Error submitting KYC:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  }, [user, verification, fetchVerification]);

  // Check if client is fully verified
  const isFullyVerified = verification?.terms_accepted && 
                          verification?.contract_signed && 
                          verification?.kyc_status === 'verified';

  // Check if client can publish jobs
  const canPublishJobs = verification?.terms_accepted && verification?.contract_signed;

  // Get current verification step
  const currentStep = !verification 
    ? 0 
    : !verification.terms_accepted 
      ? 1 
      : !verification.contract_signed 
        ? 2 
        : verification.kyc_status === 'pending' 
          ? 3 
          : 4;

  return {
    verification,
    loading,
    error,
    createVerification,
    acceptTerms,
    signContract,
    submitKycDocuments,
    isFullyVerified,
    canPublishJobs,
    currentStep,
    refetch: fetchVerification,
  };
}