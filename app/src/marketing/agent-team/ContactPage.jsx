import { useState } from "react";
import { AgentIllustration } from "./components/AgentIllustration";
import MarketingFooter from "./components/MarketingFooter";
import MarketingHeader from "./components/MarketingHeader";
import "./agentTeam.css";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="agent-team min-h-screen">
      <MarketingHeader />
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40" aria-hidden>
        <div className="absolute left-[10%] top-[15%] h-48 w-64 rounded-[40px] bg-[#A8C53A]/15 blur-3xl" />
        <div className="absolute right-[8%] bottom-[20%] h-40 w-56 rounded-[40px] bg-[#D9B8E8]/20 blur-3xl" />
      </div>

      <main className="relative mx-auto grid max-w-6xl gap-12 px-5 py-32 sm:px-8 lg:grid-cols-2 lg:items-start">
        <div>
          <h1 className="text-[clamp(2rem,4vw,3rem)] font-bold text-[#2B2D33]">
            Let&apos;s build your AI team
          </h1>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#6B6B6B]">
            Tell us about your Jira workflow and we&apos;ll show how Virin runs discovery, Ananta
            plans against your codebase, and Neel holds the QA gate before writeback.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { label: "Email", value: "hello@agentos.app" },
              { label: "Response time", value: "Within one business day" },
            ].map((row) => (
              <div key={row.label} className="at-card flex items-center gap-4 px-5 py-4">
                <span className="text-xl">✉</span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                    {row.label}
                  </p>
                  <p className="text-[15px] font-medium text-[#2B2D33]">{row.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <form onSubmit={onSubmit} className="at-card p-8 sm:p-10">
            {sent ? (
              <p className="text-center text-[15px] text-[#6B6B6B]">
                Thanks — we&apos;ll be in touch soon.
              </p>
            ) : (
              <div className="space-y-5">
                {[
                  { id: "name", label: "Name", type: "text" },
                  { id: "email", label: "Email", type: "email" },
                  { id: "company", label: "Company", type: "text" },
                ].map((f) => (
                  <label key={f.id} className="block">
                    <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                      {f.label}
                    </span>
                    <input
                      type={f.type}
                      required
                      className="mt-2 w-full rounded-2xl border border-[#E8E4DE] bg-[#FAF7F0]/50 px-4 py-3 text-[15px]"
                    />
                  </label>
                ))}
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                    Message
                  </span>
                  <textarea
                    required
                    rows={5}
                    className="mt-2 w-full resize-y rounded-2xl border border-[#E8E4DE] bg-[#FAF7F0]/50 px-4 py-3 text-[15px]"
                  />
                </label>
                <button type="submit" className="at-btn-charcoal w-full py-3.5 text-[15px] font-semibold">
                  Send Message
                </button>
              </div>
            )}
          </form>
          <div className="absolute -bottom-4 -right-2 hidden max-w-[220px] sm:block">
            <div className="at-card relative p-4 pr-6 text-[13px] text-[#2B2D33]">
              We&apos;ll get back to you within a day.
              <span className="absolute -bottom-2 left-8 size-4 rotate-45 bg-white shadow-sm" />
            </div>
            <AgentIllustration agent="neel" size={72} className="absolute -right-6 -top-8" />
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
