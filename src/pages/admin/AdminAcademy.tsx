import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  GraduationCap, BookOpen, Users, Layers, Loader2, Plus, Pencil, Trash2, Lock,
} from 'lucide-react';
import { toast } from 'sonner';

const db = supabase as any;

interface Course {
  id: string; slug: string; title: string; description: string;
  level: string; is_premium: boolean; published: boolean; sort_order: number;
  lessonCount?: number;
}
interface Member {
  user_id: string; display_name: string; plan: string; created_at: string;
  courseCount?: number; avgProgress?: number;
}

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const LEVEL_LABEL: Record<string, string> = { beginner: 'Einsteiger', intermediate: 'Fortgeschritten', advanced: 'Profi' };

export default function AdminAcademy() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [enrollCount, setEnrollCount] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', slug: '', description: '', level: 'beginner', is_premium: false });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [c, m, l, prof, enr] = await Promise.all([
      db.from('academy_courses').select('*').order('sort_order', { ascending: true }),
      db.from('academy_modules').select('id,course_id'),
      db.from('academy_lessons').select('id,module_id'),
      db.from('academy_profiles').select('*').order('created_at', { ascending: false }),
      db.from('academy_enrollments').select('user_id,course_id,progress_pct'),
    ]);

    const moduleToCourse: Record<string, string> = {};
    (m.data ?? []).forEach((mod: any) => { moduleToCourse[mod.id] = mod.course_id; });
    const lessonsByCourse: Record<string, number> = {};
    (l.data ?? []).forEach((les: any) => {
      const cid = moduleToCourse[les.module_id];
      if (cid) lessonsByCourse[cid] = (lessonsByCourse[cid] ?? 0) + 1;
    });
    setCourses((c.data ?? []).map((co: Course) => ({ ...co, lessonCount: lessonsByCourse[co.id] ?? 0 })));

    const enrByUser: Record<string, { n: number; sum: number }> = {};
    (enr.data ?? []).forEach((e: any) => {
      const u = (enrByUser[e.user_id] ??= { n: 0, sum: 0 });
      u.n += 1; u.sum += e.progress_pct ?? 0;
    });
    setEnrollCount((enr.data ?? []).length);
    setMembers((prof.data ?? []).map((p: Member) => ({
      ...p,
      courseCount: enrByUser[p.user_id]?.n ?? 0,
      avgProgress: enrByUser[p.user_id] ? Math.round(enrByUser[p.user_id].sum / enrByUser[p.user_id].n) : 0,
    })));
    setLoading(false);
  };

  const togglePublish = async (course: Course) => {
    const { error } = await db.from('academy_courses').update({ published: !course.published }).eq('id', course.id);
    if (error) { toast.error(error.message); return; }
    setCourses((prev) => prev.map((c) => c.id === course.id ? { ...c, published: !c.published } : c));
  };

  const deleteCourse = async (course: Course) => {
    if (!confirm(`Kurs „${course.title}" inkl. Modulen und Lektionen löschen?`)) return;
    const { error } = await db.from('academy_courses').delete().eq('id', course.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Kurs gelöscht.');
    setCourses((prev) => prev.filter((c) => c.id !== course.id));
  };

  const createCourse = async () => {
    if (!form.title || !form.slug) { toast.error('Titel und Slug sind nötig.'); return; }
    setSaving(true);
    const maxSort = courses.reduce((mx, c) => Math.max(mx, c.sort_order), 0);
    const { error } = await db.from('academy_courses').insert({
      title: form.title, slug: form.slug, description: form.description,
      level: form.level, is_premium: form.is_premium, published: false, sort_order: maxSort + 1,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Kurs angelegt.');
    setCreateOpen(false);
    setForm({ title: '', slug: '', description: '', level: 'beginner', is_premium: false });
    fetchAll();
  };

  const publishedCount = courses.filter((c) => c.published).length;

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <GraduationCap className="h-6 w-6" /> Akademie
            </h1>
            <p className="text-sm text-muted-foreground">Kurse, Inhalte und Mitglieder der Matchunt Akademie verwalten.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-4 w-4" /> Neuer Kurs</Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<BookOpen className="h-5 w-5" />} label="Kurse" value={courses.length} sub={`${publishedCount} veröffentlicht`} />
          <StatCard icon={<Layers className="h-5 w-5" />} label="Lektionen" value={courses.reduce((n, c) => n + (c.lessonCount ?? 0), 0)} />
          <StatCard icon={<Users className="h-5 w-5" />} label="Mitglieder" value={members.length} />
          <StatCard icon={<GraduationCap className="h-5 w-5" />} label="Einschreibungen" value={enrollCount} />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="courses">
            <TabsList>
              <TabsTrigger value="courses">Kurse</TabsTrigger>
              <TabsTrigger value="members">Mitglieder</TabsTrigger>
            </TabsList>

            <TabsContent value="courses">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Titel</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Lektionen</TableHead>
                        <TableHead>Premium</TableHead>
                        <TableHead>Veröffentlicht</TableHead>
                        <TableHead className="text-right">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.title}</div>
                            <div className="text-xs text-muted-foreground">/{c.slug}</div>
                          </TableCell>
                          <TableCell><Badge variant="secondary">{LEVEL_LABEL[c.level] ?? c.level}</Badge></TableCell>
                          <TableCell>{c.lessonCount}</TableCell>
                          <TableCell>{c.is_premium ? <Badge variant="outline" className="gap-1"><Lock className="h-3 w-3" /> Premium</Badge> : <span className="text-xs text-muted-foreground">frei</span>}</TableCell>
                          <TableCell><Switch checked={c.published} onCheckedChange={() => togglePublish(c)} /></TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="ghost" size="sm"><Link to={`/admin/academy/courses/${c.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCourse(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {courses.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Noch keine Kurse. Lege den ersten an.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Kurse</TableHead>
                        <TableHead>Ø Fortschritt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow key={m.user_id}>
                          <TableCell className="font-medium">{m.display_name || '—'}</TableCell>
                          <TableCell>{m.plan === 'premium' ? <Badge>Premium</Badge> : <Badge variant="secondary">Free</Badge>}</TableCell>
                          <TableCell>{m.courseCount}</TableCell>
                          <TableCell>{m.avgProgress}%</TableCell>
                        </TableRow>
                      ))}
                      {members.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Noch keine Mitglieder.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Neuer Kurs Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neuer Kurs</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input value={form.title} onChange={(e) => {
                const title = e.target.value;
                setForm((f) => ({ ...f, title, slug: f.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }));
              }} />
            </div>
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={(v) => setForm((f) => ({ ...f, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{LEVEL_LABEL[l]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-2">
                <Switch checked={form.is_premium} onCheckedChange={(v) => setForm((f) => ({ ...f, is_premium: v }))} />
                <Label>Premium</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button onClick={createCourse} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anlegen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
