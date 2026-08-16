import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../../../shared/ui/BrandLogo";
import SmartLink from "./SmartLink";
import { BRAND, NAV } from "../content";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className={`ax-nav ${scrolled || mobileOpen ? "ax-nav-scrolled" : ""}`}>
      <div className="ax-container ax-nav-inner">
        <Link to="/" className="ax-nav-brand" aria-label="AgentOX home">
          <BrandLogo size={30} alt="" />
          {BRAND.name}
        </Link>
        <nav className="ax-nav-links" aria-label="Primary">
          {NAV.links.map((link) => (
            <SmartLink key={link.href} href={link.href}>
              {link.label}
            </SmartLink>
          ))}
        </nav>
        <div className="ax-nav-actions">
          <Link to={NAV.signIn.href} className="ax-nav-signin">
            {NAV.signIn.label}
          </Link>
          <SmartLink href={NAV.cta.href} className="ax-btn ax-btn-primary ax-btn-sm">
            {NAV.cta.label}
          </SmartLink>
          <button
            type="button"
            className="ax-nav-burger"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
      <div className={`ax-nav-mobile ${mobileOpen ? "ax-open" : ""}`}>
        {NAV.links.map((link) => (
          <SmartLink key={link.href} href={link.href} onClick={closeMobile}>
            {link.label}
          </SmartLink>
        ))}
        <Link to={NAV.signIn.href} onClick={closeMobile}>
          {NAV.signIn.label}
        </Link>
      </div>
    </header>
  );
}
