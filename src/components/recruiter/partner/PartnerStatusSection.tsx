import { useState, type ReactNode } from 'react';
import { Award, Check, ChevronRight, Copy, ExternalLink, FileText, Globe, Linkedin, Loader2, Lock, Mail, Megaphone, MessageSquare, Printer, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';
import { cn } from '@/lib/utils';
import { PartnerCard } from './PartnerCard';
import { LINKEDIN_READY, PartnerPanel, type PanelActions, type PanelKind, type PartnerPerson } from './PartnerPanels';
import { copyRich, copyText, downloadBase64, downloadSvgAsPng, downloadText } from './partnerClient';
import { checkUrl, dayDate, monthYear, type Lang, type PartnerChannel, type PartnerStatusRow } from '../../../../supabase/functions/_shared/recruiter-partner';

/**
 * Profil › Partnerstatus (Wireframe „Kacheln mit Seitenfenster“, freigegeben 22.09.2026).
 * Oben der Nachweis mit den drei Knöpfen für den Alltag, darunter je Stelle eine Kachel
 * zum einmaligen Einrichten, unten Sichtbarkeit und Stufen. Alles freiwillig.
 */
const TILES: { kind: PanelKind; title: string; purpose: string; icon: LucideIcon }[] = [
  { kind: 'linkedin', title: 'LinkedIn', purpose: 'Zertifikat in deinem Profil', icon: Linkedin },
  { kind: 'signature', title: 'E-Mail-Signatur', purpose: 'Unter jeder Mail', icon: Mail },
  { kind: 'website', title: 'Website', purpose: 'Abzeichen, immer aktuell', icon: Globe },
  { kind: 'outreach', title: 'Kandidatenansprache', purpose: 'Satz für Nachricht und Mail', icon: MessageSquare },
  { kind: 'post', title: 'LinkedIn-Beitrag', purpose: 'Neuigkeit teilen', icon: Megaphone },
  { kind: 'print', title: 'Druck und Unterlagen', purpose: 'Angebote, Visitenkarte', icon: Printer },
];

function Section({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return <Card><CardContent className="space-y-4 p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold">{Icon && <Icon className="h-5 w-5"/>}{title}</h2>
    {children}
  </CardContent></Card>;
}

function tileState(kind: PanelKind, p: PartnerStatusRow): { text: string; done?: boolean; muted?: boolean } {
  switch (kind) {
    case 'linkedin': return !LINKEDIN_READY ? { text: 'kommt in Kürze', muted: true } : p.channels.linkedin ? { text: 'eingerichtet', done: true } : { text: '2 Minuten' };
    case 'signature': return p.channels.signature ? { text: 'eingerichtet', done: true } : { text: '2 Minuten' };
    case 'website': return p.website_domain ? { text: `läuft auf ${p.website_domain}`, done: true } : { text: '2 Minuten' };
    case 'outreach': return { text: 'Deutsch, Englisch' };
    case 'post': return p.channels.post ? { text: 'geteilt', done: true } : { text: 'Vorlage' };
    default: return { text: 'Dateien' };
  }
}

export function PartnerStatusSection({ partner, person, onChange }: { partner: PartnerStatusRow; person: PartnerPerson; onChange: (row: PartnerStatusRow) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState<PanelKind | null>(null);
  const [busy, setBusy] = useState('');
  const number = partner.partner_number;
  const fail = (e: unknown, fallback: string) => toast({ title: e instanceof Error ? e.message : fallback, variant: 'destructive' });

  const run = async (key: string, work: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try { await work(); } catch (e) { fail(e, fallback); } finally { setBusy(''); }
  };
  const settings = (patch: Record<string, unknown>, key: string) => run(key, async () => {
    onChange(await onboardingApi<PartnerStatusRow>(false, { action: 'partner-settings', ...patch }));
  }, 'Die Einstellung konnte nicht gespeichert werden.');

  const actions: PanelActions = {
    busy,
    copy: (value, what = 'Text') => { void copyText(value).then(() => toast({ title: `${what} kopiert` }), e => fail(e, 'Kopieren ging nicht.')); },
    copyRich: (html, plain) => { void copyRich(html, plain).then(() => toast({ title: 'Signatur kopiert', description: 'Jetzt in deinem Mailprogramm unter deinen Namen einfügen.' }), e => fail(e, 'Kopieren ging nicht.')); },
    channel: (channel: PartnerChannel, done: boolean) => void settings({ channel, done }, 'channel'),
    certificate: () => void run('certificate', async () => {
      const r = await onboardingApi<{ file_name: string; base64: string }>(false, { action: 'partner-certificate' });
      downloadBase64(r.base64, r.file_name, 'application/pdf');
    }, 'Die Urkunde konnte nicht erstellt werden.'),
    qr: (format: 'svg' | 'png') => void run('qr', async () => {
      const r = await onboardingApi<{ svg: string; file_name: string }>(false, { action: 'partner-qr' });
      if (format === 'svg') downloadText(r.svg, r.file_name, 'image/svg+xml');
      else await downloadSvgAsPng(r.svg, r.file_name.replace(/\.svg$/, '.png'));
    }, 'Der QR-Code konnte nicht erstellt werden.'),
    testMail: (lang: Lang) => void run('test', async () => {
      const r = await onboardingApi<{ sent: boolean; to: string }>(false, { action: 'partner-signature-test', lang });
      toast({ title: 'Testmail ist unterwegs', description: `An ${r.to}. So siehst du den Baustein in einer echten Mail.` });
    }, 'Die Testmail konnte nicht versendet werden.'),
  };

  const header = <Card><CardContent className="space-y-1 p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Award className="h-5 w-5"/>Partnerstatus</h2>
    <p className="text-sm text-muted-foreground">Zeig, dass du Matchunt Partner bist. Alles hier ist freiwillig.</p>
  </CardContent></Card>;

  if (partner.ended_at) {
    return <div className="space-y-5">
      {header}
      <Section title="Dein Partnerstatus ist beendet">
        <p className="text-sm">Seit {dayDate(partner.ended_at)}. Bitte entferne innerhalb von zehn Werktagen alle Hinweise auf den Status: Abzeichen auf deiner Website, den Signatur-Baustein, den Zusatz in deiner Headline und das LinkedIn-Zertifikat.</p>
        <p className="text-sm text-muted-foreground">Fragen dazu? Antworte einfach auf eine Mail von Matchunt.</p>
      </Section>
    </div>;
  }

  return <div className="space-y-5">
    {header}

    <Section title="Dein Nachweis">
      <div className="flex flex-wrap items-center gap-4">
        <PartnerCard tier={partner.tier} size="lg"/>
        <div>
          <p className="font-medium">Aktiv seit {monthYear(partner.granted_at)}</p>
          <p className="text-sm text-muted-foreground">Nr. <span className="font-mono">{number}</span> · gilt, solange dein Vertrag läuft</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => actions.copy(checkUrl(number), 'Link zur Prüfseite')}><Copy className="mr-2 h-4 w-4"/>Link kopieren</Button>
        <Button variant="outline" disabled={busy === 'certificate'} onClick={actions.certificate}>
          {busy === 'certificate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}Urkunde (PDF)
        </Button>
        <Button variant="outline" onClick={() => window.open(`/partner/${number}`, '_blank', 'noopener')}>Prüfseite<ExternalLink className="ml-2 h-4 w-4"/></Button>
      </div>
      <p className="text-xs text-muted-foreground">Für alle, die fragen, ob du wirklich Partner bist: Die Prüfseite zeigt deinen Status immer aktuell.</p>
    </Section>

    <Section title="Einmal einrichten">
      <div className="grid gap-2 sm:grid-cols-2">
        {TILES.map(t => {
          const s = tileState(t.kind, partner);
          return <button key={t.kind} type="button" onClick={() => setOpen(t.kind)}
            className="group flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><t.icon className="h-4 w-4"/></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t.title}</span>
              <span className="block text-xs text-muted-foreground">{t.purpose}</span>
              <span className={cn('mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px]',
                s.done ? 'bg-success/15 text-success' : s.muted ? 'bg-muted text-muted-foreground' : 'border border-border text-muted-foreground')}>
                {s.done && <Check className="h-3 w-3 shrink-0"/>}<span className="truncate">{s.text}</span>
              </span>
            </span>
            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"/>
          </button>;
        })}
      </div>
    </Section>

    <div className="grid gap-5 md:grid-cols-2">
      <Section title="Sichtbarkeit">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="partner-directory" className="space-y-1 font-normal"><span className="block text-sm font-medium">Im Partnerverzeichnis zeigen</span>
              <span className="block text-xs text-muted-foreground">Freiwillig und jederzeit widerrufbar. Das Verzeichnis auf matchunt.ai folgt.</span></Label>
            <Switch id="partner-directory" checked={!!partner.directory_consent_at} disabled={busy === 'directory'} onCheckedChange={v => void settings({ directory: v }, 'directory')}/>
          </div>
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="partner-expertise" className="space-y-1 font-normal"><span className="block text-sm font-medium">Schwerpunkte auf der Prüfseite</span>
              <span className="block text-xs text-muted-foreground">{person.focus ? `Zeigt: ${person.focus}` : 'Zeigt deine Schwerpunkte aus dem Profil.'}</span></Label>
            <Switch id="partner-expertise" checked={!!partner.show_expertise_at} disabled={busy === 'expertise'} onCheckedChange={v => void settings({ expertise: v }, 'expertise')}/>
          </div>
        </div>
      </Section>
      <Section title="Stufen">
        <ul className="divide-y divide-border text-sm">
          <li className="flex items-center justify-between py-2 first:pt-0"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-success"/>{partner.tier === 'gold' ? 'Gold Partner' : 'Partner'}</span><span className="text-xs text-muted-foreground">aktiv</span></li>
          {partner.tier !== 'gold' && <li className="flex items-center justify-between py-2"><span className="flex items-center gap-2 text-muted-foreground"><Lock className="h-4 w-4"/>Gold Partner</span><span className="text-xs text-muted-foreground">Kriterien folgen</span></li>}
        </ul>
      </Section>
    </div>

    <Sheet open={open !== null} onOpenChange={o => { if (!o) setOpen(null); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {open && <PartnerPanel kind={open} partner={partner} person={person} actions={actions}/>}
      </SheetContent>
    </Sheet>
  </div>;
}
