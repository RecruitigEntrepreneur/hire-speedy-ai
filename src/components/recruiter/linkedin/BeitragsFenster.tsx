import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, CalendarOff, Check, CheckCircle2, Copy, Download, ExternalLink, Globe, Linkedin, Loader2, MessageSquare, Repeat2, ShieldCheck, ThumbsUp, Users, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { baueBeitrag, BEITRAG_MAX, TOENE, type Ton } from '@/lib/linkedinBeitrag';
import { beitragsBildPng, FORMATE, VORLAGEN, zeichneBeitragsBild, type Format, type Vorlage } from '@/lib/beitragsBild';
import { kopfFakten } from '@/lib/stellenKopf';
import { FunktionsFehler, linkedinApi } from '@/lib/terminApi';
import { anonymFunde, ersetzeFunde, grundText } from '../../../../supabase/functions/_shared/linkedin-anonym';
import { normLang } from '../../../../supabase/functions/_shared/i18n';
import { candidateLanguage, tFor } from '@/lib/localeFormat';
import { useLinkedin, useTerminseite } from '@/components/recruiter/termin/useTerminseite';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { useTranslation } from 'react-i18next';
import { intlLocale } from '@/i18n/languages';

/**
 * Beitragsfenster (21.10.2026): die Stelle anonym auf LinkedIn posten.
 * Links genau so, wie es im Feed erscheint; rechts anpassen; unten freigeben.
 * Gepostet wird nur nach dem Klick auf „Freigeben“. Ohne LinkedIn-Verbindung
 * (oder solange die App fehlt) geht es von Hand: Text kopieren, Bild laden.
 */
function Segment<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-border text-xs">
    {options.map(o => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}
      className={cn('px-2.5 py-1 transition-colors', value === o.id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60')}>{o.label}</button>)}
  </div>;
}

const zuBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ''));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

export function BeitragsFenster({ open, onOpenChange, job }: { open: boolean; onOpenChange: (o: boolean) => void; job: WorkspaceJob }) {
  const { user } = useAuth();
  const { t: tr, i18n } = useTranslation('recruiterJobDetail');
  const locale = intlLocale(i18n.language);
  const qc = useQueryClient();
  const kontakt = useRecruiterKontakt();
  const { zeile: seite } = useTerminseite();
  const li = useLinkedin({ enabled: open });
  const partner = useQuery({
    queryKey: ['partner-aktiv', user?.id], enabled: open && !!user?.id, staleTime: 300_000,
    queryFn: async () => { const { data } = await supabase.from('recruiter_partner_status' as never).select('ended_at').eq('user_id', user!.id).maybeSingle(); return !!data && !(data as { ended_at: string | null }).ended_at; },
  });

  const [ton, setTon] = useState<Ton>('sachlich');
  const [gehalt, setGehalt] = useState(true);
  const [partnerZeigen, setPartnerZeigen] = useState(true);
  const [vorlage, setVorlage] = useState<Vorlage>('dunkel');
  const [format, setFormat] = useState<Format>('quadrat');
  const [sichtbar, setSichtbar] = useState<'PUBLIC' | 'CONNECTIONS'>('PUBLIC');
  const [region, setRegion] = useState('');
  const [text, setText] = useState('');
  const [bearbeitet, setBearbeitet] = useState(false);
  const [mehr, setMehr] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState('');
  const [ergebnis, setErgebnis] = useState<{ url: string; postId: string; zeit: string } | null>(null);
  const [vonHand, setVonHand] = useState(false);
  const leinwand = useRef<HTMLCanvasElement>(null);

  const slug = seite?.active ? seite.slug : null;
  const beitrag = useMemo(() => baueBeitrag(job, { ton, gehalt, slug, region: region || null }), [job, ton, gehalt, slug, region]);
  useEffect(() => { if (!bearbeitet) setText(beitrag.text); }, [beitrag.text, bearbeitet]);
  useEffect(() => { if (open) { setErgebnis(null); setFehler(''); } }, [open]);

  const roh = job as unknown as Record<string, unknown>;
  const funde = useMemo(() => anonymFunde(text, {
    firma: job.company_name, redList: (roh.reveal_envelope as { red_list?: unknown } | null)?.red_list,
    domains: [roh.company_website as string | null], region: beitrag.region, mitarbeitende: Number(roh.company_headcount) || null,
    lang: normLang(candidateLanguage()),
  }), [text, job.company_name, roh.reveal_envelope, roh.company_website, roh.company_headcount, beitrag.region]);

  const bild = useMemo(() => ({
    region: beitrag.region.text, titel: job.title, gehalt: beitrag.gehalt,
    zusatz: kopfFakten(job).find(f => f.symbol === 'ort')?.text ?? null,
    vorteile: beitrag.vorteile, name: kontakt?.name || (tFor(candidateLanguage(), 'jobPosting')('beitrag.yourName') as string), link: beitrag.link, partner: !!partner.data && partnerZeigen,
  }), [beitrag, job, kontakt?.name, partner.data, partnerZeigen]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => { if (leinwand.current) zeichneBeitragsBild(leinwand.current, bild, vorlage, format); }, 30);
    return () => window.clearTimeout(t);
  }, [open, bild, vorlage, format]);

  const rueck = `/recruiter/jobs/${job.id}?beitrag=1`;
  const lang = text.length > BEITRAG_MAX;
  const sauber = !funde.length && !lang && text.trim().length >= 20;
  const initialen = (kontakt?.name ?? '').split(/\s+/).slice(0, 2).map(t => t[0]?.toUpperCase()).join('') || '·';
  const vorschauText = mehr ? text : text.split('\n').slice(0, 7).join('\n');

  const freigeben = async () => {
    if (!sauber) return;
    setSendet(true);
    setFehler('');
    try {
      const png = await beitragsBildPng(bild, vorlage, format);
      const r = await linkedinApi.posten({ job_id: job.id, text, bild: await zuBase64(png), vorlage, format, sichtbarkeit: sichtbar, gehalt });
      setErgebnis({ url: r.url, postId: r.post_id, zeit: r.gepostet });
      void qc.invalidateQueries({ queryKey: ['beitrag-stand', job.id] });
    } catch (e) {
      if (e instanceof FunktionsFehler && e.grund === 'expired') void qc.invalidateQueries({ queryKey: ['linkedin-status'] });
      setFehler(e instanceof Error ? e.message : tr('post.rejected'));
    } finally {
      setSendet(false);
    }
  };

  const loeschen = async () => {
    if (!ergebnis) return;
    try { await linkedinApi.loeschen(ergebnis.postId); setErgebnis(null); toast.success(tr('post.deleted')); void qc.invalidateQueries({ queryKey: ['beitrag-stand', job.id] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : tr('post.deleteFailed')); }
  };

  const textKopieren = async () => {
    try { await navigator.clipboard.writeText(text); toast.success(tr('post.textCopied')); } catch { toast.error(tr('post.copyFailed')); }
  };
  const bildLaden = async () => {
    const png = await beitragsBildPng(bild, vorlage, format);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(png);
    a.download = `stelle-${job.title.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase().slice(0, 40)}.png`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const selbstGepostet = async () => {
    const { error } = await supabase.from('job_linkedin_posts' as never).insert({ job_id: job.id, recruiter_id: user!.id, status: 'manual', text, template: vorlage, format, visibility: sichtbar, show_salary: gehalt } as never);
    if (error) { toast.error(tr('post.saveFailed')); return; }
    toast.success(tr('post.noted'));
    void qc.invalidateQueries({ queryKey: ['beitrag-stand', job.id] });
    onOpenChange(false);
  };

  const status = li.status;
  const direkt = !!status?.eingerichtet;

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1040px,96vw)]">
      <SheetHeader className="border-b border-border px-5 py-4 text-left">
        <SheetTitle className="text-base">{tr('ws.postAria')}</SheetTitle>
        <SheetDescription>{tr('post.description', { title: job.title })}</SheetDescription>
      </SheetHeader>

      {ergebnis ? <div className="flex flex-1 flex-col items-start gap-3 overflow-y-auto p-6">
        <p className="flex items-center gap-2 text-lg font-semibold text-emerald-600"><CheckCircle2 className="h-5 w-5"/>{tr('post.posted')}</p>
        <p className="text-sm text-muted-foreground">{tr(sichtbar === 'PUBLIC' ? 'post.visibleAll' : 'post.visibleContacts', { date: new Date(ergebnis.zeit).toLocaleString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }) })}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild><a href={ergebnis.url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4"/>{tr('post.viewPost')}</a></Button>
          <Button variant="outline" onClick={() => void loeschen()}>{tr('post.deletePost')}</Button>
        </div>
        <p className="text-sm text-muted-foreground">{tr('post.bookingsNote')}</p>
      </div> : <>
        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          {/* Vorschau wie im Feed */}
          <div className="border-b border-border bg-muted/40 p-5 md:border-b-0 md:border-r">
            <p className="mb-2 text-xs text-muted-foreground">{tr('post.preview')}</p>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex gap-2.5 px-3.5 pt-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">{initialen}</span>
                <div className="text-sm leading-tight"><p className="font-semibold">{kontakt?.name || tr('post.yourName')}</p><p className="flex items-center gap-1 text-xs text-muted-foreground">{tr('post.feedLine')} · {sichtbar === 'PUBLIC' ? <Globe className="h-3 w-3"/> : <Users className="h-3 w-3"/>}</p></div>
              </div>
              <p className="whitespace-pre-line px-3.5 py-2.5 text-[13px] leading-5">{vorschauText}{!mehr && text.split('\n').length > 7 && <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMehr(true)}> {tr('post.showMore')}</button>}</p>
              <canvas ref={leinwand} className="block h-auto w-full" aria-label={tr('post.imageAria')}/>
              <div className="flex justify-around border-t border-border py-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5"/>{tr('post.like')}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5"/>{tr('post.comment')}</span>
                <span className="inline-flex items-center gap-1"><Repeat2 className="h-3.5 w-3.5"/>{tr('ws.share')}</span>
              </div>
            </div>
          </div>

          {/* Anpassen */}
          <div className="space-y-5 p-5 text-sm">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{tr('post.text')}</p><Segment<Ton> label={tr('post.toneLabel')} value={ton} options={TOENE} onChange={t => { setTon(t); setBearbeitet(false); }}/></div>
              <Textarea value={text} rows={9} onChange={e => { setText(e.target.value); setBearbeitet(true); }}
                className={cn('text-[13px] leading-5', funde.length && 'border-destructive focus-visible:ring-destructive')}/>
              <div className="flex justify-between text-xs text-muted-foreground">
                {bearbeitet ? <button type="button" className="underline-offset-2 hover:underline" onClick={() => setBearbeitet(false)}>{tr('post.resetTemplate')}</button> : <span>{tr('post.editable')}</span>}
                <span className={cn(lang && 'text-destructive')}>{text.length.toLocaleString(locale)} / {BEITRAG_MAX.toLocaleString(locale)}</span>
              </div>
              {funde.length > 0 ? <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="flex items-center gap-1.5 font-medium text-destructive"><AlertTriangle className="h-4 w-4"/>{tr('post.leaks', { count: funde.length })}</p>
                <ul className="space-y-0.5 text-xs text-muted-foreground">{funde.map(f => <li key={f.treffer}>„{f.treffer.trim()}“ {grundText(f.grund, normLang(i18n.language))}</li>)}</ul>
                <Button size="sm" variant="outline" onClick={() => { setText(ersetzeFunde(text, funde)); setBearbeitet(true); }}>{tr('post.autoReplace')}</Button>
              </div> : <p className="flex items-start gap-1.5 rounded-md bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{tr('post.anonymous', { region: beitrag.region.text })}</p>}
            </section>

            <section className="space-y-2">
              <p className="text-xs text-muted-foreground">{tr('post.image')}</p>
              <div className="flex flex-wrap gap-2"><Segment<Vorlage> label={tr('post.templateLabel')} value={vorlage} options={VORLAGEN} onChange={setVorlage}/><Segment<Format> label={tr('post.formatLabel')} value={format} options={FORMATE.map(f => ({ id: f.id, label: f.label }))} onChange={setFormat}/></div>
            </section>

            <section className="space-y-2.5">
              <p className="text-xs text-muted-foreground">{tr('post.inPost')}</p>
              <label className="flex items-center justify-between gap-3"><span>{tr('post.showSalary')}{beitrag.gehalt ? <span className="text-muted-foreground"> ({beitrag.gehalt})</span> : null}</span><Switch checked={gehalt} onCheckedChange={setGehalt}/></label>
              {partner.data && <label className="flex items-center justify-between gap-3"><span>{tr('post.partnerBadge')}</span><Switch checked={partnerZeigen} onCheckedChange={setPartnerZeigen}/></label>}
              <div className="flex items-center justify-between gap-3">
                <span>{tr('post.bookingLink')}</span>
                {slug ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5"/>{tr('post.pageActive')}</span>
                  : <Link to={`/recruiter/profile/terminseite?zurueck=${encodeURIComponent(rueck)}`} className="flex items-center gap-1 text-xs text-amber-700 underline-offset-2 hover:underline"><CalendarOff className="h-3.5 w-3.5"/>{tr('post.setupPage')}</Link>}
              </div>
              {!slug && <p className="text-xs text-muted-foreground">{tr('post.withoutPage')}</p>}
              <div className="space-y-1">
                <label htmlFor="beitrag-region" className="text-xs text-muted-foreground">{tr('post.region')}</label>
                <Input id="beitrag-region" className="h-8" value={region || beitrag.region.text} onChange={e => setRegion(e.target.value)}/>
                {!beitrag.region.sicher && !region && <p className="text-xs text-amber-700">{tr('post.regionUnsure')}</p>}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs text-muted-foreground">{tr('post.visibleFor')}</p>
              <Segment<'PUBLIC' | 'CONNECTIONS'> label={tr('post.visibility')} value={sichtbar} options={[{ id: 'PUBLIC', label: tr('post.all') }, { id: 'CONNECTIONS', label: tr('post.contactsOnly') }]} onChange={setSichtbar}/>
            </section>

            {(vonHand || !direkt) && <section className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{direkt ? tr('post.manual') : tr('post.manualUntil')}</p>
              <div className="grid gap-1.5">
                <Button variant="outline" size="sm" className="justify-start" onClick={() => void textKopieren()}><Copy className="mr-2 h-3.5 w-3.5"/>{tr('post.step1')}</Button>
                <Button variant="outline" size="sm" className="justify-start" onClick={() => void bildLaden()}><Download className="mr-2 h-3.5 w-3.5"/>{tr('post.step2')}</Button>
                <Button size="sm" className="justify-start bg-[#0A66C2] text-white hover:bg-[#004182]" asChild><a href="https://www.linkedin.com/feed/?shareActive=true" target="_blank" rel="noreferrer"><Linkedin className="mr-2 h-3.5 w-3.5"/>{tr('post.step3')}</a></Button>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => void selbstGepostet()}><Check className="mr-1.5 h-3.5 w-3.5"/>{tr('post.iPosted')}</Button>
            </section>}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          {fehler ? <p role="alert" className="flex max-w-md items-start gap-1.5 text-xs text-destructive"><X className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{fehler}</p>
            : direkt && !vonHand ? <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setVonHand(true)}>{tr('post.preferManual')}</button> : <span/>}
          {direkt && (li.isLoading ? <Button disabled><Loader2 className="mr-2 h-4 w-4 animate-spin"/>LinkedIn …</Button>
            : !status?.verbunden ? <Button className="bg-[#0A66C2] text-white hover:bg-[#004182]" disabled={li.verbinden.isPending} onClick={() => li.verbinden.mutate(rueck)}>
                {li.verbinden.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Linkedin className="mr-2 h-4 w-4"/>}{status?.abgelaufen ? tr('post.reconfirm') : tr('post.connect')}
              </Button>
            : <Button className="bg-[#0A66C2] text-white hover:bg-[#004182]" disabled={!sauber || sendet} onClick={() => void freigeben()}>
                {sendet ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Linkedin className="mr-2 h-4 w-4"/>}{funde.length ? tr('post.fixFirst', { count: funde.length }) : tr('post.release')}
              </Button>)}
        </div>
      </>}
    </SheetContent>
  </Sheet>;
}
