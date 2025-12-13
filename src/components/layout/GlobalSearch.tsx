import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Briefcase, 
  Users, 
  Calendar, 
  FileText, 
  Settings,
  BarChart3,
  Plus
} from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'job' | 'candidate' | 'interview';
  title: string;
  subtitle?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

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

  // Search when query changes
  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !user) {
      setResults([]);
      return;
    }

    setLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search jobs
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, company_name')
        .eq('client_id', user.id)
        .ilike('title', `%${searchQuery}%`)
        .limit(5);

      if (jobs) {
        searchResults.push(...jobs.map(job => ({
          id: job.id,
          type: 'job' as const,
          title: job.title,
          subtitle: job.company_name || undefined,
        })));
      }

      // Search candidates via submissions
      const { data: submissions } = await supabase
        .from('submissions')
        .select(`
          id,
          candidates!inner (full_name, job_title),
          jobs!inner (client_id)
        `)
        .eq('jobs.client_id', user.id)
        .limit(5);

      if (submissions) {
        const filtered = submissions.filter((sub: any) => 
          sub.candidates?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        searchResults.push(...filtered.map((sub: any) => ({
          id: sub.id,
          type: 'candidate' as const,
          title: sub.candidates?.full_name || 'Kandidat',
          subtitle: sub.candidates?.job_title || undefined,
        })));
      }

      setResults(searchResults);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'job':
        navigate(`/dashboard/jobs/${result.id}`);
        break;
      case 'candidate':
        navigate(`/dashboard/candidates/${result.id}`);
        break;
      case 'interview':
        navigate('/dashboard/interviews');
        break;
    }
  };

  const quickActions = [
    { label: 'Neuen Job erstellen', icon: <Plus className="h-4 w-4" />, href: '/dashboard/jobs/new' },
    { label: 'Alle Jobs', icon: <Briefcase className="h-4 w-4" />, href: '/dashboard/jobs' },
    { label: 'Talent Hub', icon: <Users className="h-4 w-4" />, href: '/dashboard/talent' },
    { label: 'Interviews', icon: <Calendar className="h-4 w-4" />, href: '/dashboard/interviews' },
    { label: 'Analytics', icon: <BarChart3 className="h-4 w-4" />, href: '/dashboard/analytics' },
    { label: 'Einstellungen', icon: <Settings className="h-4 w-4" />, href: '/dashboard/settings' },
  ];

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-9 md:w-64 md:justify-start md:px-3 md:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline-flex text-muted-foreground">Suchen...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 md:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Jobs, Kandidaten oder Aktionen suchen..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? 'Suche...' : 'Keine Ergebnisse gefunden.'}
          </CommandEmpty>
          
          {results.length > 0 && (
            <>
              <CommandGroup heading="Suchergebnisse">
                {results.map((result) => (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="cursor-pointer"
                  >
                    {result.type === 'job' && <Briefcase className="mr-2 h-4 w-4 text-primary" />}
                    {result.type === 'candidate' && <Users className="mr-2 h-4 w-4 text-success" />}
                    {result.type === 'interview' && <Calendar className="mr-2 h-4 w-4 text-warning" />}
                    <div className="flex flex-col">
                      <span>{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Schnellaktionen">
            {quickActions.map((action) => (
              <CommandItem
                key={action.href}
                onSelect={() => {
                  setOpen(false);
                  navigate(action.href);
                }}
                className="cursor-pointer"
              >
                {action.icon}
                <span className="ml-2">{action.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
