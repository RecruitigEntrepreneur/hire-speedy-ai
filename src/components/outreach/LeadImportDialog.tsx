import { useState, useCallback, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Upload, FileSpreadsheet, Check, AlertCircle, User, Building2, MapPin, 
  Building, Briefcase, ArrowRightLeft, Tag, ChevronDown, Search, X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface LeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

// Flat list of all fields for easy lookup
const ALL_TARGET_FIELDS = TARGET_FIELD_CATEGORIES.flatMap(cat => cat.fields);

// Extended auto-mapping patterns
const AUTO_MAP_PATTERNS: Record<string, string[]> = {
  // Person
  'first_name': ['first name', 'vorname', 'firstname', 'first_name', 'given name'],
  'last_name': ['last name', 'nachname', 'lastname', 'last_name', 'surname', 'family name'],
  'contact_name': ['full name', 'name', 'kontaktperson', 'contact name', 'kontakt'],
  'contact_email': ['email', 'e-mail', 'mail', 'email address', 'e-mail-adresse'],
  'contact_role': ['job title', 'position', 'role', 'titel', 'title', 'job_title', 'jobtitle'],
  'seniority': ['seniority', 'level', 'karrierestufe'],
  'department': ['department', 'abteilung', 'bereich'],
  'mobile_phone': ['mobile', 'mobil', 'handy', 'cell', 'cell phone', 'mobiltelefon'],
  'direct_phone': ['direct', 'durchwahl', 'direktwahl', 'direct phone', 'direct dial'],
  'office_phone': ['office', 'büro', 'telefon', 'office phone', 'phone', 'tel'],
  'personal_linkedin_url': ['personal linkedin', 'linkedin url', 'linkedin', 'linkedin profile'],
  'education': ['education', 'ausbildung', 'bildung', 'degree'],
  'email_quality': ['email quality', 'e-mail qualität', 'quality'],
  'email_verification_status': ['email verification', 'verification status', 'verified', 'verifiziert'],
  
  // Company
  'company_name': ['company name', 'firma', 'firmenname', 'unternehmen', 'company', 'organisation', 'organization'],
  'company_alias': ['company alias', 'alias', 'firmen-alias'],
  'company_type': ['company type', 'unternehmenstyp', 'type', 'rechtsform'],
  'company_description': ['company description', 'beschreibung', 'description', 'about'],
  'company_website': ['website', 'url', 'homepage', 'webseite', 'web', 'company website'],
  'company_domain': ['domain', 'company domain'],
  'company_headcount': ['headcount', 'mitarbeiter', 'employees', 'size', 'mitarbeiterzahl', 'employee count'],
  'company_industries': ['industries', 'branche', 'industry', 'branchen', 'sector'],
  'company_technologies': ['technologies', 'tech stack', 'technologien', 'tech', 'technology'],
  'company_financials': ['financials', 'finanzdaten', 'revenue', 'umsatz'],
  'company_linkedin_url': ['company linkedin', 'linkedin firma', 'company linkedin url'],
  'company_founded_year': ['founded', 'gründungsjahr', 'founded year', 'company founded year', 'year founded'],
  'company_sic': ['sic', 'sic code'],
  'company_isic': ['isic', 'isic code'],
  'company_naics': ['naics', 'naics code'],
  
  // Company Address
  'company_address_line': ['company address line', 'address line', 'straße', 'street', 'address', 'adresse', 'company address'],
  'company_city': ['company city', 'firmenstadt'],
  'company_zip': ['company post code', 'company zip', 'plz firma', 'postcode', 'zip code', 'zip'],
  'company_state': ['company county', 'company state', 'bundesland firma', 'state', 'county'],
  'company_country': ['company country', 'land firma'],
  'city': ['city', 'stadt', 'ort', 'location'],
  'country': ['country', 'land'],
  
  // HQ
  'hq_name': ['hq', 'headquarter', 'hauptsitz'],
  'hq_address_line': ['hq address line', 'company hq address line', 'hq straße', 'hq address'],
  'hq_city': ['hq city', 'company hq city', 'hq stadt'],
  'hq_zip': ['hq post code', 'hq zip', 'company hq post code', 'hq plz'],
  'hq_state': ['hq county', 'hq state', 'company hq county', 'company hq state', 'hq bundesland'],
  'hq_country': ['hq country', 'company hq country', 'hq land'],
  
  // Hiring Signals
  'hiring_title_1': ['hiring title 1', 'stelle 1 titel', 'job 1 title'],
  'hiring_url_1': ['hiring url 1', 'stelle 1 url', 'job 1 url'],
  'hiring_location_1': ['hiring location 1', 'stelle 1 ort', 'job 1 location'],
  'hiring_date_1': ['hiring date 1', 'stelle 1 datum', 'job 1 date'],
  'hiring_title_2': ['hiring title 2', 'stelle 2 titel', 'job 2 title'],
  'hiring_url_2': ['hiring url 2', 'stelle 2 url', 'job 2 url'],
  'hiring_location_2': ['hiring location 2', 'stelle 2 ort', 'job 2 location'],
  'hiring_date_2': ['hiring date 2', 'stelle 2 datum', 'job 2 date'],
  'hiring_title_3': ['hiring title 3', 'stelle 3 titel', 'job 3 title'],
  'hiring_url_3': ['hiring url 3', 'stelle 3 url', 'job 3 url'],
  'hiring_location_3': ['hiring location 3', 'stelle 3 ort', 'job 3 location'],
  'hiring_date_3': ['hiring date 3', 'stelle 3 datum', 'job 3 date'],
  'hiring_title_4': ['hiring title 4', 'stelle 4 titel', 'job 4 title'],
  'hiring_url_4': ['hiring url 4', 'stelle 4 url', 'job 4 url'],
  'hiring_location_4': ['hiring location 4', 'stelle 4 ort', 'job 4 location'],
  'hiring_date_4': ['hiring date 4', 'stelle 4 datum', 'job 4 date'],
  'hiring_title_5': ['hiring title 5', 'stelle 5 titel', 'job 5 title'],
  'hiring_url_5': ['hiring url 5', 'stelle 5 url', 'job 5 url'],
  'hiring_location_5': ['hiring location 5', 'stelle 5 ort', 'job 5 location'],
  'hiring_date_5': ['hiring date 5', 'stelle 5 datum', 'job 5 date'],
  
  // Job Change Signals
  'job_change_prev_company': ['job change - previous company', 'previous company', 'vorheriger arbeitgeber', 'prev company'],
  'job_change_prev_title': ['job change - previous title', 'previous title', 'vorherige position', 'prev title'],
  'job_change_new_company': ['job change - new company', 'new company', 'neuer arbeitgeber', 'current company'],
  'job_change_new_title': ['job change - new title', 'new title', 'neue position', 'current title'],
  'job_change_date': ['job change date', 'wechsel datum', 'change date'],
  'moved_from_country': ['location move - from country', 'move from country', 'umzug von land'],
  'moved_from_state': ['location move - from state', 'move from state', 'umzug von bundesland'],
  'moved_to_country': ['location move - to country', 'move to country', 'umzug nach land'],
  'moved_to_state': ['location move - to state', 'move to state', 'umzug nach bundesland'],
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
  'industry': ['branche', 'industry'],
  'company_size': ['größe', 'size', 'unternehmensgröße'],
};

export function LeadImportDialog({ open, onOpenChange }: LeadImportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'done'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState({ success: 0, errors: 0, duplicates: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(
    TARGET_FIELD_CATEGORIES.map(c => c.name)
  );

  const resetState = () => {
    setStep('upload');
    setFile(null);
    setCsvData([]);
    setHeaders([]);
    setMapping({});
    setProgress(0);
    setResults({ success: 0, errors: 0, duplicates: 0 });
    setSearchTerm('');
  };

  // Aggressive scroll-lock cleanup on unmount AND step changes
  useEffect(() => {
    const cleanup = () => {
      document.body.style.pointerEvents = '';
      document.body.style.overflow = '';
      document.body.removeAttribute('data-scroll-locked');
    };
    return cleanup;
  }, []);

  // Additional cleanup when step changes
  useEffect(() => {
    document.body.style.pointerEvents = '';
    document.body.style.overflow = '';
    document.body.removeAttribute('data-scroll-locked');
  }, [step]);

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
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

  const autoMapColumn = (header: string): string => {
    const lowerHeader = header.toLowerCase().trim();
    
    for (const [field, patterns] of Object.entries(AUTO_MAP_PATTERNS)) {
      for (const pattern of patterns) {
        if (lowerHeader === pattern || lowerHeader.includes(pattern)) {
          return field;
        }
      }
    }
    
    return 'skip';
  };

  const handleFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length > 0) {
        setHeaders(parsed[0]);
        setCsvData(parsed.slice(1));
        
        // Auto-map columns using extended patterns
        const autoMapping: Record<string, string> = {};
        parsed[0].forEach((header, index) => {
          autoMapping[index.toString()] = autoMapColumn(header);
        });
        setMapping(autoMapping);
        setStep('mapping');
      }
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFile(droppedFile);
    } else {
      toast.error('Bitte eine CSV-Datei hochladen');
    }
  }, [handleFile]);

  const buildHiringSignals = (rowData: Record<string, string>): any[] => {
    const signals = [];
    for (let i = 1; i <= 5; i++) {
      const title = rowData[`hiring_title_${i}`];
      if (title) {
        signals.push({
          title,
          url: rowData[`hiring_url_${i}`] || null,
          location: rowData[`hiring_location_${i}`] || null,
          date: rowData[`hiring_date_${i}`] || null,
        });
      }
    }
    return signals;
  };

  const buildJobChangeData = (rowData: Record<string, string>): any => {
    const hasJobChange = rowData.job_change_prev_company || rowData.job_change_new_company;
    if (!hasJobChange) return null;
    
    return {
      prev_company: rowData.job_change_prev_company || null,
      prev_title: rowData.job_change_prev_title || null,
      new_company: rowData.job_change_new_company || null,
      new_title: rowData.job_change_new_title || null,
      date: rowData.job_change_date || null,
    };
  };

  const buildLocationMoveData = (rowData: Record<string, string>): any => {
    const hasMove = rowData.moved_from_country || rowData.moved_to_country;
    if (!hasMove) return null;
    
    return {
      from_country: rowData.moved_from_country || null,
      from_state: rowData.moved_from_state || null,
      to_country: rowData.moved_to_country || null,
      to_state: rowData.moved_to_state || null,
      date: rowData.moved_date || null,
    };
  };

  const handleImport = async () => {
    setStep('importing');
    setProgress(0);
    
    const leads = csvData.map(row => {
      // First, collect all mapped values into a temporary object
      const rowData: Record<string, string> = {};
      Object.entries(mapping).forEach(([colIndex, field]) => {
        if (field !== 'skip' && row[parseInt(colIndex)]) {
          rowData[field] = row[parseInt(colIndex)];
        }
      });

      // Build the lead object with proper type handling
      const lead: Record<string, any> = {
        status: 'new',
        segment: rowData.segment || 'unknown',
        priority: rowData.priority || 'medium',
        score: parseInt(rowData.score) || 50,
      };
      
      // Simple string fields
      const stringFields = [
        'first_name', 'last_name', 'contact_name', 'contact_email', 'contact_role',
        'seniority', 'department', 'mobile_phone', 'direct_phone', 'office_phone',
        'personal_linkedin_url', 'education', 'email_quality', 'email_verification_status',
        'company_name', 'company_alias', 'company_type', 'company_description',
        'company_website', 'company_domain', 'company_financials', 'company_linkedin_url',
        'company_sic', 'company_isic', 'company_naics',
        'company_address_line', 'company_city', 'company_zip', 'company_state', 'company_country',
        'hq_name', 'hq_address_line', 'hq_city', 'hq_zip', 'hq_state', 'hq_country',
        'city', 'country', 'industry', 'company_size',
        'list_name', 'language', 'lead_source', 'profile_id', 'sid'
      ];
      
      stringFields.forEach(field => {
        if (rowData[field]) {
          lead[field] = rowData[field];
        }
      });

      // Numeric fields
      if (rowData.company_headcount) {
        lead.company_headcount = parseInt(rowData.company_headcount) || null;
      }
      if (rowData.company_founded_year) {
        lead.company_founded_year = parseInt(rowData.company_founded_year) || null;
      }

      // JSONB array fields - parse if comma-separated
      if (rowData.company_industries) {
        const industries = rowData.company_industries.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        lead.company_industries = industries.length > 0 ? industries : null;
      }
      if (rowData.company_technologies) {
        const technologies = rowData.company_technologies.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        lead.company_technologies = technologies.length > 0 ? technologies : null;
      }

      // Build JSONB objects for hiring signals and job change data
      const hiringSignals = buildHiringSignals(rowData);
      if (hiringSignals.length > 0) {
        lead.hiring_signals = hiringSignals;
      }

      const jobChangeData = buildJobChangeData(rowData);
      if (jobChangeData) {
        lead.job_change_data = jobChangeData;
      }

      const locationMoveData = buildLocationMoveData(rowData);
      if (locationMoveData) {
        lead.location_move_data = locationMoveData;
      }
      
      return lead;
    }).filter(lead => lead.company_name && lead.contact_name && lead.contact_email);

    let success = 0;
    let errors = 0;
    let duplicates = 0;

    for (let i = 0; i < leads.length; i++) {
      try {
        // Check for duplicate
        const { data: existing } = await supabase
          .from('outreach_leads')
          .select('id')
          .eq('contact_email', leads[i].contact_email)
          .single();

        if (existing) {
          duplicates++;
        } else {
          const { error } = await supabase
            .from('outreach_leads')
            .insert(leads[i] as any);
          
          if (error) {
            console.error('Import error:', error);
            errors++;
          } else {
            success++;
          }
        }
      } catch {
        errors++;
      }
      
      setProgress(Math.round(((i + 1) / leads.length) * 100));
    }

    setResults({ success, errors, duplicates });
    setStep('done');
    queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
    queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
  };

  const requiredFieldsMapped = () => {
    const mappedFields = Object.values(mapping);
    return mappedFields.includes('company_name') && 
           mappedFields.includes('contact_name') && 
           mappedFields.includes('contact_email');
  };

  const mappedFieldsCount = useMemo(() => {
    return Object.values(mapping).filter(v => v !== 'skip').length;
  }, [mapping]);

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryName) 
        ? prev.filter(c => c !== categoryName)
        : [...prev, categoryName]
    );
  };

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
    const field = ALL_TARGET_FIELDS.find(f => f.value === value);
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
      // Force cleanup scroll lock
      setTimeout(() => {
        document.body.style.pointerEvents = '';
        document.body.removeAttribute('data-scroll-locked');
      }, 100);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Leads importieren
            {step === 'mapping' && (
              <Badge variant="secondary" className="ml-2">
                {mappedFieldsCount} Felder gemappt
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Importieren Sie Leads aus einer CSV-Datei mit automatischer Feldzuordnung
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">CSV-Datei hierher ziehen</p>
            <p className="text-sm text-muted-foreground mb-4">Unterstützt 80+ Felder inkl. Hiring- und Wechsel-Signale</p>
            <Button variant="outline" onClick={() => document.getElementById('csv-input')?.click()}>
              Datei auswählen
            </Button>
            <input
              id="csv-input"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
        )}

        {step === 'mapping' && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                {csvData.length} Zeilen in <span className="font-medium">{file?.name}</span>
              </p>
              <div className="flex gap-2">
                {!requiredFieldsMapped() && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Pflichtfelder fehlen
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 border rounded-lg">
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
                              
                              {filteredCategories.map(category => {
                                const CategoryIcon = category.icon;
                                return (
                                  <SelectGroup key={category.name}>
                                    <SelectLabel className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
                                      <CategoryIcon className="h-3.5 w-3.5" />
                                      {category.name}
                                    </SelectLabel>
                                    {category.fields.map(field => (
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
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="truncate max-w-[300px]">
                            {csvData.slice(0, 3).map(row => row[index]).filter(Boolean).join(' | ') || '—'}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
              <span>
                <span className="text-destructive">*</span> Pflichtfelder: Firmenname, Kontaktperson, E-Mail
              </span>
              <span>
                80+ Felder verfügbar inkl. Hiring-Signale (1-5) und Wechsel-Signale
              </span>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Importiere Leads...</p>
              <p className="text-sm text-muted-foreground">{progress}% abgeschlossen</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {step === 'done' && (
          <div className="py-8 space-y-6">
            <div className="text-center">
              <Check className="h-12 w-12 mx-auto text-green-500 mb-4" />
              <p className="text-lg font-medium">Import abgeschlossen</p>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{results.success}</p>
                <p className="text-sm text-muted-foreground">Erfolgreich</p>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{results.duplicates}</p>
                <p className="text-sm text-muted-foreground">Duplikate</p>
              </div>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{results.errors}</p>
                <p className="text-sm text-muted-foreground">Fehler</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Zurück</Button>
              <Button onClick={handleImport} disabled={!requiredFieldsMapped()}>
                {csvData.length} Leads importieren
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={() => { resetState(); onOpenChange(false); }}>Schließen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
