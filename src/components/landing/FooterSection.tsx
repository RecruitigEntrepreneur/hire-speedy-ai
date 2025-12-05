import { Link } from "react-router-dom";
import { Briefcase } from "lucide-react";

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
    <footer className="py-16 bg-slate-900 text-white border-t border-slate-800">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">TalentBridge</span>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed">
              The Recruiting Operating System. 
              Powered by AI. Delivered by Experts. 
              Engineered for Results.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Unternehmen</h4>
            <ul className="space-y-2">
              {footerLinks.unternehmen.map((link, index) => (
                <li key={index}>
                  <Link 
                    to={link.href} 
                    className="text-slate-400 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-white">Recruiter</h4>
            <ul className="space-y-2">
              {footerLinks.recruiter.map((link, index) => (
                <li key={index}>
                  <Link 
                    to={link.href} 
                    className="text-slate-400 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-white">Plattform</h4>
            <ul className="space-y-2">
              {footerLinks.plattform.map((link, index) => (
                <li key={index}>
                  <a 
                    href={link.href} 
                    className="text-slate-400 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-white">Unternehmen</h4>
            <ul className="space-y-2">
              {footerLinks.unternehmenInfo.map((link, index) => (
                <li key={index}>
                  <Link 
                    to={link.href} 
                    className="text-slate-400 hover:text-emerald transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} TalentBridge. Alle Rechte vorbehalten.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/auth" className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
              Datenschutz
            </Link>
            <Link to="/auth" className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
              AGB
            </Link>
            <Link to="/auth" className="text-slate-500 hover:text-slate-300 transition-colors text-sm">
              Impressum
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};