import { Link } from "react-router-dom";

const footerLinks = {
  unternehmen: [
    { label: "Für Unternehmen", href: "/auth?mode=signup&role=client" },
    { label: "Pricing", href: "#pricing" },
    { label: "Enterprise", href: "/contact" },
  ],
  recruiter: [
    { label: "Für Recruiter", href: "/auth?mode=signup&role=recruiter" },
    { label: "Guides", href: "/guides" },
    { label: "Help Center", href: "/help" },
  ],
  plattform: [
    { label: "Features", href: "#features" },
    { label: "Sicherheit", href: "#security" },
    { label: "Dokumentation", href: "/docs" },
  ],
  unternehmenInfo: [
    { label: "Über uns", href: "/about" },
    { label: "Karriere", href: "/careers" },
    { label: "Presse", href: "/press" },
    { label: "Kontakt", href: "/contact" },
  ],
};

export const FooterSection = () => {
  return (
    <footer className="py-16 bg-card text-foreground border-t border-border">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
                <span className="text-background font-bold text-sm">M</span>
              </div>
              <span className="text-xl font-bold">Matchunt</span>
            </Link>
            <p className="text-muted-foreground text-sm leading-relaxed">
              The Recruiting Operating System.
              Powered by AI. Delivered by Experts.
              Engineered for Results.
            </p>
          </div>

          {Object.entries({ Unternehmen: footerLinks.unternehmen, Recruiter: footerLinks.recruiter, Plattform: footerLinks.plattform, Info: footerLinks.unternehmenInfo }).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold mb-4 text-foreground">{title}</h4>
              <ul className="space-y-2">
                {links.map((link, index) => (
                  <li key={index}>
                    {link.href.startsWith("#") ? (
                      <a href={link.href} className="text-muted-foreground hover:text-foreground transition-colors text-sm">{link.label}</a>
                    ) : (
                      <Link to={link.href} className="text-muted-foreground hover:text-foreground transition-colors text-sm">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Matchunt - eine Marke der bluewater & Bridge GmbH. Alle Rechte vorbehalten.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/datenschutz" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Datenschutz</Link>
            <Link to="/agb" className="text-muted-foreground hover:text-foreground transition-colors text-sm">AGB</Link>
            <Link to="/impressum" className="text-muted-foreground hover:text-foreground transition-colors text-sm">Impressum</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
