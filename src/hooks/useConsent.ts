import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type ConsentType = "analytics" | "marketing" | "functional" | "privacy_policy" | "terms_of_service";

interface Consent {
  id: string;
  consent_type: string;
  scope: string | null;
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  version: string;
}

interface ConsentState {
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
  privacy_policy: boolean;
  terms_of_service: boolean;
}

const DEFAULT_CONSENT_STATE: ConsentState = {
  analytics: false,
  marketing: false,
  functional: true, // Functional cookies are usually required
  privacy_policy: false,
  terms_of_service: false,
};

export function useConsent() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<ConsentState>(DEFAULT_CONSENT_STATE);
  const [loading, setLoading] = useState(true);
  const [hasConsented, setHasConsented] = useState(false);

  const fetchConsents = useCallback(async () => {
    // Check localStorage first for anonymous users
    const storedConsent = localStorage.getItem("cookie_consent");
    if (storedConsent) {
      try {
        const parsed = JSON.parse(storedConsent);
        setConsents(parsed);
        setHasConsented(true);
      } catch {
        // Invalid stored consent
      }
    }

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("consents")
      .select("*")
      .eq("subject_id", user.id)
      .eq("subject_type", "user");

    if (error) {
      console.error("Error fetching consents:", error);
      setLoading(false);
      return;
    }

    if (data?.length) {
      const consentMap: ConsentState = { ...DEFAULT_CONSENT_STATE };
      data.forEach((consent: Consent) => {
        if (consent.consent_type in consentMap) {
          consentMap[consent.consent_type as ConsentType] = consent.granted && !consent.revoked_at;
        }
      });
      setConsents(consentMap);
      setHasConsented(true);
    }

    setLoading(false);
  }, [user]);

  const updateConsent = useCallback(
    async (type: ConsentType, granted: boolean) => {
      const newConsents = { ...consents, [type]: granted };
      setConsents(newConsents);

      // Store in localStorage for persistence
      localStorage.setItem("cookie_consent", JSON.stringify(newConsents));
      setHasConsented(true);

      if (!user) return;

      // Check if consent record exists
      const { data: existingConsent } = await supabase
        .from("consents")
        .select("id")
        .eq("subject_id", user.id)
        .eq("subject_type", "user")
        .eq("consent_type", type)
        .single();

      if (existingConsent) {
        // Update existing consent
        await supabase
          .from("consents")
          .update({
            granted,
            granted_at: granted ? new Date().toISOString() : null,
            revoked_at: granted ? null : new Date().toISOString(),
          })
          .eq("id", existingConsent.id);
      } else {
        // Create new consent record
        await supabase.from("consents").insert({
          subject_id: user.id,
          subject_type: "user",
          consent_type: type,
          granted,
          granted_at: granted ? new Date().toISOString() : null,
          scope: type,
          version: "1.0",
        });
      }
    },
    [user, consents]
  );

  const acceptAll = useCallback(async () => {
    const allAccepted: ConsentState = {
      analytics: true,
      marketing: true,
      functional: true,
      privacy_policy: true,
      terms_of_service: true,
    };

    setConsents(allAccepted);
    localStorage.setItem("cookie_consent", JSON.stringify(allAccepted));
    setHasConsented(true);

    if (!user) return;

    // Save all consents to database
    for (const [type, granted] of Object.entries(allAccepted)) {
      await updateConsent(type as ConsentType, granted);
    }
  }, [user, updateConsent]);

  const rejectAll = useCallback(async () => {
    const allRejected: ConsentState = {
      analytics: false,
      marketing: false,
      functional: true, // Keep functional
      privacy_policy: false,
      terms_of_service: false,
    };

    setConsents(allRejected);
    localStorage.setItem("cookie_consent", JSON.stringify(allRejected));
    setHasConsented(true);

    if (!user) return;

    for (const [type, granted] of Object.entries(allRejected)) {
      await updateConsent(type as ConsentType, granted);
    }
  }, [user, updateConsent]);

  const hasConsentFor = useCallback(
    (type: ConsentType): boolean => {
      return consents[type] || false;
    },
    [consents]
  );

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  return {
    consents,
    loading,
    hasConsented,
    updateConsent,
    acceptAll,
    rejectAll,
    hasConsentFor,
    refetch: fetchConsents,
  };
}
