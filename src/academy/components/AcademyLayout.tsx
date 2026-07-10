import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

/** Wortmarke: editoriale Serif-„Matchunt" mit Gold-Eyebrow „Akademie". */
export function AcademyLogo() {
  return (
    <Link to="/" className="group flex items-baseline gap-2.5">
      <span className="font-display text-xl font-semibold tracking-tight text-[hsl(40_12%_94%)]">Matchunt</span>
      <span className="eyebrow translate-y-[-1px]">Akademie</span>
    </Link>
  );
}

export function AcademyLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-[hsl(40_30%_90%/0.08)] bg-[hsl(30_8%_5%/0.7)] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-5">
          <AcademyLogo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/#kurse" className="hidden px-3 py-2 text-sm text-[hsl(40_8%_70%)] transition-colors hover:text-[hsl(40_12%_94%)] sm:block">Kurse</Link>
            <a href="https://matchunt.de" className="hidden px-3 py-2 text-sm text-[hsl(40_8%_70%)] transition-colors hover:text-[hsl(40_12%_94%)] sm:block">Zur Plattform</a>
            {loading ? null : user ? (
              <Link to="/dashboard" className="btn-gold ml-1 px-4 py-2 text-sm">Mein Lernbereich</Link>
            ) : (
              <>
                <Link to="/auth" className="px-3 py-2 text-sm text-[hsl(40_8%_70%)] transition-colors hover:text-[hsl(40_12%_94%)]">Anmelden</Link>
                <Link to="/dashboard" className="btn-gold ml-1 px-4 py-2 text-sm">Kostenlos starten</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="mt-24 border-t border-[hsl(40_30%_90%/0.08)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-display text-lg">Matchunt <span className="text-gold italic-display">Akademie</span></div>
            <p className="mt-1 text-sm text-[hsl(40_8%_60%)]">Ausbildung für moderne Personalberatung — vom Lernen zum Verdienen.</p>
          </div>
          <div className="flex items-center gap-5 text-sm text-[hsl(40_8%_60%)]">
            <a href="https://matchunt.de/impressum" className="transition-colors hover:text-[hsl(40_12%_92%)]">Impressum</a>
            <a href="https://matchunt.de/datenschutz" className="transition-colors hover:text-[hsl(40_12%_92%)]">Datenschutz</a>
            <a href="https://matchunt.de/agb" className="transition-colors hover:text-[hsl(40_12%_92%)]">AGB</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
