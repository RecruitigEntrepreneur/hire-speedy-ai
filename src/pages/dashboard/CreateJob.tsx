import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
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
  Building2
} from 'lucide-react';

export default function CreateJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('quick');
  const [loading, setLoading] = useState(false);
  
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
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (publish: boolean = false) => {
    if (!formData.title || !formData.company_name) {
      toast.error('Please fill in the required fields');
      return;
    }

    setLoading(true);
    try {
      const skillsArray = formData.skills
        ? formData.skills.split(',').map(s => s.trim()).filter(Boolean)
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
          status: publish ? 'published' : 'draft',
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(publish ? 'Job published successfully!' : 'Job saved as draft');
      navigate(`/dashboard/jobs/${data.id}`);
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create job. Please try again.');
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
              Back
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Post a New Job</h1>
            <p className="text-muted-foreground">Create a job posting in under 60 seconds</p>
          </div>

          {/* Tabs for different upload methods */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="quick" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Quick Form
              </TabsTrigger>
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Job URL
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload PDF
              </TabsTrigger>
            </TabsList>

            {/* Quick Form */}
            <TabsContent value="quick" className="space-y-6 mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>Essential details about the position</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="title">Job Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Senior Software Engineer"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name *</Label>
                      <Input
                        id="company_name"
                        placeholder="e.g., Acme Inc."
                        value={formData.company_name}
                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Job Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe the role, responsibilities, and what makes it exciting..."
                      rows={5}
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
                      id="requirements"
                      placeholder="List the qualifications, experience, and skills required..."
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
                    Location & Type
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="e.g., Berlin, Germany"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Remote Type</Label>
                      <Select
                        value={formData.remote_type}
                        onValueChange={(value) => handleInputChange('remote_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="onsite">On-site</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="remote">Remote</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Employment Type</Label>
                      <Select
                        value={formData.employment_type}
                        onValueChange={(value) => handleInputChange('employment_type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="freelance">Freelance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Experience Level</Label>
                      <Select
                        value={formData.experience_level}
                        onValueChange={(value) => handleInputChange('experience_level', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior">Junior (0-2 years)</SelectItem>
                          <SelectItem value="mid">Mid-level (2-5 years)</SelectItem>
                          <SelectItem value="senior">Senior (5-8 years)</SelectItem>
                          <SelectItem value="lead">Lead/Principal (8+ years)</SelectItem>
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
                    Compensation & Skills
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="salary_min">Minimum Salary (€)</Label>
                      <Input
                        id="salary_min"
                        type="number"
                        placeholder="e.g., 50000"
                        value={formData.salary_min}
                        onChange={(e) => handleInputChange('salary_min', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salary_max">Maximum Salary (€)</Label>
                      <Input
                        id="salary_max"
                        type="number"
                        placeholder="e.g., 80000"
                        value={formData.salary_max}
                        onChange={(e) => handleInputChange('salary_max', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="skills">Required Skills</Label>
                    <Input
                      id="skills"
                      placeholder="e.g., React, TypeScript, Node.js (comma separated)"
                      value={formData.skills}
                      onChange={(e) => handleInputChange('skills', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Separate skills with commas</p>
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
                  Save as Draft
                </Button>
                <Button
                  variant="hero"
                  onClick={() => handleSubmit(true)}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Publish Job
                </Button>
              </div>
            </TabsContent>

            {/* URL Import */}
            <TabsContent value="url" className="mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Import from Job URL</CardTitle>
                  <CardDescription>Paste a link to an existing job posting and we'll extract the details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jobUrl">Job Posting URL</Label>
                    <Input
                      id="jobUrl"
                      type="url"
                      placeholder="https://careers.example.com/job/123"
                    />
                  </div>
                  <Button variant="hero">
                    <Zap className="mr-2 h-4 w-4" />
                    Extract Job Details
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Our AI will analyze the page and extract job details automatically.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PDF Upload */}
            <TabsContent value="upload" className="mt-6">
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle>Upload Job Description</CardTitle>
                  <CardDescription>Upload a PDF or Word document with the job details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-semibold">Drop your file here</h3>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                    <p className="text-xs text-muted-foreground mt-2">PDF, DOC, DOCX up to 10MB</p>
                    <Button variant="outline" className="mt-4">
                      Select File
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DashboardLayout>
    </div>
  );
}
