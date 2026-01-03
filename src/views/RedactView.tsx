import { useMemo, useState, type ReactNode } from "react";
import "./styles.css";
import { Chip } from "../components/Chip";
import { useToast } from "../components/ToastHost";
import { usePersistentState } from "../hooks/usePersistentState";
import { resolveOverlaps, type RedactionMatch } from "../utils/redaction";
import { useClipboardPrefs, writeClipboard } from "../utils/clipboard";
import type { ModuleKey } from "../components/ModuleList";

type MaskMode = "full" | "partial";

type Detector = {
  key: string;
  label: string;
  regex: RegExp;
  severity: "low" | "medium" | "high";
  mask: string;
  validate?: (value: string) => boolean;
};

type CustomRule = { label: string; regex: RegExp };

const detectors: Detector[] = [
  {
    key: "email",
    label: "Email",
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    severity: "medium",
    mask: "[email]",
  },
  {
    key: "phone",
    label: "Phone",
    regex: /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    severity: "low",
    mask: "[phone]",
  },
  {
    key: "token",
    label: "Bearer / token",
    regex: /\b(?:authorization[:=]\s*)?(?:bearer\s+)?[A-Za-z0-9._-]{20,}\b/gi,
    severity: "high",
    mask: "[token]",
  },
  {
    key: "ip",
    label: "IP",
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    severity: "medium",
    mask: "[ip]",
  },
  {
    key: "id",
    label: "ID",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
    severity: "high",
    mask: "[id]",
  },
  {
    key: "iban",
    label: "IBAN",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/gi,
    severity: "high",
    mask: "[iban]",
    validate: isValidIban,
  },
  {
    key: "card",
    label: "Credit card",
    regex: /\b(?:\d[ -]?){12,19}\b/g,
    severity: "high",
    mask: "[card]",
    validate: passesLuhn,
  },
  {
    key: "ipv6",
    label: "IPv6",
    regex: /\b(?:[A-F0-9]{1,4}:){2,7}[A-F0-9]{1,4}\b/gi,
    severity: "medium",
    mask: "[ipv6]",
  },
  {
    key: "awskey",
    label: "AWS key",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    severity: "high",
    mask: "[aws-key]",
  },
  {
    key: "awssecret",
    label: "AWS secret",
    regex: /\baws_secret_access_key\s*[:=]\s*[A-Za-z0-9/+=]{40}\b/gi,
    severity: "high",
    mask: "[aws-secret]",
  },
];

interface RedactViewProps {
  onOpenGuide?: (key?: ModuleKey) => void;
}

export function RedactView({ onOpenGuide }: RedactViewProps) {
  const { push } = useToast();
  const [clipboardPrefs] = useClipboardPrefs();
  const [input, setInput] = useState("");
  const [maskMode, setMaskMode] = usePersistentState<MaskMode>("nullid:redact:mask", "full");
  const [customPattern, setCustomPattern] = useState("");
  const [customLabel, setCustomLabel] = useState("custom");
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [output, setOutput] = useState("");
  const [detectorState, setDetectorState] = usePersistentState<Record<string, boolean>>(
    "nullid:redact:detectors",
    Object.fromEntries(detectors.map((detector) => [detector.key, true])) as Record<string, boolean>,
  );

  const activeDetectors = useMemo(
    () => detectors.filter((detector) => detectorState[detector.key] ?? true),
    [detectorState],
  );

  const findings = useMemo(() => scan(input, activeDetectors, customRules), [activeDetectors, customRules, input]);

  const redacted = useMemo(() => redact(input, findings.matches, maskMode), [findings.matches, input, maskMode]);

  const applyCustomRule = () => {
    if (!customPattern.trim()) return;
    try {
      const regex = new RegExp(customPattern, "gi");
      setCustomRules((prev) => [...prev, { label: customLabel || "custom", regex }]);
      setCustomPattern("");
      push("custom rule added", "accent");
    } catch (error) {
      console.error(error);
      push("invalid regex", "danger");
    }
  };

  const handleApply = () => {
    setOutput(redacted);
    push("text redacted", "accent");
  };

  const handleCopy = async () => {
    await writeClipboard(
      output || redacted,
      clipboardPrefs,
      (message, tone) => push(message, tone === "danger" ? "danger" : tone === "accent" ? "accent" : "neutral"),
      "copied",
    );
  };

  const handleDownload = () => {
    const blob = new Blob([output || redacted], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "redacted.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workspace-scroll">
      <div className="guide-link">
        <button type="button" className="guide-link-button" onClick={() => onOpenGuide?.("redact")}>
          ? guide
        </button>
      </div>
      <div className="grid-two">
        <div className="panel" aria-label="Redaction input">
          <div className="panel-heading">
            <span>Input</span>
            <span className="panel-subtext">paste text</span>
          </div>
          <textarea
            className="textarea"
            placeholder="Drop text for redaction..."
            aria-label="Redaction input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <div className="controls-row">
            <span className="section-title">Mask mode</span>
            <div className="pill-buttons" role="group" aria-label="Mask mode">
              {(["full", "partial"] as MaskMode[]).map((mode) => (
                <button key={mode} type="button" className={maskMode === mode ? "active" : ""} onClick={() => setMaskMode(mode)}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="panel" aria-label="Redaction output">
          <div className="panel-heading">
            <span>Output</span>
            <span className="panel-subtext">preview + apply</span>
          </div>
          <div className="redact-preview" aria-label="Highlight view">
            {highlight(input, findings.matches)}
          </div>
          <textarea className="textarea" readOnly value={output || redacted} aria-label="Redacted output" />
          <div className="controls-row">
            <button className="button" type="button" onClick={handleApply}>
              apply redaction
            </button>
            <button className="button" type="button" onClick={handleCopy}>
              copy
            </button>
            <button className="button" type="button" onClick={handleDownload}>
              download
            </button>
          </div>
          <div className="status-line">
            <span>severity</span>
            <Chip label={findings.overall.toUpperCase()} tone={findings.overall === "high" ? "danger" : "accent"} />
            <span className="microcopy">{findings.total} findings</span>
          </div>
        </div>
      </div>
      <div className="panel" aria-label="Findings table">
        <div className="panel-heading">
          <span>Findings</span>
          <span className="panel-subtext">type / count / severity</span>
        </div>
        <div className="controls-row">
          {detectors.map((detector) => (
            <label key={detector.key} className="microcopy" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <input
                type="checkbox"
                checked={detectorState[detector.key]}
                onChange={(event) => setDetectorState((prev) => ({ ...prev, [detector.key]: event.target.checked }))}
                aria-label={`Toggle ${detector.label}`}
              />
              {detector.label}
            </label>
          ))}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>type</th>
              <th>count</th>
              <th>severity</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(findings.counts).map(([key, count]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{count}</td>
                <td>
                  <span className={`tag ${findings.severityMap[key] === "high" ? "tag-danger" : "tag-accent"}`}>
                    {findings.severityMap[key]}
                  </span>
                </td>
              </tr>
            ))}
            {findings.total === 0 && (
              <tr>
                <td colSpan={3} className="muted">
                  no findings detected
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="panel" aria-label="Custom rule">
        <div className="panel-heading">
          <span>Custom rule</span>
          <span className="panel-subtext">regex + label</span>
        </div>
        <div className="controls-row">
          <input
            className="input"
            placeholder="Regex pattern"
            value={customPattern}
            onChange={(event) => setCustomPattern(event.target.value)}
            aria-label="Custom regex pattern"
          />
          <input
            className="input"
            placeholder="Label"
            value={customLabel}
            onChange={(event) => setCustomLabel(event.target.value)}
            aria-label="Custom regex label"
          />
          <button className="button" type="button" onClick={applyCustomRule}>
            add
          </button>
        </div>
        <div className="microcopy">
          Safe handling: regex runs locally; errors are reported without applying. Custom rules mask with their label.
        </div>
      </div>
    </div>
  );
}

type Match = RedactionMatch;

function scan(text: string, rules: Detector[], custom: CustomRule[]) {
  const counts: Record<string, number> = {};
  const severityMap: Record<string, Detector["severity"]> = {};
  const matches: Match[] = [];

  const applyRule = (rule: Detector) => {
    const regex = new RegExp(rule.regex, rule.regex.flags);
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      if (rule.validate && !rule.validate(value)) {
        if (!regex.global) break;
        continue;
      }
      counts[rule.label] = (counts[rule.label] || 0) + 1;
      severityMap[rule.label] = rule.severity;
      matches.push({ start: match.index, end: match.index + value.length, label: rule.label, severity: rule.severity });
      if (!regex.global) break;
    }
  };

  rules.forEach((rule) => applyRule(rule));
  custom.forEach((rule) =>
    applyRule({
      key: rule.label,
      label: rule.label,
      regex: new RegExp(rule.regex, rule.regex.flags),
      severity: "medium",
      mask: `[${rule.label}]`,
    }),
  );

  const resolved = resolveOverlaps(matches);
  const total = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const worst =
    (resolved
      .map((match) => match.severity)
      .sort((a, b) => rank(b) - rank(a))[0] as "high" | "medium" | "low" | undefined) || "low";

  return { counts, total, overall: worst, matches: resolved, severityMap };
}

function redact(text: string, matches: Match[], mode: MaskMode) {
  if (!matches.length) return text;
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  let cursor = 0;
  let output = "";
  sorted.forEach((m) => {
    output += text.slice(cursor, m.start);
    output += mode === "full" ? `[${m.label}]` : partialMask(text.slice(m.start, m.end));
    cursor = m.end;
  });
  output += text.slice(cursor);
  return output;
}

function partialMask(value: string) {
  if (value.length <= 4) return "*".repeat(value.length);
  return "*".repeat(Math.max(0, value.length - 4)) + value.slice(-4);
}

function passesLuhn(value: string) {
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function isValidIban(value: string) {
  const trimmed = value.replace(/\s+/g, "").toUpperCase();
  if (trimmed.length < 15 || trimmed.length > 34) return false;
  const rearranged = `${trimmed.slice(4)}${trimmed.slice(0, 4)}`;
  const converted = rearranged.replace(/[A-Z]/g, (ch) => `${ch.charCodeAt(0) - 55}`);
  let remainder = 0;
  for (let i = 0; i < converted.length; i += 1) {
    const char = converted[i];
    remainder = (remainder * 10 + Number(char)) % 97;
  }
  return remainder === 1;
}

function highlight(text: string, matches: Match[]) {
  if (!matches.length) return <span className="muted">No findings yet.</span>;
  const sorted = [...matches].sort((a, b) => a.start - b.start);
  const parts: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach((m, index) => {
    parts.push(<span key={`p-${index}-pre`}>{text.slice(cursor, m.start)}</span>);
    parts.push(
      <mark key={`p-${index}-hit`} className={`highlight ${m.severity}`}>
        {text.slice(m.start, m.end)}
      </mark>,
    );
    cursor = m.end;
  });
  parts.push(<span key="tail">{text.slice(cursor)}</span>);
  return <div className="highlight-view">{parts}</div>;
}

function rank(value: "high" | "medium" | "low") {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}
