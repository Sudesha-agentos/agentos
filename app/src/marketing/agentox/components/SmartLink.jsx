import { Link } from "react-router-dom";

/** Router Link for app routes, plain anchor for in-page hashes. */
export default function SmartLink({ href, className, children, onClick }) {
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
