import { useNavigate } from 'react-router-dom';
import { ExternalLink, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useClientCandidateView } from '@/hooks/useClientCandidateView';

interface Props {
  submissionId: string;
  /** kompakt: nur Eckdaten (Spalte neben dem Leitfaden) */
  compact?: boolean;
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}

/** Kandidat im Interview-Fenster – reveal-sicher aus der client_candidate_view. */
export function CandidateFacts({ submissionId, compact = false }: Props) {
  const navigate = useNavigate();
  const { data: c, loading, error } = useClientCandidateView(submissionId);

  if (loading) {
    return <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Kandidat wird geladen …</div>;
  }
  if (error || !c) return <p className="py-6 text-sm text-muted-foreground">Die Kandidatendaten konnten nicht geladen werden.</p>;

  const facts = (
    <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3')}>
      <Fact label="Aktuell" value={c.currentRole} />
      <Fact label="Erfahrung" value={c.experience} />
      <Fact label="Region" value={c.region} />
      <Fact label="Gehaltswunsch" value={c.salaryRange} />
      <Fact label="Verfügbar" value={c.availability} />
      <Fact label="Arbeitsmodell" value={c.workModel} />
    </div>
  );

  const skills = c.topSkills.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {c.topSkills.slice(0, compact ? 8 : 16).map((s) => (
        <span key={s} className="rounded-full border px-2 py-0.5 text-xs">{s}</span>
      ))}
    </div>
  );

  const cv = c.cvUrl ? (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open(c.cvUrl!, '_blank', 'noopener')}>
      <FileText className="h-3.5 w-3.5" /> Lebenslauf öffnen
    </Button>
  ) : (
    <p className="text-xs text-muted-foreground">{c.identityUnlocked ? 'Kein Lebenslauf hinterlegt.' : 'Lebenslauf nach der Freigabe.'}</p>
  );

  if (compact) {
    return (
      <div className="space-y-3">
        {facts}
        {skills}
        {cv}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {facts}
      {skills}
      {c.languageSkills.length > 0 && (
        <Fact label="Sprachen" value={c.languageSkills.map((l) => `${l.language}${l.level ? ` (${l.level})` : ''}`).join(', ')} />
      )}
      {c.certifications.length > 0 && <Fact label="Zertifikate" value={c.certifications.join(', ')} />}
      {c.recruiterNotes && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">Headhunter-Notiz</p>
          <p className="whitespace-pre-line rounded-md bg-muted/40 px-3 py-2 text-sm">{c.recruiterNotes}</p>
        </div>
      )}
      {c.executiveSummary && (
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">Kurzprofil</p>
          <p className="text-sm">{c.executiveSummary}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {cv}
        <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={() => navigate(`/dashboard/candidates/${submissionId}`)}>
          <ExternalLink className="h-3.5 w-3.5" /> Vollständiges Profil
        </Button>
      </div>
    </div>
  );
}
