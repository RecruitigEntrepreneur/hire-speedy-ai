import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Search, FileUp, Link2, Database, ArrowRight, ShieldCheck, Briefcase, FilePen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JobIntakeStudio, type StudioDraft } from './JobIntakeStudio';

type JobType = 'full-time' | 'freelance';
type Source = 'text' | 'url' | 'pdf' | null;

/**
 * "Stelle ausschreiben" – kompakter Title-Launcher (halbe Breite, links).
 * Jobtitel als Held; Import-Quellen (PDF/Link) als Zweitweg. ATS-Verbinden lebt
 * in den Einstellungen → hier führt "ATS" nur dorthin (bzw. später zur Auswahl
 * aus dem verbundenen System). Jede Aktion öffnet das Studio-Fenster.
 */
export function NeueStelleBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [type, setType] = useState<JobType>('full-time');
  const [seed, setSeed] = useState('');
  const [studio, setStudio] = useState<{ open: boolean; text: string; source: Source; draft: StudioDraft | null }>({
    open: false, text: '', source: null, draft: null,
  });

  const openStudio = (source: Source) => setStudio({ open: true, text: seed, source, draft: null });

  // Speichern & Fortsetzen: offene Entwürfe des Kunden
  const { data: drafts = [], refetch: refetchDrafts } = useQuery({
    queryKey: ['intake-drafts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, created_at')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(2);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const resumeDraft = async (id: string) => {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (error || !data) {
      toast.error('Entwurf konnte nicht geladen werden.');
      return;
    }
    setStudio({ open: true, text: '', source: null, draft: { id, row: data } });
  };

  return (
    <>
      <div className="md:w-1/2">
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-background">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Stelle ausschreiben</h3>
            </div>

            <div className="mb-3 inline-flex rounded-lg border border-border/60 bg-background/70 p-0.5">
              {(['full-time', 'freelance'] as JobType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                    type === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'full-time' ? 'Festanstellung' : 'Contracting'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && openStudio('text')}
                  placeholder="Jobtitel — oder Anzeige einfügen …"
                  className="h-11 bg-background pl-9"
                />
              </div>
              <Button variant="hero" size="icon" className="h-11 w-11 shrink-0" onClick={() => openStudio('text')} aria-label="Stelle ausschreiben">
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <span>oder importieren:</span>
              <button onClick={() => openStudio('pdf')} className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-primary">
                <FileUp className="h-3.5 w-3.5" /> PDF
              </button>
              <button onClick={() => openStudio('url')} className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-primary">
                <Link2 className="h-3.5 w-3.5" /> Link
              </button>
              <button onClick={() => navigate('/dashboard/integrations')} className="inline-flex items-center gap-1 font-medium text-foreground/80 transition-colors hover:text-primary">
                <Database className="h-3.5 w-3.5" /> ATS
              </button>
            </div>

            {drafts.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Fortsetzen:</span>
                {drafts.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => resumeDraft(d.id)}
                    className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <FilePen className="h-3 w-3 shrink-0" />
                    <span className="truncate">{d.title || 'Unbenannter Entwurf'}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Fertiges Profil in Sekunden · alles editierbar · triple-blind
            </div>
          </CardContent>
        </Card>
      </div>

      <JobIntakeStudio
        open={studio.open}
        type={type}
        initialText={studio.text}
        initialSource={studio.source}
        initialDraft={studio.draft}
        onOpenChange={(o) => {
          setStudio((s) => ({ ...s, open: o, draft: o ? s.draft : null }));
          if (!o) refetchDrafts();
        }}
      />
    </>
  );
}
