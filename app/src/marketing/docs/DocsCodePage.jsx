import { useRef } from "react";
import { Link } from "react-router-dom";
import TorusFooter from "../torus/components/TorusFooter";
import TorusNav from "../torus/components/TorusNav";
import { useTorusTheme } from "../torus/hooks/useTorusTheme";
import "../torus/torusMarketing.css";
import {
  DOCS_CODE_META,
  DOCS_CODE_SECTIONS,
  DOCS_CODE_TOC,
} from "./docsCodeContent";

export default function DocsCodePage() {
  const rootRef = useRef(null);
  const { isLight, toggleTheme } = useTorusTheme(rootRef);

  return (
    <div ref={rootRef} className="torus-marketing min-h-screen">
      <TorusNav onToggleTheme={toggleTheme} isLight={isLight} />
      <main
        className="page docs-code-page"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        <p className="cta-label">{DOCS_CODE_META.kicker}</p>
        <h1 className="mission-headline" style={{ maxWidth: "720px" }}>
          {DOCS_CODE_META.title}
        </h1>
        <p className="cta-description" style={{ maxWidth: "640px" }}>
          {DOCS_CODE_META.intro}
        </p>

        <div
          style={{
            display: "grid",
            gap: "40px",
            marginTop: "56px",
            gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)",
            alignItems: "start",
          }}
          className="docs-code-layout"
        >
          <aside
            style={{
              position: "sticky",
              top: "96px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              padding: "20px 16px",
            }}
            className="docs-code-toc"
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "2px",
                color: "var(--text-faint)",
                marginBottom: "14px",
              }}
            >
              CONTENTS
            </p>
            <nav style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {DOCS_CODE_TOC.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  style={{
                    fontSize: "13px",
                    color: "var(--text-dim)",
                    textDecoration: "none",
                    lineHeight: 1.35,
                  }}
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <Link
              to="/login"
              className="nav-signin"
              style={{
                display: "inline-flex",
                marginTop: "20px",
                fontSize: "11px",
              }}
            >
              OPEN APP
            </Link>
          </aside>

          <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
            {DOCS_CODE_SECTIONS.map((section) => (
              <section key={section.id} id={section.id}>
                <h2
                  className="mission-headline"
                  style={{
                    fontSize: "clamp(1.4rem, 2.5vw, 1.85rem)",
                    marginBottom: "16px",
                  }}
                >
                  {section.title}
                </h2>
                {section.paragraphs.map((p) => (
                  <p
                    key={p.slice(0, 40)}
                    style={{
                      color: "var(--text-dim)",
                      maxWidth: "680px",
                      marginBottom: "12px",
                      fontSize: "15px",
                      lineHeight: 1.65,
                    }}
                  >
                    {p}
                  </p>
                ))}
                <ol
                  style={{
                    listStyle: "none",
                    padding: 0,
                    margin: "24px 0 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                  }}
                >
                  {section.steps.map((step, index) => (
                    <li
                      key={step.title}
                      style={{
                        border: "1px solid var(--line)",
                        background: "var(--surface)",
                        padding: "16px 18px",
                      }}
                    >
                      <p
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "10px",
                          letterSpacing: "1.5px",
                          color: "var(--accent)",
                          marginBottom: "6px",
                        }}
                      >
                        STEP {String(index + 1).padStart(2, "0")}
                      </p>
                      <h3
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: "1.05rem",
                          fontWeight: 600,
                          color: "var(--text)",
                          marginBottom: "6px",
                        }}
                      >
                        {step.title}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--text-dim)",
                          fontSize: "14px",
                          lineHeight: 1.6,
                        }}
                      >
                        {step.body}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            ))}

            <section
              style={{
                borderTop: "1px solid var(--line)",
                paddingTop: "32px",
              }}
            >
              <p className="cta-label">NEXT</p>
              <h2
                className="mission-headline"
                style={{ fontSize: "1.5rem", marginBottom: "12px" }}
              >
                Run your first pipeline
              </h2>
              <p className="cta-description" style={{ marginBottom: "20px" }}>
                Sign in, connect Jira and GitHub, move a ticket into the AI Worker
                column — then follow Pipelines → Virin → Ananta → Neel.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                <Link to="/login" className="nav-signin">
                  SIGN IN
                </Link>
                <Link
                  to="/contact"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    letterSpacing: "1.5px",
                    color: "var(--text-dim)",
                    alignSelf: "center",
                  }}
                >
                  CONTACT →
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <TorusFooter />
      <style>{`
        @media (max-width: 900px) {
          .docs-code-layout {
            grid-template-columns: 1fr !important;
          }
          .docs-code-toc {
            position: static !important;
          }
        }
      `}</style>
    </div>
  );
}
