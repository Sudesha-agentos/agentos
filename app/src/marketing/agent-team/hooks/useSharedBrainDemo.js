import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { RADIAL_AGENTS } from "../constants";

gsap.registerPlugin(ScrollTrigger);

const V = RADIAL_AGENTS[0];
const A = RADIAL_AGENTS[1];
const N = RADIAL_AGENTS[2];

const STEPS = [
  { agent: "virin", label: "Virin writes the PRD spec" },
  { agent: "ananta", label: "Ananta plans implementation" },
  { agent: "neel", label: "Neel validates QA coverage" },
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function tokenPosition(progress) {
  const p = ((progress % 1) + 1) % 1;
  const third = 1 / 3;
  if (p < third) {
    const t = p / third;
    return { x: lerp(V.x, A.x, t), y: lerp(V.y, A.y, t) };
  }
  if (p < 2 * third) {
    const t = (p - third) / third;
    return { x: lerp(A.x, N.x, t), y: lerp(A.y, N.y, t) };
  }
  const t = (p - 2 * third) / third;
  return { x: lerp(N.x, V.x, t), y: lerp(N.y, V.y, t) };
}

function activeStep(progress) {
  const p = progress % 1;
  if (p < 1 / 3) return 0;
  if (p < 2 / 3) return 1;
  return 2;
}

function updateBrainFrame(pin, progress, lapCount = 0) {
  const token = pin.querySelector("[data-brain-token]");
  const core = pin.querySelector("[data-brain-core]");
  const glow = pin.querySelector("[data-brain-core-glow]");
  const stored = pin.querySelector("[data-brain-stored]");
  const status = pin.querySelector("[data-brain-status]");
  const loopFill = pin.querySelector("[data-brain-loop-fill]");

  const pos = tokenPosition(progress);
  const intensity = Math.min(0.35 + progress * 0.65 + lapCount * 0.15, 1);
  const storedCount = Math.round(progress * 24 + lapCount * 8);

  if (token) {
    gsap.set(token, { left: `${pos.x}%`, top: `${pos.y}%` });
  }
  if (stored) stored.textContent = String(storedCount);
  if (status) status.textContent = STEPS[activeStep(progress)].label;
  if (loopFill) loopFill.style.strokeDashoffset = String(100 - progress * 100);

  if (core) {
    gsap.set(core, {
      scale: 1 + intensity * 0.14,
      boxShadow: `0 0 ${28 + intensity * 56}px rgba(20, 184, 166, ${0.4 + intensity * 0.45})`,
    });
  }
  if (glow) gsap.set(glow, { opacity: 0.55 + intensity * 0.4, scale: 1 + intensity * 0.25 });

  RADIAL_AGENTS.forEach((agent, i) => {
    const node = pin.querySelector(`[data-radial-agent="${agent.id}"]`);
    const spoke = pin.querySelector(`[data-brain-spoke="${agent.id}"]`);
    const isActive = activeStep(progress) === i;
    if (node) gsap.set(node, { scale: isActive ? 1.08 : 1 });
    if (spoke) gsap.set(spoke, { opacity: isActive ? 0.95 : 0.4, strokeWidth: isActive ? 0.55 : 0.35 });
  });

  pin.querySelectorAll("[data-insight-chip]").forEach((chip, i) => {
    const show = progress > 0.42 || lapCount > 0;
    gsap.set(chip, { opacity: show ? 1 : 0, scale: show ? 1 : 0.85, y: show ? 0 : 6 });
    if (show) chip.style.zIndex = String(10 + i);
  });
}

export function useSharedBrainDemo() {
  const pinRef = useRef(null);
  const mobileRef = useRef(null);

  useEffect(() => {
    const pin = pinRef.current;
    const mobile = mobileRef.current;
    if (!pin && !mobile) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    const ctx = gsap.context(() => {
      if (reduced) {
        if (pin) updateBrainFrame(pin, 0.15, 0);
        return;
      }

      if (pin && !isMobile) {
        const auto = { progress: 0 };
        const loop = gsap.timeline({ repeat: -1 });
        loop.to(auto, {
          progress: 1,
          duration: 9,
          ease: "none",
          onUpdate: () => updateBrainFrame(pin, auto.progress, 0),
        });

        loop.eventCallback("onRepeat", () => {
          pin.querySelectorAll("[data-insight-chip]").forEach((c) => {
            gsap.fromTo(c, { scale: 0.9 }, { scale: 1, duration: 0.3, ease: "back.out(1.4)" });
          });
        });

        ["virin", "ananta", "neel"].forEach((id, i) => {
          const at = i / 3 + 0.05;
          loop.to(
            pin.querySelector(`[data-radial-agent="${id}"]`),
            { scale: 1.14, duration: 0.25, ease: "back.out(2)", yoyo: true, repeat: 1 },
            at * 9
          );
          loop.fromTo(
            pin.querySelector(`[data-spoke-pulse="${id}"]`),
            { attr: { r: 3 }, opacity: 0.9 },
            { attr: { r: 18 }, opacity: 0, duration: 0.6, ease: "power2.out" },
            at * 9
          );
        });

        ScrollTrigger.create({
          trigger: pin,
          start: "top 80%",
          end: "bottom 20%",
          onEnter: () => loop.play(),
          onLeave: () => loop.pause(),
          onEnterBack: () => loop.play(),
          onLeaveBack: () => loop.pause(),
        });
      }

      if (mobile) {
        const mState = { step: 0 };
        gsap.to(mState, {
          step: 2,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut",
          onUpdate: () => {
            const stored = mobile.querySelector("[data-brain-stored]");
            const token = mobile.querySelector("[data-mobile-token]");
            const status = mobile.querySelector("[data-brain-status-mobile]");
            if (stored) stored.textContent = String(Math.round(4 + mState.step * 6));
            if (token) gsap.set(token, { y: mState.step * 100 });
            if (status) status.textContent = STEPS[Math.round(mState.step)]?.label ?? "";
          },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return { pinRef, mobileRef };
}
