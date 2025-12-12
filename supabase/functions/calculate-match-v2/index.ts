import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= INTERFACES =============

interface MatchRequest {
  candidateId: string;
  jobId: string;
}

interface FactorScore {
  score: number;
  weight: number;
  isBlocker: boolean;
  details: Record<string, unknown>;
  warning?: string;
  requiresConfirmation?: boolean;
  aiReasoning?: string;
}

interface BlockerInfo {
  factor: string;
  reason: string;
  severity: "critical" | "high";
}

interface WarningInfo {
  factor: string;
  message: string;
  severity: "medium" | "low";
  actionRequired?: boolean;
}

interface MatchResult {
  overallScore: number;
  dealProbability: number;
  factors: {
    skills: FactorScore;
    experience: FactorScore;
    salary: FactorScore;
    commute: FactorScore;
    culture: FactorScore;
  };
  blockers: BlockerInfo[];
  warnings: WarningInfo[];
  recommendations: string[];
}

interface MatchWeights {
  skills: number;
  experience: number;
  salary: number;
  commute: number;
  culture: number;
}

const DEFAULT_WEIGHTS: MatchWeights = {
  skills: 0.30,
  experience: 0.20,
  salary: 0.20,
  commute: 0.20,
  culture: 0.10,
};

// ============= ROUTING HELPERS =============

async function getCachedRoute(
  supabase: any,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: string
): Promise<number | null> {
  const { data } = await supabase
    .from("routing_cache")
    .select("duration_minutes")
    .eq("origin_lat", originLat.toFixed(4))
    .eq("origin_lng", originLng.toFixed(4))
    .eq("dest_lat", destLat.toFixed(4))
    .eq("dest_lng", destLng.toFixed(4))
    .eq("mode", mode)
    .gt("expires_at", new Date().toISOString())
    .single();

  return data?.duration_minutes || null;
}

async function cacheRoute(
  supabase: any,
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: string,
  durationMinutes: number,
  distanceKm?: number
): Promise<void> {
  await supabase.from("routing_cache").upsert({
    origin_lat: originLat.toFixed(4),
    origin_lng: originLng.toFixed(4),
    dest_lat: destLat.toFixed(4),
    dest_lng: destLng.toFixed(4),
    mode,
    duration_minutes: durationMinutes,
    distance_km: distanceKm,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}

async function getRoutingTime(
  supabase: any,
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: string = "car"
): Promise<{ duration: number; distance?: number } | null> {
  // Check cache first
  const cached = await getCachedRoute(
    supabase,
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    mode
  );
  
  if (cached !== null) {
    console.log(`Using cached route: ${cached} minutes`);
    return { duration: cached };
  }

  // Use OpenRouteService (free alternative) or estimate based on distance
  const OPENROUTE_API_KEY = Deno.env.get("OPENROUTE_API_KEY");
  const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");

  if (GOOGLE_MAPS_API_KEY) {
    try {
      const travelMode = mode === "public_transit" ? "transit" : mode === "bike" ? "bicycling" : "driving";
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?` +
        `origin=${origin.lat},${origin.lng}&` +
        `destination=${destination.lat},${destination.lng}&` +
        `mode=${travelMode}&` +
        `key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();
      
      if (data.routes?.[0]?.legs?.[0]) {
        const leg = data.routes[0].legs[0];
        const durationMinutes = Math.ceil(leg.duration.value / 60);
        const distanceKm = leg.distance.value / 1000;

        await cacheRoute(supabase, origin.lat, origin.lng, destination.lat, destination.lng, mode, durationMinutes, distanceKm);
        console.log(`Google Maps route: ${durationMinutes} min, ${distanceKm} km`);
        return { duration: durationMinutes, distance: distanceKm };
      }
    } catch (error) {
      console.error("Google Maps API error:", error);
    }
  }

  if (OPENROUTE_API_KEY) {
    try {
      const profile = mode === "public_transit" ? "driving-car" : mode === "bike" ? "cycling-regular" : "driving-car";
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/${profile}?` +
        `start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`,
        {
          headers: { Authorization: OPENROUTE_API_KEY },
        }
      );

      const data = await response.json();
      
      if (data.features?.[0]?.properties?.summary) {
        const summary = data.features[0].properties.summary;
        const durationMinutes = Math.ceil(summary.duration / 60);
        const distanceKm = summary.distance / 1000;

        await cacheRoute(supabase, origin.lat, origin.lng, destination.lat, destination.lng, mode, durationMinutes, distanceKm);
        console.log(`OpenRouteService route: ${durationMinutes} min, ${distanceKm} km`);
        return { duration: durationMinutes, distance: distanceKm };
      }
    } catch (error) {
      console.error("OpenRouteService API error:", error);
    }
  }

  // Fallback: Estimate based on Haversine distance
  const R = 6371; // Earth's radius in km
  const dLat = (destination.lat - origin.lat) * Math.PI / 180;
  const dLon = (destination.lng - origin.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanceKm = R * c;

  // Estimate: ~1.3x for road distance, average 50km/h for car, 25km/h for bike, 30km/h transit
  const roadDistance = distanceKm * 1.3;
  const speed = mode === "bike" ? 25 : mode === "public_transit" ? 30 : 50;
  const durationMinutes = Math.ceil((roadDistance / speed) * 60);

  await cacheRoute(supabase, origin.lat, origin.lng, destination.lat, destination.lng, mode, durationMinutes, roadDistance);
  console.log(`Estimated route (no API): ${durationMinutes} min, ${roadDistance.toFixed(1)} km`);
  
  return { duration: durationMinutes, distance: roadDistance };
}

// ============= SCORING FUNCTIONS =============

async function calculateCommuteMatch(
  supabase: any,
  candidate: any,
  job: any
): Promise<FactorScore> {
  const result: FactorScore = {
    score: 100,
    weight: DEFAULT_WEIGHTS.commute,
    isBlocker: false,
    details: {},
  };

  // Check if job is full remote - commute doesn't matter
  if (job.remote_policy === "full_remote") {
    result.details = { reason: "Job ist vollständig remote", travelTimeRequired: false };
    return result;
  }

  // Check remote preference mismatch (candidate wants full remote, job requires onsite)
  if (candidate.remote_days_preferred >= 5 && job.onsite_days_required > 0) {
    if (candidate.remote_flexibility === "strict") {
      result.score = 0;
      result.isBlocker = true;
      result.warning = "Kandidat möchte nur Remote arbeiten, Job erfordert Präsenz";
      result.details = {
        candidateRemotePreference: candidate.remote_days_preferred,
        jobOnsiteRequired: job.onsite_days_required,
        isRemoteMismatch: true,
      };
      return result;
    } else {
      // Flexible but prefers remote
      result.score = 40;
      result.warning = "Kandidat bevorzugt Remote, Job erfordert Präsenz - Rückfrage empfohlen";
      result.requiresConfirmation = true;
    }
  }

  // Check if we have coordinates for routing
  const hasCoordinates = 
    candidate.address_lat && candidate.address_lng && 
    job.office_lat && job.office_lng;

  if (!hasCoordinates) {
    // Can't calculate - return neutral score
    result.score = 70;
    result.details = { reason: "Keine Koordinaten für Routenberechnung verfügbar" };
    result.warning = "Pendeldistanz kann nicht berechnet werden - Adressen fehlen";
    return result;
  }

  // Get routing time
  const routeResult = await getRoutingTime(
    supabase,
    { lat: Number(candidate.address_lat), lng: Number(candidate.address_lng) },
    { lat: Number(job.office_lat), lng: Number(job.office_lng) },
    candidate.commute_mode || "car"
  );

  if (!routeResult) {
    result.score = 70;
    result.details = { reason: "Routenberechnung fehlgeschlagen" };
    return result;
  }

  const travelTime = routeResult.duration;
  const maxCommute = candidate.max_commute_minutes || 30;
  const onsiteDays = job.onsite_days_required || 5;

  result.details = {
    actualTravelTime: travelTime,
    maxCommutePreference: maxCommute,
    onsiteDaysRequired: onsiteDays,
    commuteMode: candidate.commute_mode || "car",
    distanceKm: routeResult.distance,
  };

  // Check for commute override (candidate already confirmed)
  const { data: override } = await supabase
    .from("commute_overrides")
    .select("*")
    .eq("candidate_id", candidate.id)
    .eq("job_id", job.id)
    .single();

  if (override?.response === "yes") {
    result.score = 85;
    result.details.hasOverride = true;
    result.details.overrideResponse = "accepted";
    result.aiReasoning = "Kandidat hat längere Pendelzeit bereits akzeptiert";
    return result;
  } else if (override?.response === "no") {
    result.score = 10;
    result.isBlocker = true;
    result.details.hasOverride = true;
    result.details.overrideResponse = "rejected";
    result.warning = "Kandidat hat Pendelzeit abgelehnt";
    return result;
  } else if (override?.response === "conditional") {
    result.score = 60;
    result.details.hasOverride = true;
    result.details.overrideResponse = "conditional";
    result.warning = "Kandidat ist unsicher bezüglich Pendelzeit";
  }

  // Calculate effective burden (onsite days matter)
  const effectiveBurden = travelTime * onsiteDays;
  const maxBurden = maxCommute * 5;

  // Scoring based on travel time vs preference
  if (travelTime <= maxCommute) {
    // Perfect match
    result.score = 100;
  } else {
    const overrunPercent = ((travelTime - maxCommute) / maxCommute) * 100;

    if (overrunPercent <= 33) {
      // Slight overrun (up to 33% over)
      result.score = Math.max(65, Math.round(100 - overrunPercent * 1.2));
      result.warning = `Pendelzeit ${travelTime} Min (max. ${maxCommute} Min gewünscht)`;
    } else if (overrunPercent <= 100) {
      // Significant overrun (up to double)
      result.score = Math.max(25, Math.round(65 - overrunPercent * 0.4));
      result.warning = `Pendelzeit deutlich über Präferenz - Kandidat fragen!`;
      result.requiresConfirmation = true;
    } else {
      // More than double - critical
      result.score = 10;
      result.warning = `Kritische Pendeldistanz (${travelTime} Min) - sehr hohes Absage-Risiko`;
      result.requiresConfirmation = true;

      if (job.commute_flexibility === "strict") {
        result.isBlocker = true;
      }
    }

    // Adjust score if less onsite days (burden is lower)
    if (onsiteDays < 5) {
      const burdenFactor = onsiteDays / 5;
      const scoreBoost = Math.round((100 - result.score) * (1 - burdenFactor) * 0.5);
      result.score = Math.min(95, result.score + scoreBoost);
      result.details.adjustedForOnsiteDays = true;
      result.aiReasoning = `Score angepasst: nur ${onsiteDays} Tage vor Ort pro Woche`;
    }
  }

  return result;
}

async function calculateSkillsMatch(
  candidate: any,
  job: any,
  apiKey: string
): Promise<FactorScore> {
  const result: FactorScore = {
    score: 50,
    weight: DEFAULT_WEIGHTS.skills,
    isBlocker: false,
    details: {},
  };

  const candidateSkills = candidate.skills || [];
  const jobSkills = job.skills || [];
  const mustHaves = job.must_haves || [];
  const niceToHaves = job.nice_to_haves || [];

  // AI-based skill matching
  const systemPrompt = `Du bist ein KI-Recruiting-Experte. Analysiere die Skill-Übereinstimmung.
Berücksichtige:
- Synonyme (z.B. JS = JavaScript)
- Transferable Skills (z.B. React → Vue ist lernbar)
- Senioritätslevel
- Fehlende Must-Haves sind kritisch!

Antworte NUR mit JSON:
{
  "matchedSkills": ["skill1", "skill2"],
  "transferableSkills": [{"from": "React", "to": "Vue", "transferability": 80}],
  "missingMustHaves": ["skill"],
  "missingNiceToHaves": ["skill"],
  "skillScore": 0-100,
  "reasoning": "Kurze Begründung"
}`;

  const userPrompt = `
KANDIDATEN-SKILLS: ${candidateSkills.join(", ") || "Keine"}
Erfahrungsjahre: ${candidate.experience_years || "?"}
Seniority: ${candidate.seniority || "?"}
CV-Zusammenfassung: ${candidate.cv_ai_summary || candidate.summary || "Keine"}

JOB-ANFORDERUNGEN:
Must-Haves: ${mustHaves.join(", ") || "Keine"}
Nice-to-Haves: ${niceToHaves.join(", ") || "Keine"}
Skills: ${jobSkills.join(", ") || "Keine"}
Level: ${job.experience_level || "?"}`;

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const analysis = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");

      result.score = analysis.skillScore || 50;
      result.details = {
        matchedSkills: analysis.matchedSkills || [],
        transferableSkills: analysis.transferableSkills || [],
        missingMustHaves: analysis.missingMustHaves || [],
        missingNiceToHaves: analysis.missingNiceToHaves || [],
      };
      result.aiReasoning = analysis.reasoning;

      // Check for blocking must-haves
      if (analysis.missingMustHaves?.length > 2) {
        result.warning = `${analysis.missingMustHaves.length} Must-Have-Skills fehlen`;
        if (analysis.missingMustHaves.length > 3) {
          result.score = Math.min(result.score, 30);
        }
      }
    }
  } catch (error) {
    console.error("AI skill analysis error:", error);
    // Fallback: simple matching
    const matched = candidateSkills.filter((s: string) => 
      jobSkills.some((js: string) => js.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(js.toLowerCase()))
    );
    result.score = Math.min(100, Math.round((matched.length / Math.max(jobSkills.length, 1)) * 100));
    result.details = { matchedSkills: matched, fallbackCalculation: true };
  }

  return result;
}

function calculateSalaryMatch(candidate: any, job: any): FactorScore {
  const result: FactorScore = {
    score: 70,
    weight: DEFAULT_WEIGHTS.salary,
    isBlocker: false,
    details: {},
  };

  const expectedSalary = candidate.expected_salary || candidate.salary_expectation_min;
  const salaryMin = job.salary_min;
  const salaryMax = job.salary_max;

  if (!expectedSalary || (!salaryMin && !salaryMax)) {
    result.details = { reason: "Gehaltsinformationen unvollständig" };
    return result;
  }

  result.details = {
    candidateExpected: expectedSalary,
    jobMin: salaryMin,
    jobMax: salaryMax,
  };

  // Perfect match: within range
  if (expectedSalary >= salaryMin && expectedSalary <= salaryMax) {
    result.score = 100;
    return result;
  }

  // Below range - great for employer
  if (expectedSalary < salaryMin) {
    const underBy = ((salaryMin - expectedSalary) / salaryMin) * 100;
    result.score = Math.min(100, 95 + Math.round(underBy / 10)); // Slight bonus
    result.details.belowRange = true;
    return result;
  }

  // Above range
  const overBy = ((expectedSalary - salaryMax) / salaryMax) * 100;
  
  if (overBy <= 10) {
    result.score = 80;
    result.warning = `Gehaltserwartung ${overBy.toFixed(0)}% über Budget`;
  } else if (overBy <= 20) {
    result.score = 60;
    result.warning = `Gehaltserwartung ${overBy.toFixed(0)}% über Budget - Verhandlung nötig`;
    result.requiresConfirmation = true;
  } else if (overBy <= 35) {
    result.score = 35;
    result.warning = `Gehaltslücke von ${overBy.toFixed(0)}% - schwierig zu schließen`;
  } else {
    result.score = 15;
    result.warning = `Große Gehaltslücke (${overBy.toFixed(0)}%) - Deal unwahrscheinlich`;
    result.isBlocker = overBy > 50;
  }

  return result;
}

function calculateExperienceMatch(candidate: any, job: any): FactorScore {
  const result: FactorScore = {
    score: 70,
    weight: DEFAULT_WEIGHTS.experience,
    isBlocker: false,
    details: {},
  };

  const candidateYears = candidate.experience_years;
  const requiredLevel = job.experience_level?.toLowerCase();

  if (!candidateYears) {
    result.details = { reason: "Erfahrungsjahre nicht angegeben" };
    return result;
  }

  // Map levels to year ranges
  const levelRanges: Record<string, [number, number]> = {
    "junior": [0, 2],
    "mid": [2, 5],
    "senior": [5, 10],
    "lead": [7, 15],
    "principal": [10, 25],
    "executive": [15, 30],
  };

  result.details = {
    candidateYears,
    requiredLevel,
    candidateSeniority: candidate.seniority,
  };

  if (!requiredLevel || !levelRanges[requiredLevel]) {
    // No level specified - score based on years alone
    result.score = Math.min(100, 60 + candidateYears * 4);
    return result;
  }

  const [minYears, maxYears] = levelRanges[requiredLevel];

  if (candidateYears >= minYears && candidateYears <= maxYears) {
    result.score = 100;
  } else if (candidateYears < minYears) {
    const gap = minYears - candidateYears;
    result.score = Math.max(20, 100 - gap * 20);
    result.warning = `${gap} Jahre unter Mindestanforderung`;
    if (gap > 2) result.isBlocker = true;
  } else {
    // Overqualified
    const over = candidateYears - maxYears;
    result.score = Math.max(60, 100 - over * 5);
    result.warning = "Möglicherweise überqualifiziert";
  }

  return result;
}

function calculateCultureMatch(candidate: any, job: any): FactorScore {
  // Simplified culture matching based on available data
  const result: FactorScore = {
    score: 75,
    weight: DEFAULT_WEIGHTS.culture,
    isBlocker: false,
    details: {},
  };

  let score = 75;
  const factors: string[] = [];

  // Remote preference alignment
  const candidateRemote = candidate.remote_days_preferred || 0;
  const jobRemotePolicy = job.remote_policy;
  const onsiteDays = job.onsite_days_required || 5;
  const availableRemoteDays = 5 - onsiteDays;

  if (jobRemotePolicy === "full_remote" && candidateRemote >= 4) {
    score += 10;
    factors.push("Remote-Präferenz passt");
  } else if (jobRemotePolicy === "onsite_only" && candidateRemote <= 1) {
    score += 10;
    factors.push("Vor-Ort-Präferenz passt");
  } else if (jobRemotePolicy === "hybrid") {
    if (Math.abs(candidateRemote - availableRemoteDays) <= 1) {
      score += 5;
      factors.push("Hybrid-Modell passt");
    }
  }

  // Work model alignment
  if (candidate.work_model && job.remote_type) {
    if (candidate.work_model === job.remote_type) {
      score += 5;
      factors.push("Arbeitsmodell stimmt überein");
    }
  }

  // Industry experience
  if (candidate.industry_experience && job.industry) {
    const industries = Array.isArray(candidate.industry_experience) 
      ? candidate.industry_experience 
      : [];
    if (industries.some((i: string) => i.toLowerCase().includes(job.industry.toLowerCase()))) {
      score += 10;
      factors.push("Branchenerfahrung vorhanden");
    }
  }

  result.score = Math.min(100, score);
  result.details = { factors, baseScore: 75 };

  return result;
}

function calculateDealProbability(
  factors: MatchResult["factors"],
  blockers: BlockerInfo[],
  warnings: WarningInfo[]
): number {
  if (blockers.length > 0) return 5;

  const factorScores = Object.values(factors);
  const weightedSum = factorScores.reduce((sum, f) => sum + f.score * f.weight, 0);
  
  // Start with weighted average
  let probability = weightedSum;

  // Reduce for warnings
  const highWarnings = warnings.filter(w => w.severity === "medium").length;
  probability -= highWarnings * 8;

  // Reduce for confirmation-required factors
  const confirmationNeeded = factorScores.filter(f => f.requiresConfirmation).length;
  probability -= confirmationNeeded * 10;

  return Math.max(5, Math.min(95, Math.round(probability)));
}

function generateRecommendations(result: MatchResult, candidate: any, job: any): string[] {
  const recommendations: string[] = [];

  // Commute recommendations
  if (result.factors.commute.requiresConfirmation) {
    recommendations.push(`Kandidat zur Pendelzeit befragen (${result.factors.commute.details.actualTravelTime || "?"} Min)`);
  }

  // Salary recommendations
  if (result.factors.salary.score < 60) {
    recommendations.push("Gehaltsverhandlung vor Einreichung klären");
  }

  // Skills recommendations
  const missingMustHaves = result.factors.skills.details.missingMustHaves as string[] || [];
  if (missingMustHaves.length > 0) {
    recommendations.push(`Fehlende Must-Haves prüfen: ${missingMustHaves.slice(0, 3).join(", ")}`);
  }

  // Deal probability recommendations
  if (result.dealProbability < 40) {
    recommendations.push("Niedriges Placement-Potenzial - weitere Kandidaten prüfen");
  } else if (result.dealProbability > 75) {
    recommendations.push("Starker Match - schnelle Einreichung empfohlen");
  }

  return recommendations;
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, jobId }: MatchRequest = await req.json();

    console.log(`[calculate-match-v2] Starting: candidate=${candidateId}, job=${jobId}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate and job data
    const [candidateResult, jobResult] = await Promise.all([
      supabase.from("candidates").select("*").eq("id", candidateId).single(),
      supabase.from("jobs").select("*").eq("id", jobId).single(),
    ]);

    if (candidateResult.error || !candidateResult.data) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    if (jobResult.error || !jobResult.data) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const candidate = candidateResult.data;
    const job = jobResult.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Calculate all factors
    console.log("[calculate-match-v2] Calculating factors...");
    
    const [commuteScore, skillsScore, salaryScore, experienceScore, cultureScore] = await Promise.all([
      calculateCommuteMatch(supabase, candidate, job),
      calculateSkillsMatch(candidate, job, LOVABLE_API_KEY),
      Promise.resolve(calculateSalaryMatch(candidate, job)),
      Promise.resolve(calculateExperienceMatch(candidate, job)),
      Promise.resolve(calculateCultureMatch(candidate, job)),
    ]);

    const factors = {
      skills: skillsScore,
      experience: experienceScore,
      salary: salaryScore,
      commute: commuteScore,
      culture: cultureScore,
    };

    // Collect blockers and warnings
    const blockers: BlockerInfo[] = [];
    const warnings: WarningInfo[] = [];

    for (const [name, factor] of Object.entries(factors)) {
      if (factor.isBlocker) {
        blockers.push({
          factor: name,
          reason: factor.warning || `${name} Score ist zu niedrig`,
          severity: "critical",
        });
      } else if (factor.warning) {
        warnings.push({
          factor: name,
          message: factor.warning,
          severity: factor.requiresConfirmation ? "medium" : "low",
          actionRequired: factor.requiresConfirmation,
        });
      }
    }

    // Calculate overall score and deal probability
    const overallScore = blockers.length > 0 
      ? 0 
      : Math.round(
          Object.values(factors).reduce((sum, f) => sum + f.score * f.weight, 0)
        );

    const dealProbability = calculateDealProbability(factors, blockers, warnings);

    const result: MatchResult = {
      overallScore,
      dealProbability,
      factors,
      blockers,
      warnings,
      recommendations: [],
    };

    result.recommendations = generateRecommendations(result, candidate, job);

    // Update submission with match score if exists
    const { data: submission } = await supabase
      .from("submissions")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("job_id", jobId)
      .single();

    if (submission) {
      await supabase
        .from("submissions")
        .update({ 
          match_score: overallScore,
        })
        .eq("id", submission.id);
    }

    console.log(`[calculate-match-v2] Complete: score=${overallScore}, dealProb=${dealProbability}, blockers=${blockers.length}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-match-v2] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
