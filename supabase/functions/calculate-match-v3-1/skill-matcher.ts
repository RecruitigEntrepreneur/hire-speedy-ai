// ============================================
// SKILL MATCHER MODULE V1
// Multi-stage skill matching with fuzzy matching,
// synonyms, and transferability detection
// ============================================

// ============================================
// TYPES
// ============================================

export interface SkillMatchResult {
  skill: string;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'transferable' | 'partial' | 'missing';
  confidence: number;
  matchedWith?: string;
  credit: number;
}

export interface BatchSkillMatchResult {
  matched: SkillMatchResult[];
  transferable: SkillMatchResult[];
  missing: SkillMatchResult[];
  mustHaveMissing: string[];
  coverage: number;
  mustHaveCoverage: number;
  score: number;
}

export interface SkillMatchOptions {
  fuzzyThreshold?: number;      // Min similarity for fuzzy match (0.0-1.0)
  transferableCredit?: number;  // Credit for transferable skills (0.0-1.0)
  partialCredit?: number;       // Credit for partial matches (0.0-1.0)
  enableFuzzy?: boolean;        // Enable/disable fuzzy matching
}

// ============================================
// HARDCODED SYNONYMS (später aus DB)
// ============================================

const SKILL_SYNONYMS: Record<string, string[]> = {
  // JavaScript ecosystem
  'javascript': ['js', 'ecmascript', 'es6', 'es2015', 'es2020', 'vanilla js'],
  'typescript': ['ts'],
  'react': ['reactjs', 'react.js', 'react 18', 'react 17'],
  'vue': ['vuejs', 'vue.js', 'vue 3', 'vue 2'],
  'angular': ['angularjs', 'angular.js', 'ng'],
  'next.js': ['nextjs', 'next'],
  'nuxt': ['nuxtjs', 'nuxt.js'],
  'node.js': ['nodejs', 'node', 'express', 'expressjs'],
  
  // Backend languages
  'python': ['python3', 'python 3', 'py'],
  'java': ['java 8', 'java 11', 'java 17', 'java 21', 'openjdk'],
  'c#': ['csharp', 'c sharp', '.net', 'dotnet', 'asp.net'],
  'go': ['golang'],
  'rust': ['rust-lang'],
  'ruby': ['ruby on rails', 'rails', 'ror'],
  'php': ['laravel', 'symfony'],
  
  // Databases
  'postgresql': ['postgres', 'psql', 'pg'],
  'mysql': ['mariadb'],
  'mongodb': ['mongo'],
  'redis': ['redis cache'],
  'elasticsearch': ['elastic', 'es', 'elk'],
  
  // Cloud & DevOps
  'aws': ['amazon web services', 'amazon aws'],
  'gcp': ['google cloud', 'google cloud platform'],
  'azure': ['microsoft azure', 'ms azure'],
  'kubernetes': ['k8s', 'kube'],
  'docker': ['container', 'containerization'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment', 'jenkins', 'github actions', 'gitlab ci'],
  'terraform': ['tf', 'infrastructure as code', 'iac'],
  
  // Frontend tools
  'tailwind': ['tailwindcss', 'tailwind css'],
  'sass': ['scss'],
  'webpack': ['bundler'],
  
  // Mobile
  'react native': ['reactnative', 'rn'],
  'flutter': ['dart'],
  'swift': ['swiftui', 'ios development'],
  'kotlin': ['android development', 'jetpack compose'],
  
  // Data & ML
  'machine learning': ['ml', 'ai', 'artificial intelligence'],
  'deep learning': ['dl', 'neural networks'],
  'tensorflow': ['tf', 'keras'],
  'pytorch': ['torch'],
  'pandas': ['dataframe'],
  'spark': ['apache spark', 'pyspark'],
  
  // German-specific terms
  'softwareentwicklung': ['software development', 'entwicklung'],
  'webentwicklung': ['web development', 'web-entwicklung'],
  'datenbank': ['database'],
  'buchhaltung': ['accounting', 'buchführung'],
  'controlling': ['controller', 'finanzcontrolling'],
  
  // SAP
  'sap': ['sap erp', 'sap s/4hana'],
  'abap': ['sap abap', 'abap entwicklung'],
  
  // Tools & Methodologies
  'agile': ['scrum', 'kanban', 'agil'],
  'jira': ['atlassian jira', 'jira software'],
  'git': ['github', 'gitlab', 'bitbucket', 'version control'],
  'figma': ['figma design'],
};

// Build reverse lookup map for efficiency
const SYNONYM_REVERSE_MAP: Map<string, string> = new Map();
for (const [canonical, synonyms] of Object.entries(SKILL_SYNONYMS)) {
  SYNONYM_REVERSE_MAP.set(canonical.toLowerCase(), canonical.toLowerCase());
  for (const synonym of synonyms) {
    SYNONYM_REVERSE_MAP.set(synonym.toLowerCase(), canonical.toLowerCase());
  }
}

// ============================================
// NORMALIZATION
// ============================================

export function normalizeSkill(skill: string): string {
  return skill
    .toLowerCase()
    .trim()
    // Remove special characters but keep dots and slashes (for Next.js, CI/CD etc)
    .replace(/[^\w\s.\/\-#\+]/g, '')
    // Remove version numbers like "React 18" -> "react"
    .replace(/\s*\d+(\.\d+)*\s*$/g, '')
    // Normalize spaces
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// LEVENSHTEIN DISTANCE (Fuzzy Matching)
// ============================================

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function calculateSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

// ============================================
// CORE MATCHING FUNCTIONS
// ============================================

/**
 * Match a single required skill against candidate skills
 */
export function matchSkill(
  requiredSkill: string,
  candidateSkills: string[],
  taxonomy: any[],
  options: SkillMatchOptions = {}
): SkillMatchResult {
  const {
    fuzzyThreshold = 0.85,
    transferableCredit = 0.7,
    partialCredit = 0.7,
    enableFuzzy = true
  } = options;

  const normalizedRequired = normalizeSkill(requiredSkill);
  const normalizedCandidate = candidateSkills.map(normalizeSkill);

  // 1. EXACT MATCH (100% credit)
  const exactMatch = normalizedCandidate.find(cs => cs === normalizedRequired);
  if (exactMatch) {
    return {
      skill: requiredSkill,
      matchType: 'exact',
      confidence: 1.0,
      matchedWith: exactMatch,
      credit: 1.0
    };
  }

  // 2. ALIAS/SYNONYM MATCH (100% credit)
  const canonicalRequired = SYNONYM_REVERSE_MAP.get(normalizedRequired) || normalizedRequired;
  
  for (const candidateSkill of normalizedCandidate) {
    const canonicalCandidate = SYNONYM_REVERSE_MAP.get(candidateSkill) || candidateSkill;
    
    if (canonicalRequired === canonicalCandidate) {
      return {
        skill: requiredSkill,
        matchType: 'alias',
        confidence: 1.0,
        matchedWith: candidateSkill,
        credit: 1.0
      };
    }
  }

  // 2b. CHECK TAXONOMY ALIASES (100% credit)
  const taxEntry = taxonomy.find(t => 
    normalizeSkill(t.canonical_name || '') === normalizedRequired
  );
  
  if (taxEntry?.aliases) {
    const aliases = Array.isArray(taxEntry.aliases) ? taxEntry.aliases : [];
    for (const alias of aliases) {
      const normalizedAlias = normalizeSkill(alias);
      if (normalizedCandidate.some(cs => cs === normalizedAlias || cs.includes(normalizedAlias))) {
        return {
          skill: requiredSkill,
          matchType: 'alias',
          confidence: 1.0,
          matchedWith: alias,
          credit: 1.0
        };
      }
    }
  }

  // 3. FUZZY MATCH (85-99% credit based on similarity)
  if (enableFuzzy) {
    let bestFuzzyMatch: { skill: string; similarity: number } | null = null;
    
    for (const candidateSkill of normalizedCandidate) {
      const similarity = calculateSimilarity(normalizedRequired, candidateSkill);
      
      if (similarity >= fuzzyThreshold && (!bestFuzzyMatch || similarity > bestFuzzyMatch.similarity)) {
        bestFuzzyMatch = { skill: candidateSkill, similarity };
      }
    }
    
    if (bestFuzzyMatch) {
      return {
        skill: requiredSkill,
        matchType: 'fuzzy',
        confidence: bestFuzzyMatch.similarity,
        matchedWith: bestFuzzyMatch.skill,
        credit: bestFuzzyMatch.similarity
      };
    }
  }

  // 4. TRANSFERABLE MATCH (from taxonomy, 70% credit)
  if (taxEntry?.transferability_from && typeof taxEntry.transferability_from === 'object') {
    for (const [fromSkill, transferability] of Object.entries(taxEntry.transferability_from)) {
      const normalizedFrom = normalizeSkill(fromSkill);
      if (normalizedCandidate.some(cs => cs.includes(normalizedFrom) || normalizedFrom.includes(cs))) {
        const transferValue = typeof transferability === 'number' ? transferability / 100 : 0.7;
        return {
          skill: requiredSkill,
          matchType: 'transferable',
          confidence: transferValue,
          matchedWith: fromSkill,
          credit: transferValue * transferableCredit
        };
      }
    }
  }

  // 5. PARTIAL MATCH (substring, 70% credit)
  for (const candidateSkill of normalizedCandidate) {
    // Check if one contains the other (min 4 chars to avoid false positives)
    if (normalizedRequired.length >= 4 && candidateSkill.length >= 4) {
      if (candidateSkill.includes(normalizedRequired) || normalizedRequired.includes(candidateSkill)) {
        return {
          skill: requiredSkill,
          matchType: 'partial',
          confidence: 0.8,
          matchedWith: candidateSkill,
          credit: partialCredit
        };
      }
    }
  }

  // 6. NO MATCH
  return {
    skill: requiredSkill,
    matchType: 'missing',
    confidence: 0,
    credit: 0
  };
}

/**
 * Match all required skills against candidate skills (batch operation)
 */
export function matchAllSkills(
  mustHaveSkills: string[],
  niceToHaveSkills: string[],
  candidateSkills: string[],
  taxonomy: any[],
  options: SkillMatchOptions = {}
): BatchSkillMatchResult {
  const matched: SkillMatchResult[] = [];
  const transferable: SkillMatchResult[] = [];
  const missing: SkillMatchResult[] = [];
  const mustHaveMissing: string[] = [];

  let mustHaveCredit = 0;
  let mustHaveTotal = mustHaveSkills.length;
  let totalCredit = 0;
  let totalWeight = 0;

  // Process must-haves (full weight)
  for (const skill of mustHaveSkills) {
    const result = matchSkill(skill, candidateSkills, taxonomy, options);
    totalWeight += 1.0;

    if (result.matchType === 'exact' || result.matchType === 'alias' || result.matchType === 'fuzzy') {
      matched.push(result);
      mustHaveCredit += result.credit;
      totalCredit += result.credit;
    } else if (result.matchType === 'transferable' || result.matchType === 'partial') {
      transferable.push(result);
      mustHaveCredit += result.credit;
      totalCredit += result.credit;
    } else {
      missing.push(result);
      mustHaveMissing.push(skill);
    }
  }

  // Process nice-to-haves (half weight)
  for (const skill of niceToHaveSkills) {
    const result = matchSkill(skill, candidateSkills, taxonomy, options);
    totalWeight += 0.5;

    if (result.matchType === 'exact' || result.matchType === 'alias' || result.matchType === 'fuzzy') {
      matched.push(result);
      totalCredit += result.credit * 0.5;
    } else if (result.matchType === 'transferable' || result.matchType === 'partial') {
      transferable.push(result);
      totalCredit += result.credit * 0.5;
    }
    // Don't add nice-to-haves to missing list
  }

  const mustHaveCoverage = mustHaveTotal > 0 ? mustHaveCredit / mustHaveTotal : 1.0;
  const coverage = totalWeight > 0 ? totalCredit / totalWeight : 0.5;
  const score = Math.round(coverage * 100);

  return {
    matched,
    transferable,
    missing,
    mustHaveMissing,
    coverage,
    mustHaveCoverage: Math.min(1.0, mustHaveCoverage),
    score
  };
}

/**
 * Helper to extract unique matched skill names for display
 */
export function getMatchedSkillNames(result: BatchSkillMatchResult): string[] {
  return [...new Set([
    ...result.matched.map(r => r.skill),
    ...result.transferable.map(r => r.skill)
  ])];
}

/**
 * Helper to extract missing skill names for display
 */
export function getMissingSkillNames(result: BatchSkillMatchResult): string[] {
  return [...new Set(result.missing.map(r => r.skill))];
}

/**
 * Get a canonical form of a skill (resolves synonyms)
 */
export function getCanonicalSkill(skill: string): string {
  const normalized = normalizeSkill(skill);
  return SYNONYM_REVERSE_MAP.get(normalized) || normalized;
}

/**
 * Check if two skills are equivalent (considering synonyms)
 */
export function areSkillsEquivalent(skillA: string, skillB: string): boolean {
  const canonicalA = getCanonicalSkill(skillA);
  const canonicalB = getCanonicalSkill(skillB);
  return canonicalA === canonicalB;
}

// ============================================
// SKILL LEVEL MATCHING (Phase 6)
// ============================================

export interface CandidateSkillLevel {
  skill_name: string;
  level: string | null; // 'beginner' | 'intermediate' | 'advanced' | 'expert'
  years_experience: number | null;
  last_used: string | null; // Date string
  is_primary: boolean;
  verified: boolean;
}

export interface JobSkillRequirement {
  skill_name: string;
  type: string; // 'must_have' | 'nice_to_have'
  min_years: number | null;
  min_proficiency: string | null; // 'beginner' | 'intermediate' | 'advanced' | 'expert'
  recency_required: number | null; // months
}

export interface SkillLevelMatchResult {
  skill: string;
  hasSkill: boolean;
  levelMatch: {
    yearsScore: number;      // 0-100
    proficiencyScore: number; // 0-100
    recencyScore: number;     // 0-100
    overall: number;          // Weighted average
  };
  details: {
    candidateYears: number | null;
    requiredYears: number | null;
    candidateLevel: string | null;
    requiredLevel: string | null;
    lastUsedMonths: number | null;
    recencyRequired: number | null;
  };
}

const PROFICIENCY_LEVELS: Record<string, number> = {
  'beginner': 1,
  'intermediate': 2,
  'advanced': 3,
  'expert': 4
};

/**
 * Calculate skill level match score for a single skill
 * Weights: Years 40%, Proficiency 40%, Recency 20%
 */
export function calculateSkillLevelMatch(
  candidateSkill: CandidateSkillLevel | null,
  jobRequirement: JobSkillRequirement
): SkillLevelMatchResult {
  // If candidate doesn't have the skill, return 0
  if (!candidateSkill) {
    return {
      skill: jobRequirement.skill_name,
      hasSkill: false,
      levelMatch: {
        yearsScore: 0,
        proficiencyScore: 0,
        recencyScore: 0,
        overall: 0
      },
      details: {
        candidateYears: null,
        requiredYears: jobRequirement.min_years,
        candidateLevel: null,
        requiredLevel: jobRequirement.min_proficiency,
        lastUsedMonths: null,
        recencyRequired: jobRequirement.recency_required
      }
    };
  }

  let yearsScore = 100;
  let proficiencyScore = 100;
  let recencyScore = 100;

  // Years experience check
  const reqYears = jobRequirement.min_years;
  const candYears = candidateSkill.years_experience;

  if (reqYears !== null && reqYears > 0) {
    if (candYears === null) {
      yearsScore = 70; // No data, give partial credit
    } else if (candYears >= reqYears) {
      yearsScore = 100;
    } else if (candYears >= reqYears * 0.75) {
      yearsScore = 85;
    } else if (candYears >= reqYears * 0.5) {
      yearsScore = 70;
    } else {
      yearsScore = 50;
    }
  }

  // Proficiency level check
  const reqLevel = jobRequirement.min_proficiency;
  const candLevel = candidateSkill.level;

  if (reqLevel !== null) {
    const reqLevelNum = PROFICIENCY_LEVELS[reqLevel] || 2;
    const candLevelNum = candLevel ? (PROFICIENCY_LEVELS[candLevel] || 2) : 2;

    if (candLevelNum >= reqLevelNum) {
      proficiencyScore = 100;
    } else if (candLevelNum === reqLevelNum - 1) {
      proficiencyScore = 75;
    } else {
      proficiencyScore = 50;
    }
  }

  // Recency check
  const recencyRequired = jobRequirement.recency_required;
  const lastUsed = candidateSkill.last_used;

  let lastUsedMonths: number | null = null;
  if (recencyRequired !== null && recencyRequired > 0) {
    if (lastUsed === null) {
      recencyScore = 80; // No data, give partial credit
    } else {
      const lastUsedDate = new Date(lastUsed);
      const now = new Date();
      lastUsedMonths = Math.floor((now.getTime() - lastUsedDate.getTime()) / (1000 * 60 * 60 * 24 * 30));

      if (lastUsedMonths <= recencyRequired) {
        recencyScore = 100;
      } else if (lastUsedMonths <= recencyRequired * 1.5) {
        recencyScore = 80;
      } else if (lastUsedMonths <= recencyRequired * 2) {
        recencyScore = 60;
      } else {
        recencyScore = 40;
      }
    }
  }

  // Verified skill bonus
  if (candidateSkill.verified) {
    yearsScore = Math.min(100, yearsScore + 5);
    proficiencyScore = Math.min(100, proficiencyScore + 5);
  }

  // Primary skill bonus
  if (candidateSkill.is_primary) {
    yearsScore = Math.min(100, yearsScore + 3);
    proficiencyScore = Math.min(100, proficiencyScore + 3);
  }

  // Weighted average: Years 40%, Proficiency 40%, Recency 20%
  const overall = Math.round(
    yearsScore * 0.4 +
    proficiencyScore * 0.4 +
    recencyScore * 0.2
  );

  return {
    skill: jobRequirement.skill_name,
    hasSkill: true,
    levelMatch: {
      yearsScore,
      proficiencyScore,
      recencyScore,
      overall
    },
    details: {
      candidateYears: candYears,
      requiredYears: reqYears,
      candidateLevel: candLevel,
      requiredLevel: reqLevel,
      lastUsedMonths,
      recencyRequired
    }
  };
}

/**
 * Calculate credit adjustment based on skill level match
 * Returns a multiplier (0.7 - 1.0) to apply to base skill credit
 */
export function getSkillLevelCredit(levelMatch: SkillLevelMatchResult): number {
  if (!levelMatch.hasSkill) return 0;

  const overall = levelMatch.levelMatch.overall;

  // No level requirements = full credit
  if (
    levelMatch.details.requiredYears === null &&
    levelMatch.details.requiredLevel === null &&
    levelMatch.details.recencyRequired === null
  ) {
    return 1.0;
  }

  if (overall >= 80) return 1.0;    // Full credit
  if (overall >= 60) return 0.85;   // Minor penalty
  return 0.70;                       // Skill exists but level doesn't match
}
