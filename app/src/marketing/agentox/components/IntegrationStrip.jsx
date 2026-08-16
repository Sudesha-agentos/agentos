import { INTEGRATIONS } from "../content";

export default function IntegrationStrip() {
  return (
    <section className="ax-integrations">
      <div className="ax-container">
        <div className="ax-integrations-title">{INTEGRATIONS.title}</div>
        <div className="ax-integrations-row">
          {INTEGRATIONS.logos.map((logo) => (
            <div key={logo.name} className="ax-integration">
              <img src={logo.src} alt="" loading="lazy" height={26} />
              <span>{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
