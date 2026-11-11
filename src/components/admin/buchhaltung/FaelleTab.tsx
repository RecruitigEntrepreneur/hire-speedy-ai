import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  buchhaltungApi, dateDe, dateShort, eur, euroInput, openPdf, parseEuro, todayIso, type CaseItem,
} from '@/lib/buchhaltungApi';
import { Box, CheckList, Empty, ErrorLine, Loading, errText, useRefresh } from './ui';

export type FallOpen = { kind: 'case'; claimId: string } | { kind: 'joker' | 'start' | 'research'; placementId: string } | null;

/** A8 Fälle: Prüfen, Nachbesetzung läuft, wartet auf Kunde, Antritt unklar, Hinweise. */
export function FaelleTab({ onOpen }: { onOpen: (o: FallOpen) => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'faelle'], queryFn: () => buchhaltungApi.cases() });
  const [busy, setBusy] = useState<string | null>(null);
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorLine error={q.error} />;
  const items = q.data.items;
  if (!items.length) return <Empty>Kein Fall offen.</Empty>;
  const done = async (i: CaseItem) => {
    setBusy(i.id);
    try { await buchhaltungApi.reportHandled(i.id); toast.success('Als erledigt markiert.'); refresh(); } catch (e) { toast.error(errText(e)); } finally { setBusy(null); }
  };
  const open = (i: CaseItem) => {
    if (i.kind === 'claim') onOpen({ kind: 'case', claimId: i.id });
    else if (i.kind === 'joker') onOpen({ kind: 'joker', placementId: i.placementId! });
    else if (i.kind === 'start') onOpen({ kind: 'start', placementId: i.placementId! });
    else if (i.kind === 'research' || i.kind === 'waiting') onOpen({ kind: 'research', placementId: i.placementId! });
  };
  return (
    <div className="space-y-3">
      <div className="divide-y rounded-lg border">
        {items.map((i) => (
          <div key={`${i.kind}-${i.id}`} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="w-32 shrink-0 text-xs text-muted-foreground">{i.group}</span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{i.title}</p>
              <p className={cn('text-xs text-muted-foreground', i.warn && 'text-destructive')}>{i.detail}</p>
            </div>
            {i.kind === 'report' ? (
              <div className="flex gap-1">
                {i.ownerId && <Button size="sm" variant="ghost" asChild><Link to={`/admin/zusammenarbeit/${i.ownerId}`}>Zusammenarbeit</Link></Button>}
                <Button size="sm" variant="outline" disabled={busy === i.id} onClick={() => done(i)}>Erledigt</Button>
              </div>
            ) : i.action ? (
              <Button size="sm" variant={['claim', 'joker', 'start'].includes(i.kind) ? 'default' : 'outline'} onClick={() => open(i)}>{i.action}</Button>
            ) : null}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Fristen und Zahlung prüft die App, den Grund beurteilt ein Mensch. Nach „Anerkennen“ bekommt der Kunde die Aufgabe „Position bestätigen“; danach wird die Stelle für alle ausgeschrieben.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fall prüfen (A8)
// ---------------------------------------------------------------------------

export function FallDialog({ claimId, onClose }: { claimId: string | null; onClose: () => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'fall', claimId], queryFn: () => buchhaltungApi.caseDetail(claimId!), enabled: !!claimId, retry: false, staleTime: 0 });
  const [mode, setMode] = useState<'accept' | 'reject' | 'client_sphere'>('accept');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMode('accept'); setReason(''); }, [claimId]);
  const d = q.data;
  const decide = async () => {
    if (!d) return;
    setBusy(true);
    try {
      await buchhaltungApi.decideCase(d.claim.id, mode, reason.trim() || undefined, mode === 'accept' ? reason.trim() || undefined : undefined);
      toast.success(mode === 'accept' ? 'Anerkannt. Der Kunde bestätigt jetzt die Position.' : mode === 'client_sphere' ? 'Festgehalten: Grund liegt beim Kunden.' : 'Abgelehnt.');
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const c = d ? (mode === 'client_sphere' ? d.clientSphere : d.consequences) : null;
  return (
    <Dialog open={!!claimId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle>{d ? `${d.claim.kind === 'non_start' ? 'Nicht angefangen' : 'Besetzung endet'} · ${d.placement.candidateName}` : 'Fall prüfen'}</DialogTitle>
          <DialogDescription>
            {d ? [d.placement.companyName, `${d.placement.packageLabel}${d.placement.continuityEnd ? ` bis ${dateDe(d.placement.continuityEnd)}` : ''}`, d.placement.recruiterName, `Fassung ${d.placement.conditionsVersion}`].filter(Boolean).join(' · ') : 'Lädt …'}
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <ErrorLine error={q.error} /> : d && c && (
          <div className="space-y-4 text-sm">
            <CheckList checks={d.checks} />
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="w-4 text-center text-muted-foreground">?</span>
              <span className="flex-1">Grund laut {d.placement.companyName}: {d.claim.reasonText}{d.claim.note ? ` · „${d.claim.note}“` : ''}</span>
              {d.documents.map((doc) => <Button key={doc.path} size="sm" variant="ghost" className="h-7" onClick={() => openPdf(() => buchhaltungApi.caseDocument(doc.path)).catch((e) => toast.error(errText(e)))}>{doc.label}</Button>)}
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Stellungnahme {d.placement.recruiterFirst ?? 'Headhunter'}{d.claim.statementAt ? ` · ${dateShort(d.claim.statementAt)}` : ''}</p>
              <p>{d.claim.statement ? `„${d.claim.statement}“` : 'Noch keine Stellungnahme.'}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Box title={d.placement.companyName} value={c.client.title} lines={c.client.lines} />
              <Box title={d.placement.recruiterFirst ?? 'Headhunter'} value={c.recruiter.title} lines={c.recruiter.lines} />
              <Box title="Auslobung" value={c.bounty.title} lines={c.bounty.lines} />
              <Box title="Matchunt" value={c.matchunt.title} lines={c.matchunt.lines} />
            </div>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as typeof mode)} className="gap-2">
              <label className="flex items-center gap-2"><RadioGroupItem value="accept" />Anerkennen: Nachbesetzung für alle Headhunter</label>
              <label className="flex items-center gap-2"><RadioGroupItem value="client_sphere" />Grund liegt beim Kunden: keine Nachbesetzung, {d.placement.recruiterFirst ?? 'der Headhunter'} bekommt alles{d.claim.clientSphereSuggested ? ' (passt zum gemeldeten Grund)' : ''}</label>
              <label className="flex items-center gap-2"><RadioGroupItem value="reject" />Ablehnen: kein Fall für die Nachbesetzung</label>
            </RadioGroup>
            <label className="block">
              <span className="text-muted-foreground">{mode === 'reject' ? 'Grund der Ablehnung (Pflicht, geht an den Kunden)' : 'Notiz (optional)'}</span>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1" />
            </label>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !d || (mode === 'reject' && !reason.trim())} onClick={decide}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{mode === 'accept' ? 'Anerkennen' : mode === 'reject' ? 'Ablehnen' : 'Grund liegt beim Kunden'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// J1 Nicht angefangen (Core)
// ---------------------------------------------------------------------------

export function JokerDialog({ placementId, onClose }: { placementId: string | null; onClose: () => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'joker', placementId], queryFn: () => buchhaltungApi.jokerDetail(placementId!), enabled: !!placementId, retry: false, staleTime: 0 });
  const [choice, setChoice] = useState<'offer' | 'none' | 'client_sphere'>('offer');
  const [price, setPrice] = useState('');
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const d = q.data;
  useEffect(() => {
    if (!d) return;
    setChoice(d.clientSphereSuggested ? 'client_sphere' : 'offer');
    setPrice(euroInput(d.defaults.priceCents));
    setUntil(d.defaults.validUntil);
    setNote('');
  }, [d?.placement.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const cents = parseEuro(price);
  const pct = d && d.placement.grossCents ? Math.round((cents / d.placement.grossCents) * 1000) / 10 : null;
  const save = async () => {
    if (!d) return;
    setBusy(true);
    try {
      await buchhaltungApi.decideJoker(d.placement.id, choice, choice === 'offer' ? cents : undefined, choice === 'offer' ? until : undefined, note.trim() || undefined);
      toast.success(choice === 'offer' ? 'Angebot verschickt.' : choice === 'none' ? 'Entschieden: nichts anbieten.' : 'Festgehalten: Grund liegt beim Kunden.');
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const p = d?.placement;
  return (
    <Dialog open={!!placementId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>Nicht angefangen{p ? ` · ${p.candidateName}` : ''}</DialogTitle>
          <DialogDescription>{p ? [p.companyName, p.jobTitle, 'Core', p.plannedStart ? `geplanter Start ${dateDe(p.plannedStart)}` : null, p.recruiterName].filter(Boolean).join(' · ') : 'Lädt …'}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <ErrorLine error={q.error} /> : d && p && (
          <div className="space-y-4 text-sm">
            <CheckList checks={[
              d.invoice ? { state: d.invoice.status === 'paid' ? 'ok' : 'fail', label: d.invoice.status === 'paid' ? `Rechnung ${eur(d.invoice.totalCents)} bezahlt ${dateShort(d.invoice.paidAt)}` : `Rechnung ${eur(d.invoice.totalCents)} noch nicht bezahlt` } : { state: 'info', label: 'Noch keine Rechnung' },
              { state: 'ok', label: `Grund: ${p.reasonText}${p.note ? ` · „${p.note}“` : ''}${p.hasDocument ? ' · Erklärung liegt vor' : ''}` },
              { state: 'info', label: `${p.recruiterFirst ?? 'Der Headhunter'} bekommt nichts (Core: Geld erst mit dem Antritt). Die ${eur(d.recruiterShareCents, 0)} liegen frei.` },
            ]} />
            {p.documentPath && <Button size="sm" variant="ghost" className="h-7" onClick={() => openPdf(() => buchhaltungApi.caseDocument(p.documentPath!)).catch((e) => toast.error(errText(e)))}>Erklärung ansehen</Button>}
            <p className="font-medium">Was bieten wir an?</p>
            <RadioGroup value={choice} onValueChange={(v) => setChoice(v as typeof choice)} className="gap-3">
              <div className={cn('rounded-lg border p-3', choice === 'offer' && 'border-foreground/30')}>
                <label className="flex items-center gap-2 font-medium"><RadioGroupItem value="offer" />Nachbesetzung als Option anbieten</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block"><span className="text-xs text-muted-foreground">Preis netto (€){pct != null && Number.isFinite(pct) ? ` · ${String(pct).replace('.', ',')} %` : ''}</span><Input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" disabled={choice !== 'offer'} className="mt-1 h-9" /></label>
                  <label className="block"><span className="text-xs text-muted-foreground">gültig bis</span><Input type="date" value={until} min={todayIso()} onChange={(e) => setUntil(e.target.value)} disabled={choice !== 'offer'} className="mt-1 h-9" /></label>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Vorbelegt mit dem Standard: {d.defaults.pct} % vom Zielgehalt, {d.defaults.validDays} Tage. Auch 0 € als Kulanz möglich. Die Stelle wird nach Zahlung für alle ausgeschrieben, Auslobung {eur(d.defaults.bountyCents, 0)}.</p>
              </div>
              <div className={cn('rounded-lg border p-3', choice === 'none' && 'border-foreground/30')}>
                <label className="flex items-center gap-2 font-medium"><RadioGroupItem value="none" />Nichts anbieten</label>
                <p className="mt-1 text-xs text-muted-foreground">Der Kunde sieht nur „Gemeldet, danke“. Die {eur(d.recruiterShareCents, 0)} bleiben bei Matchunt.</p>
              </div>
              <div className={cn('rounded-lg border p-3', choice === 'client_sphere' && 'border-foreground/30')}>
                <label className="flex items-center gap-2 font-medium"><RadioGroupItem value="client_sphere" />Grund liegt beim Kunden</label>
                <p className="mt-1 text-xs text-muted-foreground">Etwa wenn der Kunde das Angebot zurückgezogen hat. {p.recruiterFirst ?? 'Der Headhunter'} bekommt den vollen Anteil.</p>
              </div>
            </RadioGroup>
            <label className="block"><span className="text-muted-foreground">Notiz (optional, nur intern)</span><Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 h-9" /></label>
            <p className="text-xs text-muted-foreground">Matchunt entscheidet jeden Fall einzeln, einen Automatismus gibt es nicht. Höchstens einmal je Besetzung.</p>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !d || (choice === 'offer' && (!(cents >= 0) || !until))} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Entscheidung speichern</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Antritt unklar klären
// ---------------------------------------------------------------------------

export function AntrittDialog({ placementId, onClose }: { placementId: string | null; onClose: () => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'antritt', placementId], queryFn: () => buchhaltungApi.startDetail(placementId!), enabled: !!placementId, retry: false, staleTime: 0 });
  const [way, setWay] = useState<'started' | 'not_started'>('started');
  const [on, setOn] = useState('');
  const [reason, setReason] = useState('no_show');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const d = q.data;
  useEffect(() => { if (d) { setWay('started'); setOn(d.placement.reportedOn ?? d.placement.plannedStart ?? todayIso()); setReason('no_show'); setNote(''); } }, [d?.placement.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!d) return;
    setBusy(true);
    try {
      await buchhaltungApi.resolveStart(d.placement.id, way, way === 'started' ? { startedOn: on, note: note.trim() || undefined } : { reason, note: note.trim() || undefined });
      toast.success(way === 'started' ? 'Antritt festgestellt. Beide Seiten sind informiert.' : 'Als nicht angefangen erfasst. Der Fall steht jetzt unter „Prüfen“.');
      refresh();
      onClose();
    } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  const p = d?.placement;
  return (
    <Dialog open={!!placementId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Antritt klären{p ? ` · ${p.candidateName}` : ''}</DialogTitle>
          <DialogDescription>{p ? [p.companyName, p.jobTitle, p.recruiterName].filter(Boolean).join(' · ') : 'Lädt …'}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <ErrorLine error={q.error} /> : p && d && (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-muted/40 p-3">
              <p>Headhunter meldet: angefangen{p.reportedOn ? ` am ${dateDe(p.reportedOn)}` : ''}</p>
              <p>Kunde sagt „Stimmt so nicht“{p.contestedAt ? ` (${dateShort(p.contestedAt)})` : ''}{p.contestNote ? `: „${p.contestNote}“` : ''}</p>
            </div>
            <RadioGroup value={way} onValueChange={(v) => setWay(v as typeof way)} className="gap-2">
              <label className="flex items-center gap-2"><RadioGroupItem value="started" />Hat angefangen</label>
              {way === 'started' && <Input type="date" value={on} max={todayIso()} onChange={(e) => setOn(e.target.value)} className="ml-6 h-9 w-48" />}
              <label className="flex items-center gap-2"><RadioGroupItem value="not_started" />Hat nicht angefangen</label>
              {way === 'not_started' && (
                <RadioGroup value={reason} onValueChange={setReason} className="ml-6 gap-1.5">
                  {d.reasons.map((r) => <label key={r.key} className="flex items-center gap-2"><RadioGroupItem value={r.key} />{r.label}</label>)}
                </RadioGroup>
              )}
            </RadioGroup>
            <label className="block"><span className="text-muted-foreground">Was hat die Klärung ergeben? (geht an beide Seiten)</span><Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1" /></label>
            {way === 'not_started' && <p className="text-xs text-muted-foreground">{p.packageKey === 'core' ? 'Bei Core entscheidest du danach unter „Prüfen“, ob Matchunt eine Nachbesetzung anbietet.' : 'Mit Continuity entsteht ein Fall unter „Prüfen“.'}</p>}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy || !d || (way === 'started' && !on)} onClick={save}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Speichern</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Nachbesetzung öffnen
// ---------------------------------------------------------------------------

export function NachbesetzungDialog({ placementId, onClose }: { placementId: string | null; onClose: () => void }) {
  const refresh = useRefresh();
  const q = useQuery({ queryKey: ['admin-buchhaltung', 'nachbesetzung', placementId], queryFn: () => buchhaltungApi.researchDetail(placementId!), enabled: !!placementId, retry: false, staleTime: 0 });
  const [ending, setEnding] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setEnding(false); setNote(''); }, [placementId]);
  const d = q.data;
  const STATE: Record<string, string> = { awaiting_position: 'wartet auf den Kunden: Position bestätigen', awaiting_payment: 'wartet auf die Zahlung der Rechnung', running: 'läuft', paused: 'ruht' };
  const end = async () => {
    if (!d) return;
    setBusy(true);
    try { await buchhaltungApi.endResearch(d.placement.id, note.trim()); toast.success('Nachbesetzung beendet. Die suchenden Headhunter sind informiert.'); refresh(); onClose(); } catch (e) { toast.error(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!placementId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Nachbesetzung{d ? ` · ${d.placement.candidateName}` : ''}</DialogTitle>
          <DialogDescription>{d ? [d.placement.companyName, d.placement.jobTitle].filter(Boolean).join(' · ') : 'Lädt …'}</DialogDescription>
        </DialogHeader>
        {q.isLoading ? <Loading /> : q.error ? <ErrorLine error={q.error} /> : d && (
          <div className="space-y-3 text-sm">
            <CheckList checks={[
              { state: 'info', label: `Stand: ${STATE[d.placement.researchState] ?? d.placement.researchState}${d.placement.since ? ` · seit ${dateDe(d.placement.since)}` : ''}` },
              { state: 'info', label: `${d.placement.researchKind === 'joker' ? 'Angebot bei Core' : 'Continuity'} · Auslobung ${eur(d.bountyCents, 0)}` },
              { state: 'info', label: `${d.recruiters} ${d.recruiters === 1 ? 'Headhunter' : 'Headhunter'} mit ${d.submissions} ${d.submissions === 1 ? 'Vorstellung' : 'Vorstellungen'} seit dem Start` },
            ]} />
            {!ending ? (
              <Button size="sm" variant="outline" onClick={() => setEnding(true)}>Nachbesetzung beenden</Button>
            ) : (
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Nur, wenn Matchunt die Bearbeitung beendet (Rahmenvertrag § 4 Abs. 6). Die Stelle schließt, das Geld bleibt bei Matchunt.</p>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Grund (Pflicht)" />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setEnding(false)}>Abbrechen</Button>
                  <Button size="sm" variant="destructive" disabled={busy || !note.trim()} onClick={end}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Beenden</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
