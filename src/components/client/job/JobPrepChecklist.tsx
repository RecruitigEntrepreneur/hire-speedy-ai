import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, UserPlus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { useCalendarStatus } from '@/components/interview/calendar/useCalendarStatus';
import { useTeamData } from '@/hooks/useTeamData';
import { fehlendeAuftrittAngaben, useCompanyProfile } from '@/components/client/settings/useCompanyProfile';
import { cn } from '@/lib/utils';

// Inhaber, Admin und HR sehen alle Stellen; Fachbereich und Nur lesen brauchen Zugriff auf diese Stelle.
const SIEHT_ALLE = ['owner', 'admin', 'hr'];

type Punkt = { key: string; titel: string; text: string; erledigt: boolean; aktion?: ReactNode };

/**
 * „Damit es nach dem Start schnell geht“: was der Kunde in der Prüfzeit vorbereiten
 * kann -- Kalender, Kollegen, Firmenauftritt. Jeder Punkt erscheint nur für Rollen,
 * die ihn erledigen dürfen (Einladen: Inhaber/Admin, Auftritt: Inhaber).
 */
export function JobPrepChecklist({ jobId, jobTitle, organizationId, userId, canInvite, isOwner }: {
  jobId: string;
  jobTitle: string;
  organizationId: string | null;
  userId: string | undefined;
  canInvite: boolean;
  isOwner: boolean;
}) {
  const { t } = useTranslation('clientJobs');
  const navigate = useNavigate();
  const calendar = useCalendarStatus();
  const team = useTeamData(canInvite && organizationId ? organizationId : undefined);
  const company = useCompanyProfile();

  const laedt = calendar.isLoading || (canInvite && !!organizationId && team.isLoading) || (isOwner && company.loading);
  if (laedt) return null;

  const punkte: Punkt[] = [];

  const verbunden = calendar.state === 'connected';
  punkte.push({
    key: 'kalender',
    titel: verbunden ? t('prep.calendarDone') : t('prep.calendar'),
    text: verbunden
      ? t('prep.calendarDoneText', { provider: calendar.status?.provider === 'microsoft' ? 'Outlook' : t('prep.calendarWord') })
      : t('prep.calendarText'),
    erledigt: verbunden,
    aktion: verbunden
      ? <button type="button" className="text-xs text-primary hover:underline" onClick={() => navigate('/dashboard/settings?bereich=kalender')}>{t('prep.change')}</button>
      : <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/settings?bereich=kalender')}>{t('prep.connect')}</Button>,
  });

  if (canInvite && organizationId) {
    const kollegen = (team.data?.members ?? []).filter((m) =>
      m.user_id !== userId && m.status !== 'inactive' && (SIEHT_ALLE.includes(m.role) || m.assigned_jobs.some((j) => j.id === jobId)));
    const dabei = kollegen.length > 0;
    punkte.push({
      key: 'team',
      titel: dabei ? t('prep.teamDone') : t('prep.team'),
      text: dabei
        ? (() => {
          const names = kollegen.map((m) => m.full_name || m.email).filter(Boolean).slice(0, 3).join(', ');
          return kollegen.length > 3
            ? t('prep.teamSeesMore', { names, count: kollegen.length - 3 })
            : t('prep.teamSees', { names, count: kollegen.length });
        })()
        : t('prep.teamText'),
      erledigt: dabei,
      aktion: (
        <InviteMemberDialog
          organizationId={organizationId}
          jobContext={{ id: jobId, title: jobTitle }}
          onSuccess={() => void team.refetch()}
          trigger={dabei
            ? <button type="button" className="text-xs text-primary hover:underline">{t('prep.inviteMore')}</button>
            : <Button variant="outline" size="sm" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />{t('prep.invite')}</Button>}
        />
      ),
    });
  }

  if (isOwner) {
    const offen = [
      ...fehlendeAuftrittAngaben(company.profile).map((f) => t(`prep.missing.${f.feld}`)),
      ...(company.profile.logo_url ? [] : [t('prep.missing.logo')]),
    ];
    punkte.push({
      key: 'auftritt',
      titel: offen.length ? t('prep.profile') : t('prep.profileDone'),
      text: offen.length
        ? t('prep.profileText', { items: offen.join(', ') })
        : t('prep.profileDoneText'),
      erledigt: offen.length === 0,
      aktion: offen.length
        ? <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/settings?bereich=auftritt')}>{t('prep.complete')}</Button>
        : undefined,
    });
  }

  const fertig = punkte.filter((p) => p.erledigt).length;

  if (fertig === punkte.length) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card px-5 py-3 text-sm">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>
        {t('prep.allDone')}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium">{t('prep.title')}</h3>
          <span className="text-xs text-muted-foreground">{t('prep.progress', { done: fertig, total: punkte.length })}</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(fertig / punkte.length) * 100}%` }} />
        </div>
        <ul className="mt-1">
          {punkte.map((p) => (
            <li key={p.key} className="flex items-start gap-3 border-t py-3 first:border-t-0">
              <span className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                p.erledigt ? 'bg-emerald-500/15 text-emerald-700' : 'border-[1.5px] border-muted-foreground/40')}>
                {p.erledigt && <Check className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">{p.titel}</p>
                <p className="text-xs leading-5 text-muted-foreground">{p.text}</p>
              </div>
              {p.aktion && <div className="shrink-0">{p.aktion}</div>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
