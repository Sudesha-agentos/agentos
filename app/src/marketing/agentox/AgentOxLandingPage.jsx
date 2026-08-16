import { useEffect, useRef } from "react";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import IntegrationStrip from "./components/IntegrationStrip";
import HowItWorks from "./components/HowItWorks";
import AgentCards from "./components/AgentCards";
import FeatureGrid from "./components/FeatureGrid";
import SecuritySection from "./components/SecuritySection";
import PricingSection from "./components/PricingSection";
import FaqSection from "./components/FaqSection";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";
import "./agentoxMarketing.css";

export default function AgentOxLandingPage() {
  const rootRef = useRef(null);

  // Deep links like /#pricing: the target section doesn't exist when the
  // browser attempts its native hash scroll, and the app boot gate keeps the
  // page in a fixed, unscrollable container for the first frames — so retry
  // until the document has real scrollable layout.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return undefined;
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.querySelector(hash);
      const scrollable =
        document.documentElement.scrollHeight > window.innerHeight + 10;
      if (el && scrollable) {
        el.scrollIntoView();
        return;
      }
      if (attempts++ < 90) requestAnimationFrame(tryScroll);
    };
    tryScroll();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    // Opt into the hidden-until-scrolled state only when JS is running.
    root.classList.add("ax-anim");
    const elements = root.querySelectorAll(".ax-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("ax-in");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      root.classList.remove("ax-anim");
    };
  }, []);

  return (
    <div ref={rootRef} className="agentox-marketing">
      <Nav />
      <main>
        <Hero />
        <IntegrationStrip />
        <HowItWorks />
        <AgentCards />
        <FeatureGrid />
        <SecuritySection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
