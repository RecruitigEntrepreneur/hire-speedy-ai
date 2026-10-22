import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Video, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FunktionsFehler, terminSeiteApi, type TerminAnsicht, type TerminTag } from '@/lib/terminApi';
import { tagLang, uhrzeit, Zeitwahl } from '@/components/termin/Zeitwahl';
import { TerminFuss, TerminKopf } from './TerminSeite';

/** Link „Verschieben / Absagen“ aus der Mail an den Kandidaten (ohne Konto, 21.10.2026). */
export default function TerminVerwalten() {
  const { token = '' } = useParams();
  const [t, setT] = useState<TerminAnsicht | null>(null);
  const [fehler, setFehler] = useState('');
  const [modus, setModus] = useState<'ansicht' | 'verschieben' | 'absagen' | 'verschoben' | 'abgesagt'>('ansicht');
  const [neu, setNeu] = useState<string | null>(null);
  const [grund, setGrund] = useState('');
  const [busy, setBusy] = useState(false);
  const [meldung, setMeldung] = useState('');

  useEffect(() => {
    document.title = 'Dein Termin · Matchunt';
    terminSeiteApi.termin(token).then(setT).catch(e => setFehler(e instanceof Error ? e.message : 'Diesen Termin gibt es nicht.'));
  }, [token]);

  const verschieben = async () => {
    if (!neu || !t) return;
    setBusy(true); setMeldung('');
    try {
      const r = await terminSeiteApi.verschieben(token, neu);
      setT({ ...t, start: r.start, ende: new Date(Date.parse(r.start) + t.dauer * 60000).toISOString(), join_url: r.join_url });
      setModus('verschoben');
    } catch (e) {
      if (e instanceof FunktionsFehler && e.grund === 'conflict') {
        const frisch = await terminSeiteApi.termin(token).catch(() => null);
        if (frisch) setT(frisch);
        setNeu(null);
      }
      setMeldung(e instanceof Error ? e.message : 'Das hat nicht geklappt.');
    } finally { setBusy(false); }
  };

  const absagen = async () => {
    setBusy(true); setMeldung('');
    try { await terminSeiteApi.absagen(token, grund); setModus('abgesagt'); }
    catch (e) { setMeldung(e instanceof Error ? e.message : 'Das hat nicht geklappt.'); }
    finally { setBusy(false); }
  };

  const rahmen = (inhalt: React.ReactNode) => <div className="min-h-screen bg-background"><TerminKopf/><main className="mx-auto max-w-lg px-4 py-8 sm:py-12"><div className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-7">{inhalt}</div></main><TerminFuss/></div>;
  if (fehler) return rahmen(<><h1 className="text-lg font-semibold">Diesen Termin gibt es nicht</h1><p className="text-sm text-muted-foreground">{fehler}</p></>);
  if (!t) return rahmen(<div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></div>);

  const vorname = t.headhunter.name.split(' ')[0];
  const kopf = <div>
    <p className="text-xs text-muted-foreground">Dein Termin</p>
    <p className="text-base font-semibold">{tagLang(t.start)} · {uhrzeit(t.start)}–{uhrzeit(t.ende)}</p>
    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">{t.mode === 'teams' ? <Video className="h-3.5 w-3.5"/> : <Phone className="h-3.5 w-3.5"/>}mit {t.headhunter.name}{t.stelle ? ` · ${t.stelle}` : ''}</p>
  </div>;

  if (modus === 'abgesagt' || t.status === 'cancelled') return rahmen(<><CheckCircle2 className="h-7 w-7 text-muted-foreground"/><h1 className="text-lg font-semibold">Termin abgesagt</h1><p className="text-sm text-muted-foreground">{vorname} ist informiert. Danke, dass du Bescheid gegeben hast.</p></>);
  if (t.status === 'vorbei') return rahmen(<>{kopf}<p className="text-sm text-muted-foreground">Dieser Termin liegt in der Vergangenheit und lässt sich nicht mehr ändern.</p></>);
  if (modus === 'verschoben') return rahmen(<><CheckCircle2 className="h-7 w-7 text-emerald-600"/><h1 className="text-lg font-semibold">Neuer Termin steht</h1>{kopf}<p className="text-sm text-muted-foreground">Die neue Einladung{t.mode === 'teams' ? ' mit Teams-Link' : ''} kommt per Mail. {vorname} ist informiert.</p></>);

  return rahmen(<>
    {kopf}
    {t.mode === 'teams' && t.join_url && modus === 'ansicht' && <Button variant="outline" asChild><a href={t.join_url} target="_blank" rel="noreferrer"><Video className="mr-2 h-4 w-4"/>Teams-Besprechung beitreten</a></Button>}
    {meldung && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{meldung}</p>}
    {modus === 'ansicht' && <div className="grid gap-2 sm:grid-cols-2">
      <Button onClick={() => setModus('verschieben')}>Andere Zeit wählen</Button>
      <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setModus('absagen')}>Termin absagen</Button>
    </div>}
    {modus === 'verschieben' && <div className="space-y-4">
      <p className="font-medium">Neue Zeit wählen</p>
      {t.tage.length ? <Zeitwahl tage={t.tage as TerminTag[]} gewaehlt={neu} onWahl={setNeu}/> : <p className="text-sm text-muted-foreground">{vorname} hat gerade keine anderen freien Zeiten. Schau später noch einmal vorbei.</p>}
      <div className="flex gap-2"><Button disabled={!neu || busy} onClick={() => void verschieben()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{neu ? `Auf ${tagLang(neu).split(',')[0]}, ${uhrzeit(neu)} verschieben` : 'Zeit wählen'}</Button><Button variant="ghost" onClick={() => { setModus('ansicht'); setNeu(null); }}>Zurück</Button></div>
    </div>}
    {modus === 'absagen' && <div className="space-y-3">
      <p className="font-medium">Absagen</p>
      <Textarea rows={3} value={grund} onChange={e => setGrund(e.target.value)} placeholder="Grund (optional), z. B. „Habe mich anders entschieden“"/>
      <div className="flex gap-2"><Button variant="destructive" disabled={busy} onClick={() => void absagen()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Termin absagen</Button><Button variant="ghost" onClick={() => setModus('ansicht')}>Zurück</Button></div>
      <p className="text-xs text-muted-foreground">{vorname} bekommt dazu eine Mail.</p>
    </div>}
  </>);
}
