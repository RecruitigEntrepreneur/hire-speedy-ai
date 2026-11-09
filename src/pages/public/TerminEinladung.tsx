import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Loader2, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { FunktionsFehler, terminSeiteApi, type EinladungsDaten, type Gespraechsart, type TerminTag } from '@/lib/terminApi';
import { tagLang, terminKurz, uhrzeit, Zeitwahl } from '@/components/termin/Zeitwahl';
import { TerminFuss, TerminKopf } from './TerminSeite';
import { LebenslaufFeld, type LebenslaufDatei } from '@/components/termin/LebenslaufFeld';
import { LebenslaufNachreichen } from '@/components/termin/LebenslaufNachreichen';

/**
 * Persönliche Einladung (01.11.2026): matchunt.ai/t/einladung/<token>. Der Kandidat wählt nur
 * noch die Zeit; Name und Kontakt stehen in der Akte, die Gesprächsart hat der Headhunter
 * vorgegeben (oder lässt die Wahl). Der Termin landet immer beim richtigen Kandidaten.
 */
export default function TerminEinladung() {
  const { token = '' } = useParams();
  const [d, setD] = useState<EinladungsDaten | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');
  const [zeit, setZeit] = useState<string | null>(null);
  const [mode, setMode] = useState<Gespraechsart>('teams');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState('');
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<{ feld: string; meldung: string } | null>(null);
  const [hinweis, setHinweis] = useState('');
  const [ergebnis, setErgebnis] = useState<{ start: string; ende: string; mode: Gespraechsart; join_url: string | null } | null>(null);
  // Lebenslauf (05.11.2026): nur, wenn der Headhunter darum bittet; freiwillig.
  const [cv, setCv] = useState<LebenslaufDatei | null>(null);
  const [linkedin, setLinkedin] = useState('');
  const [nachreichen, setNachreichen] = useState(false);

  useEffect(() => {
    document.title = 'Einladung zum Gespräch · Matchunt';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);
    terminSeiteApi.einladung(token).then(x => { setD(x); setMode(x.arten[0] ?? 'teams'); })
      .catch(e => setLadeFehler(e instanceof Error ? e.message : 'Diese Einladung gibt es nicht.'));
    return () => { robots.remove(); };
  }, [token]);

  const buchen = async () => {
    if (!zeit) return;
    setSendet(true);
    setFehler(null);
    try {
      const r = await terminSeiteApi.buchenEinladung(token, {
        start: zeit, mode, consent, email: email || undefined, phone: phone || undefined, website,
        upload_id: cv?.status === 'fertig' ? cv.id : null, linkedin_url: linkedin.trim() || undefined,
      });
      if (r.termin) { setErgebnis(r.termin); window.scrollTo({ top: 0 }); }
    } catch (e) {
      if (e instanceof FunktionsFehler && e.grund === 'conflict' && Array.isArray(e.extra.tage)) {
        setD(x => (x ? { ...x, tage: e.extra.tage as TerminTag[] } : x));
        setZeit(null);
        setHinweis(`${uhrzeit(zeit)} wurde eben vergeben. Such dir bitte eine andere Zeit aus.`);
      } else if (e instanceof FunktionsFehler && typeof e.extra.feld === 'string') {
        setFehler({ feld: e.extra.feld, meldung: e.message });
      } else {
        setFehler({ feld: 'allgemein', meldung: e instanceof Error ? e.message : 'Das hat gerade nicht geklappt.' });
      }
    } finally { setSendet(false); }
  };

  const huelle = (inhalt: React.ReactNode) => <div className="min-h-screen bg-background">
    <TerminKopf/>
    <main className="mx-auto max-w-xl px-4 py-6 sm:py-10"><div className="rounded-xl border border-border bg-card p-5 sm:p-7">{inhalt}</div></main>
    <TerminFuss/>
  </div>;

  if (ladeFehler) return huelle(<><h1 className="text-xl font-semibold">Diese Einladung gibt es nicht</h1><p className="mt-2 text-sm text-muted-foreground">{ladeFehler}</p></>);
  if (!d) return <div className="min-h-screen bg-background"><TerminKopf/><main className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></main></div>;

  const hh = d.headhunter;
  const hhVorname = hh.name.split(' ')[0];

  // Angefragt und beim Buchen weder Datei noch LinkedIn mitgegeben
  const lebenslaufFehlt = d.lebenslauf === 'angefragt' && cv?.status !== 'fertig' && !linkedin.trim();

  if (ergebnis) return huelle(<div className="space-y-4">
    <CheckCircle2 className="h-8 w-8 text-emerald-600"/>
    <div><h1 className="text-xl font-semibold">Dein Gespräch steht</h1><p className="mt-1 text-sm">{tagLang(ergebnis.start)} · {uhrzeit(ergebnis.start)}–{uhrzeit(ergebnis.ende)} · {ergebnis.mode === 'teams' ? 'Teams' : `Telefon, ${hhVorname} ruft dich an`}</p><p className="text-sm text-muted-foreground">mit {hh.name}</p></div>
    <Button variant="outline" onClick={() => downloadIcs('gespraech.ics', buildIcs({ title: `Gespräch mit ${hh.name}`, start: new Date(ergebnis.start), durationMinutes: d.dauer, description: ergebnis.join_url ? `Teams: ${ergebnis.join_url}` : `${hhVorname} ruft dich an.`, location: ergebnis.mode === 'teams' ? 'Microsoft Teams' : 'Telefon', url: ergebnis.join_url ?? undefined }))}>
      <CalendarPlus className="mr-2 h-4 w-4"/>In Kalender eintragen
    </Button>
    {lebenslaufFehlt && <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
      <div><p className="font-medium">{hhVorname} freut sich über deinen Lebenslauf</p><p className="text-muted-foreground">Dann kann {hhVorname} sich gut vorbereiten. Das geht auch später über den Link in deiner Mail.</p></div>
      {nachreichen ? <LebenslaufNachreichen ziel={{ einladung: token }} hhName={hh.name}/> : <Button size="sm" onClick={() => setNachreichen(true)}>Jetzt hochladen</Button>}
    </div>}
    <p className="text-sm text-muted-foreground">Du bekommst gleich eine Mail{ergebnis.mode === 'teams' ? ' mit dem Teams-Link' : ''}. Darin kannst du auch verschieben{lebenslaufFehlt ? ', absagen oder den Lebenslauf nachreichen' : ' oder absagen'}.</p>
  </div>);

  if (d.stand !== 'offen') {
    const texte = {
      gebucht: ['Du hast schon einen Termin', 'Verschieben oder absagen kannst du über den Link in deiner Bestätigungsmail.'],
      abgelaufen: ['Diese Einladung ist abgelaufen', `Schreib ${hhVorname} kurz, dann bekommst du einen neuen Link.`],
      zurueckgezogen: ['Diese Einladung gilt nicht mehr', `Bei Fragen melde dich gern direkt bei ${hhVorname}.`],
    }[d.stand];
    // Termin steht, Lebenslauf angefragt und noch nicht da: hier nachreichen.
    if (d.stand === 'gebucht' && d.lebenslauf === 'angefragt') {
      return huelle(<div className="space-y-5">
        <div><h1 className="text-xl font-semibold">{texte[0]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{d.termin ? `${tagLang(d.termin.start)} · ${uhrzeit(d.termin.start)} · ${d.termin.mode === 'teams' ? 'Teams' : 'Telefon'}. ` : ''}{texte[1]}</p></div>
        <div className="space-y-2"><p className="text-sm font-medium">Lebenslauf nachreichen</p><LebenslaufNachreichen ziel={{ einladung: token }} hhName={hh.name}/></div>
      </div>);
    }
    return huelle(<><h1 className="text-xl font-semibold">{texte[0]}</h1><p className="mt-2 text-sm text-muted-foreground">{texte[1]}</p></>);
  }

  const emailNoetig = !d.email_maskiert;
  const telefonNoetig = mode === 'phone' && !d.telefon_bekannt;
  const fehlerBei = (feld: string) => (fehler?.feld === feld ? <p role="alert" className="text-xs text-destructive">{fehler.meldung}</p> : null);

  return huelle(<div className="space-y-5">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">{hh.initialen}</span>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold leading-tight tracking-tight">Hallo {d.vorname}, {hhVorname} freut sich auf das Gespräch</h1>
        <p className="text-sm text-muted-foreground">{hh.name}{hh.titel ? ` · ${hh.titel}` : ' · Headhunter'}</p>
      </div>
    </div>
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>{d.dauer} Minuten, vertraulich</span>
      {d.arten.length === 1 && <span className="inline-flex items-center gap-1">· {d.arten[0] === 'teams' ? <><Video className="h-3.5 w-3.5"/>Teams</> : <><Phone className="h-3.5 w-3.5"/>{hhVorname} ruft dich an</>}</span>}
    </p>

    {!d.offen || !d.tage.length ? <div className="space-y-1 rounded-lg bg-muted/50 p-5">
      <p className="font-medium">{d.pausiert ? `${hhVorname} nimmt gerade keine Buchungen an.` : d.kalender ? `${hhVorname} ist gerade ausgebucht.` : 'Gerade sind keine Zeiten abrufbar.'}</p>
      <p className="text-sm text-muted-foreground">Schau bitte später noch einmal vorbei.</p>
    </div> : <form className="space-y-5" onSubmit={e => { e.preventDefault(); void buchen(); }}>
      {hinweis && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{hinweis}</p>}
      <div className="space-y-2">
        <p className="text-sm font-medium">Such dir eine Zeit aus</p>
        <Zeitwahl tage={d.tage} gewaehlt={zeit} onWahl={z => { setZeit(z); setHinweis(''); }}/>
        {fehlerBei('start')}
      </div>

      {d.arten.length > 1 && <fieldset className="space-y-1.5"><legend className="text-sm font-medium">Wie sollen wir sprechen?</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['teams', 'phone'] as const).map(m => <label key={m} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', mode === m ? 'border-foreground' : 'border-border')}>
            <input type="radio" name="art" className="sr-only" checked={mode === m} onChange={() => setMode(m)}/>
            {m === 'teams' ? <Video className="h-4 w-4"/> : <Phone className="h-4 w-4"/>}{m === 'teams' ? 'Teams' : `Telefon, ${hhVorname} ruft an`}
          </label>)}
        </div>{fehlerBei('mode')}
      </fieldset>}

      {emailNoetig && <div className="space-y-1"><Label htmlFor="e-mail">Deine E-Mail, für die Bestätigung</Label><Input id="e-mail" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}/>{fehlerBei('email')}</div>}
      {telefonNoetig && <div className="space-y-1"><Label htmlFor="e-tel">Deine Telefonnummer</Label><Input id="e-tel" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)}/></div>}
      {fehlerBei('phone')}

      {d.lebenslauf === 'angefragt' && <div className="space-y-2">
        <p className="text-sm font-medium">Dein Lebenslauf <span className="font-normal text-muted-foreground">· {hhVorname} bittet darum, freiwillig</span></p>
        <LebenslaufFeld ziel={{ einladung: token }} hhVorname={hhVorname} datei={cv} onDatei={setCv} linkedin={linkedin} onLinkedin={setLinkedin}/>
        {fehlerBei('linkedin_url')}
      </div>}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)}/></label></div>

      <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
        <Checkbox checked={consent} onCheckedChange={v => { setConsent(v === true); if (fehler?.feld === 'consent') setFehler(null); }} className="mt-0.5"/>
        <span>Ich bin einverstanden, dass Matchunt und {hh.name} meine Angaben{cv?.status === 'fertig' ? ' und meinen Lebenslauf' : ''} für dieses Gespräch und die Vermittlung verarbeiten. <Link to="/datenschutz" target="_blank" className="underline">Datenschutz</Link></span>
      </label>
      {fehlerBei('consent')}{fehlerBei('allgemein')}

      <Button type="submit" className="w-full" disabled={sendet || !zeit || cv?.status === 'laedt'}>{sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{zeit ? `Termin buchen: ${terminKurz(zeit)}` : 'Zeit wählen'}</Button>
      {d.email_maskiert && <p className="text-center text-xs text-muted-foreground">Die Bestätigung geht an {d.email_maskiert}</p>}
    </form>}
  </div>);
}
