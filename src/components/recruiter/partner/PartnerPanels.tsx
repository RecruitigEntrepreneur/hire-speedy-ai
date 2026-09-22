import { useState, type ReactNode } from 'react';
import { Check, Copy, Download, Info, Linkedin, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { cn } from '@/lib/utils';
import { LiveBadge, PartnerCard } from './PartnerCard';
import {
  APP_ORIGIN, checkLabel, checkUrl, dayDate, embedCode, LINKEDIN_ORGANIZATION_ID, linkedinAddUrl, linkedinShareUrl, monthYear, offerText, outreachText, postText,
  PRIVACY_SENTENCE, signatureHtml, signatureText, TIER_LABEL, type Lang, type PartnerChannel, type PartnerStatusRow,
} from '../../../../supabase/functions/_shared/recruiter-partner';

/**
 * Die Klickseiten des Partnerstatus (Wireframe 22.09.2026). Jedes Fenster hat denselben
 * Aufbau: Vorschau, Kopieren, Kurzanleitung, eine Zeile Regel, „Ist eingerichtet“.
 */
export type PanelKind = 'linkedin' | 'signature' | 'website' | 'outreach' | 'post' | 'print';
/** focus: Schwerpunkte mit Ebene (Prüfseite); areas: nur die Bereiche (Beitrag). */
export interface PartnerPerson { name: string; company: string; roleTitle: string; focus: string; areas: string }
export interface PanelActions {
  copy: (text: string, what?: string) => void;
  copyRich: (html: string, text: string) => void;
  channel: (channel: PartnerChannel, done: boolean) => void;
  certificate: () => void;
  qr: (format: 'svg' | 'png') => void;
  testMail: (lang: Lang) => void;
  busy: string;
}

function Step({ n, children }: { n?: number; children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{n ? `${n} · ` : ''}{children}</p>;
}

function Rule({ children }: { children: ReactNode }) {
  return <p className="flex gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/><span>{children}</span></p>;
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [NoInfer<T>, string][]; onChange: (v: NoInfer<T>) => void }) {
  return <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border border-border text-xs">
    {options.map(([key, text]) => <button key={key} type="button" aria-pressed={value === key} onClick={() => onChange(key)}
      className={cn('px-2.5 py-1', value === key ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60')}>{text}</button>)}
  </div>;
}

function CopyRow({ label, value, mono, onCopy, hint }: { label: string; value: string; mono?: boolean; onCopy?: () => void; hint?: string }) {
  return <div className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={cn('break-words', mono && 'font-mono text-xs')}>{value}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    {onCopy ? <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`${label} kopieren`} onClick={onCopy}><Copy className="h-3.5 w-3.5"/></Button> : <span/>}
  </div>;
}

function CopyBox({ text, onCopy }: { text: string; onCopy: () => void }) {
  return <div className="grid grid-cols-[minmax(0,1fr)_28px] gap-2 rounded-md border border-border p-3 text-sm leading-relaxed">
    <span className="break-words">{text}</span>
    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Text kopieren" onClick={onCopy}><Copy className="h-3.5 w-3.5"/></Button>
  </div>;
}

function Done({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return <label className="flex items-center gap-2 border-t border-border pt-4 text-sm">
    <Checkbox checked={checked} disabled={disabled} onCheckedChange={v => onChange(v === true)}/>{label}
  </label>;
}

function Header({ title, description }: { title: string; description: string }) {
  return <SheetHeader className="text-left"><SheetTitle>{title}</SheetTitle><SheetDescription>{description}</SheetDescription></SheetHeader>;
}

/** Weiße Fläche wie beim Empfänger; Dunkel simuliert ein Mailprogramm im Dunkelmodus. */
function Paper({ dark, children, className }: { dark?: boolean; children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-border p-4 text-[13px] leading-relaxed',
    dark ? 'bg-[#1C1C1E] text-[#F2F2F2] [&_a]:!text-[#F4F4F5] [&_td]:!text-[#A1A1AA]' : 'bg-white text-[#1A1A1A]', className)}>{children}</div>;
}

function LinkedInPanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const url = linkedinAddUrl({ number: partner.partner_number, grantedAt: partner.granted_at, tier: partner.tier });
  const name = TIER_LABEL[partner.tier];
  return <>
    <Header title="LinkedIn" description="Zertifikat in deinem Profil"/>
    <Paper className="grid grid-cols-[40px_1fr] gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0A0A0A] text-white"><MatchuntLogo size={26}/></span>
      <div className="text-xs leading-relaxed text-[#52525B]">
        <p className="text-[13px] font-semibold text-[#0A0A0A]">{name}</p>
        <p>Matchunt</p>
        <p>Ausgestellt: {monthYear(partner.granted_at)}</p>
        <p>Nachweis-ID: {partner.partner_number}</p>
        <span className="mt-1.5 inline-block rounded-full border border-[#52525B] px-2.5 py-0.5 text-[11px] text-[#0A0A0A]">Nachweis anzeigen ↗</span>
      </div>
    </Paper>
    {url ? <>
      <Step n={1}>Öffnen</Step>
      <Button className="justify-self-start" onClick={() => window.open(url, '_blank', 'noopener')}><Linkedin className="mr-2 h-4 w-4"/>Zu LinkedIn hinzufügen</Button>
      <Step n={2}>Falls die Felder leer sind, kopieren</Step>
      <div>
        <CopyRow label="Name" value={name} onCopy={() => a.copy(name, 'Name')}/>
        <CopyRow label="Organisation" value="Matchunt" hint="In der Liste die Seite mit unserem Logo wählen" onCopy={() => a.copy('Matchunt', 'Organisation')}/>
        <CopyRow label="Ausgestellt" value={`${monthYear(partner.granted_at)}, kein Ablaufdatum`}/>
        <CopyRow label="Nachweis-ID" value={partner.partner_number} mono onCopy={() => a.copy(partner.partner_number, 'Nachweis-ID')}/>
        <CopyRow label="Nachweis-URL" value={checkUrl(partner.partner_number)} mono onCopy={() => a.copy(checkUrl(partner.partner_number), 'Nachweis-URL')}/>
      </div>
    </> : <Rule>Das Zertifikat schalten wir frei, sobald die LinkedIn-Seite von Matchunt online ist. Dann steht dort unser Logo. Den Zusatz für deine Headline kannst du schon nutzen.</Rule>}
    <Step n={url ? 3 : undefined}>Optional für deine Headline</Step>
    <div>
      <CopyRow label="Zusatz" value="· Matchunt Partner" hint="Etwa: Headhunter (selbstständig) · Matchunt Partner" onCopy={() => a.copy(' · Matchunt Partner', 'Zusatz')}/>
    </div>
    <Rule>Bitte trag Matchunt nicht als Station ein und schreib nie „bei Matchunt“. Der richtige Ort ist das Zertifikat.</Rule>
    {url && <Done label="Ist eingerichtet" checked={!!partner.channels.linkedin} disabled={a.busy === 'channel'} onChange={v => a.channel('linkedin', v)}/>}
  </>;
}

const MAIL_STEPS: Record<'gmail' | 'outlook' | 'apple', string[]> = {
  gmail: ['Zahnrad, dann „Alle Einstellungen aufrufen“', 'Unter „Signatur“ deine Signatur öffnen', 'Unter deinen Namen einfügen, ganz unten „Änderungen speichern“'],
  outlook: ['Einstellungen, dann „Konten“ und „Signaturen“', 'Deine Signatur öffnen', 'Unter deinen Namen einfügen und speichern'],
  apple: ['Mail, dann „Einstellungen“ und „Signaturen“', 'Signatur wählen, „Immer meiner Standardschrift entsprechen“ abwählen', 'Unter deinen Namen einfügen, Fenster schließen'],
};

function SignaturePanel({ partner, person, a }: { partner: PartnerStatusRow; person: PartnerPerson; a: PanelActions }) {
  const [client, setClient] = useState<'gmail' | 'outlook' | 'apple'>('gmail');
  const [dark, setDark] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<Lang>('de');
  const [code, setCode] = useState(false);
  const html = signatureHtml({ number: partner.partner_number, tier: partner.tier, lang });
  return <>
    <Header title="E-Mail-Signatur" description="Ein Baustein unter deiner eigenen Signatur"/>
    <div className="flex flex-wrap gap-2">
      <Segmented label="Vorschau" value={dark} onChange={setDark} options={[['light', 'Hell'], ['dark', 'Dunkel']]}/>
      <Segmented label="Sprache" value={lang} onChange={setLang} options={[['de', 'Deutsch'], ['en', 'Englisch']]}/>
    </div>
    <Paper dark={dark === 'dark'}>
      <p>{lang === 'en' ? 'Best regards' : 'Beste Grüße'}</p>
      <p className="font-semibold">{person.name || 'Dein Name'}</p>
      {(person.roleTitle || person.company) && <p className={dark === 'dark' ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'}>{[person.roleTitle, person.company].filter(Boolean).join(' · ')}</p>}
      {/* Vorschau lädt das Abzeichen von dieser Seite; kopiert wird die Adresse auf matchunt.ai. */}
      <div dangerouslySetInnerHTML={{ __html: html.split(`${APP_ORIGIN}/badges/`).join('/badges/') }}/>
    </Paper>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => a.copyRich(html, signatureText({ number: partner.partner_number, tier: partner.tier, lang }))}><Copy className="mr-2 h-4 w-4"/>Signatur kopieren</Button>
      <Button variant="outline" aria-expanded={code} onClick={() => setCode(!code)}>HTML-Code</Button>
      <Button variant="outline" disabled={a.busy === 'test'} onClick={() => a.testMail(lang)}>
        {a.busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}Test an mich
      </Button>
    </div>
    {code && <div className="space-y-2">
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px]">{html}</pre>
      <Button variant="outline" size="sm" onClick={() => a.copy(html, 'HTML-Code')}><Copy className="mr-2 h-3.5 w-3.5"/>Code kopieren</Button>
    </div>}
    <div className="space-y-2">
      <Segmented label="Mailprogramm" value={client} onChange={setClient} options={[['gmail', 'Gmail'], ['outlook', 'Outlook'], ['apple', 'Apple Mail']]}/>
      <ol className="space-y-1 text-sm">{MAIL_STEPS[client].map((s, i) => <li key={s} className="flex gap-2"><span className="text-muted-foreground">{i + 1}</span>{s}</li>)}</ol>
    </div>
    <Rule>Der Baustein kommt unter deine eigene Signatur. Matchunt ist nie Absender.</Rule>
    <Done label="Ist eingerichtet" checked={!!partner.channels.signature} disabled={a.busy === 'channel'} onChange={v => a.channel('signature', v)}/>
  </>;
}

function WebsitePanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [size, setSize] = useState<'l' | 's'>('l');
  const code = embedCode(partner.partner_number, { theme, size });
  return <>
    <Header title="Website" description="Abzeichen, das deinen Status immer aktuell zeigt"/>
    <div className="flex flex-wrap gap-2">
      <Segmented label="Farbe" value={theme} onChange={setTheme} options={[['light', 'Hell'], ['dark', 'Dunkel']]}/>
      <Segmented label="Größe" value={size} onChange={setSize} options={[['l', 'Groß'], ['s', 'Klein']]}/>
    </div>
    <div className="overflow-hidden rounded-lg border border-border">
      <p className="border-b border-border bg-muted/40 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{partner.website_domain ?? 'deine-website.de'}</p>
      <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-4', theme === 'dark' ? 'bg-[#111111]' : 'bg-[#FAFAFA]')}>
        <span className={cn('text-[11px]', theme === 'dark' ? 'text-[#A1A1AA]' : 'text-[#71717A]')}>© {new Date().getFullYear()} · Impressum · Datenschutz</span>
        <LiveBadge tier={partner.tier} theme={theme} size={size}/>
      </div>
    </div>
    <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px]">{code}</pre>
    <Button className="justify-self-start" onClick={() => a.copy(code, 'Code')}><Copy className="mr-2 h-4 w-4"/>Code kopieren</Button>
    <p className="text-xs text-muted-foreground">Den Code fügst du dort ein, wo das Abzeichen stehen soll, meist im Seitenfuß. Er zeigt deinen Status immer aktuell und setzt keine Cookies.</p>
    <div>
      <CopyRow label="Datenschutz" value="Satz für deine Datenschutzerklärung" hint="Vorschlag, bitte mit deiner eigenen abgleichen" onCopy={() => a.copy(PRIVACY_SENTENCE, 'Satz')}/>
    </div>
    <Rule>Nur auf deiner eigenen Website und unverändert einbinden.</Rule>
    <p className={cn('flex items-center gap-2 border-t border-border pt-4 text-sm', partner.website_domain ? 'text-success' : 'text-muted-foreground')}>
      {partner.website_domain ? <><Check className="h-4 w-4"/>Läuft auf {partner.website_domain}{partner.website_seen_at ? `, zuletzt am ${dayDate(partner.website_seen_at)}` : ''}</>
        : 'Noch nicht gefunden. Wir erkennen es, sobald es auf deiner Website lädt.'}
    </p>
  </>;
}

function OutreachPanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const [lang, setLang] = useState<Lang>('de');
  const [formal, setFormal] = useState<'sie' | 'du'>('sie');
  const short = outreachText({ number: partner.partner_number, lang, formal: formal === 'sie', long: false });
  const long = outreachText({ number: partner.partner_number, lang, formal: formal === 'sie', long: true });
  return <>
    <Header title="Kandidatenansprache" description="Ein Satz für LinkedIn-Nachrichten und Mails"/>
    <div className="flex flex-wrap gap-2">
      <Segmented label="Sprache" value={lang} onChange={setLang} options={[['de', 'Deutsch'], ['en', 'Englisch']]}/>
      {lang === 'de' && <Segmented label="Anrede" value={formal} onChange={setFormal} options={[['sie', 'Sie'], ['du', 'Du']]}/>}
    </div>
    <Step>Kurz, für LinkedIn-Nachrichten</Step>
    <CopyBox text={short} onCopy={() => a.copy(short, 'Text')}/>
    <Step>Ausführlich, für Mails</Step>
    <CopyBox text={long} onCopy={() => a.copy(long, 'Text')}/>
    <Rule>Keine Kunden von Matchunt nennen.</Rule>
  </>;
}

function PostPanel({ partner, person, a }: { partner: PartnerStatusRow; person: PartnerPerson; a: PanelActions }) {
  const [lang, setLang] = useState<Lang>('de');
  const text = postText({ number: partner.partner_number, lang, focus: person.areas });
  const initials = person.name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'MP';
  return <>
    <Header title="LinkedIn-Beitrag" description="Deinen neuen Status bekannt machen"/>
    <Paper className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4E4E7] text-xs font-semibold text-[#0A0A0A]">{initials}</span>
        <span className="leading-tight"><span className="block text-[13px] font-semibold">{person.name || 'Dein Name'}</span><span className="text-[11px] text-[#71717A]">{person.roleTitle || 'Headhunter (selbstständig)'} · Matchunt Partner</span></span>
      </div>
      <p className="whitespace-pre-line">{text.replace(checkUrl(partner.partner_number), '').trim()}</p>
      <div className="overflow-hidden rounded-md border border-[#E4E4E7]">
        <div className="flex items-center gap-3 bg-[#0A0A0A] px-4 py-5 text-white"><MatchuntLogo size={44}/><span className="leading-tight"><span className="block text-lg font-semibold">Matchunt</span><span className="text-xs text-[#A1A1AA]">Perfect Match. Perfect Hire.</span></span></div>
        <p className="px-3 py-1.5 text-[11px] text-[#71717A]">matchunt.ai · {checkLabel(partner.partner_number)}</p>
      </div>
    </Paper>
    <Segmented label="Sprache" value={lang} onChange={setLang} options={[['de', 'Deutsch'], ['en', 'Englisch']]}/>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => a.copy(text, 'Text')}><Copy className="mr-2 h-4 w-4"/>Text kopieren</Button>
      <Button onClick={() => window.open(linkedinShareUrl(partner.partner_number), '_blank', 'noopener')}><Linkedin className="mr-2 h-4 w-4"/>Auf LinkedIn teilen</Button>
    </div>
    <p className="text-xs text-muted-foreground">LinkedIn übernimmt den Link mit Vorschaubild. Den Text fügst du selbst ein.</p>
    <Rule>Matchunt nicht als Arbeitgeber darstellen und keine Kunden nennen.</Rule>
    <Done label="Geteilt" checked={!!partner.channels.post} disabled={a.busy === 'channel'} onChange={v => a.channel('post', v)}/>
  </>;
}

function PrintPanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const offer = offerText(partner.partner_number);
  const file = (path: string) => `/badges/${path}`;
  const tierFile = partner.tier === 'gold' ? 'gold' : 'partner';
  return <>
    <Header title="Druck und Unterlagen" description="Für Angebote, Präsentationen und Visitenkarte"/>
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-x-3 gap-y-4 text-sm">
      <div className="flex h-12 w-[72px] flex-col gap-1 rounded border border-[#E4E4E7] bg-white p-1.5"><MatchuntLogo size={16} className="text-[#0A0A0A]"/><span className="h-1 w-10 bg-[#0A0A0A]"/><span className="h-0.5 w-12 bg-[#D4D4D8]"/></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-medium">Urkunde</span><span className="text-xs text-muted-foreground">PDF, A4 quer, mit QR-Code</span></span>
        <Button size="sm" variant="outline" disabled={a.busy === 'certificate'} onClick={a.certificate}>{a.busy === 'certificate' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Download className="mr-1.5 h-3.5 w-3.5"/>}PDF</Button></div>
      <PartnerCard tier={partner.tier} size="sm"/>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-medium">Abzeichen</span><span className="text-xs text-muted-foreground">PNG in Druckgröße, SVG</span></span>
        <span className="flex flex-wrap gap-1.5">
          {partner.tier === 'gold'
            ? <Button size="sm" variant="outline" asChild><a href={file('gold.png')} download>PNG</a></Button>
            : <><Button size="sm" variant="outline" asChild><a href={file('partner-light.png')} download>PNG hell</a></Button><Button size="sm" variant="outline" asChild><a href={file('partner-dark.png')} download>PNG dunkel</a></Button></>}
          <Button size="sm" variant="outline" asChild><a href={file(`${tierFile === 'gold' ? 'gold' : 'partner-light'}.svg`)} download>SVG</a></Button>
        </span></div>
      <div className="grid h-12 w-12 grid-cols-3 gap-0.5 rounded border border-[#E4E4E7] bg-white p-1.5" aria-hidden>{[1, 0, 1, 0, 1, 0, 1, 1, 0].map((d, i) => <span key={i} className={d ? 'bg-[#0A0A0A]' : ''}/>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-medium">QR-Code zur Prüfseite</span><span className="text-xs text-muted-foreground">Für Visitenkarte und Folien</span></span>
        <span className="flex gap-1.5"><Button size="sm" variant="outline" disabled={a.busy === 'qr'} onClick={() => a.qr('png')}>PNG</Button><Button size="sm" variant="outline" disabled={a.busy === 'qr'} onClick={() => a.qr('svg')}>SVG</Button></span></div>
    </div>
    <Step>Absatz für Angebote an Kunden</Step>
    <CopyBox text={offer} onCopy={() => a.copy(offer, 'Absatz')}/>
    <Rule>Abzeichen nicht verändern und nur nutzen, solange dein Status aktiv ist.</Rule>
  </>;
}

export function PartnerPanel({ kind, partner, person, actions }: { kind: PanelKind; partner: PartnerStatusRow; person: PartnerPerson; actions: PanelActions }) {
  const body = {
    linkedin: <LinkedInPanel partner={partner} a={actions}/>,
    signature: <SignaturePanel partner={partner} person={person} a={actions}/>,
    website: <WebsitePanel partner={partner} a={actions}/>,
    outreach: <OutreachPanel partner={partner} a={actions}/>,
    post: <PostPanel partner={partner} person={person} a={actions}/>,
    print: <PrintPanel partner={partner} a={actions}/>,
  }[kind];
  return <div className="grid gap-4">{body}</div>;
}

export const LINKEDIN_READY = !!LINKEDIN_ORGANIZATION_ID;
