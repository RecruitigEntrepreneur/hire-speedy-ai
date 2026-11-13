import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { LanguageHint } from '@/components/language/LanguageHint';
import { ArrowLeft, CalendarPlus, Check, CheckCircle2, ChevronDown, FileCheck2, Linkedin, Loader2, Lock, Phone, Upload, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { cn } from '@/lib/utils';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { docxToText, isDocx } from '@/lib/docxText';
import { FunktionsFehler, terminSeiteApi, type Gespraechsart, type SeitenDaten, type TerminTag } from '@/lib/terminApi';
import { tagLang, terminKurz, uhrzeit, Zeitwahl } from '@/components/termin/Zeitwahl';

/**
 * Öffentliche Terminseite (21.10.2026): matchunt.ai/t/<slug>[/<stelle>].
 * Kandidaten sehen die Stelle anonym und nur freie Zeiten des Headhunters,
 * buchen in drei Schritten (Zeit, Angaben mit Lebenslauf, fertig).
 */
export function TerminKopf() {
  const { t } = useTranslation('candidatePages');
  return <header className="border-b border-border bg-card">
    <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
      <MatchuntWordmark size="sm"/>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5"/>{t('common.confidentialSearch')}</span>
        <LanguageMenu/>
      </div>
    </div>
    <LanguageHint className="border-b-0 border-t"/>
  </header>;
}

export function TerminFuss() {
  const { t } = useTranslation('candidatePages');
  return <footer className="mx-auto flex max-w-5xl gap-4 px-4 py-6 text-xs text-muted-foreground"><Link to="/datenschutz" className="hover:underline">{t('common.privacy')}</Link><Link to="/impressum" className="hover:underline">{t('common.imprint')}</Link></footer>;
}

const zuBase64 = (f: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ''));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(f);
});

interface Form { first_name: string; last_name: string; email: string; phone: string; linkedin_url: string; note: string; consent: boolean; website: string; mode: Gespraechsart }
const LEER: Form = { first_name: '', last_name: '', email: '', phone: '', linkedin_url: '', note: '', consent: false, website: '', mode: 'teams' };

function Stelle({ d, mobil }: { d: SeitenDaten; mobil: boolean }) {
  const { t } = useTranslation('candidatePages');
  const [offen, setOffen] = useState(!mobil);
  const s = d.stelle;
  const hh = d.headhunter;
  return <div className="space-y-4">
    {s ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('seite.regionLine', { region: s.region })}</p>
      <h1 className="text-xl font-semibold leading-tight tracking-tight sm:text-2xl">{s.titel}</h1>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">{s.gehalt && <b className="font-medium">{s.gehalt}</b>}{s.fakten.map(f => <span key={f} className="text-muted-foreground">{f}</span>)}</p>
      {mobil && <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground" onClick={() => setOffen(!offen)} aria-expanded={offen}><ChevronDown className={cn('h-3.5 w-3.5 transition-transform', offen && 'rotate-180')}/>{offen ? t('seite.less') : t('seite.more')}</button>}
      {offen && <div className="space-y-3 pt-1 text-sm">
        {s.vorteile.length > 0 && <div><p className="font-medium">{t('seite.expect')}</p><ul className="mt-1 space-y-1 text-muted-foreground">{s.vorteile.map(v => <li key={v} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>{v}</li>)}</ul></div>}
        {s.muss.length > 0 && <div><p className="font-medium">{t('seite.bring')}</p><p className="mt-1 text-muted-foreground">{s.muss.join(' · ')}</p></div>}
      </div>}
    </div> : <h1 className="text-xl font-semibold tracking-tight">{t('seite.talkWith', { name: hh.name })}</h1>}
    <div className="flex items-center gap-3 border-t border-border pt-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">{hh.initialen}</span>
      <div className="text-sm"><p className="font-medium">{hh.name}</p><p className="text-xs text-muted-foreground">{hh.titel ?? t('common.headhunter')}{hh.linkedin && <> · <a href={hh.linkedin} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{t('common.linkedinProfile')}</a></>}</p></div>
    </div>
    {s && <p className="text-xs text-muted-foreground">{t('seite.companyLater')}</p>}
  </div>;
}

export default function TerminSeite() {
  const { slug = '', stelle } = useParams();
  const { t, i18n } = useTranslation('candidatePages');
  const [daten, setDaten] = useState<SeitenDaten | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');
  const [schritt, setSchritt] = useState<'zeit' | 'angaben' | 'fertig'>('zeit');
  const [zeit, setZeit] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState('');
  const [form, setForm] = useState<Form>(LEER);
  const [feldFehler, setFeldFehler] = useState<{ feld: string; meldung: string } | null>(null);
  const [cv, setCv] = useState<{ name: string; id: string | null; status: 'liest' | 'gelesen' | 'nicht_gelesen' | 'fehler'; meldung?: string } | null>(null);
  const [sendet, setSendet] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ start: string; ende: string; mode: Gespraechsart; join_url: string | null } | null>(null);
  const datei = useRef<HTMLInputElement>(null);
  const [mobil, setMobil] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => { const f = () => setMobil(window.innerWidth < 768); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []);
  useEffect(() => {
    document.title = t('seite.docTitle');
    // Neu laden bei Sprachwechsel: Region und Fakten der Stelle kommen in der Sprache der Seite.
    terminSeiteApi.seite(slug, stelle).then(d => {
      setDaten(d);
      setForm(f => ({ ...f, mode: d.arten.includes(f.mode) ? f.mode : d.arten[0] ?? 'teams' }));
    }).catch(e => setLadeFehler(e instanceof Error ? e.message : t('seite.notFound')));
  }, [slug, stelle, i18n.language, t]);

  const setze = <K extends keyof Form>(k: K, v: Form[K]) => { setForm(f => ({ ...f, [k]: v })); if (feldFehler?.feld === k) setFeldFehler(null); };

  const lebenslauf = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setCv({ name: f.name, id: null, status: 'fehler', meldung: t('common.fileTooLarge') }); return; }
    const pdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    const word = isDocx(f) || /\.docx?$/i.test(f.name);
    if (!pdf && !word) { setCv({ name: f.name, id: null, status: 'fehler', meldung: t('seite.cvWrongType') }); return; }
    setCv({ name: f.name, id: null, status: 'liest' });
    try {
      const text = word && isDocx(f) ? await docxToText(f).catch(() => '') : '';
      const r = await terminSeiteApi.lebenslauf(slug, { name: f.name, typ: f.type, base64: await zuBase64(f), text: text || undefined });
      setCv({ name: f.name, id: r.upload_id, status: r.gelesen ? 'gelesen' : 'nicht_gelesen' });
      setForm(prev => ({
        ...prev,
        first_name: prev.first_name || r.felder.first_name, last_name: prev.last_name || r.felder.last_name,
        email: prev.email || r.felder.email, phone: prev.phone || r.felder.phone,
        linkedin_url: prev.linkedin_url || r.felder.linkedin_url.replace(/^https?:\/\/(www\.)?/, ''),
      }));
    } catch (e) {
      setCv({ name: f.name, id: null, status: 'fehler', meldung: e instanceof Error ? e.message : t('seite.cvReadFailed') });
    }
  };

  const buchen = async () => {
    if (!zeit || !daten) return;
    setSendet(true);
    setFeldFehler(null);
    try {
      const r = await terminSeiteApi.buchen(slug, stelle, { ...form, start: zeit, upload_id: cv?.id ?? null });
      if (r.termin) { setErgebnis(r.termin); setSchritt('fertig'); window.scrollTo({ top: 0 }); }
    } catch (e) {
      if (e instanceof FunktionsFehler && e.grund === 'conflict' && Array.isArray(e.extra.tage)) {
        setDaten(d => (d ? { ...d, tage: e.extra.tage as TerminTag[] } : d));
        setZeit(null);
        setHinweis(t('seite.takenKeep', { time: uhrzeit(zeit) }));
        setSchritt('zeit');
      } else if (e instanceof FunktionsFehler && typeof e.extra.feld === 'string') {
        setFeldFehler({ feld: e.extra.feld, meldung: e.message });
      } else {
        setFeldFehler({ feld: 'allgemein', meldung: e instanceof Error ? e.message : t('common.genericError') });
      }
    } finally {
      setSendet(false);
    }
  };

  const fehlerBei = (feld: string) => feldFehler?.feld === feld ? <p role="alert" className="text-xs text-destructive">{feldFehler.meldung}</p> : null;

  if (ladeFehler) return <div className="min-h-screen bg-background"><TerminKopf/><main className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-xl font-semibold">{t('seite.notFoundTitle')}</h1><p className="mt-2 text-sm text-muted-foreground">{ladeFehler}</p></main></div>;
  if (!daten) return <div className="min-h-screen bg-background"><TerminKopf/><main className="flex justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/></main></div>;

  const hh = daten.headhunter;
  const art = form.mode;
  const hhVorname = hh.name.split(' ')[0];
  const artName = (m: Gespraechsart) => (m === 'teams' ? t('common.teams') : t('common.phone'));

  let rechts: React.ReactNode;
  if (schritt === 'fertig' && ergebnis) {
    rechts = <div className="space-y-4">
      <CheckCircle2 className="h-8 w-8 text-emerald-600"/>
      <div><h2 className="text-xl font-semibold">{t('common.doneHeading')}</h2><p className="mt-1 text-sm">{tagLang(ergebnis.start)} · {uhrzeit(ergebnis.start)}–{uhrzeit(ergebnis.ende)} · {artName(ergebnis.mode)}</p><p className="text-sm text-muted-foreground">{t('common.with', { name: hh.name })}{daten.stelle ? ` · ${daten.stelle.titel}` : ''}</p></div>
      <Button variant="outline" onClick={() => downloadIcs(t('common.icsFile'), buildIcs({ title: t('common.icsTitle', { name: hh.name }), start: new Date(ergebnis.start), durationMinutes: daten.dauer, description: ergebnis.join_url ? t('common.icsTeams', { url: ergebnis.join_url }) : t('common.icsCallsYou', { name: hhVorname }), location: ergebnis.mode === 'teams' ? 'Microsoft Teams' : t('common.phone'), url: ergebnis.join_url ?? undefined }))}>
        <CalendarPlus className="mr-2 h-4 w-4"/>{t('common.addToCalendar')}
      </Button>
      <div className="rounded-lg bg-muted/50 p-4 text-sm"><p className="mb-1.5 font-medium">{t('seite.nextSteps')}</p><ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
        <li>{ergebnis.mode === 'teams' ? t('seite.mailComingTeams') : t('seite.mailComing')}</li>
        {cv?.id && <li>{t('seite.seesCv', { name: hhVorname })}</li>}
        <li>{daten.stelle ? t('seite.companyInCall') : t('seite.getsInTouch', { name: hhVorname })}</li>
      </ol></div>
    </div>;
  } else if (!daten.offen) {
    rechts = <div className="space-y-2 rounded-lg bg-muted/50 p-5">
      <p className="font-medium">{!daten.stelle_gefunden || daten.stelle ? t('seite.jobNotOpen') : t('seite.noBookable')}</p>
      <p className="text-sm text-muted-foreground">{daten.stelle ? t('seite.jobPaused') : t('common.notTakingBookings', { name: hh.name })}</p>
      {hh.linkedin && <Button variant="outline" size="sm" asChild><a href={hh.linkedin} target="_blank" rel="noreferrer"><Linkedin className="mr-1.5 h-3.5 w-3.5"/>{t('seite.onLinkedin', { name: hhVorname })}</a></Button>}
    </div>;
  } else if (schritt === 'zeit') {
    rechts = <div className="space-y-4">
      <div><h2 className="text-base font-semibold">{t('common.minutesConfidential', { count: daten.dauer })}</h2>
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{daten.arten.includes('teams') && <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5"/>{t('common.teams')}</span>}{daten.arten.includes('phone') && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5"/>{t('common.phone')}</span>}<span>{t('seite.timezone')}</span></p></div>
      {hinweis && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{hinweis}</p>}
      {daten.tage.length ? <>
        <Zeitwahl tage={daten.tage} gewaehlt={zeit} onWahl={z => { setZeit(z); setHinweis(''); }}/>
        <Button className="w-full" disabled={!zeit} onClick={() => setSchritt('angaben')}>{zeit ? t('seite.continueWith', { time: uhrzeit(zeit) }) : t('common.chooseTime')}</Button>
        <p className="text-xs text-muted-foreground">{t('seite.busyHidden', { name: hhVorname })}</p>
      </> : <div className="space-y-2 rounded-lg bg-muted/50 p-5">
        <p className="font-medium">{daten.kalender ? t('common.fullyBooked', { name: hhVorname }) : t('common.noTimes')}</p>
        <p className="text-sm text-muted-foreground">{hh.linkedin ? t('seite.comeBackLinkedin') : t('seite.comeBack')}</p>
        {hh.linkedin && <Button variant="outline" size="sm" asChild><a href={hh.linkedin} target="_blank" rel="noreferrer"><Linkedin className="mr-1.5 h-3.5 w-3.5"/>{t('seite.writeLinkedin')}</a></Button>}
      </div>}
    </div>;
  } else {
    rechts = <form className="space-y-4" onSubmit={e => { e.preventDefault(); void buchen(); }}>
      <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => setSchritt('zeit')}><ArrowLeft className="h-3.5 w-3.5"/>{t('seite.otherTime')}</button>
      <div><p className="text-xs text-muted-foreground">{t('common.yourAppointment')}</p><p className="text-base font-semibold">{zeit && `${terminKurz(zeit)}–${uhrzeit(new Date(Date.parse(zeit) + daten.dauer * 60000).toISOString())}`}</p><p className="text-sm text-muted-foreground">{t('common.with', { name: hh.name })}</p></div>

      <div>
        <input ref={datei} type="file" className="hidden" accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" onChange={e => { void lebenslauf(e.target.files?.[0]); e.target.value = ''; }}/>
        <button type="button" onClick={() => datei.current?.click()} className={cn('flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-3 text-left text-sm', cv?.status === 'fehler' ? 'border-destructive/60' : 'border-border hover:bg-muted/50')}>
          {cv?.status === 'liest' ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground"/> : cv && cv.status !== 'fehler' ? <FileCheck2 className="h-5 w-5 shrink-0 text-emerald-600"/> : <Upload className="h-5 w-5 shrink-0 text-muted-foreground"/>}
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{cv ? cv.name : t('seite.uploadCv')}</span>
            <span className={cn('block text-xs', cv?.status === 'fehler' ? 'text-destructive' : cv?.status === 'gelesen' ? 'text-emerald-600' : 'text-muted-foreground')}>
              {cv?.status === 'liest' ? t('seite.cvReading') : cv?.status === 'gelesen' ? t('seite.cvRead') : cv?.status === 'nicht_gelesen' ? t('seite.cvAttached') : cv?.status === 'fehler' ? cv.meldung : t('seite.cvHint')}
            </span>
          </span>
          {cv && cv.status !== 'liest' && <span className="text-xs text-muted-foreground underline">{t('common.change')}</span>}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="t-vorname">{t('seite.firstName')}</Label><Input id="t-vorname" autoComplete="given-name" value={form.first_name} onChange={e => setze('first_name', e.target.value)}/>{fehlerBei('first_name')}</div>
        <div className="space-y-1"><Label htmlFor="t-nachname">{t('seite.lastName')}</Label><Input id="t-nachname" autoComplete="family-name" value={form.last_name} onChange={e => setze('last_name', e.target.value)}/>{fehlerBei('last_name')}</div>
        <div className="space-y-1"><Label htmlFor="t-email">{t('seite.email')}</Label><Input id="t-email" type="email" autoComplete="email" value={form.email} onChange={e => setze('email', e.target.value)}/>{fehlerBei('email')}</div>
        <div className="space-y-1"><Label htmlFor="t-telefon">{t('seite.phone')}{art === 'phone' ? '' : <span className="font-normal text-muted-foreground"> {t('common.optional')}</span>}</Label><Input id="t-telefon" type="tel" autoComplete="tel" value={form.phone} onChange={e => setze('phone', e.target.value)}/>{fehlerBei('phone')}</div>
      </div>
      <div className="space-y-1"><Label htmlFor="t-linkedin">{t('common.linkedinProfile')} <span className="font-normal text-muted-foreground">{t('common.optional')}</span></Label><Input id="t-linkedin" placeholder="linkedin.com/in/…" value={form.linkedin_url} onChange={e => setze('linkedin_url', e.target.value)}/>{fehlerBei('linkedin_url')}</div>
      {daten.arten.length > 1 && <fieldset className="space-y-1.5"><legend className="text-sm font-medium">{t('common.howToTalk')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['teams', 'phone'] as const).map(m => <label key={m} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm', art === m ? 'border-foreground' : 'border-border')}>
            <input type="radio" name="art" className="sr-only" checked={art === m} onChange={() => setze('mode', m)}/>
            {m === 'teams' ? <Video className="h-4 w-4"/> : <Phone className="h-4 w-4"/>}{m === 'teams' ? t('common.teams') : t('common.phoneCalls', { name: hhVorname })}
          </label>)}
        </div>{fehlerBei('mode')}
      </fieldset>}
      <div className="space-y-1"><Label htmlFor="t-notiz">{t('seite.whatToKnow', { name: hhVorname })} <span className="font-normal text-muted-foreground">{t('common.optional')}</span></Label><Textarea id="t-notiz" rows={3} placeholder={t('seite.notePlaceholder')} value={form.note} onChange={e => setze('note', e.target.value)}/></div>
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => setze('website', e.target.value)}/></label></div>
      <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
        <Checkbox checked={form.consent} onCheckedChange={v => setze('consent', v === true)} className="mt-0.5"/>
        <span>{cv?.id ? t('common.consentWithCv', { name: hh.name }) : t('common.consent', { name: hh.name })} <Link to="/datenschutz" target="_blank" className="underline">{t('common.privacy')}</Link></span>
      </label>
      {fehlerBei('consent')}{fehlerBei('allgemein')}
      <Button type="submit" className="w-full" disabled={sendet || cv?.status === 'liest'}>{sendet && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{t('seite.book')}</Button>
    </form>;
  }

  return <div className="min-h-screen bg-background">
    <TerminKopf/>
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className={cn('p-5 pb-0 sm:p-7 sm:pb-0 md:border-r md:border-border md:pb-7', schritt !== 'zeit' && mobil && 'hidden')}><Stelle d={daten} mobil={mobil}/></div>
        <div className="p-5 sm:p-7">{rechts}</div>
      </div>
    </main>
    <TerminFuss/>
  </div>;
}
