import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { COMMON_SKILLS } from '@/lib/wizard-options';

export interface SkillSuggestion {
  canonical_name: string;
  category: string | null;
  matched_alias?: string;
}

/**
 * Hook that queries skill_taxonomy for autocomplete suggestions.
 * Falls back to the static COMMON_SKILLS list if the taxonomy query fails or returns nothing.
 */
export function useSkillSuggestions() {
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (query: string, excludeTags: string[] = []) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Search by canonical_name (ILIKE) and aliases (array contains)
        const { data, error } = await supabase
          .from('skill_taxonomy')
          .select('canonical_name, category')
          .or(`canonical_name.ilike.%${query}%`)
          .limit(20);

        if (error) throw error;

        if (data && data.length > 0) {
          const filtered = data
            .filter(s => !excludeTags.includes(s.canonical_name))
            .map(s => ({
              canonical_name: s.canonical_name,
              category: s.category,
            }));
          setSuggestions(filtered);
        } else {
          // Fallback to static list
          const lowerQuery = query.toLowerCase();
          const fallback = COMMON_SKILLS
            .filter(s => s.toLowerCase().includes(lowerQuery) && !excludeTags.includes(s))
            .slice(0, 20)
            .map(s => ({ canonical_name: s, category: null }));
          setSuggestions(fallback);
        }
      } catch {
        // On error, fall back to static list
        const lowerQuery = query.toLowerCase();
        const fallback = COMMON_SKILLS
          .filter(s => s.toLowerCase().includes(lowerQuery) && !excludeTags.includes(s))
          .slice(0, 20)
          .map(s => ({ canonical_name: s, category: null }));
        setSuggestions(fallback);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  const clear = useCallback(() => {
    setSuggestions([]);
  }, []);

  return { suggestions, loading, search, clear };
}
