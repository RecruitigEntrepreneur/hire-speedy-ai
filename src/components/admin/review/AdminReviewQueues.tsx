import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  adminContactReports,
  adminDeclarations,
  adminDecideDeclaration,
  adminJobChanges,
  adminPartnerTiers,
  adminSetPartnerTier,
  adminSetReportStatus,
  errorText,
  fmtDay,
  fmtDayShort,
  proofUrl,
  TIER_LABEL,
  type AdminContactReport,
  type AdminDeclaration,
  type AdminJobChange,
  type AdminPartnerTier,
  type PartnerTier,
} from '@/lib/jobSearch';

const CHANNEL: Record<string, string> = { phone: 'Anruf', email: 'E-Mail', linkedin: 'LinkedIn', other: 'Sonstiges' };
const CLOSE_REASON: Record<string, string> = {
  filled_via_matchunt: 'besetzt mit Kandidat von Matchunt',
  filled_elsewhere: 'anderweitig besetzt',
  no_candidates: 'keine passenden Kandidaten',
  cancelled: 'Stelle entfällt',
};

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function useList<T>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[] | null>(null);
  const reload = useCallback(async () => {
    try {
      setRows((await load()) ?? []);
    } catch (err) {
      setRows([]);
      toast.error(errorText(err));
    }
  }, [load]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { rows, reload };
}

// A1 · Direktkontakt-Meldungen
function ReportsTab() {
  const { rows, reload } = useList<AdminContactReport>(adminContactReports);
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (!rows) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (rows.length === 0) return <Empty text="Keine Meldungen." />;
  const set = async (r: AdminContactReport, status: AdminContactReport['status']) => {
    try {
      await adminSetReportStatus(r.id, status, notes[r.id] ?? r.admin_note ?? '');
      toast.success(status === 'confirmed' ? 'Bestätigt: zählt als schwerer Verstoß, Stufe wird neu berechnet' : 'Gespeichert');
      await reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <div className="divide-y">
      {rows.map((r) => (
        <div key={r.id} className="space-y-1.5 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.recruiter_name}</span>
            <span className="text-muted-foreground">· {r.company_name} · {r.job_title}</span>
            <Badge variant={r.status === 'open' ? 'default' : 'secondary'}>{r.status === 'open' ? 'offen' : r.status === 'confirmed' ? 'bestätigt' : 'verworfen'}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {fmtDay(r.created_at)} · {CHANNEL[r.channel]} · gemeldet von {r.reporter_name || 'Kunde'}
            {r.name_shown_at ? ` · Firmenname gesehen am ${fmtDay(r.name_shown_at)}` : ''}
          </p>
          {r.note && <p className="rounded bg-muted/40 px-2 py-1 text-xs">„{r.note}“</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 max-w-sm text-xs"
              placeholder="Notiz von Matchunt"
              value={notes[r.id] ?? r.admin_note ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />
            <Button size="sm" variant="destructive" onClick={() => set(r, 'confirmed')}>Verstoß bestätigen</Button>
            <Button size="sm" variant="outline" onClick={() => set(r, 'dismissed')}>Verwerfen</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// A2 · Pausiert / geschlossen
function JobChangesTab() {
  const { rows } = useList<AdminJobChange>(adminJobChanges);
  if (!rows) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (rows.length === 0) return <Empty text="Keine pausierten oder geschlossenen Stellen in den letzten 90 Tagen." />;
  return (
    <div className="divide-y">
      {rows.map((j) => (
        <div key={j.job_id} className="space-y-1 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{j.title}</span>
            <span className="text-muted-foreground">· {j.company_name}</span>
            {j.callback_requested_at && <Badge>Rückruf gewünscht {fmtDayShort(j.callback_requested_at)}</Badge>}
            {j.state === 'paused' && <Badge variant="secondary">pausiert bis {fmtDayShort(j.pause_until)}</Badge>}
            {(j.state === 'closed' || j.state === 'filled') && <Badge variant="secondary">{j.state === 'filled' ? 'besetzt' : 'geschlossen'} {fmtDayShort(j.closed_at)}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {j.state === 'paused' && (j.pause_reason ? `Grund: ${j.pause_reason}` : 'ohne Grund')}
            {j.closed_reason && `Grund: ${CLOSE_REASON[j.closed_reason] ?? j.closed_reason}`}
            {j.closed_note ? ` · „${j.closed_note}“` : ''}
            {j.hire_candidate ? ` · eingestellt: ${j.hire_candidate}${j.hire_start ? ` ab ${fmtDay(j.hire_start)}` : ''}${j.hire_salary ? ` · ${j.hire_salary.toLocaleString('de-DE')} €` : ''}` : ''}
            {j.closed_reason === 'filled_elsewhere' && (j.not_matchunt_confirmed ? ' · Kunde bestätigt: keine Person von Matchunt' : '')}
          </p>
          {j.closed_reason === 'filled_elsewhere' && (
            <p className="text-xs text-amber-600">Prüfen: War eine von Matchunt vorgestellte Person dabei?</p>
          )}
          <Link to={`/admin/jobs?job=${j.job_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            Stelle öffnen <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      ))}
    </div>
  );
}

// A3 · Bestandskunden-Meldungen
function DeclarationsTab() {
  const { rows, reload } = useList<AdminDeclaration>(adminDeclarations);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  if (!rows) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (rows.length === 0) return <Empty text="Keine Bestandskunden-Meldungen." />;
  const open = async (path: string | null) => {
    const url = await proofUrl(path);
    if (url) window.open(url, '_blank', 'noopener');
    else toast.error('Beleg nicht gefunden');
  };
  const decide = async (d: AdminDeclaration, decision: 'confirm' | 'reject') => {
    try {
      await adminDecideDeclaration(d.id, decision, reasons[d.id] ?? '');
      toast.success(decision === 'confirm' ? 'Bestätigt' : 'Abgelehnt');
      await reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <div className="divide-y">
      {rows.map((d) => (
        <div key={d.id} className="space-y-1.5 py-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{d.recruiter_name}</span>
            <span className="text-muted-foreground">· {d.company_name}</span>
            <Badge variant="outline">{d.answer === 'direct_position' ? `Stelle schon direkt: ${d.job_title}` : 'Bestandskunde'}</Badge>
            <Badge variant={d.status === 'pending' ? 'default' : 'secondary'}>
              {d.status === 'pending' ? 'offen' : d.status === 'confirmed' ? 'bestätigt' : 'abgelehnt'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            gemeldet {fmtDay(d.created_at)} · Stichtag (erstes „Ich suche“) {fmtDay(d.stichtag)}
            {d.answer === 'direct_position' && ` · Kunde: ${d.client_answer === 'yes' ? 'bestätigt' : d.client_answer === 'no' ? 'verneint' : 'noch keine Antwort'}`}
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button size="sm" variant="outline" disabled={!d.contract_path} onClick={() => open(d.contract_path)}>
              {d.contract_path ? 'Vertrag ansehen' : 'Vertrag fehlt'}
            </Button>
            {d.answer === 'direct_position' && (
              <Button size="sm" variant="outline" disabled={!d.assignment_path} onClick={() => open(d.assignment_path)}>
                {d.assignment_path ? 'Beauftragung ansehen' : 'Beauftragung fehlt'}
              </Button>
            )}
          </div>
          {d.status === 'pending' && (
            <>
              <p className="text-xs text-muted-foreground">
                Prüfen: unterschrieben? Datum vor dem Stichtag? Vertragspartner ist diese Firma?
                {d.answer === 'direct_position' ? ' Beauftragung nennt genau diese Stelle? Hat der Kunde bestätigt?' : ''}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-8 max-w-sm text-xs"
                  placeholder="Grund bei Ablehnung"
                  value={reasons[d.id] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [d.id]: e.target.value }))}
                />
                <Button size="sm" onClick={() => decide(d, 'confirm')}>Bestätigen</Button>
                <Button size="sm" variant="outline" onClick={() => decide(d, 'reject')}>Ablehnen</Button>
              </div>
            </>
          )}
          {d.status === 'rejected' && d.reject_reason && <p className="text-xs text-muted-foreground">Grund: {d.reject_reason}</p>}
        </div>
      ))}
    </div>
  );
}

// A4 · Stufe je Headhunter
function TiersTab() {
  const { rows, reload } = useList<AdminPartnerTier>(adminPartnerTiers);
  const [edit, setEdit] = useState<Record<string, { tier: PartnerTier | ''; reason: string }>>({});
  if (!rows) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (rows.length === 0) return <Empty text="Noch keine Partner." />;
  const save = async (r: AdminPartnerTier, reset = false) => {
    const e = edit[r.user_id];
    try {
      const tier = await adminSetPartnerTier(r.user_id, reset ? null : ((e?.tier || null) as PartnerTier | null), reset ? '' : e?.reason ?? '');
      toast.success(`Stufe jetzt: ${TIER_LABEL[tier]}`);
      setEdit((x) => ({ ...x, [r.user_id]: { tier: '', reason: '' } }));
      await reload();
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  return (
    <div className="divide-y">
      {rows.map((r) => {
        const m = r.metrics;
        const e = edit[r.user_id] ?? { tier: '', reason: '' };
        return (
          <div key={r.user_id} className="space-y-1.5 py-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{r.full_name || r.partner_number}</span>
              {r.company_name && <span className="text-muted-foreground">· {r.company_name}</span>}
              <Badge variant="outline">{TIER_LABEL[r.tier]}</Badge>
              {r.tier_override && <Badge variant="secondary">von Hand: {r.tier_override_reason}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              12 Monate: {m.submissions} Einreichungen · {m.interviews} Kunden-Interviews · {m.placements} Einstellungen · Interview-Quote{' '}
              {m.interview_quote === null ? '–' : `${Math.round(m.interview_quote * 100)} %`} · {m.months_active} Monate dabei
              {m.violation ? ' · Verstoß' : ''}
              {r.tier_valid_until ? ` · gültig bis ${fmtDay(r.tier_valid_until)}` : ''}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                value={e.tier}
                onChange={(ev) => setEdit((x) => ({ ...x, [r.user_id]: { ...e, tier: ev.target.value as PartnerTier | '' } }))}
              >
                <option value="">Stufe von Hand …</option>
                <option value="partner">Partner</option>
                <option value="silver">Silber Partner</option>
                <option value="gold">Gold Partner</option>
              </select>
              <Input
                className="h-8 max-w-xs text-xs"
                placeholder="Begründung (Pflicht)"
                value={e.reason}
                onChange={(ev) => setEdit((x) => ({ ...x, [r.user_id]: { ...e, reason: ev.target.value } }))}
              />
              <Button size="sm" variant="outline" disabled={!e.tier || !e.reason.trim()} onClick={() => save(r)}>Festlegen</Button>
              {r.tier_override && (
                <Button size="sm" variant="ghost" onClick={() => save(r, true)}>Automatik</Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Prüfungen der Recruiterverwaltung: Direktkontakte (A1), pausierte und geschlossene
 * Stellen (A2), Bestandskunden mit Belegen (A3) und Partnerstufen (A4).
 */
export function AdminReviewQueues() {
  return (
    <Card id="pruefungen">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Prüfungen</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="reports">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="reports">Direktkontakte</TabsTrigger>
            <TabsTrigger value="jobs">Pausiert / geschlossen</TabsTrigger>
            <TabsTrigger value="declarations">Bestandskunden</TabsTrigger>
            <TabsTrigger value="tiers">Partnerstufen</TabsTrigger>
          </TabsList>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          <TabsContent value="jobs"><JobChangesTab /></TabsContent>
          <TabsContent value="declarations"><DeclarationsTab /></TabsContent>
          <TabsContent value="tiers"><TiersTab /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
