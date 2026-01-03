import { useCallback, useEffect, useRef, useState } from "react";
import "./styles.css";
import { bytesToUtf8 } from "../utils/encoding";
import { decryptBlob, decryptText, encryptBytes, encryptText } from "../utils/cryptoEnvelope";
import { Chip } from "../components/Chip";
import { useToast } from "../components/ToastHost";
import type { ModuleKey } from "../components/ModuleList";

interface EncViewProps {
  onOpenGuide?: (key?: ModuleKey) => void;
}

export function EncView({ onOpenGuide }: EncViewProps) {
  const { push } = useToast();
  const [plain, setPlain] = useState("");
  const [encPass, setEncPass] = useState("");
  const [cipherText, setCipherText] = useState("");
  const [decPass, setDecPass] = useState("");
  const [decrypted, setDecrypted] = useState("");
  const [encFile, setEncFile] = useState<File | null>(null);
  const [encFileBlob, setEncFileBlob] = useState<string | null>(null);
  const [decFileBlob, setDecFileBlob] = useState<Uint8Array | null>(null);
  const [decFileName, setDecFileName] = useState<string | null>(null);
  const [decMime, setDecMime] = useState<string>("application/octet-stream");
  const [autoClear, setAutoClear] = useState(true);
  const [clearAfter, setClearAfter] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const encryptFileInput = useRef<HTMLInputElement>(null);
  const decryptFileInput = useRef<HTMLInputElement>(null);
  const clearTimerRef = useRef<number | null>(null);

  const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB (envelope expands ~33%)

  const scheduleClear = useCallback(() => {
    if (!autoClear) return;
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = window.setTimeout(() => {
      setPlain("");
      setDecrypted("");
    }, clearAfter * 1000);
  }, [autoClear, clearAfter]);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current);
    };
  }, []);

  const handleEncryptText = useCallback(async () => {
    if (!plain || !encPass) return;
    try {
      const blob = await encryptText(encPass, plain);
      setCipherText(blob);
      push("sealed", "accent");
      setError(null);
      scheduleClear();
    } catch (err) {
      console.error(err);
      setError("encrypt failed");
      push("encrypt failed", "danger");
    }
  }, [encPass, plain, push, scheduleClear]);

  const handleEncryptFile = useCallback(async () => {
    if (!encPass || !encFile) return;
    if (encFile.size > MAX_FILE_BYTES) {
      setError(`file too large (${Math.ceil(encFile.size / (1024 * 1024))}MB). max 25MB.`);
      push("file too large", "danger");
      return;
    }
    try {
      const bytes = new Uint8Array(await encFile.arrayBuffer());
      const { blob } = await encryptBytes(encPass, bytes, { mime: encFile.type, name: encFile.name });
      setEncFileBlob(blob);
      setCipherText(blob);
      push("file sealed", "accent");
      scheduleClear();
    } catch (err) {
      console.error(err);
      setError("file encrypt failed");
      push("file encrypt failed", "danger");
    }
  }, [encFile, encPass, push, scheduleClear]);

  const handleDecryptText = useCallback(async () => {
    if (!cipherText || !decPass) return;
    try {
      const pt = await decryptText(decPass, cipherText);
      setDecrypted(pt);
      push("decrypted", "accent");
      setError(null);
      scheduleClear();
    } catch (err) {
      console.error(err);
      setDecrypted("");
      setDecFileBlob(null);
      setError("decrypt failed: bad passphrase or envelope");
      push("decrypt failed", "danger");
    }
  }, [cipherText, decPass, push, scheduleClear]);

  const handleDecryptFile = useCallback(async () => {
    if (!decPass || !cipherText) return;
    try {
      const { plaintext, header } = await decryptBlob(decPass, cipherText);
      setDecFileBlob(plaintext);
      setDecFileName(header.name ?? "decrypted.bin");
      setDecMime(header.mime ?? "application/octet-stream");
      try {
        setDecrypted(bytesToUtf8(plaintext));
      } catch {
        setDecrypted("[binary payload]");
      }
      setError(null);
      push("file ready", "accent");
      scheduleClear();
    } catch (err) {
      console.error(err);
      setError("decrypt failed: bad passphrase or envelope");
      push("decrypt failed", "danger");
    }
  }, [cipherText, decPass, push, scheduleClear]);

  const downloadEncryptedFile = () => {
    if (!encFileBlob) return;
    const url = URL.createObjectURL(new Blob([encFileBlob], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${encFile?.name ?? "payload"}.nullid`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Safari/iOS can cancel downloads if revoked synchronously.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const downloadDecryptedFile = () => {
    if (!decFileBlob) return;
    // Ensure we hand Blob an ArrayBuffer (some TS libdefs dislike Uint8Array<ArrayBufferLike>).
    const copy = new Uint8Array(decFileBlob);
    const url = URL.createObjectURL(new Blob([copy.buffer], { type: decMime }));
    const link = document.createElement("a");
    link.href = url;
    link.download = decFileName ?? "decrypted.bin";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  useEffect(() => {
    if (!decPass || !cipherText) {
      setDecFileBlob(null);
      setDecFileName(null);
    }
  }, [cipherText, decPass]);

  return (
    <div className="workspace-scroll">
      <div className="guide-link">
        <button type="button" className="guide-link-button" onClick={() => onOpenGuide?.("enc")}>
          ? guide
        </button>
      </div>
      <div className="grid-two">
        <div className="panel" aria-label="Encrypt panel">
          <div className="panel-heading">
            <span>Encrypt</span>
            <span className="panel-subtext">PBKDF2 + AES-GCM</span>
          </div>
          <label className="section-title" htmlFor="encrypt-plain">
            Plaintext
          </label>
          <textarea
            id="encrypt-plain"
            className="textarea"
            placeholder="Enter text to encrypt"
            aria-label="Plaintext"
            value={plain}
            onChange={(event) => setPlain(event.target.value)}
          />
          <label className="section-title" htmlFor="encrypt-pass">
            Passphrase
          </label>
          <input
            id="encrypt-pass"
            className="input"
            type="password"
            placeholder="••••••"
            aria-label="Encrypt passphrase"
            value={encPass}
            onChange={(event) => setEncPass(event.target.value)}
          />
          <div className="controls-row">
            <button className="button" type="button" onClick={handleEncryptText} disabled={!plain || !encPass}>
              seal text
            </button>
            <button className="button" type="button" onClick={() => encryptFileInput.current?.click()} disabled={!encPass}>
              select file
            </button>
            <input
              ref={encryptFileInput}
              type="file"
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
              onChange={(event) => setEncFile(event.target.files?.[0] ?? null)}
              aria-label="Pick file to encrypt"
              tabIndex={-1}
            />
            <button className="button" type="button" onClick={handleEncryptFile} disabled={!encPass || !encFile}>
              seal file
            </button>
          </div>
          <div className="status-line">
            <span>file</span>
            <Chip label={encFile?.name ?? "none"} tone="muted" />
          </div>
        </div>
        <div className="panel" aria-label="Decrypt panel">
          <div className="panel-heading">
            <span>Decrypt</span>
            <span className="panel-subtext">verify envelope</span>
          </div>
          <label className="section-title" htmlFor="decrypt-blob">
            Ciphertext
          </label>
          <textarea
            id="decrypt-blob"
            className="textarea"
            placeholder="Paste envelope"
            aria-label="Ciphertext"
            value={cipherText}
            onChange={(event) => setCipherText(event.target.value)}
          />
          <div className="controls-row">
            <button className="button" type="button" onClick={() => decryptFileInput.current?.click()}>
              load file
            </button>
            <input
              ref={decryptFileInput}
              type="file"
              accept=".nullid,text/plain"
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                setCipherText(text);
              }}
              tabIndex={-1}
            />
            <button className="button" type="button" onClick={handleDecryptText} disabled={!cipherText || !decPass}>
              decrypt text
            </button>
            <button className="button" type="button" onClick={handleDecryptFile} disabled={!cipherText || !decPass}>
              decrypt file
            </button>
          </div>
          <label className="section-title" htmlFor="decrypt-pass">
            Passphrase
          </label>
          <input
            id="decrypt-pass"
            className="input"
            type="password"
            placeholder="••••••"
            aria-label="Decrypt passphrase"
            value={decPass}
            onChange={(event) => setDecPass(event.target.value)}
          />
        </div>
      </div>
      <div className="panel" aria-label="Envelope preview">
        <div className="panel-heading">
          <span>Envelope</span>
          <span className="panel-subtext">NULLID:ENC:1</span>
        </div>
        <div className="note-box">
          <div className="microcopy">prefix NULLID:ENC:1, AES-GCM, PBKDF2:250k, AAD bound</div>
          <pre className="output">{cipherText || "Generate an envelope to view"}</pre>
        </div>
        <div className="controls-row">
          <label className="section-title" htmlFor="auto-clear">
            Hygiene
          </label>
          <div className="pill-buttons" role="group" aria-label="Auto clear options">
            <button
              id="auto-clear"
              type="button"
              className={autoClear ? "active" : ""}
              onClick={() => setAutoClear((prev) => !prev)}
            >
              auto clear
            </button>
            <input
              className="input"
              type="number"
              min={5}
              max={300}
              value={clearAfter}
              onChange={(event) => setClearAfter(Math.min(300, Math.max(5, Number(event.target.value))))}
              aria-label="Auto clear seconds"
            />
            <button className="button" type="button" onClick={downloadEncryptedFile} disabled={!encFileBlob}>
              download envelope
            </button>
            <button className="button" type="button" onClick={downloadDecryptedFile} disabled={!decFileBlob}>
              download decrypted
            </button>
          </div>
        </div>
        <div className="status-line">
          <span>decrypt</span>
          <span className={`tag ${error ? "tag-danger" : "tag-accent"}`}>{error || decrypted || "pending"}</span>
        </div>
      </div>
    </div>
  );
}
