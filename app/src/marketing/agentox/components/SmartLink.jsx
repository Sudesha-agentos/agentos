import { Link, useLocation } from "react-router-dom";

function hashFromHref(href) {
  if (href.startsWith("#")) return href;
  if (href.startsWith("/#")) return href.slice(1);
  return null;
}

/** Router Link for app routes; native hash anchors so in-page sections actually scroll. */
export default function SmartLink({ href, className, children, onClick }) {
  const location = useLocation();
  const hash = hashFromHref(href);

  if (hash) {
    const resolved = location.pathname === "/" ? hash : `/${hash}`;

    function handleClick(event) {
      onClick?.(event);
      if (event.defaultPrevented || location.pathname !== "/") return;
      const el = document.querySelector(hash);
      if (!el) return;
      event.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", hash);
    }

    return (
      <a href={resolved} className={className} onClick={handleClick}>
        {children}
      </a>
    );
  }

  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
