import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { HeadhunterSuche } from './HeadhunterSuche';
import { KundenSuche } from './KundenSuche';
import { normal } from '@/lib/headhunterSuche';
import { 
  Search, 
  Briefcase, 
  Users, 
  Calendar, 
  Settings,
  BarChart3,
  Plus
} from 'lucide-react';

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { user, role } = useAuth();
  const navigate = useNavigate();
  // Headhunter: eigene Suche (Kandidaten, Stellen), siehe HeadhunterSuche (16.11.2026)
  const istHeadhunter = role === 'recruiter';
  // Kunde: Stellen der Firma + alle Bewerber, siehe KundenSuche (17.11.2026)
  const istKunde = role === 'client';

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const waehle = (pfad: string) => { setOpen(false); setQuery(''); navigate(pfad); };

  const { t } = useTranslation('common');
  const quickActions = [
    { label: t('search.newJob'), icon: <Plus className="h-4 w-4" />, href: '/dashboard/jobs/new' },
    { label: t('search.allJobs'), icon: <Briefcase className="h-4 w-4" />, href: '/dashboard/jobs' },
    { label: t('search.applicants'), icon: <Users className="h-4 w-4" />, href: '/dashboard/candidates' },
    { label: t('search.interviews'), icon: <Calendar className="h-4 w-4" />, href: '/dashboard/interviews' },
    { label: t('search.analytics'), icon: <BarChart3 className="h-4 w-4" />, href: '/dashboard/analytics' },
    { label: t('search.settings'), icon: <Settings className="h-4 w-4" />, href: '/dashboard/settings' },
  ];

  const schnellwege = quickActions.filter((a) => !query.trim() || normal(a.label).includes(normal(query.trim())));

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 md:w-64 md:justify-start md:px-3 md:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex text-muted-foreground">{t('search.open')}</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Am Handy oben statt mittig, damit die Tastatur die Treffer nicht verdeckt.
          Gefiltert wird in HeadhunterSuche / KundenSuche selbst, nicht von cmdk. */}
      <CommandDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setQuery(''); }}
        shouldFilter={false}
        contentClassName="max-md:top-3 max-md:translate-y-0"
      >
        <CommandInput 
          placeholder={istHeadhunter ? t('search.hhPh') : t('search.cPh')} 
          value={query}
          onValueChange={setQuery}
        />
        {istHeadhunter && user ? (
          <HeadhunterSuche
            userId={user.id}
            offen={open}
            query={query}
            onWaehle={waehle}
          />
        ) : (
        <CommandList className="max-h-[min(420px,calc(100svh-9rem))]">
          {istKunde && user && <KundenSuche userId={user.id} query={query} onWaehle={waehle} />}
          {!istKunde && query.trim() && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">{t('search.none', { q: query.trim() })}</p>
          )}

          {/* Am Handy ein Hinweis, am Desktop die Schnellwege wie bisher (beim Tippen gefiltert) */}
          {!query.trim() && <p className="px-4 py-6 text-center text-sm text-muted-foreground md:hidden">{t('search.cHint')}</p>}
          {schnellwege.length > 0 && (
            <>
              <CommandGroup heading={t('search.quick')} className="hidden md:block">
                {schnellwege.map((action) => (
                  <CommandItem
                    key={action.href}
                    value={action.href}
                    onSelect={() => waehle(action.href)}
                    className={cn('cursor-pointer', action.href === '/dashboard/jobs/new' && 'text-klick')}
                  >
                    {action.icon}
                    <span className="ml-2">{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
        )}
      </CommandDialog>
    </>
  );
}
