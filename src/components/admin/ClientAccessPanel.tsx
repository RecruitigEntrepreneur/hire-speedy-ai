import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { KeyRound, Loader2, Mail, RefreshCw, TriangleAlert } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useIntakeAccess, useIntakeAction, useSignatureRefresh } from '@/hooks/useAdminIntakes';
import { accessState, ACCESS_LABEL, type AccessState } from '@/lib/clientAccessState';

const fmt = (v: string | null | undefined) => (v ? format(new Date(v), 'dd.MM.yyyy HH:mm', { locale: de }) : null);

const TONE: Record<AccessState, string> = {
  sent: 'border-success/40 bg-success/10 text-success',
  held: 'border-warning/40 bg-warning/10 text-warning',
  failed: 'border-destructive/40 bg-destructive/10 text-destructive',
  missing: 'border-warning/40 bg-warning/10 text-warning',
  waiting_accept: 'border-warning/40 bg-warning/10 text-warning',
  waiting_contract: '',
};

/**
 * Zugang des Kunden (Entscheidung 25.09.2026): Mit unserer Gegenzeichnung
 * bekommt der Kunde die Mail „Jetzt loslegen“. Hier sieht Matchunt, ob sie
 * raus ist, ob er sich schon angemeldet hat, und kann nachhelfen: Stand bei
 * DocuSign holen, Mail erneut senden, ein Headhunter-Konto zum Kunden machen.
 */
export function ClientAccessPanel({ draftId, hasEnvelope }: { draftId: string; hasEnvelope: boolean }) {
  const { data, isLoading, error } = useIntakeAccess(draftId);
  const action = useIntakeAction(draftId);
  const refresh = useSignatureRefresh(draftId);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const run = async (payload: Record<string, unknown>, success: string) => {
    try {
      await action.mutateAsync(payload);
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
    }
  };
  const fetchSignature = async () => {
    try {
      const res = await refresh.mutateAsync();
      toast.success(`DocuSign: ${res.summary}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Stand nicht abrufbar.');
    }
  };

  const state = data ? accessState(data) : null;
  const busy = action.isPending || refresh.isPending;
  const account = data?.account ?? null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" /> Zugang des Kunden
          </p>
          {state && <Badge variant="outline" className={TONE[state]}>{ACCESS_LABEL[state]}</Badge>}
        </div>

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {error && <p className="text-sm text-destructive">{error instanceof Error ? error.message : 'Nicht ladbar.'}</p>}

        {data && (
          <dl className="space-y-1.5 text-sm">
            {[
              ['Konto', account
                ? `${account.email ?? '—'} · ${account.roles.includes('recruiter') ? 'Headhunter' : account.roles.includes('client') ? 'Kunde' : account.roles.join(', ') || 'ohne Rolle'}`
                : 'wird bei der Annahme angelegt'],
              ['Zugangsmail', data.mail
                ? `${fmt(data.mail.created_at)}${data.mail.status === 'sent' ? '' : ` · ${data.mail.error_message ?? data.mail.status}`}`
                : state === 'waiting_contract' ? 'geht mit der Gegenzeichnung raus' : 'noch keine'],
              ['Passwort festgelegt', account ? (fmt(account.password_set_at) ?? 'noch nicht') : '—'],
              ['Zuletzt angemeldet', account ? (fmt(account.last_sign_in_at) ?? 'noch nie') : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
                <dt className="w-52 shrink-0 text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {state === 'held' && (
          <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              Diese Adresse gehört zu einem Headhunter-Konto. Deshalb ist kein Kundenzugang angelegt und keine Mail
              an den Kunden rausgegangen.
            </p>
            {confirmSwitch ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Das Konto verliert den Headhunter-Zugang. Umstellen?</span>
                <Button size="sm" disabled={busy}
                  onClick={() => run({ action: 'make_client' }, 'Als Kunde umgestellt.').then(() => setConfirmSwitch(false))}>
                  {action.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Ja, umstellen und senden
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmSwitch(false)}>Abbrechen</Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirmSwitch(true)}>
                Als Kunde umstellen und senden
              </Button>
            )}
          </div>
        )}

        {data && state !== 'held' && (
          <div className="flex flex-wrap gap-2">
            {data.accepted && (
              <Button size="sm" variant="outline" className="gap-1.5" disabled={busy}
                onClick={() => run({ action: 'resend_access' }, 'Zugangsmail gesendet.')}>
                {action.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                {data.mail ? 'Zugangsmail erneut senden' : 'Zugangsmail senden'}
              </Button>
            )}
            {hasEnvelope && !data.countersigned && (
              <Button size="sm" variant="outline" className="gap-1.5" disabled={busy} onClick={fetchSignature}>
                {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Stand bei DocuSign abfragen
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
