import { Link } from "react-router-dom";
import Nav from "../agentox/components/Nav";
import Footer from "../agentox/components/Footer";
import "../agentox/agentoxMarketing.css";
import "../torus/torusMarketing.css";
import {
  DOCS_CODE_META,
  DOCS_CODE_SECTIONS,
  DOCS_CODE_TOC,
} from "./docsCodeContent";

const STATUS_LABEL = {
  executed: "EXECUTED",
  inspired: "INSPIRED ONLY",
  gated: "GATED",
  "vendored-reference": "VENDORED REF",
};

const STATUS_COLOR = {
  executed: "var(--accent)",
  inspired: "var(--text-faint)",
  gated: "#c4a35a",
  "vendored-reference": "var(--text-faint)",
};

const TONE_BORDER = {
  info: "var(--line)",
  warn: "#c4a35a",
  critical: "#c45a5a",
};

function Callouts({ items }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
      {items.map((c) => (
        <aside
          key={c.title}
          style={{
            borderLeft: `3px solid ${TONE_BORDER[c.tone] || TONE_BORDER.info}`,
            border: `1px solid var(--line)`,
            borderLeftWidth: 3,
            borderLeftColor: TONE_BORDER[c.tone] || TONE_BORDER.info,
            background: "var(--surface)",
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "1.5px",
              color: TONE_BORDER[c.tone] || "var(--accent)",
              marginBottom: "6px",
            }}
          >
            {(c.tone || "info").toUpperCase()}
          </p>
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: "6px",
            }}
          >
            {c.title}
          </h3>
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "14px", lineHeight: 1.6 }}>
            {c.body}
          </p>
        </aside>
      ))}
    </div>
  );
}

function Steps({ steps }) {
  if (!steps?.length) return null;
  return (
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
      {steps.map((step, index) => (
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
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "14px", lineHeight: 1.6 }}>
            {step.body}
          </p>
        </li>
      ))}
    </ol>
  );
}

function StackLayers({ stack }) {
  if (!stack?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
      {stack.map((row) => (
        <div
          key={row.layer}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(100px, 140px) 1fr",
            gap: "12px",
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "14px 16px",
          }}
          className="docs-stack-row"
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "1px",
              color: "var(--accent)",
              margin: 0,
            }}
          >
            {row.layer}
          </p>
          <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "14px", lineHeight: 1.55 }}>
            {row.items}
          </p>
        </div>
      ))}
    </div>
  );
}

function MapRows({ mapRows }) {
  if (!mapRows?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "20px" }}>
      {mapRows.map((row) => (
        <div
          key={`${row.from}-${row.to}`}
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--text)",
            }}
          >
            {row.from}
            <span style={{ color: "var(--text-faint)", fontWeight: 400 }}> → </span>
            {row.to}
          </p>
          <p
            style={{
              margin: "6px 0 0",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--text-dim)",
              lineHeight: 1.5,
            }}
          >
            {row.via}
          </p>
        </div>
      ))}
    </div>
  );
}

function Phases({ phases }) {
  if (!phases?.length) return null;
  return (
    <div style={{ overflowX: "auto", marginTop: "20px" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "13px",
          minWidth: "640px",
        }}
      >
        <thead>
          <tr>
            {["Phase", "When", "Tools", "Surface"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "1.5px",
                  color: "var(--text-faint)",
                  borderBottom: "1px solid var(--line)",
                  padding: "8px 10px",
                  fontWeight: 500,
                }}
              >
                {h.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {phases.map((p) => (
            <tr key={p.name}>
              <td
                style={{
                  padding: "12px 10px",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--text)",
                  fontWeight: 600,
                  verticalAlign: "top",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </td>
              <td
                style={{
                  padding: "12px 10px",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--text-dim)",
                  verticalAlign: "top",
                }}
              >
                {p.when}
              </td>
              <td
                style={{
                  padding: "12px 10px",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--text-dim)",
                  verticalAlign: "top",
                  lineHeight: 1.5,
                }}
              >
                {p.tools}
              </td>
              <td
                style={{
                  padding: "12px 10px",
                  borderBottom: "1px solid var(--line)",
                  color: "var(--text-dim)",
                  verticalAlign: "top",
                }}
              >
                {p.surface}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ToolCatalog({ tools }) {
  if (!tools?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginTop: "20px" }}>
      {tools.map((t) => (
        <article
          key={t.name}
          style={{
            border: "1px solid var(--line)",
            background: "var(--surface)",
            padding: "18px 18px 16px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px 14px",
              alignItems: "baseline",
              marginBottom: "10px",
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
              }}
            >
              {t.name}
            </h3>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "1.2px",
                color: STATUS_COLOR[t.status] || "var(--accent)",
              }}
            >
              {STATUS_LABEL[t.status] || t.status?.toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "1px",
                color: "var(--text-faint)",
              }}
            >
              {t.phase} · {t.mode}
            </span>
          </div>
          <p style={{ margin: "0 0 8px", color: "var(--text-dim)", fontSize: "13px" }}>
            Upstream: {t.upstream}
          </p>
          <p style={{ margin: "0 0 8px", color: "var(--text-dim)", fontSize: "14px", lineHeight: 1.55 }}>
            {t.howUsed}
          </p>
          <p
            style={{
              margin: "0 0 6px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--text-faint)",
              lineHeight: 1.45,
            }}
          >
            Paths: {t.paths}
          </p>
          <p style={{ margin: "0 0 6px", color: "var(--text-dim)", fontSize: "13px" }}>
            Produces: {t.produces}
          </p>
          {t.gaps ? (
            <p
              style={{
                margin: "10px 0 0",
                paddingTop: "10px",
                borderTop: "1px solid var(--line)",
                color: "var(--text-dim)",
                fontSize: "13px",
                lineHeight: 1.55,
              }}
            >
              Gap: {t.gaps}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export default function DocsCodePage() {
  return (
    <div className="agentox-chrome">
      <Nav />
      <div className="torus-marketing min-h-screen">
        <main
        className="page docs-code-page"
        style={{ paddingTop: "120px", paddingBottom: "80px" }}
      >
        <p className="cta-label">{DOCS_CODE_META.kicker}</p>
        <h1 className="mission-headline" style={{ maxWidth: "780px" }}>
          {DOCS_CODE_META.title}
        </h1>
        <p className="cta-description" style={{ maxWidth: "680px" }}>
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
              maxHeight: "calc(100vh - 120px)",
              overflowY: "auto",
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

          <div style={{ display: "flex", flexDirection: "column", gap: "52px" }}>
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
                {(section.paragraphs || []).map((p) => (
                  <p
                    key={p.slice(0, 48)}
                    style={{
                      color: "var(--text-dim)",
                      maxWidth: "720px",
                      marginBottom: "12px",
                      fontSize: "15px",
                      lineHeight: 1.65,
                    }}
                  >
                    {p}
                  </p>
                ))}
                <StackLayers stack={section.stack} />
                <MapRows mapRows={section.mapRows} />
                <Phases phases={section.phases} />
                <ToolCatalog tools={section.tools} />
                <Steps steps={section.steps} />
                <Callouts items={section.callouts} />
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
                column — then verify ossTools.ready before you trust QA greens.
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
      </div>
      <Footer />
      <style>{`
        @media (max-width: 900px) {
          .docs-code-layout {
            grid-template-columns: 1fr !important;
          }
          .docs-code-toc {
            position: static !important;
            max-height: none !important;
          }
          .docs-stack-row {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
