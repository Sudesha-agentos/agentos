import { SECTION_05 } from "../torusPageContent";

export default function TorusSecuritySection() {
  const { headline, headlineKey, subhead, modes, footnote } = SECTION_05;

  const headlineParts = headlineKey
    ? headline.split(headlineKey)
    : [headline];

  return (
    <div className="section section-reveal" data-reveal>
      <div className="security">
        <h3 className="security-headline">
          {headlineKey && headlineParts.length === 2 ? (
            <>
              {headlineParts[0]}
              <span className="key">{headlineKey}</span>
              {headlineParts[1]}
            </>
          ) : (
            headline
          )}
        </h3>
        <p className="security-sub">{subhead}</p>
        <div className="modes">
          {modes.map((mode) => (
            <div key={mode.name} className={`mode ${mode.locked ? "mode-lock" : ""}`}>
              <div className="mode-h">
                <span className="mode-nm">{mode.name}</span>
                <span className="mode-tag">{mode.tag}</span>
              </div>
              <div className="wall">
                <div className="wall-h">
                  <span className="wall-loc">{mode.wallLoc}</span>
                  <span className="wall-pin">{mode.wallPin}</span>
                </div>
                {mode.items.map((item) => (
                  <div
                    key={item.label}
                    className={`wall-item ${item.model ? "wall-model" : ""}`}
                  >
                    <span className="wall-b" />
                    {item.label}
                    {item.suffix ? <span className="wall-s"> {item.suffix}</span> : null}
                  </div>
                ))}
              </div>
              <p className="mode-cap">
                {mode.captionStrong ? (
                  <>
                    {mode.captionBefore}
                    <strong>{mode.captionStrong}</strong>
                    {mode.captionAfter}
                  </>
                ) : (
                  <>
                    <strong>{mode.captionBold}</strong>
                    {mode.captionRest}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
        <div className="security-foot">{footnote}</div>
      </div>
    </div>
  );
}
