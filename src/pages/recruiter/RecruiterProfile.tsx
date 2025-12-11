import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2,
  User,
  Building2,
  FileText,
  Shield,
  CreditCard,
  TrendingUp,
  Clock,
  Target,
  Award,
  Save,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  full_name: string;
  email: string;
  phone: string;
  company_name: string;
  company_address: string;
  bank_iban: string;
  bank_bic: string;
  tax_id: string;
  avatar_url: string;
}

interface RecruiterStats {
  totalSubmissions: number;
  interviewRate: number;
  placementRate: number;
  avgResponseTime: number;
}

interface Document {
  id: string;
  document_type: string;
  is_accepted: boolean;
  accepted_at: string | null;
}

export default function RecruiterProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<RecruiterStats>({
    totalSubmissions: 0,
    interviewRate: 0,
    placementRate: 0,
    avgResponseTime: 0
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setProfile(profileData);
      }

      // Fetch documents
      const { data: docsData } = await supabase
        .from('recruiter_documents')
        .select('*')
        .eq('recruiter_id', user?.id);

      setDocuments(docsData || []);

      // Calculate stats
      const { data: submissions } = await supabase
        .from('submissions')
        .select('status, submitted_at')
        .eq('recruiter_id', user?.id);

      if (submissions && submissions.length > 0) {
        const total = submissions.length;
        const interviewed = submissions.filter(s => 
          ['interview_scheduled', 'interviewed', 'offer', 'hired'].includes(s.status)
        ).length;
        const placed = submissions.filter(s => s.status === 'hired').length;

        setStats({
          totalSubmissions: total,
          interviewRate: Math.round((interviewed / total) * 100),
          placementRate: Math.round((placed / total) * 100),
          avgResponseTime: 2.4 // Placeholder - would need activity logs to calculate
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
          company_name: profile.company_name,
          company_address: profile.company_address,
          bank_iban: profile.bank_iban,
          bank_bic: profile.bank_bic,
          tax_id: profile.tax_id
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Profil gespeichert!' });
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: 'Fehler',
        description: 'Profil konnte nicht gespeichert werden.',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptDocument = async (type: string) => {
    if (!user) return;

    try {
      // Check if document exists
      const existing = documents.find(d => d.document_type === type);

      if (existing) {
        await supabase
          .from('recruiter_documents')
          .update({ is_accepted: true, accepted_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('recruiter_documents')
          .insert({
            recruiter_id: user.id,
            document_type: type,
            is_accepted: true,
            accepted_at: new Date().toISOString()
          });
      }

      // Refresh documents
      const { data: docsData } = await supabase
        .from('recruiter_documents')
        .select('*')
        .eq('recruiter_id', user.id);

      setDocuments(docsData || []);
      toast({ title: `${type} akzeptiert!` });
    } catch (error) {
      console.error('Error accepting document:', error);
    }
  };

  const isDocumentAccepted = (type: string) => {
    return documents.some(d => d.document_type === type && d.is_accepted);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Profil & Compliance</h1>
            <p className="text-muted-foreground">Verwalte deine Daten und Dokumente</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Speichern
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Persönliche Daten
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Vollständiger Name</Label>
                    <Input
                      id="full_name"
                      value={profile?.full_name || ''}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail</Label>
                    <Input
                      id="email"
                      value={profile?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={profile?.phone || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Company Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Firmendaten
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Firmenname</Label>
                  <Input
                    id="company_name"
                    value={profile?.company_name || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                    placeholder="Optional: Falls du als Agentur arbeitest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_address">Firmenadresse</Label>
                  <Input
                    id="company_address"
                    value={profile?.company_address || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, company_address: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax_id">Steuernummer / USt-IdNr.</Label>
                  <Input
                    id="tax_id"
                    value={profile?.tax_id || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, tax_id: e.target.value } : null)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Bank Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Bankverbindung
                </CardTitle>
                <CardDescription>Für Auszahlungen deiner Vermittlungsgebühren</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_iban">IBAN</Label>
                  <Input
                    id="bank_iban"
                    value={profile?.bank_iban || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, bank_iban: e.target.value } : null)}
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_bic">BIC</Label>
                  <Input
                    id="bank_bic"
                    value={profile?.bank_bic || ''}
                    onChange={(e) => setProfile(prev => prev ? { ...prev, bank_bic: e.target.value } : null)}
                    placeholder="COBADEFFXXX"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Dokumente & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Allgemeine Geschäftsbedingungen</p>
                      <p className="text-sm text-muted-foreground">Nutzungsbedingungen der Plattform</p>
                    </div>
                  </div>
                  {isDocumentAccepted('agb') ? (
                    <Badge className="bg-emerald/10 text-emerald">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Akzeptiert
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleAcceptDocument('agb')}>
                      Akzeptieren
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">NDA / Vertraulichkeitsvereinbarung</p>
                      <p className="text-sm text-muted-foreground">Schutz von Kandidaten- und Kundendaten</p>
                    </div>
                  </div>
                  {isDocumentAccepted('nda') ? (
                    <Badge className="bg-emerald/10 text-emerald">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Akzeptiert
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleAcceptDocument('nda')}>
                      Akzeptieren
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Rahmenvertrag</p>
                      <p className="text-sm text-muted-foreground">Vertrag über Vermittlungsleistungen</p>
                    </div>
                  </div>
                  {isDocumentAccepted('contract') ? (
                    <Badge className="bg-emerald/10 text-emerald">
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Akzeptiert
                    </Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleAcceptDocument('contract')}>
                      Akzeptieren
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Quality Scores */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5" />
                  Qualitäts-Scores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      Platzierungsquote
                    </span>
                    <span className="font-semibold">{stats.placementRate}%</span>
                  </div>
                  <Progress value={stats.placementRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      Interview-Quote
                    </span>
                    <span className="font-semibold">{stats.interviewRate}%</span>
                  </div>
                  <Progress value={stats.interviewRate} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      Ø Response-Zeit
                    </span>
                    <span className="font-semibold">{stats.avgResponseTime}h</span>
                  </div>
                  <Progress value={100 - (stats.avgResponseTime * 10)} className="h-2" />
                </div>

                <Separator />

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Einreichungen gesamt</p>
                  <p className="text-3xl font-bold">{stats.totalSubmissions}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald/30 bg-emerald/5">
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <Award className="h-8 w-8 mx-auto text-emerald" />
                  <p className="font-semibold">Verifizierter Recruiter</p>
                  <p className="text-sm text-muted-foreground">
                    Du hast alle erforderlichen Dokumente akzeptiert und bist als aktiver Recruiter freigeschaltet.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}