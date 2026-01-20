import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Flame,
  Zap,
  Circle,
  Building2,
  MapPin,
  Euro,
  Sparkles,
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  industry: string | null;
  fee_percentage: number | null;
  recruiter_fee_percentage: number | null;
  urgency: string | null;
  status: string | null;
}

interface JobApprovalDialogProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApproved: () => void;
}

export function JobApprovalDialog({ job, open, onOpenChange, onApproved }: JobApprovalDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [feePercentage, setFeePercentage] = useState(20);
  const [recruiterFeePercentage, setRecruiterFeePercentage] = useState(15);
  const [urgency, setUrgency] = useState<string>('standard');
  const [rejectionNotes, setRejectionNotes] = useState('');

  useEffect(() => {
    if (job) {
      setFeePercentage(job.fee_percentage || 20);
      setRecruiterFeePercentage(job.recruiter_fee_percentage || 15);
      setUrgency(job.urgency || 'standard');
    }
  }, [job]);

  const formatJobForRecruiters = async (jobId: string) => {
    setFormatting(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-job-for-recruiters', {
        body: { jobId }
      });

      if (error) throw error;
      return data?.formattedContent || null;
    } catch (error) {
      console.error('Error formatting job:', error);
      return null;
    } finally {
      setFormatting(false);
    }
  };

  const handleApprove = async () => {
    if (!job || !user) return;

    setLoading(true);
    try {
      // First, format the job content using AI
      const formattedContent = await formatJobForRecruiters(job.id);

      // Update job with approval data
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'published',
          fee_percentage: feePercentage,
          recruiter_fee_percentage: recruiterFeePercentage,
          urgency: urgency,
          approved_at: new Date().toISOString(),
          approved_by: user.id,
          formatted_content: formattedContent,
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Job genehmigt und veröffentlicht!');
      onApproved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error approving job:', error);
      toast.error('Fehler beim Genehmigen des Jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!job) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'draft',
          // Store rejection notes in briefing_notes for now
          briefing_notes: rejectionNotes ? `[ABGELEHNT] ${rejectionNotes}` : '[ABGELEHNT] Bitte überprüfen Sie die Stellendetails.',
        })
        .eq('id', job.id);

      if (error) throw error;

      toast.success('Job abgelehnt und an Kunden zurückgesendet');
      onApproved();
      onOpenChange(false);
    } catch (error) {
      console.error('Error rejecting job:', error);
      toast.error('Fehler beim Ablehnen des Jobs');
    } finally {
      setLoading(false);
    }
  };

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Nicht angegeben';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `Ab €${min.toLocaleString()}`;
    return `Bis €${max?.toLocaleString()}`;
  };

  const calculatePotentialEarning = () => {
    if (!job?.salary_min && !job?.salary_max) return null;
    const avgSalary = job.salary_min && job.salary_max 
      ? (job.salary_min + job.salary_max) / 2 
      : job.salary_min || job.salary_max;
    if (!avgSalary) return null;
    return Math.round(avgSalary * (recruiterFeePercentage / 100));
  };

  if (!job) return null;

  const potentialEarning = calculatePotentialEarning();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Job zur Genehmigung
          </DialogTitle>
          <DialogDescription>
            Prüfe die Stellendetails und lege die Konditionen für Recruiter fest
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Job Preview */}
          <Card className="bg-muted/30">
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-gradient-navy flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg">{job.title}</h3>
                  <p className="text-muted-foreground">{job.company_name}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {job.location}
                      </span>
                    )}
                    {job.remote_type && (
                      <Badge variant="secondary" className="capitalize text-xs">
                        {job.remote_type}
                      </Badge>
                    )}
                    {job.employment_type && (
                      <Badge variant="outline" className="capitalize text-xs">
                        {job.employment_type}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Gehalt</p>
                  <p className="font-semibold">{formatSalary(job.salary_min, job.salary_max)}</p>
                </div>
              </div>

              {/* Skills */}
              {job.skills && job.skills.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground mb-2">Skills:</p>
                  <div className="flex flex-wrap gap-1">
                    {job.skills.slice(0, 10).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {job.skills.length > 10 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{job.skills.length - 10}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Conditions Configuration */}
          <div className="space-y-6">
            <h4 className="font-semibold flex items-center gap-2">
              <Euro className="h-4 w-4" />
              Konditionen festlegen
            </h4>

            {/* Fee Percentage (Client pays) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Gesamtgebühr (Client zahlt)</Label>
                <span className="font-bold text-lg">{feePercentage}%</span>
              </div>
              <Slider
                value={[feePercentage]}
                onValueChange={(val) => setFeePercentage(val[0])}
                min={15}
                max={30}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Anteil vom Jahresgehalt, den der Kunde bei erfolgreicher Vermittlung zahlt
              </p>
            </div>

            {/* Recruiter Fee Percentage */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Recruiter-Anteil</Label>
                <span className="font-bold text-lg text-emerald">{recruiterFeePercentage}%</span>
              </div>
              <Slider
                value={[recruiterFeePercentage]}
                onValueChange={(val) => setRecruiterFeePercentage(val[0])}
                min={10}
                max={25}
                step={1}
                className="w-full"
              />
              {potentialEarning && (
                <p className="text-xs text-muted-foreground">
                  Recruiter verdient ca. <span className="font-semibold text-emerald">€{potentialEarning.toLocaleString()}</span> bei erfolgreicher Vermittlung
                </p>
              )}
            </div>

            {/* Urgency */}
            <div className="space-y-3">
              <Label>Dringlichkeit</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 text-muted-foreground" />
                      Standard
                    </div>
                  </SelectItem>
                  <SelectItem value="urgent">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3 w-3 text-warning" />
                      Urgent
                    </div>
                  </SelectItem>
                  <SelectItem value="hot">
                    <div className="flex items-center gap-2">
                      <Flame className="h-3 w-3 text-destructive" />
                      Hot
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Beeinflusst die Sichtbarkeit und Priorisierung für Recruiter
              </p>
            </div>
          </div>

          <Separator />

          {/* Rejection Notes (optional) */}
          <div className="space-y-3">
            <Label>Ablehnungsgrund (falls abgelehnt)</Label>
            <Textarea
              placeholder="Grund für die Ablehnung angeben (wird dem Kunden mitgeteilt)..."
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={loading || !rejectionNotes.trim()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Ablehnen
          </Button>
          <Button
            variant="emerald"
            onClick={handleApprove}
            disabled={loading || formatting}
          >
            {loading || formatting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {formatting ? 'Formatiere...' : 'Genehmige...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Genehmigen & Veröffentlichen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
