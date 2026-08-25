function inline(text) {
  const parts = String(text ?? "").split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-medium text-app-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded-md bg-app-surface-muted px-1 py-0.5 font-mono text-[0.9em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link && /^https?:\/\//i.test(link[2])) {
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-indigo underline decoration-indigo/30 underline-offset-2"
        >
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

/** Lightweight markdown for chat replies. No HTML passthrough. */
export default function ChatMarkdown({ text }) {
  const source = String(text ?? "").trim();
  if (!source) return null;

  const blocks = [];
  let list = null;

  function flushList() {
    if (!list) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1 pl-5">
        {list.map((item, i) => (
          <li key={i} className="text-[15px] leading-relaxed text-app-ink">
            {inline(item)}
          </li>
        ))}
      </ul>
    );
    list = null;
  }

  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      list = list ?? [];
      list.push(bullet[1]);
      continue;
    }
    flushList();
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const Tag = heading[1].length === 1 ? "h3" : "h4";
      blocks.push(
        <Tag
          key={`h-${blocks.length}`}
          className="mt-3 mb-1 text-[15px] font-semibold tracking-tight text-app-ink"
        >
          {inline(heading[2])}
        </Tag>
      );
      continue;
    }
    blocks.push(
      <p key={`p-${blocks.length}`} className="my-1.5 text-[15px] leading-[1.65] text-app-ink">
        {inline(line)}
      </p>
    );
  }
  flushList();

  return <div className="min-w-0">{blocks}</div>;
}
