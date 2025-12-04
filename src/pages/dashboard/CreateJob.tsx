import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useClientVerification } from '@/hooks/useClientVerification';
import { Navbar } from '@/components/layout/Navbar';
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
  Briefcase,
  MapPin,
  DollarSign,
  Building2,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import { useJobParsing, ParsedJobData } from '@/hooks/useJobParsing';
import { Badge } from '@/components/ui/badge';
import { FileUpload } from '@/components/files/FileUpload';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert } from 'lucide-react';

export default function CreateJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { parseJobUrl, parseJobText, parsing } = useJobParsing();
  const { canPublishJobs, isFullyVerified, loading: verificationLoading } = useClientVerification();
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState(false);
  const [jobUrl, setJobUrl] = useState('');
  const [jobPdfText, setJobPdfText] = useState('');
  const [importedData, setImportedData] = useState<ParsedJobData | null>(null);
  
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
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyParsedData = (data: ParsedJobData) => {
    setFormData({
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
    });
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

  const handleImportFromPdf = async () => {
    if (!jobPdfText.trim()) {
      toast.error('Bitte füge den Stellentext ein');
      return;
    }

    const data = await parseJobText(jobPdfText);
    if (data) {
      applyParsedData(data);
      toast.success('Job erfolgreich analysiert!');
    }
  };

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
          status: publish ? 'published' : 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(publish ? 'Job veröffentlicht!' : 'Job als Entwurf gespeichert');
      navigate(`/dashboard/jobs/${data.id}`);
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Fehler beim Erstellen des Jobs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
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

              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
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
                  Job veröffentlichen
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
            <TabsContent value="upload" className="mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    KI-Analyse von Stellentext
                  </CardTitle>
                  <CardDescription>Füge den Stellentext ein oder lade ein Dokument hoch</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobText">Stellenbeschreibung (Text)</Label>
                    <Textarea
                      id="jobText"
                      placeholder="Kopiere hier den vollständigen Stellentext ein..."
                      rows={10}
                      value={jobPdfText}
                      onChange={(e) => setJobPdfText(e.target.value)}
                    />
                  </div>
                  <Button 
                    variant="hero" 
                    onClick={handleImportFromPdf}
                    disabled={parsing || !jobPdfText.trim()}
                    className="w-full"
                  >
                    {parsing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analysiere Text...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Text analysieren & Felder ausfüllen
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Die KI extrahiert automatisch alle relevanten Informationen aus dem Text.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </div>
  );
}
