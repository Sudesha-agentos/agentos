import { useEffect } from "react";
import { Link } from "react-router-dom";
import Nav from "../agentox/components/Nav";
import Footer from "../agentox/components/Footer";
import AmbientOrbs from "../agentox/components/AmbientOrbs";
import "../agentox/agentoxMarketing.css";

function LegalDocument({ kicker, title, updated, intro, sections }) {
  useEffect(() => {
    document.title = `${title} · AgentOX`;
    return () => {
      document.title = "AgentOX";
    };
  }, [title]);

  return (
    <div className="agentox-marketing">
      <AmbientOrbs />
      <Nav />
      <main className="ax-legal">
        <div className="ax-container">
          <div className="ax-legal-prose">
            <div className="ax-eyebrow">{kicker}</div>
            <h1 className="ax-h2">{title}</h1>
            <p className="ax-legal-updated">Last updated {updated}</p>
            <p className="ax-subhead">{intro}</p>
            {sections.map((section) => (
              <section key={section.heading} className="ax-legal-section">
                <h2>{section.heading}</h2>
                {section.paragraphs.map((p) => (
                  <p key={p}>{p}</p>
                ))}
                {section.bullets?.length ? (
                  <ul>
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <p className="ax-legal-back">
              <Link to="/">← Back to AgentOX</Link>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

const PRIVACY = {
  kicker: "Legal",
  title: "Privacy Policy",
  updated: "16 August 2026",
  intro:
    "This policy explains how AgentOX collects, uses, and protects personal and workspace data when you visit agentox.io or use the AgentOX product.",
  sections: [
    {
      heading: "Who we are",
      paragraphs: [
        "AgentOX (“we”, “us”) provides AI agents that help software teams take work from tickets to reviewed pull requests. For privacy questions, contact hello@agentox.io.",
      ],
    },
    {
      heading: "Information we collect",
      paragraphs: [
        "We collect only what we need to operate the service, secure accounts, and improve the product.",
      ],
      bullets: [
        "Account data: name, email, password hash or Google sign-in identifiers, and workspace membership.",
        "Workspace configuration: organization name, integrations you connect (such as Jira, GitHub, Bitbucket, and customer databases), and settings you save.",
        "Usage data: pipeline activity, audit events, and product analytics needed to run and debug the service.",
        "Website data: limited technical logs (IP address, browser type) when you visit public pages.",
      ],
    },
    {
      heading: "How we use information",
      paragraphs: [
        "We use this information to provide AgentOX, authenticate users, connect integrations you authorize, generate pipeline outputs, send service emails, and keep the platform secure. We do not sell personal data. Customer source code and ticket content are not used to train foundation models.",
      ],
    },
    {
      heading: "Integrations and customer systems",
      paragraphs: [
        "When you connect Jira, Git, log sources, or a customer database, we store credentials you provide in encrypted form and use them only to perform actions you request in your workspace. You control which systems to attach and can disconnect them at any time. We do not treat your connected databases as AgentOX’s own data store.",
      ],
    },
    {
      heading: "Sharing",
      paragraphs: [
        "We share data with subprocessors that host infrastructure and send email, only as needed to run AgentOX. We may disclose information if required by law or to protect the service and our users. We do not share your repositories or ticket contents with other customers.",
      ],
    },
    {
      heading: "Retention and security",
      paragraphs: [
        "We retain account and workspace data while your workspace is active and for a limited period afterward as required for backups, audits, and legal obligations. We use encryption in transit, encrypted credentials at rest for supported secrets, and tenant isolation. No security measure is perfect; please use strong unique passwords and restrict integration permissions to what agents need.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "Depending on where you live, you may request access, correction, deletion, or export of personal data, or object to certain processing. Workspace owners can disconnect integrations and request account deletion by emailing hello@agentox.io. We will respond within a reasonable period.",
      ],
    },
    {
      heading: "International transfers",
      paragraphs: [
        "AgentOX is operated from infrastructure that may be located outside your country (including the United States). By using the service, you understand that your data may be processed in those locations with appropriate safeguards.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: [
        "We may update this policy. The “Last updated” date at the top will change, and material updates will be posted on this page. Continued use of AgentOX after an update means you accept the revised policy.",
      ],
    },
  ],
};

const TERMS = {
  kicker: "Legal",
  title: "Terms and Conditions",
  updated: "16 August 2026",
  intro:
    "These terms govern your use of agentox.io and the AgentOX product. By creating an account or using the service, you agree to them.",
  sections: [
    {
      heading: "The service",
      paragraphs: [
        "AgentOX provides AI-assisted software delivery: product analysis, code changes, tests, and related workspace tools. Outputs are assistive. You remain responsible for reviewing, approving, and merging work, and for any production impact.",
      ],
    },
    {
      heading: "Accounts and workspaces",
      paragraphs: [
        "You must provide accurate account information and keep credentials confidential. You are responsible for activity under your account and for users you invite. You must be at least 18 years old to use AgentOX.",
      ],
    },
    {
      heading: "Acceptable use",
      paragraphs: [
        "You may not misuse the service, attempt unauthorized access, interfere with other customers, submit unlawful content, or use AgentOX to violate third-party rights. You must only connect systems (repositories, issue trackers, databases) that you are authorized to use, and you must not use the product to attack, scrape, or exploit systems you do not own or administer.",
      ],
    },
    {
      heading: "Customer content and licenses",
      paragraphs: [
        "You retain ownership of your tickets, code, schemas, and other customer content. You grant AgentOX a limited license to process that content solely to provide the service to your workspace. We do not claim ownership of your software or data.",
      ],
    },
    {
      heading: "AI outputs",
      paragraphs: [
        "Generated PRDs, code, tests, and other outputs may contain errors. Human approval gates exist so you can review before merge. AgentOX does not warrant that outputs are correct, complete, non-infringing, or fit for production without your review.",
      ],
    },
    {
      heading: "Plans, payment, and early access",
      paragraphs: [
        "Paid plans, usage limits, and early-access features are described on our pricing page or in an order form. Fees are non-refundable except where required by law or stated in writing. We may change plans with notice; continued use after a change constitutes acceptance.",
      ],
    },
    {
      heading: "Confidentiality and security",
      paragraphs: [
        "Each party will protect the other’s confidential information. You are responsible for configuring integration permissions, IP allowlists, and access control in your own systems. Our Privacy Policy explains how we handle personal data.",
      ],
    },
    {
      heading: "Disclaimer and limitation of liability",
      paragraphs: [
        "The service is provided “as is” without warranties of any kind, including merchantability, fitness for a particular purpose, and non-infringement. To the maximum extent permitted by law, AgentOX is not liable for indirect, incidental, special, or consequential damages, or for lost profits, lost data, or business interruption. Our total liability for any claim relating to the service is limited to the fees you paid us in the three months before the claim (or USD $100 if you are on a free or early-access plan with no fees).",
      ],
    },
    {
      heading: "Termination",
      paragraphs: [
        "You may stop using AgentOX and request workspace deletion at any time. We may suspend or terminate access for breach, legal risk, or non-payment. Upon termination, we will delete or de-identify customer content within a reasonable period, except where retention is required by law or backups.",
      ],
    },
    {
      heading: "Governing law",
      paragraphs: [
        "These terms are governed by the laws applicable in the jurisdiction where AgentOX is organized, excluding conflict-of-law rules. If a provision is unenforceable, the rest remains in effect. These terms and the Privacy Policy are the entire agreement for use of the public website and product, unless you have a signed enterprise agreement, which controls in case of conflict.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [
        "Questions about these terms: hello@agentox.io.",
      ],
    },
  ],
};

export function PrivacyPolicyPage() {
  return <LegalDocument {...PRIVACY} />;
}

export function TermsPage() {
  return <LegalDocument {...TERMS} />;
}
