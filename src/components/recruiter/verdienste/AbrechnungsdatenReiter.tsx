import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
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
import { dmy, taxModeText, type BillingView, type TaxMode } from '../../../../supabase/functions/_shared/abrechnung-view';

const formatIban = (value: string) => value.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
const dateTime = (iso: string) => new Date(iso).toLocaleString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });
const COUNTRIES = ['DE', 'AT', 'CH', 'NL', 'FR', 'IT', 'ES', 'PL', 'LU', 'BE', 'DK', 'SE', 'GB'];
/** Ländername in der Sprache der Oberfläche; gespeichert wird weiter das Kürzel. */
const countryName = (code: string) => { try { return new Intl.DisplayNames([intlLocale(i18n.language)], { type: 'region' }).of(code) ?? code; } catch { return code; } };

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
  const { t } = useTranslation('recruiterEarnings');
  useEffect(() => { if (openAccount && q.data) setKonto(true); }, [openAccount, q.data]);
  const set = (billing: BillingView) => { qc.setQueryData(['abrechnungsdaten', user?.id], { billing }); void qc.invalidateQueries({ queryKey: ['verdienste'] }); };

  if (q.isLoading) return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (q.isError) return <p className="py-6 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : t('api.billing')}</p>;
  const b = q.data!.billing;
  const address = [b.recipient.street, [b.recipient.postalCode, b.recipient.city].filter(Boolean).join(' '), b.recipient.country ? countryName(b.recipient.country) : b.recipient.countryLabel].filter(Boolean).join(', ');
  const taxIds = [b.tax.vatId && t('billing.vatIdValue', { value: b.tax.vatId }), b.tax.taxNumber && t('billing.taxNumberValue', { value: b.tax.taxNumber })].filter(Boolean).join(' · ');

  const cancelPending = async () => {
    setBusy('cancel');
    try { set((await abrechnungApi.accountCancel()).billing); toast.success(t('billing.changeCancelled')); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('api.accountCancel')); }
    finally { setBusy(''); }
  };
  const object = async () => {
    setBusy('object');
    try { set((await abrechnungApi.selfBillingObjection()).billing); toast.success(t('billing.objectionSaved')); }
    catch (e) { toast.error(e instanceof Error ? e.message : t('api.selfBillingObjection')); }
    finally { setBusy(''); setWiderspruch(false); }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <Abschnitt titel={t('billing.goesTo')} aktion={<Button variant="outline" size="sm" onClick={() => setEdit(true)}>{t('change')}</Button>}>
          {b.recipient.legalName ? <p>{b.recipient.legalName}{b.recipient.legalForm ? ` · ${b.recipient.legalForm}` : ''}</p> : <p className="text-warning">{t('billing.nameMissing')}</p>}
          {address ? <p>{address}</p> : <p className="text-warning">{t('billing.addressMissing')}</p>}
        </Abschnitt>

        <Abschnitt titel={t('billing.tax')} aktion={<Button variant="outline" size="sm" onClick={() => setEdit(true)}>{t('change')}</Button>}>
          <p>{taxModeText(b.tax.mode, i18n.language)}</p>
          {taxIds ? <p>{taxIds}</p> : <p className="text-warning">{t('billing.taxIdMissing')}</p>}
        </Abschnitt>

        <Abschnitt titel={t('billing.account')} aktion={!b.pending?.confirmedAt && <Button variant="outline" size="sm" onClick={() => setKonto(true)}>{b.account ? t('billing.accountChange') : t('billing.accountSetUp')}</Button>}>
          {b.account
            ? <p>{[b.account.holder, b.account.ibanMasked, b.account.bic].filter(Boolean).join(' · ')}{b.account.confirmedAt ? t('billing.confirmedOn', { date: dmy(b.account.confirmedAt.slice(0, 10), i18n.language) }) : b.account.fromProfile ? t('billing.fromProfile') : ''}</p>
            : <p className="text-warning">{t('billing.noAccount')}</p>}
          {b.account && !b.account.confirmedAt && !b.pending && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-foreground">
              <span>{t('billing.notConfirmed')}</span>
              <Button variant="outline" size="sm" onClick={() => setKonto(true)}>{t('billing.confirmAccount')}</Button>
            </div>
          )}
          {b.pending && (b.pending.confirmedAt && b.pending.effectiveAt ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-foreground">
              <span>{t('billing.pendingEffective', { holder: b.pending.holder, iban: b.pending.ibanMasked, date: dateTime(b.pending.effectiveAt) })}</span>
              <Button variant="ghost" size="sm" disabled={busy === 'cancel'} onClick={() => void cancelPending()}>{t('billing.cancelChange')}</Button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3 text-foreground">
              <span>{t('billing.pendingCode', { iban: b.pending.ibanMasked })}</span>
              <span className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setKonto(true)}>{t('billing.enterCode')}</Button>
                <Button variant="ghost" size="sm" disabled={busy === 'cancel'} onClick={() => void cancelPending()}>{t('cancel')}</Button>
              </span>
            </div>
          ))}
        </Abschnitt>

        <Abschnitt titel={t('billing.selfBilling')}>
          {b.selfBilling.objectedAt
            ? <p>{t('billing.objectedOn', { date: dmy(b.selfBilling.objectedAt.slice(0, 10), i18n.language) })}</p>
            : b.selfBilling.consented === false
              ? <p>{t('billing.notConsented')}</p>
              : <p>{b.selfBilling.consented ? t('billing.consentedContract') : t('billing.viaCreditNote')} · <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => setWiderspruch(true)}>{t('billing.object')}</button></p>}
        </Abschnitt>
      </CardContent>

      <DatenDialog open={edit} billing={b} onClose={() => setEdit(false)} onSaved={(nb) => { set(nb); setEdit(false); }} />
      <KontoDialog open={konto} billing={b} onClose={() => setKonto(false)} onDone={(nb) => { set(nb); setKonto(false); }} />
      <AlertDialog open={widerspruch} onOpenChange={setWiderspruch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.objectTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('billing.objectText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={busy === 'object'} onClick={(e) => { e.preventDefault(); void object(); }}>{t('billing.object')}</AlertDialogAction>
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
  const { t } = useTranslation('recruiterEarnings');
  const [f, setF] = useState(init);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setF(init()); setError(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (k: keyof ReturnType<typeof init>, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(''); };
  const save = async () => {
    setBusy(true);
    try { onSaved((await abrechnungApi.saveBilling(f)).billing); toast.success(t('data.saved')); }
    catch (e) { setError(e instanceof Error ? e.message : t('data.saveFailed')); }
    finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('data.title')}</DialogTitle>
          <DialogDescription>{t('data.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Feld id="bp-name" label={t('billing.goesTo')}><Input id="bp-name" value={f.legalName} onChange={(e) => upd('legalName', e.target.value)} placeholder={t('data.namePlaceholder')} /></Feld>
            <Feld id="bp-form" label={t('data.legalForm')}><Input id="bp-form" value={f.legalForm} onChange={(e) => upd('legalForm', e.target.value)} placeholder={t('data.legalFormPlaceholder')} /></Feld>
          </div>
          <Feld id="bp-street" label={t('data.street')}><Input id="bp-street" value={f.street} onChange={(e) => upd('street', e.target.value)} /></Feld>
          <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)_10rem]">
            <Feld id="bp-plz" label={t('data.postalCode')}><Input id="bp-plz" value={f.postalCode} onChange={(e) => upd('postalCode', e.target.value)} /></Feld>
            <Feld id="bp-city" label={t('data.city')}><Input id="bp-city" value={f.city} onChange={(e) => upd('city', e.target.value)} /></Feld>
            <Feld id="bp-country" label={t('data.country')}>
              <select id="bp-country" className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.country} onChange={(e) => upd('country', e.target.value)}>
                {COUNTRIES.map((k) => <option key={k} value={k}>{countryName(k)}</option>)}
                {!COUNTRIES.includes(f.country) && <option value={f.country}>{f.country}</option>}
              </select>
            </Feld>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('billing.tax')}</p>
            <div className="flex flex-wrap gap-1.5">
              {(['standard', 'small_business', 'foreign'] as TaxMode[]).map((m) => (
                <button key={m} type="button" aria-pressed={f.taxMode === m} onClick={() => upd('taxMode', m)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs', f.taxMode === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{t(`data.taxMode.${m}`)}</button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {f.taxMode === 'standard' ? t('data.taxHint.standard') : f.taxMode === 'small_business' ? t('data.taxHint.small_business') : t('data.taxHint.foreign')}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Feld id="bp-vat" label={t('data.vatId')}><Input id="bp-vat" value={f.vatId} onChange={(e) => upd('vatId', e.target.value.toUpperCase())} placeholder="DE123456789" /></Feld>
            <Feld id="bp-taxno" label={t('data.taxNumber')}><Input id="bp-taxno" value={f.taxNumber} onChange={(e) => upd('taxNumber', e.target.value)} placeholder="143/123/45678" /></Feld>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
          <Button disabled={busy} onClick={() => void save()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('save')}</Button>
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
  const { t } = useTranslation('recruiterEarnings');
  useEffect(() => {
    if (!open) return;
    setStep(waiting ? 'code' : 'form'); setCode(''); setError(''); setSentTo(billing.loginEmailMasked); setFirstSetup(!billing.account?.confirmedAt);
    setHolder(billing.account?.holder || billing.recipient.legalName || ''); setIban(''); setBic('');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const request = async () => {
    const clean = iban.replace(/\s+/g, '').toUpperCase();
    if (holder.trim().length < 2) { setError(t('account.holderMissing')); return; }
    if (!clean || !ibanValid(clean)) { setError(t('account.iban')); return; }
    if (!bicValid(bic)) { setError(t('account.bic')); return; }
    setBusy(true); setError('');
    try {
      const r = await abrechnungApi.accountRequest({ holder: holder.trim(), iban: clean, bic: bic.replace(/\s+/g, '').toUpperCase() });
      setSentTo(r.sentTo); setFirstSetup(r.firstSetup); setStep('code'); setCode('');
      if (!r.sent) toast.error(t('account.mailFailed'));
    } catch (e) { setError(e instanceof Error ? e.message : t('api.accountRequest')); }
    finally { setBusy(false); }
  };
  const confirm = async () => {
    if (code.length !== 6) { setError(t('account.codeLength')); return; }
    setBusy(true); setError('');
    try {
      const r = await abrechnungApi.accountConfirm(code);
      toast.success(r.immediate ? t('account.done') : t('account.effectiveFrom', { date: dateTime(r.effectiveAt) }));
      onDone(r.billing);
    } catch (e) { setError(e instanceof Error ? e.message : t('api.accountConfirm')); setCode(''); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{!billing.account ? t('account.titleSetUp') : billing.account.confirmedAt ? t('account.titleChange') : t('account.titleConfirm')}</DialogTitle>
          <DialogDescription>{t('account.description')}</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Feld id="kt-holder" label={t('account.holder')}><Input id="kt-holder" value={holder} onChange={(e) => { setHolder(e.target.value); setError(''); }} /></Feld>
              <Feld id="kt-iban" label={billing.account?.confirmedAt ? t('account.newIban') : 'IBAN'}><Input id="kt-iban" value={iban} autoComplete="off" placeholder="DE00 0000 0000 0000 0000 00" onChange={(e) => { setIban(e.target.value.toUpperCase()); setError(''); }} onBlur={() => setIban(formatIban(iban))} /></Feld>
            </div>
            <Feld id="kt-bic" label={t('account.bicOptional')}><Input id="kt-bic" value={bic} autoComplete="off" onChange={(e) => { setBic(e.target.value.toUpperCase()); setError(''); }} /></Feld>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>{t('cancel')}</Button>
              <Button disabled={busy} onClick={() => void request()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('account.sendCode')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('account.codeSent', { email: sentTo })}</p>
            <InputOTP maxLength={6} value={code} onChange={(v) => { setCode(v.replace(/\D/g, '')); setError(''); }} autoFocus>
              <InputOTPGroup>{[0, 1, 2, 3, 4, 5].map((i) => <InputOTPSlot key={i} index={i} />)}</InputOTPGroup>
            </InputOTP>
            <p className="text-sm text-muted-foreground">
              {firstSetup ? t('account.immediate') : t('account.delay')}
            </p>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => { setStep('form'); setError(''); }}>{t('account.newCode')}</Button>
              <Button disabled={busy || code.length !== 6} onClick={() => void confirm()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('billing.confirmAccount')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
