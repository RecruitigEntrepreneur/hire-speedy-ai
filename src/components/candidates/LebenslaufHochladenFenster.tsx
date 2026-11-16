import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Copy, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { cn } from '@/lib/utils';
import { vornameAusDatei } from '@/lib/vornameAusDatei';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { hinweisTexte } from '../../../supabase/functions/_shared/lebenslauf-hinweis';

/** Mail und Mustertext in der Sprache, in der auch der Kandidat sie bekommt (die des Headhunters). */
const texte = () => hinweisTexte(i18n.language);

/**
 * Lebenslauf hochladen (12.11.2026, so mit Marko abgestimmt): ein Lebenslauf je Fenster,
 * drei Häkchen, beim mittleren der Schalter für den Hinweis von Matchunt. Hochladen geht
 * erst, wenn alle drei gesetzt sind; gespeichert wird die Bestätigung nach dem Anlegen.
 */

const HINWEIS_KEY = 'matchunt.ablage.hinweis';
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';

const hinweisGemerkt = () => { try { return localStorage.getItem(HINWEIS_KEY) !== '0'; } catch { return true; } };

function dateiArt(f: File) {
  const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
  const art = ext === 'pdf' ? 'PDF' : ext === 'doc' || ext === 'docx' ? 'Word' : ext.toUpperCase() || i18n.t('candidateAblage:file');
  const mb = new Intl.NumberFormat(intlLocale(i18n.language), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const groesse = f.size >= 1024 * 1024 ? `${mb.format(f.size / 1024 / 1024)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`;
  return `${art} · ${groesse}`;
}

function Haken({ an }: { an: boolean }) {
  return (
    <span aria-hidden className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-colors',
      an ? 'border-foreground bg-foreground text-background' : 'border-muted-foreground/70')}>
      {an && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

function Karte({ an, onClick, titel, text, children }: { an: boolean; onClick: () => void; titel: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className={cn('rounded-xl border transition-colors', an ? 'border-foreground/40' : 'border-border hover:border-foreground/25')}>
      <button type="button" role="checkbox" aria-checked={an} onClick={onClick} className="flex w-full items-start gap-3 p-3.5 text-left">
        <Haken an={an} />
        <span className="min-w-0">
          <span className="block text-[15px] font-medium leading-snug">{titel}</span>
          {text && <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{text}</span>}
        </span>
      </button>
      {children}
    </div>
  );
}

const Verweis = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
  <button type="button" onClick={onClick} className="text-foreground underline decoration-muted-foreground/60 underline-offset-[3px] hover:decoration-foreground">{children}</button>
);

/** Die Hinweis-Mail, wie sie ankommt (immer hell). Ohne Vornamen: „Hallo,“. */
function HinweisMail({ vorname, hhName }: { vorname: string | null; hhName: string }) {
  const { t } = useTranslation('candidateAblage');
  const m = texte();
  return (
    <div className="rounded-xl border bg-white p-4 text-[13.5px] leading-relaxed text-neutral-900">
      <div className="mb-3 border-b border-neutral-200 pb-2.5 text-xs leading-relaxed text-neutral-500">
        {t('mail.from')} <span className="font-medium text-neutral-900">Matchunt</span> · {t('mail.repliesTo', { name: hhName })}<br />
        {t('mail.subject')} <span className="font-medium text-neutral-900">{m.betreff(hhName)}</span>
      </div>
      <p>{vorname ? m.hallo(vorname) : m.halloOhneName}</p>
      <p className="mt-2">{m.einleitung(hhName)}</p>
      <p className="mt-2">{m.wasHeisst}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{m.punkte.map((p) => <li key={p}>{p}</li>)}</ul>
      <p className="mt-2">{m.fragen}</p>
      <p className="mt-3 border-t border-neutral-200 pt-2.5 text-xs text-neutral-500">
        {m.nichtGewollt} <span className="underline">{m.loeschen}</span> · <span className="underline">{m.datenschutz}</span>
      </p>
    </div>
  );
}

/** Aus der Ablage: der Hinweis, der an den Kandidaten ging (12.11.2026, „ansehen“). */
export function HinweisFenster({ hinweis, onClose }: { hinweis: { vorname: string; am: string; test: boolean } | null; onClose: () => void }) {
  const { t } = useTranslation('candidateAblage');
  const kontakt = useRecruiterKontakt();
  const hhName = (kontakt?.name ?? '').trim() || t('yourName');
  return (
    <Dialog open={!!hinweis} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t('notice.title', { name: hinweis?.vorname ?? '' })}</DialogTitle>
          <DialogDescription>
            {hinweis?.test ? t('notice.test') : t('notice.sent', { time: hinweis?.am ?? '' })}
          </DialogDescription>
        </DialogHeader>
        {hinweis && <HinweisMail vorname={hinweis.vorname} hhName={hhName} />}
        <div className="flex justify-end"><Button onClick={onClose}>{t('close')}</Button></div>
      </DialogContent>
    </Dialog>
  );
}

/** Mustertext mit Kopieren; im Fenster und aus der Ablage. */
export function MustertextInhalt({ fuss }: { fuss?: ReactNode }) {
  const { t } = useTranslation('candidateAblage');
  const [kopiert, setKopiert] = useState(false);
  const kopieren = async () => {
    try { await navigator.clipboard.writeText(texte().muster); setKopiert(true); } catch { toast.error(t('sample.copyFailed')); }
  };
  return (
    <>
      <p className="select-text rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">{texte().muster}</p>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => void kopieren()} className="gap-1.5">
          {kopiert ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{kopiert ? t('sample.copied') : t('sample.copy')}
        </Button>
        {fuss}
      </div>
    </>
  );
}

/** Mustertext aus der Ablage: „sag du es ihm“. */
export function MustertextFenster({ vorname, onClose }: { vorname: string | null; onClose: () => void }) {
  const { t } = useTranslation('candidateAblage');
  return (
    <Dialog open={vorname !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vorname ? t('sample.titleFor', { name: vorname }) : t('sampleText')}</DialogTitle>
          <DialogDescription>{t('sample.description')}</DialogDescription>
        </DialogHeader>
        <MustertextInhalt fuss={<Button onClick={onClose}>{t('close')}</Button>} />
      </DialogContent>
    </Dialog>
  );
}

export function LebenslaufHochladenFenster({ datei, nummer, gesamt, onHochladen, onAbbrechen, onTauschen }: {
  datei: File | null;
  nummer: number;
  gesamt: number;
  onHochladen: (o: { hinweis: boolean }) => void;
  onAbbrechen: () => void;
  /** „Andere Datei“: liefert den Grund, wenn die Datei nicht geht. */
  onTauschen: (f: File) => string | null;
}) {
  const { t } = useTranslation('candidateAblage');
  const kontakt = useRecruiterKontakt();
  const hhName = (kontakt?.name ?? '').trim() || t('yourName');
  const [haken, setHaken] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [hinweis, setHinweis] = useState(hinweisGemerkt);
  const [ansicht, setAnsicht] = useState<'form' | 'hinweis' | 'muster'>('form');
  const [mahnen, setMahnen] = useState(false);
  const wahl = useRef<HTMLInputElement>(null);

  // Beim Schließen ist die Datei schon weg; bis das Fenster zu ist, die letzte zeigen.
  const zuletzt = useRef<File | null>(null);
  if (datei) zuletzt.current = datei;
  const f = datei ?? zuletzt.current;
  // Noch nicht gelesen: Vorname für die Vorschau nur aus dem Dateinamen, wenn er eindeutig ist.
  const vornameVorschau = f ? vornameAusDatei(f.name) : null;

  // Neuer oder getauschter Lebenslauf: Häkchen neu setzen, sie gelten je Lebenslauf.
  useEffect(() => { setHaken([false, false, false]); setAnsicht('form'); setMahnen(false); }, [datei]);

  const alle = haken.every(Boolean);
  const offen = haken.filter((x) => !x).length;
  const umschalten = (i: 0 | 1 | 2) => setHaken((h) => { const n = [...h] as typeof h; n[i] = !n[i]; return n; });
  const hinweisSetzen = (an: boolean) => { setHinweis(an); try { localStorage.setItem(HINWEIS_KEY, an ? '1' : '0'); } catch { /* egal */ } };

  const hochladen = () => {
    if (!alle) { setMahnen(true); return; }
    onHochladen({ hinweis });
  };

  const zurueck = (
    <button type="button" onClick={() => setAnsicht('form')} className="mb-1 inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />{t('back')}
    </button>
  );

  return (
    <Dialog open={!!datei} onOpenChange={(o) => { if (!o) onAbbrechen(); }}>
      {/* Kein Fokus-Rahmen auf „Andere Datei“ beim Öffnen: der Blick gehört den Häkchen. */}
      <DialogContent className="max-h-[92vh] overflow-y-auto focus:outline-none sm:max-w-[520px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        {ansicht === 'hinweis' ? (
          <>
            {zurueck}
            <DialogHeader>
              <DialogTitle>{t('upload.previewTitle')}</DialogTitle>
              <DialogDescription>
                {vornameVorschau ? t('upload.previewFromFile') : t('upload.previewNoName')}
              </DialogDescription>
            </DialogHeader>
            <HinweisMail vorname={vornameVorschau} hhName={hhName} />
            <div className="flex justify-end"><Button onClick={() => setAnsicht('form')}>{t('back')}</Button></div>
          </>
        ) : ansicht === 'muster' ? (
          <>
            {zurueck}
            <DialogHeader>
              <DialogTitle>{t('sampleText')}</DialogTitle>
              <DialogDescription>{t('sample.description')}</DialogDescription>
            </DialogHeader>
            <MustertextInhalt fuss={<Button onClick={() => setAnsicht('form')}>{t('back')}</Button>} />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{t('upload.title')}</DialogTitle>
              <DialogDescription className="text-sm leading-relaxed">
                {t('upload.description')}
                {gesamt > 1 && <span className="mt-1 block">{t('upload.nOfTotal', { n: nummer, total: gesamt })}</span>}
              </DialogDescription>
            </DialogHeader>

            {f && (
              <div className="flex items-center gap-3 rounded-xl border p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><FileText className="h-[18px] w-[18px] text-muted-foreground" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{dateiArt(f)}</p>
                </div>
                <button type="button" onClick={() => wahl.current?.click()} className="shrink-0 text-sm underline decoration-muted-foreground/60 underline-offset-[3px] hover:decoration-foreground">{t('upload.otherFile')}</button>
                <input ref={wahl} type="file" accept={ACCEPT} className="hidden" onChange={(e) => {
                  const neu = e.target.files?.[0];
                  e.target.value = '';
                  if (!neu) return;
                  const grund = onTauschen(neu);
                  if (grund) toast.error(`${neu.name}: ${grund}`);
                }} />
              </div>
            )}

            <div className="space-y-2.5">
              <Karte an={haken[0]} onClick={() => umschalten(0)} titel={t('upload.rightTitle')} text={t('upload.rightText')} />
              <Karte an={haken[1]} onClick={() => umschalten(1)} titel={t('upload.tellTitle')}>
                <div className="flex items-start gap-3 px-3.5 pb-3.5 pl-[46px]">
                  <Switch checked={hinweis} onCheckedChange={hinweisSetzen} aria-label={t('upload.noticeSwitch')} className="mt-0.5 shrink-0" />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="text-foreground/90">{t('upload.matchuntSends')}</span> · <Verweis onClick={() => setAnsicht('hinweis')}>{t('view')}</Verweis>
                  </p>
                </div>
                {!hinweis && (
                  <p className="px-3.5 pb-3.5 pl-[46px] text-sm leading-relaxed text-muted-foreground">
                    {t('upload.tellYourself')} <Verweis onClick={() => setAnsicht('muster')}>{t('sampleText')}</Verweis>
                  </p>
                )}
              </Karte>
              <Karte an={haken[2]} onClick={() => umschalten(2)} titel={t('upload.consentTitle')} text={t('upload.consentText')} />
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <span className="flex-1 text-xs leading-tight text-muted-foreground">{t('upload.savedWithDate')}</span>
              <Button variant="outline" onClick={onAbbrechen}>{t('upload.cancel')}</Button>
              <Button onClick={hochladen} aria-disabled={!alle} className={cn(!alle && 'cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted')}>{t('upload.submit')}</Button>
            </div>
            {mahnen && !alle && <p className="-mt-2 text-right text-xs text-muted-foreground">{t('upload.ticksLeft', { count: offen })}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
