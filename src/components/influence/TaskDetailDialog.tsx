import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Phone,
  Mail,
  Check,
  Clock,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  BookOpen,
  ChevronDown,
  User,
  Briefcase,
  MapPin,
  Copy,
  Shield,
  ExternalLink,
  MessageSquare,
  Send,
  Activity,
  TrendingUp,
  Upload,
  ClipboardList,
  DollarSign,
  Calendar,
  FileText,
  Save,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow, format, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { SnoozeDropdown } from './SnoozeDropdown';

// Generic task item that can be constructed from either UnifiedTaskItem or CandidateTask
export interface TaskDetailItem {
  itemType: 'alert' | 'task' | 'expose';
  itemId: string;
  title: string;
  description: string | null;
  recommendedAction: string | null;
  taskCategory: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  submissionId: string | null;
  candidateId: string | null;
  jobId: string | null;
  playbookId: string | null;
  createdAt: string;
  dueAt: string | null;
  impactScore: number;
  candidateName: string | null;
  candidatePhone: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  companyName: string | null;
}

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: TaskDetailItem | null;
  onMarkDone: (itemId: string) => void;
  onSnooze?: (itemId: string, until: Date) => void;
}

const PRIORITY_CONFIG = {
  critical: { icon: AlertCircle, label: 'Kritisch', color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive' },
  high: { icon: AlertTriangle, label: 'Hoch', color: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500' },
  medium: { icon: Clock, label: 'Mittel', color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500' },
  low: { icon: Clock, label: 'Normal', color: 'text-muted-foreground', bgColor: 'bg-muted', borderColor: 'border-muted-foreground' },
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  'opt_in_pending': { label: 'Opt-In', color: 'bg-primary/10 text-primary' },
  'opt_in_pending_24h': { label: 'Opt-In dringend', color: 'bg-destructive/10 text-destructive' },
  'opt_in_pending_48h': { label: 'Opt-In überfällig', color: 'bg-destructive/10 text-destructive' },
  'interview_prep_missing': { label: 'Vorbereitung', color: 'bg-primary/10 text-primary' },
  'interview_reminder': { label: 'Interview', color: 'bg-blue-500/10 text-blue-600' },
  'salary_mismatch': { label: 'Gehalt', color: 'bg-amber-500/10 text-amber-600' },
  'salary_negotiation': { label: 'Gehalt', color: 'bg-amber-500/10 text-amber-600' },
  'ghosting_risk': { label: 'Ghosting', color: 'bg-destructive/10 text-destructive' },
  'engagement_drop': { label: 'Engagement', color: 'bg-primary/10 text-primary' },
  'closing_opportunity': { label: 'Closing', color: 'bg-emerald-500/10 text-emerald-600' },
  'follow_up_needed': { label: 'Follow-up', color: 'bg-blue-500/10 text-blue-600' },
  'no_activity': { label: 'Inaktiv', color: 'bg-muted text-muted-foreground' },
  'sla_warning': { label: 'SLA', color: 'bg-destructive/10 text-destructive' },
  'document_missing': { label: 'Dokument', color: 'bg-amber-500/10 text-amber-600' },
  'culture_concern': { label: 'Kultur', color: 'bg-amber-500/10 text-amber-600' },
  'client_feedback_positive': { label: 'Feedback+', color: 'bg-emerald-500/10 text-emerald-600' },
  'client_feedback_negative': { label: 'Feedback-', color: 'bg-destructive/10 text-destructive' },
  'expose': { label: 'Exposé', color: 'bg-blue-500/10 text-blue-600' },
  'call': { label: 'Anruf', color: 'bg-violet-500/10 text-violet-600' },
  'email': { label: 'E-Mail', color: 'bg-violet-500/10 text-violet-600' },
  'meeting': { label: 'Meeting', color: 'bg-violet-500/10 text-violet-600' },
  'other': { label: 'Sonstiges', color: 'bg-muted text-muted-foreground' },
};

interface SubmissionContext {
  stage: string | null;
  matchScore: number | null;
  companyRevealed: boolean;
  jobIndustry: string | null;
  candidateJobTitle: string | null;
  candidateCity: string | null;
  candidateExperience: number | null;
  candidateSalary: number | null;
}

interface CandidateData {
  expected_salary: number | null;
  change_motivation: string | null;
  availability_date: string | null;
  notice_period: string | null;
  cv_ai_summary: string | null;
}

interface ActivityItem {
  id: string;
  activity_type: string;
  title: string;
  created_at: string;
}

// ── Inline Action Forms ────────────────────────────────────────────

function OptInActionForm({
  item,
  candidateData,
  onConfirmOptIn,
  onSaveField,
  saving,
}: {
  item: TaskDetailItem;
  candidateData: CandidateData | null;
  onConfirmOptIn: () => void;
  onSaveField: (field: string, value: unknown) => void;
  saving: boolean;
}) {
  const [salary, setSalary] = useState('');
  const [checks, setChecks] = useState({ optIn: false, cvPresent: false, salaryConfirmed: false });

  useEffect(() => {
    if (candidateData?.expected_salary) {
      setSalary(String(candidateData.expected_salary));
    }
    setChecks(c => ({
      ...c,
      cvPresent: !!candidateData?.cv_ai_summary,
      salaryConfirmed: !!candidateData?.expected_salary,
    }));
  }, [candidateData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <ClipboardList className="h-3.5 w-3.5 text-primary" />
        Aufgabe erledigen — Opt-In Checkliste
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox
            checked={checks.optIn}
            onCheckedChange={(v) => {
              setChecks(c => ({ ...c, optIn: !!v }));
              if (v) onConfirmOptIn();
            }}
          />
          <span className="text-sm">Opt-In vom Kandidaten bestätigt</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.cvPresent} disabled />
          <span className={cn('text-sm', checks.cvPresent ? 'text-foreground' : 'text-muted-foreground')}>
            CV vorhanden {checks.cvPresent && <Check className="inline h-3 w-3 text-emerald-600 ml-1" />}
          </span>
        </label>
        <div className="space-y-1.5">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <Checkbox
              checked={checks.salaryConfirmed}
              onCheckedChange={(v) => setChecks(c => ({ ...c, salaryConfirmed: !!v }))}
            />
            <span className="text-sm">Gehaltswunsch bestätigt</span>
          </label>
          {checks.salaryConfirmed && !candidateData?.expected_salary && (
            <div className="flex items-center gap-2 ml-7">
              <Input
                type="number"
                placeholder="z.B. 75000"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="h-8 text-sm w-32"
              />
              <span className="text-xs text-muted-foreground">EUR/Jahr</span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={saving || !salary}
                onClick={() => onSaveField('expected_salary', Number(salary))}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SalaryActionForm({
  candidateData,
  onSaveField,
  saving,
}: {
  candidateData: CandidateData | null;
  onSaveField: (field: string, value: unknown) => void;
  saving: boolean;
}) {
  const [desiredSalary, setDesiredSalary] = useState('');

  useEffect(() => {
    if (candidateData?.expected_salary) {
      setDesiredSalary(String(candidateData.expected_salary));
    }
  }, [candidateData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <DollarSign className="h-3.5 w-3.5 text-amber-500" />
        Aufgabe erledigen — Gehalt
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Gehaltswunsch (EUR/Jahr)</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="z.B. 75000"
              value={desiredSalary}
              onChange={(e) => setDesiredSalary(e.target.value)}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs shrink-0"
              disabled={saving || !desiredSalary}
              onClick={() => onSaveField('expected_salary', Number(desiredSalary))}
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Speichern'}
            </Button>
          </div>
          {candidateData?.expected_salary && (
            <p className="text-[10px] text-muted-foreground">
              Aktuell gespeichert: {candidateData.expected_salary.toLocaleString('de-DE')} EUR
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FollowUpActionForm({
  onSaveNote,
  saving,
}: {
  onSaveNote: (text: string) => void;
  saving: boolean;
}) {
  const [followUpNote, setFollowUpNote] = useState('');
  const [nextContact, setNextContact] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Calendar className="h-3.5 w-3.5 text-blue-500" />
        Aufgabe erledigen — Follow-up
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Was wurde besprochen?</Label>
          <Textarea
            placeholder="Kurze Zusammenfassung..."
            value={followUpNote}
            onChange={(e) => setFollowUpNote(e.target.value)}
            className="text-sm min-h-[60px] resize-none"
            rows={2}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Nächster Kontakt</Label>
          <Input
            type="date"
            value={nextContact}
            onChange={(e) => setNextContact(e.target.value)}
            className="h-8 text-sm w-44"
          />
        </div>
        {followUpNote.trim() && (
          <Button
            size="sm"
            className="text-xs"
            disabled={saving}
            onClick={() => {
              const text = nextContact
                ? `${followUpNote}\n\nNächster Kontakt: ${nextContact}`
                : followUpNote;
              onSaveNote(text);
              setFollowUpNote('');
              setNextContact('');
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Speichern & als erledigt markieren
          </Button>
        )}
      </div>
    </div>
  );
}

function MotivationActionForm({
  candidateData,
  onSaveField,
  saving,
}: {
  candidateData: CandidateData | null;
  onSaveField: (field: string, value: unknown) => void;
  saving: boolean;
}) {
  const [motivation, setMotivation] = useState('');

  useEffect(() => {
    if (candidateData?.change_motivation) {
      setMotivation(candidateData.change_motivation);
    }
  }, [candidateData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <FileText className="h-3.5 w-3.5 text-primary" />
        Aufgabe erledigen — Wechselmotivation
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <Label className="text-xs text-muted-foreground">Warum will der Kandidat wechseln?</Label>
        <Textarea
          placeholder="Wechselmotivation eintragen..."
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          className="text-sm min-h-[80px] resize-none"
          rows={3}
        />
        <Button
          size="sm"
          className="text-xs"
          disabled={saving || !motivation.trim()}
          onClick={() => onSaveField('change_motivation', motivation.trim())}
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Speichern
        </Button>
        {candidateData?.change_motivation && motivation !== candidateData.change_motivation && (
          <p className="text-[10px] text-muted-foreground">
            Gespeichert: {candidateData.change_motivation.slice(0, 80)}...
          </p>
        )}
      </div>
    </div>
  );
}

function DocumentActionForm({
  candidateId,
}: {
  candidateId: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <Upload className="h-3.5 w-3.5 text-amber-500" />
        Aufgabe erledigen — Dokument
      </div>
      <div className="rounded-lg border border-dashed bg-card p-4 text-center space-y-2">
        <Upload className="h-6 w-6 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          CV oder Dokument im Kandidatenprofil hochladen
        </p>
        {candidateId && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => window.open(`/recruiter/candidates/${candidateId}`, '_blank')}
          >
            <ExternalLink className="h-3 w-3" />
            Profil öffnen zum Hochladen
          </Button>
        )}
      </div>
    </div>
  );
}

function InterviewPrepActionForm({
  onSaveNote,
  saving,
}: {
  onSaveNote: (text: string) => void;
  saving: boolean;
}) {
  const [checks, setChecks] = useState({
    briefingDone: false,
    timeslotConfirmed: false,
    prepSent: false,
    reminderSent: false,
  });
  const [prepNote, setPrepNote] = useState('');

  const allDone = Object.values(checks).every(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
        Aufgabe erledigen — Interview-Vorbereitung
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-2.5">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.briefingDone} onCheckedChange={(v) => setChecks(c => ({ ...c, briefingDone: !!v }))} />
          <span className="text-sm">Kandidat gebrieft</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.timeslotConfirmed} onCheckedChange={(v) => setChecks(c => ({ ...c, timeslotConfirmed: !!v }))} />
          <span className="text-sm">Termin bestätigt</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.prepSent} onCheckedChange={(v) => setChecks(c => ({ ...c, prepSent: !!v }))} />
          <span className="text-sm">Vorbereitungsunterlagen gesendet</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.reminderSent} onCheckedChange={(v) => setChecks(c => ({ ...c, reminderSent: !!v }))} />
          <span className="text-sm">Erinnerung gesendet</span>
        </label>
        <Textarea
          placeholder="Ergänzende Notiz (optional)..."
          value={prepNote}
          onChange={(e) => setPrepNote(e.target.value)}
          className="text-sm min-h-[40px] resize-none mt-1"
          rows={1}
        />
        {allDone && (
          <Button
            size="sm"
            className="text-xs"
            disabled={saving}
            onClick={() => {
              const summary = [
                checks.briefingDone ? 'Briefing: OK' : null,
                checks.timeslotConfirmed ? 'Termin: OK' : null,
                checks.prepSent ? 'Unterlagen: OK' : null,
                checks.reminderSent ? 'Erinnerung: OK' : null,
                prepNote.trim() || null,
              ].filter(Boolean).join(', ');
              onSaveNote(summary);
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
            Alles erledigt
          </Button>
        )}
      </div>
    </div>
  );
}

function ClosingActionForm({
  onSaveNote,
  saving,
}: {
  onSaveNote: (text: string) => void;
  saving: boolean;
}) {
  const [checks, setChecks] = useState({
    offerSent: false,
    salaryAgreed: false,
    startDateSet: false,
    contractSent: false,
  });
  const [closingNote, setClosingNote] = useState('');

  const allDone = Object.values(checks).every(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <ClipboardList className="h-3.5 w-3.5 text-emerald-500" />
        Aufgabe erledigen — Closing
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-2.5">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.offerSent} onCheckedChange={(v) => setChecks(c => ({ ...c, offerSent: !!v }))} />
          <span className="text-sm">Angebot unterbreitet</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.salaryAgreed} onCheckedChange={(v) => setChecks(c => ({ ...c, salaryAgreed: !!v }))} />
          <span className="text-sm">Gehalt vereinbart</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.startDateSet} onCheckedChange={(v) => setChecks(c => ({ ...c, startDateSet: !!v }))} />
          <span className="text-sm">Startdatum festgelegt</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={checks.contractSent} onCheckedChange={(v) => setChecks(c => ({ ...c, contractSent: !!v }))} />
          <span className="text-sm">Vertrag gesendet</span>
        </label>
        <Textarea
          placeholder="Closing-Notiz (optional)..."
          value={closingNote}
          onChange={(e) => setClosingNote(e.target.value)}
          className="text-sm min-h-[40px] resize-none mt-1"
          rows={1}
        />
        {allDone && (
          <Button
            size="sm"
            className="text-xs bg-emerald-600 hover:bg-emerald-700"
            disabled={saving}
            onClick={() => {
              const parts = [
                checks.offerSent ? 'Angebot: OK' : null,
                checks.salaryAgreed ? 'Gehalt: OK' : null,
                checks.startDateSet ? 'Start: OK' : null,
                checks.contractSent ? 'Vertrag: OK' : null,
                closingNote.trim() || null,
              ].filter(Boolean).join(', ');
              onSaveNote(parts);
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
            Closing abschließen
          </Button>
        )}
      </div>
    </div>
  );
}

function GhostingActionForm({
  onSaveNote,
  saving,
}: {
  onSaveNote: (text: string) => void;
  saving: boolean;
}) {
  const [attempts, setAttempts] = useState({ call: false, email: false, whatsapp: false });
  const [ghostNote, setGhostNote] = useState('');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        Aufgabe erledigen — Kontaktversuche
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-2.5">
        <p className="text-xs text-muted-foreground">Welche Kanäle wurden versucht?</p>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={attempts.call} onCheckedChange={(v) => setAttempts(c => ({ ...c, call: !!v }))} />
          <span className="text-sm flex items-center gap-1"><Phone className="h-3 w-3" /> Anruf versucht</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={attempts.email} onCheckedChange={(v) => setAttempts(c => ({ ...c, email: !!v }))} />
          <span className="text-sm flex items-center gap-1"><Mail className="h-3 w-3" /> E-Mail gesendet</span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <Checkbox checked={attempts.whatsapp} onCheckedChange={(v) => setAttempts(c => ({ ...c, whatsapp: !!v }))} />
          <span className="text-sm flex items-center gap-1"><MessageSquare className="h-3 w-3" /> WhatsApp gesendet</span>
        </label>
        <Textarea
          placeholder="Ergebnis / Nächster Schritt..."
          value={ghostNote}
          onChange={(e) => setGhostNote(e.target.value)}
          className="text-sm min-h-[40px] resize-none"
          rows={1}
        />
        {(attempts.call || attempts.email || attempts.whatsapp) && (
          <Button
            size="sm"
            className="text-xs"
            disabled={saving}
            onClick={() => {
              const channels = [
                attempts.call ? 'Anruf' : null,
                attempts.email ? 'E-Mail' : null,
                attempts.whatsapp ? 'WhatsApp' : null,
              ].filter(Boolean).join(', ');
              const text = `Kontaktversuche: ${channels}${ghostNote.trim() ? `\n${ghostNote.trim()}` : ''}`;
              onSaveNote(text);
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Versuche dokumentieren
          </Button>
        )}
      </div>
    </div>
  );
}

function CultureConcernActionForm({
  onSaveNote,
  saving,
}: {
  onSaveNote: (text: string) => void;
  saving: boolean;
}) {
  const [assessment, setAssessment] = useState('');
  const [verdict, setVerdict] = useState<'positive' | 'negative' | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        <FileText className="h-3.5 w-3.5 text-amber-500" />
        Aufgabe erledigen — Kulturelle Passung
      </div>
      <div className="rounded-lg border bg-card p-3 space-y-2.5">
        <Label className="text-xs text-muted-foreground">Einschätzung</Label>
        <div className="flex gap-2">
          <Button
            variant={verdict === 'positive' ? 'default' : 'outline'}
            size="sm"
            className={cn('text-xs flex-1', verdict === 'positive' && 'bg-emerald-600 hover:bg-emerald-700')}
            onClick={() => setVerdict('positive')}
          >
            Passt
          </Button>
          <Button
            variant={verdict === 'negative' ? 'default' : 'outline'}
            size="sm"
            className={cn('text-xs flex-1', verdict === 'negative' && 'bg-destructive hover:bg-destructive/90')}
            onClick={() => setVerdict('negative')}
          >
            Bedenken
          </Button>
        </div>
        <Textarea
          placeholder="Begründung / Beobachtungen..."
          value={assessment}
          onChange={(e) => setAssessment(e.target.value)}
          className="text-sm min-h-[60px] resize-none"
          rows={2}
        />
        {verdict && assessment.trim() && (
          <Button
            size="sm"
            className="text-xs"
            disabled={saving}
            onClick={() => {
              const text = `Kulturelle Passung: ${verdict === 'positive' ? 'Positiv' : 'Bedenken'}\n${assessment.trim()}`;
              onSaveNote(text);
            }}
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
            Bewertung speichern
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Dialog Component ──────────────────────────────────────────

export function TaskDetailDialog({ open, onOpenChange, item, onMarkDone, onSnooze }: TaskDetailDialogProps) {
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const { playbook } = useCoachingPlaybook(item?.playbookId ?? undefined);
  const [playbookOpen, setPlaybookOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [submissionContext, setSubmissionContext] = useState<SubmissionContext | null>(null);
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  // Fetch additional context when item changes
  useEffect(() => {
    if (!item || !open) return;
    setNoteText('');
    setPlaybookOpen(false);
    fetchContext();
  }, [item?.itemId, open]);

  const fetchContext = useCallback(async () => {
    if (!item) return;
    setLoadingContext(true);

    try {
      // Fetch submission context if available
      if (item.submissionId) {
        const { data: sub } = await supabase
          .from('submissions')
          .select('stage, match_score, company_revealed, jobs(industry), candidates(job_title, city, experience_years, expected_salary)')
          .eq('id', item.submissionId)
          .single();

        if (sub) {
          setSubmissionContext({
            stage: sub.stage,
            matchScore: (sub as any).match_score,
            companyRevealed: !!(sub as any).company_revealed,
            jobIndustry: (sub as any).jobs?.industry || null,
            candidateJobTitle: (sub as any).candidates?.job_title || null,
            candidateCity: (sub as any).candidates?.city || null,
            candidateExperience: (sub as any).candidates?.experience_years || null,
            candidateSalary: (sub as any).candidates?.expected_salary || null,
          });
        }
      }

      // Fetch candidate data for inline forms
      if (item.candidateId) {
        const { data: cand } = await supabase
          .from('candidates')
          .select('expected_salary, change_motivation, availability_date, notice_period, cv_ai_summary')
          .eq('id', item.candidateId)
          .single();

        if (cand) {
          setCandidateData(cand as CandidateData);
        }
      }

      // Fetch recent activities
      if (item.candidateId) {
        const { data: acts } = await supabase
          .from('candidate_activity_log')
          .select('id, activity_type, title, created_at')
          .eq('candidate_id', item.candidateId)
          .order('created_at', { ascending: false })
          .limit(8);

        setActivities((acts || []) as ActivityItem[]);
      }
    } catch (err) {
      console.error('Error fetching task context:', err);
    } finally {
      setLoadingContext(false);
    }
  }, [item]);

  if (!item) return null;

  const priorityInfo = PRIORITY_CONFIG[item.priority];
  const categoryInfo = CATEGORY_CONFIG[item.taskCategory] || CATEGORY_CONFIG['other'];
  const PriorityIcon = priorityInfo.icon;

  const timeLabel = item.dueAt
    ? isPast(new Date(item.dueAt))
      ? formatDistanceToNow(new Date(item.dueAt), { locale: de, addSuffix: false }) + ' überfällig'
      : 'Fällig ' + format(new Date(item.dueAt), 'dd.MM.', { locale: de })
    : formatDistanceToNow(new Date(item.createdAt), { locale: de, addSuffix: true });

  // ── Save handlers ──

  const handleSaveNote = async (text?: string) => {
    const noteContent = text || noteText.trim();
    if (!noteContent || !item.candidateId) return;
    setSavingNote(true);
    try {
      await logActivity(
        item.candidateId,
        'note',
        `Notiz: ${noteContent.slice(0, 50)}${noteContent.length > 50 ? '...' : ''}`,
        noteContent,
        { source: 'task_detail', task_id: item.itemId, task_category: item.taskCategory },
        item.submissionId || undefined,
        item.itemType === 'alert' ? item.itemId : undefined
      );
      setNoteText('');
      toast.success('Notiz gespeichert');
      fetchContext();
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveCandidateField = async (field: string, value: unknown) => {
    if (!item.candidateId) return;
    setSavingField(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({ [field]: value } as any)
        .eq('id', item.candidateId);

      if (error) throw error;

      // Update local state
      setCandidateData(prev => prev ? { ...prev, [field]: value } : prev);
      toast.success('Gespeichert');

      // Log activity
      await logActivity(
        item.candidateId,
        'note',
        `Feld aktualisiert: ${field}`,
        String(value),
        { source: 'task_inline_action', field, task_id: item.itemId },
        item.submissionId || undefined
      );
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingField(false);
    }
  };

  const handleConfirmOptIn = async () => {
    if (!item.submissionId) return;
    try {
      await supabase
        .from('submissions')
        .update({ stage: 'candidate_opted_in' })
        .eq('id', item.submissionId);

      toast.success('Opt-In bestätigt');

      if (item.candidateId) {
        await logActivity(
          item.candidateId,
          'opt_in_confirmed',
          'Opt-In vom Recruiter bestätigt',
          undefined,
          { submission_id: item.submissionId },
          item.submissionId,
          item.itemType === 'alert' ? item.itemId : undefined
        );
      }
    } catch {
      toast.error('Fehler beim Bestätigen');
    }
  };

  const handleSaveNoteAndDone = async (text: string) => {
    await handleSaveNote(text);
    onMarkDone(item.itemId);
    onOpenChange(false);
  };

  const handleDone = () => {
    onMarkDone(item.itemId);
    onOpenChange(false);
  };

  const handleSnooze = (until: Date) => {
    onSnooze?.(item.itemId, until);
    onOpenChange(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Kopiert!');
  };

  const replacePlaceholders = (text: string) => {
    return text
      .replace(/\[Name\]/g, item.candidateName || 'Kandidat')
      .replace(/\[Firma\]/g, item.companyName || 'Unternehmen');
  };

  // ── Determine which inline form to show ──

  const isOptIn = item.taskCategory.startsWith('opt_in_pending');
  const isSalary = item.taskCategory === 'salary_mismatch' || item.taskCategory === 'salary_negotiation';
  const isFollowUp = item.taskCategory === 'follow_up_needed' || item.taskCategory === 'no_activity';
  const isInterviewPrep = item.taskCategory === 'interview_prep_missing' || item.taskCategory === 'interview_reminder';
  const isClosing = item.taskCategory === 'closing_opportunity';
  const isGhosting = item.taskCategory === 'ghosting_risk';
  const isDocument = item.taskCategory === 'document_missing' || item.itemType === 'expose';
  const isCulture = item.taskCategory === 'culture_concern';
  const isEngagement = item.taskCategory === 'engagement_drop';

  const hasInlineForm = isOptIn || isSalary || isFollowUp || isInterviewPrep || isClosing || isGhosting || isDocument || isCulture || isEngagement;

  const STAGE_LABELS: Record<string, string> = {
    new: 'Neu',
    submitted: 'Eingereicht',
    screening: 'Screening',
    shortlisted: 'Shortlisted',
    interview_requested: 'Interview angefragt',
    candidate_opted_in: 'Opt-In erteilt',
    interview: 'Interview',
    interview_scheduled: 'Interview geplant',
    offer: 'Angebot',
    hired: 'Eingestellt',
  };

  const ACTIVITY_ICONS: Record<string, string> = {
    call: '📞',
    email: '✉️',
    note: '📝',
    status_change: '🔄',
    playbook_used: '📋',
    alert_actioned: '✅',
    hubspot_import: '📥',
    task_completed: '✅',
    opt_in_confirmed: '🛡️',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden">
        <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
          {/* LEFT: Task + Inline Actions + Playbook */}
          <div className="flex-1 flex flex-col min-w-0 md:border-r">
            {/* Task Header */}
            <div className="p-5 pb-4 border-b space-y-3">
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', priorityInfo.bgColor)}>
                  <PriorityIcon className={cn('h-5 w-5', priorityInfo.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-base leading-tight">{item.title}</h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge className={cn('text-[10px] font-medium px-1.5 py-0 h-4 border-0', categoryInfo.color)}>
                      {categoryInfo.label}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-4', priorityInfo.color)}>
                      {priorityInfo.label}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{timeLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Recommended Action */}
              {item.recommendedAction && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    Empfohlene Aktion
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-sm">
                    {item.recommendedAction}
                  </div>
                </div>
              )}

              {/* Description / Message (Why this task?) */}
              {item.description && item.description !== item.recommendedAction && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Warum diese Aufgabe?
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              )}

              {/* ═══ INLINE ACTION FORM ═══ */}
              {hasInlineForm && (
                <div className="border-t border-b py-4 -mx-5 px-5 bg-muted/10">
                  {isOptIn && (
                    <OptInActionForm
                      item={item}
                      candidateData={candidateData}
                      onConfirmOptIn={handleConfirmOptIn}
                      onSaveField={handleSaveCandidateField}
                      saving={savingField}
                    />
                  )}
                  {isSalary && (
                    <SalaryActionForm
                      candidateData={candidateData}
                      onSaveField={handleSaveCandidateField}
                      saving={savingField}
                    />
                  )}
                  {isFollowUp && (
                    <FollowUpActionForm
                      onSaveNote={handleSaveNoteAndDone}
                      saving={savingNote}
                    />
                  )}
                  {isInterviewPrep && (
                    <InterviewPrepActionForm
                      onSaveNote={handleSaveNoteAndDone}
                      saving={savingNote}
                    />
                  )}
                  {isClosing && (
                    <ClosingActionForm
                      onSaveNote={handleSaveNoteAndDone}
                      saving={savingNote}
                    />
                  )}
                  {isGhosting && (
                    <GhostingActionForm
                      onSaveNote={handleSaveNoteAndDone}
                      saving={savingNote}
                    />
                  )}
                  {isDocument && (
                    <DocumentActionForm candidateId={item.candidateId} />
                  )}
                  {isCulture && (
                    <CultureConcernActionForm
                      onSaveNote={handleSaveNoteAndDone}
                      saving={savingNote}
                    />
                  )}
                  {isEngagement && (
                    <MotivationActionForm
                      candidateData={candidateData}
                      onSaveField={handleSaveCandidateField}
                      saving={savingField}
                    />
                  )}
                </div>
              )}

              {/* Playbook (collapsible) */}
              {playbook && (
                <Collapsible open={playbookOpen} onOpenChange={setPlaybookOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between py-2 px-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Playbook: {playbook.title}</span>
                      </div>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', playbookOpen && 'rotate-180')} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 border rounded-lg overflow-hidden">
                      <Tabs defaultValue="phone" className="w-full">
                        <TabsList className="w-full justify-start rounded-none border-b bg-muted/30 h-9">
                          {playbook.phone_script && (
                            <TabsTrigger value="phone" className="text-xs gap-1">
                              <Phone className="h-3 w-3" />
                              Telefon
                            </TabsTrigger>
                          )}
                          {playbook.email_template && (
                            <TabsTrigger value="email" className="text-xs gap-1">
                              <Mail className="h-3 w-3" />
                              Email
                            </TabsTrigger>
                          )}
                          {playbook.whatsapp_template && (
                            <TabsTrigger value="whatsapp" className="text-xs gap-1">
                              <MessageSquare className="h-3 w-3" />
                              WhatsApp
                            </TabsTrigger>
                          )}
                        </TabsList>

                        {playbook.phone_script && (
                          <TabsContent value="phone" className="p-3 space-y-3 mt-0">
                            <div className="relative">
                              <pre className="text-xs whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-40 overflow-y-auto">
                                {replacePlaceholders(playbook.phone_script)}
                              </pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => copyToClipboard(replacePlaceholders(playbook.phone_script!))}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                            {playbook.talking_points.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Gesprächspunkte</p>
                                <ul className="space-y-0.5">
                                  {playbook.talking_points.map((tp, i) => (
                                    <li key={i} className="text-xs flex items-start gap-1.5">
                                      <span className="text-primary mt-0.5">•</span>
                                      {replacePlaceholders(tp)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {playbook.objection_handlers.length > 0 && (
                              <div>
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Einwände</p>
                                <div className="space-y-1.5">
                                  {playbook.objection_handlers.map((oh, i) => (
                                    <div key={i} className="text-xs bg-muted/30 rounded p-2">
                                      <span className="font-medium text-destructive">"{oh.objection}"</span>
                                      <span className="text-muted-foreground"> → </span>
                                      <span>{replacePlaceholders(oh.response)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </TabsContent>
                        )}

                        {playbook.email_template && (
                          <TabsContent value="email" className="p-3 mt-0">
                            <div className="relative">
                              <pre className="text-xs whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto">
                                {replacePlaceholders(playbook.email_template)}
                              </pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => copyToClipboard(replacePlaceholders(playbook.email_template!))}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TabsContent>
                        )}

                        {playbook.whatsapp_template && (
                          <TabsContent value="whatsapp" className="p-3 mt-0">
                            <div className="relative">
                              <pre className="text-xs whitespace-pre-wrap bg-muted/30 rounded-md p-3 max-h-48 overflow-y-auto">
                                {replacePlaceholders(playbook.whatsapp_template)}
                              </pre>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => copyToClipboard(replacePlaceholders(playbook.whatsapp_template!))}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TabsContent>
                        )}
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Note Input */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Send className="h-3.5 w-3.5" />
                  Notiz hinzufügen
                </div>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Notiz eingeben..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="text-sm min-h-[60px] resize-none"
                    rows={2}
                  />
                  {noteText.trim() && (
                    <Button
                      size="sm"
                      className="shrink-0 self-end"
                      onClick={() => handleSaveNote()}
                      disabled={savingNote}
                    >
                      {savingNote ? '...' : 'Speichern'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Sticky Action Bar */}
            <div className="border-t p-3 flex items-center gap-2 bg-card shrink-0">
              {item.candidatePhone && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => window.location.href = `tel:${item.candidatePhone}`}
                >
                  <Phone className="h-3.5 w-3.5" />
                  Anrufen
                </Button>
              )}
              {item.candidateEmail && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => window.location.href = `mailto:${item.candidateEmail}`}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Button>
              )}
              <div className="flex-1" />
              {onSnooze && (
                <SnoozeDropdown
                  onSnooze={handleSnooze}
                  triggerClassName="h-8 w-8 text-muted-foreground hover:text-foreground"
                />
              )}
              <Button
                size="sm"
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleDone}
              >
                <Check className="h-3.5 w-3.5" />
                Erledigt
              </Button>
            </div>
          </div>

          {/* RIGHT: Context Panel */}
          <div className="w-full md:w-[300px] shrink-0 overflow-y-auto bg-muted/20">
            <div className="p-4 space-y-4">
              {/* Candidate */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <User className="h-3.5 w-3.5" />
                  Kandidat
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-sm">{item.candidateName || 'Unbekannt'}</p>
                  {submissionContext?.candidateJobTitle && (
                    <p className="text-xs text-muted-foreground">{submissionContext.candidateJobTitle}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {submissionContext?.candidateCity && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {submissionContext.candidateCity}
                      </span>
                    )}
                    {submissionContext?.candidateExperience && (
                      <span>{submissionContext.candidateExperience}J Erfahrung</span>
                    )}
                    {submissionContext?.candidateSalary && (
                      <span>Gehalt: {Math.round(submissionContext.candidateSalary / 1000)}K</span>
                    )}
                  </div>
                  {/* Contact buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {item.candidatePhone && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => window.location.href = `tel:${item.candidatePhone}`}
                          >
                            <Phone className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{item.candidatePhone}</TooltipContent>
                      </Tooltip>
                    )}
                    {item.candidateEmail && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => window.location.href = `mailto:${item.candidateEmail}`}
                          >
                            <Mail className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[200px] break-all">{item.candidateEmail}</TooltipContent>
                      </Tooltip>
                    )}
                    {item.candidateId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] gap-1 ml-auto"
                        onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${item.candidateId}`); }}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Profil
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t" />

              {/* Job */}
              {(item.jobTitle || item.companyName) && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Briefcase className="h-3.5 w-3.5" />
                      Job
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">{item.jobTitle || 'Unbekannt'}</p>
                      {item.companyName && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Shield className="h-3 w-3" />
                          {item.companyName}
                        </div>
                      )}
                      {submissionContext && (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-2">
                          {submissionContext.matchScore != null && (
                            <>
                              <span className="text-muted-foreground">Match</span>
                              <span className="font-medium">{submissionContext.matchScore}%</span>
                            </>
                          )}
                          {submissionContext.stage && (
                            <>
                              <span className="text-muted-foreground">Stage</span>
                              <span className="font-medium">{STAGE_LABELS[submissionContext.stage] || submissionContext.stage}</span>
                            </>
                          )}
                        </div>
                      )}
                      {item.submissionId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] gap-1 w-full mt-1"
                          onClick={() => { onOpenChange(false); navigate(`/recruiter/submissions/${item.submissionId}`); }}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Einreichung öffnen
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="border-t" />
                </>
              )}

              {/* Impact Score */}
              {item.impactScore > 0 && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Impact
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            item.impactScore >= 70 ? 'bg-emerald-500' :
                            item.impactScore >= 40 ? 'bg-amber-500' :
                            'bg-muted-foreground'
                          )}
                          style={{ width: `${item.impactScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium w-8 text-right">{item.impactScore}%</span>
                    </div>
                  </div>
                  <div className="border-t" />
                </>
              )}

              {/* Recent Activity */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Activity className="h-3.5 w-3.5" />
                  Letzte Aktivität
                </div>
                {activities.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Keine Aktivitäten</p>
                ) : (
                  <div className="space-y-1.5">
                    {activities.slice(0, 6).map((act) => (
                      <div key={act.id} className="flex items-start gap-2 text-xs">
                        <span className="shrink-0 mt-0.5">{ACTIVITY_ICONS[act.activity_type] || '•'}</span>
                        <div className="flex-1 min-w-0">
                          <span className="truncate block">{act.title}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {formatDistanceToNow(new Date(act.created_at), { locale: de, addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
