import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useInterviewTypes } from '@/hooks/useInterviewTypes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, Video, Phone, MapPin, Plus, ChevronDown, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';

interface CandidateInterviewsCardProps {
  candidateId: string;
  maxItems?: number;
  showAddForm?: boolean;
  onViewAll?: () => void;
}

interface InterviewRow {
  id: string;
  scheduled_at: string | null;
  status: string | null;
  meeting_type: string | null;
  notes: string | null;
  pending_opt_in: boolean | null;
  interview_type_id: string | null;
  created_at: string;
  duration_minutes: number | null;
  submission_id: string;
  submissions: {
    id: string;
    candidate_id: string;
    jobs: {
      id: string;
      title: string;
      companies: { name: string } | null;
    } | null;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Ausstehend', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  pending_response: { label: 'Warte auf Antwort', className: 'bg-blue-100 text-blue-800 border-blue-200' },
  scheduled: { label: 'Geplant', className: 'bg-green-100 text-green-800 border-green-200' },
  completed: { label: 'Abgeschlossen', className: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Abgesagt', className: 'bg-red-100 text-red-800 border-red-200' },
  no_show: { label: 'Nicht erschienen', className: 'bg-red-100 text-red-800 border-red-200' },
};

function getMeetingIcon(type: string | null) {
  switch (type) {
    case 'teams':
    case 'zoom':
    case 'google_meet':
      return <Video className="h-4 w-4 text-muted-foreground" />;
    case 'onsite':
      return <MapPin className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Phone className="h-4 w-4 text-muted-foreground" />;
  }
}

export function CandidateInterviewsCard({ candidateId, maxItems, showAddForm = false, onViewAll }: CandidateInterviewsCardProps) {
  const queryClient = useQueryClient();
  const { types: interviewTypes, loading: typesLoading } = useInterviewTypes();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formTypeId, setFormTypeId] = useState<string>('');
  const [formNotes, setFormNotes] = useState('');
  const [formSubmissionId, setFormSubmissionId] = useState<string>('');

  // Fetch interviews for this candidate via submissions
  const { data: interviews = [], isLoading } = useQuery({
    queryKey: ['candidate-interviews', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select(`
          id, scheduled_at, status, meeting_type, notes, pending_opt_in,
          interview_type_id, created_at, duration_minutes, submission_id,
          submissions!inner (
            id, candidate_id,
            jobs ( id, title, companies ( name ) )
          )
        `)
        .eq('submissions.candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as InterviewRow[];
    },
  });

  // Fetch active submissions for the add form
  const { data: activeSubmissions = [] } = useQuery({
    queryKey: ['candidate-active-submissions', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, jobs ( id, title, companies ( name ) )')
        .eq('candidate_id', candidateId)
        .not('status', 'in', '(rejected,withdrawn,hired,client_rejected)');
      if (error) throw error;
      return data || [];
    },
    enabled: showAddForm,
  });

  // Auto-select submission if only one
  useEffect(() => {
    if (activeSubmissions.length === 1 && !formSubmissionId) {
      setFormSubmissionId(activeSubmissions[0].id);
    }
  }, [activeSubmissions, formSubmissionId]);

  const handleSave = async () => {
    if (!formSubmissionId) {
      toast.error('Bitte eine Bewerbung auswählen');
      return;
    }
    if (!formDate) {
      toast.error('Bitte ein Datum angeben');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('interviews').insert({
        submission_id: formSubmissionId,
        scheduled_at: new Date(formDate).toISOString(),
        status: 'completed',
        meeting_type: 'phone',
        notes: formNotes || null,
        interview_type_id: formTypeId || null,
      });

      if (error) throw error;

      toast.success('Interview eingetragen');
      queryClient.invalidateQueries({ queryKey: ['candidate-interviews', candidateId] });
      setFormOpen(false);
      setFormNotes('');
      setFormTypeId('');
      setFormDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (err) {
      console.error('Save interview error:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const displayItems = maxItems ? interviews.slice(0, maxItems) : interviews;
  const hasMore = maxItems && interviews.length > maxItems;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Interviews
          {interviews.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {interviews.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {interviews.length === 0 && !showAddForm && (
          <p className="text-xs text-muted-foreground py-2">Keine Interviews vorhanden</p>
        )}

        {displayItems.map((interview) => {
          const statusCfg = STATUS_CONFIG[interview.status || 'pending'] || STATUS_CONFIG.pending;
          const job = interview.submissions?.jobs;
          const typeName = interview.interview_type_id
            ? interviewTypes.find(t => t.id === interview.interview_type_id)?.name
            : null;

          return (
            <div key={interview.id} className="flex items-start gap-3 p-2.5 rounded-md border bg-card hover:bg-accent/30 transition-colors">
              <div className="mt-0.5">{getMeetingIcon(interview.meeting_type)}</div>
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">
                    {job?.title || 'Unbekannter Job'}
                  </span>
                  {job?.companies?.name && (
                    <span className="text-xs text-muted-foreground">@ {job.companies.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusCfg.className}`}>
                    {statusCfg.label}
                  </Badge>
                  {interview.pending_opt_in && (
                    <span className="text-[10px] text-blue-600">(Opt-In ausstehend)</span>
                  )}
                  {typeName && (
                    <span className="text-[10px] text-muted-foreground">• {typeName}</span>
                  )}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {interview.scheduled_at
                    ? format(new Date(interview.scheduled_at), 'dd.MM.yyyy, HH:mm', { locale: de })
                    : `Angefragt ${formatDistanceToNow(new Date(interview.created_at), { locale: de, addSuffix: true })}`}
                  {interview.duration_minutes && `, ${interview.duration_minutes} Min`}
                </div>
                {interview.notes && (
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{interview.notes}</p>
                )}
              </div>
            </div>
          );
        })}

        {hasMore && onViewAll && (
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={onViewAll}>
            Alle {interviews.length} anzeigen →
          </Button>
        )}

        {showAddForm && (
          <Collapsible open={formOpen} onOpenChange={setFormOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1">
                {formOpen ? <ChevronDown className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                Externes Interview eintragen
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-3">
              <div className="rounded-md border p-3 space-y-3 bg-muted/30">
                {activeSubmissions.length > 1 && (
                  <Select value={formSubmissionId} onValueChange={setFormSubmissionId}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Job auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {activeSubmissions.map((s: any) => (
                        <SelectItem key={s.id} value={s.id} className="text-xs">
                          {s.jobs?.title || 'Unbekannt'}{s.jobs?.companies?.name ? ` @ ${s.jobs.companies.name}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {activeSubmissions.length === 0 && (
                  <p className="text-xs text-muted-foreground">Keine aktive Bewerbung vorhanden.</p>
                )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block">Datum</label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] text-muted-foreground mb-1 block">Interview-Typ</label>
                    <Select value={formTypeId} onValueChange={setFormTypeId}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Optional..." />
                      </SelectTrigger>
                      <SelectContent>
                        {interviewTypes.map(t => (
                          <SelectItem key={t.id} value={t.id} className="text-xs">
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1 block">Notizen</label>
                  <Textarea
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Erstgespräch per Telefon geführt..."
                    className="text-xs min-h-[60px] resize-none"
                  />
                </div>
                <Button
                  size="sm"
                  className="w-full text-xs"
                  onClick={handleSave}
                  disabled={saving || !formSubmissionId || activeSubmissions.length === 0}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Speichern
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
