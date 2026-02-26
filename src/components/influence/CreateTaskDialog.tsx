import { useState, useEffect } from 'react';
import { Phone, Mail, UserPlus, CalendarDays, MessageSquare, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useRecruiterTasks, type CreateTaskInput } from '@/hooks/useRecruiterTasks';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId?: string;
  candidateName?: string;
  jobId?: string;
  jobTitle?: string;
}

const TASK_TYPES = [
  { value: 'call', label: 'Anruf', icon: Phone },
  { value: 'email', label: 'E-Mail', icon: Mail },
  { value: 'follow_up', label: 'Follow-up', icon: UserPlus },
  { value: 'meeting', label: 'Meeting', icon: CalendarDays },
  { value: 'other', label: 'Sonstiges', icon: MoreHorizontal },
];

const PRIORITIES = [
  { value: 'low', label: 'Niedrig' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Hoch' },
  { value: 'urgent', label: 'Dringend' },
];

export function CreateTaskDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  jobId,
  jobTitle,
}: CreateTaskDialogProps) {
  const { createTask } = useRecruiterTasks();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [taskType, setTaskType] = useState('call');
  const [priority, setPriority] = useState('normal');
  const [dueAt, setDueAt] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState(candidateId || '');
  const [selectedJobId, setSelectedJobId] = useState(jobId || '');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<{ id: string; full_name: string }[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string; company_name: string }[]>([]);
  const { user } = useAuth();

  // Load candidates and jobs for selection
  useEffect(() => {
    if (!open || !user) return;

    const loadOptions = async () => {
      const [candidatesRes, jobsRes] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, full_name')
          .eq('recruiter_id', user.id)
          .order('full_name')
          .limit(100),
        supabase
          .from('jobs')
          .select('id, title, company_name')
          .eq('status', 'published')
          .order('title')
          .limit(100),
      ]);

      if (candidatesRes.data) setCandidates(candidatesRes.data);
      if (jobsRes.data) setJobs(jobsRes.data);
    };

    loadOptions();
  }, [open, user]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle('');
      setDescription('');
      setTaskType('call');
      setPriority('normal');
      setDueAt('');
      setSelectedCandidateId(candidateId || '');
      setSelectedJobId(jobId || '');
    }
  }, [open, candidateId, jobId]);

  const handleSubmit = async () => {
    if (!title.trim()) return;

    setLoading(true);
    try {
      const input: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || undefined,
        task_type: taskType as CreateTaskInput['task_type'],
        priority: priority as CreateTaskInput['priority'],
        candidate_id: selectedCandidateId || undefined,
        job_id: selectedJobId || undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      };

      const result = await createTask(input);
      if (result) {
        toast.success('Aufgabe erstellt');
        onOpenChange(false);
      } else {
        toast.error('Fehler beim Erstellen der Aufgabe');
      }
    } catch {
      toast.error('Fehler beim Erstellen der Aufgabe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Neue Aufgabe erstellen
          </DialogTitle>
          <DialogDescription>
            Erstelle eine manuelle Aufgabe für dein Task-Board.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label>Titel *</Label>
            <Input
              placeholder='z.B. "Rückruf wegen Gehaltswunsch"'
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Beschreibung</Label>
            <Textarea
              placeholder="Optionale Details zur Aufgabe..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Type + Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Typ</Label>
              <Select value={taskType} onValueChange={setTaskType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Candidate + Job */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Kandidat</Label>
              {candidateName ? (
                <Input value={candidateName} disabled />
              ) : (
                <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keiner</SelectItem>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Job</Label>
              {jobTitle ? (
                <Input value={jobTitle} disabled />
              ) : (
                <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Optional..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Keiner</SelectItem>
                    {jobs.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.title} · {j.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Due date */}
          <div className="space-y-2">
            <Label>Fällig am</Label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || loading}>
            {loading ? 'Erstelle...' : 'Aufgabe anlegen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
