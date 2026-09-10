import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SubmissionReviewData {
  name: string;
  email: string;
  expectedSalary: number | null;
  availability: string | null;
  notes: string;
  criteria: string[];
  createsCandidate: boolean;
}

export function CandidateSubmissionReview({ data, busy, onBack }: { data: SubmissionReviewData; busy: boolean; onBack: () => void }) {
  const date = data.availability ? new Date(data.availability) : null;
  const availability = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('de-DE') : data.availability || 'Nicht angegeben';
  return <div className="space-y-6" aria-label="Vorstellung prüfen">
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4"><Check className="mt-0.5 h-5 w-5 shrink-0" /><div><h3 className="font-medium">Vorstellung prüfen</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{data.createsCandidate ? 'Beim Einreichen wird das neue Kandidatenprofil angelegt und dieser Position zugeordnet.' : 'Beim Einreichen wird das gewählte Kandidatenprofil dieser Position zugeordnet.'} Die Einwilligung zur Weitergabe hast du bestätigt.</p></div></div>
    <dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Kandidat</dt><dd className="mt-1 break-words font-medium">{data.name}</dd></div><div><dt className="text-xs text-muted-foreground">E-Mail</dt><dd className="mt-1 break-all text-sm">{data.email}</dd></div><div><dt className="text-xs text-muted-foreground">Gehaltsvorstellung</dt><dd className="mt-1 text-sm">{data.expectedSalary != null ? data.expectedSalary.toLocaleString('de-DE') + ' €' : 'Nicht angegeben'}</dd></div><div><dt className="text-xs text-muted-foreground">Verfügbar ab</dt><dd className="mt-1 text-sm">{availability}</dd></div></dl>
    {data.criteria.length > 0 && <div><h4 className="text-sm font-medium">Pflichtkriterien aus dem Briefing</h4><ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{data.criteria.map(value => <li key={value}>{value}</li>)}</ul><p className="mt-3 text-xs leading-6 text-muted-foreground">Prüfe, ob deine Begründung konkrete Belege enthält. Ein Stichworttreffer allein bestätigt keine fachliche Eignung.</p></div>}
    <div><h4 className="text-sm font-medium">Deine Begründung</h4><p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-sm leading-7">{data.notes}</p></div>
    <div className="flex flex-wrap gap-3 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onBack} disabled={busy}><ArrowLeft />Angaben bearbeiten</Button><Button type="submit" disabled={busy} className="min-h-10 flex-1 whitespace-normal">{busy ? <><Loader2 className="animate-spin" />Wird eingereicht …</> : 'Jetzt einreichen'}</Button></div>
  </div>;
}
