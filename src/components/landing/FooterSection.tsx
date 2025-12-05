import { Link } from "react-router-dom";

const footerLinks = {
  unternehmen: [
    { label: "Für Unternehmen", href: "/auth?tab=register&role=client" },
    { label: "Pricing", href: "#pricing" },
    { label: "Case Studies", href: "#case-studies" },
    { label: "Enterprise", href: "/auth" },
  ],
  recruiter: [
    { label: "Für Recruiter", href: "/auth?tab=register&role=recruiter" },
    { label: "Marketplace", href: "/auth" },
    { label: "Ressourcen", href: "/auth" },
    { label: "Community", href: "/auth" },
  ],
  plattform: [
    { label: "Features", href: "#features" },
    { label: "Integrationen", href: "#features" },
    { label: "Sicherheit", href: "#security" },
    { label: "API", href: "/auth" },
  ],
  unternehmenInfo: [
    { label: "Über uns", href: "/auth" },
    { label: "Karriere", href: "/auth" },
    { label: "Presse", href: "/auth" },
    { label: "Kontakt", href: "/auth" },
  ],
};

export const FooterSection = () => {
  return (
    <footer className="py-16 bg-primary text-primary-foreground border-t border-primary-foreground/10">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="text-2xl font-bold mb-4 block">
              talent<span className="text-emerald">bridge</span>
            </Link>
            <p className="text-primary-foreground/60 text-sm leading-relaxed">
              The Recruiting Operating System. 
              Powered by AI. Delivered by Experts. 
              Engineered for Results.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Unternehmen</h4>
            <ul className="space-y-2">
              {footerLinks.unternehmen.map((link, index) => (
                <li key={index}>
                  <Link 
                    to={link.href} 
                    className="text-primary-foreground/60 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Recruiter</h4>
            <ul className="space-y-2">
              {footerLinks.recruiter.map((link, index) => (
                <li key={index}>
                  <Link 
                    to={link.href} 
                    className="text-primary-foreground/60 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Plattform</h4>
            <ul className="space-y-2">
              {footerLinks.plattform.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-primary-foreground/60 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Unternehmen</h4>
            <ul className="space-y-2">
              {footerLinks.unternehmenInfo.map((link, index) => (
                <li key={index}>
                  <Link 
                    to={link.href} 
                    className="text-primary-foreground/60 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-primary-foreground/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-primary-foreground/40 text-sm">
            © {new Date().getFullYear()} talentbridge. Alle Rechte vorbehalten.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-primary-foreground/40 hover:text-primary-foreground/60 transition-colors text-sm">
              Datenschutz
            </Link>
            <Link to="/auth" className="text-primary-foreground/40 hover:text-primary-foreground/60 transition-colors text-sm">
              AGB
            </Link>
            <Link to="/auth" className="text-primary-foreground/40 hover:text-primary-foreground/60 transition-colors text-sm">
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
