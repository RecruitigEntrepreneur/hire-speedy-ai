import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import type { Kontakt } from '@/lib/jobPosting';

/** Die Ansprechperson in Anzeige und Ansprache ist der Headhunter selbst (aus seinem Profil). */
export function useRecruiterKontakt(): Kontakt | null {
  const { user } = useAuth();
  const [kontakt, setKontakt] = useState<Kontakt | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void supabase.from('profiles').select('full_name, email, phone, linkedin_url').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setKontakt({ name: data.full_name, email: data.email, phone: data.phone, linkedin: data.linkedin_url });
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  return kontakt;
}
