import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CalendarPlus, FileUp, Loader2, NotebookPen, Phone, PhoneCall, Play, Video, Zap, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { jobMeta } from '@/components/candidates/matching/PassendeStellen';
import { EinladungFenster } from '@/components/recruiter/termin/EinladungFenster';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useMatchV41 } from '@/hooks/useMatchV41';
import type { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { tagMonat, uhrzeit, VORBEREITEN_TON, vorbereitenTexte, wannWar, type Vorbereitung } from '@/lib/kandidatVorbereiten';
import { effectiveTier, TIER_STYLE } from '@/lib/matchV41';
import { einladungApi } from '@/lib/terminApi';
import { cn } from '@/lib/utils';

const tel = (nummer: string) => `tel:${nummer.replace(/[^\d+]/g, '')}`;
const artenText = (arten: string[]) => (arten.length > 1 ? 'Teams oder Telefon' : arten[0] === 'teams' ? 'Teams' : 'Telefon');

/** Zwei Spalten mit dem, was der Headhunter vor dem Handgriff wissen muss. */
function Fakten({ zeilen }: { zeilen: [string, ReactNode][] }) {
  return <dl className="divide-y divide-border/40 rounded-lg border border-border/60 text-sm">
    {zeilen.map(([k, w]) => <div key={k} className="flex gap-3 px-3 py-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 flex-1">{w}</dd>
    </div>)}
  </dl>;
}

function Nebenweg({ Icon, children, onClick }: { Icon: LucideIcon; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground">
    <Icon className="h-3.5 w-3.5"/>{children}
  </button>;
}

function Anrufen({ v, variant = 'outline' }: { v: Vorbereitung; variant?: 'default' | 'outline' }) {
  if (!v.telefon) return <Button variant={variant} disabled title="In der Akte steht keine Telefonnummer." className="gap-1.5"><Phone className="h-4 w-4"/>Anrufen</Button>;
  return <Button variant={variant} asChild className="gap-1.5"><a href={tel(v.telefon)}><Phone className="h-4 w-4"/>Anrufen</a></Button>;
}

function Wahl({ an, onClick, titel, unter }: { an: boolean; onClick: () => void; titel: string; unter: string }) {
  return <button type="button" role="radio" aria-checked={an} onClick={onClick} className={cn('rounded-lg border p-3 text-left transition-colors', an ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30')}>
    <span className="block text-sm font-medium">{titel}</span>
    <span className="mt-0.5 block text-xs text-muted-foreground">{unter}</span>
  </button>;
}

/** „Bereit“: gleich hier sehen, wo der Kandidat passt, und einreichen. */
function PassendeStellenListe({ v, onEinreichen }: { v: Vorbereitung; onEinreichen: (ziel: string) => void }) {
  const m = useMatchV41(v.candidateId);
  const vorname = v.name.split(/\s+/)[0];
  const offen = m.rows.filter(r => ['sehr_passend', 'passend', 'pruefen'].includes(effectiveTier(r)) && !r.submittedAt);
  return <div className="space-y-3">
    {m.loading ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full"/>)}</div>
      : m.unavailable || m.error ? <p className="text-sm text-muted-foreground">Die passenden Stellen lassen sich gerade nicht auswerten. Du kannst trotzdem einreichen.</p>
        : offen.length === 0 ? <p className="text-sm text-muted-foreground">Gerade passt keine offene Stelle zu {vorname}. Sobald eine dazukommt, siehst du es im Profil.</p>
          : <>
            <p className="text-sm">Das Interview ist fertig. Diese Stellen passen gerade zu {vorname}:</p>
            <ul className="divide-y divide-border/40 rounded-lg border border-border/60">
              {offen.slice(0, 3).map(r => {
                const t = effectiveTier(r);
                return <li key={r.job_id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.job?.title ?? 'Stelle'}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[jobMeta(r), t === 'ausgeblendet' ? null : TIER_STYLE[t].label].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => onEinreichen(r.job_id)}>Einreichen</Button>
                </li>;
              })}
            </ul>
          </>}
  </div>;
}

function Inhalt({ v, onClose, onChanged }: { v: Vorbereitung; onClose: () => void; onChanged: () => void }) {
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const [einladen, setEinladen] = useState(false);
  const [arbeitet, setArbeitet] = useState<string | null>(null);
  // „Gespräch war“: fast immer hat es stattgefunden, darum ist „Ja“ schon gewählt
  const [fandStatt, setFandStatt] = useState(true);
  const [terminFrage, setTerminFrage] = useState(false);
  const [terminAm, setTerminAm] = useState('');
  const vorname = v.name.split(/\s+/)[0];
  const texte = vorbereitenTexte(v);

  const zumProfil = (suche = '') => { onClose(); navigate(`/recruiter/candidates/${v.candidateId}${suche}`); };
  const fertig = (meldung: string) => { toast.success(meldung); onChanged(); onClose(); };

  /** „Nicht relevant“: dauerhaft aus den Aufgaben, der Kandidat selbst bleibt. */
  const ausblenden = async (grund: string, label: string) => {
    setArbeitet(grund);
    const { error } = await (supabase as unknown as { from: (t: string) => any }).from('candidates') // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ prep_dismissed_at: new Date().toISOString(), prep_dismissed_reason: grund }).eq('id', v.candidateId);
    setArbeitet(null);
    if (error) { toast.error('Das hat gerade nicht geklappt.'); return; }
    await logActivity(v.candidateId, 'note', `Aus den Aufgaben genommen: ${label}`, undefined, { kind: 'prep_dismissed', reason: grund });
    fertig(`${vorname} steht nicht mehr in deinen Aufgaben.`);
  };

  const anrufErgebnis = async (titel: string, meta: Record<string, unknown>) => {
    const r = await logActivity(v.candidateId, 'call', titel, undefined, { ...meta, task_category: `prep_${v.art}` });
    if (!r) toast.error('Konnte nicht festgehalten werden.');
    return !!r;
  };

  const erinnern = async () => {
    setArbeitet('erinnern');
    try {
      await einladungApi.erinnern(v.candidateId);
      fertig(`Erinnerung an ${vorname} ist raus.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat gerade nicht geklappt.');
    } finally { setArbeitet(null); }
  };

  const keinInteresse = async () => {
    setArbeitet('kein_interesse');
    try { await einladungApi.zurueckziehen(v.candidateId); } catch { /* Link läuft ohnehin ab, das Ausblenden zählt */ }
    await ausblenden('kein_interesse', 'Kein Interesse');
  };

  const terminSpeichern = async () => {
    const ms = Date.parse(terminAm);
    if (Number.isNaN(ms)) { toast.error('Bitte Tag und Uhrzeit angeben.'); return; }
    const iso = new Date(ms).toISOString();
    if (await anrufErgebnis(`Termin ausgemacht: ${tagMonat(iso)} um ${uhrzeit(iso)}`, { reached: true, outcome: 'Termin ausgemacht', termin_at: iso })) {
      fertig(`Termin am ${tagMonat(iso)} um ${uhrzeit(iso)} festgehalten.`);
    }
  };

  const nichtRelevant = <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
    <span>Nicht relevant?</span>
    {([['vormerken', 'Nur vormerken'], ['passt_nicht', 'Passt nicht'], ['kein_interesse', 'Kein Interesse']] as const).map(([k, l]) =>
      <button key={k} type="button" disabled={!!arbeitet} onClick={() => void ausblenden(k, l)} className="underline-offset-2 hover:text-foreground hover:underline">{l}</button>)}
  </div>;

  let koerper: ReactNode;
  let unter: string;
  const rolle = v.rolle ? `${v.rolle} · ` : '';
  switch (v.art) {
    case 'termin': {
      const t = v.termin!;
      const min = Math.round((Date.parse(t.start) - Date.now()) / 60_000);
      unter = `${rolle}heute um ${uhrzeit(t.start)}`;
      koerper = <div className="space-y-4">
        <p className="text-sm">{min > 0 && min <= 90 ? `In ${min} Minuten geht es los.` : min <= 0 ? 'Das Gespräch läuft.' : `Heute um ${uhrzeit(t.start)} geht es los.`} Öffne das Interview gleich mit, dann schreibst du direkt mit.</p>
        <Fakten zeilen={[
          ['Wann', `Heute, ${uhrzeit(t.start)}–${uhrzeit(t.ende)}`],
          ['Wie', `${t.mode === 'teams' ? 'Teams' : 'Telefon, du rufst an'}${t.selbstGebucht ? `, ${vorname} hat selbst gebucht` : ', am Telefon ausgemacht'}`],
          ...(t.notiz ? [[`Notiz von ${vorname}`, t.notiz] as [string, ReactNode]] : []),
          ['Lebenslauf', v.lebenslauf ? 'hochgeladen' : 'fehlt noch'],
        ]}/>
        <div className="flex flex-wrap gap-2">
          {t.mode === 'teams' && t.joinUrl
            ? <Button asChild className="gap-1.5"><a href={t.joinUrl} target="_blank" rel="noreferrer"><Video className="h-4 w-4"/>Beitreten</a></Button>
            : <Anrufen v={v} variant="default"/>}
          <Button variant="outline" className="gap-1.5" onClick={() => zumProfil('?interview=live')}><NotebookPen className="h-4 w-4"/>Interview öffnen</Button>
        </div>
      </div>;
      break;
    }
    case 'war':
      unter = `${rolle}Gespräch war ${wannWar(v.seit)}`;
      koerper = <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Hat das Gespräch stattgefunden?</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hat das Gespräch stattgefunden?">
            <Wahl an={fandStatt} onClick={() => setFandStatt(true)} titel="Ja" unter="Halte es fest, solange es frisch ist."/>
            <Wahl an={!fandStatt} onClick={() => setFandStatt(false)} titel="Nein, nicht erschienen" unter="Neu einladen oder aussortieren."/>
          </div>
        </div>
        {fandStatt
          ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button className="gap-1.5" onClick={() => zumProfil('?interview=live')}><NotebookPen className="h-4 w-4"/>Interview erfassen</Button>
            <Nebenweg Icon={FileUp} onClick={() => zumProfil('?interview=import')}>Notizen einwerfen</Nebenweg>
            <Nebenweg Icon={Zap} onClick={() => zumProfil('?interview=quick')}>Aus dem Kopf</Nebenweg>
          </div>
          : <div className="flex flex-wrap gap-2">
            <Button className="gap-1.5" disabled={!!arbeitet} onClick={async () => {
              await logActivity(v.candidateId, 'note', 'Nicht zum Gespräch erschienen', undefined, { kind: 'no_show' });
              onChanged();
              setEinladen(true);
            }}><CalendarPlus className="h-4 w-4"/>Neu einladen</Button>
            <Button variant="outline" disabled={!!arbeitet} onClick={async () => {
              await logActivity(v.candidateId, 'note', 'Nicht zum Gespräch erschienen', undefined, { kind: 'no_show' });
              await ausblenden('nicht_erschienen', 'Nicht erschienen');
            }}>Aussortieren</Button>
          </div>}
      </div>;
      break;
    case 'entwurf':
      unter = `${rolle}Entwurf ${wannWar(v.seit)}`;
      koerper = <div className="space-y-4">
        {v.luecken.length > 0 && <div>
          <p className="mb-1.5 text-sm font-medium">Noch offen</p>
          <div className="flex flex-wrap gap-1.5">{v.luecken.map(l => <Badge key={l} variant="outline" className="font-normal">{l}</Badge>)}</div>
        </div>}
        <p className="text-sm text-muted-foreground">{v.luecken.length ? `Du startest direkt bei der ersten offenen Frage. Weißt du es nicht, frag ${vorname} kurz an.` : 'Alle Angaben sind da. Schließ das Interview ab, dann kannst du einreichen.'}</p>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5" onClick={() => zumProfil('?interview=live')}><Play className="h-4 w-4"/>Interview fertigstellen</Button>
          <Anrufen v={v}/>
        </div>
      </div>;
      break;
    case 'eingeladen': {
      const e = v.einladung!;
      unter = `${rolle}seit ${wannWar(v.seit).replace('vor ', '')} eingeladen`;
      koerper = <div className="space-y-4">
        <p className="text-sm">{e.geoeffnetAm ? `${vorname} hat den Link geöffnet, aber nichts gebucht.` : `${vorname} hat den Link noch nicht geöffnet.`} Ein kurzer Anruf hilft meist mehr als noch eine Mail.</p>
        <Fakten zeilen={[
          ['Eingeladen', `${tagMonat(e.am)} ${e.perMail ? 'per Mail' : 'mit eigenem Text'} · ${artenText(e.arten)}`],
          ['Link', e.geoeffnetAm ? `${wannWar(e.geoeffnetAm)} geöffnet` : 'noch nicht geöffnet'],
          ['Telefon', v.telefon ?? 'steht nicht in der Akte'],
        ]}/>
        <div className="flex flex-wrap gap-2">
          <Anrufen v={v} variant="default"/>
          <Button variant="outline" className="gap-1.5" disabled={!!arbeitet || !v.email} title={v.email ? undefined : 'In der Akte steht keine E-Mail.'} onClick={() => void erinnern()}>
            {arbeitet === 'erinnern' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Bell className="h-4 w-4"/>}Per Mail erinnern
          </Button>
        </div>
        <div className="border-t pt-3">
          <p className="mb-1.5 text-sm font-medium">Was kam beim Anruf raus?</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" disabled={!!arbeitet} onClick={async () => { if (await anrufErgebnis('Erreicht: Bucht selbst', { reached: true, outcome: 'Bucht selbst' })) fertig(`Festgehalten. Bucht ${vorname} nicht, kommt die Aufgabe in 3 Tagen wieder.`); }}>Bucht selbst</Button>
            <Button size="sm" variant={terminFrage ? 'secondary' : 'outline'} disabled={!!arbeitet} onClick={() => setTerminFrage(x => !x)}>Termin ausgemacht</Button>
            <Button size="sm" variant="outline" disabled={!!arbeitet} onClick={async () => { if (await anrufErgebnis('Nicht erreicht', { reached: false })) fertig('Festgehalten. Morgen steht die Aufgabe wieder da.'); }}>Nicht erreicht</Button>
            <Button size="sm" variant="outline" disabled={!!arbeitet} onClick={() => void keinInteresse()}>Kein Interesse</Button>
          </div>
          {terminFrage && <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input type="datetime-local" aria-label="Tag und Uhrzeit des Termins" className="h-9 w-56" value={terminAm} onChange={x => setTerminAm(x.target.value)}/>
            <Button size="sm" disabled={!terminAm} onClick={() => void terminSpeichern()}>Termin festhalten</Button>
          </div>}
        </div>
      </div>;
      break;
    }
    case 'bereit':
      unter = `${rolle}Interview abgeschlossen`;
      koerper = <div className="space-y-4">
        <PassendeStellenListe v={v} onEinreichen={id => zumProfil(`?einreichen=${id}`)}/>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => zumProfil('?einreichen=alle')}>Alle passenden Stellen</Button>
          <Button variant="ghost" disabled={!!arbeitet} onClick={() => void ausblenden('vormerken', 'Nur vormerken')}>Nur vormerken</Button>
        </div>
      </div>;
      break;
    default:
      unter = `${rolle}${wannWar(v.seit)} angelegt`;
      koerper = <div className="space-y-4">
        <p className="text-sm">Ohne Gespräch kannst du {vorname} nirgends einreichen. Am schnellsten geht es mit einer Einladung.</p>
        <Fakten zeilen={[
          ['Lebenslauf', v.lebenslauf ? 'hochgeladen' : 'fehlt noch'],
          ['Kontakt', v.email && v.telefon ? 'E-Mail und Telefon da' : v.email ? 'E-Mail da, Telefon fehlt' : v.telefon ? 'Telefon da, E-Mail fehlt' : 'Weder E-Mail noch Telefon'],
          ...(v.stellen ? [['Passt zu', v.stellen === 1 ? '1 offenen Stelle' : `${v.stellen} offenen Stellen`] as [string, ReactNode]] : []),
        ]}/>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5" onClick={() => setEinladen(true)}><CalendarPlus className="h-4 w-4"/>Zum Gespräch einladen</Button>
          <Anrufen v={v}/>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <Nebenweg Icon={PhoneCall} onClick={() => zumProfil('?interview=live')}>Jetzt live führen</Nebenweg>
          <Nebenweg Icon={FileUp} onClick={() => zumProfil('?interview=import')}>Schon gesprochen: Notizen einwerfen</Nebenweg>
        </div>
        {nichtRelevant}
      </div>;
  }

  return <>
    <Dialog open={!einladen} onOpenChange={o => { if (!o) onClose(); }}>
      {/* Fokus aufs Fenster statt auf den Namen, sonst steht beim Öffnen ein Rahmen um den Namen */}
      <DialogContent className="outline-none sm:max-w-lg" onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <button type="button" className="hover:underline" onClick={() => zumProfil()}>{v.name}</button>
            <Badge variant="secondary" className={cn('px-1.5 text-[11px] font-medium', VORBEREITEN_TON[v.art])}>{texte.pill}</Badge>
          </DialogTitle>
          <DialogDescription>{unter}</DialogDescription>
        </DialogHeader>
        {koerper}
      </DialogContent>
    </Dialog>
    <EinladungFenster
      open={einladen}
      onOpenChange={o => { setEinladen(o); if (!o) onClose(); }}
      candidate={{ id: v.candidateId, vorname, email: v.email }}
      onFertig={onChanged}
    />
  </>;
}

/**
 * Fenster der Aufgaben vor der Einreichung (01.11.2026). Hält die Aufgabe fest, damit es nach dem
 * Neuladen nicht verschwindet, solange der Headhunter noch darin arbeitet.
 */
export function VorbereitenFenster({ item, onClose, onChanged }: { item: UnifiedTaskItem | null; onClose: () => void; onChanged: () => void }) {
  if (!item?.prep) return null;
  return <Inhalt key={item.itemId} v={item.prep} onClose={onClose} onChanged={onChanged}/>;
}
