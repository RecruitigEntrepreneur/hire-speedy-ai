import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Check, Loader2, Send, Users, WifiOff, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { isFreemailAddress, isPlausibleEmail } from '@/lib/domain';
import { BRIEF_QUESTIONS } from '@/lib/briefCatalog';
import { slotLabelT, wertAnzeigeT } from '@/lib/briefCatalogText';
import { cn } from '@/lib/utils';
import { isFailure } from '@/hooks/useGuestIntake';
import { M3Hinweis, M3Kopf } from './m3';
import { opSchluessel, type Op, type OpsFeld } from '../../../../supabase/functions/_shared/aufnahme-ops';

/**
 * Mitarbeit an einer Kunden-Aufnahme (26.11.2026, Variante „gleichzeitig“):
 * Anwesenheit und Signale über einen Echtzeit-Kanal, Hinweise bei fremden
 * Änderungen mit „Rückgängig“, das Einladen einer Kollegin und ihr Danke-Blatt.
 *
 * Über den Kanal laufen nie Inhalte: nur „wer ist wo“, „hat gespeichert“, „tippt“.
 * Die Inhalte holt sich jeder über seinen eigenen Zugang vom Server.
 */

export type Felder = Partial<Record<OpsFeld, unknown>>;

export interface Anwesend { id: string; kuerzel: string; name: string | null; rolle: string; ort: string | null; ortLabel: string | null; etappe?: number | null }
/** Wo jemand gerade ist. `etappe`: Nummer der Etappe der Stelle (0–3, 4 = Prüfen), sonst leer. */
export interface Ort { id: string; label: string; etappe?: number | null }
export interface Hinweis { id: string; schluessel: string; von: string; alt: unknown; neu: unknown; rueck: Op[] }

// ---- Echtzeit: wer ist da, wer hat gespeichert, wer tippt -------------------

export function useAufnahmeLive(args: {
  live: string | null;
  ich: { kuerzel: string; name: string | null; rolle: string } | null;
  ort: Ort | null;
  onGespeichert: () => void;
  onZurueck: (name: string | null) => void;
}) {
  const [anwesend, setAnwesend] = useState<Anwesend[]>([]);
  const [tippt, setTippt] = useState<{ kuerzel: string; name: string | null; ort: string | null; bis: number } | null>(null);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const id = useRef(Math.random().toString(36).slice(2));
  const kanal = useRef<RealtimeChannel | null>(null);
  const cb = useRef(args);
  cb.current = args;

  const daten = () => ({
    kuerzel: cb.current.ich?.kuerzel ?? '?', name: cb.current.ich?.name ?? null, rolle: cb.current.ich?.rolle ?? 'voll',
    ort: cb.current.ort?.id ?? null, ortLabel: cb.current.ort?.label ?? null, etappe: cb.current.ort?.etappe ?? null,
  });

  useEffect(() => {
    if (!args.live || !args.ich) return;
    const ch = supabase.channel(`aufnahme-${args.live}`, { config: { presence: { key: id.current }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState() as Record<string, Omit<Anwesend, 'id'>[]>;
      // Ohne mich selbst -- auch nicht meine eigene, noch nicht abgelaufene Verbindung von vor dem Neuladen.
      const ich = cb.current.ich;
      setAnwesend(Object.entries(st)
        .filter(([k]) => k !== id.current)
        .map(([k, v]) => ({ id: k, ...(v[v.length - 1] ?? { kuerzel: '?', name: null, rolle: 'voll', ort: null, ortLabel: null }) }))
        .filter((a) => !(ich && a.kuerzel === ich.kuerzel && a.rolle === ich.rolle)));
    });
    ch.on('broadcast', { event: 'gespeichert' }, () => cb.current.onGespeichert());
    ch.on('broadcast', { event: 'tippt' }, ({ payload }) => setTippt({ ...(payload as { kuerzel: string; name: string | null; ort: string | null }), bis: Date.now() + 3000 }));
    ch.on('broadcast', { event: 'zurueck' }, ({ payload }) => cb.current.onZurueck((payload as { name?: string | null })?.name ?? null));
    ch.subscribe((status) => { if (status === 'SUBSCRIBED') void ch.track(daten()); });
    kanal.current = ch;
    return () => { kanal.current = null; void supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.live, args.ich?.kuerzel]);

  // Wo ich gerade bin, sobald es sich ändert.
  useEffect(() => { void kanal.current?.track(daten()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [args.ort?.id, args.ort?.label, args.ort?.etappe]);

  useEffect(() => {
    const an = () => setOnline(true);
    const aus = () => setOnline(false);
    window.addEventListener('online', an);
    window.addEventListener('offline', aus);
    return () => { window.removeEventListener('online', an); window.removeEventListener('offline', aus); };
  }, []);

  // „tippt“ läuft nach drei Sekunden ohne neues Signal ab.
  useEffect(() => {
    if (!tippt) return;
    const t = setTimeout(() => setTippt((x) => (x && x.bis <= Date.now() ? null : x)), 3100);
    return () => clearTimeout(t);
  }, [tippt]);

  const sende = useCallback((event: 'gespeichert' | 'tippt' | 'zurueck', payload: Record<string, unknown> = {}) => {
    void kanal.current?.send({ type: 'broadcast', event, payload: { kuerzel: cb.current.ich?.kuerzel, name: cb.current.ich?.name, ort: cb.current.ort?.id ?? null, ...payload } });
  }, []);

  return { anwesend, tippt: tippt && tippt.bis > Date.now() ? tippt : null, online, sende };
}

// ---- Werte und Beschriftungen für Hinweise -----------------------------------

/** Den Wert einer Antwort aus einem Stand lesen (Katalog-Antworten: ihr `value`). */
export function wertBei(stand: Felder | null, schluessel: string): unknown {
  if (!stand) return undefined;
  const [feld, ...pfad] = schluessel.split('.');
  let v: unknown = stand[feld as OpsFeld];
  for (const p of pfad) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined;
  if (feld === 'dyn' && pfad[0] === 'catalog' && pfad[1] === 'known' && v && typeof v === 'object') return (v as { value?: unknown }).value;
  return v;
}

const SLOT = new Map(BRIEF_QUESTIONS.flatMap((q) => q.slots.map((s) => [s.key, s] as const)));

export function useHinweisText() {
  const { t } = useTranslation(['clientFunnel', 'intake', 'intakeCatalog']);
  const feldLabel = (schluessel: string, type: 'full-time' | 'freelance') => {
    const [feld, a, b, c] = schluessel.split('.');
    if (feld === 'dyn' && a === 'catalog' && b === 'known' && c) {
      const s = SLOT.get(c);
      return s ? slotLabelT(s, type) : t('clientFunnel:mitarbeit.eineAngabe');
    }
    if (feld === 'built') {
      const map: Record<string, string> = {
        title: 'feldTitel', location: 'feldStandort', remote_type: 'feldModell', experience_level: 'feldErfahrung',
        salary_min: 'feldGehalt', salary_max: 'feldGehalt', must_haves: 'feldKriterien', nice_to_haves: 'feldKriterien',
        benefits: 'feldBenefits', industry: 'feldBranche',
      };
      if (map[a]) return t(`clientFunnel:mitarbeit.${map[a]}`);
    }
    return t('clientFunnel:mitarbeit.eineAngabe');
  };
  const wertText = (schluessel: string, wert: unknown, type: 'full-time' | 'freelance'): string => {
    if (wert === undefined || wert === null || wert === '' || (Array.isArray(wert) && wert.length === 0)) return t('clientFunnel:mitarbeit.leer');
    const [, a, b, c] = schluessel.split('.');
    if (a === 'catalog' && b === 'known' && c) {
      const v = wertAnzeigeT(c, wert, type);
      return String(Array.isArray(v) ? v.join(', ') : v).slice(0, 60);
    }
    if (Array.isArray(wert)) return wert.map(String).join(', ').slice(0, 60);
    if (typeof wert === 'object') return t('clientFunnel:mitarbeit.eineAngabe');
    return String(wert).slice(0, 60);
  };
  return { feldLabel, wertText, t };
}

const SICHTBAR_BUILT = new Set(['title', 'location', 'remote_type', 'experience_level', 'salary_min', 'salary_max', 'must_haves', 'nice_to_haves', 'benefits', 'industry']);
const leer = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Nur Antworten, die man auf dem Bildschirm sieht -- keine inneren Merker der Aufnahme. */
export function sichtbareAntwort(schluessel: string): boolean {
  const [feld, a, b, c] = schluessel.split('.');
  if (feld === 'built') return SICHTBAR_BUILT.has(a);
  if (feld === 'dyn' && a === 'catalog' && b === 'known' && c) return !c.includes('__');
  return false;
}

/**
 * Fremde Änderungen zu Hinweisen bündeln: je Antwort einer, mit den Ops zum Zurücknehmen.
 * Ein Hinweis kommt nur, wenn eine Antwort, die schon dastand, überschrieben wurde. Was die
 * anderen neu ausfüllen, erscheint still im Feld; dass sie arbeiten, zeigt die Zeile oben.
 */
export function hinweiseAus(fremd: Op[], alt: Felder, neu: Felder): Hinweis[] {
  const gruppen = new Map<string, Op[]>();
  for (const op of fremd) {
    const k = opSchluessel(op);
    if (!sichtbareAntwort(k) || leer(wertBei(alt, k))) continue;
    gruppen.set(k, [...(gruppen.get(k) ?? []), op]);
  }
  const wer = ((neu.dyn as Record<string, unknown> | undefined)?.wer ?? {}) as Record<string, { k?: string; n?: string | null }>;
  return [...gruppen.entries()].map(([schluessel, ops]) => ({
    id: `${schluessel}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    schluessel,
    von: wer[schluessel]?.n || wer[schluessel]?.k || '?',
    alt: wertBei(alt, schluessel),
    neu: wertBei(neu, schluessel),
    rueck: ops.map((o) => {
      let v: unknown = alt[o.feld];
      for (const p of o.pfad) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[p] : undefined;
      return v === undefined ? { feld: o.feld, pfad: o.pfad, weg: true as const } : { feld: o.feld, pfad: o.pfad, wert: v };
    }),
  }));
}

// ---- Änderungen am Feld (N1, 27.11.2026) ----------------------------------------
// Statt Kästen oben steht eine fremde Änderung dort, wo das Feld ist:
// „TK geändert · vorher: … · Rückgängig“. Sie bleibt, bis man sie wegklickt,
// zurücknimmt oder das Feld selbst ändert.

const FELD_VON_BUILT: Record<string, string> = {
  title: 'title', location: 'location', remote_type: 'remote_type', experience_level: 'experience_level',
  salary_min: 'salary_range', salary_max: 'salary_range', must_haves: 'kriterien', nice_to_haves: 'kriterien',
  benefits: 'benefits', industry: 'industry',
};

/** Zu welchem Feld (data-feld) eine Antwort gehört. */
export function feldVon(schluessel: string): string | null {
  const [feld, a, b, c] = schluessel.split('.');
  if (feld === 'built') return FELD_VON_BUILT[a] ?? null;
  if (feld === 'dyn' && a === 'catalog' && b === 'known' && c) return c;
  return null;
}

interface AenderungenWert {
  hinweise: Hinweis[];
  type: 'full-time' | 'freelance';
  onRueck: (hs: Hinweis[]) => void;
  onWeg: (ids: string[]) => void;
}
const AenderungenKontext = createContext<AenderungenWert | null>(null);
/** Nur die Gast-Aufnahme setzt ihn; überall sonst zeigen die Marken nichts. */
export const AenderungenProvider = AenderungenKontext.Provider;

/** Die Marke neben der Beschriftung eines Felds; `unten`: als eigene Zeile unter einem schmalen Feld. */
export function GeaendertMarke({ feld, unten = false }: { feld: string; unten?: boolean }) {
  const ctx = useContext(AenderungenKontext);
  const { wertText, t } = useHinweisText();
  const hs = ctx?.hinweise.filter((h) => feldVon(h.schluessel) === feld) ?? [];
  if (!ctx || !hs.length) return null;
  const von = hs[hs.length - 1].von;
  const vorher = hs.map((h) => wertText(h.schluessel, h.alt, ctx.type)).join(' – ');
  const kopf = <Kuerzel k={kuerzelAus(von)} className="h-5 w-5 text-[9px]" />;
  const rueck = (
    <>
      <button type="button" onClick={() => ctx.onRueck(hs)} className="font-medium text-klick hover:underline">{t('clientFunnel:mitarbeit.rueckgaengig')}</button>
      <button type="button" onClick={() => ctx.onWeg(hs.map((h) => h.id))} aria-label={t('clientFunnel:mitarbeit.markeWeg')} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
    </>
  );
  const titel = `${t('clientFunnel:mitarbeit.markeTitel', { name: von })} · ${t('clientFunnel:mitarbeit.markeVorher', { wert: vorher })}`;
  if (unten) {
    // Unter einem schmalen Feld: „TK geändert · Rückgängig ×“, darunter „vorher: …“.
    return (
      <span data-geaendert={feld} title={titel} className="mt-1.5 block text-xs font-normal text-muted-foreground">
        <span className="flex items-center gap-x-1.5">{kopf}<span>{t('clientFunnel:mitarbeit.markeGeaendert')}</span><span aria-hidden>·</span>{rueck}</span>
        <span className="mt-0.5 block truncate pl-[26px]">{t('clientFunnel:mitarbeit.markeVorher', { wert: vorher })}</span>
      </span>
    );
  }
  return (
    <span data-geaendert={feld} title={titel} className="ml-1.5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 align-middle text-xs font-normal text-muted-foreground">
      {kopf}
      <span>{t('clientFunnel:mitarbeit.markeGeaendert')}</span>
      <span className="min-w-0 max-w-[14rem] truncate">· {t('clientFunnel:mitarbeit.markeVorher', { wert: vorher })}</span>
      <span aria-hidden>·</span>
      {rueck}
    </span>
  );
}

// ---- Eine Zeile oben im Blatt: wer ist da, wer ist eingeladen ----------------------

export function MitarbeitZeilen({
  anwesend, tippt, online, ort, eingeladen, onZurueckziehen, zurueck, onZurueckGesehen,
}: {
  anwesend: Anwesend[];
  tippt: { kuerzel: string; name: string | null; ort: string | null } | null;
  online: boolean;
  ort: Ort | null;
  eingeladen: { id: string; name: string }[];
  onZurueckziehen: (id: string) => void;
  zurueck: string | null;
  onZurueckGesehen: () => void;
}) {
  const { t } = useTranslation('clientFunnel');
  // „… hat zurückgegeben“ steht einmal da und geht nach kurzer Zeit von selbst.
  const gesehen = useRef(onZurueckGesehen);
  gesehen.current = onZurueckGesehen;
  useEffect(() => {
    if (!zurueck) return;
    const x = setTimeout(() => gesehen.current(), 15000);
    return () => clearTimeout(x);
  }, [zurueck]);

  // Wer fertig ist und nur noch das Danke-Blatt offen hat, arbeitet nicht mehr mit.
  const da = anwesend.filter((a) => a.ort !== 'danke');
  const text = (a: Anwesend) => {
    const name = a.name ?? a.kuerzel;
    const hier = !!ort && a.ort === ort.id;
    if (tippt && tippt.kuerzel === a.kuerzel && hier) return t('mitarbeit.tippt', { name });
    if (hier) return t('mitarbeit.auchHier', { name });
    return t('mitarbeit.istBei', { name, ort: a.ortLabel || '…' });
  };
  const zeilen: JSX.Element[] = [];
  if (!online) {
    zeilen.push(<p key="off" className="flex items-center justify-center gap-1.5 text-xs text-foreground"><WifiOff className="h-3.5 w-3.5 shrink-0" />{t('mitarbeit.offline')}</p>);
  }
  if (zurueck) {
    zeilen.push(
      <p key="zurueck" className="flex items-center justify-center gap-1.5 text-xs text-foreground">
        <Check className="h-3.5 w-3.5 shrink-0" />
        <span>{t('mitarbeit.zurueckgegeben', { name: zurueck })}</span>
        <button type="button" onClick={onZurueckGesehen} aria-label={t('mitarbeit.schliessen')} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
      </p>,
    );
  }
  if (da.length) {
    zeilen.push(
      <p key="da" className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="flex -space-x-1.5">{da.map((a) => <Kuerzel key={a.id} k={a.kuerzel} className="h-5 w-5 text-[9px] ring-2 ring-background" />)}</span>
        <span>{da.map(text).join(' · ')}</span>
      </p>,
    );
  }
  for (const e of eingeladen) {
    if (da.some((a) => a.name === e.name)) continue;
    zeilen.push(
      <p key={`e-${e.id}`} className="text-center text-xs text-muted-foreground">
        {t('mitarbeit.eingeladenInfo', { name: e.name })}{' · '}
        <button type="button" onClick={() => onZurueckziehen(e.id)} className="font-medium text-klick hover:underline">{t('mitarbeit.zurueckziehen')}</button>
      </p>,
    );
  }
  if (!zeilen.length) return null;
  return <div className="mb-5 space-y-1.5">{zeilen}</div>;
}

const kuerzelAus = (s: string) => {
  const teile = s.trim().split(/\s+/);
  return (teile.length > 1 ? teile[0][0] + teile[teile.length - 1][0] : s.slice(0, 2)).toUpperCase();
};

/** Ein Kürzel im Kreis: Schwarz für mich, Grau für andere. */
export function Kuerzel({ k, ich, className }: { k: string; ich?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold', ich ? 'bg-foreground text-background' : 'bg-secondary text-foreground ring-1 ring-foreground/15', className)}>
      {k}
    </span>
  );
}

// ---- Kollegin einladen (Variante C, „Jemand anderes kennt sie besser“) --------

export function EinladenBlatt({ meineEmail, meinName, onSenden, onGesendet }: {
  meineEmail: string | null;
  /** Ohne Namen stünde in der Einladung nur „Ein Kollege“: dann hier mit abfragen. */
  meinName: string | null;
  onSenden: (email: string, name: string, nachricht: string, meinName: string) => Promise<unknown>;
  /** Danach geht es auf dem Blatt „Arbeitsteilung“ weiter (V1). */
  onGesendet: (email: string) => void;
}) {
  const { t } = useTranslation('clientFunnel');
  const [ich, setIch] = useState(meinName ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [nachricht, setNachricht] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const adresse = email.trim().toLowerCase();
  const gueltig = isPlausibleEmail(adresse) && !isFreemailAddress(adresse);
  const meineDomain = meineEmail?.split('@')[1]?.toLowerCase() ?? '';
  const andereDomain = gueltig && meineDomain && adresse.split('@')[1] !== meineDomain;

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!gueltig) return;
        setBusy(true); setFehler(null);
        const res = await onSenden(adresse, name.trim(), nachricht.trim(), ich.trim());
        setBusy(false);
        if (isFailure(res as never)) { setFehler((res as { message: string }).message); return; }
        onGesendet(adresse);
      }}
    >
      <M3Kopf icon={Users} titel={t('mitarbeit.einladenTitle')} lead={t('mitarbeit.einladenLead')} />
      {!meinName && (
        <div>
          <Label htmlFor="mit-ich" className="text-xs text-muted-foreground">{t('summary.signerLabel')}</Label>
          <Input id="mit-ich" value={ich} onChange={(e) => setIch(e.target.value)} placeholder={t('common.namePlaceholder')} className="mt-1.5 h-11" />
        </div>
      )}
      <div>
        <Label htmlFor="mit-email" className="text-xs text-muted-foreground">{t('common.businessEmail')}</Label>
        <Input id="mit-email" type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('common.emailPlaceholder')} className="mt-1.5 h-11" />
        {andereDomain && <p className="mt-1.5 text-xs text-muted-foreground">{t('mitarbeit.andereDomain', { domain: meineDomain })}</p>}
        {adresse && isPlausibleEmail(adresse) && isFreemailAddress(adresse) && <p className="mt-1.5 text-xs font-medium">{t('verify.freemailHint')}</p>}
      </div>
      <div>
        <Label htmlFor="mit-name" className="text-xs text-muted-foreground">{t('dialogs.nameOptional')}</Label>
        <Input id="mit-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11" />
      </div>
      <div>
        <Label htmlFor="mit-msg" className="text-xs text-muted-foreground">{t('dialogs.messageOptional')}</Label>
        <Textarea id="mit-msg" rows={3} value={nachricht} onChange={(e) => setNachricht(e.target.value)} placeholder={t('mitarbeit.nachrichtPlatzhalter')} className="mt-1.5 resize-none" />
      </div>
      {fehler && <M3Hinweis>{fehler}</M3Hinweis>}
      <Button type="submit" size="lg" disabled={busy || !gueltig || ich.trim().length < 2} className="w-full gap-2 rounded-full">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}{t('dialogs.sendInvite')}
      </Button>
    </form>
  );
}

// ---- Nach dem Einladen: wer macht was (V1, 27.11.2026) -----------------------------

/** Wie weit die eingeladene Kollegin ist -- aus Einladung, Bestätigung und Anwesenheit. */
export interface HelferStand {
  id: string;
  name: string;
  /** offen: Einladung nicht geöffnet · pause: angefangen, gerade nicht da · da: gerade in der Aufnahme · fertig: zurückgegeben */
  zustand: 'offen' | 'pause' | 'da' | 'fertig';
  ortLabel: string | null;
  etappe: number | null;
  zuletzt: string | null;
}

function useStatusText() {
  const { t, i18n } = useTranslation('clientFunnel');
  return (h: HelferStand) => {
    if (h.zustand === 'fertig') return t('mitarbeit.statusFertig');
    if (h.zustand === 'da') return h.ortLabel ? t('mitarbeit.statusBei', { ort: h.ortLabel }) : t('mitarbeit.statusDa');
    if (h.zustand === 'pause') {
      if (!h.zuletzt) return t('mitarbeit.statusPause');
      const d = new Date(h.zuletzt);
      const heute = d.toDateString() === new Date().toDateString();
      const zeit = heute
        ? d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleString(i18n.language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      return t('mitarbeit.statusZuletzt', { zeit });
    }
    return t('mitarbeit.statusOffen');
  };
}

/** Graue Liste mit Nummer oder Haken vorn. */
function TeilListe({ zeilen }: { zeilen: { titel: ReactNode; text: ReactNode; fertig?: boolean; rechts?: ReactNode }[] }) {
  return (
    <ol className="overflow-hidden rounded-[14px] bg-secondary">
      {zeilen.map((z, i) => (
        <li key={i} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-background')}>
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', z.fertig ? 'bg-foreground text-background' : 'bg-background text-foreground ring-1 ring-foreground/15')}>
            {z.fertig ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">{z.titel}</span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{z.text}</span>
          </span>
          {z.rechts}
        </li>
      ))}
    </ol>
  );
}

/**
 * V1 „gleich bei Ihnen weiter“: Die Kollegin beschreibt die Stelle, der Einladende
 * erledigt inzwischen Firmendaten und Paket. Anfragen geht erst, wenn sie zurückgegeben hat.
 */
export function AufgeteiltBlatt({ helfer, frischAn, kontaktFertig, weiter, onSelbst, onZurueckziehen }: {
  helfer: HelferStand;
  /** Gerade eingeladen: an diese Adresse. */
  frischAn: string | null;
  kontaktFertig: boolean;
  /** Ohne `weiter` ist der eigene Teil erledigt: dann ist Mitschreiben der Hauptknopf. */
  weiter: { label: string; onClick: () => void } | null;
  onSelbst: () => void;
  onZurueckziehen: () => void;
}) {
  const { t } = useTranslation('clientFunnel');
  const status = useStatusText();
  const fertig = helfer.zustand === 'fertig';
  return (
    <div>
      <M3Kopf
        icon={frischAn ? Send : Users}
        titel={frischAn ? t('mitarbeit.gesendetTitle') : t('mitarbeit.aufgeteiltTitle')}
        lead={frischAn ? t('mitarbeit.aufgeteiltLeadFrisch', { email: frischAn }) : t('mitarbeit.aufgeteiltLead', { name: helfer.name })}
      />
      <TeilListe
        zeilen={[
          { titel: t('mitarbeit.teilStelle', { name: helfer.name }), text: status(helfer), fertig },
          { titel: t('mitarbeit.teilFirma'), text: kontaktFertig ? t('mitarbeit.erledigt') : t('mitarbeit.teilFirmaText'), fertig: kontaktFertig },
          { titel: t('mitarbeit.teilAnfragen'), text: fertig ? t('mitarbeit.teilAnfragenJetzt') : t('mitarbeit.teilAnfragenText', { name: helfer.name }) },
        ]}
      />
      {weiter ? (
        <>
          <Button size="lg" className="mt-6 w-full rounded-full" onClick={weiter.onClick}>{weiter.label}</Button>
          <button type="button" className="mx-auto mt-3 block text-sm font-medium text-klick hover:underline" onClick={onSelbst}>
            {fertig ? t('mitarbeit.stelleAnsehen') : t('mitarbeit.selbstMitschreiben')}
          </button>
        </>
      ) : (
        <Button size="lg" className="mt-6 w-full rounded-full" onClick={onSelbst}>{t('mitarbeit.selbstMitschreiben')}</Button>
      )}
      {!fertig && (
        <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
          {t('mitarbeit.mailHinweis', { name: helfer.name })}{' '}
          <button type="button" onClick={onZurueckziehen} className="font-medium text-klick hover:underline">{t('mitarbeit.zurueckziehen')}</button>
        </p>
      )}
    </div>
  );
}

/** Anfragen, solange die Kollegin noch beschreibt: ihr Stand statt des Absende-Knopfs. */
export function WartenBlatt({ helfer, etappen, onSelbst, onZurueckziehen }: {
  helfer: HelferStand;
  /** Die Etappen der Stelle, zuletzt „Prüfen“. */
  etappen: string[];
  onSelbst: () => void;
  onZurueckziehen: () => void;
}) {
  const { t } = useTranslation('clientFunnel');
  const status = useStatusText();
  const hier = helfer.zustand === 'da' ? helfer.etappe : null;
  return (
    <div>
      <M3Kopf icon={Users} titel={t('mitarbeit.wartenTitle', { name: helfer.name })} lead={t('mitarbeit.wartenLead', { name: helfer.name })} />
      <ol className="overflow-hidden rounded-[14px] bg-secondary text-sm">
        {etappen.map((e, i) => (
          <li key={i} className={cn('flex items-center justify-between gap-3 px-4 py-2.5', i > 0 && 'border-t border-background')}>
            <span className={cn(hier === i ? 'font-medium text-foreground' : 'text-muted-foreground')}>{e}</span>
            {hier === i && <span className="flex items-center gap-1.5 text-xs text-foreground"><Kuerzel k={kuerzelAus(helfer.name)} className="h-5 w-5 text-[9px]" />{t('mitarbeit.geradeHier')}</span>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-center text-xs text-muted-foreground">{helfer.name} · {status(helfer)}</p>
      <Button size="lg" className="mt-6 w-full rounded-full" onClick={onSelbst}>{t('mitarbeit.selbstMitschreiben')}</Button>
      <button type="button" className="mx-auto mt-3 block text-sm font-medium text-klick hover:underline" onClick={onZurueckziehen}>
        {t('mitarbeit.zurueckziehenSelbst')}
      </button>
    </div>
  );
}

/** Die Kollegin hat „Fertig, zurück“ gedrückt. */
export function DankeBlatt({ name, onWeiter }: { name: string; onWeiter: () => void }) {
  const { t } = useTranslation('clientFunnel');
  return (
    <div>
      <M3Kopf icon={Send} titel={t('mitarbeit.dankeTitle')} lead={t('mitarbeit.dankeLead', { name })} />
      <button type="button" className="mx-auto block text-sm font-medium text-klick hover:underline" onClick={onWeiter}>{t('mitarbeit.weiterBearbeiten')}</button>
    </div>
  );
}
