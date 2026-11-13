import { useState, type ReactNode } from 'react';
import { fmtDate, fmtMonthYear } from '@/lib/localeFormat';
import { Check, Copy, Download, Info, Linkedin, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { cn } from '@/lib/utils';
import { LiveBadge, PartnerCard } from './PartnerCard';
import {
  APP_ORIGIN, checkLabel, checkUrl, embedCode, LINKEDIN_ORGANIZATION_ID, linkedinAddUrl, linkedinShareUrl, offerText, outreachText, postText,
  PRIVACY_SENTENCE, signatureHtml, signatureText, TIER_LABEL, type Lang, type PartnerChannel, type PartnerStatusRow,
} from '../../../../supabase/functions/_shared/recruiter-partner';
import { AWARD_LABEL, type LigaAwardBadge } from '../../../../supabase/functions/_shared/liga';
import { awardPostText } from '../liga/ligaShare';

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
  const { t } = useTranslation('recruiterPartner');
  return <div className="grid grid-cols-[96px_minmax(0,1fr)_28px] items-center gap-2 border-t border-border py-2 text-sm first:border-t-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={cn('break-words', mono && 'font-mono text-xs')}>{value}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    {onCopy ? <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('panel.copyAria', { label })} onClick={onCopy}><Copy className="h-3.5 w-3.5"/></Button> : <span/>}
  </div>;
}

function CopyBox({ text, onCopy }: { text: string; onCopy: () => void }) {
  const { t } = useTranslation('recruiterPartner');
  return <div className="grid grid-cols-[minmax(0,1fr)_28px] gap-2 rounded-md border border-border p-3 text-sm leading-relaxed">
    <span className="break-words">{text}</span>
    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t('panel.copyTextAria')} onClick={onCopy}><Copy className="h-3.5 w-3.5"/></Button>
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
  const { t } = useTranslation('recruiterPartner');
  return <>
    <Header title={t('tiles.linkedin.title')} description={t('tiles.linkedin.purpose')}/>
    <Paper className="grid grid-cols-[40px_1fr] gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#0A0A0A] text-white"><MatchuntLogo size={26}/></span>
      <div className="text-xs leading-relaxed text-[#52525B]">
        <p className="text-[13px] font-semibold text-[#0A0A0A]">{name}</p>
        <p>Matchunt</p>
        <p>{t('linkedin.issued', { date: fmtMonthYear(partner.granted_at) })}</p>
        <p>{t('linkedin.proofId', { number: partner.partner_number })}</p>
        <span className="mt-1.5 inline-block rounded-full border border-[#52525B] px-2.5 py-0.5 text-[11px] text-[#0A0A0A]">{t('linkedin.showProof')}</span>
      </div>
    </Paper>
    {url ? <>
      <Step n={1}>{t('linkedin.open')}</Step>
      <Button className="justify-self-start" onClick={() => window.open(url, '_blank', 'noopener')}><Linkedin className="mr-2 h-4 w-4"/>{t('linkedin.add')}</Button>
      <Step n={2}>{t('linkedin.copyIfEmpty')}</Step>
      <div>
        <CopyRow label={t('linkedin.name')} value={name} onCopy={() => a.copy(name, t('what.name'))}/>
        <CopyRow label={t('linkedin.organisation')} value="Matchunt" hint={t('linkedin.organisationHint')} onCopy={() => a.copy('Matchunt', t('what.organisation'))}/>
        <CopyRow label={t('linkedin.issuedLabel')} value={t('linkedin.issuedValue', { date: fmtMonthYear(partner.granted_at) })}/>
        <CopyRow label={t('linkedin.proofIdLabel')} value={partner.partner_number} mono onCopy={() => a.copy(partner.partner_number, t('what.proofId'))}/>
        <CopyRow label={t('linkedin.proofUrlLabel')} value={checkUrl(partner.partner_number)} mono onCopy={() => a.copy(checkUrl(partner.partner_number), t('what.proofUrl'))}/>
      </div>
    </> : <Rule>{t('linkedin.pending')}</Rule>}
    <Step n={url ? 3 : undefined}>{t('linkedin.headlineOptional')}</Step>
    <div>
      <CopyRow label={t('linkedin.addition')} value="· Matchunt Partner" hint={t('linkedin.additionHint')} onCopy={() => a.copy(' · Matchunt Partner', t('what.addition'))}/>
    </div>
    <Rule>{t('linkedin.rule')}</Rule>
    {url && <Done label={t('panel.isSetUp')} checked={!!partner.channels.linkedin} disabled={a.busy === 'channel'} onChange={v => a.channel('linkedin', v)}/>}
  </>;
}

// Drei Schritte je Mailprogramm; die Texte stehen in recruiterPartner:mail.<programm>.<0–2>.
const MAIL_STEPS = [0, 1, 2];

function SignaturePanel({ partner, person, award, a }: { partner: PartnerStatusRow; person: PartnerPerson; award: LigaAwardBadge | null; a: PanelActions }) {
  const [client, setClient] = useState<'gmail' | 'outlook' | 'apple'>('gmail');
  const [dark, setDark] = useState<'light' | 'dark'>('light');
  const [lang, setLang] = useState<Lang>('de');
  const [code, setCode] = useState(false);
  const { t } = useTranslation('recruiterPartner');
  const html = signatureHtml({ number: partner.partner_number, tier: partner.tier, lang, award });
  return <>
    <Header title={t('tiles.signature.title')} description={t('signature.description')}/>
    <div className="flex flex-wrap gap-2">
      <Segmented label={t('signature.preview')} value={dark} onChange={setDark} options={[['light', t('panel.light')], ['dark', t('panel.dark')]]}/>
      <Segmented label={t('panel.language')} value={lang} onChange={setLang} options={[['de', t('panel.german')], ['en', t('panel.english')]]}/>
    </div>
    <Paper dark={dark === 'dark'}>
      <p>{lang === 'en' ? 'Best regards' : 'Beste Grüße'}</p>
      <p className="font-semibold">{person.name || t('panel.yourName')}</p>
      {(person.roleTitle || person.company) && <p className={dark === 'dark' ? 'text-[#A1A1AA]' : 'text-[#6B6B6B]'}>{[person.roleTitle, person.company].filter(Boolean).join(' · ')}</p>}
      {/* Vorschau lädt das Abzeichen von dieser Seite; kopiert wird die Adresse auf matchunt.ai. */}
      <div dangerouslySetInnerHTML={{ __html: html.split(`${APP_ORIGIN}/badges/`).join('/badges/') }}/>
    </Paper>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => a.copyRich(html, signatureText({ number: partner.partner_number, tier: partner.tier, lang, award }))}><Copy className="mr-2 h-4 w-4"/>{t('signature.copy')}</Button>
      <Button variant="outline" aria-expanded={code} onClick={() => setCode(!code)}>{t('signature.htmlCode')}</Button>
      <Button variant="outline" disabled={a.busy === 'test'} onClick={() => a.testMail(lang)}>
        {a.busy === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}{t('signature.test')}
      </Button>
    </div>
    {code && <div className="space-y-2">
      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px]">{html}</pre>
      <Button variant="outline" size="sm" onClick={() => a.copy(html, t('what.htmlCode'))}><Copy className="mr-2 h-3.5 w-3.5"/>{t('panel.copyCode')}</Button>
    </div>}
    <div className="space-y-2">
      <Segmented label={t('signature.mailClient')} value={client} onChange={setClient} options={[['gmail', 'Gmail'], ['outlook', 'Outlook'], ['apple', 'Apple Mail']]}/>
      <ol className="space-y-1 text-sm">{MAIL_STEPS.map(i => <li key={i} className="flex gap-2"><span className="text-muted-foreground">{i + 1}</span>{t(`mail.${client}.${i}`)}</li>)}</ol>
    </div>
    {award && <p className="text-xs text-muted-foreground">{t('signature.awardNote')}</p>}
    <Rule>{t('signature.rule')}</Rule>
    <Done label={t('panel.isSetUp')} checked={!!partner.channels.signature} disabled={a.busy === 'channel'} onChange={v => a.channel('signature', v)}/>
  </>;
}

function WebsitePanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [size, setSize] = useState<'l' | 's'>('l');
  const { t } = useTranslation('recruiterPartner');
  const code = embedCode(partner.partner_number, { theme, size });
  return <>
    <Header title={t('tiles.website.title')} description={t('website.description')}/>
    <div className="flex flex-wrap gap-2">
      <Segmented label={t('website.colour')} value={theme} onChange={setTheme} options={[['light', t('panel.light')], ['dark', t('panel.dark')]]}/>
      <Segmented label={t('website.size')} value={size} onChange={setSize} options={[['l', t('website.large')], ['s', t('website.small')]]}/>
    </div>
    <div className="overflow-hidden rounded-lg border border-border">
      <p className="border-b border-border bg-muted/40 px-3 py-1.5 font-mono text-[11px] text-muted-foreground">{partner.website_domain ?? t('website.yourDomain')}</p>
      <div className={cn('flex flex-wrap items-center justify-between gap-3 px-4 py-4', theme === 'dark' ? 'bg-[#111111]' : 'bg-[#FAFAFA]')}>
        <span className={cn('text-[11px]', theme === 'dark' ? 'text-[#A1A1AA]' : 'text-[#71717A]')}>{t('website.footer', { year: new Date().getFullYear() })}</span>
        <LiveBadge tier={partner.tier} theme={theme} size={size}/>
      </div>
    </div>
    <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/40 p-3 font-mono text-[11px]">{code}</pre>
    <Button className="justify-self-start" onClick={() => a.copy(code, t('what.code'))}><Copy className="mr-2 h-4 w-4"/>{t('panel.copyCode')}</Button>
    <p className="text-xs text-muted-foreground">{t('website.codeNote')}</p>
    <div>
      <CopyRow label={t('website.privacy')} value={t('website.privacyValue')} hint={t('website.privacyHint')} onCopy={() => a.copy(PRIVACY_SENTENCE, t('what.sentence'))}/>
    </div>
    <Rule>{t('website.rule')}</Rule>
    <p className={cn('flex items-center gap-2 border-t border-border pt-4 text-sm', partner.website_domain ? 'text-success' : 'text-muted-foreground')}>
      {partner.website_domain ? <><Check className="h-4 w-4"/>{partner.website_seen_at ? t('website.runsOnSeen', { domain: partner.website_domain, date: fmtDate(partner.website_seen_at) }) : t('website.runsOn', { domain: partner.website_domain })}</>
        : t('website.notFound')}
    </p>
  </>;
}

function OutreachPanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const [lang, setLang] = useState<Lang>('de');
  const [formal, setFormal] = useState<'sie' | 'du'>('sie');
  const { t } = useTranslation('recruiterPartner');
  const short = outreachText({ number: partner.partner_number, lang, formal: formal === 'sie', long: false });
  const long = outreachText({ number: partner.partner_number, lang, formal: formal === 'sie', long: true });
  return <>
    <Header title={t('tiles.outreach.title')} description={t('outreach.description')}/>
    <div className="flex flex-wrap gap-2">
      <Segmented label={t('panel.language')} value={lang} onChange={setLang} options={[['de', t('panel.german')], ['en', t('panel.english')]]}/>
      {lang === 'de' && <Segmented label={t('outreach.address')} value={formal} onChange={setFormal} options={[['sie', 'Sie'], ['du', 'Du']]}/>}
    </div>
    <Step>{t('outreach.short')}</Step>
    <CopyBox text={short} onCopy={() => a.copy(short)}/>
    <Step>{t('outreach.long')}</Step>
    <CopyBox text={long} onCopy={() => a.copy(long)}/>
    <Rule>{t('outreach.rule')}</Rule>
  </>;
}

function PostPanel({ partner, person, award, a }: { partner: PartnerStatusRow; person: PartnerPerson; award: LigaAwardBadge | null; a: PanelActions }) {
  const [lang, setLang] = useState<Lang>('de');
  const [topic, setTopic] = useState<'award' | 'partner'>(award ? 'award' : 'partner');
  const { t } = useTranslation(['recruiterPartner', 'recruiterLiga']);
  const text = topic === 'award' && award
    ? awardPostText({ award: award.award, season: award.season_label, rank: award.rank, participants: award.participants, number: partner.partner_number })
    : postText({ number: partner.partner_number, lang, focus: person.areas });
  const initials = person.name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('') || 'MP';
  return <>
    <Header title={t('tiles.post.title')} description={t('post.description')}/>
    {award && <Segmented label={t('post.about')} value={topic} onChange={setTopic} options={[['award', `${t(`recruiterLiga:award.${award.award}`, { defaultValue: AWARD_LABEL[award.award] })} ${award.season_label}`], ['partner', t('post.partnerStatus')]]}/>}
    <Paper className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E4E4E7] text-xs font-semibold text-[#0A0A0A]">{initials}</span>
        <span className="leading-tight"><span className="block text-[13px] font-semibold">{person.name || t('panel.yourName')}</span><span className="text-[11px] text-[#71717A]">{person.roleTitle || t('post.defaultRole')} · Matchunt Partner</span></span>
      </div>
      <p className="whitespace-pre-line">{text.replace(checkUrl(partner.partner_number), '').trim()}</p>
      <div className="overflow-hidden rounded-md border border-[#E4E4E7]">
        <div className="flex items-center gap-3 bg-[#0A0A0A] px-4 py-5 text-white"><MatchuntLogo size={44}/><span className="leading-tight"><span className="block text-lg font-semibold">Matchunt</span><span className="text-xs text-[#A1A1AA]">Perfect Match. Perfect Hire.</span></span></div>
        <p className="px-3 py-1.5 text-[11px] text-[#71717A]">matchunt.ai · {checkLabel(partner.partner_number)}</p>
      </div>
    </Paper>
    {topic === 'partner' && <Segmented label={t('panel.language')} value={lang} onChange={setLang} options={[['de', t('panel.german')], ['en', t('panel.english')]]}/>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => a.copy(text)}><Copy className="mr-2 h-4 w-4"/>{t('panel.copyText')}</Button>
      <Button onClick={() => window.open(linkedinShareUrl(partner.partner_number), '_blank', 'noopener')}><Linkedin className="mr-2 h-4 w-4"/>{t('post.share')}</Button>
    </div>
    <p className="text-xs text-muted-foreground">{t('post.note')}</p>
    <Rule>{t('post.rule')}</Rule>
    <Done label={t('post.shared')} checked={!!partner.channels.post} disabled={a.busy === 'channel'} onChange={v => a.channel('post', v)}/>
  </>;
}

function PrintPanel({ partner, a }: { partner: PartnerStatusRow; a: PanelActions }) {
  const offer = offerText(partner.partner_number);
  const file = (path: string) => `/badges/${path}`;
  const { t } = useTranslation('recruiterPartner');
  return <>
    <Header title={t('tiles.print.title')} description={t('print.description')}/>
    <div className="grid grid-cols-[100px_minmax(0,1fr)] items-center gap-x-3 gap-y-4 text-sm">
      <div className="flex h-12 w-[72px] flex-col gap-1 rounded border border-[#E4E4E7] bg-white p-1.5"><MatchuntLogo size={16} className="text-[#0A0A0A]"/><span className="h-1 w-10 bg-[#0A0A0A]"/><span className="h-0.5 w-12 bg-[#D4D4D8]"/></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-medium">{t('print.certificate')}</span><span className="text-xs text-muted-foreground">{t('print.certificateHint')}</span></span>
        <Button size="sm" variant="outline" disabled={a.busy === 'certificate'} onClick={a.certificate}>{a.busy === 'certificate' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : <Download className="mr-1.5 h-3.5 w-3.5"/>}PDF</Button></div>
      <PartnerCard tier={partner.tier} size="sm"/>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-medium">{t('print.badge')}</span><span className="text-xs text-muted-foreground">{t('print.badgeHint')}</span></span>
        <span className="flex flex-wrap gap-1.5">
          {partner.tier !== 'partner'
            ? <Button size="sm" variant="outline" asChild><a href={file(`${partner.tier}.png`)} download>PNG</a></Button>
            : <><Button size="sm" variant="outline" asChild><a href={file('partner-light.png')} download>{t('print.pngLight')}</a></Button><Button size="sm" variant="outline" asChild><a href={file('partner-dark.png')} download>{t('print.pngDark')}</a></Button></>}
          <Button size="sm" variant="outline" asChild><a href={file(`${partner.tier === 'partner' ? 'partner-light' : partner.tier}.svg`)} download>SVG</a></Button>
        </span></div>
      <div className="grid h-12 w-12 grid-cols-3 gap-0.5 rounded border border-[#E4E4E7] bg-white p-1.5" aria-hidden>{[1, 0, 1, 0, 1, 0, 1, 1, 0].map((d, i) => <span key={i} className={d ? 'bg-[#0A0A0A]' : ''}/>)}</div>
      <div className="flex flex-wrap items-center justify-between gap-2"><span><span className="block font-medium">{t('print.qr')}</span><span className="text-xs text-muted-foreground">{t('print.qrHint')}</span></span>
        <span className="flex gap-1.5"><Button size="sm" variant="outline" disabled={a.busy === 'qr'} onClick={() => a.qr('png')}>PNG</Button><Button size="sm" variant="outline" disabled={a.busy === 'qr'} onClick={() => a.qr('svg')}>SVG</Button></span></div>
    </div>
    <Step>{t('print.offerParagraph')}</Step>
    <CopyBox text={offer} onCopy={() => a.copy(offer, t('what.paragraph'))}/>
    <Rule>{t('print.rule')}</Rule>
  </>;
}

export function PartnerPanel({ kind, partner, person, actions, award = null }: { kind: PanelKind; partner: PartnerStatusRow; person: PartnerPerson; actions: PanelActions; award?: LigaAwardBadge | null }) {
  const body = {
    linkedin: <LinkedInPanel partner={partner} a={actions}/>,
    signature: <SignaturePanel partner={partner} person={person} award={award} a={actions}/>,
    website: <WebsitePanel partner={partner} a={actions}/>,
    outreach: <OutreachPanel partner={partner} a={actions}/>,
    post: <PostPanel partner={partner} person={person} award={award} a={actions}/>,
    print: <PrintPanel partner={partner} a={actions}/>,
  }[kind];
  return <div className="grid gap-4">{body}</div>;
}

export const LINKEDIN_READY = !!LINKEDIN_ORGANIZATION_ID;
