import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================
// TECH DOMAIN CLASSIFICATION
// ============================================

const TECH_DOMAINS: Record<string, {
  skills: string[];
  transferable_to: string[];
  incompatible_with: string[];
}> = {
  embedded_hardware: {
    skills: ['fpga', 'vhdl', 'verilog', 'embedded', 'hardware', 'pcb', 'altium', 
             'cadence', 'xilinx', 'arm', 'microcontroller', 'rtos', 'tia portal', 
             'beckhoff', 'twincat', 'sps', 'plc', 'elektronik', 'firmware', 'asic',
             'oscilloscope', 'schaltungstechnik', 'eagle', 'kicad', 'labview',
             'signal processing', 'dsp', 'can bus', 'modbus', 'i2c', 'spi', 'uart'],
    transferable_to: ['iot', 'firmware', 'devops'],
    incompatible_with: ['backend_cloud', 'frontend_web', 'data_ml', 'product_management', 'design', 'finance_accounting']
  },
  backend_cloud: {
    skills: ['java', 'spring', 'spring boot', 'aws', 'azure', 'gcp', 'kubernetes', 'docker', 
             'microservices', 'postgresql', 'mongodb', 'redis', 'kafka', 'api', 'rest',
             'graphql', 'node.js', 'python', 'go', 'golang', 'rust', 'c#', '.net', 'dotnet',
             'sql', 'mysql', 'oracle', 'rabbitmq', 'elasticsearch', 'nginx', 'lambda',
             'serverless', 'terraform', 'ci/cd', 'jenkins', 'gitlab'],
    transferable_to: ['devops', 'data_ml', 'frontend_web'],
    incompatible_with: ['embedded_hardware', 'design', 'product_management', 'finance_accounting']
  },
  frontend_web: {
    skills: ['react', 'vue', 'angular', 'typescript', 'javascript', 'css', 
             'html', 'next.js', 'nuxt', 'tailwind', 'webpack', 'vite', 'sass',
             'redux', 'mobx', 'zustand', 'svelte', 'jquery', 'bootstrap',
             'material ui', 'chakra', 'storybook', 'cypress', 'playwright'],
    transferable_to: ['mobile', 'backend_cloud'],
    incompatible_with: ['embedded_hardware', 'data_ml', 'finance_accounting']
  },
  data_ml: {
    skills: ['python', 'tensorflow', 'pytorch', 'pandas', 'spark', 'sql', 
             'machine learning', 'data science', 'ai', 'deep learning', 'numpy',
             'scikit-learn', 'jupyter', 'databricks', 'airflow', 'mlflow',
             'data engineering', 'etl', 'hadoop', 'hive', 'presto', 'dbt',
             'power bi', 'tableau', 'looker', 'snowflake', 'bigquery', 'llm',
             'nlp', 'computer vision', 'opencv', 'huggingface'],
    transferable_to: ['backend_cloud'],
    incompatible_with: ['embedded_hardware', 'frontend_web', 'design', 'finance_accounting']
  },
  devops: {
    skills: ['docker', 'kubernetes', 'terraform', 'ansible', 'ci/cd', 'jenkins', 
             'github actions', 'linux', 'bash', 'aws', 'azure', 'gcp', 'helm',
             'prometheus', 'grafana', 'datadog', 'splunk', 'elk', 'vagrant',
             'puppet', 'chef', 'cloudformation', 'argocd', 'istio', 'envoy'],
    transferable_to: ['backend_cloud', 'embedded_hardware'],
    incompatible_with: ['design', 'product_management', 'finance_accounting']
  },
  mobile: {
    skills: ['swift', 'kotlin', 'react native', 'flutter', 'ios', 'android',
             'objective-c', 'xamarin', 'ionic', 'cordova', 'swiftui', 'jetpack compose',
             'xcode', 'android studio', 'cocoapods', 'gradle'],
    transferable_to: ['frontend_web'],
    incompatible_with: ['embedded_hardware', 'data_ml', 'devops', 'finance_accounting']
  },
  design: {
    skills: ['figma', 'sketch', 'adobe xd', 'ui', 'ux', 'prototyping', 
             'user research', 'design system', 'wireframing', 'invision',
             'zeplin', 'principle', 'framer', 'photoshop', 'illustrator',
             'after effects', 'motion design', 'accessibility', 'usability testing'],
    transferable_to: ['frontend_web', 'product_management'],
    incompatible_with: ['embedded_hardware', 'backend_cloud', 'data_ml', 'devops', 'finance_accounting']
  },
  product_management: {
    skills: ['product management', 'roadmap', 'okr', 'agile', 'scrum', 
             'stakeholder', 'user stories', 'jira', 'confluence', 'product owner',
             'backlog', 'sprint planning', 'kanban', 'a/b testing', 'analytics',
             'customer discovery', 'market research', 'competitive analysis',
             'go-to-market', 'pricing strategy', 'feature prioritization'],
    transferable_to: ['design'],
    incompatible_with: ['embedded_hardware', 'backend_cloud', 'data_ml', 'devops', 'mobile', 'finance_accounting']
  },
  security: {
    skills: ['security', 'cybersecurity', 'penetration testing', 'soc', 'siem',
             'vulnerability', 'compliance', 'iso 27001', 'gdpr', 'firewall',
             'encryption', 'oauth', 'identity', 'iam', 'zero trust', 'devsecops'],
    transferable_to: ['devops', 'backend_cloud'],
    incompatible_with: ['design', 'product_management', 'finance_accounting']
  },
  sap_erp: {
    // NOTE: Generic "SAP" removed - only technical SAP skills trigger this domain
    skills: ['abap', 'sap hana', 'sap fiori', 's/4hana', 'sap mm', 'sap sd',
             'sap fi', 'sap co', 'sap hr', 'sap basis', 'sap entwicklung',
             'sap customizing', 'sap integration', 'sap bw', 'sap btp',
             'erp entwicklung', 'oracle erp', 'dynamics 365 entwicklung'],
    transferable_to: ['backend_cloud', 'finance_accounting'],
    incompatible_with: ['embedded_hardware', 'frontend_web', 'design', 'mobile', 'data_ml']
  },
  finance_accounting: {
    skills: ['buchhaltung', 'finanzbuchhaltung', 'bilanzbuchhaltung', 'buchhalter',
             'fibu', 'controlling', 'jahresabschluss', 'monatsabschluss',
             'kreditorenbuchhaltung', 'debitorenbuchhaltung', 'lohnbuchhaltung',
             'steuerrecht', 'umsatzsteuer', 'hgb', 'ifrs', 'gaap',
             'mahnwesen', 'forderungsmanagement', 'zahlungsverkehr',
             'datev', 'addison', 'lexware', 'navision', 'sage',
             'rechnungswesen', 'steuererklärung', 'bilanz', 'guv',
             'reisekosten', 'anlagenbuchhaltung', 'kostenrechnung',
             'wirtschaftsprüfung', 'audit', 'treasury', 'financial reporting',
             'accounts payable', 'accounts receivable', 'general ledger'],
    transferable_to: ['sap_erp'], // Buchhalter können zu SAP-Finance-Rollen wechseln
    incompatible_with: ['data_ml', 'frontend_web', 'mobile', 'embedded_hardware', 
                        'design', 'devops', 'security', 'backend_cloud']
  },
  hr_recruiting: {
    skills: ['recruiting', 'hr', 'human resources', 'personalwesen', 'bewerbermanagement',
             'onboarding', 'personalentwicklung', 'arbeitsrecht', 'lohnabrechnung',
             'talent acquisition', 'employer branding', 'workday', 'personio'],
    transferable_to: [],
    incompatible_with: ['data_ml', 'backend_cloud', 'frontend_web', 'embedded_hardware', 'devops', 'security']
  },
  marketing_sales: {
    skills: ['marketing', 'sales', 'vertrieb', 'crm', 'hubspot', 'salesforce',
             'content marketing', 'seo', 'sem', 'social media', 'lead generation',
             'account management', 'business development', 'key account'],
    transferable_to: ['product_management'],
    incompatible_with: ['data_ml', 'backend_cloud', 'embedded_hardware', 'devops', 'security']
  }
};

// ============================================
// DOMAIN DETECTION FUNCTIONS
// ============================================

interface DomainDetectionResult {
  primary: string;
  secondary: string | null;
  confidence: number;
  scores: Record<string, number>;
}

function detectCandidateDomain(candidateSkills: string[], jobTitle?: string): DomainDetectionResult {
  const normalizedSkills = (candidateSkills || []).map(s => s.toLowerCase().trim());
  const domainScores: Record<string, number> = {};
  
  for (const [domain, config] of Object.entries(TECH_DOMAINS)) {
    let matchCount = 0;
    for (const skill of normalizedSkills) {
      if (config.skills.some(ds => skill.includes(ds) || ds.includes(skill))) {
        matchCount++;
      }
    }
    // Normalize by candidate skills count, not domain skills count
    domainScores[domain] = normalizedSkills.length > 0 
      ? matchCount / Math.max(normalizedSkills.length, 1)
      : 0;
  }
  
  // Also consider job title for domain hints
  if (jobTitle) {
    const lowerTitle = jobTitle.toLowerCase();
    if (lowerTitle.includes('hardware') || lowerTitle.includes('embedded') || lowerTitle.includes('fpga')) {
      domainScores['embedded_hardware'] = Math.max(domainScores['embedded_hardware'] || 0, 0.5);
    }
    if (lowerTitle.includes('backend') || lowerTitle.includes('java') || lowerTitle.includes('cloud')) {
      domainScores['backend_cloud'] = Math.max(domainScores['backend_cloud'] || 0, 0.5);
    }
    if (lowerTitle.includes('frontend') || lowerTitle.includes('react') || lowerTitle.includes('web')) {
      domainScores['frontend_web'] = Math.max(domainScores['frontend_web'] || 0, 0.5);
    }
    if (lowerTitle.includes('data') || lowerTitle.includes('ml') || lowerTitle.includes('machine learning')) {
      domainScores['data_ml'] = Math.max(domainScores['data_ml'] || 0, 0.5);
    }
    if (lowerTitle.includes('product') || lowerTitle.includes('pm')) {
      domainScores['product_management'] = Math.max(domainScores['product_management'] || 0, 0.5);
    }
    if (lowerTitle.includes('design') || lowerTitle.includes('ux') || lowerTitle.includes('ui')) {
      domainScores['design'] = Math.max(domainScores['design'] || 0, 0.5);
    }
    // Finance/Accounting titles - high confidence boost
    if (lowerTitle.includes('buchhalter') || lowerTitle.includes('accountant') ||
        lowerTitle.includes('finanzbuchhalter') || lowerTitle.includes('bilanzbuchhalter') ||
        lowerTitle.includes('controlling') || lowerTitle.includes('controller') ||
        lowerTitle.includes('steuerfachangestellte') || lowerTitle.includes('tax') ||
        lowerTitle.includes('finance manager') || lowerTitle.includes('accounting')) {
      domainScores['finance_accounting'] = Math.max(domainScores['finance_accounting'] || 0, 0.7);
    }
    // HR/Recruiting titles
    if (lowerTitle.includes('recruiter') || lowerTitle.includes('hr ') || 
        lowerTitle.includes('human resources') || lowerTitle.includes('talent') ||
        lowerTitle.includes('personalreferent') || lowerTitle.includes('people')) {
      domainScores['hr_recruiting'] = Math.max(domainScores['hr_recruiting'] || 0, 0.7);
    }
    // Sales/Marketing titles
    if (lowerTitle.includes('sales') || lowerTitle.includes('vertrieb') ||
        lowerTitle.includes('account manager') || lowerTitle.includes('business development') ||
        lowerTitle.includes('marketing manager') || lowerTitle.includes('key account')) {
      domainScores['marketing_sales'] = Math.max(domainScores['marketing_sales'] || 0, 0.7);
    }
  }
  
  const sorted = Object.entries(domainScores).sort((a, b) => b[1] - a[1]);
  
  return {
    primary: sorted[0]?.[0] || 'other',
    secondary: sorted[1]?.[1] > 0.1 ? sorted[1][0] : null,
    confidence: sorted[0]?.[1] || 0,
    scores: domainScores
  };
}

function detectJobDomain(job: any): DomainDetectionResult {
  const allJobSkills: string[] = [
    ...(job.skills || []),
    ...(job.must_haves || []),
    ...(job.nice_to_haves || [])
  ].map(s => s.toLowerCase().trim());
  
  const domainScores: Record<string, number> = {};
  
  for (const [domain, config] of Object.entries(TECH_DOMAINS)) {
    let matchCount = 0;
    for (const skill of allJobSkills) {
      if (config.skills.some(ds => skill.includes(ds) || ds.includes(skill))) {
        matchCount++;
      }
    }
    domainScores[domain] = allJobSkills.length > 0 
      ? matchCount / Math.max(allJobSkills.length, 1)
      : 0;
  }
  
  // Job title signals
  const jobTitle = (job.title || '').toLowerCase();
  if (jobTitle.includes('hardware') || jobTitle.includes('embedded') || jobTitle.includes('fpga') || jobTitle.includes('firmware')) {
    domainScores['embedded_hardware'] = Math.max(domainScores['embedded_hardware'] || 0, 0.6);
  }
  if (jobTitle.includes('backend') || jobTitle.includes('java') || jobTitle.includes('cloud') || jobTitle.includes('api')) {
    domainScores['backend_cloud'] = Math.max(domainScores['backend_cloud'] || 0, 0.6);
  }
  if (jobTitle.includes('frontend') || jobTitle.includes('react') || jobTitle.includes('web') || jobTitle.includes('vue')) {
    domainScores['frontend_web'] = Math.max(domainScores['frontend_web'] || 0, 0.6);
  }
  if (jobTitle.includes('data') || jobTitle.includes('ml') || jobTitle.includes('machine learning') || jobTitle.includes('ai')) {
    domainScores['data_ml'] = Math.max(domainScores['data_ml'] || 0, 0.6);
  }
  if (jobTitle.includes('product manager') || jobTitle.includes('product owner')) {
    domainScores['product_management'] = Math.max(domainScores['product_management'] || 0, 0.7);
  }
  if (jobTitle.includes('designer') || jobTitle.includes('ux') || jobTitle.includes('ui')) {
    domainScores['design'] = Math.max(domainScores['design'] || 0, 0.6);
  }
  if (jobTitle.includes('devops') || jobTitle.includes('sre') || jobTitle.includes('platform')) {
    domainScores['devops'] = Math.max(domainScores['devops'] || 0, 0.6);
  }
  if (jobTitle.includes('mobile') || jobTitle.includes('ios') || jobTitle.includes('android')) {
    domainScores['mobile'] = Math.max(domainScores['mobile'] || 0, 0.6);
  }
  if (jobTitle.includes('sap') || jobTitle.includes('erp') || jobTitle.includes('abap')) {
    domainScores['sap_erp'] = Math.max(domainScores['sap_erp'] || 0, 0.6);
  }
  if (jobTitle.includes('security') || jobTitle.includes('cyber')) {
    domainScores['security'] = Math.max(domainScores['security'] || 0, 0.6);
  }
  // Finance/Accounting job titles
  if (jobTitle.includes('buchhalter') || jobTitle.includes('accountant') ||
      jobTitle.includes('finance') || jobTitle.includes('controlling') ||
      jobTitle.includes('controller') || jobTitle.includes('accounting') ||
      jobTitle.includes('treasury') || jobTitle.includes('audit')) {
    domainScores['finance_accounting'] = Math.max(domainScores['finance_accounting'] || 0, 0.7);
  }
  // HR/Recruiting job titles
  if (jobTitle.includes('recruiter') || jobTitle.includes('hr ') ||
      jobTitle.includes('human resources') || jobTitle.includes('talent') ||
      jobTitle.includes('people') || jobTitle.includes('personalreferent')) {
    domainScores['hr_recruiting'] = Math.max(domainScores['hr_recruiting'] || 0, 0.7);
  }
  // Sales/Marketing job titles
  if (jobTitle.includes('sales') || jobTitle.includes('vertrieb') ||
      jobTitle.includes('account manager') || jobTitle.includes('business development') ||
      jobTitle.includes('marketing') || jobTitle.includes('key account')) {
    domainScores['marketing_sales'] = Math.max(domainScores['marketing_sales'] || 0, 0.7);
  }
  
  const sorted = Object.entries(domainScores).sort((a, b) => b[1] - a[1]);
  
  return {
    primary: sorted[0]?.[0] || 'other',
    secondary: sorted[1]?.[1] > 0.1 ? sorted[1][0] : null,
    confidence: sorted[0]?.[1] || 0,
    scores: domainScores
  };
}

function formatDomainName(domain: string): string {
  const names: Record<string, string> = {
    embedded_hardware: 'Embedded/Hardware',
    backend_cloud: 'Backend/Cloud',
    frontend_web: 'Frontend/Web',
    data_ml: 'Data/ML',
    devops: 'DevOps',
    mobile: 'Mobile',
    design: 'Design/UX',
    product_management: 'Product Management',
    security: 'Security',
    sap_erp: 'SAP/ERP',
    finance_accounting: 'Finance/Accounting',
    hr_recruiting: 'HR/Recruiting',
    marketing_sales: 'Marketing/Sales',
    other: 'Allgemein'
  };
  return names[domain] || domain;
}

// ============================================
// TYPES
// ============================================

type GateResult = 'pass' | 'warn' | 'fail';
type PolicyTier = 'hot' | 'standard' | 'maybe' | 'hidden';

interface HardKillResult {
  killed: boolean;
  reason?: string;
  category?: string;
}

interface DealBreakerResult {
  multiplier: number;
  factors: {
    salary: number;
    startDate: number;
    seniority: number;
    workModel: number;
    techDomain: number;
  };
  domainMismatch?: {
    candidateDomain: string;
    jobDomain: string;
    isIncompatible: boolean;
  };
}

interface SkillCredit {
  skill: string;
  credit: number;
  matchType: 'direct' | 'transferable' | 'missing';
  cappedCredit?: number;
  prereqPenalty?: boolean;
}

// Enhanced reason with categorization (Phase 5)
interface EnhancedReason {
  text: string;
  impact: 'high' | 'medium' | 'low';
  category: 'skills' | 'experience' | 'salary' | 'availability' | 'location' | 'domain';
}

// Enhanced risk with mitigation (Phase 5)
interface EnhancedRisk {
  text: string;
  severity: 'critical' | 'warning' | 'info';
  mitigatable: boolean;
  mitigation?: string;
  category: 'skills' | 'salary' | 'timing' | 'seniority' | 'domain';
}

// Recruiter action recommendation (Phase 5)
interface RecruiterAction {
  recommendation: 'proceed' | 'review' | 'skip';
  priority: 'high' | 'medium' | 'low';
  nextSteps: string[];
  talkingPoints?: string[];
}

interface V31MatchResult {
  version: string;
  jobId: string;
  overall: number;
  killed: boolean;
  excluded: boolean;
  mustHaveCoverage: number;
  gateMultiplier: number;
  policy: PolicyTier;
  gates: {
    hardKills: {
      visa: boolean;
      language: boolean;
      onsite: boolean;
      license: boolean;
      techDomain: boolean;
    };
    dealbreakers: {
      salary: number;
      startDate: number;
      seniority: number;
      techDomain: number;
      workModel: number;
    };
    multiplier: number;
    domainMismatch?: {
      candidateDomain: string;
      jobDomain: string;
      isIncompatible: boolean;
    };
  };
  fit: {
    score: number;
    breakdown: {
      skills: number;
      experience: number;
      seniority: number;
      industry: number;
    };
    details: {
      skills: {
        matched: string[];
        transferable: string[];
        missing: string[];
        mustHaveMissing: string[];
      };
    };
  };
  constraints: {
    score: number;
    breakdown: {
      salary: number;
      commute: number;
      startDate: number;
    };
  };
  explainability: {
    topReasons: string[];
    topRisks: string[];
    whyNot?: string;
    nextAction: string;
    // Enhanced fields (Phase 5)
    enhancedReasons?: EnhancedReason[];
    enhancedRisks?: EnhancedRisk[];
    recruiterAction?: RecruiterAction;
  };
}

interface MatchingConfig {
  weights: {
    fit: number;
    constraints: number;
    fit_breakdown: { skills: number; experience: number; seniority: number; industry: number };
    constraint_breakdown: { salary: number; commute: number; startDate: number };
  };
  gate_thresholds: any;
  hard_kill_defaults: {
    visa_required: boolean;
    language_required: boolean;
    onsite_required: boolean;
    license_required: boolean;
  };
  dealbreaker_multipliers: {
    salary: { min: number; max: number; multiplier: number }[];
    start_date: { min: number; max: number; multiplier: number }[];
    seniority: { gap: number; multiplier: number }[];
  };
  display_policies: {
    hot: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
    standard: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
    maybe: { minScore: number; minCoverage: number; maxBlockers: number; requiresMultiplier1: boolean };
  };
}

// ============================================
// SYNONYM MAP BUILDER
// ============================================

interface SynonymEntry {
  canonical_name: string;
  synonym: string;
  confidence: number;
  bidirectional: boolean;
}

/**
 * Builds a map of synonyms to their canonical names for fast lookup
 * Bidirectional synonyms are mapped both ways
 */
function buildSynonymMap(synonyms: SynonymEntry[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  
  for (const s of synonyms) {
    const canonical = s.canonical_name.toLowerCase().trim();
    const synonym = s.synonym.toLowerCase().trim();
    
    // Map synonym -> canonical
    if (!map.has(synonym)) {
      map.set(synonym, new Set());
    }
    map.get(synonym)!.add(canonical);
    
    // Add self-reference for canonical
    if (!map.has(canonical)) {
      map.set(canonical, new Set());
    }
    map.get(canonical)!.add(canonical);
    
    // Bidirectional: also map canonical -> synonym
    if (s.bidirectional) {
      map.get(canonical)!.add(synonym);
      if (!map.has(synonym)) {
        map.set(synonym, new Set());
      }
      map.get(synonym)!.add(synonym);
    }
  }
  
  return map;
}

// ============================================
// KEYWORD EXTRACTION FOR LONG REQUIREMENTS
// ============================================

// Finance/Accounting keywords to extract from long requirement sentences
const FINANCE_KEYWORDS = [
  'buchhaltung', 'finanzbuchhaltung', 'lohnbuchhaltung', 'bilanzbuchhaltung',
  'debitorenbuchhaltung', 'kreditorenbuchhaltung', 'anlagenbuchhaltung',
  'rechnungswesen', 'rechnungslegung', 'bilanzierung', 'jahresabschluss',
  'monatsabschluss', 'quartalsabschluss', 'controlling', 'finanzcontrolling',
  'kostenrechnung', 'budgetierung', 'kalkulation', 'hgb', 'ifrs', 'gaap',
  'datev', 'lexware', 'sage', 'addison', 'navision', 'sap fi', 'sap co',
  'steuerrecht', 'steuererklärung', 'umsatzsteuer', 'einkommensteuer',
  'lohnabrechnung', 'payroll', 'gehaltsabrechnung', 'entgeltabrechnung',
  'mahnwesen', 'forderungsmanagement', 'zahlungsverkehr', 'treasury',
  'accounts payable', 'accounts receivable', 'fibu', 'buchführung'
];

// IT keywords (already well-covered, but include for completeness)
const IT_KEYWORDS = [
  'java', 'python', 'react', 'javascript', 'typescript', 'aws', 'docker',
  'kubernetes', 'postgresql', 'node.js', 'angular', 'vue', 'spring',
  'c#', 'c++', 'go', 'rust', 'terraform', 'jenkins', 'gitlab', 'azure'
];

const ALL_SKILL_KEYWORDS = [...FINANCE_KEYWORDS, ...IT_KEYWORDS];

/**
 * Extracts skill keywords from long requirement sentences
 * e.g., "Mehrjährige Berufserfahrung in der Buchhaltung" -> ["buchhaltung"]
 */
function extractSkillKeywords(requirement: string): string[] {
  const lowerReq = requirement.toLowerCase();
  const keywords: string[] = [];
  
  for (const keyword of ALL_SKILL_KEYWORDS) {
    if (lowerReq.includes(keyword)) {
      keywords.push(keyword);
    }
  }
  
  return keywords;
}

// Global synonym map (set during request processing)
let globalSynonymMap: Map<string, Set<string>> = new Map();

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { candidateId, jobIds, mode = 'strict', configProfile = 'default' } = await req.json();

    if (!candidateId || !jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'candidateId and jobIds[] are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`V3.1 Batch Match: Candidate ${candidateId} vs ${jobIds.length} jobs (mode: ${mode})`);

    // 1. Fetch config
    const { data: configData } = await supabase
      .from('matching_config')
      .select('*')
      .eq('active', true)
      .eq('profile', configProfile)
      .single();

    const config = buildConfig(configData);

    // 2. Fetch candidate
    const { data: candidate, error: candError } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidateId)
      .single();

    if (candError || !candidate) {
      throw new Error('Candidate not found');
    }

    // 3. Fetch all jobs in batch
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('*')
      .in('id', jobIds);

    if (jobsError || !jobs) {
      throw new Error('Jobs not found');
    }

    // 4. Fetch job skill requirements in batch
    const { data: allSkillReqs } = await supabase
      .from('job_skill_requirements')
      .select('*')
      .in('job_id', jobIds);

    // 5. Fetch skill taxonomy
    const { data: taxonomy } = await supabase
      .from('skill_taxonomy')
      .select('*');

    // 5b. Fetch skill synonyms for enhanced matching
    const { data: synonyms } = await supabase
      .from('skill_synonyms')
      .select('*')
      .eq('active', true);

    // Build synonym lookup map
    const synonymMap = buildSynonymMap(synonyms || []);

    // Set global synonym map for use in getSkillCredit
    globalSynonymMap = synonymMap;

    // 6. Process each job
    const results: V31MatchResult[] = [];

    for (const job of jobs) {
      const skillReqs = (allSkillReqs || []).filter(sr => sr.job_id === job.id);
      const result = calculateMatch(candidate, job, skillReqs, taxonomy || [], config, mode);
      results.push(result);

      // Store outcome for calibration (ignore errors for matches without submissions)
      try {
        await supabase.from('match_outcomes').insert({
          job_id: job.id,
          candidate_id: candidateId,
          match_version: 'v3.1',
          predicted_overall_score: result.overall,
          must_have_coverage: result.mustHaveCoverage,
          gate_multiplier: result.gateMultiplier,
          policy_tier: result.policy,
          killed: result.killed,
          excluded: result.excluded,
          kill_reason: result.explainability.whyNot
        });
      } catch (e) {
        // Ignore insert errors for matches without submissions
      }
    }

    console.log(`V3.1 Results: ${results.filter(r => r.policy === 'hot').length} hot, ${results.filter(r => r.policy === 'standard').length} standard, ${results.filter(r => r.policy === 'maybe').length} maybe, ${results.filter(r => r.killed || r.excluded).length} excluded`);

    return new Response(
      JSON.stringify({ results, candidateId, mode, configProfile }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-match-v3-1:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============================================
// CONFIG BUILDER
// ============================================

function buildConfig(configData: any): MatchingConfig {
  return {
    weights: configData?.weights || {
      fit: 0.70,
      constraints: 0.30,
      fit_breakdown: { skills: 0.50, experience: 0.15, seniority: 0.03, industry: 0.02 },
      constraint_breakdown: { salary: 0.12, commute: 0.12, startDate: 0.06 }
    },
    gate_thresholds: configData?.gate_thresholds || {
      salary_warn_percent: 10,
      salary_fail_percent: 30,
      commute_warn_minutes: 45,
      commute_fail_minutes: 75,
      availability_warn_days: 60,
      availability_fail_days: 120
    },
    hard_kill_defaults: configData?.hard_kill_defaults || {
      visa_required: true,
      language_required: true,
      onsite_required: true,
      license_required: true
    },
    dealbreaker_multipliers: configData?.dealbreaker_multipliers || {
      salary: [
        { min: 0, max: 10, multiplier: 0.6 },
        { min: 10, max: 20, multiplier: 0.3 },
        { min: 20, max: 30, multiplier: 0.15 },
        { min: 30, max: 999, multiplier: 0.05 }
      ],
      start_date: [
        { min: 14, max: 30, multiplier: 0.95 },
        { min: 30, max: 60, multiplier: 0.85 },
        { min: 60, max: 90, multiplier: 0.7 },
        { min: 90, max: 999, multiplier: 0.4 }
      ],
      seniority: [
        { gap: 1, multiplier: 0.6 },
        { gap: 2, multiplier: 0.25 },
        { gap: 3, multiplier: 0.1 }
      ]
    },
    display_policies: configData?.display_policies || {
      hot: { minScore: 80, minCoverage: 0.80, maxBlockers: 0, requiresMultiplier1: false },
      standard: { minScore: 65, minCoverage: 0.60, maxBlockers: 0, requiresMultiplier1: false },
      maybe: { minScore: 45, minCoverage: 0.40, maxBlockers: 2, requiresMultiplier1: false }
    }
  };
}

// ============================================
// MAIN MATCH CALCULATION
// ============================================

function calculateMatch(
  candidate: any,
  job: any,
  skillReqs: any[],
  taxonomy: any[],
  config: MatchingConfig,
  mode: string
): V31MatchResult {
  const jobId = job.id;

  // Stage A: Hard Kills
  const hardKill = evaluateHardKills(candidate, job, config.hard_kill_defaults);
  
  if (hardKill.killed) {
    return createKilledResult(jobId, hardKill.reason || 'Hard Kill', hardKill.category);
  }

  // Stage A.2: Dealbreaker Multipliers
  const dealbreakers = calculateDealbreakers(candidate, job, config);
  const gateMultiplier = dealbreakers.multiplier;

  // Stage B: Fit Score
  const fitResult = calculateFitScore(candidate, job, skillReqs, taxonomy, config);

  // Must-have coverage gate - only exclude in strict mode, otherwise show as 'maybe'
  // Lowered threshold from 0.70 to 0.40 to show more results
  const coverageExcluded = fitResult.mustHaveCoverage < 0.40;
  if (coverageExcluded && mode === 'strict') {
    return createExcludedResult(jobId, fitResult.mustHaveCoverage, `Must-have Coverage nur ${Math.round(fitResult.mustHaveCoverage * 100)}%`);
  }

  // Stage C: Constraints Score
  const constraintsResult = calculateConstraintsScore(candidate, job, config);

  // Calculate overall score
  let overallScore = Math.round(
    fitResult.score * config.weights.fit +
    constraintsResult.score * config.weights.constraints
  );

  // Apply gate multiplier
  const finalScore = Math.round(overallScore * gateMultiplier);

  // Stage D: Policy determination
  const policy = determinePolicy(finalScore, fitResult.mustHaveCoverage, gateMultiplier, config);

  // Generate explainability
  const explainability = generateExplainability(
    candidate,
    job,
    fitResult,
    constraintsResult,
    dealbreakers,
    policy
  );

  return {
    version: 'v3.1',
    jobId,
    overall: finalScore,
    killed: false,
    excluded: policy === 'hidden',
    mustHaveCoverage: fitResult.mustHaveCoverage,
    gateMultiplier,
    policy,
    gates: {
      hardKills: {
        visa: false,
        language: false,
        onsite: false,
        license: false,
        techDomain: dealbreakers.domainMismatch?.isIncompatible || false
      },
      dealbreakers: dealbreakers.factors,
      multiplier: gateMultiplier,
      domainMismatch: dealbreakers.domainMismatch
    },
    fit: {
      score: fitResult.score,
      breakdown: fitResult.breakdown,
      details: fitResult.details
    },
    constraints: {
      score: constraintsResult.score,
      breakdown: constraintsResult.breakdown
    },
    explainability
  };
}

// ============================================
// STAGE A: HARD KILLS
// ============================================

function evaluateHardKills(candidate: any, job: any, defaults: any): HardKillResult {
  // Visa / Work Authorization
  if (defaults.visa_required && candidate.visa_required && !job.visa_sponsorship) {
    return { killed: true, reason: 'Visum erforderlich, nicht angeboten', category: 'visa' };
  }

  // Required Languages
  if (defaults.language_required && job.required_languages && Array.isArray(job.required_languages)) {
    const candidateLanguages = candidate.language_skills || [];
    for (const reqLang of job.required_languages) {
      const candidateLang = candidateLanguages.find((l: any) => 
        l.language?.toLowerCase() === reqLang.code?.toLowerCase() ||
        l.code?.toLowerCase() === reqLang.code?.toLowerCase()
      );
      if (!candidateLang) {
        return { killed: true, reason: `Sprache ${reqLang.code} fehlt`, category: 'language' };
      }
      // Check level if specified
      const levelOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'];
      if (reqLang.minLevel) {
        const reqIdx = levelOrder.indexOf(reqLang.minLevel.toLowerCase());
        const candIdx = levelOrder.indexOf((candidateLang.level || 'a1').toLowerCase());
        if (candIdx < reqIdx) {
          return { killed: true, reason: `${reqLang.code} mindestens ${reqLang.minLevel} erforderlich`, category: 'language' };
        }
      }
    }
  }

  // Onsite Required vs Remote-Only Candidate
  if (defaults.onsite_required && job.onsite_required) {
    const candidateRemoteOnly = candidate.remote_preference === 'remote_only' || 
                                 candidate.work_model === 'remote_only';
    if (candidateRemoteOnly) {
      return { killed: true, reason: 'Präsenzpflicht, Kandidat nur Remote', category: 'onsite' };
    }
  }

  // Required Certifications
  if (defaults.license_required && job.required_certifications && Array.isArray(job.required_certifications)) {
    const candidateCerts = candidate.certifications || [];
    for (const reqCert of job.required_certifications) {
      const hasCert = candidateCerts.some((c: string) => 
        c.toLowerCase().includes(reqCert.toLowerCase()) ||
        reqCert.toLowerCase().includes(c.toLowerCase())
      );
      if (!hasCert) {
        return { killed: true, reason: `Zertifikat ${reqCert} fehlt`, category: 'license' };
      }
    }
  }

  return { killed: false };
}

// ============================================
// STAGE A.2: DEALBREAKER MULTIPLIERS
// ============================================

function calculateDealbreakers(candidate: any, job: any, config: MatchingConfig): DealBreakerResult {
  let salaryMult = 1.0;
  let startDateMult = 1.0;
  let seniorityMult = 1.0;
  let workModelMult = 1.0;

  // Salary gap multiplier
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  
  if (candidateSalary > 0 && jobSalaryMax > 0 && candidateSalary > jobSalaryMax) {
    const gapPercent = ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100;
    for (const range of config.dealbreaker_multipliers.salary) {
      if (gapPercent >= range.min && gapPercent < range.max) {
        salaryMult = range.multiplier;
        break;
      }
    }
  }

  // Start date multiplier
  if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    const daysUntil = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil > 14) {
      for (const range of config.dealbreaker_multipliers.start_date) {
        if (daysUntil >= range.min && daysUntil < range.max) {
          startDateMult = range.multiplier;
          break;
        }
      }
    }
  }

  // Seniority mismatch multiplier
  const seniorityLevels = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'vp', 'c-level'];
  const candidateSeniority = (candidate.seniority || 'mid').toLowerCase();
  const jobSeniority = (job.experience_level || 'mid').toLowerCase();
  
  const candIdx = seniorityLevels.indexOf(candidateSeniority);
  const jobIdx = seniorityLevels.indexOf(jobSeniority);
  
  if (candIdx >= 0 && jobIdx >= 0) {
    const gap = Math.abs(candIdx - jobIdx);
    if (gap > 0) {
      const mult = config.dealbreaker_multipliers.seniority.find(s => s.gap === gap);
      if (mult) {
        seniorityMult = mult.multiplier;
      } else if (gap >= 3) {
        seniorityMult = 0.1;
      }
    }
  }

  // Work model mismatch
  const jobRemote = job.remote_type === 'remote' || job.work_model === 'remote';
  const jobHybrid = job.remote_type === 'hybrid' || job.work_model === 'hybrid';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  
  if (candidateRemote && !jobRemote && !jobHybrid) {
    workModelMult = 0.25;
  } else if (candidateRemote && jobHybrid) {
    workModelMult = 0.7;
  }

  // TECH DOMAIN MISMATCH - Critical for preventing cross-domain matches
  let techDomainMult = 1.0;
  let domainMismatch: DealBreakerResult['domainMismatch'] = undefined;
  
  const candidateDomain = detectCandidateDomain(candidate.skills || [], candidate.job_title);
  const jobDomain = detectJobDomain(job);
  
  // Only apply domain penalty if both sides have reasonable confidence
  if (candidateDomain.confidence >= 0.15 && jobDomain.confidence >= 0.15) {
    const candidateDomainConfig = TECH_DOMAINS[candidateDomain.primary];
    
    if (candidateDomainConfig?.incompatible_with?.includes(jobDomain.primary)) {
      // Major domain mismatch - apply heavy penalty (e.g., Embedded vs Backend)
      techDomainMult = 0.1;
      domainMismatch = {
        candidateDomain: formatDomainName(candidateDomain.primary),
        jobDomain: formatDomainName(jobDomain.primary),
        isIncompatible: true
      };
      console.log(`[Domain Mismatch] Candidate ${candidateDomain.primary} (${(candidateDomain.confidence * 100).toFixed(0)}%) vs Job ${jobDomain.primary} (${(jobDomain.confidence * 100).toFixed(0)}%) - Multiplier: ${techDomainMult}`);
    } else if (!candidateDomainConfig?.transferable_to?.includes(jobDomain.primary) && 
               candidateDomain.primary !== jobDomain.primary &&
               candidateDomain.primary !== 'other' && 
               jobDomain.primary !== 'other') {
      // Different but not explicitly incompatible - smaller penalty
      techDomainMult = 0.6;
      domainMismatch = {
        candidateDomain: formatDomainName(candidateDomain.primary),
        jobDomain: formatDomainName(jobDomain.primary),
        isIncompatible: false
      };
    }
  }

  const finalMultiplier = salaryMult * startDateMult * seniorityMult * workModelMult * techDomainMult;

  return {
    multiplier: Math.max(0.05, finalMultiplier),
    factors: {
      salary: salaryMult,
      startDate: startDateMult,
      seniority: seniorityMult,
      workModel: workModelMult,
      techDomain: techDomainMult
    },
    domainMismatch
  };
}

// ============================================
// STAGE B: FIT SCORE
// ============================================

function calculateFitScore(
  candidate: any,
  job: any,
  skillReqs: any[],
  taxonomy: any[],
  config: MatchingConfig
): { score: number; mustHaveCoverage: number; breakdown: any; details: any } {
  
  // Skills scoring with dependencies and clusters
  const skillResult = calculateSkillScore(candidate, job, skillReqs, taxonomy);
  
  // Experience scoring
  const experienceScore = calculateExperienceScore(candidate, job);
  
  // Seniority scoring
  const seniorityScore = calculateSeniorityScore(candidate, job);
  
  // Industry scoring
  const industryScore = calculateIndustryScore(candidate, job);

  const breakdown = config.weights.fit_breakdown;
  const totalWeight = breakdown.skills + breakdown.experience + breakdown.seniority + breakdown.industry;
  
  // NaN protection: If weights are 0 or NaN, return default score
  if (totalWeight === 0 || isNaN(totalWeight)) {
    console.warn('Fit score calculation: totalWeight is 0 or NaN, returning default');
    return {
      score: 50,
      mustHaveCoverage: skillResult.mustHaveCoverage || 1.0,
      breakdown: {
        skills: skillResult.score || 50,
        experience: experienceScore || 50,
        seniority: seniorityScore || 50,
        industry: industryScore || 50
      },
      details: {
        skills: skillResult.details || { matched: [], transferable: [], missing: [], mustHaveMissing: [] }
      }
    };
  }
  
  const weightedScore = (
    (skillResult.score || 0) * (breakdown.skills / totalWeight) +
    (experienceScore || 0) * (breakdown.experience / totalWeight) +
    (seniorityScore || 0) * (breakdown.seniority / totalWeight) +
    (industryScore || 0) * (breakdown.industry / totalWeight)
  );
  
  // Final NaN check
  const finalScore = isNaN(weightedScore) ? 50 : Math.round(weightedScore);

  return {
    score: finalScore,
    mustHaveCoverage: skillResult.mustHaveCoverage,
    breakdown: {
      skills: skillResult.score || 0,
      experience: experienceScore || 0,
      seniority: seniorityScore || 0,
      industry: industryScore || 0
    },
    details: {
      skills: skillResult.details
    }
  };
}

function calculateSkillScore(
  candidate: any,
  job: any,
  skillReqs: any[],
  taxonomy: any[]
): { score: number; mustHaveCoverage: number; details: any } {
  const candidateSkills = (candidate.skills || []).map((s: string) => s.toLowerCase());
  
  // Use structured requirements if available, fallback to job.skills
  let mustHaves: any[] = [];
  let niceHaves: any[] = [];
  
  if (skillReqs.length > 0) {
    mustHaves = skillReqs.filter(sr => sr.type === 'must');
    niceHaves = skillReqs.filter(sr => sr.type === 'nice');
  } else {
    // Fallback: use must_haves or must_have_skills from job (must_haves is the actual field name)
    const mustHaveSkills = (job.must_haves || job.must_have_skills || []).map((s: string) => s.toLowerCase());
    const allSkills = (job.skills || []).map((s: string) => s.toLowerCase());
    const niceToHaveSkills = (job.nice_to_haves || []).map((s: string) => s.toLowerCase());
    
    mustHaves = mustHaveSkills.map((s: string) => ({ skill_name: s, type: 'must', weight: 1.0 }));
    
    // Combine nice_to_haves with remaining skills
    const niceSkills = [...new Set([...niceToHaveSkills, ...allSkills.filter((s: string) => !mustHaveSkills.includes(s))])];
    niceHaves = niceSkills.map((s: string) => ({ skill_name: s, type: 'nice', weight: 0.5 }));
  }

  const matched: string[] = [];
  const transferable: string[] = [];
  const missing: string[] = [];
  const mustHaveMissing: string[] = [];

  let mustHaveCredit = 0;
  let mustHaveWeight = 0;
  let totalCredit = 0;
  let totalWeight = 0;

  // Process must-haves
  for (const req of mustHaves) {
    const skillName = req.skill_name.toLowerCase();
    const weight = req.weight || 1.0;
    mustHaveWeight += weight;
    totalWeight += weight;

    const credit = getSkillCredit(skillName, candidateSkills, taxonomy);
    
    if (credit.matchType === 'direct') {
      matched.push(skillName);
      mustHaveCredit += weight;
      totalCredit += weight;
    } else if (credit.matchType === 'transferable') {
      transferable.push(skillName);
      mustHaveCredit += weight * 0.7;
      totalCredit += weight * 0.7;
    } else {
      missing.push(skillName);
      mustHaveMissing.push(skillName);
    }
  }

  // Process nice-to-haves
  for (const req of niceHaves) {
    const skillName = req.skill_name.toLowerCase();
    const weight = (req.weight || 0.5) * 0.5; // Nice-to-haves count half
    totalWeight += weight;

    const credit = getSkillCredit(skillName, candidateSkills, taxonomy);
    
    if (credit.matchType === 'direct') {
      matched.push(skillName);
      totalCredit += weight;
    } else if (credit.matchType === 'transferable') {
      transferable.push(skillName);
      totalCredit += weight * 0.7;
    }
  }

  const mustHaveCoverage = mustHaveWeight > 0 ? mustHaveCredit / mustHaveWeight : 1.0;
  const overallScore = totalWeight > 0 ? (totalCredit / totalWeight) * 100 : 50;

  return {
    score: Math.round(overallScore),
    mustHaveCoverage,
    details: {
      matched: [...new Set(matched)],
      transferable: [...new Set(transferable)],
      missing: [...new Set(missing)],
      mustHaveMissing
    }
  };
}

function getSkillCredit(
  skillName: string,
  candidateSkills: string[],
  taxonomy: any[]
): { credit: number; matchType: 'direct' | 'transferable' | 'missing' } {
  
  // =============================================
  // PHASE 1: KEYWORD EXTRACTION FOR LONG REQUIREMENTS
  // If skillName is a long sentence, extract keywords first
  // =============================================
  const extractedKeywords = extractSkillKeywords(skillName);
  
  if (extractedKeywords.length > 0) {
    // Try matching with extracted keywords
    for (const keyword of extractedKeywords) {
      const keywordResult = matchSingleSkill(keyword, candidateSkills, taxonomy);
      if (keywordResult.matchType !== 'missing') {
        return keywordResult;
      }
    }
  }
  
  // Fall through to regular matching
  return matchSingleSkill(skillName, candidateSkills, taxonomy);
}

/**
 * Core skill matching logic - used for both raw skills and extracted keywords
 */
function matchSingleSkill(
  skillName: string,
  candidateSkills: string[],
  taxonomy: any[]
): { credit: number; matchType: 'direct' | 'transferable' | 'missing' } {
  const normalizedSkill = skillName.toLowerCase().trim();
  
  // =============================================
  // STEP 1: DIRECT SUBSTRING MATCH
  // =============================================
  if (candidateSkills.some(cs => cs.includes(normalizedSkill) || normalizedSkill.includes(cs))) {
    return { credit: 1.0, matchType: 'direct' };
  }

  // =============================================
  // STEP 2: SYNONYM MAP LOOKUP (from skill_synonyms table)
  // =============================================
  const skillSynonyms = globalSynonymMap.get(normalizedSkill);
  if (skillSynonyms && skillSynonyms.size > 0) {
    // Check if candidate has any synonym or the canonical form
    for (const synonym of skillSynonyms) {
      if (candidateSkills.some(cs => 
        cs.includes(synonym) || synonym.includes(cs)
      )) {
        return { credit: 1.0, matchType: 'direct' };
      }
    }
  }
  
  // Also check reverse: does any candidate skill map to the same canonical as the required skill?
  for (const candidateSkill of candidateSkills) {
    const candidateSynonyms = globalSynonymMap.get(candidateSkill);
    if (candidateSynonyms && skillSynonyms) {
      // Check if there's any overlap between the two synonym sets
      for (const candSyn of candidateSynonyms) {
        if (skillSynonyms.has(candSyn)) {
          return { credit: 1.0, matchType: 'direct' };
        }
      }
    }
  }

  // =============================================
  // STEP 3: TAXONOMY ALIASES (from skill_taxonomy table)
  // =============================================
  const taxEntry = taxonomy.find(t => t.canonical_name?.toLowerCase() === normalizedSkill);
  if (taxEntry) {
    // Check aliases
    if (taxEntry.aliases) {
      const aliases = Array.isArray(taxEntry.aliases) ? taxEntry.aliases : [];
      if (aliases.some((a: string) => candidateSkills.some(cs => 
        cs.includes(a.toLowerCase()) || a.toLowerCase().includes(cs)
      ))) {
        return { credit: 1.0, matchType: 'direct' };
      }
    }

    // Check transferability
    if (taxEntry.transferability_from && typeof taxEntry.transferability_from === 'object') {
      for (const [fromSkill, transferability] of Object.entries(taxEntry.transferability_from)) {
        const fromSkillLower = fromSkill.toLowerCase();
        if (candidateSkills.some(cs => cs.includes(fromSkillLower) || fromSkillLower.includes(cs))) {
          return { credit: (transferability as number) / 100 * 0.7, matchType: 'transferable' };
        }
      }
    }
  }

  // =============================================
  // STEP 4: REVERSE TAXONOMY LOOKUP
  // Check if any candidate skill has this required skill in its aliases
  // =============================================
  for (const candidateSkill of candidateSkills) {
    const candidateTaxEntry = taxonomy.find(t => t.canonical_name?.toLowerCase() === candidateSkill);
    if (candidateTaxEntry?.aliases) {
      const aliases = Array.isArray(candidateTaxEntry.aliases) ? candidateTaxEntry.aliases : [];
      if (aliases.some((a: string) => 
        a.toLowerCase().includes(normalizedSkill) || normalizedSkill.includes(a.toLowerCase())
      )) {
        return { credit: 1.0, matchType: 'direct' };
      }
    }
    
    // Also check if candidate skill IS an alias for the required skill
    for (const taxItem of taxonomy) {
      if (taxItem.aliases && Array.isArray(taxItem.aliases)) {
        const hasAsAlias = taxItem.aliases.some((a: string) => a.toLowerCase() === candidateSkill);
        const isRequired = taxItem.canonical_name?.toLowerCase() === normalizedSkill;
        if (hasAsAlias && isRequired) {
          return { credit: 1.0, matchType: 'direct' };
        }
      }
    }
  }

  return { credit: 0, matchType: 'missing' };
}

function calculateExperienceScore(candidate: any, job: any): number {
  const candidateYears = candidate.experience_years || 0;
  const jobMinYears = job.experience_min || 0;
  const jobMaxYears = job.experience_max || 20;

  if (candidateYears >= jobMinYears && candidateYears <= jobMaxYears) {
    return 100;
  }

  if (candidateYears < jobMinYears) {
    const gap = jobMinYears - candidateYears;
    return Math.max(0, 100 - gap * 20);
  }

  // Overqualified
  if (candidateYears > jobMaxYears + 5) {
    return 70;
  }

  return 85;
}

function calculateSeniorityScore(candidate: any, job: any): number {
  const seniorityLevels = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'vp', 'c-level'];
  const candidateSeniority = (candidate.seniority || 'mid').toLowerCase();
  const jobSeniority = (job.experience_level || 'mid').toLowerCase();
  
  const candIdx = seniorityLevels.indexOf(candidateSeniority);
  const jobIdx = seniorityLevels.indexOf(jobSeniority);
  
  if (candIdx < 0 || jobIdx < 0) return 75;
  
  const gap = Math.abs(candIdx - jobIdx);
  
  if (gap === 0) return 100;
  if (gap === 1) return 60;
  if (gap === 2) return 25;
  return 10;
}

function calculateIndustryScore(candidate: any, job: any): number {
  const candidateIndustries = (candidate.industry_experience || []) as string[];
  const jobIndustry = (job.industry || '').toLowerCase();
  
  if (!jobIndustry) return 75;
  
  const hasMatch = candidateIndustries.some((i: string) => 
    i.toLowerCase().includes(jobIndustry) || jobIndustry.includes(i.toLowerCase())
  );
  
  return hasMatch ? 100 : 50;
}

// ============================================
// STAGE C: CONSTRAINTS SCORE
// ============================================

function calculateConstraintsScore(
  candidate: any,
  job: any,
  config: MatchingConfig
): { score: number; breakdown: { salary: number; commute: number; startDate: number } } {
  
  // Salary
  const candidateSalary = candidate.expected_salary || candidate.salary_expectation_min || 0;
  const jobSalaryMax = job.salary_max || 0;
  const jobSalaryMin = job.salary_min || 0;
  
  let salaryScore = 100;
  if (candidateSalary > 0 && jobSalaryMax > 0) {
    if (candidateSalary <= jobSalaryMax) {
      salaryScore = 100;
    } else {
      const gap = ((candidateSalary - jobSalaryMax) / jobSalaryMax) * 100;
      salaryScore = Math.max(0, 100 - gap * 3);
    }
  }

  // Commute
  let commuteScore = 100;
  const isRemoteJob = job.remote_type === 'remote' || job.work_model === 'remote';
  const candidateRemote = candidate.remote_preference === 'remote' || candidate.work_model === 'remote';
  
  if (isRemoteJob || candidateRemote) {
    commuteScore = 100;
  } else {
    const maxCommute = candidate.max_commute_minutes || 45;
    if (maxCommute > config.gate_thresholds.commute_fail_minutes) {
      commuteScore = 40;
    } else if (maxCommute > config.gate_thresholds.commute_warn_minutes) {
      commuteScore = 70;
    }
  }

  // Start Date
  let startDateScore = 100;
  if (candidate.availability_date) {
    const availDate = new Date(candidate.availability_date);
    const daysUntil = Math.ceil((availDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil <= 14) {
      startDateScore = 100;
    } else if (daysUntil <= 30) {
      startDateScore = 90;
    } else if (daysUntil <= 60) {
      startDateScore = 70;
    } else if (daysUntil <= 90) {
      startDateScore = 50;
    } else {
      startDateScore = 30;
    }
  }

  const breakdown = config.weights.constraint_breakdown;
  const totalWeight = breakdown.salary + breakdown.commute + breakdown.startDate;
  
  const weightedScore = (
    salaryScore * (breakdown.salary / totalWeight) +
    commuteScore * (breakdown.commute / totalWeight) +
    startDateScore * (breakdown.startDate / totalWeight)
  );

  return {
    score: Math.round(weightedScore),
    breakdown: {
      salary: salaryScore,
      commute: commuteScore,
      startDate: startDateScore
    }
  };
}

// ============================================
// STAGE D: POLICY DETERMINATION
// ============================================

function determinePolicy(
  score: number,
  coverage: number,
  multiplier: number,
  config: MatchingConfig
): PolicyTier {
  const policies = config.display_policies;

  // Hot
  if (score >= policies.hot.minScore && 
      coverage >= policies.hot.minCoverage && 
      (!policies.hot.requiresMultiplier1 || multiplier >= 0.95)) {
    return 'hot';
  }

  // Standard
  if (score >= policies.standard.minScore && coverage >= policies.standard.minCoverage) {
    return 'standard';
  }

  // Maybe
  if (score >= policies.maybe.minScore && coverage >= policies.maybe.minCoverage) {
    return 'maybe';
  }

  return 'hidden';
}

// ============================================
// EXPLAINABILITY
// ============================================

function generateExplainability(
  candidate: any,
  job: any,
  fitResult: any,
  constraintsResult: any,
  dealbreakers: DealBreakerResult,
  policy: PolicyTier
): V31MatchResult['explainability'] {
  const topReasons: string[] = [];
  const topRisks: string[] = [];
  const enhancedReasons: { text: string; impact: 'high' | 'medium' | 'low'; category: 'skills' | 'experience' | 'salary' | 'availability' | 'location' | 'domain' }[] = [];
  const enhancedRisks: { text: string; severity: 'critical' | 'warning' | 'info'; mitigatable: boolean; mitigation?: string; category: 'skills' | 'salary' | 'timing' | 'seniority' | 'domain' }[] = [];
  const nextSteps: string[] = [];
  const talkingPoints: string[] = [];
  let nextAction = 'Profil prüfen';
  let whyNot: string | undefined;

  // ============================================
  // ENHANCED REASONS (Phase 5)
  // ============================================
  
  // Skill matches
  const matchedSkills = fitResult.details?.skills?.matched || [];
  const transferableSkills = fitResult.details?.skills?.transferable || [];
  
  if (matchedSkills.length > 0) {
    const text = `${matchedSkills.length} direkte Skill-Matches: ${matchedSkills.slice(0, 3).join(', ')}`;
    topReasons.push(text);
    enhancedReasons.push({
      text,
      impact: matchedSkills.length >= 5 ? 'high' : matchedSkills.length >= 3 ? 'medium' : 'low',
      category: 'skills'
    });
    talkingPoints.push(`Ihre Erfahrung mit ${matchedSkills.slice(0, 2).join(' und ')} passt hervorragend`);
  }

  if (transferableSkills.length > 0) {
    enhancedReasons.push({
      text: `${transferableSkills.length} übertragbare Skills`,
      impact: 'medium',
      category: 'skills'
    });
  }

  // Experience match
  if (fitResult.breakdown.experience >= 80) {
    const text = `Erfahrung passt: ${candidate.experience_years || 0} Jahre`;
    topReasons.push(text);
    enhancedReasons.push({
      text,
      impact: 'high',
      category: 'experience'
    });
  } else if (fitResult.breakdown.experience >= 60) {
    enhancedReasons.push({
      text: `${candidate.experience_years || 0} Jahre Erfahrung (ausreichend)`,
      impact: 'medium',
      category: 'experience'
    });
  }

  // Salary in budget
  if (constraintsResult.breakdown.salary >= 80) {
    topReasons.push('Gehaltsvorstellung im Budget');
    enhancedReasons.push({
      text: 'Gehalt im Rahmen des Budgets',
      impact: 'high',
      category: 'salary'
    });
  } else if (constraintsResult.breakdown.salary >= 60) {
    enhancedReasons.push({
      text: 'Gehalt verhandelbar im Budget',
      impact: 'medium',
      category: 'salary'
    });
    talkingPoints.push('Gehaltsrahmen klären und Flexibilität ausloten');
  }

  // Availability
  if (constraintsResult.breakdown.startDate >= 90) {
    topReasons.push('Kurzfristig verfügbar');
    enhancedReasons.push({
      text: 'Kann kurzfristig starten',
      impact: 'high',
      category: 'availability'
    });
  } else if (constraintsResult.breakdown.startDate >= 70) {
    enhancedReasons.push({
      text: 'Startdatum passt zum Zeitplan',
      impact: 'medium',
      category: 'availability'
    });
  }

  // Location/Remote
  if (constraintsResult.breakdown.commute >= 80) {
    enhancedReasons.push({
      text: 'Standort/Remote-Präferenz passt',
      impact: 'medium',
      category: 'location'
    });
  }

  // ============================================
  // ENHANCED RISKS (Phase 5)
  // ============================================
  
  // Missing must-haves
  const missingSkills = fitResult.details?.skills?.mustHaveMissing || [];
  if (missingSkills.length > 0) {
    const text = `Fehlende Must-haves: ${missingSkills.slice(0, 2).join(', ')}`;
    topRisks.push(text);
    
    const hasTransferable = transferableSkills.some((ts: string) => 
      missingSkills.some((ms: string) => ts.toLowerCase().includes(ms.toLowerCase().slice(0, 4)))
    );
    
    enhancedRisks.push({
      text,
      severity: missingSkills.length >= 3 ? 'critical' : 'warning',
      mitigatable: hasTransferable || missingSkills.length <= 2,
      mitigation: hasTransferable 
        ? 'Übertragbare Skills vorhanden - Einarbeitung möglich'
        : missingSkills.length <= 2 
          ? 'Skills können on-the-job erlernt werden'
          : undefined,
      category: 'skills'
    });
    
    if (missingSkills.length <= 2) {
      talkingPoints.push(`Einarbeitung in ${missingSkills[0]} besprechen`);
    }
  }

  // Tech domain mismatch
  if (dealbreakers.domainMismatch?.isIncompatible) {
    const text = `Technologie-Mismatch: ${dealbreakers.domainMismatch.candidateDomain} → ${dealbreakers.domainMismatch.jobDomain}`;
    topRisks.unshift(`⚠️ ${text}`);
    enhancedRisks.unshift({
      text,
      severity: 'critical',
      mitigatable: false,
      category: 'domain'
    });
  } else if (dealbreakers.domainMismatch) {
    const text = `Tech-Bereich abweichend: ${dealbreakers.domainMismatch.candidateDomain} → ${dealbreakers.domainMismatch.jobDomain}`;
    topRisks.push(text);
    enhancedRisks.push({
      text,
      severity: 'warning',
      mitigatable: true,
      mitigation: 'Umstiegsmotivation im Interview klären',
      category: 'domain'
    });
    talkingPoints.push('Motivation für den Bereichswechsel erfragen');
  }

  // Salary over budget
  if (dealbreakers.factors.salary < 1) {
    const gap = Math.round((1 - dealbreakers.factors.salary) * 100);
    const text = `Gehalt über Budget (${gap}% über Maximum)`;
    topRisks.push(text);
    enhancedRisks.push({
      text,
      severity: gap > 20 ? 'critical' : 'warning',
      mitigatable: gap <= 15,
      mitigation: gap <= 15 
        ? 'Benefits und Zusatzleistungen als Ausgleich anbieten'
        : gap <= 20 
          ? 'Stufenweiser Gehaltsanstieg verhandeln'
          : undefined,
      category: 'salary'
    });
    if (gap <= 15) {
      talkingPoints.push('Gesamtpaket inkl. Benefits besprechen');
    }
  }

  // Start date issue
  if (dealbreakers.factors.startDate < 1) {
    topRisks.push('Starttermin nicht optimal');
    enhancedRisks.push({
      text: 'Starttermin später als gewünscht',
      severity: 'info',
      mitigatable: true,
      mitigation: 'Kündigungsfrist abklären, evtl. Aufhebungsvertrag',
      category: 'timing'
    });
  }

  // Seniority mismatch
  if (dealbreakers.factors.seniority < 1) {
    topRisks.push('Seniority-Level weicht ab');
    enhancedRisks.push({
      text: 'Seniority-Level nicht optimal',
      severity: 'warning',
      mitigatable: true,
      mitigation: 'Entwicklungspotenzial und Wachstumsmöglichkeiten betonen',
      category: 'seniority'
    });
  }

  // ============================================
  // RECRUITER ACTIONS (Phase 5)
  // ============================================
  
  let recommendation: 'proceed' | 'review' | 'skip' = 'review';
  let priority: 'high' | 'medium' | 'low' = 'medium';

  switch (policy) {
    case 'hot':
      nextAction = 'Sofort zum Interview einladen';
      recommendation = 'proceed';
      priority = 'high';
      nextSteps.push('Innerhalb von 24h kontaktieren');
      nextSteps.push('Interview-Termin vorschlagen');
      if (matchedSkills.length > 0) {
        nextSteps.push(`USPs hervorheben: ${matchedSkills.slice(0, 2).join(', ')}`);
      }
      talkingPoints.push('Aktuelle Situation und Wechselmotivation erfragen');
      talkingPoints.push('Gehaltsvorstellung und Verfügbarkeit bestätigen');
      break;
      
    case 'standard':
      nextAction = 'Kandidat kontaktieren und Details klären';
      recommendation = 'proceed';
      priority = 'medium';
      nextSteps.push('Profil im Detail prüfen');
      if (missingSkills.length > 0) {
        nextSteps.push(`Skill-Gaps klären: ${missingSkills.slice(0, 2).join(', ')}`);
      }
      if (dealbreakers.factors.salary < 1) {
        nextSteps.push('Gehaltsrahmen vorab klären');
      }
      nextSteps.push('Bei positivem Eindruck zum Interview einladen');
      break;
      
    case 'maybe':
      nextAction = 'Bei Bedarf manuell prüfen';
      recommendation = 'review';
      priority = 'low';
      whyNot = 'Score oder Coverage unter Standard-Schwelle';
      nextSteps.push('Nur bei Engpässen in Betracht ziehen');
      nextSteps.push('Alternative Jobs für Kandidaten prüfen');
      break;
      
    case 'hidden':
      nextAction = 'Nicht anzeigen';
      recommendation = 'skip';
      priority = 'low';
      whyNot = fitResult.mustHaveCoverage < 0.70 
        ? `Must-have Coverage nur ${Math.round(fitResult.mustHaveCoverage * 100)}%`
        : 'Score unter Mindest-Schwelle';
      break;
  }

  const recruiterAction: V31MatchResult['explainability']['recruiterAction'] = {
    recommendation,
    priority,
    nextSteps: nextSteps.slice(0, 4),
    talkingPoints: talkingPoints.length > 0 ? talkingPoints.slice(0, 4) : undefined
  };

  return {
    topReasons: topReasons.slice(0, 3),
    topRisks: topRisks.slice(0, 3),
    whyNot,
    nextAction,
    enhancedReasons: enhancedReasons.slice(0, 5),
    enhancedRisks: enhancedRisks.slice(0, 5),
    recruiterAction
  };
}

// ============================================
// HELPER RESULTS
// ============================================

function createKilledResult(jobId: string, reason: string, category?: string): V31MatchResult {
  return {
    version: 'v3.1',
    jobId,
    overall: 0,
    killed: true,
    excluded: true,
    mustHaveCoverage: 0,
    gateMultiplier: 0,
    policy: 'hidden',
    gates: {
      hardKills: {
        visa: category === 'visa',
        language: category === 'language',
        onsite: category === 'onsite',
        license: category === 'license',
        techDomain: category === 'tech_domain'
      },
      dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1, techDomain: 1 },
      multiplier: 0
    },
    fit: {
      score: 0,
      breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 },
      details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } }
    },
    constraints: {
      score: 0,
      breakdown: { salary: 0, commute: 0, startDate: 0 }
    },
    explainability: {
      topReasons: [],
      topRisks: [reason],
      whyNot: reason,
      nextAction: 'Nicht anzeigen - Hard Kill'
    }
  };
}

function createExcludedResult(jobId: string, coverage: number, reason: string): V31MatchResult {
  return {
    version: 'v3.1',
    jobId,
    overall: 0,
    killed: false,
    excluded: true,
    mustHaveCoverage: coverage,
    gateMultiplier: 1,
    policy: 'hidden',
    gates: {
      hardKills: { visa: false, language: false, onsite: false, license: false, techDomain: false },
      dealbreakers: { salary: 1, startDate: 1, seniority: 1, workModel: 1, techDomain: 1 },
      multiplier: 1
    },
    fit: {
      score: 0,
      breakdown: { skills: 0, experience: 0, seniority: 0, industry: 0 },
      details: { skills: { matched: [], transferable: [], missing: [], mustHaveMissing: [] } }
    },
    constraints: {
      score: 0,
      breakdown: { salary: 0, commute: 0, startDate: 0 }
    },
    explainability: {
      topReasons: [],
      topRisks: [reason],
      whyNot: reason,
      nextAction: 'Nicht anzeigen - Coverage zu niedrig'
    }
  };
}
