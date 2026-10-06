import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Loader2, Pencil, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { interviewApi, type InterviewGuideData } from '@/lib/interviewScheduling';

interface Props {
  interviewId: string;
  /** erst laden (und ggf. erzeugen), wenn der Reiter offen ist */
  active: boolean;
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** Interview-Leitfaden: Fragen aus Stelle und Headhunter-Notiz, abhaken und anpassen. */
export function GuideChecklist({ interviewId, active }: Props) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['interview-guide', interviewId],
    queryFn: () => interviewApi.guide(interviewId),
    enabled: active,
    staleTime: Infinity,
    retry: 1,
  });
  const [guide, setGuide] = useState<InterviewGuideData | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const timer = useRef<number | null>(null);

  // Nur der erste Stand kommt vom Server; danach gilt, was hier bearbeitet wird
  useEffect(() => {
    if (query.data?.guide && !guide) setGuide(query.data.guide);
  }, [query.data, guide]);

  const persist = (next: InterviewGuideData) => {
    setGuide(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      try {
        await interviewApi.saveGuide(interviewId, next);
        queryClient.setQueryData<Awaited<ReturnType<typeof interviewApi.guide>>>(['interview-guide', interviewId], (old) => (old ? { ...old, guide: next } : old));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Der Leitfaden konnte nicht gespeichert werden.');
      } finally {
        setSaving(false);
      }
    }, 600);
  };

  const update = (si: number, ii: number, patch: Partial<InterviewGuideData['sections'][number]['items'][number]>) => {
    if (!guide) return;
    persist({
      sections: guide.sections.map((s, a) => (a !== si ? s : { ...s, items: s.items.map((it, b) => (b !== ii ? it : { ...it, ...patch })) })),
    });
  };
  const remove = (si: number, ii: number) => {
    if (!guide) return;
    persist({ sections: guide.sections.map((s, a) => (a !== si ? s : { ...s, items: s.items.filter((_, b) => b !== ii) })).filter((s) => s.items.length) });
  };
  const add = (si: number) => {
    if (!guide) return;
    persist({ sections: guide.sections.map((s, a) => (a !== si ? s : { ...s, items: [...s.items, { id: newId(), text: 'Neue Frage', hint: null, done: false }] })) });
    setEditing(true);
  };

  const regenerate = async () => {
    if (!window.confirm('Leitfaden neu erstellen? Ihre Änderungen und Haken gehen verloren.')) return;
    setRegenerating(true);
    try {
      const fresh = await interviewApi.guide(interviewId, true);
      setGuide(fresh.guide);
      queryClient.setQueryData(['interview-guide', interviewId], fresh);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Leitfaden konnte nicht erstellt werden.');
    } finally {
      setRegenerating(false);
    }
  };

  if (query.isLoading || (!guide && query.isFetching)) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Leitfaden wird aus der Stelle und der Headhunter-Notiz erstellt …
      </div>
    );
  }
  if (query.error || !guide) {
    return (
      <div className="space-y-2 py-6 text-sm">
        <p className="text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Der Leitfaden konnte nicht geladen werden.'}</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => query.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen
        </Button>
      </div>
    );
  }

  const total = guide.sections.reduce((n, s) => n + s.items.length, 0);
  const done = guide.sections.reduce((n, s) => n + s.items.filter((i) => i.done).length, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{done} von {total} besprochen</p>
        {query.data?.source === 'ai' && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" /> aus Stelle und Headhunter-Notiz</span>
        )}
        {saving && <span className="text-xs text-muted-foreground">speichert …</span>}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={editing ? 'default' : 'ghost'} className="h-7 gap-1 text-xs" onClick={() => setEditing((e) => !e)}>
            {editing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />} {editing ? 'Fertig' : 'Anpassen'}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={regenerate} disabled={regenerating}>
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Neu erstellen
          </Button>
        </div>
      </div>

      {guide.sections.map((section, si) => (
        <section key={`${section.title}-${si}`} className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section.title}</h4>
          <ul className="space-y-1">
            {section.items.map((item, ii) => (
              <li key={item.id} className="flex items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  onClick={() => update(si, ii, { done: !item.done })}
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    item.done ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/50 hover:border-foreground',
                  )}
                  aria-label={item.done ? 'Als offen markieren' : 'Als besprochen markieren'}
                >
                  {item.done && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <Input
                      value={item.text}
                      onChange={(e) => update(si, ii, { text: e.target.value })}
                      className="h-8 text-sm"
                      maxLength={300}
                    />
                  ) : (
                    <p className={cn('text-sm', item.done && 'text-muted-foreground line-through')}>{item.text}</p>
                  )}
                  {item.hint && !editing && <p className="text-xs text-muted-foreground">{item.hint}</p>}
                </div>
                {editing && (
                  <button type="button" onClick={() => remove(si, ii)} className="mt-1 text-muted-foreground hover:text-destructive" aria-label="Frage entfernen">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editing && (
            <button type="button" onClick={() => add(si)} className="inline-flex items-center gap-1 px-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="h-3 w-3" /> Frage hinzufügen
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
