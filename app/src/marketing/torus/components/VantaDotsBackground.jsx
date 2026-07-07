import { useEffect, useRef } from "react";

// Load Three r134 + vanta.dots from CDN so the effect stays isolated from the
// app's own three (used by react-three-fiber), which is a much newer version
// that Vanta's older effects aren't compatible with.
const THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js";
const VANTA_SRC = "https://cdn.jsdelivr.net/npm/vanta@0.5.24/dist/vanta.dots.min.js";

function loadScript(src, globalKey) {
  return new Promise((resolve, reject) => {
    if (globalKey && window[globalKey]) {
      resolve(window[globalKey]);
      return;
    }
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(window[globalKey]));
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.dataset.src = src;
    script.async = true;
    script.onload = () => resolve(window[globalKey]);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function VantaDotsBackground({ light = false }) {
  const elRef = useRef(null);
  const effectRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadScript(THREE_SRC, "THREE");
        await loadScript(VANTA_SRC, "VANTA");
        if (cancelled || !elRef.current || !window.VANTA?.DOTS) return;

        effectRef.current = window.VANTA.DOTS({
          el: elRef.current,
          THREE: window.THREE,
          mouseControls: true,
          touchControls: true,
          gyroControls: false,
          minHeight: 200.0,
          minWidth: 200.0,
          scale: 1.0,
          scaleMobile: 1.0,
          backgroundColor: light ? 0xf5f3f0 : 0x000000,
          color: 0xe67e22,
          color2: light ? 0xb85a00 : 0x555555,
          size: 3.2,
          spacing: 32.0,
          showLines: true,
        });
      } catch {
        // Fail silently — the solid background remains if the CDN is unreachable.
      }
    }

    init();

    return () => {
      cancelled = true;
      if (effectRef.current) {
        try {
          effectRef.current.destroy();
        } catch {
          // ignore teardown errors
        }
        effectRef.current = null;
      }
    };
  }, [light]);

  return <div ref={elRef} className="vanta-bg" aria-hidden="true" />;
}
