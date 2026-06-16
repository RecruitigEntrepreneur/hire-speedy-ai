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
  ChevronDown,
  Menu,
  ArrowRight,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { MatchuntLogo } from '@/components/ui/MatchuntLogo';
import { scrollToSection } from '@/lib/scroll';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavItem {
  labelKey: string;
  href?: string;
  items?: {
    nameKey: string;
    href: string;
    descKey?: string;
  }[];
}

const navigationItems: NavItem[] = [
  {
    labelKey: "nav.features",
    items: [
      { nameKey: "nav.features_items.matching", href: "/#engine", descKey: "nav.features_items.matching_desc" },
      { nameKey: "nav.features_items.interview", href: "/#how-it-works", descKey: "nav.features_items.interview_desc" },
      { nameKey: "nav.features_items.network", href: "/#for-recruiters", descKey: "nav.features_items.network_desc" },
      { nameKey: "nav.features_items.escrow", href: "/#pricing", descKey: "nav.features_items.escrow_desc" },
      { nameKey: "nav.features_items.compliance", href: "/#security", descKey: "nav.features_items.compliance_desc" },
      { nameKey: "nav.features_items.analytics", href: "/#analytics", descKey: "nav.features_items.analytics_desc" },
    ]
  },
  {
    labelKey: "nav.solutions",
    items: [
      { nameKey: "nav.solutions_items.companies", href: "/#for-companies", descKey: "nav.solutions_items.companies_desc" },
      { nameKey: "nav.solutions_items.recruiters", href: "/#for-recruiters", descKey: "nav.solutions_items.recruiters_desc" },
      { nameKey: "nav.solutions_items.smb", href: "/#pricing", descKey: "nav.solutions_items.smb_desc" },
      { nameKey: "nav.solutions_items.enterprise", href: "/contact", descKey: "nav.solutions_items.enterprise_desc" },
    ]
  },
  { labelKey: "nav.pricing", href: "/#pricing" },
  {
    labelKey: "nav.resources",
    items: [
      { nameKey: "nav.resources_items.blog", href: "/blog", descKey: "nav.resources_items.blog_desc" },
      { nameKey: "nav.resources_items.guides", href: "/guides", descKey: "nav.resources_items.guides_desc" },
      { nameKey: "nav.resources_items.faq", href: "/#faq", descKey: "nav.resources_items.faq_desc" },
      { nameKey: "nav.resources_items.help", href: "/help", descKey: "nav.resources_items.help_desc" },
      { nameKey: "nav.resources_items.docs", href: "/docs", descKey: "nav.resources_items.docs_desc" },
    ]
  },
  {
    labelKey: "nav.company",
    items: [
      { nameKey: "nav.company_items.about", href: "/about", descKey: "nav.company_items.about_desc" },
      { nameKey: "nav.company_items.careers", href: "/careers", descKey: "nav.company_items.careers_desc" },
      { nameKey: "nav.company_items.press", href: "/press", descKey: "nav.company_items.press_desc" },
      { nameKey: "nav.company_items.contact", href: "/contact", descKey: "nav.company_items.contact_desc" },
    ]
  },
];

export function Navbar() {
  const { user, role, signOut } = useAuth();
  const { t } = useTranslation();
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
        "sticky top-0 z-50 w-full transition-all duration-300 bg-background",
        isScrolled 
          ? "shadow-sm border-b border-border" 
          : "border-b border-transparent"
      )}
    >
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center group">
          <MatchuntWordmark size="md" />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-1">
          {navigationItems.map((item) => (
            <div key={item.labelKey} className="relative">
              {item.items ? (
                <div
                  className="relative"
                  onMouseEnter={() => setActiveDropdown(item.labelKey)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      activeDropdown === item.labelKey
                        ? "text-foreground bg-accent"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    {t(item.labelKey)}
                    <ChevronDown className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      activeDropdown === item.labelKey && "rotate-180"
                    )} />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === item.labelKey && (
                    <div className="absolute top-full left-0 pt-2 z-50">
                      <div className="bg-card rounded-xl border border-border shadow-lg p-2 min-w-[280px] animate-fade-in">
                        <div className="grid gap-1">
                          {item.items.map((subItem) => (
                            <Link
                              key={subItem.nameKey}
                              to={subItem.href.startsWith('/#') ? '#' : subItem.href}
                              onClick={(e) => handleNavClick(subItem.href, e)}
                              className="flex flex-col gap-0.5 p-3 rounded-lg hover:bg-accent transition-colors"
                            >
                              <p className="font-medium text-sm text-foreground">{t(subItem.nameKey)}</p>
                              {subItem.descKey && (
                                <p className="text-xs text-muted-foreground">{t(subItem.descKey)}</p>
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
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                >
                  {t(item.labelKey)}
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Right Side CTAs */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <LanguageSwitcher className="hidden md:inline-flex" />
              <Button variant="ghost" asChild className="hidden md:flex text-muted-foreground hover:text-foreground">
                <Link to={getDashboardLink()}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  {t('nav.dashboard')}
                </Link>
              </Button>

              <NotificationBell />
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{role}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={getDashboardLink()} className="cursor-pointer">
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      {t('nav.dashboard')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      {t('nav.settings')}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('nav.signOut')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              {/* Desktop CTAs */}
              <div className="hidden lg:flex items-center gap-3">
                <LanguageSwitcher />
                <Button variant="ghost" asChild className="text-muted-foreground hover:text-foreground">
                  <Link to="/auth">{t('nav.signIn')}</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth?mode=signup">
                    {t('nav.startNow')}
                    <ArrowRight className="ml-2 h-4 w-4" />
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
                      <MatchuntLogo size={32} />
                      <span>Matchunt.ai</span>
                    </SheetTitle>
                  </SheetHeader>
                  
                  <div className="flex flex-col h-[calc(100vh-80px)]">
                    <div className="flex-1 overflow-y-auto p-4">
                      <Accordion type="single" collapsible className="space-y-2">
                        {navigationItems.map((item) => (
                          item.items ? (
                            <AccordionItem key={item.labelKey} value={item.labelKey} className="border-none">
                              <AccordionTrigger className="px-4 py-3 rounded-lg hover:bg-accent hover:no-underline">
                                {t(item.labelKey)}
                              </AccordionTrigger>
                              <AccordionContent className="pb-0">
                                <div className="ml-4 space-y-1">
                                  {item.items.map((subItem) => (
                                    <Link
                                      key={subItem.nameKey}
                                      to={subItem.href.startsWith('/#') ? '#' : subItem.href}
                                      onClick={(e) => handleNavClick(subItem.href, e)}
                                      className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent transition-colors"
                                    >
                                      <span className="text-sm text-muted-foreground">{t(subItem.nameKey)}</span>
                                    </Link>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ) : (
                            <Link
                              key={item.labelKey}
                              to={item.href?.startsWith('/#') ? '#' : item.href || '/'}
                              onClick={(e) => item.href && handleNavClick(item.href, e)}
                              className="flex items-center px-4 py-3 rounded-lg hover:bg-accent transition-colors font-medium"
                            >
                              {t(item.labelKey)}
                            </Link>
                          )
                        ))}
                      </Accordion>
                    </div>

                    {/* Mobile CTAs */}
                    <div className="p-4 border-t border-border space-y-3">
                      <div className="flex justify-center pb-1">
                        <LanguageSwitcher />
                      </div>
                      <Button variant="outline" className="w-full" asChild>
                        <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                          {t('nav.signIn')}
                        </Link>
                      </Button>
                      <Button className="w-full" asChild>
                        <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                          {t('nav.startNow')}
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
