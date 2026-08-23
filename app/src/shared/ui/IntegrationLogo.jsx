export function IntegrationLogo({
  integration,
  src,
  name,
  size = "md",
  className = "",
}) {
  const icon = src || integration?.icon;
  const label = name || integration?.name || "";
  const sizes = {
    sm: "size-8 p-1",
    md: "size-10 p-1.5",
    lg: "size-12 p-2",
  };

  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        title={label}
        className={`integration-logo ${sizes[size] ?? sizes.md} shrink-0 rounded-[10px] object-contain ${className}`}
      />
    );
  }

  return (
    <div
      title={label}
      className={`flex ${sizes[size] ?? sizes.md} shrink-0 items-center justify-center rounded-[10px] bg-app-surface-muted text-[13px] font-semibold text-app-ink ${className}`}
    >
      {label.slice(0, 1)}
    </div>
  );
}
