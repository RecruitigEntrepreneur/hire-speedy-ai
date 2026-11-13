import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isValidEmail } from '@/lib/candidateDossier';
import { useTranslation } from 'react-i18next';
import { emptyDossier } from '@/lib/cvImport';
import { findDuplicate, saveNewCandidateManual } from '@/hooks/useCvImport';

// Dieselben Zusagen wie beim Lebenslauf-Import; die dritte passt, weil hier nichts ausgelesen wird.
// Texte: candidates:quick.consentLegalBasis / consentInformed / consentRelevant
const ZUSAGEN = ['quick.consentLegalBasis', 'quick.consentInformed', 'quick.consentRelevant'] as const;

/**
 * „Ohne Lebenslauf anlegen“ (04.11.2026): nur Name und E-Mail, den Lebenslauf fragt der
 * Headhunter beim Einladen an. „Anlegen und einladen“ öffnet im Profil gleich die Einladung.
 */
export function KandidatKurzDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const { t } = useTranslation('candidates');
  const navigate = useNavigate();
  const [vorname, setVorname] = useState('');
  const [nachname, setNachname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [zusagen, setZusagen] = useState([false, false, false]);
  const [dublette, setDublette] = useState<{ id: string; full_name: string; reason: 'name' | 'email' } | null>(null);
  const [fehler, setFehler] = useState<{ feld: 'name' | 'email'; text: string } | null>(null);
  const [speichert, setSpeichert] = useState<'anlegen' | 'einladen' | null>(null);

  useEffect(() => {
    if (open) return;
    setVorname(''); setNachname(''); setEmail(''); setPhone(''); setLinkedin('');
    setZusagen([false, false, false]); setDublette(null); setFehler(null); setSpeichert(null);
  }, [open]);

  const fullName = `${vorname.trim()} ${nachname.trim()}`.trim();
  const form = () => ({ ...emptyDossier(), full_name: fullName, email: email.trim(), phone: phone.trim(), linkedin_url: linkedin.trim() });

  // Gibt es die Person schon? Nur ein Hinweis mit Link, er sperrt nicht.
  const pruefeDublette = async () => {
    if (!user || (!fullName && !email.trim())) { setDublette(null); return; }
    setDublette(await findDuplicate(user.id, form()));
  };

  const anlegen = async (einladen: boolean) => {
    if (!user) return;
    if (!vorname.trim() || !nachname.trim()) { setFehler({ feld: 'name', text: t('quick.nameRequired') }); return; }
    if (!isValidEmail(email)) { setFehler({ feld: 'email', text: t('quick.emailInvalid') }); return; }
    setSpeichert(einladen ? 'einladen' : 'anlegen');
    try {
      const id = await saveNewCandidateManual({ userId: user.id, form: form() });
      toast.success(t('quick.created'));
      onOpenChange(false);
      navigate(`/recruiter/candidates/${id}${einladen ? '?einladen=1' : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('quick.saveFailed'));
      setSpeichert(null);
    }
  };

  const alleZusagen = zusagen.every(Boolean);
  const fehlerBei = (feld: 'name' | 'email') => fehler?.feld === feld && <p className="text-xs text-destructive">{fehler.text}</p>;

  return (
    <Dialog open={open} onOpenChange={(o) => !speichert && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('quick.title')}</DialogTitle>
          <DialogDescription>{t('quick.description')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void anlegen(true); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="k-vorname">{t('quick.firstName')}</Label><Input id="k-vorname" autoComplete="off" value={vorname} onChange={(e) => { setVorname(e.target.value); setFehler(null); }} onBlur={pruefeDublette} /></div>
            <div className="space-y-1"><Label htmlFor="k-nachname">{t('quick.lastName')}</Label><Input id="k-nachname" autoComplete="off" value={nachname} onChange={(e) => { setNachname(e.target.value); setFehler(null); }} onBlur={pruefeDublette} /></div>
          </div>
          {fehlerBei('name')}
          <div className="space-y-1"><Label htmlFor="k-email">{t('quick.email')}</Label><Input id="k-email" type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setFehler(null); }} onBlur={pruefeDublette} />{fehlerBei('email')}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="k-tel">{t('quick.phone')} <span className="font-normal text-muted-foreground">{t('quick.optional')}</span></Label><Input id="k-tel" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="k-linkedin">{t('quick.linkedin')} <span className="font-normal text-muted-foreground">{t('quick.optional')}</span></Label><Input id="k-linkedin" autoComplete="off" placeholder="linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} /></div>
          </div>
          {dublette && (
            <p className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
              <span className="flex-1">
                {dublette.reason === 'name' ? t('quick.duplicateName', { name: dublette.full_name }) : t('quick.duplicateEmail', { name: dublette.full_name })}
              </span>
              <button type="button" className="text-primary hover:underline" onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${dublette.id}`); }}>{t('quick.open')}</button>
            </p>
          )}
          <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs">
            {ZUSAGEN.map((key, i) => (
              <label key={key} className="flex cursor-pointer items-start gap-2">
                <Checkbox className="mt-0.5" checked={zusagen[i]} onCheckedChange={(v) => setZusagen((z) => z.map((x, j) => (j === i ? v === true : x)))} />
                <span>{t(key)}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={!alleZusagen || !!speichert} onClick={() => void anlegen(false)}>
              {speichert === 'anlegen' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('quick.create')}
            </Button>
            <Button type="submit" disabled={!alleZusagen || !!speichert}>
              {speichert === 'einladen' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('quick.createAndInvite')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
