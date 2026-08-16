import { Link } from "react-router-dom";
import BrandLogo from "../../../shared/ui/BrandLogo";
import SmartLink from "./SmartLink";
import { BRAND, FOOTER } from "../content";

export default function Footer() {
  return (
    <footer className="ax-footer">
      <div className="ax-container">
        <div className="ax-footer-grid">
          <div className="ax-footer-brand">
            <Link to="/" className="ax-nav-brand" aria-label="AgentOX home">
              <BrandLogo size={30} alt="" />
              {BRAND.name}
            </Link>
            <p className="ax-footer-tagline">{BRAND.footerTagline}</p>
          </div>
          <div className="ax-footer-cols">
            {FOOTER.columns.map((col) => (
              <div key={col.title} className="ax-footer-col">
                <h4 className="ax-footer-col-title">{col.title}</h4>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <SmartLink href={link.href}>{link.label}</SmartLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="ax-footer-legal">
          <span>{FOOTER.legal}</span>
          <div className="ax-footer-legal-links">
            {FOOTER.legalLinks.map((link) => (
              <SmartLink key={link.href} href={link.href}>
                {link.label}
              </SmartLink>
            ))}
            <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
