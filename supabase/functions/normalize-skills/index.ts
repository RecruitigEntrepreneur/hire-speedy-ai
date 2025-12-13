import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NormalizeRequest {
  skills: string[];
}

interface NormalizedSkill {
  original: string;
  canonical: string;
  category: string | null;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'ai';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { skills } = await req.json() as NormalizeRequest;
    
    if (!skills || !Array.isArray(skills)) {
      return new Response(
        JSON.stringify({ error: 'skills array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch taxonomy
    const { data: taxonomy, error: taxError } = await supabase
      .from('skill_taxonomy')
      .select('canonical_name, aliases, category, related_skills, transferability_from');

    if (taxError) {
      console.error('Error fetching taxonomy:', taxError);
      throw new Error('Failed to fetch skill taxonomy');
    }

    const normalizedSkills: NormalizedSkill[] = [];
    const unmatchedSkills: string[] = [];

    for (const skill of skills) {
      const skillLower = skill.toLowerCase().trim();
      let matched = false;

      // 1. Exact canonical match
      for (const taxSkill of taxonomy || []) {
        if (taxSkill.canonical_name.toLowerCase() === skillLower) {
          normalizedSkills.push({
            original: skill,
            canonical: taxSkill.canonical_name,
            category: taxSkill.category,
            confidence: 100,
            matchType: 'exact'
          });
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // 2. Alias match
      for (const taxSkill of taxonomy || []) {
        const aliases = (taxSkill.aliases || []).map((a: string) => a.toLowerCase());
        if (aliases.includes(skillLower)) {
          normalizedSkills.push({
            original: skill,
            canonical: taxSkill.canonical_name,
            category: taxSkill.category,
            confidence: 95,
            matchType: 'alias'
          });
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // 3. Fuzzy match (contains or partial)
      for (const taxSkill of taxonomy || []) {
        const canonical = taxSkill.canonical_name.toLowerCase();
        if (canonical.includes(skillLower) || skillLower.includes(canonical)) {
          normalizedSkills.push({
            original: skill,
            canonical: taxSkill.canonical_name,
            category: taxSkill.category,
            confidence: 75,
            matchType: 'fuzzy'
          });
          matched = true;
          break;
        }
      }

      if (!matched) {
        unmatchedSkills.push(skill);
      }
    }

    // 4. AI matching for unmatched skills (using Lovable AI Gateway)
    if (unmatchedSkills.length > 0) {
      try {
        const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
        if (lovableApiKey) {
          const taxonomyNames = (taxonomy || []).map(t => t.canonical_name).join(', ');
          
          const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                {
                  role: 'system',
                  content: `You are a skill normalization assistant. Map input skills to the closest match from this taxonomy: ${taxonomyNames}. Return JSON array with objects: { "original": "input skill", "canonical": "matched taxonomy skill or null", "confidence": 0-100 }. Only match if confidence >= 60.`
                },
                {
                  role: 'user',
                  content: `Normalize these skills: ${JSON.stringify(unmatchedSkills)}`
                }
              ],
              max_completion_tokens: 1000
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const aiContent = aiData.choices?.[0]?.message?.content;
            
            if (aiContent) {
              try {
                // Extract JSON from response
                const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                  const aiMatches = JSON.parse(jsonMatch[0]);
                  for (const match of aiMatches) {
                    if (match.canonical && match.confidence >= 60) {
                      const taxEntry = taxonomy?.find(t => 
                        t.canonical_name.toLowerCase() === match.canonical.toLowerCase()
                      );
                      normalizedSkills.push({
                        original: match.original,
                        canonical: taxEntry?.canonical_name || match.canonical,
                        category: taxEntry?.category || null,
                        confidence: match.confidence,
                        matchType: 'ai'
                      });
                    } else {
                      // Add as-is with low confidence
                      normalizedSkills.push({
                        original: match.original,
                        canonical: match.original, // Keep original
                        category: null,
                        confidence: 30,
                        matchType: 'fuzzy'
                      });
                    }
                  }
                }
              } catch (parseError) {
                console.error('Error parsing AI response:', parseError);
                // Add unmatched skills as-is
                for (const skill of unmatchedSkills) {
                  normalizedSkills.push({
                    original: skill,
                    canonical: skill,
                    category: null,
                    confidence: 20,
                    matchType: 'fuzzy'
                  });
                }
              }
            }
          }
        } else {
          // No AI key, add as-is
          for (const skill of unmatchedSkills) {
            normalizedSkills.push({
              original: skill,
              canonical: skill,
              category: null,
              confidence: 20,
              matchType: 'fuzzy'
            });
          }
        }
      } catch (aiError) {
        console.error('AI matching error:', aiError);
        for (const skill of unmatchedSkills) {
          normalizedSkills.push({
            original: skill,
            canonical: skill,
            category: null,
            confidence: 20,
            matchType: 'fuzzy'
          });
        }
      }
    }

    // Group by category
    const byCategory: Record<string, NormalizedSkill[]> = {};
    for (const skill of normalizedSkills) {
      const cat = skill.category || 'Other';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(skill);
    }

    console.log(`Normalized ${skills.length} skills -> ${normalizedSkills.length} canonical skills`);

    return new Response(
      JSON.stringify({
        normalized: normalizedSkills,
        byCategory,
        stats: {
          total: skills.length,
          exactMatches: normalizedSkills.filter(s => s.matchType === 'exact').length,
          aliasMatches: normalizedSkills.filter(s => s.matchType === 'alias').length,
          fuzzyMatches: normalizedSkills.filter(s => s.matchType === 'fuzzy').length,
          aiMatches: normalizedSkills.filter(s => s.matchType === 'ai').length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in normalize-skills:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
