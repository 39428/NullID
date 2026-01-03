import "./styles.css";
import { useClipboardPrefs } from "../utils/clipboard";
import { guideExtras, guideTools } from "../content/guideContent";
import "./GuideView.css";

export function GuideView() {
  const [clipboardPrefs, setClipboardPrefs] = useClipboardPrefs();
  const buildId = (import.meta.env.VITE_BUILD_ID as string | undefined) ?? "dev";
  const buildShort = buildId.slice(0, 7);

  return (
    <div className="workspace-scroll guide-surface">
      <div className="panel" aria-label="Guide overview">
        <div className="panel-heading">
          <span>Guide</span>
          <span className="panel-subtext">how to use NullID</span>
        </div>
        <div className="microcopy">
          Offline-first tooling; no network calls, no analytics. All processing and clipboard actions are local and best-effort cleared.
        </div>
      </div>
      <div className="guide-grid">
        {guideTools.map((tool) => (
          <article key={tool.key} id={tool.key} className="panel guide-card" aria-label={`${tool.title} guide`}>
            <div className="guide-card-header">
              <div className="guide-card-title">
                <span className="guide-key">:{tool.key}</span>
                <div className="guide-title-wrap">
                  <span className="guide-name">{tool.title}</span>
                  <span className="guide-summary">{tool.whatItDoes}</span>
                </div>
              </div>
            </div>
            <GuideLists item={tool} />
          </article>
        ))}
      </div>
      <div className="guide-grid">
        {guideExtras.map((item) => (
          <article key={item.key} id={item.key} className="panel guide-card" aria-label={`${item.title} guidance`}>
            <div className="guide-card-header">
              <div className="guide-card-title">
                <span className="guide-key">:{item.key}</span>
                <div className="guide-title-wrap">
                  <span className="guide-name">{item.title}</span>
                  <span className="guide-summary">{item.whatItDoes}</span>
                </div>
              </div>
            </div>
            <GuideLists item={item} />
            {item.key === "clipboard" && (
              <div className="controls-row guide-clipboard-row" style={{ alignItems: "center" }}>
                <label className="microcopy" htmlFor="clipboard-clear">
                  Auto-clear clipboard
                </label>
                <div className="pill-buttons" role="group" aria-label="Clipboard auto clear">
                  <button
                    type="button"
                    className={clipboardPrefs.enableAutoClearClipboard ? "active" : ""}
                    onClick={() =>
                      setClipboardPrefs((prev) => ({ ...prev, enableAutoClearClipboard: !prev.enableAutoClearClipboard }))
                    }
                  >
                    {clipboardPrefs.enableAutoClearClipboard ? "enabled" : "disabled"}
                  </button>
                </div>
                <label className="microcopy" htmlFor="clipboard-seconds">
                  Clear after (seconds)
                </label>
                <input
                  id="clipboard-seconds"
                  className="input"
                  type="number"
                  min={5}
                  max={300}
                  value={clipboardPrefs.clipboardClearSeconds}
                  onChange={(event) =>
                    setClipboardPrefs((prev) => ({
                      ...prev,
                      clipboardClearSeconds: Math.max(5, Math.min(300, Number(event.target.value))),
                    }))
                  }
                  style={{ width: "6rem" }}
                />
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="microcopy" style={{ marginTop: "1.25rem", textAlign: "center", color: "var(--text-muted)" }}>
        Build {buildShort}
      </div>
    </div>
  );
}

interface GuideListsProps {
  item: (typeof guideTools)[number] | (typeof guideExtras)[number];
}

function GuideLists({ item }: GuideListsProps) {
  return (
    <div className="guide-card-body">
      <div className="guide-section">
        <div className="section-title">What & when</div>
        <ul className="microcopy guide-list">
          {item.whatWhen.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="guide-section">
        <div className="section-title">How</div>
        <ol className="microcopy guide-list">
          {item.howSteps.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ol>
      </div>
      <div className="guide-section">
        <div className="section-title">Common mistakes & limits</div>
        <ul className="microcopy guide-list">
          {item.limits.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      {item.privacyNotes?.length ? (
        <div className="guide-section">
          <div className="section-title">Privacy notes</div>
          <ul className="microcopy guide-list">
            {item.privacyNotes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
