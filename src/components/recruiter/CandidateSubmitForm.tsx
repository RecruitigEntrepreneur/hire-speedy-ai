import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  UserPlus,
  Shield,
  Sparkles,
  Wand2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FileUpload } from '@/components/files/FileUpload';
import { useMatchScoreV31 } from '@/hooks/useMatchScoreV31';
import { useCvParsing, ParsedCVData } from '@/hooks/useCvParsing';

interface CandidateSubmitFormProps {
  jobId: string;
  jobTitle: string;
  mustHaves?: string[];
  onSuccess: () => void;
}

interface ExistingCandidate {
  id: string;
  full_name: string;
  email: string;
  skills: string[];
}

export function CandidateSubmitForm({ jobId, jobTitle, mustHaves = [], onSuccess }: CandidateSubmitFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { calculateSingleMatch, loading: matchLoading } = useMatchScoreV31();
  const { parseCV, parsing: cvParsing } = useCvParsing();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingCandidates, setExistingCandidates] = useState<ExistingCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [skillsMatch, setSkillsMatch] = useState<{ matched: string[]; missing: string[] }>({ matched: [], missing: [] });
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [cvTextForParsing, setCvTextForParsing] = useState('');
  const [showCvParser, setShowCvParser] = useState(false);

  // New candidate form
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    linkedin_url: '',
    cv_url: '',
    current_salary: '',
    expected_salary: '',
    notice_period: '',
    availability_date: '',
    skills: '',
    summary: ''
  });

  const [recruiterNotes, setRecruiterNotes] = useState('');
  const [gdprConsent, setGdprConsent] = useState(false);

  const handleCvUpload = (url: string) => {
    setFormData({ ...formData, cv_url: url });
  };

  const handleParseCv = async () => {
    if (!cvTextForParsing.trim()) {
      toast({
        title: 'Kein Text',
        description: 'Bitte füge den CV-Text ein oder lade einen CV hoch.',
        variant: 'destructive'
      });
      return;
    }

    const parsedData = await parseCV(cvTextForParsing);
    if (parsedData) {
      applyParsedCvData(parsedData);
      setShowCvParser(false);
      setCvTextForParsing('');
    }
  };

  const applyParsedCvData = (data: ParsedCVData) => {
    const skillNames = data.skills?.map(s => s.name) || [];
    
    setFormData(prev => ({
      ...prev,
      full_name: data.full_name || prev.full_name,
      email: data.email || prev.email,
      phone: data.phone || prev.phone,
      linkedin_url: data.linkedin_url || prev.linkedin_url,
      current_salary: data.current_salary?.toString() || prev.current_salary,
      expected_salary: data.salary_expectation_max?.toString() || prev.expected_salary,
      notice_period: data.notice_period || prev.notice_period,
      skills: skillNames.join(', ') || prev.skills,
      summary: data.cv_ai_summary || prev.summary
    }));

    // Update skills match
    if (skillNames.length > 0) {
      checkSkillsMatch(skillNames);
    }

    // Check for duplicate
    if (data.email) {
      checkDuplicate(data.email);
    }

    toast({
      title: 'CV analysiert',
      description: `${data.skills?.length || 0} Skills erkannt, Daten übernommen.`
    });
  };

  useEffect(() => {
    fetchExistingCandidates();
  }, []);

  const fetchExistingCandidates = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('candidates')
      .select('id, full_name, email, skills')
      .eq('recruiter_id', user.id)
      .order('created_at', { ascending: false });

    setExistingCandidates(data || []);
  };

  const checkDuplicate = async (email: string) => {
    if (!email) return;
    setChecking(true);

    // Check if this candidate was already submitted for this job
    const { data: existingSub } = await supabase
      .from('submissions')
      .select(`
        id,
        candidates (email)
      `)
      .eq('job_id', jobId);

    const alreadySubmitted = existingSub?.some(
      (sub: any) => sub.candidates?.email?.toLowerCase() === email.toLowerCase()
    );

    if (alreadySubmitted) {
      setDuplicateWarning('Dieser Kandidat wurde bereits für diesen Job eingereicht.');
    } else {
      setDuplicateWarning(null);
    }

    setChecking(false);
  };

  const checkSkillsMatch = (candidateSkills: string[]) => {
    if (!mustHaves || mustHaves.length === 0) {
      setSkillsMatch({ matched: [], missing: [] });
      return;
    }

    const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase());
    const matched: string[] = [];
    const missing: string[] = [];

    mustHaves.forEach(mh => {
      if (normalizedCandidateSkills.some(cs => cs.includes(mh.toLowerCase()) || mh.toLowerCase().includes(cs))) {
        matched.push(mh);
      } else {
        missing.push(mh);
      }
    });

    setSkillsMatch({ matched, missing });
  };

  const handleCandidateSelect = (candidateId: string) => {
    setSelectedCandidate(candidateId);
    setCreateNew(false);
    
    const candidate = existingCandidates.find(c => c.id === candidateId);
    if (candidate) {
      checkDuplicate(candidate.email);
      checkSkillsMatch(candidate.skills || []);
    }
  };

  const handleEmailBlur = () => {
    if (formData.email) {
      checkDuplicate(formData.email);
    }
  };

  const handleSkillsChange = (value: string) => {
    setFormData({ ...formData, skills: value });
    const skillsArray = value.split(',').map(s => s.trim()).filter(Boolean);
    checkSkillsMatch(skillsArray);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (duplicateWarning) {
      toast({
        title: 'Einreichung nicht möglich',
        description: duplicateWarning,
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);

    try {
      let candidateId = selectedCandidate;

      // Create new candidate if needed
      if (createNew) {
        const skillsArray = formData.skills.split(',').map(s => s.trim()).filter(Boolean);
        
        const { data: newCandidate, error: candidateError } = await supabase
          .from('candidates')
          .insert({
            recruiter_id: user.id,
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || null,
            linkedin_url: formData.linkedin_url || null,
            cv_url: formData.cv_url || null,
            current_salary: formData.current_salary ? parseInt(formData.current_salary) : null,
            expected_salary: formData.expected_salary ? parseInt(formData.expected_salary) : null,
            notice_period: formData.notice_period || null,
            availability_date: formData.availability_date || null,
            skills: skillsArray,
            summary: formData.summary || null
          })
          .select()
          .single();

        if (candidateError) throw candidateError;
        candidateId = newCandidate.id;
      }

      if (!candidateId) {
        toast({
          title: 'Fehler',
          description: 'Bitte wähle einen Kandidaten aus oder erstelle einen neuen.',
          variant: 'destructive'
        });
        setLoading(false);
        return;
      }

      // Create submission with GDPR consent
      const { error: submissionError } = await supabase
        .from('submissions')
        .insert({
          job_id: jobId,
          candidate_id: candidateId,
          recruiter_id: user.id,
          recruiter_notes: recruiterNotes || null,
          status: 'submitted',
          consent_confirmed: gdprConsent,
          consent_confirmed_at: gdprConsent ? new Date().toISOString() : null,
        });

      if (submissionError) throw submissionError;

      // Calculate AI match score in background
      setCalculatingScore(true);
      try {
        const matchResult = await calculateSingleMatch(candidateId, jobId);
        if (matchResult) {
          toast({
            title: 'Erfolgreich eingereicht!',
            description: `Der Kandidat wurde mit ${matchResult.overall}% Match-Score für "${jobTitle}" eingereicht.`
          });
        } else {
          toast({
            title: 'Erfolgreich eingereicht!',
            description: `Der Kandidat wurde für "${jobTitle}" eingereicht. Match-Score wird berechnet...`
          });
        }
      } catch {
        toast({
          title: 'Erfolgreich eingereicht!',
          description: `Der Kandidat wurde für "${jobTitle}" eingereicht.`
        });
      } finally {
        setCalculatingScore(false);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting candidate:', error);
      toast({
        title: 'Fehler',
        description: error.message || 'Es ist ein Fehler aufgetreten.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Candidate Selection */}
      <div className="space-y-4">
        <Label>Kandidat auswählen</Label>
        
        {existingCandidates.length > 0 && !createNew && (
          <Select value={selectedCandidate || ''} onValueChange={handleCandidateSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Bestehenden Kandidaten wählen..." />
            </SelectTrigger>
            <SelectContent>
              {existingCandidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.full_name} ({candidate.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button 
          type="button" 
          variant={createNew ? "default" : "outline"} 
          className="w-full"
          onClick={() => {
            setCreateNew(!createNew);
            setSelectedCandidate(null);
            setDuplicateWarning(null);
            setSkillsMatch({ matched: [], missing: [] });
          }}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {createNew ? 'Bestehenden wählen' : 'Neuen Kandidaten anlegen'}
        </Button>
      </div>

      {/* New Candidate Form */}
      {createNew && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Neuer Kandidat</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCvParser(!showCvParser)}
              className="gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {showCvParser ? 'Parser schließen' : 'CV mit KI analysieren'}
            </Button>
          </div>

          {/* CV Parser Section */}
          {showCvParser && (
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                KI CV-Analyse
              </div>
              <Textarea
                placeholder="CV-Text hier einfügen (Name, Kontakt, Skills, Erfahrung, etc.)..."
                value={cvTextForParsing}
                onChange={(e) => setCvTextForParsing(e.target.value)}
                rows={6}
                className="text-sm"
              />
              <Button
                type="button"
                onClick={handleParseCv}
                disabled={cvParsing || !cvTextForParsing.trim()}
                className="w-full"
              >
                {cvParsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analysiere CV...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    CV analysieren & Felder ausfüllen
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Die KI extrahiert automatisch: Name, Kontakt, Skills, Gehalt, Kündigungsfrist und mehr.
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                onBlur={handleEmailBlur}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                value={formData.linkedin_url}
                onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
          </div>

          <FileUpload
            label="Lebenslauf (CV)"
            folder="candidates"
            accept=".pdf,.doc,.docx"
            maxSize={10}
            onUploadComplete={handleCvUpload}
            existingUrl={formData.cv_url || undefined}
          />

          <div className="space-y-2">
            <Label htmlFor="cv_url">Oder CV URL / Link</Label>
            <Input
              id="cv_url"
              value={formData.cv_url}
              onChange={(e) => setFormData({ ...formData, cv_url: e.target.value })}
              placeholder="Link zum CV oder Portfolio"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="current_salary">Aktuelles Gehalt (€)</Label>
              <Input
                id="current_salary"
                type="number"
                value={formData.current_salary}
                onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_salary">Gehaltsvorstellung (€)</Label>
              <Input
                id="expected_salary"
                type="number"
                value={formData.expected_salary}
                onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="notice_period">Kündigungsfrist</Label>
              <Select 
                value={formData.notice_period} 
                onValueChange={(value) => setFormData({ ...formData, notice_period: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="immediate">Sofort verfügbar</SelectItem>
                  <SelectItem value="2_weeks">2 Wochen</SelectItem>
                  <SelectItem value="1_month">1 Monat</SelectItem>
                  <SelectItem value="2_months">2 Monate</SelectItem>
                  <SelectItem value="3_months">3 Monate</SelectItem>
                  <SelectItem value="6_months">6 Monate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="availability_date">Verfügbar ab</Label>
              <Input
                id="availability_date"
                type="date"
                value={formData.availability_date}
                onChange={(e) => setFormData({ ...formData, availability_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="skills">Skills (kommagetrennt)</Label>
            <Input
              id="skills"
              value={formData.skills}
              onChange={(e) => handleSkillsChange(e.target.value)}
              placeholder="z.B. React, TypeScript, Node.js"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Kurzprofil / Zusammenfassung</Label>
            <Textarea
              id="summary"
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      )}

      {/* Duplicate Warning */}
      {duplicateWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{duplicateWarning}</AlertDescription>
        </Alert>
      )}

      {/* Skills Match */}
      {mustHaves.length > 0 && (skillsMatch.matched.length > 0 || skillsMatch.missing.length > 0) && (
        <div className="space-y-2">
          <Label>Skills-Match</Label>
          <div className="flex flex-wrap gap-2">
            {skillsMatch.matched.map((skill) => (
              <Badge key={skill} className="bg-emerald/10 text-emerald border-emerald/20">
                <CheckCircle2 className="h-3 w-3 mr-1" /> {skill}
              </Badge>
            ))}
            {skillsMatch.missing.map((skill) => (
              <Badge key={skill} variant="outline" className="text-destructive border-destructive/30">
                <XCircle className="h-3 w-3 mr-1" /> {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Recruiter Notes */}
      <div className="space-y-2">
        <Label htmlFor="recruiter_notes">Warum passt der Kandidat? *</Label>
        <Textarea
          id="recruiter_notes"
          value={recruiterNotes}
          onChange={(e) => setRecruiterNotes(e.target.value)}
          rows={4}
          placeholder="Beschreibe, warum dieser Kandidat gut für die Position geeignet ist..."
          required
        />
      </div>

      {/* GDPR Consent - Required for Triple-Blind Mode */}
      <Alert className="border-primary/30 bg-primary/5">
        <Shield className="h-4 w-4 text-primary" />
        <AlertDescription>
          <div className="flex items-start gap-3 mt-1">
            <Checkbox 
              id="gdpr_consent"
              checked={gdprConsent}
              onCheckedChange={(checked) => setGdprConsent(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="gdpr_consent" className="text-sm cursor-pointer">
              Ich bestätige, dass ich die ausdrückliche Einwilligung des Kandidaten zur Weitergabe seiner Daten habe (DSGVO Art. 6).
            </label>
          </div>
        </AlertDescription>
      </Alert>

      {/* Submit Button */}
      <Button 
        type="submit" 
        className="w-full" 
        disabled={loading || checking || (!selectedCandidate && !createNew) || !gdprConsent}
      >
        {loading || calculatingScore ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            {calculatingScore ? 'Match-Score wird berechnet...' : 'Wird eingereicht...'}
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Kandidat einreichen
          </>
        )}
      </Button>
    </form>
  );
}
