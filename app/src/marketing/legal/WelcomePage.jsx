import { useEffect } from "react";
import { Link } from "react-router-dom";
import Nav from "../agentox/components/Nav";
import Footer from "../agentox/components/Footer";
import AmbientOrbs from "../agentox/components/AmbientOrbs";
import "../agentox/agentoxMarketing.css";

export default function WelcomePage() {
  useEffect(() => {
    document.title = "Welcome to AgentOX";
    return () => {
      document.title = "AgentOX";
    };
  }, []);

  return (
    <div className="agentox-marketing">
      <AmbientOrbs />
      <Nav />
      <main className="ax-legal">
        <div className="ax-container">
          <div className="ax-legal-prose">
            <div className="ax-eyebrow">Welcome</div>
            <h1 className="ax-h2">Welcome to AgentOX</h1>
            <p className="ax-subhead">
              AgentOX is an AI software team: Virin, Ananta, and Neel take a Jira ticket through
              requirements, code, and tests, then open a draft pull request for you to review.
            </p>

            <section className="ax-legal-section">
              <h2>What you get</h2>
              <ul>
                <li>
                  <strong>Virin</strong> — product agent. Finds requirement gaps and writes a PRD
                  with testable criteria.
                </li>
                <li>
                  <strong>Ananta</strong> — engineering agent. Implements against your real
                  repository and opens a draft PR.
                </li>
                <li>
                  <strong>Neel</strong> — QA agent. Generates and runs tests in a sandbox before
                  anything is ready to merge.
                </li>
              </ul>
            </section>

            <section className="ax-legal-section">
              <h2>How to start</h2>
              <p>
                Create a workspace, connect Jira and GitHub or Bitbucket, then run your first
                ticket. Human gates stay in place: nothing merges without your approval.
              </p>
              <p>
                Setup takes about 30 minutes. Your code stays yours; connected systems are used
                only for work you request in your workspace.
              </p>
            </section>

            <div className="ax-welcome-ctas">
              <Link to="/login" state={{ mode: "signup" }} className="ax-btn ax-btn-primary">
                Get early access
              </Link>
              <Link to="/contact" className="ax-btn ax-btn-secondary">
                Talk to us
              </Link>
            </div>

            <p className="ax-legal-back">
              <Link to="/">← Back to AgentOX</Link>
              {" · "}
              <Link to="/privacy">Privacy Policy</Link>
              {" · "}
              <Link to="/terms">Terms & Conditions</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
