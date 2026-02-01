import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  User,
  LogOut,
  Settings,
  LayoutDashboard,
  Briefcase,
  ChevronDown,
  Menu,
  ArrowRight,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { scrollToSection } from '@/lib/scroll';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href?: string;
  items?: {
    name: string;
    href: string;
    description?: string;
  }[];
}

const navigationItems: NavItem[] = [
  {
    label: "Features",
    items: [
      { name: "AI Matching Engine", href: "/#engine", description: "KI-gestützte Kandidatenauswahl" },
      { name: "Automated Interview Flow", href: "/#how-it-works", description: "Vollautomatisierte Prozesse" },
      { name: "Recruiter Network", href: "/#for-recruiters", description: "12.000+ verifizierte Recruiter" },
      { name: "Escrow & Payments", href: "/#pricing", description: "Sichere Zahlungsabwicklung" },
      { name: "Compliance & DSGVO", href: "/#security", description: "100% rechtssicher" },
      { name: "Analytics & Reporting", href: "/#analytics", description: "Echtzeit-Insights" },
    ]
  },
  {
    label: "Solutions",
    items: [
      { name: "Für Unternehmen", href: "/#for-companies", description: "Schneller die besten Talente finden" },
      { name: "Für Recruiter & Agenturen", href: "/#for-recruiters", description: "Höhere Provisionen, bessere Deals" },
      { name: "Für KMU & Startups", href: "/#pricing", description: "Erfolgsbasiert ohne Fixkosten" },
      { name: "Für Enterprise", href: "/contact", description: "Individuelle Lösungen auf Anfrage" },
    ]
  },
  { label: "Pricing", href: "/#pricing" },
  {
    label: "Resources",
    items: [
      { name: "Blog", href: "/blog", description: "Insights & Best Practices" },
      { name: "Guides", href: "/guides", description: "Step-by-Step Anleitungen" },
      { name: "FAQ", href: "/#faq", description: "Häufige Fragen" },
      { name: "Help Center", href: "/help", description: "Support & Hilfe" },
      { name: "Documentation", href: "/docs", description: "Technische Dokumentation" },
    ]
  },
  {
    label: "Company",
    items: [
      { name: "Über uns", href: "/about", description: "Unsere Mission & Team" },
      { name: "Karriere", href: "/careers", description: "Werde Teil des Teams" },
      { name: "Presse", href: "/press", description: "News & Media Kit" },
      { name: "Kontakt", href: "/contact", description: "Sprechen Sie mit uns" },
    ]
  },
];

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getDashboardLink = () => {
    switch (role) {
      case 'admin':
        return '/admin';
      case 'recruiter':
        return '/recruiter';
      case 'client':
      default:
        return '/dashboard';
    }
  };

  const handleNavClick = (href: string, e?: React.MouseEvent) => {
    if (href.startsWith('/#')) {
      e?.preventDefault();
      const sectionId = href.replace('/#', '');
      
      if (location.pathname !== '/') {
        navigate('/');
        setTimeout(() => scrollToSection(sectionId), 100);
      } else {
        scrollToSection(sectionId);
      }
    }
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  return (
    <nav 
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 bg-white",
        isScrolled 
          ? "shadow-sm border-b border-slate-200/60" 
          : "border-b border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald">
            <Briefcase className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900">Matchunt</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navigationItems.map((item) => (
            <div key={item.label} className="relative">
              {item.items ? (
                <div
                  className="relative"
                  onMouseEnter={() => setActiveDropdown(item.label)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      activeDropdown === item.label 
                        ? "text-slate-900 bg-slate-100" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      activeDropdown === item.label && "rotate-180"
                    )} />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === item.label && (
                    <div className="absolute top-full left-0 pt-2 z-50">
                      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-2 min-w-[280px] animate-fade-in">
                        <div className="grid gap-1">
                          {item.items.map((subItem) => (
                            <Link
                              key={subItem.name}
                              to={subItem.href.startsWith('/#') ? '#' : subItem.href}
                              onClick={(e) => handleNavClick(subItem.href, e)}
                              className="flex flex-col gap-0.5 p-3 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                              <p className="font-medium text-sm text-slate-900">{subItem.name}</p>
                              {subItem.description && (
                                <p className="text-xs text-slate-500">{subItem.description}</p>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={item.href?.startsWith('/#') ? '#' : item.href || '/'}
                  onClick={(e) => item.href && handleNavClick(item.href, e)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                >
                  {item.label}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Right Side CTAs */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              
              <Button variant="ghost" asChild className="hidden md:flex text-slate-600 hover:text-slate-900">
                <Link to={getDashboardLink()}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              
              <NotificationBell />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full border-slate-200">
                    <User className="h-4 w-4 text-slate-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-slate-900">{user.email}</p>
                    <p className="text-xs text-slate-500 capitalize">{role}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem asChild>
                    <Link to={getDashboardLink()} className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-100" />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {/* Desktop CTAs */}
              <div className="hidden lg:flex items-center gap-3">
                <Button variant="ghost" asChild className="text-slate-600 hover:text-slate-900">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild className="bg-emerald hover:bg-emerald-light text-white">
                  <Link to="/auth?mode=signup">
                    Start now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon" className="text-slate-600">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[400px] p-0 bg-white">
                  <SheetHeader className="p-6 border-b border-slate-100">
                    <SheetTitle className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald">
                        <Briefcase className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-slate-900">Matchunt</span>
                    </SheetTitle>
                  </SheetHeader>
                  
                  <div className="flex flex-col h-[calc(100vh-80px)]">
                    <div className="flex-1 overflow-y-auto p-4">
                      <Accordion type="single" collapsible className="space-y-2">
                        {navigationItems.map((item) => (
                          item.items ? (
                            <AccordionItem key={item.label} value={item.label} className="border-none">
                              <AccordionTrigger className="px-4 py-3 rounded-lg hover:bg-slate-50 hover:no-underline text-slate-900">
                                {item.label}
                              </AccordionTrigger>
                              <AccordionContent className="pb-0">
                                <div className="ml-4 space-y-1">
                                  {item.items.map((subItem) => (
                                    <Link
                                      key={subItem.name}
                                      to={subItem.href.startsWith('/#') ? '#' : subItem.href}
                                      onClick={(e) => handleNavClick(subItem.href, e)}
                                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      <span className="text-sm text-slate-700">{subItem.name}</span>
                                    </Link>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ) : (
                            <Link
                              key={item.label}
                              to={item.href?.startsWith('/#') ? '#' : item.href || '/'}
                              onClick={(e) => item.href && handleNavClick(item.href, e)}
                              className="flex items-center px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors font-medium text-slate-900"
                            >
                              {item.label}
                            </Link>
                          )
                        ))}
                      </Accordion>
                    </div>

                    {/* Mobile CTAs */}
                    <div className="p-4 border-t border-slate-100 space-y-3">
                      <Button variant="outline" className="w-full border-slate-200 text-slate-700" asChild>
                        <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                          Sign in
                        </Link>
                      </Button>
                      <Button className="w-full bg-emerald hover:bg-emerald-light text-white" asChild>
                        <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                          Start now
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}