import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { useToast } from "../components/ToastHost";
import { usePersistentState } from "../hooks/usePersistentState";
import { useClipboardPrefs, writeClipboard } from "../utils/clipboard";
import type { ModuleKey } from "../components/ModuleList";

type PasswordSettings = {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguity: boolean;
  enforceMix: boolean;
};

type PassphraseSettings = {
  words: number;
  separator: "space" | "-" | "." | "_";
  randomCase: boolean;
  appendNumber: boolean;
  appendSymbol: boolean;
};

const symbols = "!@#$%^&*()-_=+[]{}<>?/|~";
const ambiguous = new Set(["l", "1", "I", "O", "0", "o"]);

interface PwViewProps {
  onOpenGuide?: (key?: ModuleKey) => void;
}

export function PwView({ onOpenGuide }: PwViewProps) {
  const { push } = useToast();
  const [clipboardPrefs] = useClipboardPrefs();
  const [passwordSettings, setPasswordSettings] = usePersistentState<PasswordSettings>("nullid:pw-settings", {
    length: 20,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    avoidAmbiguity: true,
    enforceMix: true,
  });
  const [passphraseSettings, setPassphraseSettings] = usePersistentState<PassphraseSettings>("nullid:pp-settings", {
    words: 5,
    separator: "-",
    randomCase: true,
    appendNumber: true,
    appendSymbol: true,
  });
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [wordlist] = useState<string[]>(() => buildWordlist());

  useEffect(() => {
    setPassword(generatePassword(passwordSettings));
  }, [passwordSettings]);

  useEffect(() => {
    setPhrase(generatePassphrase(passphraseSettings, wordlist));
  }, [passphraseSettings, wordlist]);

  const passwordEntropy = useMemo(() => estimatePasswordEntropy(passwordSettings), [passwordSettings]);
  const passphraseEntropy = useMemo(
    () => estimatePassphraseEntropy(passphraseSettings, wordlist?.length ?? 0),
    [passphraseSettings, wordlist],
  );

  const applyPreset = (preset: "high" | "nosym" | "pin") => {
    if (preset === "high") {
      setPasswordSettings({ length: 24, upper: true, lower: true, digits: true, symbols: true, avoidAmbiguity: true, enforceMix: true });
    } else if (preset === "nosym") {
      setPasswordSettings({ length: 18, upper: true, lower: true, digits: true, symbols: false, avoidAmbiguity: true, enforceMix: true });
    } else {
      setPasswordSettings({ length: 8, upper: false, lower: false, digits: true, symbols: false, avoidAmbiguity: false, enforceMix: true });
    }
  };

  return (
    <div className="workspace-scroll">
      <div className="guide-link">
        <button type="button" className="guide-link-button" onClick={() => onOpenGuide?.("pw")}>
          ? guide
        </button>
      </div>
      <div className="grid-two">
        <div className="panel" aria-label="Password generator">
          <div className="panel-heading">
            <span>Password</span>
            <span className="panel-subtext">entropy-forward</span>
          </div>
          <div className="controls-row">
            <input className="input" value={password} readOnly aria-label="Password output" />
            <button className="button" type="button" onClick={() => setPassword(generatePassword(passwordSettings))}>
              regenerate
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                writeClipboard(
                  password,
                  clipboardPrefs,
                  (message, tone) => push(message, tone === "danger" ? "danger" : tone === "accent" ? "accent" : "neutral"),
                  "password copied",
                )
              }
            >
              copy
            </button>
          </div>
          <div className="controls-row">
            <label className="section-title" htmlFor="password-length">
              Length
            </label>
            <input
              id="password-length"
              className="input"
              type="number"
              min={8}
              max={64}
              value={passwordSettings.length}
              onChange={(event) =>
                setPasswordSettings((prev) => ({
                  ...prev,
                  length: clamp(Number(event.target.value) || 0, 8, 64),
                }))
              }
              aria-label="Password length"
            />
            <div className="pill-buttons" role="group" aria-label="Character sets">
              {(["upper", "lower", "digits", "symbols"] as (keyof PasswordSettings)[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={passwordSettings[key] ? "active" : ""}
                  onClick={() =>
                    setPasswordSettings((prev) => ({
                      ...prev,
                      [key]: !prev[key],
                    }))
                  }
                  aria-label={`Toggle ${key} characters`}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
          <div className="controls-row">
            <label className="section-title" htmlFor="avoid-ambiguous">
              Hardening
            </label>
            <div className="pill-buttons" role="group" aria-label="Hardening options">
              <button
                id="avoid-ambiguous"
                type="button"
                className={passwordSettings.avoidAmbiguity ? "active" : ""}
                onClick={() => setPasswordSettings((prev) => ({ ...prev, avoidAmbiguity: !prev.avoidAmbiguity }))}
                aria-label="Avoid ambiguous characters"
              >
                avoid ambiguous
              </button>
              <button
                type="button"
                className={passwordSettings.enforceMix ? "active" : ""}
                onClick={() => setPasswordSettings((prev) => ({ ...prev, enforceMix: !prev.enforceMix }))}
                aria-label="Require all selected character types"
              >
                require all sets
              </button>
            </div>
          </div>
          <div className="controls-row">
            <span className="section-title">Presets</span>
            <div className="pill-buttons" role="group" aria-label="Password presets">
              <button type="button" onClick={() => applyPreset("high")}>
                high security
              </button>
              <button type="button" onClick={() => applyPreset("nosym")}>
                no symbols
              </button>
              <button type="button" onClick={() => applyPreset("pin")}>
                pin (digits)
              </button>
            </div>
          </div>
          <div className="status-line">
            <span>length {passwordSettings.length}</span>
            <span className="tag tag-accent">entropy ≈ {passwordEntropy} bits</span>
          </div>
        </div>
        <div className="panel" aria-label="Passphrase generator">
          <div className="panel-heading">
            <span>Passphrase</span>
            <span className="panel-subtext">human-readable</span>
          </div>
          <div className="controls-row">
            <input className="input" value={phrase} readOnly aria-label="Passphrase output" />
            <button
              className="button"
              type="button"
              onClick={() => setPhrase(generatePassphrase(passphraseSettings, wordlist))}
            >
              regenerate
            </button>
            <button
              className="button"
              type="button"
              onClick={() =>
                writeClipboard(
                  phrase,
                  clipboardPrefs,
                  (message, tone) => push(message, tone === "danger" ? "danger" : tone === "accent" ? "accent" : "neutral"),
                  "passphrase copied",
                )
              }
            >
              copy
            </button>
          </div>
          <div className="controls-row">
            <label className="section-title" htmlFor="word-count">
              Words
            </label>
            <input
              id="word-count"
              className="input"
              type="number"
              min={3}
              max={10}
              value={passphraseSettings.words}
              onChange={(event) =>
                setPassphraseSettings((prev) => ({
                  ...prev,
                  words: clamp(Number(event.target.value) || 0, 3, 10),
                }))
              }
              aria-label="Passphrase word count"
            />
            <select
              className="select"
              value={passphraseSettings.separator}
              onChange={(event) =>
                setPassphraseSettings((prev) => ({
                  ...prev,
                  separator: event.target.value as PassphraseSettings["separator"],
                }))
              }
              aria-label="Word separator"
            >
              <option value="space">space</option>
              <option value="-">-</option>
              <option value=".">.</option>
              <option value="_">_</option>
            </select>
          </div>
          <div className="controls-row">
            <label className="section-title" htmlFor="phrase-hardening">
              Hardening
            </label>
            <div className="pill-buttons" role="group" aria-label="Passphrase options">
              <button
                id="phrase-hardening"
                type="button"
                className={passphraseSettings.randomCase ? "active" : ""}
                onClick={() => setPassphraseSettings((prev) => ({ ...prev, randomCase: !prev.randomCase }))}
                aria-label="Randomly vary word casing"
              >
                random case
              </button>
              <button
                type="button"
                className={passphraseSettings.appendNumber ? "active" : ""}
                onClick={() => setPassphraseSettings((prev) => ({ ...prev, appendNumber: !prev.appendNumber }))}
                aria-label="Append number"
              >
                append number
              </button>
              <button
                type="button"
                className={passphraseSettings.appendSymbol ? "active" : ""}
                onClick={() => setPassphraseSettings((prev) => ({ ...prev, appendSymbol: !prev.appendSymbol }))}
                aria-label="Append symbol"
              >
                append symbol
              </button>
            </div>
          </div>
          <div className="status-line">
            <span>words {passphraseSettings.words}</span>
            <span className="tag tag-accent">
              entropy ≈ {passphraseEntropy} bits
            </span>
          </div>
        </div>
      </div>
      <div className="panel" aria-label="Config line">
        <div className="panel-heading">
          <span>Config</span>
          <span className="panel-subtext">status</span>
        </div>
        <div className="status-line">
          <span>charset</span>
          <span className="tag tag-accent">
            {[
              passwordSettings.upper && "upper",
              passwordSettings.lower && "lower",
              passwordSettings.digits && "digits",
              passwordSettings.symbols && "symbols",
            ]
              .filter(Boolean)
              .join(" / ")}
          </span>
          <span className="tag">entropy budget: {passwordEntropy}b</span>
        </div>
      </div>
    </div>
  );
}

function generatePassword(settings: PasswordSettings) {
  const pools: string[] = [];
  if (settings.upper) pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (settings.lower) pools.push("abcdefghijklmnopqrstuvwxyz");
  if (settings.digits) pools.push("0123456789");
  if (settings.symbols) pools.push(symbols);

  if (pools.length === 0) {
    pools.push("abcdefghijklmnopqrstuvwxyz", "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  }

  const filteredPools = settings.avoidAmbiguity ? pools.map((pool) => [...pool].filter((c) => !ambiguous.has(c)).join("")) : pools;
  const alphabet = filteredPools.join("");

  const baseline: string[] = [];
  if (settings.enforceMix) {
    filteredPools.forEach((pool) => {
      if (pool.length > 0) baseline.push(pool[randomIndex(pool.length)]);
    });
  }

  const remaining = Math.max(settings.length - baseline.length, 0);
  for (let i = 0; i < remaining; i += 1) {
    baseline.push(alphabet[randomIndex(alphabet.length)]);
  }

  return shuffle(baseline).join("");
}

function generatePassphrase(settings: PassphraseSettings, wordlist: string[]) {
  if (!wordlist.length) return "loading wordlist…";
  const sep = settings.separator === "space" ? " " : settings.separator;
  const picks: string[] = [];

  for (let i = 0; i < settings.words; i += 1) {
    let word = wordlist[randomIndex(wordlist.length)];
    if (settings.randomCase) {
      word = maybeCapitalize(word);
    }
    picks.push(word);
  }

  if (settings.appendNumber) {
    picks.push(String(randomIndex(10)));
  }
  if (settings.appendSymbol) {
    picks.push(symbols[randomIndex(symbols.length)]);
  }

  return picks.join(sep);
}

function maybeCapitalize(value: string) {
  if (value.length === 0) return value;
  const mode = randomIndex(3);
  if (mode === 0) return value.toUpperCase();
  if (mode === 1) return value[0].toUpperCase() + value.slice(1);
  return value;
}

function estimatePasswordEntropy(settings: PasswordSettings) {
  const pools: string[] = [];
  if (settings.upper) pools.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  if (settings.lower) pools.push("abcdefghijklmnopqrstuvwxyz");
  if (settings.digits) pools.push("0123456789");
  if (settings.symbols) pools.push(symbols);
  const alphabet = (settings.avoidAmbiguity ? pools.map((pool) => [...pool].filter((c) => !ambiguous.has(c)).join("")) : pools).join("");
  const size = alphabet.length || 1;
  return Math.round(settings.length * Math.log2(size));
}

function estimatePassphraseEntropy(settings: PassphraseSettings, wordlistSize: number) {
  const base = wordlistSize > 0 ? wordlistSize : 1;
  const wordEntropy = settings.words * Math.log2(base);
  const numberEntropy = settings.appendNumber ? Math.log2(10) : 0;
  const symbolEntropy = settings.appendSymbol ? Math.log2(symbols.length) : 0;
  const caseEntropy = settings.randomCase ? settings.words * Math.log2(3) : 0;
  return Math.round(wordEntropy + numberEntropy + symbolEntropy + caseEntropy);
}

function randomIndex(max: number) {
  if (max <= 0) throw new Error("max must be positive");
  const maxUint = 0xffffffff;
  const limit = Math.floor((maxUint + 1) / max) * max;
  let value = 0;
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (value >= limit);
  return value % max;
}

function shuffle(input: string[]) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildWordlist(): string[] {
  const syllables = ["amber", "bison", "cinder", "delta", "ember", "fable"];
  const list: string[] = [];
  for (let a = 0; a < 6; a += 1) {
    for (let b = 0; b < 6; b += 1) {
      for (let c = 0; c < 6; c += 1) {
        for (let d = 0; d < 6; d += 1) {
          for (let e = 0; e < 6; e += 1) {
            const word = `${syllables[a]}${syllables[b].slice(0, 2)}${syllables[c].slice(-2)}${syllables[d][0]}${syllables[e].slice(1, 3)}`;
            list.push(word);
          }
        }
      }
    }
  }
  return list;
}
