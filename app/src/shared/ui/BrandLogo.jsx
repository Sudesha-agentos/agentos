import { Link } from "react-router-dom";

export const AGENTOX_LOGO_SRC = "/marketing/agentox.png";

/**
 * AgentOX brand mark from the official logo asset.
 */
export default function BrandLogo({
  size = 28,
  className = "",
  imgClassName = "",
  withWordmark = false,
  wordmarkClassName = "",
  href,
  alt = "AgentOX",
}) {
  const mark = (
    <img
      src={AGENTOX_LOGO_SRC}
      alt={withWordmark || href ? "" : alt}
      width={size}
      height={size}
      className={`shrink-0 rounded-[22%] object-cover ${imgClassName}`}
      decoding="async"
    />
  );

  const content = withWordmark ? (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <span className={`text-[15px] font-semibold tracking-tight ${wordmarkClassName}`}>
        AgentOX
      </span>
    </span>
  ) : (
    <span className={`inline-flex ${className}`}>{mark}</span>
  );

  if (!href) return content;

  if (href.startsWith("/")) {
    return (
      <Link to={href} className="group inline-flex items-center" aria-label="AgentOX home">
        {content}
      </Link>
    );
  }

  return (
    <a href={href} className="group inline-flex items-center" aria-label="AgentOX home">
      {content}
    </a>
  );
}
