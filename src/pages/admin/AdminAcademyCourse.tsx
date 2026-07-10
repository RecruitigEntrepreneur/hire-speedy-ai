import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, Lock, Video, FileText, HelpCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

const db = supabase as any;

interface Lesson {
  id: string; module_id: string; title: string; content_type: 'video' | 'text' | 'quiz';
  body: string; video_url: string | null; duration_min: number | null; is_premium: boolean; sort_order: number;
}
interface Module { id: string; course_id: string; title: string; sort_order: number; lessons: Lesson[]; }
interface Course { id: string; slug: string; title: string; description: string; level: string; is_premium: boolean; published: boolean; }

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const TYPE_ICON = { video: Video, text: FileText, quiz: HelpCircle };

const emptyLesson = (moduleId: string, sort: number): Partial<Lesson> => ({
  module_id: moduleId, title: '', content_type: 'text', body: '', video_url: '', duration_min: 5, is_premium: false, sort_order: sort,
});

export default function AdminAcademyCourse() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessonForm, setLessonForm] = useState<Partial<Lesson> | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    const { data: c } = await db.from('academy_courses').select('*').eq('id', id).maybeSingle();
    const { data: mods } = await db.from('academy_modules').select('*').eq('course_id', id).order('sort_order', { ascending: true });
    const moduleIds = (mods ?? []).map((m: Module) => m.id);
    const { data: lessons } = moduleIds.length
      ? await db.from('academy_lessons').select('*').in('module_id', moduleIds).order('sort_order', { ascending: true })
      : { data: [] };
    setCourse(c ?? null);
    setModules((mods ?? []).map((m: Module) => ({ ...m, lessons: (lessons ?? []).filter((l: Lesson) => l.module_id === m.id) })));
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchCourse(); }, [fetchCourse]);

  const saveCourse = async () => {
    if (!course) return;
    setSavingCourse(true);
    const { error } = await db.from('academy_courses').update({
      title: course.title, slug: course.slug, description: course.description,
      level: course.level, is_premium: course.is_premium, published: course.published,
    }).eq('id', course.id);
    setSavingCourse(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Kurs gespeichert.');
  };

  const addModule = async () => {
    const maxSort = modules.reduce((mx, m) => Math.max(mx, m.sort_order), 0);
    const { error } = await db.from('academy_modules').insert({ course_id: id, title: 'Neues Modul', sort_order: maxSort + 1 });
    if (error) { toast.error(error.message); return; }
    fetchCourse();
  };
  const updateModuleTitle = async (m: Module, title: string) => {
    await db.from('academy_modules').update({ title }).eq('id', m.id);
  };
  const deleteModule = async (m: Module) => {
    if (!confirm(`Modul „${m.title}" inkl. Lektionen löschen?`)) return;
    const { error } = await db.from('academy_modules').delete().eq('id', m.id);
    if (error) { toast.error(error.message); return; }
    fetchCourse();
  };

  const saveLesson = async () => {
    if (!lessonForm) return;
    if (!lessonForm.title) { toast.error('Titel fehlt.'); return; }
    setSavingLesson(true);
    const payload = {
      module_id: lessonForm.module_id, title: lessonForm.title, content_type: lessonForm.content_type,
      body: lessonForm.body ?? '', video_url: lessonForm.video_url || null,
      duration_min: lessonForm.duration_min ?? null, is_premium: !!lessonForm.is_premium, sort_order: lessonForm.sort_order ?? 0,
    };
    const { error } = lessonForm.id
      ? await db.from('academy_lessons').update(payload).eq('id', lessonForm.id)
      : await db.from('academy_lessons').insert(payload);
    setSavingLesson(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Lektion gespeichert.');
    setLessonForm(null);
    fetchCourse();
  };
  const deleteLesson = async (l: Lesson) => {
    if (!confirm(`Lektion „${l.title}" löschen?`)) return;
    const { error } = await db.from('academy_lessons').delete().eq('id', l.id);
    if (error) { toast.error(error.message); return; }
    fetchCourse();
  };

  if (loading) {
    return <DashboardLayout><div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }
  if (!course) {
    return <DashboardLayout><div className="p-6"><p className="text-muted-foreground">Kurs nicht gefunden.</p><Button asChild variant="outline" className="mt-4"><Link to="/admin/academy">Zurück</Link></Button></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <Link to="/admin/academy" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Akademie
        </Link>

        {/* Kurs-Stammdaten */}
        <Card>
          <CardHeader><CardTitle>Kurs-Stammdaten</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Titel</Label><Input value={course.title} onChange={(e) => setCourse({ ...course, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Slug</Label><Input value={course.slug} onChange={(e) => setCourse({ ...course, slug: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Beschreibung</Label><Textarea rows={3} value={course.description} onChange={(e) => setCourse({ ...course, description: e.target.value })} /></div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="space-y-2"><Label>Level</Label>
                <Select value={course.level} onValueChange={(v) => setCourse({ ...course, level: v })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pt-6"><Switch checked={course.is_premium} onCheckedChange={(v) => setCourse({ ...course, is_premium: v })} /> Premium</label>
              <label className="flex items-center gap-2 pt-6"><Switch checked={course.published} onCheckedChange={(v) => setCourse({ ...course, published: v })} /> Veröffentlicht</label>
              <Button className="ml-auto mt-6" onClick={saveCourse} disabled={savingCourse}>
                {savingCourse ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="mr-1 h-4 w-4" /> Speichern</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Module & Lektionen */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Module & Lektionen</h2>
          <Button variant="outline" size="sm" onClick={addModule}><Plus className="mr-1 h-4 w-4" /> Modul</Button>
        </div>

        <div className="space-y-4">
          {modules.map((m, mi) => (
            <Card key={m.id}>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0">
                <span className="text-sm text-muted-foreground">{mi + 1}.</span>
                <Input defaultValue={m.title} className="max-w-md font-medium" onBlur={(e) => updateModuleTitle(m, e.target.value)} />
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setLessonForm(emptyLesson(m.id, (m.lessons.at(-1)?.sort_order ?? 0) + 1))}>
                    <Plus className="mr-1 h-4 w-4" /> Lektion
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => deleteModule(m)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border/40">
                  {m.lessons.map((l) => {
                    const Icon = TYPE_ICON[l.content_type] ?? FileText;
                    return (
                      <li key={l.id} className="flex items-center gap-3 px-5 py-3">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm">{l.title}</span>
                        {l.is_premium && <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Premium</Badge>}
                        {l.duration_min ? <span className="text-xs text-muted-foreground">{l.duration_min} Min</span> : null}
                        <Button variant="ghost" size="sm" onClick={() => setLessonForm(l)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteLesson(l)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </li>
                    );
                  })}
                  {m.lessons.length === 0 && <li className="px-5 py-3 text-sm text-muted-foreground">Noch keine Lektionen.</li>}
                </ul>
              </CardContent>
            </Card>
          ))}
          {modules.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Module. Lege das erste an.</p>}
        </div>
      </div>

      {/* Lektion-Editor Dialog */}
      <Dialog open={!!lessonForm} onOpenChange={(o) => !o && setLessonForm(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{lessonForm?.id ? 'Lektion bearbeiten' : 'Neue Lektion'}</DialogTitle></DialogHeader>
          {lessonForm && (
            <div className="space-y-4">
              <div className="space-y-2"><Label>Titel</Label><Input value={lessonForm.title ?? ''} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
              <div className="flex gap-4">
                <div className="space-y-2"><Label>Typ</Label>
                  <Select value={lessonForm.content_type} onValueChange={(v) => setLessonForm({ ...lessonForm, content_type: v as Lesson['content_type'] })}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="text">Text</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="quiz">Quiz</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Dauer (Min)</Label><Input type="number" className="w-28" value={lessonForm.duration_min ?? 0} onChange={(e) => setLessonForm({ ...lessonForm, duration_min: Number(e.target.value) })} /></div>
                <label className="flex items-center gap-2 pt-7"><Switch checked={!!lessonForm.is_premium} onCheckedChange={(v) => setLessonForm({ ...lessonForm, is_premium: v })} /> Premium</label>
              </div>
              {lessonForm.content_type === 'video' && (
                <div className="space-y-2"><Label>Video-URL (Embed)</Label><Input value={lessonForm.video_url ?? ''} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} placeholder="https://..." /></div>
              )}
              <div className="space-y-2"><Label>Inhalt (Absätze mit Leerzeile trennen)</Label><Textarea rows={10} value={lessonForm.body ?? ''} onChange={(e) => setLessonForm({ ...lessonForm, body: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLessonForm(null)}>Abbrechen</Button>
            <Button onClick={saveLesson} disabled={savingLesson}>{savingLesson ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Speichern'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
