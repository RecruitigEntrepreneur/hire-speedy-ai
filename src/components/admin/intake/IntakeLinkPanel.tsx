import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as PanelPrimitive from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { toast } from 'sonner';
import { Copy, Eye, Loader2, MoreHorizontal, Power, RefreshCw, Send, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LinkTypeBadge } from '@/components/admin/IntakeStateBadges';
import { supabase } from '@/integrations/supabase/client';
import { copyShortcut, copyText } from '@/lib/copyText';

interface Props {
  linkId: string | null;
  onClose: () => void;
  /** Aktionen der Seite (Rückfragen und Fehlerhinweise bleiben dort) */
  onRotate: (id: string, label: string) => Promise<string | null>;
  onToggle: (id: string, revoked: boolean) => Promise<void>;
}

type LinkRow = {
  link_id: string; label: string; link_type: string; prefill: Record<string, string> | null;
  created_at: string; revoked_at: string | null; expires_at: string | null; token_rotated_at: string | null;
  max_uses: number | null; uses_count: number | null; can_reveal: boolean; fee_percentage: number | null;
  campaign_key: string | null; source: string | null; allow_freemail: boolean; internal_note: string | null;
};
type DraftRow = {
  id: string; title: string | null; company_name: string | null; contact_name: string | null; contact_email: string | null;
  completeness: number | null; submitted_at: string | null; last_activity_at: string | null;
};
type Detail = {
  link: LinkRow;
  created_by_name: string | null;
  funnel: Record<string, number>;
  drafts: DraftRow[];
  events: { event_type: string; occurred_at: string; draft_id: string | null }[];
  mails: { id: string; to_email: string; subject: string | null; status: string; error_message: string | null; created_at: string }[];
};

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('intake-link-admin', { body });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx?.json) message = ((await ctx.json()) as { message?: string })?.message ?? message;
    } catch { /* Standardtext */ }
    throw new Error(message);
  }
  if (data && typeof data === 'object' && 'reason' in data) throw new Error((data as { message?: string }).message);
  return data as T;
}

const day = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'dd.MM.yyyy', { locale: de }) : '–');
const dayTime = (iso: string) => format(new Date(iso), 'dd.MM. HH:mm', { locale: de });

const EVENT_LABEL: Record<string, string> = {
  link_opened: 'Link aufgerufen',
  intake_started: 'Aufnahme begonnen',
  contact_provided: 'Kontakt angegeben',
  email_verified: 'E-Mail bestätigt',
  intake_completed: 'Aufnahme vollständig',
  submitted: 'Eingereicht',
  accepted: 'Angenommen',
  contract_signed: 'Vertrag unterschrieben',
  published: 'Stelle veröffentlicht',
};
const MAIL_STATUS: Record<string, string> = {
  sent: 'versendet', delivered: 'zugestellt', opened: 'geöffnet', clicked: 'geklickt',
  pending: 'wird gesendet', failed: 'fehlgeschlagen', bounced: 'unzustellbar', complained: 'als Spam markiert',
};
const FUNNEL: { key: string; label: string }[] = [
  { key: 'opened', label: 'Aufgerufen' },
  { key: 'started', label: 'Begonnen' },
  { key: 'verified', label: 'E-Mail bestätigt' },
  { key: 'completed', label: 'Vollständig' },
  { key: 'submitted', label: 'Eingereicht' },
  { key: 'accepted', label: 'Angenommen' },
  { key: 'signed', label: 'Unterschrieben' },
  { key: 'published', label: 'Veröffentlicht' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="truncate text-sm">{value}</p>
    </div>
  );
}

/** Panel rechts: alles zu einem Aufnahme-Link, inkl. Versand per Mail. */
export function IntakeLinkPanel({ linkId, onClose, onRotate, onToggle }: Props) {
  return (
    <PanelPrimitive.Root open={!!linkId} onOpenChange={(o) => !o && onClose()} modal={false}>
      <PanelPrimitive.Portal>
        <PanelPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-full flex-col border-l bg-background shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:w-[42rem]"
        >
          {linkId && <PanelBody key={linkId} linkId={linkId} onRotate={onRotate} onToggle={onToggle} />}
          <PanelPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100" aria-label="Schließen">
            <X className="h-4 w-4" />
          </PanelPrimitive.Close>
        </PanelPrimitive.Content>
      </PanelPrimitive.Portal>
    </PanelPrimitive.Root>
  );
}

function PanelBody({ linkId, onRotate, onToggle }: { linkId: string; onRotate: Props['onRotate']; onToggle: Props['onToggle'] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['admin-intake-link-detail', linkId],
    queryFn: () => call<Detail>({ action: 'detail', link_id: linkId }),
    staleTime: 15_000,
  });
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const d = detail.data;
  const link = d?.link;
  const prefill: Record<string, string> = link?.prefill ?? {};
  const [to, setTo] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-intake-link-detail', linkId] });
    queryClient.invalidateQueries({ queryKey: ['admin-intake-links'] });
  };

  const copyUrl = async (value: string) => {
    if (await copyText(value)) {
      toast.success('Link kopiert.');
      return;
    }
    urlRef.current?.focus();
    urlRef.current?.select();
    toast.message(`Link ist markiert – mit ${copyShortcut()} kopieren.`);
  };

  const reveal = async () => {
    try {
      const res = await call<{ url: string }>({ action: 'reveal', link_id: linkId });
      setUrl(res.url);
      setTimeout(() => copyUrl(res.url), 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Link konnte nicht angezeigt werden.');
    }
  };

  const recipient = to ?? prefill.contact_email ?? '';
  const send = useMutation({
    mutationFn: () => call<{ email_sent: boolean; error: string | null }>({ action: 'send', link_id: linkId, to: recipient, subject, message }),
    onSuccess: (r) => {
      if (r.email_sent) {
        toast.success(`Mail an ${recipient} ist raus.`);
        setSending(false);
        setMessage('');
      } else {
        toast.error(r.error ? `Mail nicht versendet: ${r.error}` : 'Die Mail konnte nicht versendet werden.');
      }
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Die Mail konnte nicht versendet werden.'),
  });
  const showPreview = async () => {
    try {
      setPreview(await call<{ subject: string; html: string }>({ action: 'send', link_id: linkId, to: recipient, subject, message, dry_run: true }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Vorschau konnte nicht geladen werden.');
    }
  };

  if (detail.isLoading) {
    return <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (detail.error || !d || !link) {
    return (
      <div className="space-y-2 p-6 text-sm">
        <PanelPrimitive.Title className="text-base font-semibold">Aufnahme-Link</PanelPrimitive.Title>
        <p className="text-muted-foreground">{detail.error instanceof Error ? detail.error.message : 'Der Link konnte nicht geladen werden.'}</p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => detail.refetch()}><RefreshCw className="h-3.5 w-3.5" /> Erneut versuchen</Button>
      </div>
    );
  }

  const revoked = Boolean(link.revoked_at);
  const expired = !!link.expires_at && new Date(link.expires_at) < new Date();
  const status = revoked ? 'deaktiviert' : expired ? 'abgelaufen' : 'aktiv';
  const canSend = !revoked && !expired && link.can_reveal;

  const timeline = [
    ...d.mails.map((m) => ({ at: m.created_at, text: `Mail an ${m.to_email} · ${MAIL_STATUS[m.status] ?? m.status}${m.error_message ? ` (${m.error_message})` : ''}` })),
    ...d.events.map((e) => ({ at: e.occurred_at, text: EVENT_LABEL[e.event_type] ?? e.event_type })),
    { at: link.created_at, text: `Link angelegt${d.created_by_name ? ` von ${d.created_by_name}` : ''}` },
    ...(link.token_rotated_at ? [{ at: link.token_rotated_at, text: 'Neuer Link erzeugt (alter ungültig)' }] : []),
  ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 25);

  return (
    <>
      {/* Kopf */}
      <div className="space-y-3 border-b px-5 py-4 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <PanelPrimitive.Title className="text-base font-semibold">{link.label}</PanelPrimitive.Title>
          <LinkTypeBadge type={link.link_type} />
          <Badge variant="outline" className={status === 'aktiv' ? 'border-emerald-600/40 font-normal text-emerald-700' : 'font-normal text-muted-foreground'}>{status}</Badge>
        </div>
        <PanelPrimitive.Description className="text-xs text-muted-foreground">
          angelegt {day(link.created_at)}{d.created_by_name ? ` von ${d.created_by_name}` : ''}
          {' · '}{link.expires_at ? `gültig bis ${day(link.expires_at)}` : 'unbegrenzt gültig'}
          {link.max_uses ? ` · ${link.uses_count ?? 0} von ${link.max_uses} Nutzungen` : ''}
        </PanelPrimitive.Description>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" className="gap-1.5" disabled={!canSend} onClick={() => setSending((v) => !v)}
            title={!canSend ? (revoked ? 'Link ist deaktiviert' : expired ? 'Link ist abgelaufen' : 'Link ist nicht gespeichert – erst neu erzeugen') : undefined}>
            <Send className="h-3.5 w-3.5" /> Per Mail senden
          </Button>
          {link.can_reveal && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => (url ? copyUrl(url) : reveal())}>
              <Copy className="h-3.5 w-3.5" /> Link kopieren
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Weitere Aktionen"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => { const next = await onRotate(linkId, link.label); if (next) setUrl(next); refresh(); }}>
                <RefreshCw className="mr-2 h-4 w-4" /> Neuen Link erzeugen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await onToggle(linkId, revoked); refresh(); }}>
                <Power className="mr-2 h-4 w-4" /> {revoked ? 'Wieder aktivieren' : 'Deaktivieren'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {/* Versand */}
        {sending && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">Link per Mail senden</p>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">An</p>
              <Input type="email" value={recipient} onChange={(e) => setTo(e.target.value)} placeholder="name@firma.de" className="h-9" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Betreff <span className="text-muted-foreground/70">(leer = Standard)</span></p>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200}
                placeholder={prefill.seed_title ? `Ihre Position aufnehmen: ${prefill.seed_title}` : 'Ihre offene Position bei Matchunt aufnehmen'} className="h-9" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Nachricht <span className="text-muted-foreground/70">(optional, ersetzt den Standardtext)</span></p>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000}
                placeholder={`Guten Tag${prefill.contact_name ? ` ${prefill.contact_name}` : ''}, wie besprochen hier der Link …`} />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-muted-foreground">Antworten gehen an Sie.</span>
              <Button size="sm" variant="ghost" className="gap-1.5" onClick={showPreview}><Eye className="h-3.5 w-3.5" /> Mail ansehen</Button>
              <Button size="sm" className="gap-1.5" disabled={send.isPending || !recipient} onClick={() => send.mutate()}>
                {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Senden
              </Button>
            </div>
          </div>
        )}

        {url && (
          <Section title="Link">
            <div className="flex items-center gap-2">
              <Input ref={urlRef} readOnly value={url} className="h-8 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={() => copyUrl(url)}><Copy className="h-3.5 w-3.5" /> Kopieren</Button>
            </div>
          </Section>
        )}

        <Section title="Vorbelegung">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Fact label="Firma" value={prefill.company_name} />
            <Fact label="Domain" value={prefill.company_domain} />
            <Fact label="Ansprechpartner" value={prefill.contact_name} />
            <Fact label="E-Mail" value={prefill.contact_email} />
            <Fact label="Rolle" value={prefill.contact_role} />
            <Fact label="Stelle" value={prefill.seed_title} />
            <Fact label="Branche" value={prefill.industry} />
            <Fact label="Ort" value={prefill.location} />
            <Fact label="Honorar" value={link.fee_percentage != null ? `${link.fee_percentage} %` : null} />
            <Fact label="Kampagne" value={link.campaign_key} />
            <Fact label="Quelle" value={link.source} />
            <Fact label="Private E-Mail" value={link.allow_freemail ? 'erlaubt' : 'nicht erlaubt'} />
          </div>
          {link.internal_note && <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Interne Notiz: {link.internal_note}</p>}
        </Section>

        <Section title="Fortschritt">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border px-2.5 py-0.5 text-xs">Mails {d.mails.length}</span>
            {FUNNEL.map((f) => (
              <span key={f.key} className={`rounded-full border px-2.5 py-0.5 text-xs ${(d.funnel[f.key] ?? 0) > 0 ? 'border-emerald-600/40 text-emerald-700' : 'text-muted-foreground'}`}>
                {f.label} {d.funnel[f.key] ?? 0}
              </span>
            ))}
          </div>
        </Section>

        <Section title={`Aufnahmen (${d.drafts.length})`}>
          {d.drafts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine – sobald jemand über den Link beginnt, steht die Aufnahme hier.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {d.drafts.map((dr) => (
                <li key={dr.id}>
                  <button type="button" onClick={() => navigate(`/admin/intakes/${dr.id}`)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{dr.title || 'Ohne Titel'}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[dr.company_name, dr.contact_name, dr.contact_email].filter(Boolean).join(' · ') || 'noch ohne Kontakt'}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{Math.round(Number(dr.completeness ?? 0))} %</span>
                    <span className="shrink-0 text-xs">{dr.submitted_at ? `eingereicht ${day(dr.submitted_at)}` : `aktiv ${day(dr.last_activity_at)}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Mails und Verlauf">
          <ul className="space-y-1.5 text-sm">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{dayTime(t.at)}</span>
                <span>{t.text}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{preview?.subject}</DialogTitle>
          </DialogHeader>
          {preview && <iframe title="Mail-Vorschau" srcDoc={preview.html} className="h-[60vh] w-full rounded-md border bg-white" sandbox="" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
