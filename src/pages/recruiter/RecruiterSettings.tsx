import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Loader2, Palette, Plane, Plug, Shield, ShieldCheck, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { SettingsBlock, SettingsSubpage } from '@/components/client/settings/SettingsShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { PASSWORD_SET_KEY } from '@/lib/recruiterLogin';
import { useTheme } from '@/hooks/useTheme';
import { useConsent } from '@/hooks/useConsent';
import { setHonorarVerdeckt, useHonorarVerdeckt } from '@/lib/honorarVerdeckt';
import { ANSICHT_EVENT, schrift as leseSchrift, setSchrift, setWenigerBewegung, wenigerBewegung as leseBewegung, type Schrift } from '@/lib/ansicht';
import { useTerminseite } from '@/components/recruiter/termin/useTerminseite';
import { normalizeRules } from '@/lib/interviewScheduling';
import { cn } from '@/lib/utils';

/**
 * Einstellungen für Headhunter (16.11.2026, Stufe 1 aus der Recherche „die besten 15“).
 * Regel: Einstellungen = wie Matchunt für dich arbeitet. Was andere über dich sehen und was du
 * mit Matchunt vereinbart hast, steht im Profil; nichts steht doppelt. Sprache und Zeitzone kommen
 * mit dem Live-Stand (Mehrsprachigkeit), Mail-Auswahl und Zusammenfassung mit Stufe 2.
 */
type Bereich = 'konto' | 'abwesenheit' | 'benachrichtigungen' | 'darstellung' | 'datenschutz';
type Kachel = { key: Bereich | 'anbindungen'; icon: LucideIcon; title: string; text: string; status: string; bald?: boolean };

const DATENSCHUTZ_MAIL = 'datenschutz@bluewater-bridge.de';
const datum = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric' });
const heute = () => new Date().toISOString().slice(0, 10);
// Tag „JJJJ-MM-TT“ in der Schreibweise der Sprache (Deutsch: TT.MM.JJJJ)
const tagDe = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

function Zeile({ titel, text, children }: { titel: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0 text-sm">
        <p>{titel}</p>
        {text && <p className="text-xs text-muted-foreground">{text}</p>}
      </div>
      {children}
    </div>
  );
}

/** Konto und Sicherheit: Passwort festlegen/ändern, überall abmelden. */
function KontoBereich({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation(['recruiterSettings', 'recruiterFunnel']);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gesetztAm, setGesetztAm] = useState<string | null>(() => (user?.user_metadata?.[PASSWORD_SET_KEY] as string | undefined) ?? null);
  const [form, setForm] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [fehler, setFehler] = useState('');
  const [busy, setBusy] = useState(false);
  const [abmelden, setAbmelden] = useState(false);

  const speichern = async () => {
    if (pw.length < 8) { setFehler(t('recruiterFunnel:login.min8')); return; }
    if (pw !== pw2) { setFehler(t('recruiterFunnel:common.passwordMismatch')); return; }
    setBusy(true);
    const jetzt = new Date().toISOString();
    const data = { [PASSWORD_SET_KEY]: jetzt };
    let { error } = await supabase.auth.updateUser({ password: pw, data });
    // Dasselbe Passwort wie bisher: nur den Merker setzen
    if (error?.code === 'same_password') ({ error } = await supabase.auth.updateUser({ data }));
    setBusy(false);
    if (error) {
      setFehler(error.code === 'weak_password' ? t('recruiterFunnel:login.weakPassword') : t('recruiterFunnel:login.passwordNotSaved'));
      return;
    }
    setGesetztAm(jetzt);
    setForm(false); setPw(''); setPw2('');
    toast.success(t('konto.saved'));
  };

  const ueberallAbmelden = async () => {
    setBusy(true);
    await supabase.auth.signOut({ scope: 'global' });
    navigate('/recruiter/login', { replace: true });
  };

  return (
    <SettingsSubpage title={t('konto.title')} description={t('konto.description')} onBack={onBack}>
      <SettingsBlock title={t('konto.signInBlock')}>
        <div className="flex h-10 items-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-sm text-muted-foreground">{user?.email}</div>
        <Zeile titel={t('konto.signIn')} text={gesetztAm ? t('konto.signInBoth') : t('konto.signInCode')} />
        {!form ? (
          <Zeile titel={t('konto.password')} text={gesetztAm ? t('konto.passwordSetOn', { date: datum(gesetztAm) }) : t('konto.passwordNone')}>
            <Button variant="outline" size="sm" onClick={() => { setForm(true); setFehler(''); }}>{gesetztAm ? t('konto.change') : t('konto.setPassword')}</Button>
          </Zeile>
        ) : (
          <form className="space-y-2 pt-1" onSubmit={(e) => { e.preventDefault(); void speichern(); }}>
            <p className="text-sm font-medium">{gesetztAm ? t('konto.changePassword') : t('konto.setPassword')}</p>
            <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
            <Input type="password" autoComplete="new-password" placeholder={t('konto.newPasswordPh')} value={pw} onChange={(e) => { setPw(e.target.value); setFehler(''); }} />
            <Input type="password" autoComplete="new-password" placeholder={t('recruiterFunnel:login.repeat')} value={pw2} onChange={(e) => { setPw2(e.target.value); setFehler(''); }} />
            {fehler && <p className="text-sm text-destructive">{fehler}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={busy}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{t('save')}</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setForm(false); setPw(''); setPw2(''); setFehler(''); }}>{t('cancel')}</Button>
            </div>
          </form>
        )}
      </SettingsBlock>

      <SettingsBlock title={t('konto.devices')}>
        {!abmelden ? (
          <Zeile titel={t('konto.signOutAll')} text={t('konto.signOutAllText')}>
            <Button variant="outline" size="sm" onClick={() => setAbmelden(true)}>{t('konto.signOutAllButton')}</Button>
          </Zeile>
        ) : (
          <div className="space-y-2 text-sm">
            <p>{t('konto.signOutAllConfirm')}</p>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void ueberallAbmelden()}>{busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{t('konto.signOutAllButton')}</Button>
              <Button variant="ghost" size="sm" onClick={() => setAbmelden(false)}>{t('cancel')}</Button>
            </div>
          </div>
        )}
      </SettingsBlock>

      <p className="text-sm text-muted-foreground">
        <Trans t={t} i18nKey="konto.profileHint" components={{ link: <Link to="/recruiter/profile/ueber-dich" className="underline underline-offset-2 hover:text-foreground" /> }} />
      </p>
    </SettingsSubpage>
  );
}

/** Abwesenheit: gilt für die Terminseite (Regeln der eigenen Terminseite, ohne Datenbank-Änderung). */
function AbwesenheitBereich({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('recruiterSettings');
  const { zeile, isLoading, speichern } = useTerminseite();
  const [von, setVon] = useState('');
  const [bis, setBis] = useState('');
  const [fehler, setFehler] = useState('');
  const regeln = normalizeRules(zeile?.rules ?? {});
  const liste = regeln.absences.filter((a) => a.to >= heute());

  const sichern = (absences: { from: string; to: string }[]) => {
    if (!zeile) return;
    const { recruiter_id: _rid, ...rest } = zeile;
    speichern.mutate({ ...rest, rules: { ...regeln, absences } }, {
      onError: (e) => toast.error(e instanceof Error ? e.message : t('abwesenheit.saveFailed')),
    });
  };
  const eintragen = () => {
    if (!von || !bis) { setFehler(t('abwesenheit.errPick')); return; }
    if (bis < von) { setFehler(t('abwesenheit.errOrder')); return; }
    if (bis < heute()) { setFehler(t('abwesenheit.errPast')); return; }
    sichern([...regeln.absences, { from: von, to: bis }].sort((x, y) => x.from.localeCompare(y.from)));
    setVon(''); setBis(''); setFehler('');
  };

  return (
    <SettingsSubpage title={t('abwesenheit.title')} description={t('abwesenheit.description')} saveState={speichern.isPending ? 'saving' : speichern.isSuccess ? 'saved' : 'idle'} onBack={onBack}>
      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</p>
      ) : !zeile ? (
        <SettingsBlock title={t('abwesenheit.noPage')}>
          <p className="text-sm">{t('abwesenheit.noPageText')}</p>
          <Button variant="outline" size="sm" asChild><Link to="/recruiter/profile/terminseite">{t('abwesenheit.setupPage')}</Link></Button>
        </SettingsBlock>
      ) : (
        <>
          <SettingsBlock title={t('abwesenheit.entered')}>
            {liste.length === 0 && <p className="text-sm text-muted-foreground">{t('abwesenheit.none')}</p>}
            {liste.map((a) => (
              <Zeile key={`${a.from}-${a.to}`} titel={a.from === a.to ? tagDe(a.from) : t('range', { from: tagDe(a.from), to: tagDe(a.to) })}>
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => sichern(regeln.absences.filter((x) => !(x.from === a.from && x.to === a.to)))}>{t('abwesenheit.remove')}</Button>
              </Zeile>
            ))}
          </SettingsBlock>
          <SettingsBlock title={t('abwesenheit.add')}>
            <div className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs text-muted-foreground">{t('abwesenheit.firstDay')}<Input type="date" min={heute()} value={von} onChange={(e) => { setVon(e.target.value); setFehler(''); }} className="w-40" /></label>
              <label className="space-y-1 text-xs text-muted-foreground">{t('abwesenheit.lastDay')}<Input type="date" min={von || heute()} value={bis} onChange={(e) => { setBis(e.target.value); setFehler(''); }} className="w-40" /></label>
              <Button size="sm" onClick={eintragen} disabled={speichern.isPending}>{t('abwesenheit.enter')}</Button>
            </div>
            {fehler && <p className="text-sm text-destructive">{fehler}</p>}
            <p className="text-xs text-muted-foreground">{t('abwesenheit.note')}</p>
          </SettingsBlock>
        </>
      )}
    </SettingsSubpage>
  );
}

function DarstellungBereich({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('recruiterSettings');
  const { theme, setTheme } = useTheme();
  const verdeckt = useHonorarVerdeckt();
  const [s, setS] = useState<Schrift>(leseSchrift);
  const [bewegung, setBewegung] = useState(leseBewegung);
  useEffect(() => {
    const sync = () => { setS(leseSchrift()); setBewegung(leseBewegung()); };
    window.addEventListener(ANSICHT_EVENT, sync);
    return () => window.removeEventListener(ANSICHT_EVENT, sync);
  }, []);
  const knopf = (aktiv: boolean) => cn('px-4 py-1.5 text-sm', aktiv ? 'bg-primary text-primary-foreground' : 'hover:bg-muted');
  return (
    <SettingsSubpage title={t('darstellung.title')} description={t('darstellung.description')} onBack={onBack}>
      <SettingsBlock title={t('darstellung.color')}>
        <div className="flex w-fit overflow-hidden rounded-lg border border-border">
          {(['light', 'dark'] as const).map((m) => <button key={m} type="button" onClick={() => setTheme(m)} className={knopf(theme === m)}>{m === 'light' ? t('darstellung.light') : t('darstellung.dark')}</button>)}
        </div>
        <p className="text-xs text-muted-foreground">{t('darstellung.colorHint')}</p>
      </SettingsBlock>
      <SettingsBlock title={t('darstellung.font')}>
        <div className="flex w-fit overflow-hidden rounded-lg border border-border">
          {([['klein', 'small'], ['normal', 'normal'], ['gross', 'large']] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setSchrift(k)} className={knopf(s === k)}>{t(`darstellung.${l}`)}</button>)}
        </div>
        <p className="text-sm text-muted-foreground">{t('darstellung.fontSample')}</p>
      </SettingsBlock>
      <SettingsBlock title={t('darstellung.calm')}>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{t('darstellung.lessMotion')}<span className="block text-xs text-muted-foreground">{t('darstellung.lessMotionText')}</span></span>
          <Switch aria-label={t('darstellung.lessMotion')} checked={bewegung} onCheckedChange={(v) => setWenigerBewegung(v)} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{t('darstellung.hideAmounts')}<span className="block text-xs text-muted-foreground">{t('darstellung.hideAmountsText')}</span></span>
          <Switch aria-label={t('darstellung.hideAmounts')} checked={verdeckt} onCheckedChange={(v) => setHonorarVerdeckt(v)} />
        </label>
      </SettingsBlock>
    </SettingsSubpage>
  );
}

function DatenschutzBereich({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('recruiterSettings');
  const { user } = useAuth();
  const { consents, updateConsent } = useConsent();
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const [exportLink, setExportLink] = useState<string | null>(null);
  const [exportFehler, setExportFehler] = useState('');
  // Datenschutzerklärung: Datum nur, wenn eine Bestätigung gespeichert ist
  const erklaerung = useQuery({
    queryKey: ['einwilligung-datenschutz', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('consents').select('granted_at, created_at')
        .eq('subject_id', user!.id).eq('consent_type', 'privacy_policy').eq('granted', true)
        .order('created_at', { ascending: false }).limit(1);
      const z = (data as { granted_at: string | null; created_at: string }[] | null)?.[0];
      return z ? (z.granted_at ?? z.created_at) : null;
    },
  });
  const exportieren = async () => {
    setExportLaeuft(true); setExportFehler('');
    const { data, error } = await supabase.functions.invoke('gdpr-export');
    setExportLaeuft(false);
    const link = (data as { download_url?: string } | null)?.download_url;
    if (error || !link) { setExportFehler(t('datenschutz.exportFailed')); return; }
    setExportLink(link);
  };
  return (
    <SettingsSubpage title={t('datenschutz.title')} description={t('datenschutz.description')} onBack={onBack}>
      <SettingsBlock title={t('datenschutz.consents')}>
        <Zeile titel={t('datenschutz.necessary')} text={t('datenschutz.necessaryText')}><span className="text-xs text-muted-foreground">{t('datenschutz.alwaysOn')}</span></Zeile>
        <Zeile titel={t('datenschutz.analytics')} text={t('datenschutz.analyticsText')}><Switch aria-label={t('datenschutz.analytics')} checked={consents.analytics} onCheckedChange={(v) => void updateConsent('analytics', v)} /></Zeile>
        <Zeile titel={t('datenschutz.marketing')}><Switch aria-label={t('datenschutz.marketing')} checked={consents.marketing} onCheckedChange={(v) => void updateConsent('marketing', v)} /></Zeile>
        <Zeile titel={t('datenschutz.policy')} text={erklaerung.data ? t('datenschutz.policyAccepted', { date: datum(erklaerung.data) }) : undefined}>
          <a href="/datenschutz" target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">{t('datenschutz.read')}</a>
        </Zeile>
      </SettingsBlock>
      <SettingsBlock title={t('datenschutz.yourData')}>
        {exportLink ? (
          <Zeile titel={t('datenschutz.exportReady')} text={t('datenschutz.exportValid')}>
            <Button variant="outline" size="sm" asChild><a href={exportLink} target="_blank" rel="noreferrer">{t('datenschutz.download')}</a></Button>
          </Zeile>
        ) : (
          <Zeile titel={t('datenschutz.exportAll')} text={t('datenschutz.exportAllText')}>
            <Button variant="outline" size="sm" disabled={exportLaeuft} onClick={() => void exportieren()}>{exportLaeuft && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}{t('datenschutz.requestExport')}</Button>
          </Zeile>
        )}
        {exportFehler && <p className="text-sm text-destructive">{exportFehler}</p>}
      </SettingsBlock>
      <SettingsBlock title={t('datenschutz.deleteBlock')}>
        <Zeile titel={t('datenschutz.deleteTitle')} text={t('datenschutz.deleteText')}>
          <Button variant="outline" size="sm" asChild><a href={`mailto:${DATENSCHUTZ_MAIL}?subject=${encodeURIComponent(t('datenschutz.deleteSubject'))}`}>{t('datenschutz.requestByMail')}</a></Button>
        </Zeile>
      </SettingsBlock>
    </SettingsSubpage>
  );
}

function BenachrichtigungenBereich({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation('recruiterSettings');
  return (
    <SettingsSubpage title={t('benachrichtigungen.title')} description={t('benachrichtigungen.description')} onBack={onBack}>
      <SettingsBlock title={t('benachrichtigungen.inApp')}>
        <Zeile titel={t('benachrichtigungen.bell')} text={t('benachrichtigungen.bellText')} />
        <Zeile titel={t('benachrichtigungen.inbox')} text={t('benachrichtigungen.inboxText')} />
      </SettingsBlock>
      <SettingsBlock title={t('benachrichtigungen.byMail')}>
        <p className="text-sm">{t('benachrichtigungen.mailText')}</p>
        <p className="text-sm text-muted-foreground"><Trans t={t} i18nKey="benachrichtigungen.mailLater" components={{ link: <Link to="/recruiter/profile/partnerstatus" className="underline underline-offset-2 hover:text-foreground" /> }} /></p>
      </SettingsBlock>
    </SettingsSubpage>
  );
}

export default function RecruiterSettings() {
  const { t } = useTranslation('recruiterSettings');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const { theme } = useTheme();
  const verdeckt = useHonorarVerdeckt();
  const { zeile } = useTerminseite();
  const bereich = params.get('bereich') as Bereich | null;
  const oeffne = (b: Bereich | null) => {
    const next = new URLSearchParams(params);
    if (b) next.set('bereich', b); else next.delete('bereich');
    setParams(next);
  };
  const zurueck = () => oeffne(null);

  const naechsteAbwesenheit = normalizeRules(zeile?.rules ?? {}).absences.filter((a) => a.to >= heute())[0];
  const gruppen: [string, Kachel[]][] = [
    [t('groups.account'), [
      { key: 'konto', icon: ShieldCheck, title: t('tiles.konto.title'), text: t('tiles.konto.text'), status: user?.user_metadata?.[PASSWORD_SET_KEY] ? t('tiles.konto.statusPassword') : t('tiles.konto.statusCode') },
    ]],
    [t('groups.work'), [
      { key: 'abwesenheit', icon: Plane, title: t('tiles.abwesenheit.title'), text: t('tiles.abwesenheit.text'), status: naechsteAbwesenheit ? t('range', { from: tagDe(naechsteAbwesenheit.from), to: tagDe(naechsteAbwesenheit.to) }) : t('tiles.abwesenheit.statusNone') },
      { key: 'benachrichtigungen', icon: Bell, title: t('tiles.benachrichtigungen.title'), text: t('tiles.benachrichtigungen.text'), status: t('tiles.benachrichtigungen.status') },
      // Anbindungen (16.11.2026): noch ausgegraut, bis die ersten CRMs wirklich verbinden.
      { key: 'anbindungen', icon: Plug, title: t('tiles.anbindungen.title'), text: t('tiles.anbindungen.text'), status: t('tiles.anbindungen.status'), bald: true },
    ]],
    [t('groups.view'), [
      { key: 'darstellung', icon: Palette, title: t('tiles.darstellung.title'), text: t('tiles.darstellung.text'), status: t(verdeckt ? 'tiles.darstellung.statusHidden' : 'tiles.darstellung.statusVisible', { theme: theme === 'light' ? t('darstellung.light') : t('darstellung.dark') }) },
      { key: 'datenschutz', icon: Shield, title: t('tiles.datenschutz.title'), text: t('tiles.datenschutz.text'), status: t('tiles.datenschutz.status') },
    ]],
  ];

  let inhalt;
  if (bereich === 'konto') inhalt = <KontoBereich onBack={zurueck} />;
  else if (bereich === 'abwesenheit') inhalt = <AbwesenheitBereich onBack={zurueck} />;
  else if (bereich === 'benachrichtigungen') inhalt = <BenachrichtigungenBereich onBack={zurueck} />;
  else if (bereich === 'darstellung') inhalt = <DarstellungBereich onBack={zurueck} />;
  else if (bereich === 'datenschutz') inhalt = <DatenschutzBereich onBack={zurueck} />;
  else {
    inhalt = (
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('lead')}</p>
        </div>
        {gruppen.map(([titel, kacheln]) => (
          <section key={titel} className="space-y-2">
            <h2 className="text-sm font-medium">{titel}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {kacheln.map(({ key, icon: Icon, title, text, status, bald }) => bald ? (
                <div key={key} aria-disabled="true" className="rounded-xl border border-dashed border-border p-4 text-left opacity-60">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{t('soon')}</span>
                  </div>
                  <p className="mt-3 text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
                  <p className="mt-3 truncate text-xs text-muted-foreground">{status}</p>
                </div>
              ) : (
                <button
                  key={key}
                  type="button"
                  onClick={() => oeffne(key as Bereich)}
                  className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-3 text-sm font-medium">{title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
                  <p className="mt-3 truncate text-xs text-muted-foreground">{status}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return <DashboardLayout>{inhalt}</DashboardLayout>;
}
