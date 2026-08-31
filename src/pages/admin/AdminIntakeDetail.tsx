import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  ArrowLeft, Building2, Check, Download, ExternalLink, FileSignature, FileText,
  Loader2, Mail, MessageSquare, Send, TriangleAlert, X,
} from 'lucide-react';
import {
  CaptureBadge, CommercialBadge, IdentityBadge, ReviewBadge, SignatureBadge, nextStepFor,
} from '@/components/admin/IntakeStateBadges';
import { useIntakeDetail, useIntakeAction, useMandateDocument } from '@/hooks/useAdminIntakes';

/**
 * Eine Aufnahme prüfen, annehmen und durch den Vertragslauf führen.
 *
 * Die Reihenfolge auf dieser Seite ist die Reihenfolge der Arbeit:
 *   1. Aufnahme lesen und beurteilen
 *   2. annehmen  → Kunde, Organisation und Stelle entstehen
 *   3. Vertragsdokument erzeugen und über DocuSign versenden
 *   4. Unterschrift vermerken
 *   5. Stelle freigeben — die Datenbank lässt das erst danach zu
 */
export default function AdminIntakeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useIntakeDetail(id);
  const action = useIntakeAction(id);
  const document = useMandateDocument();

  const [rejectOpen, setRejectOpen] = useState<false | 'reject' | 'request_changes'>(false);
  const [reason, setReason] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [signerName, setSignerName] = useState('');
  const [note, setNote] = useState<string | null>(null);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data?.draft) {
    return (
      <DashboardLayout>
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertDescription>
            Diese Aufnahme konnte nicht geladen werden. Möglicherweise wurde sie nach 30 Tagen
            Inaktivität gelöscht.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  const d = data.draft;
  const mandate = data.mandates.find((m) => ['client_confirmed', 'accepted'].includes(m.status)) ?? data.mandates[0] ?? null;
  const built = (d.built ?? {}) as Record<string, any>;
  const next = nextStepFor({
    review_state: d.review_state,
    identity_state: d.identity_state,
    capture_state: d.capture_state,
    commercial_state: d.commercial_state,
    job_id: d.job_id,
    signature_status: mandate?.signature_status,
    job_status: data.job?.status,
  });

  const run = async (payload: Record<string, unknown>, success: string) => {
    try {
      await action.mutateAsync(payload);
      toast.success(success);
      setRejectOpen(false);
      setReason('');
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
      return false;
    }
  };

  const createDocument = async () => {
    if (!mandate) return;
    try {
      const res = await document.mutateAsync(mandate.id);
      if (res.url) {
        window.open(res.url, '_blank', 'noopener');
        setNote(`Dokument ${res.mandate_number} erzeugt. Der Download-Link gilt 30 Minuten.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dokument konnte nicht erzeugt werden.');
    }
  };

  const fmt = (iso?: string | null) => (iso ? format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: de }) : '—');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ---- Kopf ------------------------------------------------------ */}
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5 text-muted-foreground"
            onClick={() => navigate('/admin/intakes')}>
            <ArrowLeft className="h-4 w-4" /> Alle Aufnahmen
          </Button>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{built.title || d.title || 'Unbenannte Position'}</h1>
              <p className="text-sm text-muted-foreground">
                {d.company_legal_name || d.company_name || 'Unbenanntes Unternehmen'}
                {d.company_domain && <> · {d.company_domain}</>}
                {data.link && <> · über „{data.link.label}"</>}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Nächster Schritt</p>
              <p className="text-sm font-medium">{next.text}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <CaptureBadge state={d.capture_state} completeness={d.completeness} />
            <IdentityBadge state={d.identity_state} freemail={d.is_freemail} />
            <CommercialBadge state={d.commercial_state} />
            <ReviewBadge state={d.review_state} />
            {mandate && <SignatureBadge status={mandate.signature_status} />}
          </div>
        </div>

        {note && <Alert><AlertDescription className="text-sm">{note}</AlertDescription></Alert>}

        {d.commercial_state === 'discussion_requested' && (
          <Alert>
            <MessageSquare className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Der Kunde möchte die Konditionen besprechen. Sie können die Aufnahme trotzdem annehmen —
              legen Sie danach im Reiter „Konditionen" eine neue Fassung vor.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="intake">
          <TabsList>
            <TabsTrigger value="intake">Aufnahme</TabsTrigger>
            <TabsTrigger value="client">Kunde</TabsTrigger>
            <TabsTrigger value="terms">Konditionen &amp; Vertrag</TabsTrigger>
            <TabsTrigger value="history">Historie</TabsTrigger>
          </TabsList>

          {/* ---- Aufnahme ------------------------------------------------ */}
          <TabsContent value="intake" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-5">
                <Rows rows={[
                  ['Position', built.title ?? d.title],
                  ['Standort', built.location],
                  ['Arbeitsmodell', built.remote_type],
                  ['Erfahrung', built.experience_level],
                  ['Vertragsart', d.contract_type === 'freelance' ? 'Contracting' : 'Festanstellung'],
                  ['Gehalt / Tagessatz', d.contract_type === 'freelance'
                    ? [(d.freelance as any)?.dayRateMin, (d.freelance as any)?.dayRateMax].filter(Boolean).join('–') + ' € / Tag'
                    : [built.salary_min, built.salary_max].filter(Boolean).join('–') + ' €'],
                  ['Muss-Kriterien', (built.must_haves ?? []).join(' · ')],
                  ['Kann-Kriterien', (built.nice_to_haves ?? []).join(' · ')],
                  ['Vollständigkeit', d.completeness ? `${d.completeness} %` : '—'],
                ]} />
              </CardContent>
            </Card>

            {(d.intake_payload as any)?.briefing_text && (
              <Card>
                <CardContent className="p-5">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" /> Briefing
                  </p>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
                    {(d.intake_payload as any).briefing_text}
                  </pre>
                </CardContent>
              </Card>
            )}

            {Array.isArray((d.dyn as any)?.answers) && (d.dyn as any).answers.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Dialogantworten ({(d.dyn as any).answers.length})
                  </p>
                  <div className="space-y-3">
                    {(d.dyn as any).answers.map((a: any) => (
                      <div key={a.id} className="text-sm">
                        <p className="text-muted-foreground">{a.question}</p>
                        <p className="font-medium">{a.answer === '__unknown__' ? 'Weiß ich nicht' : a.answer}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---- Kunde --------------------------------------------------- */}
          <TabsContent value="client" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-5">
                <Rows rows={[
                  ['Ansprechpartner', d.contact_name],
                  ['Funktion', d.contact_role],
                  ['E-Mail', d.contact_email],
                  ['Telefon', d.contact_phone],
                  ['Firmenname', d.company_name],
                  ['Firmierung', d.company_legal_name],
                  ['Anschrift', [d.company_street, [d.company_postal_code, d.company_city].filter(Boolean).join(' '), d.company_country].filter(Boolean).join(', ')],
                  ['Domain', d.company_domain],
                  ['USt-IdNr.', d.company_vat_id],
                  ['Handelsregister', d.company_registration_number],
                ]} />
              </CardContent>
            </Card>

            {d.is_freemail && (
              <Alert>
                <TriangleAlert className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Die verifizierte Adresse ist eine private (Freemail-)Adresse. Das Unternehmen lässt
                  sich darüber nicht eindeutig zuordnen — vor der Annahme prüfen.
                </AlertDescription>
              </Alert>
            )}

            {d.matched_organization_id && (
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Wir kennen ein Unternehmen mit dieser Domain bereits.
                  <strong> Zugeordnet wird es nur, wenn Sie es hier bestätigen</strong> — eine
                  Domainübereinstimmung allein darf niemandem Zugriff auf bestehende Stellen geben.
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline"
                      onClick={() => run({ action: 'accept', organization_id: d.matched_organization_id }, 'Aufnahme angenommen und zugeordnet.')}
                      disabled={d.review_state !== 'pending_admin'}>
                      Zur bestehenden Organisation zuordnen und annehmen
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {data.job && (
              <Card>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="text-sm font-medium">Angelegte Stelle</p>
                    <p className="text-xs text-muted-foreground">
                      Status {data.job.status}
                      {data.job.fee_percentage != null && <> · Honorar {data.job.fee_percentage} %</>}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="gap-1.5">
                    <Link to="/admin/jobs"><ExternalLink className="h-3.5 w-3.5" /> In der Jobliste öffnen</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ---- Konditionen & Vertrag ----------------------------------- */}
          <TabsContent value="terms" className="mt-4 space-y-4">
            {!mandate ? (
              <Alert>
                <AlertDescription className="text-sm">
                  Der Kunde hat noch keine Konditionen bestätigt. Eine Vereinbarung entsteht erst mit
                  der Beauftragungsanfrage.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{mandate.mandate_number}</p>
                        <p className="text-xs text-muted-foreground">
                          Vorlage v{mandate.template_version} · AGB {mandate.agb_version}
                        </p>
                      </div>
                      <SignatureBadge status={mandate.signature_status} />
                    </div>
                    <Rows rows={[
                      ['Erfolgshonorar', `${mandate.fee_percentage} %`],
                      ['Davon Recruiter (intern)', `${mandate.recruiter_fee_percentage} %`],
                      ['Zahlungsziel', `${mandate.payment_terms_days} Tage`],
                      ['Nachbesetzung', mandate.guarantee_days ? `${mandate.guarantee_days} Tage` : '—'],
                      ['Vom Kunden bestätigt', `${fmt(mandate.client_confirmed_at)}${mandate.client_confirmed_name ? ` · ${mandate.client_confirmed_name}` : ''}`],
                      ['Bestätigt von', mandate.client_confirmed_email],
                      ['Von Matchunt angenommen', fmt(mandate.accepted_at)],
                      ['Prüfsumme', mandate.snapshot_sha256?.slice(0, 24) + '…'],
                    ]} />
                  </CardContent>
                </Card>

                {/* ---- Vertragslauf ---------------------------------------- */}
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <FileSignature className="h-3.5 w-3.5" /> Vermittlungsvereinbarung
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={createDocument} disabled={document.isPending || !mandate.client_confirmed_at}>
                        {document.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        Vertragsdokument erzeugen
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Das Dokument entsteht aus dem bestätigten Snapshot — nicht aus dem heutigen Stand
                      der Tabellen. Es enthält eine Signaturmarke, an der DocuSign das Unterschriftsfeld
                      ausrichtet.
                    </p>

                    <Separator />

                    {mandate.signature_status === 'signed' ? (
                      <Alert>
                        <Check className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Unterzeichnet am {fmt(mandate.signature_signed_at)}
                          {mandate.signature_signer_name && <> durch {mandate.signature_signer_name}</>}.
                          Die Stelle kann jetzt über die Jobliste freigegeben werden.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border p-3">
                          <p className="mb-2 text-sm font-medium">1 · Über DocuSign versenden</p>
                          <Label className="text-xs text-muted-foreground">DocuSign-Envelope-ID (optional)</Label>
                          <Input value={envelopeId} onChange={(e) => setEnvelopeId(e.target.value)}
                            className="mt-1" placeholder="zur Nachverfolgung" />
                          <Button size="sm" className="mt-2 w-full gap-1.5"
                            variant={mandate.signature_status === 'sent' ? 'outline' : 'default'}
                            disabled={mandate.status !== 'accepted' || action.isPending}
                            onClick={() => run({ action: 'mark_contract_sent', envelope_id: envelopeId }, 'Als versendet vermerkt.')}>
                            <Send className="h-3.5 w-3.5" />
                            {mandate.signature_status === 'sent' ? 'Erneut vermerken' : 'Als versendet vermerken'}
                          </Button>
                          {mandate.signature_sent_at && (
                            <p className="mt-2 text-xs text-muted-foreground">Versendet {fmt(mandate.signature_sent_at)}</p>
                          )}
                        </div>

                        <div className="rounded-lg border p-3">
                          <p className="mb-2 text-sm font-medium">2 · Unterschrift vermerken</p>
                          <Label className="text-xs text-muted-foreground">Unterzeichnet von</Label>
                          <Input value={signerName} onChange={(e) => setSignerName(e.target.value)}
                            className="mt-1" placeholder={mandate.client_confirmed_name ?? 'Name'} />
                          <Button size="sm" className="mt-2 w-full gap-1.5"
                            disabled={mandate.status !== 'accepted' || action.isPending}
                            onClick={() => run(
                              { action: 'mark_contract_signed', signer_name: signerName, envelope_id: envelopeId },
                              'Unterschrift vermerkt. Die Stelle kann jetzt freigegeben werden.',
                            )}>
                            <FileSignature className="h-3.5 w-3.5" /> Als unterzeichnet vermerken
                          </Button>
                          {mandate.status !== 'accepted' && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Erst nach der Annahme möglich.
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {data.mandates.length > 1 && (
                  <Card>
                    <CardContent className="p-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Versionshistorie
                      </p>
                      <div className="space-y-2 text-sm">
                        {data.mandates.map((m) => (
                          <div key={m.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                            <div>
                              <span className="font-medium">{m.mandate_number}</span>
                              <span className="ml-2 text-muted-foreground">{m.fee_percentage} %</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="font-normal">{m.status}</Badge>
                              {fmt(m.created_at)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* ---- Historie ------------------------------------------------ */}
          <TabsContent value="history" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Verlauf
                </p>
                <div className="space-y-2 text-sm">
                  {data.events.length === 0 && <p className="text-muted-foreground">Noch keine Ereignisse.</p>}
                  {data.events.map((e) => (
                    <div key={e.id} className="flex items-baseline justify-between gap-3 border-b pb-1.5 last:border-0">
                      <span>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(e.occurred_at), { addSuffix: true, locale: de })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Wer Zugriff auf diese Aufnahme hat
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Jeder Zugang ist einzeln entziehbar. Eine Aufnahme enthält Gehaltsbänder und interne
                  Gründe für die Vakanz.
                </p>
                <div className="space-y-2 text-sm">
                  {data.tokens.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 border-b pb-1.5 last:border-0">
                      <div>
                        <span>{t.recipient_email ?? 'Erstzugang'}</span>
                        <Badge variant="outline" className="ml-2 font-normal text-[10px]">
                          {t.origin === 'forward' ? 'weitergeleitet' : t.origin === 'resume' ? 'erneut gesendet' : t.origin === 'admin' ? 'von uns' : 'Start'}
                        </Badge>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {t.revoked_at ? 'entzogen' : new Date(t.expires_at) < new Date() ? 'abgelaufen'
                          : `gültig bis ${format(new Date(t.expires_at), 'dd.MM.yyyy', { locale: de })}`}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <Label className="text-xs text-muted-foreground">Interne Notiz</Label>
                <Textarea defaultValue={d.admin_note ?? ''} rows={3} className="mt-1"
                  onBlur={(e) => {
                    if (e.target.value !== (d.admin_note ?? '')) {
                      void run({ action: 'note', note: e.target.value }, 'Notiz gespeichert.');
                    }
                  }} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ---- Entscheidung --------------------------------------------- */}
        {d.review_state === 'pending_admin' && (
          <Card className="border-primary/25">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm text-muted-foreground">
                Mit der Annahme entstehen Kundenkonto, Organisation und die Stelle. Veröffentlicht wird
                erst nach unterzeichnetem Vertrag.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRejectOpen('request_changes')}>
                  <MessageSquare className="mr-1.5 h-4 w-4" /> Rückfrage
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRejectOpen('reject')}>
                  <X className="mr-1.5 h-4 w-4" /> Ablehnen
                </Button>
                <Button size="sm" disabled={action.isPending}
                  onClick={() => run({ action: 'accept' }, 'Auftrag angenommen. Stelle und Kundenkonto sind angelegt.')}>
                  {action.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                  Auftrag annehmen
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={Boolean(rejectOpen)} onOpenChange={(v) => !v && setRejectOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rejectOpen === 'reject' ? 'Anfrage ablehnen' : 'Rückfrage stellen'}</DialogTitle>
            <DialogDescription>
              {rejectOpen === 'reject'
                ? 'Der Kunde erhält Ihre Begründung per E-Mail. Ein offenes Konditionsangebot wird zurückgezogen.'
                : 'Der Kunde erhält Ihre Rückfrage und einen frischen Zugang, um die Aufnahme zu ergänzen.'}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder={rejectOpen === 'reject'
              ? 'z. B. Position liegt außerhalb unseres Suchprofils.'
              : 'z. B. Für die Suche fehlt uns das Gehaltsband — können Sie das noch ergänzen?'} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>Abbrechen</Button>
            <Button
              variant={rejectOpen === 'reject' ? 'destructive' : 'default'}
              disabled={reason.trim().length < 5 || action.isPending}
              onClick={() => run(
                { action: rejectOpen, reason },
                rejectOpen === 'reject' ? 'Anfrage abgelehnt.' : 'Rückfrage gesendet.',
              )}
            >
              <Mail className="mr-1.5 h-4 w-4" /> Senden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

const EVENT_LABEL: Record<string, string> = {
  link_opened: 'Link geöffnet',
  intake_started: 'Aufnahme begonnen',
  first_value: 'Erste Eingaben',
  contact_provided: 'Kontaktdaten hinterlegt',
  email_verification_sent: 'Bestätigungscode versendet',
  email_verified: 'E-Mail bestätigt',
  intake_completed: 'Aufnahme abgeschlossen',
  terms_presented: 'Konditionen gezeigt',
  terms_confirmed: 'Konditionen bestätigt',
  terms_discussion_requested: 'Rückfrage zu den Konditionen',
  forwarded: 'An Entscheider weitergeleitet',
  resume_requested: 'Fortsetzungslink angefordert',
  submitted: 'Beauftragung angefragt',
  accepted: 'Auftrag angenommen',
  changes_requested: 'Rückfrage gestellt',
  rejected: 'Abgelehnt',
  contract_sent: 'Vertrag versendet',
  contract_signed: 'Vertrag unterzeichnet',
  published: 'Stelle veröffentlicht',
  abandoned: 'Abgebrochen',
};

function Rows({ rows }: { rows: [string, unknown][] }) {
  return (
    <dl className="space-y-2 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="w-52 shrink-0 text-muted-foreground">{label}</dt>
          <dd className="font-medium">{value ? String(value) : '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
