import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useClientVerification } from '@/hooks/useClientVerification';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Link2, 
  FileText, 
  Zap, 
  ArrowLeft, 
  Loader2,
  MapPin,
  Building2,
  Sparkles,
  CheckCircle2,
  Home,
  Calendar,
  Upload,
  FileUp
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useJobParsing, ParsedJobData } from '@/hooks/useJobParsing';
import { useJobPdfParsing, ParsedJobProfile } from '@/hooks/useJobPdfParsing';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export default function CreateJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { parseJobUrl, parseJobText, parsing } = useJobParsing();
  const { uploadAndParsePdf, parseJobText: parseJobPdfText, isLoading: pdfParsing } = useJobPdfParsing();
  const { canPublishJobs, isFullyVerified, loading: verificationLoading } = useClientVerification();
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [jobTextInput, setJobTextInput] = useState('');
  const [importedData, setImportedData] = useState<ParsedJobData | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    company_name: '',
    description: '',
    requirements: '',
    location: '',
    remote_type: 'hybrid',
    employment_type: 'full-time',
    experience_level: 'mid',
    salary_min: '',
    salary_max: '',
    skills: '',
    must_haves: '',
    nice_to_haves: '',
    // Remote-Policy Felder
    office_address: '',
    remote_policy: 'hybrid',
    onsite_days_required: '3',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyParsedData = (data: ParsedJobData) => {
    setFormData(prev => ({
      ...prev,
      title: data.title || '',
      company_name: data.company_name || '',
      description: data.description || '',
      requirements: data.requirements || '',
      location: data.location || '',
      remote_type: data.remote_type || 'hybrid',
      employment_type: data.employment_type || 'full-time',
      experience_level: data.experience_level || 'mid',
      salary_min: data.salary_min?.toString() || '',
      salary_max: data.salary_max?.toString() || '',
      skills: data.skills?.join(', ') || '',
      must_haves: data.must_haves?.join(', ') || '',
      nice_to_haves: data.nice_to_haves?.join(', ') || '',
    }));
    setImportedData(data);
    setActiveTab('quick');
  };

  const handleImportFromUrl = async () => {
    if (!jobUrl.trim()) {
      toast.error('Bitte gib eine URL ein');
      return;
    }

    const data = await parseJobUrl(jobUrl);
    if (data) {
      applyParsedData(data);
      toast.success('Job erfolgreich importiert!');
    }
  };

  const handleImportFromText = async () => {
    if (!jobTextInput.trim()) {
      toast.error('Bitte füge den Stellentext ein');
      return;
    }

    const data = await parseJobPdfText(jobTextInput);
    if (data) {
      applyParsedJobProfile(data);
      toast.success('Job erfolgreich analysiert!');
    }
  };

  const handleFileUpload = async (file: File) => {
    const data = await uploadAndParsePdf(file);
    if (data) {
      applyParsedJobProfile(data);
      toast.success('PDF erfolgreich analysiert!');
    }
  };

  const applyParsedJobProfile = (data: ParsedJobProfile) => {
    setFormData(prev => ({
      ...prev,
      title: data.title || '',
      company_name: data.company || '',
      description: data.description || '',
      requirements: data.requirements?.join('\n') || '',
      location: data.location || '',
      remote_type: data.remote_policy === 'remote' ? 'remote' : data.remote_policy === 'onsite' ? 'onsite' : 'hybrid',
      employment_type: data.employment_type || 'full-time',
      experience_level: data.seniority_level === 'junior' ? 'junior' : data.seniority_level === 'senior' ? 'senior' : data.seniority_level === 'lead' || data.seniority_level === 'principal' || data.seniority_level === 'director' ? 'lead' : 'mid',
      salary_min: data.salary_min?.toString() || '',
      salary_max: data.salary_max?.toString() || '',
      skills: data.technical_skills?.join(', ') || '',
      must_haves: data.requirements?.join(', ') || '',
      nice_to_haves: data.nice_to_have?.join(', ') || '',
    }));
    setImportedData({
      title: data.title,
      company_name: data.company,
      description: data.description,
      requirements: data.requirements?.join('\n') || '',
      location: data.location,
      remote_type: data.remote_policy,
      employment_type: data.employment_type,
      experience_level: data.seniority_level,
      salary_min: data.salary_min,
      salary_max: data.salary_max,
      skills: data.technical_skills,
      must_haves: data.requirements,
      nice_to_haves: data.nice_to_have,
    });
    setActiveTab('quick');
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        handleFileUpload(file);
      } else {
        toast.error('Bitte nur PDF-Dateien hochladen');
      }
    }
  }, []);

  const handleSubmit = async (publish: boolean = false) => {
    if (!formData.title || !formData.company_name) {
      toast.error('Bitte fülle die Pflichtfelder aus');
      return;
    }

    // Check verification before publishing
    if (publish && !canPublishJobs) {
      toast.error('Bitte schließe zuerst die Verifizierung ab, um Jobs zu veröffentlichen');
      navigate('/onboarding');
      return;
    }

    setLoading(true);
    try {
      const skillsArray = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const mustHavesArray = formData.must_haves
        ? formData.must_haves.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const niceToHavesArray = formData.nice_to_haves
        ? formData.nice_to_haves.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          client_id: user?.id,
          title: formData.title,
          company_name: formData.company_name,
          description: formData.description,
          requirements: formData.requirements,
          location: formData.location,
          remote_type: formData.remote_type,
          employment_type: formData.employment_type,
          experience_level: formData.experience_level,
          salary_min: formData.salary_min ? parseInt(formData.salary_min) : null,
          salary_max: formData.salary_max ? parseInt(formData.salary_max) : null,
          skills: skillsArray,
          must_haves: mustHavesArray,
          nice_to_haves: niceToHavesArray,
          status: publish ? 'pending_approval' : 'draft',
          office_address: formData.office_address || null,
          remote_policy: formData.remote_policy || null,
          onsite_days_required: formData.remote_policy === 'hybrid' ? parseInt(formData.onsite_days_required) : null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(publish ? 'Job zur Prüfung eingereicht!' : 'Job als Entwurf gespeichert');
      navigate(`/dashboard/jobs/${data.id}`);
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Fehler beim Erstellen des Jobs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Neue Stelle erstellen</h1>
            <p className="text-muted-foreground">Erstelle eine Stellenanzeige in unter 60 Sekunden</p>
          </div>

          {/* Verification Warning */}
          {!verificationLoading && !canPublishJobs && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Verifizierung erforderlich</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Um Jobs zu veröffentlichen, musst du zuerst die Unternehmensverifizierung abschließen.
                </span>
                <Button variant="outline" size="sm" asChild className="ml-4">
                  <Link to="/onboarding">Jetzt verifizieren</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Success Banner */}
          {importedData && (
            <Card className="border-emerald/30 bg-emerald/5">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald" />
                  <div className="flex-1">
                    <p className="font-medium">Job erfolgreich importiert</p>
                    <p className="text-sm text-muted-foreground">
                      {importedData.skills?.length || 0} Skills, {importedData.must_haves?.length || 0} Must-Haves erkannt
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setImportedData(null)}>
                    Schließen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for different upload methods */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Formular
              </TabsTrigger>
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                URL Import
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Text/PDF
              </TabsTrigger>
            </TabsList>

            {/* Quick Form */}
            <TabsContent value="quick" className="space-y-6 mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Grundinformationen
                  </CardTitle>
                  <CardDescription>Wesentliche Details zur Position</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Jobtitel *</Label>
                      <Input
                        id="title"
                        placeholder="z.B. Senior Software Engineer"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Firmenname *</Label>
                      <Input
                        id="company_name"
                        placeholder="z.B. Acme GmbH"
                        value={formData.company_name}
                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Stellenbeschreibung</Label>
                    <Textarea
                      id="description"
                      placeholder="Beschreibe die Rolle, Verantwortlichkeiten und was sie besonders macht..."
                      rows={5}
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requirements">Anforderungen</Label>
                    <Textarea
                      id="requirements"
                      placeholder="Liste die Qualifikationen, Erfahrung und erforderlichen Skills auf..."
                      rows={4}
                      value={formData.requirements}
                      onChange={(e) => handleInputChange('requirements', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Standort & Arbeitsmodell
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="location">Standort</Label>
                      <Input
                        id="location"
                        placeholder="z.B. Berlin, Deutschland"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Remote-Modell</Label>
                      <Select
                        value={formData.remote_type}
                        onValueChange={(value) => handleInputChange('remote_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onsite">Vor Ort</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Anstellungsart</Label>
                      <Select
                        value={formData.employment_type}
                        onValueChange={(value) => handleInputChange('employment_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Vollzeit</SelectItem>
                          <SelectItem value="part-time">Teilzeit</SelectItem>
                          <SelectItem value="contract">Befristet</SelectItem>
                          <SelectItem value="freelance">Freelance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Erfahrungslevel</Label>
                      <Select
                        value={formData.experience_level}
                        onValueChange={(value) => handleInputChange('experience_level', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior">Junior (0-2 Jahre)</SelectItem>
                          <SelectItem value="mid">Mid-Level (2-5 Jahre)</SelectItem>
                          <SelectItem value="senior">Senior (5-8 Jahre)</SelectItem>
                          <SelectItem value="lead">Lead/Principal (8+ Jahre)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Remote-Policy Section */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Remote-Policy & Büro
                  </CardTitle>
                  <CardDescription>Legen Sie fest, wie viele Tage vor Ort gearbeitet werden müssen</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Remote-Policy</Label>
                      <Select
                        value={formData.remote_policy}
                        onValueChange={(value) => handleInputChange('remote_policy', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_remote">Vollständig Remote</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="onsite_only">Nur vor Ort</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="office_address">Büro-Adresse</Label>
                      <Input
                        id="office_address"
                        placeholder="z.B. Friedrichstraße 123, 10117 Berlin"
                        value={formData.office_address}
                        onChange={(e) => handleInputChange('office_address', e.target.value)}
                      />
                    </div>
                  </div>

                  {formData.remote_policy === 'hybrid' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Pflicht-Tage vor Ort pro Woche
                        </Label>
                        <span className="text-sm font-medium">
                          {formData.onsite_days_required} Tag{parseInt(formData.onsite_days_required) !== 1 ? 'e' : ''}
                        </span>
                      </div>
                      <Slider
                        value={[parseInt(formData.onsite_days_required) || 0]}
                        onValueChange={([value]) => handleInputChange('onsite_days_required', value.toString())}
                        min={0}
                        max={5}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0 (sehr flexibel)</span>
                        <span>3 (Standard)</span>
                        <span>5 (täglich)</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Gehalt & Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="salary_min">Minimum Gehalt (€)</Label>
                      <Input
                        id="salary_min"
                        type="number"
                        placeholder="z.B. 50000"
                        value={formData.salary_min}
                        onChange={(e) => handleInputChange('salary_min', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary_max">Maximum Gehalt (€)</Label>
                      <Input
                        id="salary_max"
                        type="number"
                        placeholder="z.B. 80000"
                        value={formData.salary_max}
                        onChange={(e) => handleInputChange('salary_max', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skills">Erforderliche Skills</Label>
                    <Input
                      id="skills"
                      placeholder="z.B. React, TypeScript, Node.js (kommagetrennt)"
                      value={formData.skills}
                      onChange={(e) => handleInputChange('skills', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Skills mit Komma trennen</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="must_haves">Must-Haves</Label>
                    <Input
                      id="must_haves"
                      placeholder="z.B. 5+ Jahre Erfahrung, Bachelor, Deutsch fließend"
                      value={formData.must_haves}
                      onChange={(e) => handleInputChange('must_haves', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Zwingende Anforderungen (kommagetrennt)</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nice_to_haves">Nice-to-Haves</Label>
                    <Input
                      id="nice_to_haves"
                      placeholder="z.B. AWS Zertifizierung, Startup-Erfahrung"
                      value={formData.nice_to_haves}
                      onChange={(e) => handleInputChange('nice_to_haves', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Optionale Pluspunkte (kommagetrennt)</p>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-end">
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Als Entwurf speichern
                </Button>
                <Button
                  variant="hero"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Zur Prüfung einreichen
                </Button>
              </div>
            </TabsContent>

            {/* URL Import */}
            <TabsContent value="url" className="mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    KI-Import von Job-URL
                  </CardTitle>
                  <CardDescription>Füge einen Link zu einer bestehenden Stellenanzeige ein</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobUrl">URL zur Stellenanzeige</Label>
                    <Input
                      id="jobUrl"
                      type="url"
                      placeholder="https://careers.example.com/jobs/123"
                      value={jobUrl}
                      onChange={(e) => setJobUrl(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="hero" 
                    onClick={handleImportFromUrl}
                    disabled={parsing || !jobUrl.trim()}
                    className="w-full"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analysiere Seite...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Job-Details extrahieren
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Unsere KI analysiert die Seite und extrahiert automatisch: Titel, Beschreibung, Anforderungen, Skills, Gehalt und mehr.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PDF Upload / Text Paste */}
            <TabsContent value="upload" className="mt-6 space-y-6">
              {/* PDF Upload Card */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileUp className="h-5 w-5 text-primary" />
                    PDF hochladen
                  </CardTitle>
                  <CardDescription>
                    Lade eine Stellenanzeige als PDF hoch (z.B. Export aus SAP, Personio, Workday)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      dragActive 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      disabled={pdfParsing}
                    />
                    <div className="flex flex-col items-center gap-3">
                      {pdfParsing ? (
                        <>
                          <Loader2 className="h-10 w-10 text-primary animate-spin" />
                          <div>
                            <p className="font-medium">Analysiere PDF...</p>
                            <p className="text-sm text-muted-foreground">Die KI extrahiert alle Stelleninformationen</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-muted-foreground" />
                          <div>
                            <p className="font-medium">PDF hier ablegen oder klicken</p>
                            <p className="text-sm text-muted-foreground">PDF • Max 20MB</p>
                          </div>
                          <Badge variant="secondary" className="mt-2">
                            HR-System Export? Wird unterstützt!
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">oder Text einfügen</span>
                </div>
              </div>

              {/* Text Input Card */}
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Stellentext eingeben
                  </CardTitle>
                  <CardDescription>
                    Kopiere den Stellentext direkt hier ein
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    placeholder="Füge hier den vollständigen Stellentext ein..."
                    rows={8}
                    value={jobTextInput}
                    onChange={(e) => setJobTextInput(e.target.value)}
                  />
                  <Button 
                    variant="hero" 
                    onClick={handleImportFromText}
                    disabled={pdfParsing || !jobTextInput.trim()}
                    className="w-full"
                  >
                    {pdfParsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analysiere Text...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Mit KI analysieren
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
  );
}
