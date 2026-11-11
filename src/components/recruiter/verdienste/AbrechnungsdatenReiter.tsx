import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { abrechnungApi } from '@/lib/abrechnungApi';
import { bicValid, ibanValid } from '../../../../supabase/functions/_shared/recruiter-billing';
import { TAX_MODE_LABEL, dmy, type BillingView, type TaxMode } from '../../../../supabase/functions/_shared/abrechnung-view';

const formatIban = (value: string) => value.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
const dateTime = (iso: string) => new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const COUNTRIES: [string, string][] = [['DE', 'Deutschland'], ['AT', 'Österreich'], ['CH', 'Schweiz'], ['NL', 'Niederlande'], ['FR', 'Frankreich'], ['IT', 'Italien'], ['ES', 'Spanien'], ['PL', 'Polen'], ['LU', 'Luxemburg'], ['BE', 'Belgien'], ['DK', 'Dänemark'], ['SE', 'Schweden'], ['GB', 'Vereinigtes Königreich']];

function Abschnitt({ titel, aktion, children }: { titel: string; aktion?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-2"><p className="font-medium">{titel}</p>{aktion}</div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/**
 * Verdienste › Abrechnungsdaten (H13): an wen die Gutschrift geht, Steuer (drei Fälle),
 * Auszahlungskonto mit Code per Mail und 48 Stunden Wartezeit, Gutschriftverfahren.
 */
export function AbrechnungsdatenReiter({ openAccount = false }: { openAccount?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['abrechnungsdaten', user?.id], queryFn: abrechnungApi.billing, enabled: !!user, retry: false });
  const [edit, setEdit] = useState(false);
  const [konto, setKonto] = useState(false);
  const [widerspruch, setWiderspruch] = useState(false);
  const [busy, setBusy] = useState('');
  useEffect(() => { if (openAccount && q.data) setKonto(true); }, [openAccount, q.data]);
  const set = (billing: BillingView) => { qc.setQueryData(['abrechnungsdaten', user?.id], { billing }); void qc.invalidateQueries({ queryKey: ['verdienste'] }); };

  if (q.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (q.isError) return <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : 'Deine Abrechnungsdaten konnten nicht geladen werden.'}</p>;
  const b = q.data!.billing;
  const address = [b.recipient.street, [b.recipient.postalCode, b.recipient.city].filter(Boolean).join(' '), b.recipient.countryLabel].filter(Boolean).join(', ');
  const taxIds = [b.tax.vatId && `USt-IdNr. ${b.tax.vatId}`, b.tax.taxNumber && `Steuernummer ${b.tax.taxNumber}`].filter(Boolean).join(' · ');

  const cancelPending = async () => {
    setBusy('cancel');
    try { set((await abrechnungApi.accountCancel()).billing); toast.success('Änderung abgebrochen. Dein bisheriges Konto bleibt.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Die Änderung konnte nicht abgebrochen werden.'); }
    finally { setBusy(''); }
  };
  const object = async () => {
    setBusy('object');
    try { set((await abrechnungApi.selfBillingObjection()).billing); toast.success('Widerspruch gespeichert. Matchunt meldet sich dazu.'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Dein Widerspruch konnte nicht gespeichert werden.'); }
    finally { setBusy(''); setWiderspruch(false); }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <Abschnitt titel="Gutschrift geht an" aktion={<Button variant="outline" size="sm" onClick={() => setEdit(true)}>Ändern</Button>}>
          {b.recipient.legalName ? <p>{b.recipient.legalName}{b.recipient.legalForm ? ` · ${b.recipient.legalForm}` : ''}</p> : <p className="text-warning">Name oder Firma fehlt</p>}
          {address ? <p>{address}</p> : <p className="text-warning">Anschrift fehlt</p>}
        </Abschnitt>

        <Abschnitt titel="Steuer" aktion={<Button variant="outline" size="sm" onClick={() => setEdit(true)}>Ändern</Button>}>
          <p>{b.tax.text}</p>
          {taxIds ? <p>{taxIds}</p> : <p className="text-warning">USt-IdNr. oder Steuernummer fehlt</p>}
        </Abschnitt>

        <Abschnitt titel="Auszahlungskonto" aktion={!b.pending?.confirmedAt && <Button variant="outline" size="sm" onClick={() => setKonto(true)}>{b.account ? 'Konto ändern' : 'Konto einrichten'}</Button>}>
          {b.account
            ? <p>{[b.account.holder, b.account.ibanMasked, b.account.bic].filter(Boolean).join(' · ')}{b.account.confirmedAt ? ` · bestätigt am ${dmy(b.account.confirmedAt.slice(0, 10))}` : b.account.fromProfile ? ' · aus deinem Profil übernommen' : ''}</p>
            : <p className="text-warning">Noch kein Konto. Ohne Konto können wir nichts überweisen.</p>}
          {b.account && !b.account.confirmedAt && !b.pending && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-foreground">
              <span>Noch nicht bestätigt. Bestätige dein Konto einmal mit einem Code per Mail, dann überweisen wir dorthin.</span>
              <Button variant="outline" size="sm" onClick={() => setKonto(true)}>Konto bestätigen</Button>
            </div>
          )}
          {b.pending && (b.pending.confirmedAt && b.pending.effectiveAt ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-foreground">
              <span>Neues Konto {b.pending.holder} · {b.pending.ibanMasked} gilt ab {dateTime(b.pending.effectiveAt)} Uhr. Bis dahin überweisen wir nichts.</span>
              <Button variant="ghost" size="sm" disabled={busy === 'cancel'} onClick={() => void cancelPending()}>Änderung abbrechen</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-foreground">
              <span>Neues Konto {b.pending.ibanMasked}: Code noch nicht bestätigt.</span>
              <span className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setKonto(true)}>Code eingeben</Button>
                <Button variant="ghost" size="sm" disabled={busy === 'cancel'} onClick={() => void cancelPending()}>Abbrechen</Button>
              </span>
            </div>
          ))}
        </Abschnitt>

        <Abschnitt titel="Gutschriftverfahren">
          {b.selfBilling.objectedAt
            ? <p>Widersprochen am {dmy(b.selfBilling.objectedAt.slice(0, 10))}. Ab jetzt lädst du jeden Monat deine eigene Rechnung hoch; Matchunt meldet sich dazu.</p>
            : b.selfBilling.consented === false
              ? <p>Nicht zugestimmt: Du stellst uns jeden Monat deine eigene Rechnung.</p>
              : <p>{b.selfBilling.consented ? 'Zugestimmt mit deinem Vertrag' : 'Wir rechnen per Gutschrift mit dir ab'} · <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => setWiderspruch(true)}>Widersprechen</button></p>}
        </Abschnitt>
      </CardContent>

      <DatenDialog open={edit} billing={b} onClose={() => setEdit(false)} onSaved={(nb) => { set(nb); setEdit(false); }} />
      <KontoDialog open={konto} billing={b} onClose={() => setKonto(false)} onDone={(nb) => { set(nb); setKonto(false); }} />
      <AlertDialog open={widerspruch} onOpenChange={setWiderspruch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dem Gutschriftverfahren widersprechen?</AlertDialogTitle>
            <AlertDialogDescription>Dann schreiben wir dir keine Gutschriften mehr. Du lädst jeden Monat deine eigene Rechnung hoch; Matchunt meldet sich dazu.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={busy === 'object'} onClick={(e) => { e.preventDefault(); void object(); }}>Widersprechen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

/** Empfänger, Anschrift und Steuer ändern. Matchunt bekommt eine Nachricht. */
function DatenDialog({ open, billing, onClose, onSaved }: { open: boolean; billing: BillingView; onClose: () => void; onSaved: (b: BillingView) => void }) {
  const init = () => ({
    legalName: billing.recipient.legalName, legalForm: billing.recipient.legalForm, street: billing.recipient.street, postalCode: billing.recipient.postalCode,
    city: billing.recipient.city, country: billing.recipient.country || 'DE', taxMode: billing.tax.mode as TaxMode, vatId: billing.tax.vatId, taxNumber: billing.tax.taxNumber,
  });
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setF(init()); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (k: keyof ReturnType<typeof init>, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(''); };
  const save = async () => {
    setBusy(true);
    try { onSaved((await abrechnungApi.saveBilling(f)).billing); toast.success('Gespeichert. Matchunt ist informiert.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'Konnte nicht gespeichert werden.'); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrechnungsdaten ändern</DialogTitle>
          <DialogDescription>Gilt für neue Gutschriften. Bereits gestellte bleiben, wie sie sind.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Feld id="bp-name" label="Gutschrift geht an"><Input id="bp-name" value={f.legalName} onChange={(e) => upd('legalName', e.target.value)} placeholder="Name oder Firma" /></Feld>
            <Feld id="bp-form" label="Rechtsform"><Input id="bp-form" value={f.legalForm} onChange={(e) => upd('legalForm', e.target.value)} placeholder="z. B. Einzelunternehmen" /></Feld>
          </div>
          <Feld id="bp-street" label="Straße und Hausnummer"><Input id="bp-street" value={f.street} onChange={(e) => upd('street', e.target.value)} /></Feld>
          <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)_10rem]">
            <Feld id="bp-plz" label="PLZ"><Input id="bp-plz" value={f.postalCode} onChange={(e) => upd('postalCode', e.target.value)} /></Feld>
            <Feld id="bp-city" label="Ort"><Input id="bp-city" value={f.city} onChange={(e) => upd('city', e.target.value)} /></Feld>
            <Feld id="bp-country" label="Land">
              <select id="bp-country" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.country} onChange={(e) => upd('country', e.target.value)}>
                {COUNTRIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                {!COUNTRIES.some(([k]) => k === f.country) && <option value={f.country}>{f.country}</option>}
              </select>
            </Feld>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Steuer</p>
            <div className="flex flex-wrap gap-1.5">
              {(['standard', 'small_business', 'foreign'] as TaxMode[]).map((m) => (
                <button key={m} type="button" aria-pressed={f.taxMode === m} onClick={() => upd('taxMode', m)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs', f.taxMode === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{TAX_MODE_LABEL[m]}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {f.taxMode === 'standard' ? '19 % USt auf jede Gutschrift.' : f.taxMode === 'small_business' ? 'Keine USt auf der Gutschrift (§ 19 UStG).' : 'Keine deutsche USt; die Steuer schuldet der Leistungsempfänger (Reverse Charge).'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feld id="bp-vat" label="USt-IdNr."><Input id="bp-vat" value={f.vatId} onChange={(e) => upd('vatId', e.target.value.toUpperCase())} placeholder="DE123456789" /></Feld>
            <Feld id="bp-taxno" label="Steuernummer"><Input id="bp-taxno" value={f.taxNumber} onChange={(e) => upd('taxNumber', e.target.value)} placeholder="143/123/45678" /></Feld>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Feld({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

/**
 * Auszahlungskonto ändern (H13): Code an die Login-Mail, 15 Minuten gültig, höchstens
 * 5 Versuche. Ein neues Konto gilt nach 48 Stunden; das erste gilt sofort.
 */
function KontoDialog({ open, billing, onClose, onDone }: { open: boolean; billing: BillingView; onClose: () => void; onDone: (b: BillingView) => void }) {
  const waiting = !!billing.pending && !billing.pending.confirmedAt;
  const [step, setStep] = useState<'form' | 'code'>(waiting ? 'code' : 'form');
  const [holder, setHolder] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(billing.loginEmailMasked);
  const [firstSetup, setFirstSetup] = useState(!billing.account?.confirmedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setStep(waiting ? 'code' : 'form'); setCode(''); setError(''); setSentTo(billing.loginEmailMasked); setFirstSetup(!billing.account?.confirmedAt);
    setHolder(billing.account?.holder || billing.recipient.legalName || ''); setIban(''); setBic('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const request = async () => {
    const clean = iban.replace(/\s+/g, '').toUpperCase();
    if (holder.trim().length < 2) { setError('Bitte den Kontoinhaber angeben.'); return; }
    if (!clean || !ibanValid(clean)) { setError('Die IBAN stimmt nicht. Bitte prüf sie noch einmal.'); return; }
    if (!bicValid(bic)) { setError('Der BIC stimmt nicht. Er hat 8 oder 11 Zeichen.'); return; }
    setBusy(true); setError('');
    try {
      const r = await abrechnungApi.accountRequest({ holder: holder.trim(), iban: clean, bic: bic.replace(/\s+/g, '').toUpperCase() });
      setSentTo(r.sentTo); setFirstSetup(r.firstSetup); setStep('code'); setCode('');
      if (!r.sent) toast.error('Die Mail mit dem Code ging gerade nicht raus. Fordere gleich einen neuen Code an.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Der Code konnte nicht verschickt werden.'); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (code.length !== 6) { setError('Bitte den 6-stelligen Code aus der Mail eingeben.'); return; }
    setBusy(true); setError('');
    try {
      const r = await abrechnungApi.accountConfirm(code);
      toast.success(r.immediate ? 'Dein Auszahlungskonto ist eingerichtet.' : `Bestätigt. Das neue Konto gilt ab ${dateTime(r.effectiveAt)} Uhr.`);
      onDone(r.billing);
    } catch (e) { setError(e instanceof Error ? e.message : 'Das Konto konnte nicht bestätigt werden.'); setCode(''); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{!billing.account ? 'Auszahlungskonto einrichten' : billing.account.confirmedAt ? 'Auszahlungskonto ändern' : 'Auszahlungskonto bestätigen'}</DialogTitle>
          <DialogDescription>Zum Schutz bestätigst du das Konto mit einem Code, den wir an deine Login-Mail schicken.</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Feld id="kt-holder" label="Kontoinhaber"><Input id="kt-holder" value={holder} onChange={(e) => { setHolder(e.target.value); setError(''); }} /></Feld>
              <Feld id="kt-iban" label={billing.account?.confirmedAt ? 'Neue IBAN' : 'IBAN'}><Input id="kt-iban" value={iban} autoComplete="off" placeholder="DE00 0000 0000 0000 0000 00" onChange={(e) => { setIban(e.target.value.toUpperCase()); setError(''); }} onBlur={() => setIban(formatIban(iban))} /></Feld>
            </div>
            <Feld id="kt-bic" label="BIC (optional)"><Input id="kt-bic" value={bic} autoComplete="off" onChange={(e) => { setBic(e.target.value.toUpperCase()); setError(''); }} /></Feld>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
              <Button disabled={busy} onClick={() => void request()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Code schicken</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Code an {sentTo} geschickt. Er gilt 15 Minuten.</p>
            <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v.replace(/\D/g, '')); setError(''); }} autoFocus>
              <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
            </InputOTP>
            <p className="text-sm text-muted-foreground">
              {firstSetup ? 'Nach der Bestätigung gilt das Konto sofort.' : 'Das neue Konto gilt nach 48 Stunden. Bis dahin überweisen wir nichts. Dein bisheriges Konto und Matchunt bekommen eine Nachricht.'}
            </p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => { setStep('form'); setError(''); }}>Neuen Code anfordern</Button>
              <Button disabled={busy || code.length !== 6} onClick={() => void confirm()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}Konto bestätigen</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
