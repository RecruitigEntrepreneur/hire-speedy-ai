import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface StripeAccount {
  id: string;
  user_id: string;
  stripe_account_id: string;
  account_type: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export function useStripeConnect() {
  const { user } = useAuth();
  const [account, setAccount] = useState<StripeAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchAccountStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "account-status" },
      });

      if (error) {
        console.error("Error fetching Stripe account:", error);
      } else if (data?.account) {
        setAccount(data.account);
      }
    } catch (error) {
      console.error("Error fetching Stripe account:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAccountStatus();
  }, [fetchAccountStatus]);

  const createAccount = async () => {
    if (!user) return;

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: { action: "create-account" },
      });

      if (error) {
        throw error;
      }

      if (data?.account) {
        setAccount(data.account);
        toast.success("Stripe-Konto erstellt");
        return data.account;
      }
    } catch (error: any) {
      console.error("Error creating Stripe account:", error);
      toast.error("Fehler beim Erstellen des Stripe-Kontos");
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const getOnboardingLink = async (returnUrl?: string, refreshUrl?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect", {
        body: {
          action: "create-account-link",
          return_url: returnUrl || `${window.location.origin}/recruiter/payouts`,
          refresh_url: refreshUrl || `${window.location.origin}/recruiter/payouts`,
        },
      });

      if (error) {
        throw error;
      }

      return data?.url;
    } catch (error: any) {
      console.error("Error getting onboarding link:", error);
      toast.error("Fehler beim Abrufen des Onboarding-Links");
      return null;
    }
  };

  const startOnboarding = async () => {
    let currentAccount = account;

    if (!currentAccount) {
      currentAccount = await createAccount();
    }

    if (currentAccount) {
      const url = await getOnboardingLink();
      if (url) {
        window.location.href = url;
      }
    }
  };

  return {
    account,
    loading,
    creating,
    isOnboarded: account?.onboarding_complete ?? false,
    canReceivePayouts: account?.payouts_enabled ?? false,
    createAccount,
    getOnboardingLink,
    startOnboarding,
    refreshStatus: fetchAccountStatus,
  };
}
