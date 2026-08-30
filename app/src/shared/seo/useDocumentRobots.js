import { useEffect } from "react";

/** Sets a document-level robots meta tag for the current route and restores on leave. */
export function useDocumentRobots(content) {
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    const previous = meta.getAttribute("content");
    meta.setAttribute("content", content);
    return () => {
      if (created) {
        meta.remove();
        return;
      }
      if (previous != null) meta.setAttribute("content", previous);
    };
  }, [content]);
}
