import BrandLogo from "../shared/ui/BrandLogo";

export default function Logo({ className = "", href = "#top", variant = "dark" }) {
  const isLight = variant === "light";
  const wordmarkClass = isLight
    ? "text-app-ink group-hover:text-app-charcoal"
    : "text-ink/90 group-hover:text-ink";

  return (
    <BrandLogo
      href={href}
      size={22}
      withWordmark
      className={className}
      wordmarkClassName={wordmarkClass}
    />
  );
}

/** Compact mark for collapsed sidebar / mobile. */
export function LogoMark({ size = 22, className = "" }) {
  return <BrandLogo size={size} className={className} alt="AgentOX" />;
}
