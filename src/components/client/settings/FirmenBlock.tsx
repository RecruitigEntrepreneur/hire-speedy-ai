import { useRef, useState } from 'react';
import { FileUp, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ROLE_LABEL, companyFacts, companyLabel, useClientCompanies,
  type ClientCompany, type CompanyRequest, type CompanyRole,
} from '@/hooks/useClientCompanies';
import { FirmenLogo } from '@/components/company/FirmenLogo';
import { SettingsBlock } from './SettingsShell';

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const PROOF_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

/** Status einer Firma in einer Zeile – das, was der Kunde jetzt wissen muss. */
function StatusPill({ c }: { c: ClientCompany }) {
  if (c.status === 'verified') {
    return (
      <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
        ✓ Verifiziert{c.decided_at ? ` am ${fmt(c.decided_at)}` : ''}
      </span>
    );
  }
  if (c.status === 'rejected') {
    return <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Nicht verifiziert</span>;
  }
  if (c.admin_question) {
    return <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">Rückfrage</span>;
  }
  return <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">In Prüfung</span>;
}

/** Einstellungen › Unternehmen: Firmen des Kontos, für die es Stellen geben darf. */
export function FirmenBlock() {
  const { companies, loading, unavailable, request } = useClientCompanies();
  const [form, setForm] = useState<{ company: ClientCompany | null; role: CompanyRole } | null>(null);
  const main = companies.find((c) => c.role === 'main') ?? null;

  if (unavailable) return null;

  return (
    <SettingsBlock
      title="Ihre Firmen"
      aside={companies.length > 0 && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setForm({ company: null, role: 'subsidiary' })}>
          <Plus className="h-3.5 w-3.5" />Weitere Firma beantragen
        </Button>
      )}
    >
      <p className="text-sm text-muted-foreground">
        Stellen können Sie nur für verifizierte Firmen einreichen. Matchunt prüft jede Firma einmal.
      </p>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted/50" />
      ) : companies.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-sm">
          <p className="font-medium">Noch keine Firma hinterlegt</p>
          <p className="mt-0.5 text-muted-foreground">Tragen Sie Ihre Firma ein, Matchunt prüft sie in 1–2 Werktagen. Die Aufnahme können Sie schon vorher ausfüllen.</p>
          <Button size="sm" className="mt-3" onClick={() => setForm({ company: null, role: 'main' })}>Firma eintragen</Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {companies.map((c) => {
            const facts = companyFacts(c);
            const change = c.status === 'verified' && c.pending_change;
            return (
              <li key={c.id} className="space-y-1.5 p-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Je Firma ein eigenes Logo, auch für Töchter (automatisch von ihrer Website). */}
                    <FirmenLogo url={c.logo_url} name={companyLabel(c)} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{companyLabel(c)}</p>
                      <p className="text-xs text-muted-foreground">
                        {ROLE_LABEL[c.role]}
                        {c.status !== 'verified' && ` · beantragt am ${fmt(c.requested_at)}`}
                      </p>
                    </div>
                  </div>
                  <StatusPill c={c} />
                </div>
                {facts && <p className="text-xs text-muted-foreground">{facts}</p>}

                {c.admin_question && (
                  <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <span className="font-medium">Rückfrage von Matchunt{change ? ' zur Änderung' : ''}:</span> {c.admin_question}
                  </p>
                )}
                {c.status === 'rejected' && c.reject_reason && (
                  <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                    <span className="font-medium">Grund:</span> {c.reject_reason}
                  </p>
                )}
                {change && !c.admin_question && (
                  <p className="text-xs text-muted-foreground">
                    Änderung in Prüfung seit {fmt(c.requested_at)} – bis dahin gelten die Daten oben.
                  </p>
                )}
                {c.status === 'verified' && !change && c.reject_reason && (
                  <p className="text-xs text-muted-foreground">Letzte Änderung nicht übernommen: {c.reject_reason}</p>
                )}

                <div className="flex flex-wrap gap-3 pt-0.5">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    onClick={() => setForm({ company: c, role: c.role })}
                  >
                    {c.admin_question ? 'Angaben ergänzen'
                      : c.status === 'rejected' ? 'Korrigieren und erneut beantragen'
                      : c.status === 'verified' ? (change ? 'Änderung bearbeiten' : 'Änderung beantragen')
                      : 'Angaben bearbeiten'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && (
        <FirmaDialog
          company={form.company}
          role={form.role}
          mainName={main && main.id !== form.company?.id ? companyLabel(main) : null}
          onClose={() => setForm(null)}
          onSubmit={request}
        />
      )}
    </SettingsBlock>
  );
}

const leer = (v: string | null | undefined) => (v ?? '').trim();

/** Beantragen, ergänzen oder ändern – ein Fenster für alle Fälle. */
function FirmaDialog({ company, role: startRole, mainName, onClose, onSubmit }: {
  company: ClientCompany | null;
  role: CompanyRole;
  mainName: string | null;
  onClose: () => void;
  onSubmit: (input: CompanyRequest, proof?: File | null) => Promise<string>;
}) {
  const { toast } = useToast();
  // Eine offene Änderung wird weiterbearbeitet, sonst die geltenden Daten.
  const base = company?.pending_change ?? company;
  const [v, setV] = useState({
    legal_name: leer(base?.legal_name) || leer(base?.name),
    website: leer(base?.website),
    registration_number: leer(base?.registration_number),
    vat_id: leer(base?.vat_id),
    street: leer(base?.street),
    postal_code: leer(base?.postal_code),
    city: leer(base?.city),
  });
  const [role, setRole] = useState<CompanyRole>((company?.pending_change?.role as CompanyRole | undefined) ?? startRole);
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [impressumBusy, setImpressumBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<typeof v>) => setV((prev) => ({ ...prev, ...patch }));

  const isMain = role === 'main';
  const verified = company?.status === 'verified';
  const complete = v.legal_name && v.street && v.postal_code && v.city;

  const title = !company
    ? (isMain ? 'Firma eintragen' : 'Weitere Firma beantragen')
    : verified ? 'Änderung beantragen' : 'Angaben zur Firma';
  const description = !company
    ? (isMain ? 'Die Firma, für die Sie Stellen besetzen.' : 'Zum Beispiel eine Tochterfirma, für die Sie ebenfalls Stellen besetzen.')
    : verified ? 'Bis Matchunt die Änderung geprüft hat, gelten die bisherigen Daten.' : 'Nach dem Speichern prüft Matchunt die Firma erneut.';

  const impressum = async () => {
    setImpressumBusy(true);
    const { data, error } = await supabase.functions.invoke('enrich-company-from-domain', { body: { domain: v.website } });
    setImpressumBusy(false);
    const a = (data as { data?: Record<string, string | undefined> } | null)?.data;
    if (error || !a) {
      toast({ title: 'Impressum konnte nicht gelesen werden', variant: 'destructive' });
      return;
    }
    set({
      legal_name: a.legal_name || v.legal_name,
      street: a.street || v.street,
      postal_code: a.postal_code || v.postal_code,
      city: a.city || v.city,
      registration_number: a.registration_number || v.registration_number,
      vat_id: a.vat_id || v.vat_id,
    });
    toast({ title: 'Aus dem Impressum übernommen. Bitte kurz prüfen.' });
  };

  const pickProof = (file: File | undefined) => {
    if (!file) return;
    if (!PROOF_TYPES.includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast({ title: 'Bitte ein PDF, PNG oder JPG bis 10 MB wählen', variant: 'destructive' });
      return;
    }
    setProof(file);
  };

  const submit = async () => {
    if (!complete) return;
    setBusy(true);
    try {
      await onSubmit({
        id: company?.id ?? null,
        // Der Anzeigename bleibt beim Ändern erhalten; neu ist er die Firmierung.
        name: company?.name ?? v.legal_name,
        legal_name: v.legal_name,
        street: v.street,
        postal_code: v.postal_code,
        city: v.city,
        country: company?.country ?? 'DE',
        registration_number: v.registration_number || null,
        vat_id: v.vat_id || null,
        website: v.website || null,
        role,
      }, proof);
      toast({ title: verified ? 'Änderung zur Prüfung gesendet' : 'Zur Prüfung gesendet', description: 'Matchunt meldet sich in 1–2 Werktagen.' });
      onClose();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Das hat nicht geklappt.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {company?.admin_question && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <span className="font-medium">Rückfrage von Matchunt:</span> {company.admin_question}
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cf-name">Name laut Handelsregister</Label>
            <Input id="cf-name" value={v.legal_name} placeholder="Muster GmbH" onChange={(e) => set({ legal_name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-web">Website</Label>
            <div className="flex gap-2">
              <Input id="cf-web" value={v.website} placeholder="muster.de" onChange={(e) => set({ website: e.target.value })} />
              <Button type="button" variant="outline" className="shrink-0" disabled={!v.website.trim() || impressumBusy} onClick={() => void impressum()}>
                {impressumBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aus Impressum'}
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cf-hrb">Handelsregister</Label>
              <Input id="cf-hrb" value={v.registration_number} placeholder="HRB 123456 · AG München" onChange={(e) => set({ registration_number: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-vat">USt-IdNr.</Label>
              <Input id="cf-vat" value={v.vat_id} placeholder="DE123456789" onChange={(e) => set({ vat_id: e.target.value })} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_6rem_minmax(0,1fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="cf-street">Straße und Nr.</Label>
              <Input id="cf-street" value={v.street} placeholder="Musterstraße 1" onChange={(e) => set({ street: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-zip">PLZ</Label>
              <Input id="cf-zip" value={v.postal_code} placeholder="80331" onChange={(e) => set({ postal_code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-city">Ort</Label>
              <Input id="cf-city" value={v.city} placeholder="München" onChange={(e) => set({ city: e.target.value })} />
            </div>
          </div>

          {!isMain && (
            <div className="space-y-1.5">
              <Label>Verbindung{mainName ? ` zu ${mainName}` : ''}</Label>
              <div className="flex flex-wrap gap-2">
                {(['subsidiary', 'sister', 'parent'] as CompanyRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-sm transition-colors',
                      role === r ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-muted',
                    )}
                  >
                    {r === 'sister' ? 'Schwesterfirma (gleiche Gruppe)' : ROLE_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Beleg <span className="font-normal text-muted-foreground">(optional, beschleunigt die Prüfung)</span></Label>
            <input ref={fileRef} type="file" accept={PROOF_TYPES.join(',')} className="hidden" onChange={(e) => { pickProof(e.target.files?.[0]); e.target.value = ''; }} />
            {proof ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">{proof.name}</span>
                <button type="button" aria-label="Beleg entfernen" className="text-muted-foreground hover:text-foreground" onClick={() => setProof(null)}><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/50"
              >
                <FileUp className="h-4 w-4 shrink-0" />
                {company?.proof_path ? 'Neuen Beleg hochladen (einer liegt schon vor)' : 'Handelsregisterauszug oder Vollmacht hochladen'}
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">Matchunt gleicht die Angaben mit Impressum und Register ab und meldet sich in 1–2 Werktagen.</p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Abbrechen</Button>
          <Button onClick={() => void submit()} disabled={!complete || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {verified ? 'Änderung beantragen' : company ? 'Erneut zur Prüfung' : 'Beantragen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
