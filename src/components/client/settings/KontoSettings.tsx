import { useTranslation } from 'react-i18next';
import { LanguageSelect } from '@/components/language/LanguageSelect';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { SettingsBlock, SettingsSubpage } from './SettingsShell';
import type { SaveState } from './useCompanyProfile';

type Persoenlich = { full_name: string; role_title: string; phone: string };
/** Heute abschaltbar: nur die Interview-Mitteilungen (siehe _shared/client-mail-prefs.ts). */
type NotificationPrefs = { interview_updates: boolean };
const DEFAULT_PREFS: NotificationPrefs = { interview_updates: true };

// Neue Tabelle (Migration 20261009120000), im generierten Supabase-Typ noch nicht enthalten.
type Antwort = { data: unknown; error: { message: string } | null };
type PrefsTable = {
  select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<Antwort> } };
  upsert: (v: unknown, o: { onConflict: string }) => PromiseLike<Antwort>;
};
const prefsTable = () => (supabase as unknown as { from: (t: string) => PrefsTable }).from('client_notification_preferences');

/** Unterseite „Mein Konto“: persönliche Angaben, Passwort, Benachrichtigungen per E-Mail. Gilt nur für diese Person. */
export function KontoSettings({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation(['clientSettings', 'common']);
  const { user } = useAuth();
  const { toast } = useToast();
  const [p, setP] = useState<Persoenlich>({ full_name: '', role_title: '', phone: '' });
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [prefsReady, setPrefsReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [pwOpen, setPwOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const latest = useRef(p);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: prof }, prefRes] = await Promise.all([
        supabase.from('profiles').select('full_name, role_title, phone').eq('user_id', user.id).maybeSingle(),
        prefsTable().select('*').eq('user_id', user.id).maybeSingle(),
      ]);
      const stand = { full_name: prof?.full_name ?? '', role_title: prof?.role_title ?? '', phone: prof?.phone ?? '' };
      setP(stand);
      latest.current = stand;
      // Tabelle fehlt live noch (Migration nicht eingespielt): Schalter zeigen, aber nicht speichern.
      if (prefRes.error && !/no rows/i.test(prefRes.error.message)) setPrefsReady(false);
      if (prefRes.data) setPrefs({ interview_updates: (prefRes.data as Partial<NotificationPrefs>).interview_updates !== false });
      setLoading(false);
    })();
  }, [user]);

  const savePersoenlich = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({
      full_name: latest.current.full_name.trim() || null,
      role_title: latest.current.role_title.trim() || null,
      phone: latest.current.phone.trim() || null,
    }).eq('user_id', user.id);
    setSaveState(error ? 'error' : 'saved');
  }, [user]);

  const change = (patch: Partial<Persoenlich>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setP(next);
    setSaveState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void savePersoenlich(), 800);
  };

  useEffect(() => () => { if (timer.current) { window.clearTimeout(timer.current); void savePersoenlich(); } }, [savePersoenlich]);

  const setPref = async (patch: Partial<NotificationPrefs>) => {
    if (!user) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (!prefsReady) return;
    setSaveState('saving');
    const { error } = await prefsTable()
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() } as never, { onConflict: 'user_id' });
    setSaveState(error ? 'error' : 'saved');
  };

  if (loading) {
    return <SettingsSubpage title={t('konto.title')} description={t('konto.description')} onBack={onBack}><div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div></SettingsSubpage>;
  }

  return (
    <SettingsSubpage title={t('konto.title')} description={t('konto.description')} saveState={saveState} onBack={onBack}>
      <SettingsBlock title={t('konto.aboutYou')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="full_name">{t('konto.name')}</Label><Input id="full_name" value={p.full_name} onChange={(e) => change({ full_name: e.target.value })} placeholder={t('konto.namePh')} /></div>
          <div className="space-y-2"><Label htmlFor="role_title">{t('konto.role')}</Label><Input id="role_title" value={p.role_title} onChange={(e) => change({ role_title: e.target.value })} placeholder={t('konto.rolePh')} /></div>
          <div className="space-y-2"><Label htmlFor="phone">{t('konto.phone')}</Label><Input id="phone" value={p.phone} onChange={(e) => change({ phone: e.target.value })} placeholder={t('konto.phonePh')} /></div>
        </div>
        <div className="space-y-2">
          <Label>{t('konto.loginEmail')}</Label>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-dashed border-border bg-muted/30 px-3 text-sm text-muted-foreground">{user?.email}</div>
            <Button variant="outline" onClick={() => setPwOpen(true)}>{t('konto.changePassword')}</Button>
          </div>
        </div>
      </SettingsBlock>

      <SettingsBlock title={t('common:language.label')}>
        <LanguageSelect className="max-w-xs" />
        <p className="text-xs text-muted-foreground">{t('common:language.settingsHintClient')}</p>
      </SettingsBlock>

      <SettingsBlock title={t('konto.mailTitle')}>
        <div className="flex items-start justify-between gap-4">
          <Label htmlFor="interview_updates" className="font-normal leading-6">
            {t('konto.interviewUpdates')}
            <span className="block text-xs text-muted-foreground">{t('konto.interviewUpdatesHint')}</span>
          </Label>
          <Switch id="interview_updates" checked={prefs.interview_updates} onCheckedChange={(v) => void setPref({ interview_updates: v })} />
        </div>
        <p className="text-xs text-muted-foreground">
          {prefsReady
            ? t('konto.mailNote')
            : t('konto.mailPending')}
        </p>
      </SettingsBlock>

      <Link to="/dashboard/privacy" className="flex items-center justify-between rounded-xl border border-border bg-card p-5 text-sm hover:bg-muted/40">
        <span><span className="font-medium">{t('konto.privacy')}</span><span className="block text-xs text-muted-foreground">{t('konto.privacyHint')}</span></span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <PasswortDialog open={pwOpen} onOpenChange={setPwOpen} onDone={() => toast({ title: t('konto.pw.changed') })} />
    </SettingsSubpage>
  );
}

function PasswortDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }) {
  const { t } = useTranslation('clientSettings');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState('');
  const zuKurz = pw.length > 0 && pw.length < 10;
  const ungleich = pw2.length > 0 && pw !== pw2;

  const submit = async () => {
    if (pw.length < 10 || pw !== pw2) return;
    setBusy(true);
    setFehler('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setFehler(error.message.includes('same') ? t('konto.pw.same') : t('konto.pw.failed')); return; }
    setPw(''); setPw2('');
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{t('konto.changePassword')}</DialogTitle><DialogDescription>{t('konto.pw.min')}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5"><Label htmlFor="pw">{t('konto.pw.new')}</Label><Input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />{zuKurz && <p className="text-xs text-destructive">{t('konto.pw.tooShort')}</p>}</div>
          <div className="space-y-1.5"><Label htmlFor="pw2">{t('konto.pw.repeat')}</Label><Input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submit()} />{ungleich && <p className="text-xs text-destructive">{t('konto.pw.mismatch')}</p>}</div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={() => void submit()} disabled={busy || pw.length < 10 || pw !== pw2}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{t('save.button')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
