import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Check, Copy, Link2, Loader2, MoreHorizontal, Plus, Power, RefreshCw, Send,
  TrendingUp, Users,
} from 'lucide-react';
import { LinkTypeBadge } from '@/components/admin/IntakeStateBadges';
import { useIntakeLinks, useLinkAction, useTermsTemplates } from '@/hooks/useAdminIntakes';

/**
 * Aufnahme-Links erzeugen und auswerten.
 *
 * Der Klartext-Token wird GENAU EINMAL angezeigt — direkt nach dem Anlegen. In
 * der Datenbank liegt nur sein SHA-256-Hash, ein späteres „nochmal anzeigen"
 * ist technisch unmöglich. Wer den Link verliert, legt einen neuen an; das ist
 * billiger als eine Datenbank voller wiederherstellbarer Zugänge.
 */

type LinkType = 'personal' | 'campaign' | 'public';

const TYPE_HELP: Record<LinkType, string> = {
  personal:
    'Für ein bekanntes Unternehmen oder einen konkreten Ansprechpartner. Vorbelegung, fester Betreuer, vorbereitete Konditionen. Mehrfach nutzbar — derselbe Kontakt darf eine zweite Stelle aufnehmen.',
  campaign:
    'Wiederverwendbar für LinkedIn, Outbound, Partner. Ohne Personenbezug, mit Kampagnenkennung für die Auswertung.',
  public:
    'Für die Website und organische Besucher. Keine Vorbelegung. Private E-Mail-Adressen werden abgelehnt, damit keine Dubletten entstehen.',
};

const EMPTY_FORM = {
  link_type: 'personal' as LinkType,
  label: '',
  internal_note: '',
  campaign_key: '',
  source: '',
  terms_template_id: '',
  fee_percentage: '',
  max_uses: '',
  expires_at: '',
  allow_freemail: false,
  company_name: '',
  company_domain: '',
  industry: '',
  location: '',
  contact_name: '',
  contact_email: '',
  contact_role: '',
  seed_title: '',
  seed_text: '',
  contract_type: 'full-time',
  send_to: '',
  message: '',
};

export default function AdminIntakeLinks() {
  const { data: links = [], isLoading, error } = useIntakeLinks();
  const { data: templates = [] } = useTermsTemplates();
  const action = useLinkAction();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [created, setCreated] = useState<{ url: string; emailSent: boolean | null; warning?: string | null } | null>(null);
  /** Der zuletzt angezeigte oder erneuerte Link, direkt in der Zeile. */
  const [shown, setShown] = useState<{ id: string; url: string; rotated: boolean } | null>(null);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === form.terms_template_id) ?? templates.find((t) => t.is_active),
    [templates, form.terms_template_id],
  );

  const set = (patch: Partial<typeof EMPTY_FORM>) => setForm((f) => ({ ...f, ...patch }));

  const stats = useMemo(() => {
    const active = links.filter((l) => !l.revoked_at).length;
    const submitted = links.reduce((sum, l) => sum + Number(l.submitted ?? 0), 0);
    const started = links.reduce((sum, l) => sum + Number(l.started ?? 0), 0);
    return { active, started, submitted };
  }, [links]);

  const submit = async () => {
    try {
      const res = await action.mutateAsync({
        action: 'create',
        link_type: form.link_type,
        label: form.label,
        internal_note: form.internal_note || undefined,
        campaign_key: form.campaign_key || undefined,
        source: form.source || undefined,
        terms_template_id: form.terms_template_id || undefined,
        fee_percentage: form.fee_percentage ? Number(form.fee_percentage) : undefined,
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : undefined,
        allow_freemail: form.allow_freemail,
        send_to: form.send_to || undefined,
        message: form.message || undefined,
        prefill:
          form.link_type === 'public'
            ? { seed_title: form.seed_title || undefined, contract_type: form.contract_type }
            : {
                company_name: form.company_name || undefined,
                company_domain: form.company_domain || undefined,
                industry: form.industry || undefined,
                location: form.location || undefined,
                contact_name: form.contact_name || undefined,
                contact_email: form.contact_email || undefined,
                contact_role: form.contact_role || undefined,
                seed_title: form.seed_title || undefined,
                seed_text: form.seed_text || undefined,
                contract_type: form.contract_type,
              },
      });
      setCreated({
        url: res.url as string,
        emailSent: (res.email_sent ?? null) as boolean | null,
        warning: (res.warning ?? null) as string | null,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Link konnte nicht angelegt werden.');
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link kopiert.');
    } catch {
      toast.error('Kopieren nicht möglich — bitte manuell markieren.');
    }
  };

  /**
   * Link erneut anzeigen.
   *
   * Möglich, seit der Token verschlüsselt statt gehasht abgelegt wird. Vorher
   * war er nach dem Schließen des Anlegen-Dialogs endgültig weg — die
   * Sicherheitsmaßnahme war an der falschen Stelle: der Link trägt nur die
   * Vorbelegung, die vertraulichen Angaben hängen am Entwurfs-Token.
   */
  const reveal = async (id: string) => {
    try {
      const res = await action.mutateAsync({ action: 'reveal', link_id: id });
      setShown({ id, url: res.url as string, rotated: false });
      await copy(res.url as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Link konnte nicht angezeigt werden.');
    }
  };

  /** Neuer Token auf denselben Link; der alte wird sofort ungültig. */
  const rotate = async (id: string, label: string) => {
    if (!window.confirm(
      `Für „${label}" einen neuen Link erzeugen?\n\n` +
      'Der bisherige wird sofort ungültig. Bereits begonnene Aufnahmen bleiben erhalten — ' +
      'sie hängen an einem eigenen Zugang.',
    )) return;
    try {
      const res = await action.mutateAsync({ action: 'rotate', link_id: id });
      setShown({ id, url: res.url as string, rotated: true });
      await copy(res.url as string);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Der Link konnte nicht erneuert werden.');
    }
  };

  const toggle = async (id: string, revoked: boolean) => {
    try {
      await action.mutateAsync({ action: revoked ? 'reactivate' : 'revoke', link_id: id });
      toast.success(revoked ? 'Link wieder aktiv.' : 'Link deaktiviert.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen.');
    }
  };

  const close = () => {
    setOpen(false);
    setCreated(null);
    setForm(EMPTY_FORM);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Aufnahme-Links</h1>
            <p className="text-sm text-muted-foreground">
              Über diese Links nehmen Unternehmen eine Position auf — ohne Registrierung.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Neuer Link
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Aktive Links" value={stats.active} icon={Link2} />
          <Stat label="Begonnene Aufnahmen" value={stats.started} icon={Users} />
          <Stat label="Beauftragungsanfragen" value={stats.submitted} icon={TrendingUp} />
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive">
                Die Links konnten nicht geladen werden. Prüfen Sie, ob die Migrationen angewandt und
                die Edge Functions deployt sind.
              </div>
            ) : links.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                Noch kein Link angelegt. Beginnen Sie mit einem persönlichen Link für ein Unternehmen,
                das Sie bereits kennen.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Link</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead className="text-right">Aufrufe</TableHead>
                    <TableHead className="text-right">Starts</TableHead>
                    <TableHead className="text-right">Verifiziert</TableHead>
                    <TableHead className="text-right">Anfragen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {links.map((l) => (
                    <TableRow key={l.link_id}>
                      <TableCell>
                        <div className="font-medium">{l.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {l.campaign_key && <>Kampagne {l.campaign_key} · </>}
                          {l.source && <>{l.source} · </>}
                          angelegt {format(new Date(l.created_at), 'dd.MM.yyyy', { locale: de })}
                          {l.token_rotated_at && <> · erneuert {format(new Date(l.token_rotated_at), 'dd.MM.yyyy', { locale: de })}</>}
                        </div>
                        {shown?.id === l.link_id && (
                          <div className="mt-2 flex max-w-md items-center gap-2">
                            <Input
                              readOnly
                              value={shown.url}
                              className="h-8 font-mono text-xs"
                              onFocus={(e) => e.currentTarget.select()}
                            />
                            <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1.5"
                              onClick={() => copy(shown.url)}>
                              <Copy className="h-3.5 w-3.5" /> Kopieren
                            </Button>
                          </div>
                        )}
                        {shown?.id === l.link_id && shown.rotated && (
                          <p className="mt-1 text-[11px] text-amber-600">
                            Der bisherige Link ist ab sofort ungültig.
                          </p>
                        )}
                      </TableCell>
                      <TableCell><LinkTypeBadge type={l.link_type} /></TableCell>
                      <TableCell className="text-right tabular-nums">{l.opened ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.started ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.verified ?? 0}</TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{l.submitted ?? 0}</TableCell>
                      <TableCell>
                        {l.revoked_at ? (
                          <Badge variant="outline" className="font-normal text-muted-foreground">deaktiviert</Badge>
                        ) : l.expires_at && new Date(l.expires_at) < new Date() ? (
                          <Badge variant="outline" className="font-normal text-muted-foreground">abgelaufen</Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-600/40 font-normal text-emerald-700">aktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {l.can_reveal && (
                              <DropdownMenuItem onClick={() => reveal(l.link_id)}>
                                <Copy className="mr-2 h-4 w-4" /> Link kopieren
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => rotate(l.link_id, l.label)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {l.can_reveal ? 'Neuen Link erzeugen' : 'Link erzeugen (alter wird ungültig)'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggle(l.link_id, Boolean(l.revoked_at))}>
                              <Power className="mr-2 h-4 w-4" />
                              {l.revoked_at ? 'Wieder aktivieren' : 'Deaktivieren'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Der Link selbst enthält keine vertraulichen Daten — nur die Vorbelegung. Deshalb lässt er
          sich über das Zeilenmenü jederzeit erneut kopieren. Was ein Unternehmen eingibt, hängt
          dagegen an einem eigenen Zugang je Aufnahme, wird nur als Hashwert gespeichert und ist
          einzeln entziehbar.
        </p>
      </div>

      {/* ---- Anlegen ------------------------------------------------------ */}
      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : close())}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {created ? (
            <>
              <DialogHeader>
                <DialogTitle>Link angelegt</DialogTitle>
                <DialogDescription>
                  Kopieren Sie ihn jetzt. Er wird nicht noch einmal angezeigt — gespeichert ist nur sein Hashwert.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input readOnly value={created.url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <Button onClick={() => copy(created.url)} className="shrink-0 gap-2">
                    <Copy className="h-4 w-4" /> Kopieren
                  </Button>
                </div>
                {created.warning && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">{created.warning}</AlertDescription>
                  </Alert>
                )}
                {created.emailSent === true && (
                  <Alert>
                    <Check className="h-4 w-4" />
                    <AlertDescription className="text-xs">Einladung wurde versendet.</AlertDescription>
                  </Alert>
                )}
                {created.emailSent === false && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-xs">
                      Der Link ist angelegt, die Einladungsmail konnte aber nicht zugestellt werden.
                      Bitte den Link manuell versenden.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button onClick={close}>Fertig</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Neuer Aufnahme-Link</DialogTitle>
                <DialogDescription>{TYPE_HELP[form.link_type]}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Typ</Label>
                    <Select value={form.link_type} onValueChange={(v) => set({ link_type: v as LinkType })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="personal">Persönlich</SelectItem>
                        <SelectItem value="campaign">Kampagne</SelectItem>
                        <SelectItem value="public">Öffentlich</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field label="Bezeichnung (intern)" value={form.label} onChange={(v) => set({ label: v })}
                    placeholder="z. B. Müller GmbH · Frau Weber" />
                </div>

                {form.link_type !== 'public' && (
                  <div className="rounded-lg border p-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vorbelegung
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Firmenname" value={form.company_name} onChange={(v) => set({ company_name: v })} />
                      <Field label="Domain" value={form.company_domain} onChange={(v) => set({ company_domain: v })}
                        placeholder="muster-gmbh.de" />
                      <Field label="Branche" value={form.industry} onChange={(v) => set({ industry: v })} />
                      <Field label="Standort" value={form.location} onChange={(v) => set({ location: v })} />
                      {form.link_type === 'personal' && (
                        <>
                          <Field label="Ansprechpartner" value={form.contact_name} onChange={(v) => set({ contact_name: v })} />
                          <Field label="E-Mail" value={form.contact_email} onChange={(v) => set({ contact_email: v })} />
                          <Field label="Funktion" value={form.contact_role} onChange={(v) => set({ contact_role: v })} />
                        </>
                      )}
                      <Field label="Position (Aufhänger)" value={form.seed_title} onChange={(v) => set({ seed_title: v })}
                        placeholder="z. B. Senior Cloud Architect" />
                    </div>
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">Bekannter Kontext (optional)</Label>
                      <Textarea rows={2} value={form.seed_text} onChange={(e) => set({ seed_text: e.target.value })}
                        className="mt-1" placeholder="Was Sie über die Vakanz schon wissen — wird als Startpunkt angezeigt." />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {form.link_type === 'campaign' && (
                    <>
                      <Field label="Kampagnenkennung" value={form.campaign_key} onChange={(v) => set({ campaign_key: v })}
                        placeholder="q4-linkedin" />
                      <Field label="Quelle" value={form.source} onChange={(v) => set({ source: v })}
                        placeholder="linkedin, partner, messe" />
                    </>
                  )}
                  <div>
                    <Label className="text-xs text-muted-foreground">Konditionsvorlage</Label>
                    <Select
                      value={form.terms_template_id || (templates.find((t) => t.is_active)?.id ?? '')}
                      onValueChange={(v) => set({ terms_template_id: v })}
                    >
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Standardvorlage" /></SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label} (v{t.version}, {t.fee_percentage} %){t.is_active ? ' · aktiv' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeTemplate && (
                    <div>
                      <Label className="text-xs text-muted-foreground">
                        Abweichendes Honorar (%)
                        {activeTemplate.min_fee_percentage != null && (
                          <> · erlaubt {activeTemplate.min_fee_percentage}–{activeTemplate.max_fee_percentage}</>
                        )}
                      </Label>
                      <Input type="number" step="0.5" value={form.fee_percentage} className="mt-1"
                        placeholder={String(activeTemplate.fee_percentage)}
                        onChange={(e) => set({ fee_percentage: e.target.value })} />
                    </div>
                  )}
                  <Field label="Maximale Nutzungen" value={form.max_uses} onChange={(v) => set({ max_uses: v })}
                    placeholder="leer = unbegrenzt" type="number" />
                  <Field label="Gültig bis" value={form.expires_at} onChange={(v) => set({ expires_at: v })} type="date" />
                </div>

                {form.link_type === 'public' && (
                  <label className="flex items-center gap-3 rounded-lg border p-3">
                    <Switch checked={form.allow_freemail} onCheckedChange={(v) => set({ allow_freemail: v })} />
                    <span className="text-sm">
                      Private E-Mail-Adressen zulassen
                      <span className="block text-xs text-muted-foreground">
                        Standard ist Ablehnung. Ohne Firmendomain lässt sich das Unternehmen nicht
                        zuordnen und es entstehen Dubletten.
                      </span>
                    </span>
                  </label>
                )}

                {form.link_type === 'personal' && (
                  <div className="rounded-lg border p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Send className="h-3.5 w-3.5" /> Direkt versenden (optional)
                    </p>
                    <Field label="An" value={form.send_to} onChange={(v) => set({ send_to: v })}
                      placeholder={form.contact_email || 'name@unternehmen.de'} />
                    <div className="mt-3">
                      <Label className="text-xs text-muted-foreground">Persönliche Nachricht</Label>
                      <Textarea rows={3} value={form.message} onChange={(e) => set({ message: e.target.value })}
                        className="mt-1" placeholder="Ohne Text versenden wir unsere Standardeinladung." />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={close}>Abbrechen</Button>
                <Button onClick={submit} disabled={action.isPending || form.label.trim().length < 3} className="gap-2">
                  {action.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Link erzeugen
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

function Field({
  label, value, onChange, placeholder, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} placeholder={placeholder} className="mt-1"
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
