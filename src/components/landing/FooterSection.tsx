import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const footerLinks = {
  unternehmen: [
    { labelKey: "links_company_forCompanies", href: "/auth?mode=signup&role=client" },
    { labelKey: "links_company_pricing", href: "#pricing" },
    { labelKey: "links_company_enterprise", href: "/contact" },
  ],
  recruiter: [
    { labelKey: "links_recruiter_forRecruiters", href: "/auth?mode=signup&role=recruiter" },
    { labelKey: "links_recruiter_guides", href: "/guides" },
    { labelKey: "links_recruiter_helpCenter", href: "/help" },
  ],
  plattform: [
    { labelKey: "links_platform_features", href: "#features" },
    { labelKey: "links_platform_security", href: "#security" },
    { labelKey: "links_platform_documentation", href: "/docs" },
  ],
  unternehmenInfo: [
    { labelKey: "links_info_about", href: "/about" },
    { labelKey: "links_info_careers", href: "/careers" },
    { labelKey: "links_info_press", href: "/press" },
    { labelKey: "links_info_contact", href: "/contact" },
  ],
};

export const FooterSection = () => {
  const { t } = useTranslation();
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
              {t("footer.tagline")}
            </p>
          </div>

          {Object.entries({ company: footerLinks.unternehmen, recruiter: footerLinks.recruiter, platform: footerLinks.plattform, info: footerLinks.unternehmenInfo }).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-semibold mb-4 text-foreground">{t(`footer.colTitle_${title}`)}</h4>
              <ul className="space-y-2">
                {links.map((link, index) => (
                  <li key={index}>
                    {link.href.startsWith("#") ? (
                      <a href={link.href} className="text-muted-foreground hover:text-foreground transition-colors text-sm">{t(`footer.${link.labelKey}`)}</a>
                    ) : (
                      <Link to={link.href} className="text-muted-foreground hover:text-foreground transition-colors text-sm">{t(`footer.${link.labelKey}`)}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} {t("footer.copyright")}
          </p>
          <div className="flex items-center gap-6">
            <Link to="/datenschutz" className="text-muted-foreground hover:text-foreground transition-colors text-sm">{t("footer.legal_privacy")}</Link>
            <Link to="/agb" className="text-muted-foreground hover:text-foreground transition-colors text-sm">{t("footer.legal_terms")}</Link>
            <Link to="/impressum" className="text-muted-foreground hover:text-foreground transition-colors text-sm">{t("footer.legal_imprint")}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
