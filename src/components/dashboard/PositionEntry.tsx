import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Building2, ChevronDown, ChevronUp, FilePen, FileUp, Link2, Mail, Plus, Sparkles } from 'lucide-react';

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

/** Herkunft eines Entwurfs (gespeicherter Wert) -> Schlüssel der Anzeige. */
const HERKUNFT: Record<string, string> = {
  email_import: 'entry.sourceMail',
  personio: 'entry.sourcePersonio',
};

type Entwurf = { id: string; title: string | null; source: string | null };

/** Die drei zuletzt bearbeiteten Entwürfe und die Gesamtzahl (Handy zeigt sie eingeklappt). */
function useEntwuerfe() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['position-entry-drafts', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      // Ohne Typen: die JSON-Pfad-Auswahl sprengt die Supabase-Typableitung.
      const { data, count } = await (supabase as any)
        .from('jobs')
        .select('id, title, updated_at, source:intake_payload->>source', { count: 'exact' })
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(3);
      const rows = (data ?? []) as Entwurf[];
      return { rows, count: (count as number | null) ?? rows.length };
    },
  });
  return data ?? { rows: [] as Entwurf[], count: 0 };
}

function EntwurfChip({ d, className }: { d: Entwurf; className?: string }) {
  const { t } = useTranslation('clientDashboard');
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/dashboard/aufnahme/${d.id}`)}
      className={cn('inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 font-medium text-primary hover:bg-primary/10', className)}
    >
      <FilePen className="h-3 w-3 shrink-0" />
      <span className="truncate">{d.title || t('entry.untitled')}</span>
      {d.source && HERKUNFT[d.source] && <span className="shrink-0 font-normal text-muted-foreground">· {t(HERKUNFT[d.source])}</span>}
    </button>
  );
}

/**
 * Handy, laufender Kunde (17.11.2026): statt der Karte „Neue Position aufnehmen“ steht der Knopf
 * neben „Rundgang“; die Entwürfe sind eine eingeklappte Zeile unter den Knöpfen.
 */
export function EntwuerfeHandy({ className }: { className?: string }) {
  const { t } = useTranslation('clientDashboard');
  const navigate = useNavigate();
  const { rows, count } = useEntwuerfe();
  const [offen, setOffen] = useState(false);
  if (count === 0) return null;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="inline-flex items-center gap-1.5 py-0.5 text-[13px] text-muted-foreground hover:text-foreground"
      >
        <FilePen className="h-3.5 w-3.5" />
        {t('entry.continueDrafts')}
        <span className="font-medium text-foreground">{count}</span>
        {offen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {offen && (
        <div className="mt-2.5 flex flex-col items-start gap-1.5 text-xs">
          {rows.map((d) => <EntwurfChip key={d.id} d={d} className="max-w-full py-1.5" />)}
          <button type="button" onClick={() => navigate('/dashboard/jobs')} className="mt-0.5 text-muted-foreground underline underline-offset-2">
            {t('entry.allDrafts')}
          </button>
        </div>
      )}
    </div>
  );
}

export function PositionEntry({ hasJobs }: { hasJobs: boolean }) {
  const { t } = useTranslation('clientDashboard');
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { rows: drafts } = useEntwuerfe();

  const open = (state?: Record<string, unknown>) => navigate('/dashboard/aufnahme', { state });
  const withFile = (file: File | undefined) => {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      toast.error(t('entry.fileType'));
      return;
    }
    open({ seedFile: file });
  };
  const preview = (what: string) => toast.info(t('entry.previewOnly', { what }));

  const weitermachen = drafts.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-xs">
      <span className="text-muted-foreground">{t('entry.continue')}</span>
      {drafts.map((d) => <EntwurfChip key={d.id} d={d} className="max-w-[220px]" />)}
      <button type="button" onClick={() => navigate('/dashboard/jobs')} className="text-muted-foreground underline underline-offset-2">
        {t('entry.allDrafts')}
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
              <p className="font-semibold">{t('entry.newTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('entry.newLead')}</p>
            </div>
            <Button onClick={() => open()} className="gap-1.5">
              <Plus className="h-4 w-4" /> {t('entry.newButton')}
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
          <h2 className="text-xl font-bold tracking-tight">{t('entry.firstTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('entry.firstLead')}
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
            placeholder={t('entry.placeholder')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => open(text.trim().length >= 10 ? { seedText: text.trim() } : undefined)}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" /> {t('entry.build')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => open()}>
            <Link2 className="h-4 w-4" /> {t('entry.link')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4" /> {t('entry.file')}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => preview('Personio')}>
            <Building2 className="h-4 w-4" /> {t('entry.personio')} <span className="text-[10px]">{t('entry.previewTag')}</span>
          </Button>
          <button type="button" onClick={() => open()} className="text-sm text-muted-foreground underline underline-offset-2">
            {t('entry.manual')}
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
          onClick={() => preview(t('entry.mailFeature'))}
          className="flex items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground hover:text-foreground"
        >
          <Mail className="h-3.5 w-3.5" /> {t('entry.mailHint')}
        </button>
        {weitermachen}
      </CardContent>
    </Card>
  );
}
