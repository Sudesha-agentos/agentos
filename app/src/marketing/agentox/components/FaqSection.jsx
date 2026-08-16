import { useState } from "react";
import { FAQ } from "../content";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section className="ax-section" id={FAQ.id}>
      <div className="ax-container">
        <div className="ax-section-head ax-reveal">
          <div className="ax-eyebrow">{FAQ.eyebrow}</div>
          <h2 className="ax-h2">{FAQ.headline}</h2>
        </div>
        <div className="ax-faq">
          {FAQ.items.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.q} className={`ax-faq-item ax-reveal ${open ? "ax-open" : ""}`}>
                <button
                  type="button"
                  className="ax-faq-q"
                  aria-expanded={open}
                  onClick={() => setOpenIndex(open ? -1 : i)}
                >
                  {item.q}
                  <span className="ax-faq-icon" aria-hidden="true">
                    +
                  </span>
                </button>
                {open && <p className="ax-faq-a">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
