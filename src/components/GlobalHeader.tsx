import { useRef, useState } from "react";
import { Chip } from "./Chip";
import { Popover } from "./Overlay/Popover";
import "./GlobalHeader.css";

type StatusTone = "neutral" | "accent" | "danger";
type ThemeMode = "light" | "dark";

interface GlobalHeaderProps {
  brand: string;
  pageTitle: string;
  pageToken: string;
  status?: { message: string; tone?: StatusTone };
  theme: ThemeMode;
  compact?: boolean;
  onToggleTheme: () => void;
  onOpenCommands: () => void;
  onWipe: () => void;
}

export function GlobalHeader({
  brand,
  pageTitle,
  pageToken,
  status,
  theme,
  compact = false,
  onToggleTheme,
  onOpenCommands,
  onWipe,
}: GlobalHeaderProps) {
  const chipTone = status?.tone === "danger" ? "danger" : status?.tone === "accent" ? "accent" : "muted";
  const [menuOpen, setMenuOpen] = useState(false);
  const actionButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <header className={`global-header ${compact ? "is-compact" : ""}`}>
      <div className="header-cluster">
        <div className="brand-mark">
          <span className="brand-name">{brand}</span>
        </div>
      </div>
      <div className="header-center">
        <div className="page-meta">
          <span className="page-title">{pageTitle}</span>
          <span className="page-token">{pageToken}</span>
        </div>
        {status?.message && <Chip label={status.message} tone={chipTone} ariaLabel="Status" />}
      </div>
      <div className="header-actions">
        <div className="indicator-row" aria-label="Connection indicators">
          <Chip label="local" tone="muted" />
          <Chip label="offline" tone="muted" />
          <Chip label="no-net" tone="muted" />
        </div>
        {compact ? (
          <div className="compact-actions">
            <button
              type="button"
              className="ghost-button"
              ref={actionButtonRef}
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Open quick actions"
            >
              Actions
            </button>
            <Popover
              anchorRef={actionButtonRef}
              align="end"
              className="compact-menu"
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              role="menu"
            >
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setMenuOpen(false);
                  onToggleTheme();
                }}
                aria-label="Toggle theme"
                role="menuitem"
              >
                Theme: {theme === "dark" ? "Dark" : "Light"}
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setMenuOpen(false);
                  onWipe();
                }}
                aria-label="Wipe local data"
                role="menuitem"
              >
                Wipe data
              </button>
              <button
                type="button"
                className="command-button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenCommands();
                }}
                aria-label="Open command palette"
                aria-keyshortcuts="/,Control+K,Meta+K"
                role="menuitem"
              >
                / Commands
              </button>
            </Popover>
          </div>
        ) : (
          <div className="action-row">
            <button
              type="button"
              className="ghost-button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              aria-live="polite"
            >
              Theme: {theme === "dark" ? "Dark" : "Light"}
            </button>
            <button type="button" className="ghost-button" onClick={onWipe} aria-label="Wipe local data">
              Wipe data
            </button>
            <button
              type="button"
              className="command-button"
              onClick={onOpenCommands}
              aria-label="Open command palette"
              aria-keyshortcuts="/,Control+K,Meta+K"
            >
              / Commands
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
