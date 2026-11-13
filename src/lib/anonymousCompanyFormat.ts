/**
 * Kontextreiche anonyme Firmen-Formatierung für Triple-Blind Recruiter-Ansicht
 * 
 * Zeigt relevante Kontext-Informationen ohne den Firmennamen preiszugeben.
 * Beispiel-Output: "[FinTech | 200–500 MA | Series B | React/Node | Hybrid München]"
 */
import i18n from '@/i18n';

// Anzeige-Texte beim Aufruf gelesen (Namespace jobBriefing, anon.*).
const ta = (key: string, options?: Record<string, unknown>): string => i18n.t(`jobBriefing:${key}`, options) as string;

interface AnonymousCompanyParams {
  industry: string | null;
  companySize?: string | null;
  fundingStage?: string | null;
  techStack?: string[] | null;
  location?: string | null;
  urgency?: string | null;
  remoteType?: string | null;
}

/**
 * Formatiert eine kontextreiche anonyme Firmen-Beschreibung
 */
export function formatAnonymousCompany(params: AnonymousCompanyParams): string {
  const {
    industry,
    companySize,
    fundingStage,
    techStack,
    location,
    urgency,
    remoteType,
  } = params;

  const parts: string[] = [];

  // Industrie (immer anzeigen)
  if (industry) {
    parts.push(industry);
  } else {
    parts.push(ta('anon.company'));
  }

  // Unternehmensgröße
  if (companySize) {
    parts.push(formatCompanySize(companySize));
  }

  // Funding-Stage
  if (fundingStage) {
    parts.push(fundingStage);
  }

  // Tech-Stack (max 3)
  if (techStack && techStack.length > 0) {
    const displayTech = techStack.slice(0, 3).join('/');
    parts.push(displayTech);
  }

  // Arbeitsmodell + Standort
  if (remoteType && location) {
    const workModel = formatWorkModel(remoteType);
    parts.push(`${workModel} ${extractCity(location)}`);
  } else if (location) {
    parts.push(extractCity(location));
  } else if (remoteType) {
    parts.push(formatWorkModel(remoteType));
  }

  // Dringlichkeit
  if (urgency && urgency.toLowerCase() !== 'standard') {
    parts.push(formatUrgency(urgency));
  }

  return `[${parts.join(' | ')}]`;
}

/**
 * Kurz für Karten (19.10.2026): nur Branche und Größe. Ort, Arbeitsmodell und
 * Dringlichkeit stehen auf der Karte ohnehin daneben — in der langen Fassung
 * standen sie doppelt.
 */
export function formatAnonymousCompanyShort(params: Pick<AnonymousCompanyParams, 'industry' | 'companySize'>): string {
  const parts = [params.industry || ta('anon.company')];
  if (params.companySize) parts.push(formatCompanySize(params.companySize));
  return parts.join(' · ');
}

/**
 * Einfache anonyme Firmenbeschreibung (nur Industrie)
 */
export function formatSimpleAnonymousCompany(industry: string | null): string {
  if (!industry) {
    return ta('anon.companyBracket');
  }
  return ta('anon.industryCompany', { industry });
}

/**
 * Formatiert Unternehmensgröße in lesbare Form
 */
function formatCompanySize(size: string): string {
  const sizeMap: Record<string, string> = {
    '1-50': '1–50',
    '51-200': '51–200',
    '201-500': '200–500',
    '501-1000': '500–1000',
    '1000+': '1000+',
  };
  return sizeMap[size] ? ta('anon.employeesShort', { n: sizeMap[size] }) : size;
}

/**
 * Formatiert Remote-Type in deutsche Bezeichnung
 */
export function formatWorkModel(remoteType: string): string {
  const key = remoteType.toLowerCase();
  return ['remote', 'hybrid', 'onsite'].includes(key) ? ta(`anon.${key}`) : remoteType;
}

/**
 * Extrahiert Stadt aus Location-String
 */
function extractCity(location: string): string {
  // Versuche die Stadt zu extrahieren (vor Komma oder gesamter String)
  const parts = location.split(',');
  return parts[0].trim();
}

/**
 * Formatiert Urgency in deutsche Bezeichnung
 */
function formatUrgency(urgency: string): string {
  const key = urgency.toLowerCase();
  return key === 'urgent' ? ta('anon.urgent') : key === 'hot' || key === 'asap' ? ta('anon.asap') : urgency;
}

/**
 * Prüft ob Firmenname angezeigt werden darf basierend auf Reveal-Status
 */
export function getDisplayCompanyName(
  realCompanyName: string,
  industry: string | null,
  companyRevealed: boolean,
  options?: AnonymousCompanyParams
): string {
  if (companyRevealed) {
    return realCompanyName;
  }

  // Wenn erweiterte Optionen vorhanden, kontextreiche Anonymisierung
  if (options && (options.companySize || options.fundingStage || options.techStack)) {
    return formatAnonymousCompany({ industry, ...options });
  }

  // Fallback: Einfache Anonymisierung
  return formatSimpleAnonymousCompany(industry);
}
