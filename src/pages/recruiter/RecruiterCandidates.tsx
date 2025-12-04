import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, Plus, Search, User, Mail, Phone, Briefcase, Euro, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  experience_years: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  skills: string[] | null;
  summary: string | null;
  cv_url: string | null;
  linkedin_url: string | null;
  availability_date: string | null;
  notice_period: string | null;
  created_at: string;
}

const initialFormData = {
  full_name: '',
  email: '',
  phone: '',
  experience_years: '',
  current_salary: '',
  expected_salary: '',
  skills: '',
  summary: '',
  cv_url: '',
  linkedin_url: '',
  availability_date: '',
  notice_period: '',
};

export default function RecruiterCandidates() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [formData, setFormData] = useState(initialFormData);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user]);

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('recruiter_id', user?.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCandidates(data);
    }
    setLoading(false);
  };

  const handleOpenDialog = (candidate?: Candidate) => {
    if (candidate) {
      setEditingCandidate(candidate);
      setFormData({
        full_name: candidate.full_name,
        email: candidate.email,
        phone: candidate.phone || '',
        experience_years: candidate.experience_years?.toString() || '',
        current_salary: candidate.current_salary?.toString() || '',
        expected_salary: candidate.expected_salary?.toString() || '',
        skills: candidate.skills?.join(', ') || '',
        summary: candidate.summary || '',
        cv_url: candidate.cv_url || '',
        linkedin_url: candidate.linkedin_url || '',
        availability_date: candidate.availability_date || '',
        notice_period: candidate.notice_period || '',
      });
    } else {
      setEditingCandidate(null);
      setFormData(initialFormData);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email) {
      toast.error('Name und E-Mail sind erforderlich');
      return;
    }

    setProcessing(true);
    
    const candidateData = {
      full_name: formData.full_name,
      email: formData.email,
      phone: formData.phone || null,
      experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
      current_salary: formData.current_salary ? parseInt(formData.current_salary) : null,
      expected_salary: formData.expected_salary ? parseInt(formData.expected_salary) : null,
      skills: formData.skills ? formData.skills.split(',').map(s => s.trim()) : null,
      summary: formData.summary || null,
      cv_url: formData.cv_url || null,
      linkedin_url: formData.linkedin_url || null,
      availability_date: formData.availability_date || null,
      notice_period: formData.notice_period || null,
      recruiter_id: user?.id,
    };

    let error;
    if (editingCandidate) {
      ({ error } = await supabase
        .from('candidates')
        .update(candidateData)
        .eq('id', editingCandidate.id));
    } else {
      ({ error } = await supabase
        .from('candidates')
        .insert(candidateData));
    }

    if (error) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success(editingCandidate ? 'Kandidat aktualisiert' : 'Kandidat hinzugefügt');
      setDialogOpen(false);
      fetchCandidates();
    }
    setProcessing(false);
  };

  const handleDelete = async (candidate: Candidate) => {
    if (!confirm('Möchten Sie diesen Kandidaten wirklich löschen?')) return;
    
    const { error } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidate.id);

    if (error) {
      toast.error('Fehler beim Löschen');
    } else {
      toast.success('Kandidat gelöscht');
      fetchCandidates();
    }
  };

  const filteredCandidates = candidates.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <>
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DashboardLayout>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Meine Kandidaten</h1>
              <p className="text-muted-foreground mt-1">
                Verwalten Sie Ihre Kandidaten-Datenbank
              </p>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Kandidat hinzufügen
            </Button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach Name, E-Mail oder Skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Candidates Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredCandidates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <User className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'Keine Kandidaten gefunden' : 'Noch keine Kandidaten hinzugefügt'}
                  </p>
                  {!searchQuery && (
                    <Button className="mt-4" onClick={() => handleOpenDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Ersten Kandidaten hinzufügen
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredCandidates.map((candidate) => (
                <Card key={candidate.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback>
                            {candidate.full_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{candidate.full_name}</h3>
                          <p className="text-sm text-muted-foreground">{candidate.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleOpenDialog(candidate)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(candidate)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      {candidate.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {candidate.phone}
                        </div>
                      )}
                      {candidate.experience_years && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Briefcase className="h-3 w-3" />
                          {candidate.experience_years} Jahre Erfahrung
                        </div>
                      )}
                      {candidate.expected_salary && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Euro className="h-3 w-3" />
                          {candidate.expected_salary.toLocaleString()} € erwartet
                        </div>
                      )}
                    </div>

                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1">
                        {candidate.skills.slice(0, 4).map((skill, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                        {candidate.skills.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{candidate.skills.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCandidate ? 'Kandidat bearbeiten' : 'Neuen Kandidaten hinzufügen'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Max Mustermann"
                  />
                </div>
                <div>
                  <Label>E-Mail *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="max@beispiel.de"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telefon</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+49 123 456789"
                  />
                </div>
                <div>
                  <Label>Berufserfahrung (Jahre)</Label>
                  <Input
                    type="number"
                    value={formData.experience_years}
                    onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Aktuelles Gehalt (€)</Label>
                  <Input
                    type="number"
                    value={formData.current_salary}
                    onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                    placeholder="60000"
                  />
                </div>
                <div>
                  <Label>Gehaltsvorstellung (€)</Label>
                  <Input
                    type="number"
                    value={formData.expected_salary}
                    onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
                    placeholder="70000"
                  />
                </div>
              </div>

              <div>
                <Label>Skills (kommagetrennt)</Label>
                <Input
                  value={formData.skills}
                  onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                  placeholder="React, TypeScript, Node.js"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Verfügbar ab</Label>
                  <Input
                    type="date"
                    value={formData.availability_date}
                    onChange={(e) => setFormData({ ...formData, availability_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Kündigungsfrist</Label>
                  <Input
                    value={formData.notice_period}
                    onChange={(e) => setFormData({ ...formData, notice_period: e.target.value })}
                    placeholder="3 Monate"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>CV URL</Label>
                  <Input
                    value={formData.cv_url}
                    onChange={(e) => setFormData({ ...formData, cv_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>LinkedIn URL</Label>
                  <Input
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
              </div>

              <div>
                <Label>Zusammenfassung</Label>
                <Textarea
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  placeholder="Kurze Beschreibung des Kandidaten..."
                  rows={4}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingCandidate ? 'Aktualisieren' : 'Hinzufügen'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}
