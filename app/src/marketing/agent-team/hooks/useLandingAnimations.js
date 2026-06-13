import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const AGENT_IDS = ["virin", "ananta", "neel"];

export function useLandingAnimations(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    const ctx = gsap.context(() => {
      if (reduced) return;

      gsap.to("[data-parallax-bar]", {
        y: mobile ? 0 : (i) => (i % 2 ? -60 : -90),
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
        },
      });

      gsap.from("[data-hero-mock]", {
        opacity: 0,
        y: 20,
        duration: 0.8,
        ease: "power2.out",
        delay: 0.1,
      });

      gsap.to("[data-hero-copy]", {
        opacity: 0.85,
        y: -16,
        ease: "power2.out",
        scrollTrigger: {
          trigger: "[data-hero]",
          start: "top top",
          end: "60% top",
          scrub: true,
        },
      });

      AGENT_IDS.forEach((id) => {
        const section = `[data-agent-section="${id}"]`;
        gsap.from(`${section} [data-agent-copy], ${section} [data-agent-avatar]`, {
          opacity: 0,
          y: mobile ? 16 : 24,
          duration: 0.7,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: section, start: "top 85%" },
        });
      });

      gsap.from("[data-client-metric]", {
        opacity: 0,
        y: 20,
        stagger: 0.1,
        ease: "back.out(1.2)",
        scrollTrigger: { trigger: "[data-clients]", start: "top 75%" },
      });

      gsap.from("[data-final-cta]", {
        opacity: 0,
        y: 16,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: "[data-final-cta]", start: "top 88%" },
      });
    }, root);

    return () => ctx.revert();
  }, [rootRef]);
}
