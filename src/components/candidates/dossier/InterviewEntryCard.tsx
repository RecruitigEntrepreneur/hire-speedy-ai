import { useEffect, useState } from 'react';
import { FileUp, PhoneCall, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SourceRow {
  id: string;
  kind: string;
  label: string | null;
  created_at: string;
  raw_text: string | null;
  expires_at: string | null;
}

const KIND_LABEL: Record<string, string> = {
  notes: 'Eigene Notizen',
  transcript: 'Transkript',
  photo: 'Foto',
  mail: 'Mail',
  quick: 'Aus dem Kopf',
  live: 'Live-Interview',
};

/**
 * Einstieg ins Kandidateninterview: schon geführt (einwerfen), jetzt live
 * führen oder aus dem Kopf nachtragen. Darunter der Verlauf der Quellen.
 */
export function InterviewEntryCard({
  candidateId,
  hasInterview,
  interviewDate,
  refreshKey,
  onImport,
  onLive,
  onQuick,
}: {
  candidateId: string;
  hasInterview: boolean;
  interviewDate: string | null;
  refreshKey?: number;
  onImport: () => void;
  onLive: () => void;
  onQuick: () => void;
}) {
  const [sources, setSources] = useState<SourceRow[]>([]);

  useEffect(() => {
    supabase
      .from('candidate_capture_sources' as never)
      .select('id, kind, label, created_at, raw_text, expires_at')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => setSources(error ? [] : ((data ?? []) as unknown as SourceRow[])));
  }, [candidateId, refreshKey]);

  const tile = (icon: JSX.Element, title: string, hint: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 rounded-lg border border-border p-3 text-center transition-colors hover:border-primary hover:bg-muted/50">
      {icon}
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Interview</CardTitle>
          <span className="text-xs text-muted-foreground">
            {hasInterview ? `erfasst${interviewDate ? ` am ${new Date(interviewDate).toLocaleDateString('de-DE')}` : ''}` : 'noch keins erfasst'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {tile(<FileUp className="h-5 w-5" />, hasInterview ? 'Nachtrag einwerfen' : 'Schon geführt', 'Notizen, Transkript, Mail', onImport)}
          {tile(<PhoneCall className="h-5 w-5" />, hasInterview ? 'Live fortsetzen' : 'Jetzt live führen', 'Fragen mit dem Kandidaten', onLive)}
          {tile(<Zap className="h-5 w-5" />, 'Aus dem Kopf', 'nichts notiert, schnell nachtragen', onQuick)}
        </div>
        {sources.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-xs">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate">
                  {new Date(s.created_at).toLocaleDateString('de-DE')} · {KIND_LABEL[s.kind] ?? s.kind}
                  {s.label && s.label !== KIND_LABEL[s.kind] ? ` · ${s.label}` : ''}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {s.raw_text == null ? 'Rohtext gelöscht' : s.expires_at ? `Rohtext bis ${new Date(s.expires_at).toLocaleDateString('de-DE')}` : 'Beleg'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
