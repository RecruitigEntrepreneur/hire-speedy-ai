/**
 * Company Logo Utilities
 * Provides logo URL generation with fallbacks for companies
 */

/**
 * Generate a company logo URL with fallback options
 * 1. Uses logo_url if provided
 * 2. Falls back to Clearbit Logo API using website domain
 * 3. Falls back to UI-Avatar with company initials
 */
export const getCompanyLogoUrl = (
  logoUrl: string | null | undefined,
  website: string | null | undefined,
  companyName: string
): string => {
  // Use direct logo URL if available
  if (logoUrl) {
    return logoUrl;
  }
  
  // Try Clearbit Logo API with website domain
  if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      const domain = url.hostname.replace('www.', '');
      return `https://logo.clearbit.com/${domain}`;
    } catch {
      // Invalid URL, fall through to initials
    }
  }
  
  // Fallback: UI-Avatar with company initials
  return getInitialsAvatarUrl(companyName);
};

/**
 * Generate an initials-based avatar URL for a company
 */
export const getInitialsAvatarUrl = (companyName: string): string => {
  const initials = companyName
    .split(' ')
    .filter(word => word.length > 0)
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=1e3a5f&color=fff&size=96&bold=true`;
};

/**
 * Format headcount number into human-readable band
 */
export const formatHeadcount = (count: number | null | undefined): string | null => {
  if (!count) return null;
  
  if (count < 50) return '< 50 MA';
  if (count < 200) return '50-200 MA';
  if (count < 500) return '200-500 MA';
  if (count < 1000) return '500-1.000 MA';
  if (count < 5000) return '1.000-5.000 MA';
  return '5.000+ MA';
};
