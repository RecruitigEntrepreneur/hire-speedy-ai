import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Check, Circle, Clock, FileSignature, Mail, ShieldCheck } from 'lucide-react';

/**
 * Die fünf Zustandsachsen als Anzeige.
 *
 * Bewusst getrennt statt als eine Sammelspalte: genau das ist der Grund, warum
 * jobs.status heute mehrdeutig ist. Ein Vorgang kann vollständig aufgenommen,
 * verifiziert und eingereicht sein, während die Konditionsklärung noch offen
 * ist — das muss ablesbar sein, ohne dass es die Prüfliste blockiert.
 */

const TONE = {
  neutral: 'border-border text-muted-foreground',
  progress: 'border-amber-500/40 text-amber-600',
  good: 'border-emerald-600/40 text-emerald-700',
  alert: 'border-destructive/40 text-destructive',
} as const;

type Tone = keyof typeof TONE;

function Chip({ tone, icon: Icon, children, title }: { tone: Tone; icon: any; children: React.ReactNode; title?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1 font-normal', TONE[tone])} title={title}>
      <Icon className="h-3 w-3" />
      {children}
    </Badge>
  );
}

export function CaptureBadge({ state, completeness }: { state: string; completeness?: number }) {
  if (state === 'complete') return <Chip tone="good" icon={Check}>Aufnahme vollständig</Chip>;
  if (state === 'in_progress')
    return <Chip tone="progress" icon={Clock}>In Arbeit{completeness ? ` · ${completeness} %` : ''}</Chip>;
  return <Chip tone="neutral" icon={Circle}>Begonnen</Chip>;
}

export function IdentityBadge({ state, freemail }: { state: string; freemail?: boolean }) {
  if (state === 'email_verified')
    return (
      <Chip tone={freemail ? 'progress' : 'good'} icon={ShieldCheck}
        title={freemail ? 'Verifiziert, aber über eine private E-Mail-Adresse' : undefined}>
        {freemail ? 'Verifiziert (privat)' : 'E-Mail verifiziert'}
      </Chip>
    );
  if (state === 'contact_provided') return <Chip tone="progress" icon={Mail}>Kontakt, nicht bestätigt</Chip>;
  return <Chip tone="neutral" icon={Circle}>Anonym</Chip>;
}

export function CommercialBadge({ state }: { state: string }) {
  if (state === 'confirmed') return <Chip tone="good" icon={Check}>Konditionen bestätigt</Chip>;
  if (state === 'discussion_requested') return <Chip tone="alert" icon={AlertTriangle}>Klärung offen</Chip>;
  if (state === 'declined') return <Chip tone="alert" icon={AlertTriangle}>Abgelehnt</Chip>;
  if (state === 'presented') return <Chip tone="progress" icon={Clock}>Gezeigt</Chip>;
  return <Chip tone="neutral" icon={Circle}>Nicht gezeigt</Chip>;
}

export function ReviewBadge({ state }: { state: string }) {
  if (state === 'accepted') return <Chip tone="good" icon={Check}>Angenommen</Chip>;
  if (state === 'pending_admin') return <Chip tone="progress" icon={Clock}>Zur Prüfung</Chip>;
  if (state === 'changes_requested') return <Chip tone="alert" icon={AlertTriangle}>Rückfrage</Chip>;
  if (state === 'rejected') return <Chip tone="alert" icon={AlertTriangle}>Abgelehnt</Chip>;
  return <Chip tone="neutral" icon={Circle}>Nicht eingereicht</Chip>;
}

export function SignatureBadge({ status }: { status: string | null | undefined }) {
  if (!status || status === 'not_required') return <Chip tone="neutral" icon={Circle}>Keine Unterschrift nötig</Chip>;
  if (status === 'signed') return <Chip tone="good" icon={FileSignature}>Vertrag unterzeichnet</Chip>;
  if (status === 'sent') return <Chip tone="progress" icon={FileSignature}>Vertrag versendet</Chip>;
  if (status === 'declined' || status === 'expired' || status === 'voided')
    return <Chip tone="alert" icon={AlertTriangle}>Vertrag {status === 'declined' ? 'abgelehnt' : status === 'expired' ? 'abgelaufen' : 'aufgehoben'}</Chip>;
  return <Chip tone="progress" icon={Clock}>Vertrag vorzubereiten</Chip>;
}

export function LinkTypeBadge({ type }: { type: string }) {
  const label = type === 'personal' ? 'Persönlich' : type === 'campaign' ? 'Kampagne' : 'Öffentlich';
  return <Badge variant="secondary" className="font-normal">{label}</Badge>;
}

/**
 * Was als Nächstes zu tun ist — die eine Spalte, die der Admin wirklich liest.
 * Abgeleitet aus den fünf Achsen, damit niemand sie im Kopf kombinieren muss.
 */
export function nextStepFor(row: {
  review_state: string;
  identity_state: string;
  capture_state: string;
  commercial_state: string;
  job_id?: string | null;
  signature_status?: string | null;
  job_status?: string | null;
}): { text: string; tone: Tone } {
  if (row.review_state === 'rejected') return { text: 'Abgelehnt — nichts zu tun', tone: 'neutral' };

  if (row.review_state === 'accepted') {
    if (row.signature_status === 'pending') return { text: 'Vertrag über DocuSign versenden', tone: 'progress' };
    if (row.signature_status === 'sent') return { text: 'Auf Unterschrift warten', tone: 'progress' };
    if (row.job_status === 'published') return { text: 'Live — läuft', tone: 'good' };
    return { text: 'Stelle freigeben', tone: 'good' };
  }

  if (row.review_state === 'pending_admin') {
    if (row.commercial_state === 'discussion_requested') return { text: 'Konditionen klären, dann prüfen', tone: 'alert' };
    return { text: 'Prüfen und annehmen', tone: 'progress' };
  }

  if (row.review_state === 'changes_requested') return { text: 'Rückmeldung des Kunden abwarten', tone: 'progress' };

  if (row.identity_state === 'anonymous') return { text: 'Kein Kontakt — abwarten', tone: 'neutral' };
  if (row.identity_state === 'contact_provided') return { text: 'Nachfassen: E-Mail nicht bestätigt', tone: 'alert' };
  if (row.capture_state !== 'complete') return { text: 'Nachfassen: Aufnahme unvollständig', tone: 'alert' };
  return { text: 'Nachfassen: nicht eingereicht', tone: 'alert' };
}

export { TONE as INTAKE_TONE };
export type { Tone as IntakeTone };
