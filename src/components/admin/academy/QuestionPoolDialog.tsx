import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const db = supabase as any; // eslint-disable-line @typescript-eslint/no-explicit-any

type QType = 'single' | 'multi' | 'order' | 'match';
const TYPE_LABEL: Record<QType, string> = {
  single: 'Eine Antwort (auch Fallfrage)',
  multi: 'Mehrere Antworten',
  order: 'Reihenfolge',
  match: 'Zuordnen',
};

interface Opt { id: string; text: string }
interface Row {
  id: string; lesson_id: string; type: QType; case_text: string | null; prompt: string;
  options: Opt[] | { left: Opt[]; right: Opt[] }; sort_order: number; active: boolean;
  correct?: unknown; explanation?: string;
}

/** Bearbeitungsform: einheitlich für alle Typen, wird beim Speichern in options/correct übersetzt. */
interface Draft {
  id?: string; type: QType; case_text: string; prompt: string; explanation: string; active: boolean; sort_order: number;
  choices: { text: string; right: boolean }[];   // single, multi
  steps: string[];                                // order (richtige Reihenfolge)
  pairs: { left: string; right: string }[];       // match
}

const letters = 'abcdefghij';
// Reihenfolge- und Zuordnungs-Kennungen ohne Muster, sonst verrät die Kennung die Lösung.
const opaqueId = () => crypto.randomUUID().slice(0, 8);
const emptyDraft = (sort: number): Draft => ({
  type: 'single', case_text: '', prompt: '', explanation: '', active: true, sort_order: sort,
  choices: [{ text: '', right: true }, { text: '', right: false }, { text: '', right: false }],
  steps: ['', '', ''], pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
});

function toDraft(r: Row): Draft {
  const d = emptyDraft(r.sort_order);
  d.id = r.id; d.type = r.type; d.case_text = r.case_text ?? ''; d.prompt = r.prompt;
  d.explanation = r.explanation ?? ''; d.active = r.active;
  if (r.type === 'single' || r.type === 'multi') {
    const right = Array.isArray(r.correct) ? (r.correct as string[]) : [r.correct as string];
    d.choices = (r.options as Opt[]).map((o) => ({ text: o.text, right: right.includes(o.id) }));
  } else if (r.type === 'order') {
    const byId = new Map((r.options as Opt[]).map((o) => [o.id, o.text]));
    d.steps = ((r.correct as string[]) ?? []).map((id) => byId.get(id) ?? '');
  } else {
    const o = r.options as { left: Opt[]; right: Opt[] };
    const rightText = new Map(o.right.map((x) => [x.id, x.text]));
    const map = (r.correct as Record<string, string>) ?? {};
    d.pairs = o.left.map((l) => ({ left: l.text, right: rightText.get(map[l.id]) ?? '' }));
  }
  return d;
}

function fromDraft(d: Draft): { options: unknown; correct: unknown } | string {
  if (!d.prompt.trim()) return 'Die Frage fehlt.';
  if (!d.explanation.trim()) return 'Die Begründung („Warum“) fehlt.';
  if (d.type === 'single' || d.type === 'multi') {
    const choices = d.choices.filter((c) => c.text.trim());
    if (choices.length < 2) return 'Mindestens zwei Antworten eintragen.';
    const right = choices.map((c, i) => (c.right ? letters[i] : null)).filter(Boolean) as string[];
    if (d.type === 'single' && right.length !== 1) return 'Genau eine richtige Antwort markieren.';
    if (d.type === 'multi' && right.length < 1) return 'Mindestens eine richtige Antwort markieren.';
    return {
      options: choices.map((c, i) => ({ id: letters[i], text: c.text.trim() })),
      correct: d.type === 'single' ? right[0] : right,
    };
  }
  if (d.type === 'order') {
    const steps = d.steps.map((s) => s.trim()).filter(Boolean);
    if (steps.length < 3) return 'Mindestens drei Schritte eintragen.';
    const ids = steps.map(opaqueId);
    return { options: steps.map((s, i) => ({ id: ids[i], text: s })), correct: ids };
  }
  const pairs = d.pairs.filter((p) => p.left.trim() && p.right.trim());
  if (pairs.length < 2) return 'Mindestens zwei vollständige Paare eintragen.';
  const leftIds = pairs.map(opaqueId);
  const rightIds = pairs.map(opaqueId);
  return {
    options: {
      left: pairs.map((p, i) => ({ id: leftIds[i], text: p.left.trim() })),
      right: pairs.map((p, i) => ({ id: rightIds[i], text: p.right.trim() })),
    },
    correct: Object.fromEntries(pairs.map((_, i) => [leftIds[i], rightIds[i]])),
  };
}

interface Props { lesson: { id: string; title: string } | null; onClose: () => void; onChanged: () => void }

export function QuestionPoolDialog({ lesson, onClose, onChanged }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!lesson) return;
    setLoading(true);
    const { data: qs } = await db.from('academy_questions').select('*').eq('lesson_id', lesson.id).order('sort_order', { ascending: true });
    const ids = (qs ?? []).map((q: Row) => q.id);
    const { data: keys } = ids.length ? await db.from('academy_question_keys').select('*').in('question_id', ids) : { data: [] };
    type Key = { question_id: string; correct: unknown; explanation: string };
    const keyMap = new Map<string, Key>((keys ?? []).map((k: Key) => [k.question_id, k]));
    setRows((qs ?? []).map((q: Row) => ({ ...q, correct: keyMap.get(q.id)?.correct, explanation: keyMap.get(q.id)?.explanation })));
    setLoading(false);
  }, [lesson]);

  useEffect(() => { setDraft(null); load(); }, [load]);

  const save = async () => {
    if (!draft || !lesson) return;
    const built = fromDraft(draft);
    if (typeof built === 'string') { toast.error(built); return; }
    setSaving(true);
    const payload = {
      lesson_id: lesson.id, type: draft.type, case_text: draft.case_text.trim() || null, prompt: draft.prompt.trim(),
      options: built.options, active: draft.active, sort_order: draft.sort_order,
    };
    const res = draft.id
      ? await db.from('academy_questions').update(payload).eq('id', draft.id).select('id').single()
      : await db.from('academy_questions').insert(payload).select('id').single();
    if (res.error) { setSaving(false); toast.error(res.error.message); return; }
    const { error } = await db.from('academy_question_keys').upsert(
      { question_id: res.data.id, correct: built.correct, explanation: draft.explanation.trim() },
      { onConflict: 'question_id' },
    );
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Frage gespeichert.');
    setDraft(null);
    load(); onChanged();
  };

  const remove = async (r: Row) => {
    if (!confirm('Diese Frage löschen? Bisherige Versuche behalten ihr Ergebnis.')) return;
    const { error } = await db.from('academy_questions').delete().eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    load(); onChanged();
  };

  const toggleActive = async (r: Row, active: boolean) => {
    const { error } = await db.from('academy_questions').update({ active }).eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active } : x)));
    onChanged();
  };

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <Dialog open={!!lesson} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fragenpool · {lesson?.title}</DialogTitle>
          <DialogDescription>Aus diesem Pool ziehen die Abfrage zum Thema und der Modul-Test zufällig. Lernende sehen die Lösung nie vor ihrer Antwort.</DialogDescription>
        </DialogHeader>

        {!draft && (
          <>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <ul className="divide-y divide-border/50 rounded-md border">
                {rows.map((r, i) => (
                  <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                    <span className="mt-0.5 text-xs text-muted-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-sm">{r.prompt}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{TYPE_LABEL[r.type]}</Badge>
                        {r.case_text && <Badge variant="outline">mit Fall</Badge>}
                        {!r.explanation && <Badge variant="destructive">Begründung fehlt</Badge>}
                      </div>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch checked={r.active} onCheckedChange={(v) => toggleActive(r, v)} /> aktiv
                    </label>
                    <Button variant="ghost" size="sm" aria-label="Bearbeiten" onClick={() => setDraft(toDraft(r))}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" aria-label="Löschen" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </li>
                ))}
                {rows.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Noch keine Fragen. Lege die erste an.</li>}
              </ul>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{rows.filter((r) => r.active).length} aktive Fragen</span>
              <Button onClick={() => setDraft(emptyDraft((rows.at(-1)?.sort_order ?? 0) + 1))}><Plus className="mr-1 h-4 w-4" /> Frage</Button>
            </div>
          </>
        )}

        {draft && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Fragetyp</Label>
                <Select value={draft.type} onValueChange={(v) => set({ type: v as QType })}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(TYPE_LABEL) as QType[]).map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm"><Switch checked={draft.active} onCheckedChange={(v) => set({ active: v })} /> aktiv</label>
            </div>
            <div className="space-y-2"><Label>Fall (optional, 1–3 Sätze)</Label><Textarea rows={2} value={draft.case_text} onChange={(e) => set({ case_text: e.target.value })} /></div>
            <div className="space-y-2"><Label>Frage</Label><Textarea rows={2} value={draft.prompt} onChange={(e) => set({ prompt: e.target.value })} /></div>

            {(draft.type === 'single' || draft.type === 'multi') && (
              <div className="space-y-2">
                <Label>Antworten · {draft.type === 'single' ? 'genau eine richtige markieren' : 'alle richtigen markieren'}</Label>
                {draft.choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type={draft.type === 'single' ? 'radio' : 'checkbox'}
                      aria-label={`Antwort ${letters[i]} ist richtig`}
                      checked={c.right}
                      onChange={(e) => set({
                        choices: draft.choices.map((x, j) => (draft.type === 'single' ? { ...x, right: j === i } : j === i ? { ...x, right: e.target.checked } : x)),
                      })}
                    />
                    <span className="w-4 text-xs text-muted-foreground">{letters[i]}</span>
                    <Input value={c.text} onChange={(e) => set({ choices: draft.choices.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
                    <Button variant="ghost" size="sm" aria-label="Antwort entfernen" disabled={draft.choices.length <= 2} onClick={() => set({ choices: draft.choices.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {draft.choices.length < 6 && <Button variant="outline" size="sm" onClick={() => set({ choices: [...draft.choices, { text: '', right: false }] })}><Plus className="mr-1 h-4 w-4" /> Antwort</Button>}
              </div>
            )}

            {draft.type === 'order' && (
              <div className="space-y-2">
                <Label>Schritte in der richtigen Reihenfolge (Lernende sehen sie gemischt)</Label>
                {draft.steps.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
                    <Input value={s} onChange={(e) => set({ steps: draft.steps.map((x, j) => (j === i ? e.target.value : x)) })} />
                    <Button variant="ghost" size="sm" aria-label="Nach oben" disabled={i === 0} onClick={() => { const n = [...draft.steps]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ steps: n }); }}><ArrowUp className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" aria-label="Nach unten" disabled={i === draft.steps.length - 1} onClick={() => { const n = [...draft.steps]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set({ steps: n }); }}><ArrowDown className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" aria-label="Schritt entfernen" disabled={draft.steps.length <= 3} onClick={() => set({ steps: draft.steps.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {draft.steps.length < 6 && <Button variant="outline" size="sm" onClick={() => set({ steps: [...draft.steps, ''] })}><Plus className="mr-1 h-4 w-4" /> Schritt</Button>}
              </div>
            )}

            {draft.type === 'match' && (
              <div className="space-y-2">
                <Label>Paare (links → passendes rechts; rechts wird für Lernende gemischt)</Label>
                {draft.pairs.map((p, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                    <Input placeholder="links" value={p.left} onChange={(e) => set({ pairs: draft.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })} />
                    <Input placeholder="rechts" value={p.right} onChange={(e) => set({ pairs: draft.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })} />
                    <Button variant="ghost" size="sm" aria-label="Paar entfernen" disabled={draft.pairs.length <= 2} onClick={() => set({ pairs: draft.pairs.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {draft.pairs.length < 5 && <Button variant="outline" size="sm" onClick={() => set({ pairs: [...draft.pairs, { left: '', right: '' }] })}><Plus className="mr-1 h-4 w-4" /> Paar</Button>}
              </div>
            )}

            <div className="space-y-2"><Label>Warum (Begründung, sehen Lernende nach der Antwort)</Label><Textarea rows={2} value={draft.explanation} onChange={(e) => set({ explanation: e.target.value })} /></div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>Abbrechen</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Frage speichern'}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
