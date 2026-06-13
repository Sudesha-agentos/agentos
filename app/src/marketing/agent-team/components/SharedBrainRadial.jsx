import { AGENTS, INSIGHT_CHIPS, RADIAL_AGENTS, SHARED_BRAIN } from "../constants";
import { useSharedBrainDemo } from "../hooks/useSharedBrainDemo";
import { AgentIllustration } from "./AgentIllustration";

const CORE = { x: 50, y: 52 };

function IntelligenceCore({ compact = false }) {
  return (
    <div
      data-brain-core
      className={`relative flex flex-col items-center justify-center rounded-full text-center text-white ${
        compact ? "size-28" : "size-36 sm:size-40"
      }`}
      style={{
        background: "linear-gradient(135deg, #0E7490 0%, #14B8A6 50%, #2DD4BF 100%)",
        boxShadow: "0 0 48px rgba(20, 184, 166, 0.45)",
      }}
    >
      <div
        data-brain-core-glow
        className="pointer-events-none absolute -inset-3 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(45,212,191,0.55) 0%, transparent 70%)",
        }}
      />
      <span className="relative text-[10px] font-semibold uppercase tracking-widest opacity-95">
        {SHARED_BRAIN.coreLabel}
      </span>
      <span data-brain-stored className="relative mt-1 font-[Poppins] text-2xl font-bold">
        0
      </span>
      <span className="relative text-[10px] opacity-85">stored items</span>
    </div>
  );
}

function AgentNode({ agentId, role, color }) {
  const meta = AGENTS.find((a) => a.id === agentId);
  if (!meta) return null;

  return (
    <div className="flex w-[108px] flex-col items-center sm:w-[120px]">
      <div
        data-radial-agent={agentId}
        className="overflow-hidden rounded-full border-[3px] border-white bg-[#FAF7F0] shadow-lg"
        style={{ width: 72, height: 72 }}
      >
        <AgentIllustration agent={agentId} size={72} />
      </div>
      <p className="mt-2 text-center font-[Poppins] text-[14px] font-bold leading-tight text-[#2B2D33]">
        {meta.name}
      </p>
      <span
        className="at-pill mt-1 px-3 py-1 text-[11px] font-semibold"
        style={{ background: `${color}22`, color: "#2B2D33" }}
      >
        {role}
      </span>
    </div>
  );
}

export default function SharedBrainRadial() {
  const { pinRef, mobileRef } = useSharedBrainDemo();
  const v = RADIAL_AGENTS[0];
  const a = RADIAL_AGENTS[1];
  const n = RADIAL_AGENTS[2];

  return (
    <section id="shared-brain" data-shared-brain className="relative overflow-visible bg-[#FAF7F0] py-16 sm:py-20">
      {/* Desktop */}
      <div
        ref={pinRef}
        data-brain-pin
        className="mx-auto hidden max-w-4xl flex-col items-center px-5 md:flex sm:px-8"
      >
        <div className="text-center">
          <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold leading-tight text-[#2B2D33]">
            {SHARED_BRAIN.headline}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[#6B6B6B]">
            {SHARED_BRAIN.subhead}
          </p>
        </div>

        <p
          data-brain-status
          className="at-glass-badge mt-8 px-5 py-2.5 text-[13px] font-medium text-[#2B2D33]"
        >
          Virin writes the PRD spec
        </p>

        <div className="relative mt-10 h-[min(520px,72vw)] w-full max-w-[600px] overflow-visible">
          <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" aria-hidden>
            {RADIAL_AGENTS.map((agent) => (
              <line
                key={`spoke-${agent.id}`}
                data-brain-spoke={agent.id}
                x1={agent.x}
                y1={agent.y}
                x2={CORE.x}
                y2={CORE.y}
                stroke={agent.color}
                strokeWidth="0.4"
                strokeDasharray="2 1.5"
                opacity="0.45"
              />
            ))}
            <path
              d={`M ${v.x} ${v.y} L ${a.x} ${a.y} L ${n.x} ${n.y} Z`}
              fill="none"
              stroke="#E8E4DE"
              strokeWidth="0.8"
            />
            <path
              data-brain-loop-fill
              d={`M ${v.x} ${v.y} L ${a.x} ${a.y} L ${n.x} ${n.y} Z`}
              fill="none"
              stroke="url(#loopGrad)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="100"
              strokeDasharray="100"
              strokeDashoffset="100"
            />
            <defs>
              <linearGradient id="loopGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#A8C53A" />
                <stop offset="50%" stopColor="#F2C94C" />
                <stop offset="100%" stopColor="#C49EDB" />
              </linearGradient>
            </defs>
            {RADIAL_AGENTS.map((agent) => (
              <circle
                key={`pulse-${agent.id}`}
                data-spoke-pulse={agent.id}
                cx={CORE.x}
                cy={CORE.y}
                r="3"
                fill="none"
                stroke={agent.color}
                strokeWidth="0.7"
                opacity="0"
              />
            ))}
          </svg>

          <div
            className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${CORE.x}%`, top: `${CORE.y}%` }}
          >
            <IntelligenceCore />
          </div>

          {INSIGHT_CHIPS.map((label, i) => (
            <div
              key={label}
              data-insight-chip={i}
              className="at-pill pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 text-[11px] font-medium text-[#2B2D33] opacity-0 shadow-md"
              style={{
                left: `${CORE.x + (i % 2 ? 22 : -26)}%`,
                top: `${CORE.y + (i < 2 ? -20 - i * 5 : 18 + (i - 2) * 5)}%`,
              }}
            >
              {label}
            </div>
          ))}

          {RADIAL_AGENTS.map((agent) => (
            <div
              key={agent.id}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${agent.x}%`, top: `${agent.y}%` }}
            >
              <AgentNode agentId={agent.id} role={agent.role} color={agent.color} />
            </div>
          ))}

          <div
            data-brain-token
            className="absolute z-30 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-xl"
            style={{
              left: `${v.x}%`,
              top: `${v.y}%`,
              background: "linear-gradient(135deg, #A8C53A, #F2C94C)",
              boxShadow: "0 0 16px rgba(168,197,58,0.7)",
            }}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-[12px] text-[#6B6B6B]">
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded bg-gradient-to-r from-[#A8C53A] to-[#C49EDB]" />
            Solid loop — handoff
          </span>
          <span className="flex items-center gap-2">
            <span className="h-0.5 w-6 border-t-2 border-dashed border-[#14B8A6]" />
            Dashed spokes — read & write
          </span>
        </div>
      </div>

      {/* Mobile */}
      <div ref={mobileRef} data-brain-mobile className="px-5 md:hidden sm:px-8">
        <h2 className="text-center text-[clamp(1.5rem,5vw,2rem)] font-bold text-[#2B2D33]">
          {SHARED_BRAIN.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-[14px] text-[#6B6B6B]">
          {SHARED_BRAIN.subhead}
        </p>
        <p
          data-brain-status-mobile
          className="at-glass-badge mx-auto mt-6 block w-fit px-4 py-2 text-[12px] font-medium text-[#2B2D33]"
        >
          Virin writes the PRD spec
        </p>

        <div className="relative mx-auto mt-8 flex max-w-sm flex-col items-center gap-0">
          {RADIAL_AGENTS.map((agent, i) => {
            const meta = AGENTS.find((a) => a.id === agent.id);
            return (
              <div key={agent.id} className="flex w-full flex-col items-center">
                <div data-mobile-agent={agent.id} className="at-card flex w-full items-center gap-4 p-4">
                  <AgentIllustration agent={agent.id} size={56} />
                  <div>
                    <p className="font-[Poppins] text-lg font-bold text-[#2B2D33]">{meta?.name}</p>
                    <span
                      className="at-pill mt-1 inline-block px-2.5 py-0.5 text-[11px] font-semibold"
                      style={{ background: `${agent.color}22` }}
                    >
                      {agent.role}
                    </span>
                  </div>
                </div>
                {i < RADIAL_AGENTS.length - 1 && (
                  <div className="relative flex h-14 w-full items-center justify-center">
                    <div className="h-full w-0.5 bg-gradient-to-b from-[#E8E4DE] to-[#14B8A6]/60" />
                    {i === 0 && (
                      <div
                        data-mobile-token
                        className="absolute top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                        style={{ background: agent.color }}
                      />
                    )}
                  </div>
                )}
                {i === 0 && (
                  <div className="my-2">
                    <IntelligenceCore compact />
                  </div>
                )}
                {i === 0 && <div className="h-4 w-0.5 bg-[#E8E4DE]" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
