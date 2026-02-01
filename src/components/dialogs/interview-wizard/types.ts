// Types for the Professional Interview Wizard

export type MeetingFormat = 'teams' | 'meet' | 'video' | 'phone' | 'onsite';

export interface InterviewWizardData {
  // Step 1: Format & Duration
  meetingFormat: MeetingFormat;
  durationMinutes: number;
  meetingLink?: string;       // For 'video' format
  onsiteAddress?: string;     // For 'onsite' format
  
  // Step 2: Slots
  proposedSlots: Date[];
  
  // Step 3: Message & GDPR
  clientMessage: string;
  gdprConfirmed: boolean;
}

export interface InterviewWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string;
  candidateAnonymousId: string;
  jobTitle: string;
  companyDescription?: string; // Anonymized: e.g. "Technologie-Unternehmen"
  onSuccess?: () => void;
}

export const MEETING_FORMATS: { value: MeetingFormat; label: string; icon: string; description: string }[] = [
  { value: 'teams', label: 'MS Teams', icon: '📹', description: 'Link wird automatisch erstellt' },
  { value: 'meet', label: 'Google Meet', icon: '🎦', description: 'Link wird automatisch erstellt' },
  { value: 'phone', label: 'Telefon', icon: '📞', description: 'Telefonnummer angeben' },
  { value: 'onsite', label: 'Vor-Ort', icon: '🏢', description: 'Adresse angeben' },
  { value: 'video', label: 'Video (Link)', icon: '🔗', description: 'Eigenen Link eingeben' },
];

export const DURATION_OPTIONS = [30, 45, 60, 90, 120];

export const DEFAULT_WIZARD_DATA: InterviewWizardData = {
  meetingFormat: 'teams',
  durationMinutes: 60,
  proposedSlots: [],
  clientMessage: '',
  gdprConfirmed: false,
};
