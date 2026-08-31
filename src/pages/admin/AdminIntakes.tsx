import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Inbox, Loader2, Search, TrendingUp } from 'lucide-react';
import {
  CaptureBadge, CommercialBadge, IdentityBadge, INTAKE_TONE, nextStepFor,
} from '@/components/admin/IntakeStateBadges';
import { useAdminIntakes, useIntakeCounts, type IntakeTab } from '@/hooks/useAdminIntakes';

/**
 * Jobaufnahmen aus den Aufnahme-Links.
 *
 * Drei getrennte Listen, weil sie drei verschiedene Arbeiten sind:
 *   Prüfen    — eingereichte Beauftragungsanfragen. Auch dann, wenn die
 *               Konditionsklärung noch offen ist: das war ausdrücklich gefordert
 *               und ist der Grund für getrennte Zustandsachsen.
 *   Nachfassen — begonnene Aufnahmen mit Kontaktdaten. Vertriebsarbeit, keine
 *               Prüfarbeit — sie darf die Prüfliste nicht überladen.
 *   Alle       — der Rest, inklusive abgelehnter und abgelaufener Vorgänge.
 */
export default function AdminIntakes() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<IntakeTab>('queue');
  const [search, setSearch] = useState('');

  const { data: rows = [], isLoading, error } = useAdminIntakes(tab, search);
  const { data: counts } = useIntakeCounts();

  const stats = useMemo(
    () => [
      { label: 'Zur Prüfung', value: counts?.queue ?? 0, icon: Inbox, alert: (counts?.queue ?? 0) > 0 },
      { label: 'Nachfassen', value: counts?.followup ?? 0, icon: Clock, alert: false },
      { label: 'Konditionen offen', value: counts?.termsOpen ?? 0, icon: AlertTriangle, alert: (counts?.termsOpen ?? 0) > 0 },
      { label: 'Neu in 7 Tagen', value: counts?.thisWeek ?? 0, icon: TrendingUp, alert: false },
    ],
    [counts],
  );

  const ago = (iso: string | null) =>
    iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: de }) : '—';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobaufnahmen</h1>
          <p className="text-sm text-muted-foreground">
            Beauftragungsanfragen aus den Aufnahme-Links — prüfen, annehmen, nachfassen.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className={cn(s.alert && 'border-warning/50 bg-warning/5')}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as IntakeTab)}>
            <TabsList>
              <TabsTrigger value="queue" className="gap-2">
                Zur Prüfung
                {(counts?.queue ?? 0) > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-[11px]">{counts!.queue}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="followup" className="gap-2">
                Nachfassen
                {(counts?.followup ?? 0) > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[11px]">{counts!.followup}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">Alle</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative ml-auto w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Firma, Kontakt oder Position"
              className="pl-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">
                Die Aufnahmen konnten nicht geladen werden. Möglicherweise ist die Migration noch nicht
                angewandt — siehe LOVABLE_DB_PROMPTS.md.
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                {tab === 'queue'
                  ? 'Keine offenen Beauftragungsanfragen.'
                  : tab === 'followup'
                  ? 'Nichts nachzufassen — alle begonnenen Aufnahmen sind eingereicht.'
                  : 'Noch keine Aufnahmen über Links.'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unternehmen</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Stand</TableHead>
                    <TableHead>Nächster Schritt</TableHead>
                    <TableHead className="text-right">Zuletzt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const next = nextStepFor(r);
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/admin/intakes/${r.id}`)}
                      >
                        <TableCell>
                          <div className="font-medium">{r.company_name || 'Unbenannt'}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.contact_name || '—'}
                            {r.contact_email && <> · {r.contact_email}</>}
                          </div>
                          {r.is_freemail && (
                            <Badge variant="outline" className="mt-1 border-amber-500/40 text-[10px] font-normal text-amber-600">
                              private Adresse
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[220px] truncate">{r.title || '—'}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.contract_type === 'freelance' ? 'Contracting' : 'Festanstellung'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <CaptureBadge state={r.capture_state} completeness={r.completeness} />
                            <IdentityBadge state={r.identity_state} freemail={r.is_freemail} />
                            <CommercialBadge state={r.commercial_state} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-sm', INTAKE_TONE[next.tone].split(' ').pop())}>
                            {next.text}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                          {ago(r.submitted_at ?? r.last_activity_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {tab === 'followup' && rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Begonnene Aufnahmen werden 30 Tage nach der letzten Aktivität gelöscht. Wer hier steht,
            hat Kontaktdaten hinterlassen — ein Anruf ist erlaubt und meistens der schnellere Weg.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
