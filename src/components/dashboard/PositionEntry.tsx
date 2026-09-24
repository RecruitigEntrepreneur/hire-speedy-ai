import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Building2, FilePen, FileUp, Link2, Mail, Plus, Sparkles } from 'lucide-react';

/**
 * Einstieg in die Jobaufnahme auf dem Dashboard.
 *
 * Ersetzt den Kasten "Stelle ausschreiben", der zweimal nach demselben fragte
 * (erst hier PDF/Link, dann im Fenster noch einmal) und auf eine
 * ATS-Attrappe verlinkte. Alles fuehrt jetzt in DIESELBE Aufnahme wie der
 * Link /start -- unter /dashboard/aufnahme.
 *
 * Neue Kunden (keine Stelle) sehen den grossen Einstieg, laufende Kunden eine
 * schlanke Leiste mit ihren angefangenen Entwuerfen.
 */

const HERKUNFT: Record<string, string> = {
  email_import: 'per Mail',
  personio: 'aus Personio',
};

export function PositionEntry({ hasJobs }: { hasJobs: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: drafts = [] } = useQuery({
    queryKey: ['position-entry-drafts', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // Ohne Typen: die JSON-Pfad-Auswahl sprengt die Supabase-Typableitung.
      const { data } = await (supabase as any)
        .from('jobs')
        .select('id, title, updated_at, source:intake_payload->>source')
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(3);
      return (data ?? []) as { id: string; title: string | null; source: string | null }[];
    },
  });

  const open = (state?: Record<string, unknown>) => navigate('/dashboard/aufnahme', { state });
  const withFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      toast.error('Bitte eine PDF- oder Word-Datei (.docx).');
      return;
    }
    open({ seedFile: file });
  };
  const preview = (what: string) => toast.info(`${what} ist in dieser Vorschau noch nicht angeschlossen.`);

  const weitermachen = drafts.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
      <span className="text-muted-foreground">Weitermachen:</span>
      {drafts.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => navigate(`/dashboard/aufnahme/${d.id}`)}
          className="inline-flex max-w-[220px] items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 font-medium text-primary hover:bg-primary/10"
        >
          <FilePen className="h-3 w-3 shrink-0" />
          <span className="truncate">{d.title || 'Unbenannter Entwurf'}</span>
          {d.source && HERKUNFT[d.source] && <span className="shrink-0 font-normal text-muted-foreground">· {HERKUNFT[d.source]}</span>}
        </button>
      ))}
      <button type="button" onClick={() => navigate('/dashboard/jobs')} className="text-muted-foreground underline underline-offset-2">
        alle Entwürfe
      </button>
    </div>
  );

  // ---- Laufender Kunde: schlanke Leiste -----------------------------------
  if (hasJobs) {
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[200px] flex-1">
              <p className="font-semibold">Neue Position aufnehmen</p>
              <p className="text-sm text-muted-foreground">Anzeige einfügen, hochladen oder von Hand beschreiben</p>
            </div>
            <Button onClick={() => open()} className="gap-1.5">
              <Plus className="h-4 w-4" /> Position aufnehmen
            </Button>
          </div>
          {weitermachen}
        </CardContent>
      </Card>
    );
  }

  // ---- Neuer Kunde: grosser Einstieg --------------------------------------
  return (
    <Card>
      <CardContent className="space-y-4 p-5 md:p-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Ihre offene Position aufnehmen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Meist in drei bis fünf Minuten. Ihre Angaben werden fortlaufend gespeichert.
          </p>
        </div>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); withFile(e.dataTransfer.files?.[0]); }}
          className={cn('rounded-xl border border-dashed p-1 transition-colors', dragging && 'border-primary bg-primary/5')}
        >
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="resize-none border-0 text-sm shadow-none focus-visible:ring-0"
            placeholder={'Stellenanzeige einfügen — oder die Rolle in eigenen Worten beschreiben.\nz. B. „Senior Controller in Stuttgart, hybrid, ~90k, SAP S/4HANA, ab sofort“\n\nOder eine PDF- / Word-Datei hierher ziehen.'}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => open(text.trim().length >= 10 ? { seedText: text.trim() } : undefined)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" /> Profil bauen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => open()}>
            <Link2 className="h-4 w-4" /> Link zur Anzeige
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Datei wählen
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => preview('Personio')}>
            <Building2 className="h-4 w-4" /> Aus Personio <span className="text-[10px]">(Vorschau)</span>
          </Button>
          <button type="button" onClick={() => open()} className="text-sm text-muted-foreground underline underline-offset-2">
            Von Hand beschreiben
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => { withFile(e.target.files?.[0]); e.target.value = ''; }}
          />
        </div>
        <button
          type="button"
          onClick={() => preview('Stellen per Mail')}
          className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" /> Lieber per Mail? Anzeige an Ihre Matchunt-Adresse weiterleiten (Vorschau)
        </button>
        {weitermachen}
      </CardContent>
    </Card>
  );
}
