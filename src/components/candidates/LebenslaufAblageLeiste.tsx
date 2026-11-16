import { DragEvent, ReactNode, Suspense, lazy, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronUp, FileUp, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
// Lesefortschritt: dieselben Texte wie im Import-Fenster (candidateImport:reading.<nr>).
const READING_STEPS = 4;
import { useAuth } from '@/lib/auth';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { cn } from '@/lib/utils';
import {
  ablageAbbrechen, ablageAngelegt, ablageAnfragen, ablageDateiTauschen, ablageEntfernen, ablageMelden, ablageMelderSetzen, ablageNochmal,
  ablageStarten, ablageZustimmen, lebenslaufWaehlen, useLebenslaufAblage, type AblageEintrag,
} from '@/lib/lebenslaufAblage';
import { HinweisFenster, LebenslaufHochladenFenster, MustertextFenster } from '@/components/candidates/LebenslaufHochladenFenster';

// Das Prüffenster erst laden, wenn es gebraucht wird: die Leiste hängt in jedem Layout.
const ladePruefseite = () => import('@/components/candidates/cv/CvImportDialog');
const CvImportDialog = lazy(() => ladePruefseite().then((m) => ({ default: m.CvImportDialog })));

const hatDateien = (e: { dataTransfer: DataTransfer | null }) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
const ZU_KEY = 'matchunt.ablage.zu';

type Pruefen = { eintrag: AblageEintrag; art: 'akte' | 'hand' };

const uhrzeit = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString(intlLocale(i18n.language), { hour: '2-digit', minute: '2-digit' }) : '');
/** Vorname für die Zeile; Testdaten heißen „Test Vorname Nachname“. */
const vornameVon = (name?: string) => (name ?? '').trim().replace(/^test\s+/i, '').split(/\s+/)[0] || i18n.t('candidateAblage:bar.him');

/**
 * Live-Ablage unten rechts (09.11.2026): zeigt, was hochgeladen und gelesen wird, und nimmt
 * weitere Lebensläufe an. Seit 12.11.2026 ohne Prüfschritt: Nach dem Lesen ist der Kandidat
 * angelegt; die Zeile sagt, ob Matchunt ihm Bescheid gegeben hat, und führt zum Einladen.
 */
// Frei verschieben (12.11.2026, Marko: „wieso können wir die nicht beliebig verschieben“):
// am Kopf ziehen, bleibt immer ganz im Bild, Stelle pro Gerät gemerkt, Doppelklick setzt zurück.
const POS_KEY = 'matchunt.ablage.pos';
const RAND = 24;
type Pos = { right: number; bottom: number };

function useZiehen() {
  const [pos, setPos] = useState<Pos>(() => {
    try { const p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null') as Pos | null; if (p && Number.isFinite(p.right) && Number.isFinite(p.bottom)) return p; } catch { /* egal */ }
    return { right: RAND, bottom: RAND };
  });
  const boxRef = useRef<HTMLElement | null>(null);
  const gezogen = useRef(false);

  const begrenzen = (p: Pos): Pos => {
    const r = boxRef.current?.getBoundingClientRect();
    const w = r?.width ?? 360, h = r?.height ?? 60;
    return {
      right: Math.min(Math.max(8, p.right), Math.max(8, window.innerWidth - w - 8)),
      bottom: Math.min(Math.max(8, p.bottom), Math.max(8, window.innerHeight - h - 8)),
    };
  };
  const merken = (p: Pos) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* egal */ } };

  // Fenstergröße geändert: wieder ganz ins Bild holen.
  useEffect(() => {
    const neu = () => setPos((p) => begrenzen(p));
    window.addEventListener('resize', neu);
    return () => window.removeEventListener('resize', neu);
  }, []);

  const griff = {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('[data-kein-griff]')) return;
      const start = { x: e.clientX, y: e.clientY, ...pos };
      gezogen.current = false;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const bewegen = (ev: PointerEvent) => {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (!gezogen.current && Math.abs(dx) + Math.abs(dy) < 4) return;
        gezogen.current = true;
        setPos(begrenzen({ right: start.right - dx, bottom: start.bottom - dy }));
      };
      const loslassen = () => {
        el.removeEventListener('pointermove', bewegen);
        el.removeEventListener('pointerup', loslassen);
        el.removeEventListener('pointercancel', loslassen);
        setPos((p) => { merken(p); return p; });
      };
      el.addEventListener('pointermove', bewegen);
      el.addEventListener('pointerup', loslassen);
      el.addEventListener('pointercancel', loslassen);
    },
    onDoubleClick: (e: ReactMouseEvent<HTMLElement>) => {
      if ((e.target as HTMLElement).closest('[data-kein-griff]')) return;
      const p = { right: RAND, bottom: RAND };
      setPos(p); merken(p);
    },
  };
  return { style: { right: pos.right, bottom: pos.bottom }, boxRef, griff, gezogen };
}

export function LebenslaufAblageLeiste() {
  const { t } = useTranslation(['candidateAblage', 'candidateImport']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { eintraege, wartenAufZustimmung } = useLebenslaufAblage();
  const [zu, setZu] = useState(() => { try { return localStorage.getItem(ZU_KEY) === '1'; } catch { return false; } });
  const [pruefen, setPruefen] = useState<Pruefen | null>(null);
  const [muster, setMuster] = useState<string | null>(null);
  const [hinweisZeigen, setHinweisZeigen] = useState<{ vorname: string; am: string; test: boolean } | null>(null);
  const [darueber, setDarueber] = useState(false);
  const tiefe = useRef(0);
  const [takt, setTakt] = useState(0);
  const ziehen = useZiehen();
  // Fenster „Lebenslauf hochladen“: wie viele in dieser Runde abgelegt wurden (für „2 von 3“).
  const runde = useRef(0);
  if (wartenAufZustimmung.length === 0) runde.current = 0;
  else runde.current = Math.max(runde.current, wartenAufZustimmung.length);

  useEffect(() => { if (user?.id) ablageStarten(user.id); }, [user?.id]);
  useEffect(() => {
    ablageMelderSetzen((abg) => {
      if (abg.length === 1) toast.error(`${abg[0].name}: ${abg[0].grund}`);
      else toast.error(i18n.t('candidateAblage:bar.skipped', { n: abg.length }));
    });
  }, []);

  const liest = eintraege.some((e) => e.status === 'liest' || e.status === 'laedt');
  useEffect(() => {
    if (!liest) return;
    const t = window.setInterval(() => setTakt((x) => x + 1), 2500);
    return () => window.clearInterval(t);
  }, [liest]);

  const zahlen = useMemo(() => ({
    laeuft: eintraege.filter((e) => ['wartet', 'laedt', 'liest', 'legtAn'].includes(e.status)).length,
    offen: eintraege.filter((e) => e.status !== 'angelegt').length,
  }), [eintraege]);

  // Abweichungen und „Von Hand“ öffnen das bekannte Fenster: vorladen, sobald es gebraucht werden kann.
  const brauchtFenster = eintraege.some((e) => e.status === 'fehler' || (e.status === 'angelegt' && !!e.abweichungen && !!e.cv));
  useEffect(() => { if (brauchtFenster) void ladePruefseite(); }, [brauchtFenster]);

  const zuSetzen = (v: boolean) => { setZu(v); try { localStorage.setItem(ZU_KEY, v ? '1' : '0'); } catch { /* egal */ } };

  const loslassen = (e: DragEvent<HTMLDivElement>) => {
    if (!hatDateien(e)) return;
    e.preventDefault();
    tiefe.current = 0;
    setDarueber(false);
    ablageMelden(ablageAnfragen(Array.from(e.dataTransfer.files)));
  };

  const klein = 'h-7 px-2.5 text-xs';
  const musterLink = (vorname: string) => (
    <button type="button" onClick={() => setMuster(vorname)} className="text-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:decoration-foreground">{t('sampleText')}</button>
  );

  const ansehenLink = (v: string, e: AblageEintrag) => (
    <button type="button" onClick={() => setHinweisZeigen({ vorname: v, am: uhrzeit(e.hinweisAm), test: e.hinweis === 'test' })}
      className="text-foreground underline decoration-muted-foreground/60 underline-offset-2 hover:decoration-foreground">{t('view')}</button>
  );

  /** Zweite Zeile eines angelegten Kandidaten: hat er Bescheid bekommen? */
  const bescheid = (e: AblageEintrag): ReactNode => {
    const v = vornameVon(e.name);
    switch (e.hinweis) {
      case 'laeuft': return t('status.sending', { name: v });
      case 'gesendet': return <>{t('status.sent', { name: v })} · {uhrzeit(e.hinweisAm)} · {ansehenLink(v, e)}</>;
      case 'test': return <>{t('status.test', { name: v })} · {ansehenLink(v, e)}</>;
      case 'schon': return t('status.already', { name: v });
      case 'ohne_email': return <>{t('status.noEmail', { name: v })} · {musterLink(v)}</>;
      case 'selbst': return <>{t('status.yourself', { name: v })} · {musterLink(v)}</>;
      case 'fehler': return <>{e.hinweisFehler || t('status.failed')} {musterLink(v)}</>;
      default: return e.hinweisWahl === 'selbst' ? <>{t('status.yourself', { name: v })} · {musterLink(v)}</> : t('status.inCandidates');
    }
  };

  const zeile = (e: AblageEintrag) => {
    const schritt = i18n.t(`candidateImport:reading.${(takt + e.id.charCodeAt(0)) % READING_STEPS}`);
    let titel: ReactNode = e.name || e.dateiname;
    let text: ReactNode = '';
    let aktion: ReactNode = null;
    let laeuft = false;
    switch (e.status) {
      case 'wartet': titel = e.dateiname; text = t('row.waiting'); break;
      case 'laedt': titel = e.dateiname; text = t('row.uploading'); laeuft = true; break;
      case 'liest': titel = e.dateiname; text = schritt; laeuft = true; break;
      case 'legtAn': text = t('row.creating'); laeuft = true; break;
      case 'fehler':
        titel = e.dateiname; text = e.fehler || t('row.readFailed');
        aktion = <span className="flex gap-1.5">
          {(e.pdfPath || e.text) && <Button size="sm" variant="outline" className={klein} onClick={() => ablageNochmal(e.id)}>{t('row.retry')}</Button>}
          {e.fileInfo && <Button size="sm" variant="outline" className={klein} onClick={() => setPruefen({ eintrag: e, art: 'hand' })}>{t('row.manual')}</Button>}
        </span>;
        break;
      case 'unterbrochen':
        titel = e.dateiname; text = t('row.interrupted');
        aktion = <Button size="sm" variant="outline" className={klein} onClick={() => ablageNochmal(e.id)}>{t('row.readAgain')}</Button>;
        break;
      case 'angelegt':
        if (e.ergaenzt) {
          titel = <>{e.name || t('bar.candidate')} <span className="font-normal text-muted-foreground">{t('row.existed')}</span></>;
          text = [t('row.newCvInFile'),
            e.ergaenztAnzahl ? t('row.added', { count: e.ergaenztAnzahl }) : '',
            e.abweichungen ? t('row.differ', { count: e.abweichungen }) : '',
          ].filter(Boolean).join(' · ');
          aktion = e.abweichungen && e.cv
            ? <Button size="sm" variant="outline" className={klein} onClick={() => setPruefen({ eintrag: e, art: 'akte' })}>{t('row.viewDifference')}</Button>
            : null;
        } else {
          titel = <>{e.name || t('bar.candidate')} <span className="font-normal text-muted-foreground">{t('row.created')}</span></>;
          text = bescheid(e);
          aktion = e.kandidatId
            // Einladen (12.11.2026): Profil öffnen, Ablage einklappen, dort die Interview-Karte kurz zeigen.
            ? <Button size="sm" variant="outline" className={klein} onClick={() => { zuSetzen(true); navigate(`/recruiter/candidates/${e.kandidatId}?zeigen=einladen`); }}>{t('row.invite')}</Button>
            : null;
        }
        break;
    }
    // Angelegt: Klick auf den Namen öffnet das Profil (09.11.2026).
    const profil = e.status === 'angelegt' && e.kandidatId ? `/recruiter/candidates/${e.kandidatId}` : null;
    return (
      <li key={e.id} className="group flex items-center gap-2 border-b border-border/60 px-3 py-2 last:border-b-0">
        <div className="min-w-0 flex-1">
          {profil ? (
            <button type="button" title={t('bar.openProfile')} className="flex max-w-full items-center truncate text-left text-sm font-medium hover:underline hover:underline-offset-2" onClick={() => navigate(profil)}>
              <Check className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{titel}</span>
            </button>
          ) : (
            <p className="truncate text-sm font-medium">{titel}</p>
          )}
          <p className={cn('text-xs leading-snug', e.status === 'fehler' ? 'text-destructive' : 'text-muted-foreground', e.status !== 'angelegt' && 'truncate')}>{text}</p>
          {laeuft && <div className="mt-1.5 h-0.5 overflow-hidden rounded bg-muted"><div className="h-full w-1/3 animate-pulse rounded bg-foreground/70" /></div>}
        </div>
        {aktion}
        {!laeuft && (
          <button type="button" aria-label={t('bar.remove')} className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100" onClick={() => ablageEntfernen(e.id)}>
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </li>
    );
  };

  const aktuelle = wartenAufZustimmung[0] ?? null;

  return (
    <>
      {eintraege.length > 0 && (zu ? (
        <button
          type="button"
          ref={(el) => { ziehen.boxRef.current = el; }}
          style={ziehen.style}
          {...ziehen.griff}
          onClick={() => { if (!ziehen.gezogen.current) zuSetzen(false); }}
          title={t('bar.openDrag')}
          className="fixed z-40 flex touch-none select-none items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg"
        >
          <FileUp className="h-4 w-4" />
          {zahlen.laeuft ? t('bar.reading', { count: zahlen.laeuft }) : t('bar.title')}
          <ChevronUp className="h-4 w-4" />
        </button>
      ) : (
        <div
          ref={(el) => { ziehen.boxRef.current = el; }}
          style={ziehen.style}
          className={cn('fixed z-40 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-card shadow-lg', darueber && 'border-2 border-dashed border-foreground')}
          onDragEnter={(e) => { if (!hatDateien(e)) return; e.preventDefault(); tiefe.current += 1; setDarueber(true); }}
          onDragOver={(e) => { if (!hatDateien(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDragLeave={(e) => { if (!hatDateien(e)) return; tiefe.current = Math.max(0, tiefe.current - 1); if (tiefe.current === 0) setDarueber(false); }}
          onDrop={loslassen}
          role="region"
          aria-label={t('bar.region')}
        >
          <div {...ziehen.griff} title={t('bar.dragHint')}
            className="flex cursor-grab touch-none select-none items-center justify-between border-b px-3 py-2 active:cursor-grabbing">
            <p className="flex items-center gap-1.5 text-sm font-medium"><GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />{t('bar.titleCount', { n: zahlen.offen || eintraege.length })}</p>
            <button type="button" data-kein-griff className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={() => zuSetzen(true)}>
              {t('bar.collapse')} <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <ul className="max-h-[50vh] overflow-y-auto">{eintraege.map(zeile)}</ul>
          <button
            type="button"
            onClick={lebenslaufWaehlen}
            className="flex w-full items-center justify-center gap-1.5 border-t border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <FileUp className="h-3.5 w-3.5" />
            {darueber ? t('bar.dropHere') : t('bar.addMore')}
          </button>
        </div>
      ))}

      {/* Lebenslauf hochladen: drei Häkchen je Lebenslauf (12.11.2026) */}
      <LebenslaufHochladenFenster
        datei={aktuelle}
        nummer={runde.current - wartenAufZustimmung.length + 1}
        gesamt={runde.current}
        onHochladen={(o) => { ablageZustimmen(o); zuSetzen(false); }}
        onAbbrechen={ablageAbbrechen}
        onTauschen={ablageDateiTauschen}
      />

      <MustertextFenster vorname={muster} onClose={() => setMuster(null)} />
      <HinweisFenster hinweis={hinweisZeigen} onClose={() => setHinweisZeigen(null)} />

      {/* Abweichung ansehen oder von Hand anlegen: das bekannte Fenster mit dem schon gelesenen Ergebnis */}
      {pruefen && <Suspense fallback={null}><CvImportDialog
        open={!!pruefen}
        onOpenChange={(o) => { if (!o) setPruefen(null); }}
        ausAblage
        existingCandidateId={pruefen?.art === 'akte' ? pruefen.eintrag.dublette?.id ?? pruefen.eintrag.kandidatId : undefined}
        startResult={pruefen ? { cv: pruefen.art === 'hand' ? null : pruefen.eintrag.cv ?? null, fileInfo: pruefen.eintrag.fileInfo ?? null } : null}
        onCandidateCreated={(id, name) => {
          if (!pruefen) return;
          const ergaenzt = pruefen.art === 'akte';
          ablageAngelegt(pruefen.eintrag.id, id, name || pruefen.eintrag.name || pruefen.eintrag.dublette?.full_name, ergaenzt);
        }}
      /></Suspense>}
    </>
  );
}
