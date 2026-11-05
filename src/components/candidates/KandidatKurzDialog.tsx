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
import { emptyDossier } from '@/lib/cvImport';
import { findDuplicate, saveNewCandidateManual } from '@/hooks/useCvImport';

// Dieselben Zusagen wie beim Lebenslauf-Import; die dritte passt, weil hier nichts ausgelesen wird.
const ZUSAGEN = [
  'Eine gültige Rechtsgrundlage für die Verarbeitung liegt vor (z. B. Einwilligung, Bewerbung oder berechtigtes Interesse nach Art. 6 DSGVO).',
  'Der Kandidat wurde bzw. wird über die Verarbeitung seiner Daten informiert.',
  'Ich erfasse nur bewerbungsrelevante Angaben.',
];

/**
 * „Ohne Lebenslauf anlegen“ (04.11.2026): nur Name und E-Mail, den Lebenslauf fragt der
 * Headhunter beim Einladen an. „Anlegen und einladen“ öffnet im Profil gleich die Einladung.
 */
export function KandidatKurzDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
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
    if (!vorname.trim() || !nachname.trim()) { setFehler({ feld: 'name', text: 'Bitte Vor- und Nachname eintragen.' }); return; }
    if (!isValidEmail(email)) { setFehler({ feld: 'email', text: 'Bitte eine gültige E-Mail eintragen.' }); return; }
    setSpeichert(einladen ? 'einladen' : 'anlegen');
    try {
      const id = await saveNewCandidateManual({ userId: user.id, form: form() });
      toast.success('Kandidat angelegt');
      onOpenChange(false);
      navigate(`/recruiter/candidates/${id}${einladen ? '?einladen=1' : ''}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      setSpeichert(null);
    }
  };

  const alleZusagen = zusagen.every(Boolean);
  const fehlerBei = (feld: 'name' | 'email') => fehler?.feld === feld && <p className="text-xs text-destructive">{fehler.text}</p>;

  return (
    <Dialog open={open} onOpenChange={(o) => !speichert && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Kandidat</DialogTitle>
          <DialogDescription>Ohne Lebenslauf. Den fragst du gleich beim Einladen an.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void anlegen(true); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="k-vorname">Vorname</Label><Input id="k-vorname" autoComplete="off" value={vorname} onChange={(e) => { setVorname(e.target.value); setFehler(null); }} onBlur={pruefeDublette} /></div>
            <div className="space-y-1"><Label htmlFor="k-nachname">Nachname</Label><Input id="k-nachname" autoComplete="off" value={nachname} onChange={(e) => { setNachname(e.target.value); setFehler(null); }} onBlur={pruefeDublette} /></div>
          </div>
          {fehlerBei('name')}
          <div className="space-y-1"><Label htmlFor="k-email">E-Mail</Label><Input id="k-email" type="email" autoComplete="off" value={email} onChange={(e) => { setEmail(e.target.value); setFehler(null); }} onBlur={pruefeDublette} />{fehlerBei('email')}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label htmlFor="k-tel">Telefon <span className="font-normal text-muted-foreground">· optional</span></Label><Input id="k-tel" type="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="k-linkedin">LinkedIn-Profil <span className="font-normal text-muted-foreground">· optional</span></Label><Input id="k-linkedin" autoComplete="off" placeholder="linkedin.com/in/…" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} /></div>
          </div>
          {dublette && (
            <p className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
              <span className="flex-1">
                {dublette.reason === 'name' ? `„${dublette.full_name}“ gibt es in deinen Kandidaten schon.` : `Diese E-Mail gehört schon zu „${dublette.full_name}“.`}
              </span>
              <button type="button" className="text-primary hover:underline" onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${dublette.id}`); }}>Öffnen</button>
            </p>
          )}
          <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs">
            {ZUSAGEN.map((label, i) => (
              <label key={label} className="flex cursor-pointer items-start gap-2">
                <Checkbox className="mt-0.5" checked={zusagen[i]} onCheckedChange={(v) => setZusagen((z) => z.map((x, j) => (j === i ? v === true : x)))} />
                <span>{label}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button type="button" variant="outline" disabled={!alleZusagen || !!speichert} onClick={() => void anlegen(false)}>
              {speichert === 'anlegen' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Anlegen
            </Button>
            <Button type="submit" disabled={!alleZusagen || !!speichert}>
              {speichert === 'einladen' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Anlegen und einladen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
