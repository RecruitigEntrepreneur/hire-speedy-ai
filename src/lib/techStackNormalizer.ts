// Tech stack normalization mapping for consistent skill display
export const TECH_NORMALIZATIONS: Record<string, string[]> = {
  'React': ['react', 'reactjs', 'react.js', 'react 18', 'react 17'],
  'Vue.js': ['vue', 'vuejs', 'vue.js', 'vue3', 'vue 3', 'nuxt', 'nuxtjs'],
  'Angular': ['angular', 'angularjs', 'angular.js'],
  'TypeScript': ['typescript', 'ts'],
  'JavaScript': ['javascript', 'js', 'es6', 'ecmascript'],
  'Node.js': ['node', 'nodejs', 'node.js', 'express', 'expressjs'],
  'Python': ['python', 'python3', 'django', 'flask', 'fastapi'],
  'Java': ['java', 'spring', 'spring boot', 'springboot', 'jakarta'],
  'AWS': ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloudfront'],
  'Azure': ['azure', 'microsoft azure', 'azure devops'],
  'GCP': ['gcp', 'google cloud', 'google cloud platform', 'bigquery'],
  'Docker': ['docker', 'container', 'containerization'],
  'Kubernetes': ['kubernetes', 'k8s', 'helm', 'kubectl'],
  'PostgreSQL': ['postgresql', 'postgres', 'psql'],
  'MySQL': ['mysql', 'mariadb'],
  'MongoDB': ['mongodb', 'mongo'],
  'Redis': ['redis', 'caching'],
  'GraphQL': ['graphql', 'apollo', 'hasura'],
  'REST API': ['rest', 'restful', 'rest api', 'api'],
  'CI/CD': ['ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci'],
  'Terraform': ['terraform', 'iac', 'infrastructure as code'],
  '.NET': ['.net', 'dotnet', 'c#', 'csharp', 'asp.net'],
  'Go': ['go', 'golang'],
  'Rust': ['rust', 'rustlang'],
  'Kafka': ['kafka', 'event streaming', 'apache kafka'],
  'Elasticsearch': ['elasticsearch', 'elastic', 'elk', 'opensearch'],
  'Machine Learning': ['ml', 'machine learning', 'tensorflow', 'pytorch', 'keras', 'ai/ml'],
  'PHP': ['php', 'laravel', 'symfony'],
  'Ruby': ['ruby', 'rails', 'ruby on rails'],
  'Swift': ['swift', 'ios', 'swiftui'],
  'Kotlin': ['kotlin', 'android'],
  'Flutter': ['flutter', 'dart'],
  'Next.js': ['next', 'nextjs', 'next.js'],
  'Svelte': ['svelte', 'sveltekit'],
  'Tailwind CSS': ['tailwind', 'tailwindcss', 'tailwind css'],
  'SASS/SCSS': ['sass', 'scss', 'css preprocessor'],
};

/**
 * Normalizes an array of tech skills to consistent naming
 * @param skills - Array of skill strings to normalize
 * @returns Array of normalized skill names
 */
export function normalizeTechStack(skills: string[]): string[] {
  const normalized = new Set<string>();
  
  for (const skill of skills) {
    const lowerSkill = skill.toLowerCase().trim();
    let matched = false;
    
    for (const [normalizedName, variants] of Object.entries(TECH_NORMALIZATIONS)) {
      for (const variant of variants) {
        if (lowerSkill === variant || lowerSkill.includes(variant)) {
          normalized.add(normalizedName);
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    
    // Keep original skill if no normalization found (but capitalize first letter)
    if (!matched && skill.trim()) {
      normalized.add(skill.trim().charAt(0).toUpperCase() + skill.trim().slice(1));
    }
  }
  
  return Array.from(normalized);
}

/**
 * Groups skills by category for display
 */
export function groupSkillsByCategory(skills: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    'Frontend': ['React', 'Vue.js', 'Angular', 'Next.js', 'Svelte', 'TypeScript', 'JavaScript', 'Tailwind CSS', 'SASS/SCSS'],
    'Backend': ['Node.js', 'Python', 'Java', '.NET', 'Go', 'Rust', 'PHP', 'Ruby'],
    'Cloud & DevOps': ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform'],
    'Data': ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Kafka', 'GraphQL', 'REST API'],
    'Mobile': ['Swift', 'Kotlin', 'Flutter'],
    'AI/ML': ['Machine Learning'],
  };

  const grouped: Record<string, string[]> = {};
  
  for (const skill of skills) {
    let assigned = false;
    for (const [category, categorySkills] of Object.entries(categories)) {
      if (categorySkills.includes(skill)) {
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(skill);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      if (!grouped['Other']) grouped['Other'] = [];
      grouped['Other'].push(skill);
    }
  }

  return grouped;
}
