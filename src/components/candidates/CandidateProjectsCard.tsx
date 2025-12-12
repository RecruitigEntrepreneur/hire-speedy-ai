import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Briefcase, 
  Plus, 
  Star, 
  StarOff, 
  Trash2, 
  Edit, 
  Users, 
  Calendar,
  MapPin,
  Monitor,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useCandidateProjects, ProjectFormData } from '@/hooks/useCandidateProjects';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface CandidateProjectsCardProps {
  candidateId: string;
}

const projectTypes = [
  { value: 'rollout', label: 'Rollout' },
  { value: 'migration', label: 'Migration' },
  { value: 'implementation', label: 'Implementierung' },
  { value: 'consulting', label: 'Beratung' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'development', label: 'Entwicklung' },
  { value: 'management', label: 'Management' },
];

const emptyProject: ProjectFormData = {
  project_name: '',
  client_name: '',
  client_industry: '',
  project_type: '',
  budget_range: '',
  team_size: undefined,
  duration_months: undefined,
  locations_count: undefined,
  devices_count: undefined,
  technologies: [],
  responsibilities: [],
  achievements: [],
  start_date: '',
  end_date: '',
  is_current: false,
  is_highlight: false,
};

export function CandidateProjectsCard({ candidateId }: CandidateProjectsCardProps) {
  const {
    projects,
    loading,
    saving,
    addProject,
    updateProject,
    deleteProject,
    toggleHighlight,
  } = useCandidateProjects(candidateId);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(emptyProject);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [techInput, setTechInput] = useState('');
  const [respInput, setRespInput] = useState('');
  const [achieveInput, setAchieveInput] = useState('');

  const handleSubmit = async () => {
    if (!formData.project_name) return;

    if (editingId) {
      await updateProject(editingId, formData);
    } else {
      await addProject(formData);
    }
    
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData(emptyProject);
  };

  const handleEdit = (project: typeof projects[0]) => {
    setEditingId(project.id);
    setFormData({
      project_name: project.project_name,
      client_name: project.client_name || '',
      client_industry: project.client_industry || '',
      project_type: project.project_type || '',
      budget_range: project.budget_range || '',
      team_size: project.team_size || undefined,
      duration_months: project.duration_months || undefined,
      locations_count: project.locations_count || undefined,
      devices_count: project.devices_count || undefined,
      technologies: project.technologies,
      responsibilities: project.responsibilities,
      achievements: project.achievements,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      is_current: project.is_current,
      is_highlight: project.is_highlight,
    });
    setIsDialogOpen(true);
  };

  const toggleExpanded = (id: string) => {
    setExpandedProjects(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const addToArray = (field: 'technologies' | 'responsibilities' | 'achievements', value: string) => {
    if (!value.trim()) return;
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] || []), value.trim()],
    }));
    if (field === 'technologies') setTechInput('');
    if (field === 'responsibilities') setRespInput('');
    if (field === 'achievements') setAchieveInput('');
  };

  const removeFromArray = (field: 'technologies' | 'responsibilities' | 'achievements', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Projekte werden geladen...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Briefcase className="h-5 w-5" />
          Projekthistorie
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => { setEditingId(null); setFormData(emptyProject); }}>
              <Plus className="h-4 w-4 mr-1" />
              Projekt
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Projekt bearbeiten' : 'Neues Projekt'}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Projektname *</Label>
                  <Input
                    value={formData.project_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, project_name: e.target.value }))}
                    placeholder="z.B. Windows 11 Migration"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kunde</Label>
                  <Input
                    value={formData.client_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_name: e.target.value }))}
                    placeholder="z.B. Fortune 500 Unternehmen"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branche</Label>
                  <Input
                    value={formData.client_industry || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_industry: e.target.value }))}
                    placeholder="z.B. Automotive"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Projekttyp</Label>
                  <Select
                    value={formData.project_type || ''}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, project_type: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projectTypes.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Teamgröße</Label>
                  <Input
                    type="number"
                    value={formData.team_size || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, team_size: parseInt(e.target.value) || undefined }))}
                    placeholder="z.B. 12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dauer (Monate)</Label>
                  <Input
                    type="number"
                    value={formData.duration_months || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_months: parseInt(e.target.value) || undefined }))}
                    placeholder="z.B. 18"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Standorte</Label>
                  <Input
                    type="number"
                    value={formData.locations_count || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, locations_count: parseInt(e.target.value) || undefined }))}
                    placeholder="z.B. 5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Geräte</Label>
                  <Input
                    type="number"
                    value={formData.devices_count || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, devices_count: parseInt(e.target.value) || undefined }))}
                    placeholder="z.B. 50000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Budget</Label>
                <Input
                  value={formData.budget_range || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, budget_range: e.target.value }))}
                  placeholder="z.B. 1-5 Mio. €"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ende</Label>
                  <Input
                    type="date"
                    value={formData.end_date || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    disabled={formData.is_current}
                  />
                </div>
              </div>

              {/* Technologies */}
              <div className="space-y-2">
                <Label>Technologien</Label>
                <div className="flex gap-2">
                  <Input
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    placeholder="z.B. Azure, SCCM"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('technologies', techInput))}
                  />
                  <Button type="button" onClick={() => addToArray('technologies', techInput)}>+</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.technologies?.map((t, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('technologies', i)}>
                      {t} ×
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Achievements */}
              <div className="space-y-2">
                <Label>Erfolge / Achievements</Label>
                <div className="flex gap-2">
                  <Input
                    value={achieveInput}
                    onChange={(e) => setAchieveInput(e.target.value)}
                    placeholder="z.B. 30% unter Budget"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addToArray('achievements', achieveInput))}
                  />
                  <Button type="button" onClick={() => addToArray('achievements', achieveInput)}>+</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.achievements?.map((a, i) => (
                    <Badge key={i} variant="outline" className="cursor-pointer" onClick={() => removeFromArray('achievements', i)}>
                      {a} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={handleSubmit} disabled={saving || !formData.project_name}>
                  {saving ? 'Speichern...' : editingId ? 'Aktualisieren' : 'Hinzufügen'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-3">
        {projects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Noch keine Projekte erfasst</p>
          </div>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              className={`border rounded-lg overflow-hidden ${project.is_highlight ? 'border-primary/50 bg-primary/5' : ''}`}
            >
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleExpanded(project.id)}
              >
                <div className="flex items-center gap-3">
                  {project.is_highlight && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                  <div>
                    <p className="font-medium">{project.project_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {project.client_name && <span>{project.client_name}</span>}
                      {project.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(project.start_date), 'MM/yyyy', { locale: de })}
                          {project.is_current ? ' - heute' : project.end_date ? ` - ${format(new Date(project.end_date), 'MM/yyyy', { locale: de })}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {project.team_size && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />
                      {project.team_size}
                    </Badge>
                  )}
                  {project.devices_count && (
                    <Badge variant="secondary" className="text-xs">
                      <Monitor className="h-3 w-3 mr-1" />
                      {project.devices_count.toLocaleString()}
                    </Badge>
                  )}
                  {expandedProjects.includes(project.id) ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>

              {expandedProjects.includes(project.id) && (
                <div className="px-3 pb-3 space-y-3 border-t">
                  <div className="pt-3 grid grid-cols-2 gap-3 text-sm">
                    {project.client_industry && (
                      <div><span className="text-muted-foreground">Branche:</span> {project.client_industry}</div>
                    )}
                    {project.project_type && (
                      <div><span className="text-muted-foreground">Typ:</span> {projectTypes.find(t => t.value === project.project_type)?.label || project.project_type}</div>
                    )}
                    {project.budget_range && (
                      <div><span className="text-muted-foreground">Budget:</span> {project.budget_range}</div>
                    )}
                    {project.locations_count && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {project.locations_count} Standorte
                      </div>
                    )}
                  </div>

                  {project.technologies.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Technologien</p>
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.map((t, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {project.achievements.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Erfolge</p>
                      <ul className="text-sm space-y-1">
                        {project.achievements.map((a, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-500">✓</span>
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleHighlight(project.id, !project.is_highlight)}
                    >
                      {project.is_highlight ? (
                        <><StarOff className="h-4 w-4 mr-1" /> Highlight entfernen</>
                      ) : (
                        <><Star className="h-4 w-4 mr-1" /> Als Highlight</>
                      )}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(project)}>
                      <Edit className="h-4 w-4 mr-1" /> Bearbeiten
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteProject(project.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
