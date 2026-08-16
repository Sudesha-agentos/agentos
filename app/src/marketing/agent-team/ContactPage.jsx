import { useState } from "react";
import { Link } from "react-router-dom";
import Nav from "../agentox/components/Nav";
import Footer from "../agentox/components/Footer";
import { BRAND } from "../agentox/content";
import "../agentox/agentoxMarketing.css";

const FIELDS = [
  { id: "name", label: "Name", type: "text" },
  { id: "email", label: "Email", type: "email" },
  { id: "company", label: "Company", type: "text" },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="agentox-marketing">
      <Nav />
      <main className="ax-contact">
        <div className="ax-container">
          <div className="ax-eyebrow">Contact</div>
          <h1 className="ax-h2" style={{ maxWidth: "560px" }}>
            Talk to us about your pipeline.
          </h1>
          <p className="ax-subhead" style={{ maxWidth: "620px" }}>
            Tell us about your Jira workflow and we&apos;ll show how Virin runs discovery, Ananta
            codes against your repository, and Neel holds the QA gate before writeback.
          </p>

          <div className="ax-contact-layout">
            <form onSubmit={onSubmit} className="ax-form-card">
              {sent ? (
                <div className="ax-form-success">
                  Thanks — we&apos;ll be in touch within one business day.
                </div>
              ) : (
                <>
                  {FIELDS.map((field) => (
                    <label key={field.id} className="ax-field">
                      <span>{field.label}</span>
                      <input type={field.type} name={field.id} required />
                    </label>
                  ))}
                  <label className="ax-field">
                    <span>Message</span>
                    <textarea name="message" required rows={5} />
                  </label>
                  <button type="submit" className="ax-btn ax-btn-primary">
                    Send message
                  </button>
                </>
              )}
            </form>

            <aside>
              <div className="ax-aside-card">
                <div className="ax-aside-card-label">Email</div>
                <h3>{BRAND.email}</h3>
                <p>We respond within one business day.</p>
              </div>
              <div className="ax-aside-card">
                <div className="ax-aside-card-label">Early access</div>
                <h3>Ready to run a pipeline?</h3>
                <p>
                  <Link to="/login" state={{ mode: "signup" }}>
                    Get early access →
                  </Link>
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
