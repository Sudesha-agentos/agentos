import { useEffect, useState } from "react";

import { AgentOxLogo } from "./AgentOxLogo";

import { SECTION_01 } from "../torusPageContent";



function FlagBody({ flag }) {

  if (flag.segments) {

    return (

      <>

        <span className="accent">{flag.icon}</span>{" "}

        {flag.segments.map((seg, i) => (

          <span key={i} className={seg.hl ? "hl" : undefined}>

            {seg.text}

          </span>

        ))}

        <br />

        &nbsp;&nbsp;{flag.secondary}

        <br />

        <span className="flag-rule">{flag.rule}</span>

        <br />

        <br />

      </>

    );

  }



  return (

    <>

      <span className="accent">{flag.icon}</span> {flag.lines[0]}

      <br />

      &nbsp;&nbsp;{flag.lines[1]}

      <br />

      <span className="flag-rule">{flag.lines[2]}</span>

      <br />

      <br />

    </>

  );

}



export default function TorusPipelineMockup({ reducedMotion = false }) {

  const [role, setRole] = useState("engineer");

  const { mockup, intro } = SECTION_01;



  const toggleRole = () => {

    setRole((r) => (r === "engineer" ? "pm" : "engineer"));

  };



  useEffect(() => {

    if (reducedMotion) return undefined;

    const id = window.setInterval(() => {

      setRole((r) => (r === "engineer" ? "pm" : "engineer"));

    }, 9000);

    return () => window.clearInterval(id);

  }, [reducedMotion]);



  return (

    <>

      <p className="dashboard-intro" data-reveal>

        {intro}

      </p>

      <div className="mockup-wrap">

        <div className="mockup-frame" data-reveal>

          <div className="mockup-titleblock">

            <div className="titleblock-brand">

              <AgentOxLogo size={16} className="logo-light" />

              <AgentOxLogo size={16} className="logo-dark" />

              AGENTOX

            </div>

            <div

              className={`titleblock-nav role-content ${role === "engineer" ? "active" : ""}`}

              data-view="engineer"

            >

              {mockup.engineerNav.map((item, i) => (

                <div

                  key={item}

                  className={`titleblock-nav-item ${i === mockup.engineerNavActive ? "active" : ""}`}

                >

                  {item}

                </div>

              ))}

            </div>

            <div

              className={`titleblock-nav role-content ${role === "pm" ? "active" : ""}`}

              data-view="pm"

            >

              {mockup.pmNav.map((item, i) => (

                <div

                  key={item}

                  className={`titleblock-nav-item ${i === mockup.pmNavActive ? "active" : ""}`}

                >

                  {item}

                </div>

              ))}

            </div>

            <button

              type="button"

              className="role-switch"

              data-role-toggle

              onClick={toggleRole}

              aria-label="Switch engineer and PM view"

            >

              <span

                className={`role-switch-label role-content ${role === "engineer" ? "active" : ""}`}

                data-view="engineer"

              >

                ENGINEER

              </span>

              <span

                className={`role-switch-label role-content ${role === "pm" ? "active" : ""}`}

                data-view="pm"

              >

                PM

              </span>

              <span className="role-switch-icon">⇄</span>

            </button>

          </div>



          <div className="mockup-content">

            <div

              className={`mockup-sidebar role-content ${role === "engineer" ? "active" : ""}`}

              data-view="engineer"

            >

              <div className="sidebar-group">

                <div className="sidebar-group-label">

                  DOCUMENTS ({mockup.engineerSidebar.documents.length})

                </div>

                {mockup.engineerSidebar.documents.map((row) => (

                  <div

                    key={row.label}

                    className={`sidebar-row ${row.active ? "active" : ""}`}

                  >

                    <span className={`dot dot-${row.dot}`} />

                    {row.label}

                  </div>

                ))}

              </div>

              <div className="sidebar-group">

                <div className="sidebar-group-label">MISSING</div>

                {mockup.engineerSidebar.missing.map((row) => (

                  <div key={row} className="sidebar-row">

                    <span className="dot dot-ready" />

                    {row}

                  </div>

                ))}

              </div>

              <div className="sidebar-group">

                <div className="sidebar-group-label">{mockup.engineerSidebar.stat}</div>

              </div>

            </div>



            <div

              className={`mockup-sidebar role-content ${role === "pm" ? "active" : ""}`}

              data-view="pm"

            >

              <div className="sidebar-group">

                <div className="sidebar-group-label">LIVE</div>

                {mockup.pmSidebar.live.map((row) => (

                  <div key={row.label} className={`sidebar-row ${row.active ? "active" : ""}`}>

                    <span className={`dot dot-${row.dot}`} />

                    {row.label}

                  </div>

                ))}

              </div>

              <div className="sidebar-group">

                <div className="sidebar-group-label">LEARNING</div>

                {mockup.pmSidebar.learning.map((row) => (

                  <div key={row.label} className="sidebar-row">

                    <span className={`dot dot-${row.dot}`} />

                    {row.label}

                  </div>

                ))}

              </div>

              <div className="sidebar-group">

                <div className="sidebar-group-label">READY</div>

                {mockup.pmSidebar.ready.map((row) => (

                  <div key={row.label} className="sidebar-row">

                    <span className="dot dot-ready" />

                    {row.label}

                  </div>

                ))}

              </div>

            </div>



            <div

              className={`mockup-main role-content ${role === "engineer" ? "active" : ""}`}

              data-view="engineer"

            >

              <div className="main-topbar">

                <div>

                  <div className="main-title">{mockup.projectTitle}</div>

                  <div className="main-meta-row">

                    <span>

                      <span className="meta-accent">FLAGS:</span> {mockup.engineerMeta.flags}

                    </span>

                    <span>

                      <span className="meta-accent">COVERAGE:</span> {mockup.engineerMeta.coverage}

                    </span>

                  </div>

                </div>

              </div>

              <div className="agent-block">

                <div className="agent-block-header">

                  <span>CRITICAL FLAGS</span>

                  <div className="agent-block-status">

                    <span className="dot dot-live" />3 OPEN

                  </div>

                </div>

                <div className="agent-block-body">

                  {mockup.engineerFlags.map((flag) => (

                    <FlagBody key={flag.rule || flag.lines?.[2]} flag={flag} />

                  ))}

                </div>

                <div className="agent-block-actions">

                  <span>VIEW SOURCES</span>

                  <span>DISMISS</span>

                  <span className="action-accent">VALID FLAG</span>

                </div>

              </div>

            </div>



            <div

              className={`mockup-main role-content ${role === "pm" ? "active" : ""}`}

              data-view="pm"

            >

              <div className="main-topbar">

                <div>

                  <div className="main-title">{mockup.pmBlock.title}</div>

                  <div className="main-meta-row">

                    {mockup.pmBlock.meta.map((m) => (

                      <span key={m}>

                        {m.includes(":") ? (

                          <>

                            <span className="meta-accent">{m.split(":")[0]}:</span>

                            {m.slice(m.indexOf(":") + 1)}

                          </>

                        ) : (

                          m

                        )}

                      </span>

                    ))}

                  </div>

                </div>

                <span className="btn btn-primary btn-sm">APPROVE &amp; ROUTE</span>

              </div>

              <div className="agent-block">

                <div className="agent-block-header">

                  <span>GENERATED MEMO</span>

                  <div className="agent-block-status">

                    <span className="dot dot-live" />

                    EDITABLE

                  </div>

                </div>

                <div className="agent-block-body">

                  <span className="accent">TO:</span>{" "}

                  <span className="hl">{mockup.pmBlock.memo.to}</span>

                  <br />

                  <span className="accent">RE:</span>{" "}

                  <span className="hl">{mockup.pmBlock.memo.re}</span>

                  <br />

                  <br />

                  <h3>RECOMMENDATION: {mockup.pmBlock.memo.recommendation}</h3>

                  {mockup.pmBlock.memo.body.map((line) => (

                    <span key={line}>

                      {line}

                      <br />

                    </span>

                  ))}

                  <br />

                  <h3>APPROVAL CHAIN</h3>

                  {mockup.pmBlock.memo.chain.map((step) => (

                    <span key={step.label}>

                      <span className="accent">[{step.done ? "x" : " "}]</span> {step.label}

                      <br />

                    </span>

                  ))}

                </div>

                <div className="agent-block-actions">

                  <span>EDIT</span>

                  <span>REJECT</span>

                  <span>REGENERATE</span>

                  <span className="action-accent">APPROVE</span>

                </div>

              </div>

            </div>

          </div>

        </div>

      </div>

    </>

  );

}

