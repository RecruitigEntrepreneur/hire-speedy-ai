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
  X,
  Brain,
  Calendar,
  Users,
  Shield,
  Lock,
  BarChart3,
  Building2,
  UserCheck,
  Rocket,
  Building,
  BookOpen,
  FileText,
  HelpCircle,
  LifeBuoy,
  Book,
  Info,
  Heart,
  Newspaper,
  Mail,
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
    icon?: React.ComponentType<{ className?: string }>;
    description?: string;
  }[];
}

const navigationItems: NavItem[] = [
  {
    label: "Features",
    items: [
      { name: "AI Matching Engine", href: "/#engine", icon: Brain, description: "KI-gestützte Kandidatenauswahl" },
      { name: "Automated Interview Flow", href: "/#how-it-works", icon: Calendar, description: "Vollautomatisierte Prozesse" },
      { name: "Recruiter Network", href: "/#for-recruiters", icon: Users, description: "12.000+ verifizierte Recruiter" },
      { name: "Escrow & Payments", href: "/#pricing", icon: Shield, description: "Sichere Zahlungsabwicklung" },
      { name: "Compliance & DSGVO", href: "/#security", icon: Lock, description: "100% rechtssicher" },
      { name: "Analytics & Reporting", href: "/#analytics", icon: BarChart3, description: "Echtzeit-Insights" },
    ]
  },
  {
    label: "Solutions",
    items: [
      { name: "Für Unternehmen", href: "/#for-companies", icon: Building2, description: "Schneller die besten Talente finden" },
      { name: "Für Recruiter & Agenturen", href: "/#for-recruiters", icon: UserCheck, description: "Höhere Provisionen, bessere Deals" },
      { name: "Für KMU & Startups", href: "/#pricing", icon: Rocket, description: "Erfolgsbasiert ohne Fixkosten" },
      { name: "Für Enterprise", href: "/contact", icon: Building, description: "Individuelle Lösungen auf Anfrage" },
    ]
  },
  { label: "Pricing", href: "/#pricing" },
  {
    label: "Resources",
    items: [
      { name: "Blog", href: "/blog", icon: BookOpen, description: "Insights & Best Practices" },
      { name: "Guides", href: "/guides", icon: FileText, description: "Step-by-Step Anleitungen" },
      { name: "FAQ", href: "/#faq", icon: HelpCircle, description: "Häufige Fragen" },
      { name: "Help Center", href: "/help", icon: LifeBuoy, description: "Support & Hilfe" },
      { name: "Documentation", href: "/docs", icon: Book, description: "Technische Dokumentation" },
    ]
  },
  {
    label: "Company",
    items: [
      { name: "Über uns", href: "/about", icon: Info, description: "Unsere Mission & Team" },
      { name: "Karriere", href: "/careers", icon: Heart, description: "Werde Teil des Teams" },
      { name: "Presse", href: "/press", icon: Newspaper, description: "News & Media Kit" },
      { name: "Sicherheit & Datenschutz", href: "/#security", icon: Shield, description: "Trust & Compliance" },
      { name: "Kontakt", href: "/contact", icon: Mail, description: "Sprechen Sie mit uns" },
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
        "sticky top-0 z-50 w-full transition-all duration-300",
        isScrolled 
          ? "bg-background/95 backdrop-blur-xl border-b border-border/40 shadow-sm" 
          : "bg-background/80 backdrop-blur-md border-b border-border/20"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald to-emerald-light shadow-lg shadow-emerald/20 group-hover:shadow-emerald/40 transition-shadow">
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">TalentBridge</span>
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
                        ? "text-foreground bg-accent" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    )}
                  >
                    {item.label}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      activeDropdown === item.label && "rotate-180"
                    )} />
                  </button>

                  {/* Mega Menu Dropdown */}
                  {activeDropdown === item.label && (
                    <div className="absolute top-full left-0 pt-2 z-50">
                      <div className="bg-card rounded-xl border border-border shadow-xl p-4 min-w-[320px] animate-fade-in">
                        <div className="grid gap-1">
                          {item.items.map((subItem) => (
                            <Link
                              key={subItem.name}
                              to={subItem.href.startsWith('/#') ? '#' : subItem.href}
                              onClick={(e) => handleNavClick(subItem.href, e)}
                              className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors group/item"
                            >
                              {subItem.icon && (
                                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald/10 flex items-center justify-center group-hover/item:bg-emerald/20 transition-colors">
                                  <subItem.icon className="w-5 h-5 text-emerald" />
                                </div>
                              )}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{subItem.name}</p>
                                {subItem.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{subItem.description}</p>
                                )}
                              </div>
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
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors"
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
              <Button variant="ghost" asChild className="hidden md:flex">
                <Link to={getDashboardLink()}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              
              <NotificationBell />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 animate-fade-in">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{role}</p>
                  </div>
                  <DropdownMenuSeparator />
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
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
                <Button variant="ghost" asChild>
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild className="bg-emerald hover:bg-emerald-light text-white shadow-lg shadow-emerald/20 group">
                  <Link to="/auth?mode=signup">
                    Start now
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </div>

              {/* Mobile Menu Button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="lg:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-full sm:w-[400px] p-0">
                  <SheetHeader className="p-6 border-b border-border">
                    <SheetTitle className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald to-emerald-light">
                        <Briefcase className="h-4 w-4 text-white" />
                      </div>
                      TalentBridge
                    </SheetTitle>
                  </SheetHeader>
                  
                  <div className="flex flex-col h-[calc(100vh-80px)]">
                    <div className="flex-1 overflow-y-auto p-4">
                      <Accordion type="single" collapsible className="space-y-2">
                        {navigationItems.map((item) => (
                          item.items ? (
                            <AccordionItem key={item.label} value={item.label} className="border-none">
                              <AccordionTrigger className="px-4 py-3 rounded-lg hover:bg-accent hover:no-underline">
                                {item.label}
                              </AccordionTrigger>
                              <AccordionContent className="pb-0">
                                <div className="ml-4 space-y-1">
                                  {item.items.map((subItem) => (
                                    <Link
                                      key={subItem.name}
                                      to={subItem.href.startsWith('/#') ? '#' : subItem.href}
                                      onClick={(e) => handleNavClick(subItem.href, e)}
                                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                                    >
                                      {subItem.icon && (
                                        <subItem.icon className="w-5 h-5 text-emerald" />
                                      )}
                                      <span className="text-sm">{subItem.name}</span>
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
                              className="flex items-center px-4 py-3 rounded-lg hover:bg-accent transition-colors font-medium"
                            >
                              {item.label}
                            </Link>
                          )
                        ))}
                      </Accordion>
                    </div>

                    {/* Mobile CTAs */}
                    <div className="p-4 border-t border-border space-y-3">
                      <Button variant="outline" className="w-full" asChild>
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
