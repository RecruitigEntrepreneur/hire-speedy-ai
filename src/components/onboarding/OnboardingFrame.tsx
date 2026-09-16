import type { ReactNode } from 'react';
import { Check, LockKeyhole, ShieldCheck } from 'lucide-react';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import './onboarding.css';

export default function OnboardingFrame({ stage, title, description, email, accountAction, children }: { stage: number; title: string; description: string; email?: string; accountAction?: ReactNode; children: ReactNode }) {
  return <div className="mh-ui mh-onboarding">
    <header className="mh-header"><div className="mh-actions"><a href="/" className="mh-brand" aria-label="Matchunt.ai – Startseite"><MatchuntWordmark size="md"/></a><span className="mh-header-tag">DEIN START ALS RECRUITING-PARTNER</span></div><div className="mh-header-account">{email ? <span title={email}>{email}</span> : <span><LockKeyhole size={12} className="inline mr-1"/>Persönliche Einladung</span>}{accountAction}<ThemeToggle/></div></header>
    <main className="mh-main">
      <ol className="mh-steps" aria-label="Dein Onboarding">{['E-Mail bestätigen', 'Deine Angaben', 'Dein Vertrag', 'Prüfung & Freigabe'].map((label, i) => <li key={label} aria-current={stage === i ? 'step' : undefined} className={i < stage ? 'mh-done' : ''}><span>{i < stage ? <Check size={14}/> : i + 1}</span><span>{label}</span></li>)}</ol>
      <header className="mh-hero"><p className="mh-kicker">GUTE ZUSAMMENARBEIT BEGINNT HIER</p><h1>{title}</h1><p className="mh-lead">{description}</p></header>
      <div className="mh-client-grid"><div className="mh-stack">{children}</div><aside className="mh-context"><MatchuntLogo size={36}/><h3>Dein Weg ins Netzwerk.</h3><ol><li><strong>Kurz bestätigen</strong><p>Ein Code an deine E-Mail-Adresse, kein Passwort. Vorbereitete Einladungsdaten werden übernommen.</p></li><li><strong>Alles an einem Ort</strong><p>Ergänze deine Angaben. Daraus entsteht dein persönlicher Rahmenvertrag mit sechs Anlagen.</p></li><li><strong>Digital unterschreiben</strong><p>Prüfe dein vollständiges Vertragspaket und unterschreibe mit DocuSign.</p></li><li><strong>Gemeinsam starten</strong><p>Matchunt prüft, zeichnet gegen und schaltet frei. Danach bekommst du eine Mail und richtest deinen Zugang ein.</p></li></ol><div className="mh-divider"/><p className="mh-muted" style={{ fontSize: 11 }}><ShieldCheck size={15} className="inline mr-1"/>Deine Unterschrift ersetzt nicht die Gegenzeichnung durch Matchunt.</p></aside></div>
      <footer className="mh-footer"><span>Matchunt · Dein Recruiting-Netzwerk</span><div><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></div></footer>
    </main>
  </div>;
}
