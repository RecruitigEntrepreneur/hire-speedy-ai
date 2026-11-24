import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, ChevronDown, Mail, Phone, Plus } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { intlLocale } from '@/i18n/languages';
import { usePool } from '@/hooks/usePool';
import { POOL_ERSTKONTAKT, POOL_GRUENDE, POOL_RHYTHMEN, aufWerktag, naechsterKontakt, plusMonate, tageFaellig, type Pool, type PoolEintrag, type PoolGrund, type PoolRhythmus, type PoolWechsel } from '@/lib/talentPool';
import { cn } from '@/lib/utils';

export interface PoolKandidat { id: string; name: string; rolle?: string | null; phone?: string | null; email?: string | null }

const tagIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Auswahl als Pillen, gewählt = dunkler Rand (wie im Einladen-Fenster). */
function Pillen<T extends string | number>({ werte, wert, onChange, text }: { werte: readonly T[]; wert: T | null; onChange: (v: T) => void; text: (v: T) => string }) {
  return <div className="flex flex-wrap gap-1.5">
    {werte.map((v) => (
      <button key={String(v)} type="button" aria-pressed={wert === v} onClick={() => onChange(v)}
        className={cn('rounded-full border px-3 py-1.5 text-sm transition-colors', wert === v ? 'border-foreground font-medium ring-1 ring-foreground' : 'border-border text-foreground hover:border-foreground/40')}>
        {text(v)}
      </button>
    ))}
  </div>;
}

const Feld = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2"><p className="text-sm font-medium">{label}</p>{children}</div>
);

/** „Neuer Pool“ bzw. „Pool bearbeiten“: Name, wofür, üblicher Rhythmus. Beim Bearbeiten auch Löschen (mit Rückfrage). */
export function NeuerPoolFenster({ offen, pool: bestehend, onClose, onCreated, onDeleted }: { offen: boolean; pool?: Pool | null; onClose: () => void; onCreated?: (id: string) => void; onDeleted?: () => void }) {
  const { t } = useTranslation('candidates');
  const pool = usePool();
  const [name, setName] = useState('');
  const [wofuer, setWofuer] = useState('');
  const [rhythmus, setRhythmus] = useState<PoolRhythmus>('quarterly');
  const [speichert, setSpeichert] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  useEffect(() => {
    if (!offen) return;
    setName(bestehend?.name ?? ''); setWofuer(bestehend?.description ?? ''); setRhythmus(bestehend?.default_frequency ?? 'quarterly'); setLoeschen(false);
  }, [offen, bestehend?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!offen) return null;
  const anzahl = bestehend ? pool.anzahlJePool.get(bestehend.id) ?? 0 : 0;

  const speichern = async () => {
    setSpeichert(true);
    const eingabe = { name, beschreibung: wofuer, rhythmus };
    const r = bestehend ? { id: bestehend.id, ...(await pool.poolAendern(bestehend.id, eingabe)) } : await pool.poolErstellen(eingabe);
    setSpeichert(false);
    if (r.error || !r.id) { toast.error(r.doppelt ? t('pool.nameTaken') : t('pool.saveFailed')); return; }
    toast.success(bestehend ? t('pool.poolSaved') : t('pool.created'));
    onClose();
    if (!bestehend) onCreated?.(r.id);
  };
  const entfernen = async () => {
    if (!bestehend) return;
    setSpeichert(true);
    const { error } = await pool.poolLoeschen(bestehend.id);
    setSpeichert(false);
    if (error) { toast.error(t('pool.saveFailed')); return; }
    toast.success(t('pool.poolDeleted'));
    onClose();
    onDeleted?.();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{loeschen ? t('pool.deleteTitle', { pool: bestehend?.name }) : bestehend ? t('pool.editPoolTitle') : t('pool.newTitle')}</DialogTitle>
          <DialogDescription>{loeschen ? (anzahl === 0 ? t('pool.deleteEmpty') : t('pool.deleteText', { count: anzahl })) : t('pool.newDescription')}</DialogDescription>
        </DialogHeader>
        {loeschen ? (
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLoeschen(false)}>{t('actions.cancel')}</Button>
            <Button variant="destructive" disabled={speichert} onClick={() => void entfernen()}>{t('pool.deletePool')}</Button>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              <Feld label={t('pool.newName')}>
                <Input value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} placeholder={t('pool.newNamePlaceholder')} />
              </Feld>
              <Feld label={t('pool.newPurpose')}>
                <Input value={wofuer} onChange={(e) => setWofuer(e.target.value)} placeholder={t('pool.newPurposePlaceholder')} />
              </Feld>
              <Feld label={t('pool.newRhythm')}>
                <Pillen<PoolRhythmus> werte={POOL_RHYTHMEN} wert={rhythmus} onChange={setRhythmus} text={(v) => t(`pool.rhythm.${v}`)} />
                {bestehend && <p className="text-xs text-muted-foreground">{t('pool.rhythmHint')}</p>}
              </Feld>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              {bestehend ? <button type="button" onClick={() => setLoeschen(true)} className="text-sm font-medium text-destructive hover:underline">{t('pool.deletePool')}</button> : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
                <Button disabled={!name.trim() || speichert} onClick={() => void speichern()}>{bestehend ? t('pool.save') : t('pool.create')}</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * In einen Pool legen bzw. den Eintrag ändern (Mischung A + B, 25.11.2026): ein Fenster, vorausgefüllt.
 * Pool ist schon gewählt (`poolId`), der Rhythmus kommt vom Pool, die Einwilligung bleibt bewusst leer.
 * Mehrere Kandidaten auf einmal bekommen dieselben Angaben.
 */
export function PoolFenster({ kandidaten, poolId, onClose }: { kandidaten: PoolKandidat[] | null; poolId?: string | null; onClose: () => void }) {
  const { t, i18n } = useTranslation('candidates');
  const pool = usePool();
  const einer = kandidaten?.length === 1 ? kandidaten[0] : null;
  const alle = einer ? pool.alleJeKandidat.get(einer.id) ?? [] : [];

  const [ziel, setZiel] = useState<string>('');
  const [grund, setGrund] = useState<PoolGrund>('future_fit');
  const [monate, setMonate] = useState<number | null>(3);
  const [datum, setDatum] = useState('');
  const [rhythmus, setRhythmus] = useState<PoolRhythmus>('quarterly');
  const [rhythmusOffen, setRhythmusOffen] = useState(false);
  const [notiz, setNotiz] = useState('');
  const [zustimmung, setZustimmung] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [neuerPool, setNeuerPool] = useState(false);

  const vorhanden = alle.find((e) => e.pool_id === ziel) ?? alle.find((e) => !e.pool_id) ?? null;
  const schonZugestimmt = alle.some((e) => e.consent_at);

  // Beim Öffnen: gewünschter Pool, sonst der, in dem der Kandidat schon liegt, sonst der einzige
  useEffect(() => {
    if (!kandidaten) return;
    setZiel(poolId ?? alle[0]?.pool_id ?? (pool.pools.length === 1 ? pool.pools[0].id : ''));
    setZustimmung(false); setRhythmusOffen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kandidaten, poolId]);
  // Beim Pool-Wechsel: vorhandenen Eintrag laden oder Vorgaben des Pools nehmen
  useEffect(() => {
    if (!kandidaten) return;
    const p = pool.pools.find((x) => x.id === ziel);
    setGrund(vorhanden?.pool_type ?? 'future_fit');
    setRhythmus(vorhanden ? (vorhanden.contact_frequency === 'monthly' ? 'quarterly' : vorhanden.contact_frequency) : p?.default_frequency ?? 'quarterly');
    setNotiz(vorhanden?.notes ?? '');
    if (vorhanden?.next_contact_at) { setMonate(null); setDatum(tagIso(new Date(vorhanden.next_contact_at))); } else { setMonate(3); setDatum(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kandidaten, ziel, vorhanden?.id]);

  if (!kandidaten) return null;
  const wann = monate != null ? plusMonate(new Date(), monate) : datum ? new Date(`${datum}T09:00:00`) : null;
  const brauchtZustimmung = !vorhanden && !schonZugestimmt;
  const bereit = !!ziel && !!wann && (!brauchtZustimmung || zustimmung);
  const locale = intlLocale(i18n.language);

  const speichern = async () => {
    if (!wann || !ziel) return;
    setSpeichert(true);
    let fehler = 0;
    for (const k of kandidaten) {
      const { error } = await pool.speichern(k.id, ziel, { grund, naechsterKontakt: wann, rhythmus, notiz }, zustimmung ? { am: new Date() } : undefined);
      if (error) fehler++;
    }
    setSpeichert(false);
    if (fehler) { toast.error(t('pool.saveFailed')); return; }
    toast.success(vorhanden ? t('pool.updated') : t('pool.added', { count: kandidaten.length }));
    onClose();
  };

  const entfernen = async () => {
    if (!vorhanden) return;
    const { error } = await pool.herausnehmen(vorhanden);
    if (error) { toast.error(t('pool.saveFailed')); return; }
    toast.success(t('pool.removed'));
    onClose();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{einer ? t(vorhanden ? 'pool.titleEdit' : 'pool.titleAdd', { name: einer.name }) : t('pool.titleMany', { count: kandidaten.length })}</DialogTitle>
            <DialogDescription>{einer?.rolle || t('pool.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <Feld label={t('pool.poolField')}>
              {pool.pools.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('pool.noPools')} <button type="button" className="font-medium text-klick hover:underline" onClick={() => setNeuerPool(true)}>{t('pool.createNew')} ›</button></p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={ziel} onValueChange={setZiel}>
                    <SelectTrigger className="h-10 min-w-[14rem] flex-1 rounded-lg"><SelectValue placeholder={t('pool.choosePool')} /></SelectTrigger>
                    <SelectContent>
                      {pool.pools.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button type="button" className="text-sm font-medium text-klick hover:underline" onClick={() => setNeuerPool(true)}>{t('pool.createNew')} ›</button>
                </div>
              )}
            </Feld>
            <Feld label={t('pool.why')}>
              <Pillen<PoolGrund> werte={POOL_GRUENDE} wert={grund} onChange={setGrund} text={(v) => t(`pool.reason.${v}`)} />
            </Feld>
            <Feld label={t('pool.when')}>
              <Pillen<number> werte={POOL_ERSTKONTAKT} wert={monate} onChange={(v) => { setMonate(v); setDatum(''); }} text={(v) => t('pool.inMonths', { count: v })} />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {t('pool.orDate')}
                <Input type="date" value={datum} min={tagIso(new Date())} onChange={(e) => { setDatum(e.target.value); setMonate(null); }} className="h-9 w-auto rounded-lg" />
              </div>
              {rhythmusOffen
                ? <Pillen<PoolRhythmus> werte={POOL_RHYTHMEN} wert={rhythmus} onChange={setRhythmus} text={(v) => t(`pool.rhythm.${v}`)} />
                : <p className="text-sm text-muted-foreground">{t('pool.after')} <span className="font-medium text-foreground">{t(`pool.rhythm.${rhythmus}`)}</span> <button type="button" className="font-medium text-klick hover:underline" onClick={() => setRhythmusOffen(true)}>{t('pool.change')} ›</button></p>}
            </Feld>
            <Feld label={t('pool.note')}>
              <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} placeholder={t('pool.notePlaceholder')} />
            </Feld>
            {brauchtZustimmung && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border bg-card p-3 text-sm">
                <Checkbox checked={zustimmung} onCheckedChange={(v) => setZustimmung(v === true)} className="mt-0.5" />
                <span>{einer ? t('pool.consent', { name: einer.name.split(/\s+/)[0] }) : t('pool.consentMany')}<span className="mt-1 block text-xs text-muted-foreground">{t('pool.consentHint')}</span></span>
              </label>
            )}
            {!brauchtZustimmung && (vorhanden?.consent_at ?? alle.find((e) => e.consent_at)?.consent_at) && (
              <p className="text-xs text-muted-foreground">{t('pool.consentOn', { date: new Date((vorhanden?.consent_at ?? alle.find((e) => e.consent_at)!.consent_at)!).toLocaleDateString(locale) })}</p>
            )}
            {wann && (
              <p className="rounded-xl bg-muted px-3 py-2 text-sm">
                {einer ? t('pool.taskInfo', { date: aufWerktag(wann).toLocaleDateString(locale), name: einer.name.split(/\s+/)[0] }) : t('pool.taskInfoMany', { date: aufWerktag(wann).toLocaleDateString(locale) })}
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {vorhanden ? <button type="button" onClick={() => void entfernen()} className="text-sm font-medium text-destructive hover:underline">{t('pool.remove')}</button> : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>{t('actions.cancel')}</Button>
              <Button disabled={!bereit || speichert} onClick={() => void speichern()}>{vorhanden ? t('pool.save') : t('pool.add')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <NeuerPoolFenster offen={neuerPool} onClose={() => setNeuerPool(false)} onCreated={setZiel} />
    </>
  );
}

/**
 * Aufgabe „Bei … melden“ in drei Schritten: melden, festhalten was neu ist (geht ins Profil),
 * nächsten Kontakt bestätigen. „Nicht erreicht“ schiebt um zwei Tage.
 */
export function PoolKontaktFenster({ eintrag, kandidat, onClose, onDone }: { eintrag: PoolEintrag | null; kandidat: PoolKandidat | null; onClose: () => void; onDone?: () => void }) {
  const { t, i18n } = useTranslation('candidates');
  const pool = usePool();
  const [weg, setWeg] = useState<'call' | 'email'>('call');
  const [wechsel, setWechsel] = useState<PoolWechsel | null>(null);
  const [ab, setAb] = useState('');
  const [gehalt, setGehalt] = useState('');
  const [notiz, setNotiz] = useState('');
  const [naechster, setNaechster] = useState('');
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    if (!eintrag) return;
    setWeg('call'); setWechsel(eintrag.change_readiness); setAb(''); setGehalt(''); setNotiz('');
    const n = naechsterKontakt(eintrag.contact_frequency);
    setNaechster(n ? tagIso(n) : '');
  }, [eintrag?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!eintrag || !kandidat) return null;
  const vorname = kandidat.name.split(/\s+/)[0];
  const locale = intlLocale(i18n.language);
  const fertig = () => { onDone?.(); onClose(); };

  const gemeldet = async () => {
    setSpeichert(true);
    const { error } = await pool.kontaktFesthalten(eintrag, {
      weg, wechsel, verfuegbarAb: ab || null, gehalt: gehalt ? Number(gehalt.replace(/\D/g, '')) || null : null, notiz,
      naechsterKontakt: naechster ? new Date(`${naechster}T09:00:00`) : null,
    }, 'Talent Pool: Kontakt gehalten');
    setSpeichert(false);
    if (error) { toast.error(t('pool.saveFailed')); return; }
    toast.success(naechster ? t('pool.contactedNext', { date: new Date(`${naechster}T09:00:00`).toLocaleDateString(locale) }) : t('pool.contacted'));
    fertig();
  };
  const nichtErreicht = async () => {
    const { error } = await pool.verschieben(eintrag);
    if (error) { toast.error(t('pool.saveFailed')); return; }
    toast.success(t('pool.postponed'));
    fertig();
  };
  const raus = async () => {
    const { error } = await pool.herausnehmen(eintrag);
    if (error) { toast.error(t('pool.saveFailed')); return; }
    toast.success(t('pool.removed'));
    fertig();
  };

  const Schritt = ({ nr, titel, children }: { nr: number; titel: string; children: React.ReactNode }) => (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs text-muted-foreground">{nr}</span>
      <div className="min-w-0 flex-1 space-y-2"><p className="text-sm font-medium">{titel}</p>{children}</div>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pool.contactTitle', { name: kandidat.name })}</DialogTitle>
          <DialogDescription>
            {[pool.poolName(eintrag), t(`pool.reason.${eintrag.pool_type}`)].filter(Boolean).join(' · ')}
            {eintrag.last_contacted_at && ` · ${t('pool.lastContact', { date: new Date(eintrag.last_contacted_at).toLocaleDateString(locale) })}`}
          </DialogDescription>
        </DialogHeader>
        {eintrag.notes && <p className="rounded-xl border bg-card px-3 py-2 text-sm">{t('pool.noteLabel')} „{eintrag.notes}“</p>}
        <div className="space-y-5">
          <Schritt nr={1} titel={t('pool.step1')}>
            <div className="flex flex-wrap gap-2">
              {kandidat.phone && <Button asChild variant={weg === 'call' ? 'secondary' : 'outline'} size="sm" onClick={() => setWeg('call')}><a href={`tel:${kandidat.phone}`}><Phone className="mr-1.5 h-3.5 w-3.5" />{t('actions.call')}</a></Button>}
              {kandidat.email && <Button asChild variant="outline" size="sm" onClick={() => setWeg('email')}><a href={`mailto:${kandidat.email}?subject=${encodeURIComponent(t('pool.mailSubject'))}&body=${encodeURIComponent(t('pool.mailBody', { name: vorname }))}`}><Mail className="mr-1.5 h-3.5 w-3.5" />{t('pool.mailTemplate')}</a></Button>}
              {!kandidat.phone && !kandidat.email && <span className="text-sm text-muted-foreground">{t('pool.noContactData')}</span>}
            </div>
          </Schritt>
          <Schritt nr={2} titel={t('pool.step2')}>
            <Pillen<PoolWechsel> werte={['yes', 'maybe', 'no']} wert={wechsel} onChange={setWechsel} text={(v) => t(`pool.readiness.${v}`)} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-muted-foreground">{t('pool.availableFrom')}<Input type="date" value={ab} onChange={(e) => setAb(e.target.value)} className="h-9 rounded-lg text-foreground" /></label>
              <label className="space-y-1 text-xs text-muted-foreground">{t('pool.salaryWish')}<Input inputMode="numeric" value={gehalt} onChange={(e) => setGehalt(e.target.value)} placeholder="85.000" className="h-9 rounded-lg text-foreground" /></label>
            </div>
            <Textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2} placeholder={t('pool.newsPlaceholder')} />
            <p className="text-xs text-muted-foreground">{t('pool.intoProfile')}</p>
          </Schritt>
          <Schritt nr={3} titel={t('pool.step3')}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Input type="date" value={naechster} min={tagIso(new Date())} onChange={(e) => setNaechster(e.target.value)} className="h-9 w-auto rounded-lg" />
              <span className="text-muted-foreground">{naechster ? t(`pool.rhythm.${eintrag.contact_frequency === 'monthly' ? 'quarterly' : eintrag.contact_frequency}`) : t('pool.noNext')}</span>
              <button type="button" onClick={() => void raus()} className="font-medium text-klick hover:underline">{t('pool.remove')} ›</button>
            </div>
          </Schritt>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => void nichtErreicht()} className="text-sm font-medium text-klick hover:underline">{t('pool.notReached')} ›</button>
          <Button disabled={speichert} onClick={() => void gemeldet()}>{t('pool.done')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Kurzer Stand eines Pool-Eintrags: fällig (fett) oder nächster Termin. */
export function usePoolStand() {
  const { t, i18n } = useTranslation('candidates');
  return (e: PoolEintrag): { faellig: boolean; text: string } => {
    const tage = tageFaellig(e);
    if (tage != null) return { faellig: true, text: tage === 0 ? t('pool.dueToday') : t('pool.due', { count: tage }) };
    return {
      faellig: false,
      text: e.next_contact_at ? t('pool.nextOn', { date: new Date(e.next_contact_at).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric' }) }) : t('pool.noNext'),
    };
  };
}

/**
 * Knopf im Profilkopf (25.11.2026): „＋ Talent Pool“ mit der Liste der Pools; liegt der Kandidat schon
 * in einem Pool, heißt er „Im Pool · N“ und bietet ändern, melden, weiteren Pool, herausnehmen.
 */
export function PoolKnopf({ kandidat }: { kandidat: PoolKandidat }) {
  const { t } = useTranslation('candidates');
  const pool = usePool();
  const [fenster, setFenster] = useState<null | { poolId: string | null }>(null);
  const [melden, setMelden] = useState<PoolEintrag | null>(null);
  const [neuerPool, setNeuerPool] = useState(false);
  const eintraege = pool.alleJeKandidat.get(kandidat.id) ?? [];
  const drin = new Set(eintraege.map((e) => e.pool_id));
  const andere = pool.pools.filter((p) => !drin.has(p.id));
  const vorname = kandidat.name.split(/\s+/)[0];
  const naechster = pool.jeKandidat.get(kandidat.id) ?? null;

  const raus = async (e: PoolEintrag) => {
    const { error } = await pool.herausnehmen(e);
    if (error) toast.error(t('pool.saveFailed')); else toast.success(t('pool.removed'));
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={eintraege.length ? 'secondary' : 'outline'} size="sm" className={cn('h-8', !eintraege.length && 'border-foreground/60')} disabled={pool.laedt}>
            {eintraege.length ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            {eintraege.length ? t('pool.inPool', { count: eintraege.length }) : t('pool.label')}
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 rounded-xl">
          {eintraege.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{t('pool.liesIn', { name: vorname })}</DropdownMenuLabel>
              {eintraege.map((e) => (
                <DropdownMenuItem key={e.id} className="flex items-start justify-between gap-3" onClick={() => setFenster({ poolId: e.pool_id })}>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{pool.poolName(e) ?? t('pool.label')}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t(`pool.reason.${e.pool_type}`)} · {t(`pool.rhythm.${e.contact_frequency === 'monthly' ? 'quarterly' : e.contact_frequency}`)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-klick">{t('pool.change')} ›</span>
                </DropdownMenuItem>
              ))}
              {naechster && <DropdownMenuItem className="font-medium text-klick focus:text-klick" onClick={() => setMelden(naechster)}>{t('pool.contactNow')} ›</DropdownMenuItem>}
              <DropdownMenuSeparator />
            </>
          )}
          {andere.length > 0 && <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{eintraege.length ? t('pool.alsoIn') : t('pool.whichPool')}</DropdownMenuLabel>}
          {andere.map((p) => (
            <DropdownMenuItem key={p.id} className="flex justify-between gap-3" onClick={() => setFenster({ poolId: p.id })}>
              <span className="truncate">{p.name}</span>
              <span className="shrink-0 tabular-nums text-xs text-muted-foreground">{pool.anzahlJePool.get(p.id) ?? 0}</span>
            </DropdownMenuItem>
          ))}
          {andere.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem className="font-medium text-klick focus:text-klick" onClick={() => setNeuerPool(true)}><Plus className="mr-1.5 h-3.5 w-3.5" />{t('pool.createNew')}</DropdownMenuItem>
          {eintraege.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {eintraege.map((e) => (
                <DropdownMenuItem key={e.id} className="text-muted-foreground" onClick={() => void raus(e)}>
                  {eintraege.length === 1 ? t('pool.remove') : t('pool.removeFrom', { pool: pool.poolName(e) ?? t('pool.label') })}
                </DropdownMenuItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <PoolFenster kandidaten={fenster ? [kandidat] : null} poolId={fenster?.poolId} onClose={() => setFenster(null)} />
      <PoolKontaktFenster eintrag={melden} kandidat={kandidat} onClose={() => setMelden(null)} />
      <NeuerPoolFenster offen={neuerPool} onClose={() => setNeuerPool(false)} onCreated={(id) => setFenster({ poolId: id })} />
    </>
  );
}

/** Talent Pool in der Stand-Zeile des Profils, nur wenn der Kandidat in einem Pool liegt: Pool, nächster Kontakt bzw. fällig. */
export function PoolZeile({ kandidat }: { kandidat: PoolKandidat }) {
  const { t } = useTranslation('candidates');
  const pool = usePool();
  const stand = usePoolStand();
  const [melden, setMelden] = useState(false);
  const e = pool.jeKandidat.get(kandidat.id) ?? null;
  if (!e) return null;
  const s = stand(e);
  const weitere = (pool.alleJeKandidat.get(kandidat.id)?.length ?? 1) - 1;
  return (
    <>
      <span className="hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
          <span className="truncate">{pool.poolName(e) ?? t('pool.label')}</span>
          {weitere > 0 && <span className="font-normal text-muted-foreground">+{weitere}</span>}
        </span>
        <span className={s.faellig ? 'font-semibold' : 'text-muted-foreground'}>{s.text}</span>
        {s.faellig && <button type="button" className="font-medium text-klick hover:underline" onClick={() => setMelden(true)}>{t('pool.contactNow')} ›</button>}
        <PoolKontaktFenster eintrag={melden ? e : null} kandidat={kandidat} onClose={() => setMelden(false)} />
      </div>
    </>
  );
}
