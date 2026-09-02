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
  ArrowLeft, Building2, Check, Copy, Download, ExternalLink, FileSignature, FileText,
  Loader2, Mail, MessageCircleQuestion, MessageSquare, Send, ShieldAlert, TriangleAlert, X,
} from 'lucide-react';
import {
  CaptureBadge, CommercialBadge, IdentityBadge, ReviewBadge, SignatureBadge, nextStepFor,
} from '@/components/admin/IntakeStateBadges';
import { useIntakeDetail, useIntakeAction, useContractAction, useClarifyAction, useMandateDocument } from '@/hooks/useAdminIntakes';

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
/** Zeitpunkt in der Schreibweise, die im Rest des Admin-Bereichs gilt. */
const fmt = (iso?: string | null) =>
  iso ? format(new Date(iso), 'dd.MM.yyyy HH:mm', { locale: de }) : '—';

export default function AdminIntakeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useIntakeDetail(id);
  const action = useIntakeAction(id);
  const contract = useContractAction(id);
  const clarify = useClarifyAction(id);
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

  const runContract = async (payload: Record<string, unknown>, success: string) => {
    try {
      await contract.mutateAsync(payload);
      toast.success(success);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Vertragsschritt fehlgeschlagen.');
      return false;
    }
  };

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

                {/* ---- Vertragslauf, zweistufig ---------------------------- */}
                {/* Erst der Kunde, dann Matchunt. Erst die Gegenzeichnung macht
                    den Vertrag wirksam — und erst dann lässt die Datenbank die
                    Veröffentlichung zu (jobs_guard_privileged_columns). Die
                    Reihenfolge steht in Triggern, nicht in dieser Oberfläche;
                    hier wird sie nur sichtbar gemacht. */}
                <VerificationPanel report={data.verification} state={data.draft.company_state} />

                <ClarificationPanel
                  items={data.clarifications}
                  busy={clarify.isPending}
                  draftId={data.draft.id}
                  onAsk={async (question, scope) => {
                    try {
                      const res = await clarify.mutateAsync({
                        action: 'ask', draft_id: data.draft.id, question, scope_fields: scope,
                      });
                      if (res?.mail_sent) toast.success('Rückfrage gesendet.');
                      // Bei fehlgeschlagenem Versand ist der Link das Einzige,
                      // was den Vorgang noch rettet -- deshalb im Klartext.
                      else toast.warning(`Mailversand fehlgeschlagen (${res?.mail_error ?? 'unbekannt'}). Link manuell weitergeben.`);
                      return res;
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Rückfrage fehlgeschlagen.');
                      return null;
                    }
                  }}
                  onResolve={async (cid) => {
                    try {
                      await clarify.mutateAsync({ action: 'resolve', id: cid });
                      toast.success('Als erledigt markiert.');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Fehlgeschlagen.');
                    }
                  }}
                />

                <ContractPanel
                  framework={data.framework}
                  mandate={mandate}
                  envelopeId={envelopeId}
                  setEnvelopeId={setEnvelopeId}
                  signerName={signerName}
                  setSignerName={setSignerName}
                  busy={contract.isPending}
                  onCreateDocument={createDocument}
                  documentPending={document.isPending}
                  onRun={runContract}
                  draftId={data.draft.id}
                />

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

/**
 * Der Unterschriftslauf in vier Stufen.
 *
 * Rahmenvertrag einmal je Kunde, Einzelauftrag je Position darunter. Beide
 * laufen denselben Weg: freigeben → versenden → Kunde unterschreibt →
 * Matchunt zeichnet gegen. Die Reihenfolge erzwingen die Trigger; hier steht
 * sie, damit man sieht, wo der Vorgang gerade hängt.
 */
function ContractPanel({
  framework, mandate, envelopeId, setEnvelopeId, signerName, setSignerName,
  busy, onCreateDocument, documentPending, onRun, draftId,
}: {
  framework: Record<string, any> | null;
  mandate: Record<string, any>;
  envelopeId: string;
  setEnvelopeId: (v: string) => void;
  signerName: string;
  setSignerName: (v: string) => void;
  busy: boolean;
  onCreateDocument: () => void;
  documentPending: boolean;
  onRun: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  draftId: string;
}) {
  const rvAktiv = framework?.status === 'active';
  const auftragFertig = Boolean(mandate.countersigned_at);

  return (
    <div className="space-y-4">
      {/* --- Rahmenvertrag ---------------------------------------------- */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5" /> Rahmenvertrag
            </p>
            {framework && <Badge variant="outline">{framework.agreement_number}</Badge>}
          </div>

          {!framework ? (
            <>
              <p className="text-sm text-muted-foreground">
                Für diesen Kunden gibt es noch keinen Rahmenvertrag. Er wird einmal geschlossen;
                alle weiteren Positionen hängen als Einzelaufträge darunter.
              </p>
              <Button size="sm" disabled={busy}
                onClick={() => onRun({ action: 'create_framework', draft_id: draftId },
                                     'Rahmenvertrag angelegt.')}>
                Rahmenvertrag anlegen
              </Button>
            </>
          ) : rvAktiv ? (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Wirksam seit {fmt(framework.countersigned_at)}. Kunde unterzeichnete
                am {fmt(framework.customer_signed_at)}.
              </AlertDescription>
            </Alert>
          ) : (
            <SignatureSteps
              stand={framework.status}
              freigegeben={Boolean(framework.released_for_signature_at)}
              versendet={Boolean(framework.envelope_sent_at)}
              kundeUnterschrieben={Boolean(framework.customer_signed_at)}
              busy={busy}
              envelopeId={envelopeId}
              setEnvelopeId={setEnvelopeId}
              signerName={signerName}
              setSignerName={setSignerName}
              onRun={onRun}
              ziel={{ framework_id: framework.id }}
            />
          )}
        </CardContent>
      </Card>

      {/* --- Einzelauftrag ------------------------------------------------ */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <FileSignature className="h-3.5 w-3.5" /> Einzelauftrag
            </p>
            <Badge variant="outline">{mandate.mandate_number}</Badge>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5"
            onClick={onCreateDocument} disabled={documentPending || !mandate.client_confirmed_at}>
            {documentPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Vertragsdokument erzeugen
          </Button>
          <p className="text-xs text-muted-foreground">
            Das Dokument entsteht aus dem bestätigten Snapshot — nicht aus dem heutigen Stand der
            Tabellen. Es enthält eine Signaturmarke, an der DocuSign das Unterschriftsfeld ausrichtet.
          </p>

          <Separator />

          {!mandate.framework_agreement_id && framework && (
            <Button size="sm" variant="secondary" disabled={busy}
              onClick={() => onRun(
                { action: 'link_framework', mandate_id: mandate.id, framework_id: framework.id },
                'Mit dem Rahmenvertrag verknüpft.')}>
              Mit {framework.agreement_number} verknüpfen
            </Button>
          )}

          {auftragFertig ? (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Beidseitig unterzeichnet — Kunde am {fmt(mandate.customer_signed_at)}, Matchunt
                am {fmt(mandate.countersigned_at)}. Die Stelle kann jetzt freigegeben werden.
              </AlertDescription>
            </Alert>
          ) : (
            <SignatureSteps
              stand={mandate.signature_status}
              freigegeben={Boolean(mandate.released_for_signature_at)}
              versendet={Boolean(mandate.signature_sent_at)}
              kundeUnterschrieben={Boolean(mandate.customer_signed_at)}
              busy={busy}
              envelopeId={envelopeId}
              setEnvelopeId={setEnvelopeId}
              signerName={signerName}
              setSignerName={setSignerName}
              onRun={onRun}
              ziel={{ mandate_id: mandate.id }}
              gesperrt={!rvAktiv
                ? 'Erst den Rahmenvertrag gegenzeichnen — ohne ihn hängt der Einzelauftrag an nichts.'
                : mandate.status !== 'accepted'
                ? 'Erst die Anfrage annehmen.'
                : null}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SignatureSteps({
  stand, freigegeben, versendet, kundeUnterschrieben, busy,
  envelopeId, setEnvelopeId, signerName, setSignerName, onRun, ziel, gesperrt,
}: {
  stand: string;
  freigegeben: boolean; versendet: boolean; kundeUnterschrieben: boolean;
  busy: boolean;
  envelopeId: string; setEnvelopeId: (v: string) => void;
  signerName: string; setSignerName: (v: string) => void;
  onRun: (payload: Record<string, unknown>, success: string) => Promise<boolean>;
  ziel: Record<string, string>;
  gesperrt?: string | null;
}) {
  if (gesperrt) {
    return <p className="text-sm text-muted-foreground">{gesperrt}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">1 · Zur Unterschrift freigeben</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Der Moment, in dem ein Mensch das fertige Dokument ansieht.
        </p>
        <Button size="sm" className="w-full" disabled={busy || freigegeben}
          onClick={() => onRun({ action: 'release_for_signature', ...ziel }, 'Freigegeben.')}>
          {freigegeben ? 'Freigegeben' : 'Freigeben'}
        </Button>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">2 · Über DocuSign versenden</p>
        <Label className="text-xs text-muted-foreground">Envelope-ID (optional)</Label>
        <Input value={envelopeId} onChange={(e) => setEnvelopeId(e.target.value)}
          className="mt-1" placeholder="zur Nachverfolgung" />
        <Button size="sm" className="mt-2 w-full gap-1.5" variant={versendet ? 'outline' : 'default'}
          disabled={busy || !freigegeben}
          onClick={() => onRun({ action: 'mark_sent', envelope_id: envelopeId, ...ziel },
                               'Als versendet vermerkt.')}>
          <Send className="h-3.5 w-3.5" /> {versendet ? 'Erneut vermerken' : 'Als versendet vermerken'}
        </Button>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">3 · Kunde hat unterschrieben</p>
        <Label className="text-xs text-muted-foreground">Unterzeichnet von</Label>
        <Input value={signerName} onChange={(e) => setSignerName(e.target.value)}
          className="mt-1" placeholder="Name" />
        <Button size="sm" className="mt-2 w-full gap-1.5" disabled={busy || !versendet}
          onClick={() => onRun(
            { action: 'record_customer_signature', signer_name: signerName, envelope_id: envelopeId, ...ziel },
            'Kundenunterschrift vermerkt.')}>
          <FileSignature className="h-3.5 w-3.5" /> Unterschrift vermerken
        </Button>
      </div>

      <div className="rounded-lg border p-3">
        <p className="mb-2 text-sm font-medium">4 · Matchunt zeichnet gegen</p>
        <p className="mb-2 text-xs text-muted-foreground">
          Erst danach ist der Vertrag wirksam.
        </p>
        <Button size="sm" className="w-full" disabled={busy || !kundeUnterschrieben}
          onClick={() => onRun({ action: 'countersign', ...ziel }, 'Gegengezeichnet — der Vertrag ist wirksam.')}>
          Gegenzeichnen
        </Button>
        {!kundeUnterschrieben && (
          <p className="mt-2 text-xs text-muted-foreground">
            Matchunt zeichnet zuletzt.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Der Bericht der Firmenprüfung.
 *
 * Er enthält eine Empfehlung, keine Entscheidung — deshalb steht hier kein
 * Knopf „annehmen", sondern nur, was gefunden wurde. Angenommen wird oben,
 * durch einen Menschen, der das hier gelesen hat.
 */
function VerificationPanel({ report, state }: { report: Record<string, any> | null; state: string }) {
  const label: Record<string, string> = {
    not_checked: 'noch nicht geprüft', checking: 'Prüfung läuft',
    verified: 'ohne Auffälligkeiten', needs_review: 'Abweichungen gefunden',
    failed: 'harte Widersprüche',
  };
  const abweichungen = (report?.deviations ?? []) as Record<string, any>[];
  const risiken = (report?.risk_notes ?? []) as Record<string, any>[];

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Firmenprüfung
          </p>
          <Badge variant={state === 'verified' ? 'secondary' : state === 'failed' ? 'destructive' : 'outline'}>
            {label[state] ?? state}
          </Badge>
        </div>

        {!report ? (
          <p className="text-sm text-muted-foreground">
            {state === 'checking'
              ? 'Die Prüfung läuft gerade.'
              : 'Es liegt noch kein Prüfbericht vor.'}
          </p>
        ) : (
          <>
            {report.summary && <p className="text-sm">{report.summary}</p>}

            {abweichungen.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Abweichungen ({abweichungen.length})
                </p>
                {abweichungen.map((d, i) => (
                  <div key={i} className="rounded-md border p-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{d.field}</span>
                      <Badge variant={d.severity === 'critical' ? 'destructive' : 'outline'}
                             className="shrink-0 text-[10px]">
                        {d.severity}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{d.note}</p>
                    {d.claimed && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        angegeben: {d.claimed}{d.found ? ` · gefunden: ${d.found}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {risiken.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Risikohinweise</p>
                {risiken.map((r, i) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    · {r.topic ? `${r.topic}: ` : ''}{r.note}
                  </p>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Empfehlung: <strong>{report.recommendation}</strong>
              {report.confidence != null && <> · Zuversicht {Math.round(report.confidence * 100)} %</>}
              {report.model && <> · {report.model}</>}
              {report.error && <> · unvollständig: {report.error}</>}
            </p>
            <p className="text-xs text-muted-foreground">
              Der Bericht ist eine Empfehlung, keine Entscheidung. Angenommen wird oben.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Rückfragen an den Kunden — der Link öffnet die Rückfrage, nicht den Entwurf. */
const RUECKFRAGE_FELDER = [
  'company_legal_name', 'company_street', 'company_postal_code', 'company_city',
  'company_vat_id', 'company_registration_number', 'company_website',
  'contact_name', 'contact_phone', 'contact_role', 'billing_email',
];

function ClarificationPanel({
  items, busy, onAsk, onResolve,
}: {
  items: Record<string, any>[];
  busy: boolean;
  draftId: string;
  onAsk: (question: string, scope: string[]) => Promise<Record<string, any> | null>;
  onResolve: (id: string) => Promise<void>;
}) {
  const [frage, setFrage] = useState('');
  const [umfang, setUmfang] = useState<string[]>([]);
  const [letzterLink, setLetzterLink] = useState<string | null>(null);

  const stellen = async () => {
    const res = await onAsk(frage.trim(), umfang);
    if (res) {
      setFrage('');
      setUmfang([]);
      setLetzterLink(res.url ?? null);
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <MessageCircleQuestion className="h-3.5 w-3.5" /> Rückfragen
        </p>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{c.question}</p>
                  <Badge variant={c.status === 'answered' ? 'secondary' : 'outline'} className="shrink-0">
                    {c.status}
                  </Badge>
                </div>
                {c.answer && (
                  <p className="mt-2 rounded bg-muted/50 p-2 text-muted-foreground">{c.answer}</p>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">
                  gestellt {fmt(c.created_at)}
                  {c.answered_at && <> · beantwortet {fmt(c.answered_at)}</>}
                  {c.scope_fields?.length > 0 && <> · Umfang: {c.scope_fields.join(', ')}</>}
                </p>
                {c.status === 'answered' && (
                  <Button size="sm" variant="outline" className="mt-2" disabled={busy}
                    onClick={() => onResolve(c.id)}>
                    Als erledigt markieren
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {letzterLink && (
          <Alert>
            <Copy className="h-4 w-4" />
            <AlertDescription className="space-y-1 text-sm">
              <p>Antwortlink (14 Tage gültig):</p>
              <code className="block break-all text-xs">{letzterLink}</code>
              <Button size="sm" variant="outline" className="mt-1"
                onClick={() => { void navigator.clipboard.writeText(letzterLink); toast.success('Kopiert.'); }}>
                Kopieren
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Neue Rückfrage</Label>
          <Textarea value={frage} onChange={(e) => setFrage(e.target.value)} rows={3}
            placeholder="Was soll der Kunde klären?" />
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">
              Felder, die der Link bearbeitbar macht (optional — leer heißt: nur Textantwort)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {RUECKFRAGE_FELDER.map((f) => (
                <Button key={f} size="sm" type="button"
                  variant={umfang.includes(f) ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() => setUmfang((s) =>
                    s.includes(f) ? s.filter((x) => x !== f) : [...s, f])}>
                  {f.replace(/^(company|contact)_/, '')}
                </Button>
              ))}
            </div>
          </div>
          <Button size="sm" disabled={busy || !frage.trim()} onClick={stellen}>
            {busy ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Wird gesendet …</>
                  : 'Rückfrage senden'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
