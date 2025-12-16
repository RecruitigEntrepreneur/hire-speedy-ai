import { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Upload, Building2, Users, FileSpreadsheet, Check, AlertCircle, User, MapPin, 
  Building, Briefcase, ArrowRightLeft, Tag, Search, X
} from 'lucide-react';
import { toast } from 'sonner';
import { useImportCompanies, useImportContacts, CompanyImportRow, ContactImportRow } from '@/hooks/useCompanyImport';

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportMode = 'select' | 'companies' | 'contacts';
type Step = 'mode' | 'upload' | 'mapping' | 'importing' | 'done';

interface TargetField {
  value: string;
  label: string;
  required?: boolean;
}

interface FieldCategory {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  fields: TargetField[];
}

// Simple company fields for company-only import
const COMPANY_ONLY_FIELDS: TargetField[] = [
  { value: 'name', label: 'Firmenname', required: true },
  { value: 'website', label: 'Website' },
  { value: 'domain', label: 'Domain' },
  { value: 'industry', label: 'Branche' },
  { value: 'city', label: 'Stadt' },
  { value: 'headcount', label: 'Mitarbeiterzahl' },
];

// Full field categories for contact import (from LeadImportDialog)
const TARGET_FIELD_CATEGORIES: FieldCategory[] = [
  {
    name: 'Kontakt/Person',
    icon: User,
    fields: [
      { value: 'first_name', label: 'Vorname' },
      { value: 'last_name', label: 'Nachname' },
      { value: 'contact_name', label: 'Voller Name', required: true },
      { value: 'contact_email', label: 'E-Mail', required: true },
      { value: 'contact_role', label: 'Position/Titel' },
      { value: 'seniority', label: 'Seniority' },
      { value: 'department', label: 'Abteilung' },
      { value: 'decision_level', label: 'Entscheider-Level' },
      { value: 'functional_area', label: 'Funktionsbereich' },
      { value: 'mobile_phone', label: 'Mobil' },
      { value: 'direct_phone', label: 'Durchwahl' },
      { value: 'office_phone', label: 'Büro-Telefon' },
      { value: 'personal_linkedin_url', label: 'LinkedIn (Person)' },
      { value: 'education', label: 'Ausbildung' },
      { value: 'email_quality', label: 'E-Mail Qualität' },
      { value: 'email_verification_status', label: 'E-Mail verifiziert' },
    ]
  },
  {
    name: 'Unternehmen',
    icon: Building2,
    fields: [
      { value: 'company_name', label: 'Firmenname', required: true },
      { value: 'company_alias', label: 'Firmen-Alias' },
      { value: 'company_type', label: 'Unternehmenstyp' },
      { value: 'company_description', label: 'Beschreibung' },
      { value: 'company_website', label: 'Website' },
      { value: 'company_domain', label: 'Domain' },
      { value: 'company_headcount', label: 'Mitarbeiterzahl' },
      { value: 'company_industries', label: 'Branchen' },
      { value: 'company_technologies', label: 'Technologien' },
      { value: 'company_financials', label: 'Finanzdaten' },
      { value: 'company_linkedin_url', label: 'LinkedIn (Firma)' },
      { value: 'company_founded_year', label: 'Gründungsjahr' },
      { value: 'company_sic', label: 'SIC Code' },
      { value: 'company_isic', label: 'ISIC Code' },
      { value: 'company_naics', label: 'NAICS Code' },
    ]
  },
  {
    name: 'Firmen-Adresse',
    icon: MapPin,
    fields: [
      { value: 'company_address_line', label: 'Straße' },
      { value: 'company_city', label: 'Stadt' },
      { value: 'company_zip', label: 'PLZ' },
      { value: 'company_state', label: 'Bundesland/Staat' },
      { value: 'company_country', label: 'Land' },
      { value: 'city', label: 'Stadt (Legacy)' },
      { value: 'country', label: 'Land (Legacy)' },
    ]
  },
  {
    name: 'Hauptsitz (HQ)',
    icon: Building,
    fields: [
      { value: 'hq_name', label: 'HQ Name' },
      { value: 'hq_address_line', label: 'HQ Straße' },
      { value: 'hq_city', label: 'HQ Stadt' },
      { value: 'hq_zip', label: 'HQ PLZ' },
      { value: 'hq_state', label: 'HQ Bundesland' },
      { value: 'hq_country', label: 'HQ Land' },
    ]
  },
  {
    name: 'Hiring-Signale',
    icon: Briefcase,
    fields: [
      { value: 'hiring_title_1', label: 'Stelle 1 - Titel' },
      { value: 'hiring_url_1', label: 'Stelle 1 - URL' },
      { value: 'hiring_location_1', label: 'Stelle 1 - Ort' },
      { value: 'hiring_date_1', label: 'Stelle 1 - Datum' },
      { value: 'hiring_title_2', label: 'Stelle 2 - Titel' },
      { value: 'hiring_url_2', label: 'Stelle 2 - URL' },
      { value: 'hiring_location_2', label: 'Stelle 2 - Ort' },
      { value: 'hiring_date_2', label: 'Stelle 2 - Datum' },
      { value: 'hiring_title_3', label: 'Stelle 3 - Titel' },
      { value: 'hiring_url_3', label: 'Stelle 3 - URL' },
      { value: 'hiring_location_3', label: 'Stelle 3 - Ort' },
      { value: 'hiring_date_3', label: 'Stelle 3 - Datum' },
      { value: 'hiring_title_4', label: 'Stelle 4 - Titel' },
      { value: 'hiring_url_4', label: 'Stelle 4 - URL' },
      { value: 'hiring_location_4', label: 'Stelle 4 - Ort' },
      { value: 'hiring_date_4', label: 'Stelle 4 - Datum' },
      { value: 'hiring_title_5', label: 'Stelle 5 - Titel' },
      { value: 'hiring_url_5', label: 'Stelle 5 - URL' },
      { value: 'hiring_location_5', label: 'Stelle 5 - Ort' },
      { value: 'hiring_date_5', label: 'Stelle 5 - Datum' },
    ]
  },
  {
    name: 'Wechsel-Signale',
    icon: ArrowRightLeft,
    fields: [
      { value: 'job_change_prev_company', label: 'Vorheriger Arbeitgeber' },
      { value: 'job_change_prev_title', label: 'Vorherige Position' },
      { value: 'job_change_new_company', label: 'Neuer Arbeitgeber' },
      { value: 'job_change_new_title', label: 'Neue Position' },
      { value: 'job_change_date', label: 'Wechsel-Datum' },
      { value: 'moved_from_country', label: 'Umzug von (Land)' },
      { value: 'moved_from_state', label: 'Umzug von (Bundesland)' },
      { value: 'moved_to_country', label: 'Umzug nach (Land)' },
      { value: 'moved_to_state', label: 'Umzug nach (Bundesland)' },
      { value: 'moved_date', label: 'Umzug-Datum' },
    ]
  },
  {
    name: 'Meta/Kampagne',
    icon: Tag,
    fields: [
      { value: 'list_name', label: 'Listen-Name' },
      { value: 'segment', label: 'Segment' },
      { value: 'priority', label: 'Priorität' },
      { value: 'language', label: 'Sprache' },
      { value: 'lead_source', label: 'Quelle' },
      { value: 'profile_id', label: 'Profil-ID' },
      { value: 'sid', label: 'SID' },
      { value: 'score', label: 'Score' },
      { value: 'industry', label: 'Branche (Legacy)' },
      { value: 'company_size', label: 'Größe (Legacy)' },
    ]
  },
];

// Flat list of all contact fields
const ALL_CONTACT_FIELDS = TARGET_FIELD_CATEGORIES.flatMap(cat => cat.fields);

// Auto-mapping patterns for contacts
const AUTO_MAP_PATTERNS: Record<string, string[]> = {
  // Person
  'first_name': ['first name', 'vorname', 'firstname', 'first_name', 'given name', 'first'],
  'last_name': ['last name', 'nachname', 'lastname', 'last_name', 'surname', 'family name', 'last'],
  'contact_name': ['full name', 'vollständiger name', 'kontaktperson', 'contact name', 'kontakt name', 'person name', 'contact person'],
  'contact_email': ['contact email', 'email address', 'e-mail address', 'e-mail-adresse', 'person email', 'email', 'e-mail'],
  'contact_role': ['job title', 'position', 'role', 'titel', 'title', 'job_title', 'jobtitle', 'contact title'],
  'seniority': ['seniority', 'level', 'karrierestufe', 'seniority level'],
  'department': ['department', 'abteilung', 'bereich'],
  'decision_level': ['decision level', 'entscheider', 'entscheidungsebene', 'decision maker'],
  'functional_area': ['function', 'funktion', 'funktionsbereich', 'functional area'],
  'mobile_phone': ['mobile', 'mobil', 'handy', 'cell', 'cell phone', 'mobiltelefon', 'mobile phone'],
  'direct_phone': ['direct', 'durchwahl', 'direktwahl', 'direct phone', 'direct dial'],
  'office_phone': ['office phone', 'büro telefon', 'office tel', 'phone number', 'telefon'],
  'personal_linkedin_url': ['person linkedin', 'personal linkedin', 'linkedin person', 'contact linkedin', 'linkedin url person'],
  'education': ['education', 'ausbildung', 'bildung', 'degree'],
  'email_quality': ['email quality', 'e-mail qualität', 'email score'],
  'email_verification_status': ['email verification', 'verification status', 'email verified', 'email verifiziert', 'email status'],
  
  // Company
  'company_name': ['company name', 'firmenname', 'unternehmen', 'organisation', 'organization', 'company', 'firma'],
  'company_alias': ['company alias', 'firmen-alias', 'alias'],
  'company_type': ['company type', 'unternehmenstyp', 'rechtsform', 'legal form'],
  'company_description': ['company description', 'firmenbeschreibung', 'about company'],
  'company_website': ['company website', 'website', 'homepage', 'webseite', 'web url', 'company url'],
  'company_domain': ['company domain', 'domain', 'email domain'],
  'company_headcount': ['headcount', 'mitarbeiter', 'employees', 'mitarbeiterzahl', 'employee count', 'company size', 'size'],
  'company_industries': ['industries', 'branche', 'industry', 'branchen', 'sector'],
  'company_technologies': ['technologies', 'tech stack', 'technologien', 'tech', 'technology'],
  'company_financials': ['financials', 'finanzdaten', 'revenue', 'umsatz'],
  'company_linkedin_url': ['company linkedin', 'linkedin firma', 'company linkedin url', 'linkedin company', 'linkedin url company'],
  'company_founded_year': ['founded', 'gründungsjahr', 'founded year', 'company founded year', 'year founded', 'founded date'],
  'company_sic': ['sic', 'sic code'],
  'company_isic': ['isic', 'isic code'],
  'company_naics': ['naics', 'naics code'],
  
  // Company Address
  'company_address_line': ['company address', 'address line', 'straße', 'street', 'address', 'adresse', 'company street'],
  'company_city': ['company city', 'firmenstadt', 'company location'],
  'company_zip': ['company post code', 'company zip', 'plz firma', 'company postcode', 'company postal'],
  'company_state': ['company county', 'company state', 'bundesland firma', 'company region'],
  'company_country': ['company country', 'land firma', 'company nation'],
  'city': ['city', 'stadt', 'ort', 'location city'],
  'country': ['country', 'land', 'nation'],
  
  // HQ
  'hq_name': ['hq name', 'headquarter name', 'hauptsitz name'],
  'hq_address_line': ['hq address', 'company hq address', 'hq straße', 'headquarter address'],
  'hq_city': ['hq city', 'company hq city', 'hq stadt', 'headquarter city'],
  'hq_zip': ['hq post code', 'hq zip', 'company hq post code', 'hq plz', 'hq postal'],
  'hq_state': ['hq county', 'hq state', 'company hq county', 'company hq state', 'hq bundesland'],
  'hq_country': ['hq country', 'company hq country', 'hq land', 'headquarter country'],
  
  // Hiring Signals
  'hiring_title_1': ['hiring title 1', 'stelle 1 titel', 'job 1 title', 'open position 1'],
  'hiring_url_1': ['hiring url 1', 'stelle 1 url', 'job 1 url', 'position 1 url'],
  'hiring_location_1': ['hiring location 1', 'stelle 1 ort', 'job 1 location'],
  'hiring_date_1': ['hiring date 1', 'stelle 1 datum', 'job 1 date'],
  'hiring_title_2': ['hiring title 2', 'stelle 2 titel', 'job 2 title', 'open position 2'],
  'hiring_url_2': ['hiring url 2', 'stelle 2 url', 'job 2 url', 'position 2 url'],
  'hiring_location_2': ['hiring location 2', 'stelle 2 ort', 'job 2 location'],
  'hiring_date_2': ['hiring date 2', 'stelle 2 datum', 'job 2 date'],
  'hiring_title_3': ['hiring title 3', 'stelle 3 titel', 'job 3 title', 'open position 3'],
  'hiring_url_3': ['hiring url 3', 'stelle 3 url', 'job 3 url', 'position 3 url'],
  'hiring_location_3': ['hiring location 3', 'stelle 3 ort', 'job 3 location'],
  'hiring_date_3': ['hiring date 3', 'stelle 3 datum', 'job 3 date'],
  'hiring_title_4': ['hiring title 4', 'stelle 4 titel', 'job 4 title', 'open position 4'],
  'hiring_url_4': ['hiring url 4', 'stelle 4 url', 'job 4 url', 'position 4 url'],
  'hiring_location_4': ['hiring location 4', 'stelle 4 ort', 'job 4 location'],
  'hiring_date_4': ['hiring date 4', 'stelle 4 datum', 'job 4 date'],
  'hiring_title_5': ['hiring title 5', 'stelle 5 titel', 'job 5 title', 'open position 5'],
  'hiring_url_5': ['hiring url 5', 'stelle 5 url', 'job 5 url', 'position 5 url'],
  'hiring_location_5': ['hiring location 5', 'stelle 5 ort', 'job 5 location'],
  'hiring_date_5': ['hiring date 5', 'stelle 5 datum', 'job 5 date'],
  
  // Job Change Signals
  'job_change_prev_company': ['job change - previous company', 'previous company', 'vorheriger arbeitgeber', 'prev company', 'old company'],
  'job_change_prev_title': ['job change - previous title', 'previous title', 'vorherige position', 'prev title', 'old title'],
  'job_change_new_company': ['job change - new company', 'new company', 'neuer arbeitgeber', 'current company'],
  'job_change_new_title': ['job change - new title', 'new title', 'neue position', 'current title'],
  'job_change_date': ['job change date', 'wechsel datum', 'change date'],
  'moved_from_country': ['location move - from country', 'move from country', 'umzug von land', 'from country'],
  'moved_from_state': ['location move - from state', 'move from state', 'umzug von bundesland', 'from state'],
  'moved_to_country': ['location move - to country', 'move to country', 'umzug nach land', 'to country'],
  'moved_to_state': ['location move - to state', 'move to state', 'umzug nach bundesland', 'to state'],
  'moved_date': ['location move date', 'move date', 'umzug datum'],
  
  // Meta
  'list_name': ['list name', 'liste', 'listenname', 'list'],
  'segment': ['segment', 'zielgruppe'],
  'priority': ['priority', 'priorität', 'prio'],
  'language': ['language', 'sprache', 'lang'],
  'lead_source': ['lead source', 'source', 'quelle', 'herkunft'],
  'profile_id': ['profile id', 'profil id', 'profile_id'],
  'sid': ['sid', 's_id'],
  'score': ['score', 'punktzahl', 'bewertung'],
};

// Exclusion patterns
const EXCLUDE_FROM_FIELD: Record<string, string[]> = {
  'contact_name': ['company', 'firma', 'organization', 'organisation', 'business', 'unternehmen'],
  'contact_email': ['verification', 'status', 'quality', 'validated', 'valid', 'score', 'bounce'],
  'personal_linkedin_url': ['company', 'firma', 'organization', 'organisation', 'business'],
  'city': ['company', 'hq', 'firma', 'headquarter'],
  'company_name': ['linkedin', 'website', 'url', 'domain', 'address', 'city', 'country', 'founded', 'year', 'type', 'size', 'headcount'],
};

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Auto-mapping for contacts (full logic)
const autoMapContactColumn = (header: string, sampleData?: string[]): string => {
  const lowerHeader = header.toLowerCase().trim();
  
  // Phase 1: Exact matches
  for (const [field, patterns] of Object.entries(AUTO_MAP_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerHeader === pattern) {
        return field;
      }
    }
  }
  
  // Phase 2: Collect all patterns sorted by length
  const allPatterns: { field: string; pattern: string }[] = [];
  for (const [field, patterns] of Object.entries(AUTO_MAP_PATTERNS)) {
    for (const pattern of patterns) {
      allPatterns.push({ field, pattern });
    }
  }
  allPatterns.sort((a, b) => b.pattern.length - a.pattern.length);
  
  // Phase 3: Word boundary match with exclusion check
  for (const { field, pattern } of allPatterns) {
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordBoundaryRegex = new RegExp(`\\b${escapedPattern}\\b`, 'i');
    
    if (wordBoundaryRegex.test(lowerHeader)) {
      const excludePatterns = EXCLUDE_FROM_FIELD[field] || [];
      const shouldExclude = excludePatterns.some(ex => lowerHeader.includes(ex));
      
      if (!shouldExclude) {
        return field;
      }
    }
  }
  
  // Phase 4: Fallback with data validation
  if (sampleData && sampleData.length > 0) {
    const sample = sampleData.find(s => s && s.trim());
    if (sample) {
      if (isValidEmail(sample) && (lowerHeader.includes('email') || lowerHeader.includes('e-mail') || lowerHeader.includes('mail'))) {
        if (!lowerHeader.includes('verification') && !lowerHeader.includes('status') && !lowerHeader.includes('quality')) {
          return 'contact_email';
        }
      }
    }
  }
  
  return 'skip';
};

// Simple auto-mapping for companies
const autoMapCompanyColumn = (header: string): string => {
  const lower = header.toLowerCase().trim();
  
  if (lower.includes('firmenname') || lower.includes('company') || lower === 'name' || lower === 'firma') return 'name';
  if (lower.includes('website') || lower.includes('url') || lower.includes('homepage')) return 'website';
  if (lower.includes('domain')) return 'domain';
  if (lower.includes('branche') || lower.includes('industry') || lower.includes('sector')) return 'industry';
  if (lower.includes('stadt') || lower.includes('city') || lower.includes('ort')) return 'city';
  if (lower.includes('mitarbeiter') || lower.includes('headcount') || lower.includes('employee') || lower.includes('size')) return 'headcount';
  
  return 'skip';
};

export function SmartImportDialog({ open, onOpenChange }: SmartImportDialogProps) {
  const [mode, setMode] = useState<ImportMode>('select');
  const [step, setStep] = useState<Step>('mode');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const importCompanies = useImportCompanies();
  const importContacts = useImportContacts();

  const resetState = () => {
    setMode('select');
    setStep('mode');
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setProgress(0);
    setResults(null);
    setSearchTerm('');
  };

  // Cleanup scroll lock
  useEffect(() => {
    const cleanup = () => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
    };
    return cleanup;
  }, []);

  useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.body.removeAttribute('data-scroll-locked');
  }, [step]);

  const handleClose = () => {
    resetState();
    setTimeout(() => {
      document.body.style.pointerEvents = '';
      document.body.removeAttribute('data-scroll-locked');
    }, 100);
    onOpenChange(false);
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    return lines.map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if ((char === ',' || char === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
  };

  const handleFileUpload = useCallback(async (uploadedFile: File) => {
    setFile(uploadedFile);
    
    const text = await uploadedFile.text();
    const parsed = parseCSV(text);
    
    if (parsed.length < 2) {
      toast.error('CSV muss mindestens eine Header-Zeile und eine Datenzeile enthalten');
      return;
    }

    const fileHeaders = parsed[0];
    const data = parsed.slice(1);
    
    setHeaders(fileHeaders);
    setCsvData(data);
    
    // Auto-map columns based on mode
    const autoMapping: Record<string, string> = {};
    fileHeaders.forEach((header, index) => {
      if (mode === 'companies') {
        autoMapping[index.toString()] = autoMapCompanyColumn(header);
      } else {
        const sampleData = data.slice(0, 5).map(row => row[index] || '');
        autoMapping[index.toString()] = autoMapContactColumn(header, sampleData);
      }
    });
    setMapping(autoMapping);
    
    setStep('mapping');
  }, [mode]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFileUpload(droppedFile);
    } else {
      toast.error('Bitte eine CSV-Datei hochladen');
    }
  }, [handleFileUpload]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileUpload(selectedFile);
    }
  };

  const mappedFieldsCount = useMemo(() => {
    return Object.values(mapping).filter(v => v !== 'skip').length;
  }, [mapping]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return TARGET_FIELD_CATEGORIES;
    
    const term = searchTerm.toLowerCase();
    return TARGET_FIELD_CATEGORIES.map(category => ({
      ...category,
      fields: category.fields.filter(field => 
        field.label.toLowerCase().includes(term) || 
        field.value.toLowerCase().includes(term)
      )
    })).filter(category => category.fields.length > 0);
  }, [searchTerm]);

  const getFieldLabel = (value: string): string => {
    if (value === 'skip') return '— Überspringen —';
    
    if (mode === 'companies') {
      const field = COMPANY_ONLY_FIELDS.find(f => f.value === value);
      return field?.label || value;
    }
    
    const field = ALL_CONTACT_FIELDS.find(f => f.value === value);
    return field?.label || value;
  };

  const getCategoryForField = (value: string): string | null => {
    for (const category of TARGET_FIELD_CATEGORIES) {
      if (category.fields.some(f => f.value === value)) {
        return category.name;
      }
    }
    return null;
  };

  const requiredFieldsMapped = () => {
    const mappedFields = Object.values(mapping);
    
    if (mode === 'companies') {
      return mappedFields.includes('name');
    }
    
    // Contacts: need company_name, (contact_name OR first+last), contact_email
    const hasCompanyName = mappedFields.includes('company_name');
    const hasEmail = mappedFields.includes('contact_email');
    const hasContactName = mappedFields.includes('contact_name') || 
      (mappedFields.includes('first_name') && mappedFields.includes('last_name'));
    return hasCompanyName && hasContactName && hasEmail;
  };

  const startImport = async () => {
    if (!requiredFieldsMapped()) {
      toast.error('Pflichtfelder fehlen!');
      return;
    }

    setStep('importing');
    setProgress(0);

    // Build data rows
    const rows = csvData.map(row => {
      const item: Record<string, any> = {};
      headers.forEach((_, index) => {
        const targetField = mapping[index.toString()];
        if (targetField && targetField !== 'skip') {
          item[targetField] = row[index];
        }
      });
      
      // Auto-compose contact_name from first_name + last_name if not directly mapped
      if (mode === 'contacts' && !item.contact_name && (item.first_name || item.last_name)) {
        item.contact_name = [item.first_name, item.last_name].filter(Boolean).join(' ').trim();
      }
      
      return item;
    });

    const progressInterval = setInterval(() => {
      setProgress(p => Math.min(p + 10, 90));
    }, 200);

    try {
      if (mode === 'companies') {
        const companyRows: CompanyImportRow[] = rows.map(r => ({
          name: r.name,
          website: r.website,
          domain: r.domain,
          industry: r.industry,
          city: r.city,
          headcount: r.headcount ? parseInt(r.headcount) : undefined,
        }));
        const result = await importCompanies.mutateAsync(companyRows);
        setResults(result);
      } else {
        const contactRows: ContactImportRow[] = rows.map(r => ({
          name: r.contact_name,
          email: r.contact_email,
          role: r.contact_role,
          company_name: r.company_name,
          decision_level: r.decision_level,
          functional_area: r.functional_area,
          phone: r.mobile_phone || r.direct_phone || r.office_phone,
          linkedin_url: r.personal_linkedin_url,
          // Pass through all raw data for advanced fields
          raw_data: r,
        }));
        const result = await importContacts.mutateAsync(contactRows);
        setResults(result);
      }
      
      clearInterval(progressInterval);
      setProgress(100);
      setStep('done');
    } catch (error) {
      clearInterval(progressInterval);
      toast.error('Import fehlgeschlagen');
      setStep('mapping');
    }
  };

  const renderModeSelection = () => (
    <div className="grid grid-cols-2 gap-4 py-6">
      <button
        onClick={() => { setMode('companies'); setStep('upload'); }}
        className="flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-all"
      >
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Unternehmen</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Firmen ohne Kontakte hinzufügen
          </p>
          <Badge variant="secondary" className="mt-2">Status: Kontakte fehlen</Badge>
        </div>
      </button>

      <button
        onClick={() => { setMode('contacts'); setStep('upload'); }}
        className="flex flex-col items-center gap-4 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-accent/50 transition-all"
      >
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-lg">Kontakte</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ansprechpartner importieren
          </p>
          <Badge variant="secondary" className="mt-2">Firma wird automatisch erstellt</Badge>
        </div>
      </button>
    </div>
  );

  const renderUpload = () => (
    <div
      className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <input
        id="file-input"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
      <p className="text-lg font-medium">CSV-Datei hierher ziehen</p>
      <p className="text-sm text-muted-foreground mt-1">oder klicken zum Auswählen</p>
      
      <div className="mt-6 p-4 bg-muted/50 rounded-lg text-left text-sm">
        <p className="font-medium mb-2">
          {mode === 'companies' ? 'Erwartete Spalten (Unternehmen):' : 'Unterstützt 80+ Felder inkl. Hiring- und Wechsel-Signale'}
        </p>
        <div className="flex flex-wrap gap-2">
          {mode === 'companies' ? (
            COMPANY_ONLY_FIELDS.map(f => (
              <Badge key={f.value} variant={f.required ? 'default' : 'outline'}>
                {f.label} {f.required && '*'}
              </Badge>
            ))
          ) : (
            <>
              <Badge variant="default">Firmenname *</Badge>
              <Badge variant="default">Name *</Badge>
              <Badge variant="default">E-Mail *</Badge>
              <Badge variant="outline">Position</Badge>
              <Badge variant="outline">+ 70 weitere</Badge>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderCompanyMapping = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <FileSpreadsheet className="h-4 w-4" />
        <span>{file?.name}</span>
        <Badge variant="secondary">{csvData.length} Zeilen</Badge>
      </div>

      <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[200px]">CSV-Spalte</TableHead>
              <TableHead className="w-[200px]">Zuordnung</TableHead>
              <TableHead>Vorschau</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header, index) => {
              const mappedValue = mapping[index.toString()] || 'skip';
              const isMapped = mappedValue !== 'skip';
              
              return (
                <TableRow key={index} className={isMapped ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {isMapped && <Check className="h-4 w-4 text-primary" />}
                      <span className="truncate">{header}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mappedValue}
                      onValueChange={(value) => setMapping(prev => ({ ...prev, [index.toString()]: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">— Überspringen —</SelectItem>
                        {COMPANY_ONLY_FIELDS.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label} {field.required && '*'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {csvData.slice(0, 2).map(row => row[index]).filter(Boolean).join(', ').slice(0, 50)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderContactMapping = () => (
    <div className="flex-1 overflow-hidden flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileSpreadsheet className="h-4 w-4" />
          <span>{file?.name}</span>
          <Badge variant="secondary">{csvData.length} Zeilen</Badge>
          <Badge variant="outline">{mappedFieldsCount} Felder gemappt</Badge>
        </div>
        <div className="flex gap-2">
          {!requiredFieldsMapped() && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Pflichtfelder fehlen
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 border rounded-lg overflow-y-auto min-h-0 max-h-[450px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead className="w-[180px]">CSV-Spalte</TableHead>
              <TableHead className="w-[280px]">Zielfeld</TableHead>
              <TableHead>Vorschau (erste 3 Zeilen)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((header, index) => {
              const mappedValue = mapping[index.toString()] || 'skip';
              const category = getCategoryForField(mappedValue);
              const isMapped = mappedValue !== 'skip';
              
              return (
                <TableRow key={index} className={isMapped ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {isMapped && <Check className="h-4 w-4 text-primary" />}
                      <span className="truncate">{header}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mappedValue}
                      onValueChange={(value) => setMapping(prev => ({ ...prev, [index.toString()]: value }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          <div className="flex items-center gap-2">
                            <span className={mappedValue === 'skip' ? 'text-muted-foreground' : ''}>
                              {getFieldLabel(mappedValue)}
                            </span>
                            {category && (
                              <Badge variant="outline" className="text-xs py-0">
                                {category}
                              </Badge>
                            )}
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="max-h-[400px]">
                        <div className="p-2 sticky top-0 bg-popover z-10">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Feld suchen..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="pl-8"
                            />
                            {searchTerm && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-1 top-1 h-7 w-7 p-0"
                                onClick={() => setSearchTerm('')}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        <SelectItem value="skip">
                          <span className="text-muted-foreground">— Überspringen —</span>
                        </SelectItem>
                        
                        {filteredCategories.map(cat => {
                          const CategoryIcon = cat.icon;
                          return (
                            <SelectGroup key={cat.name}>
                              <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                                <CategoryIcon className="h-3.5 w-3.5" />
                                {cat.name}
                              </SelectLabel>
                              {cat.fields.map(field => (
                                <SelectItem key={field.value} value={field.value}>
                                  <span className="flex items-center gap-2">
                                    {field.label}
                                    {field.required && (
                                      <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                        Pflicht
                                      </Badge>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[250px] truncate">
                    {csvData.slice(0, 3).map(row => row[index]).filter(Boolean).join(' | ')}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderImporting = () => (
    <div className="py-12 text-center">
      <Progress value={progress} className="mb-4" />
      <p className="text-muted-foreground">
        Importiere {mode === 'companies' ? 'Unternehmen' : 'Kontakte'}... {progress}%
      </p>
    </div>
  );

  const renderDone = () => (
    <div className="py-8 text-center">
      <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
        <Check className="h-8 w-8 text-green-500" />
      </div>
      <h3 className="text-lg font-semibold mb-4">Import abgeschlossen</h3>
      
      {results && mode === 'companies' && (
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{results.created}</p>
            <p className="text-muted-foreground">Erstellt</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{results.skipped}</p>
            <p className="text-muted-foreground">Übersprungen</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{results.errors}</p>
            <p className="text-muted-foreground">Fehler</p>
          </div>
        </div>
      )}
      
      {results && mode === 'contacts' && (
        <div className="flex justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{results.contacts_created}</p>
            <p className="text-muted-foreground">Kontakte</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-500">{results.companies_created}</p>
            <p className="text-muted-foreground">Firmen erstellt</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{results.duplicates}</p>
            <p className="text-muted-foreground">Duplikate</p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={mode === 'contacts' && step === 'mapping' ? 'max-w-5xl max-h-[90vh] overflow-hidden flex flex-col' : 'max-w-2xl'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === 'mode' && 'Was möchten Sie importieren?'}
            {step === 'upload' && (
              <>
                {mode === 'companies' ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                {mode === 'companies' ? 'Unternehmen importieren' : 'Kontakte importieren'}
              </>
            )}
            {step === 'mapping' && (
              <>
                <FileSpreadsheet className="h-5 w-5" />
                Felder zuordnen
                {mode === 'contacts' && (
                  <Badge variant="secondary" className="ml-2">
                    {mappedFieldsCount} Felder gemappt
                  </Badge>
                )}
              </>
            )}
            {step === 'importing' && 'Import läuft...'}
            {step === 'done' && 'Import abgeschlossen'}
          </DialogTitle>
          {step === 'mapping' && mode === 'contacts' && (
            <DialogDescription>
              Ordnen Sie die CSV-Spalten den Zielfeldern zu (80+ verfügbare Felder)
            </DialogDescription>
          )}
        </DialogHeader>

        {step === 'mode' && renderModeSelection()}
        {step === 'upload' && renderUpload()}
        {step === 'mapping' && mode === 'companies' && renderCompanyMapping()}
        {step === 'mapping' && mode === 'contacts' && renderContactMapping()}
        {step === 'importing' && renderImporting()}
        {step === 'done' && renderDone()}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => setStep('mode')}>
              Zurück
            </Button>
          )}
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Zurück
              </Button>
              <Button onClick={startImport} disabled={!requiredFieldsMapped()}>
                {csvData.length} {mode === 'companies' ? 'Unternehmen' : 'Kontakte'} importieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>
              Schließen
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
