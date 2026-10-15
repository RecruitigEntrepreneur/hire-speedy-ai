import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, FileText, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  ROLE_LABEL, companyAddress, companyLabel,
  type ClientCompany, type CompanyData,
} from '@/hooks/useClientCompanies';
import { compareWithImpressum, type CheckReport, type FieldCheck } from '@/lib/companyCheck';

/**
 * Admin › Control Center: Firmen, die Kunden beantragt oder geändert haben.
 * Matchunt gleicht mit dem Impressum ab und entscheidet (admin_decide_company).
 * Nur nach der Verifizierung darf ein Kunde Stellen für die Firma einreichen.
 */
interface Row extends ClientCompany {
  check_report: CheckReport | null;
  checked_at: string | null;
  requested_by: string | null;
  requester: string | null;
  mainName: string | null;
}

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '');

async function loadQueue(): Promise<Row[]> {
  const { data, error } = await (supabase as any)
    .from('client_companies')
    .select('*')
    .or('status.eq.pending,pending_change.not.is.null')
    .order('requested_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as (ClientCompany & { check_report: CheckReport | null; checked_at: string | null; requested_by: string | null })[];
  if (!rows.length) return [];
  const owners = [...new Set(rows.map((r) => r.owner_id))];
  const people = [...new Set(rows.map((r) => r.requested_by ?? r.owner_id))];
  const [{ data: mains }, { data: profiles }] = await Promise.all([
    (supabase as any).from('client_companies').select('owner_id, name, legal_name').eq('role', 'main').in('owner_id', owners),
    supabase.from('profiles').select('user_id, full_name').in('user_id', people),
  ]);
  const mainOf = new Map(((mains ?? []) as { owner_id: string; name: string; legal_name: string | null }[]).map((m) => [m.owner_id, companyLabel(m)]));
  const nameOf = new Map(((profiles ?? []) as { user_id: string; full_name: string | null }[]).map((p) => [p.user_id, p.full_name]));
  return rows.map((r) => ({
    ...r,
    requester: nameOf.get(r.requested_by ?? r.owner_id) ?? null,
    mainName: r.role === 'main' ? null : mainOf.get(r.owner_id) ?? null,
  }));
}

export function FirmenPruefen() {
  const [params, setParams] = useSearchParams();
  const { data: rows = [], isError } = useQuery({ queryKey: ['admin-company-queue'], queryFn: loadQueue, retry: false, staleTime: 30_000 });
  const [openId, setOpenId] = useState<string | null>(params.get('firma'));
  const open = rows.find((r) => r.id === openId) ?? null;

  const offen = rows.filter((r) => !r.admin_question);
  const wartet = rows.filter((r) => r.admin_question);

  // Benachrichtigung „Firma zur Prüfung“ öffnet direkt den Vorgang (?firma=).
  useEffect(() => {
    const id = params.get('firma');
    if (id) setOpenId(id);
  }, [params]);

  const close = () => {
    setOpenId(null);
    if (params.get('firma')) { params.delete('firma'); setParams(params, { replace: true }); }
  };

  if (isError || !rows.length) return null;

  const line = (r: Row) => (
    <button
      key={r.id}
      type="button"
      onClick={() => setOpenId(r.id)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background p-3 text-left hover:bg-muted/50"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{companyLabel(r.pending_change ?? r)}</span>
        <span className="block text-xs text-muted-foreground">
          {r.pending_change ? 'Änderung' : r.mainName ? `${ROLE_LABEL[r.role]} von ${r.mainName}` : ROLE_LABEL[r.role]}
          {' · '}beantragt {fmt(r.requested_at)}{r.requester ? ` von ${r.requester}` : ''}
          {r.admin_question && ' · wartet auf Antwort des Kunden'}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">Prüfen <ArrowRight className="h-3.5 w-3.5" /></span>
    </button>
  );

  return (
    <Card className="border-blue-500/50 bg-blue-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-blue-600" />
          Firmen prüfen · {offen.length} offen
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {offen.map(line)}
        {wartet.length > 0 && (
          <>
            <p className="pt-2 text-xs text-muted-foreground">Rückfrage gestellt</p>
            {wartet.map(line)}
          </>
        )}
      </CardContent>
      {open && <PruefDialog row={open} onClose={close} />}
    </Card>
  );
}

const FIELDS: { key: keyof CompanyData | 'address'; label: string }[] = [
  { key: 'legal_name', label: 'Name laut Register' },
  { key: 'registration_number', label: 'Handelsregister' },
  { key: 'vat_id', label: 'USt-IdNr.' },
  { key: 'address', label: 'Anschrift' },
  { key: 'website', label: 'Website' },
];

const valueOf = (c: CompanyData, key: keyof CompanyData | 'address') =>
  key === 'address' ? companyAddress(c) : key === 'legal_name' ? companyLabel(c) : (c[key] ?? '') || '';

function CheckMark({ check }: { check: FieldCheck | undefined }) {
  if (!check) return null;
  const style = {
    ok: 'text-emerald-600',
    diff: 'text-amber-600',
    missing: 'text-muted-foreground',
    empty: 'text-muted-foreground',
  }[check.status];
  return <span className={cn('text-xs', style)}>{check.text}</span>;
}

function PruefDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const qc = useQueryClient();
  // Geprüft wird, was gelten soll: bei einer Änderung die neuen Daten.
  const next: CompanyData = row.pending_change ?? row;
  const [report, setReport] = useState<CheckReport | null>(row.check_report);
  const [checking, setChecking] = useState(false);
  const [mode, setMode] = useState<'question' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const proofPath = row.pending_change ? (row.pending_change as { proof_path?: string | null }).proof_path ?? row.proof_path : row.proof_path;

  const runCheck = async () => {
    if (!next.website) {
      setReport({ checked_via: 'none', url: null, fields: {}, note: 'Keine Website angegeben – Abgleich nicht möglich.' });
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.functions.invoke('enrich-company-from-domain', { body: { domain: next.website } });
    setChecking(false);
    const res = data as { data?: Record<string, string | undefined>; impressum?: { found?: boolean; url?: string | null } } | null;
    const r = error || !res
      ? { checked_via: 'none' as const, url: null, fields: {}, note: 'Website konnte nicht gelesen werden.' }
      : compareWithImpressum(next, res.data ?? {}, res.impressum?.found ? res.impressum?.url ?? null : null);
    setReport(r);
    await (supabase as any).from('client_companies').update({ check_report: r, checked_at: new Date().toISOString() }).eq('id', row.id);
  };

  // Beim ersten Öffnen einmal automatisch abgleichen.
  useEffect(() => {
    if (!row.check_report) void runCheck();
    if (proofPath) {
      void supabase.storage.from('company-proofs').createSignedUrl(proofPath, 600).then(({ data }) => setProofUrl(data?.signedUrl ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row.id]);

  const decide = async (decision: 'verify' | 'reject' | 'question') => {
    setBusy(true);
    const { error } = await (supabase as any).rpc('admin_decide_company', { p_id: row.id, p_decision: decision, p_note: decision === 'verify' ? null : note });
    if (!error) {
      // Mail an den Kunden; scheitert sie, bleibt die Benachrichtigung im Konto.
      void supabase.functions.invoke('company-decision-notify', { body: { companyId: row.id, decision } }).catch(() => undefined);
    }
    setBusy(false);
    if (error) {
      toast.error(error.message || 'Das hat nicht geklappt.');
      return;
    }
    toast.success(decision === 'verify' ? (row.pending_change ? 'Änderung übernommen' : 'Firma verifiziert') : decision === 'reject' ? 'Abgelehnt' : 'Rückfrage gesendet');
    await qc.invalidateQueries({ queryKey: ['admin-company-queue'] });
    onClose();
  };

  const changed = useMemo(
    () => (row.pending_change ? FIELDS.filter((f) => valueOf(row, f.key) !== valueOf(row.pending_change!, f.key)) : []),
    [row],
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{companyLabel(next)}</DialogTitle>
          <DialogDescription>
            {row.pending_change ? 'Änderung einer verifizierten Firma' : row.mainName ? `${ROLE_LABEL[row.role]} von ${row.mainName}` : ROLE_LABEL[row.role]}
            {' · '}beantragt {fmt(row.requested_at)}{row.requester ? ` von ${row.requester}` : ''}
          </DialogDescription>
        </DialogHeader>

        {row.admin_question && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Deine Rückfrage: {row.admin_question} – der Kunde hat noch nicht geantwortet.
          </p>
        )}

        {row.pending_change && (
          <div className="rounded-lg border">
            <div className="grid grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
              <span /> <span>Bisher</span> <span>Neu</span>
            </div>
            {FIELDS.map((f) => {
              const a = valueOf(row, f.key);
              const b = valueOf(row.pending_change!, f.key);
              return (
                <div key={f.key} className="grid grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 px-3 py-1.5 text-sm">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className={cn('break-words', a !== b && 'text-muted-foreground line-through')}>{a || '–'}</span>
                  <span className={cn('break-words', a !== b && 'font-medium')}>{b || '–'}</span>
                </div>
              );
            })}
            {changed.length === 0 && <p className="px-3 pb-2 text-xs text-muted-foreground">Keine Änderung an den Daten (nur Beleg oder Verbindung).</p>}
          </div>
        )}

        <div className="rounded-lg border">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">
              Abgleich mit dem Impressum
              {report?.url && <> · <a href={report.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">Seite öffnen</a></>}
            </span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={checking} onClick={() => void runCheck()}>
              {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {report ? 'Erneut abgleichen' : 'Abgleichen'}
            </Button>
          </div>
          {FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 px-3 py-1.5 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,14rem)]">
              <span className="text-xs text-muted-foreground">{f.label}</span>
              <span className="break-words">{valueOf(next, f.key) || '–'}</span>
              <span className="col-start-2 sm:col-start-auto">{checking ? <span className="text-xs text-muted-foreground">wird geprüft …</span> : <CheckMark check={report?.fields[f.key]} />}</span>
            </div>
          ))}
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] gap-x-3 px-3 py-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Beleg</span>
            {proofPath ? (
              proofUrl
                ? <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-2"><FileText className="h-3.5 w-3.5" />{proofPath.split('/').pop()?.replace(/^\d+-/, '')}</a>
                : <span className="text-muted-foreground">wird geladen …</span>
            ) : <span className="text-muted-foreground">keiner (optional)</span>}
          </div>
          {report?.note && <p className="px-3 pb-2 text-xs text-muted-foreground">{report.note}</p>}
          {report?.checked_via === 'impressum' && (
            <p className="px-3 pb-2 text-[11px] text-muted-foreground">USt-IdNr. nur auf Format und Impressum geprüft, nicht beim Bundeszentralamt.</p>
          )}
        </div>

        {mode ? (
          <div className="space-y-2">
            <Textarea
              autoFocus
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === 'question' ? 'Was soll der Kunde ergänzen? Zum Beispiel: „Bitte Handelsregisterauszug hochladen.“' : 'Grund für den Kunden, z. B. „Firma laut Register nicht mit Ihrem Konto verbunden.“'}
            />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => { setMode(null); setNote(''); }} disabled={busy}>Zurück</Button>
              <Button variant={mode === 'reject' ? 'destructive' : 'default'} disabled={busy || !note.trim()} onClick={() => void decide(mode)}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === 'question' ? 'Rückfrage senden' : row.pending_change ? 'Änderung ablehnen' : 'Ablehnen'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Der Kunde bekommt eine Benachrichtigung und eine Mail.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setMode('question')} disabled={busy}>Rückfrage an Kunden</Button>
              <Button variant="outline" onClick={() => setMode('reject')} disabled={busy}>Ablehnen …</Button>
              <Button onClick={() => void decide('verify')} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {row.pending_change ? 'Änderung übernehmen' : 'Verifizieren'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
