import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./styles.css";
import { Chip } from "../components/Chip";
import type { ModuleKey } from "../components/ModuleList";

type MetaField = { key: string; value: string };

interface CleanResult {
  cleanedBlob: Blob;
  removed: string[];
}

interface MetaViewProps {
  onOpenGuide?: (key?: ModuleKey) => void;
}

export function MetaView({ onOpenGuide }: MetaViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("none");
  const [beforeFields, setBeforeFields] = useState<MetaField[]>([]);
  const [afterFields, setAfterFields] = useState<MetaField[]>([]);
  const [removedFields, setRemovedFields] = useState<string[]>([]);
  const [message, setMessage] = useState("drop an image to inspect metadata");
  const [cleanBlob, setCleanBlob] = useState<Blob | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [resizePercent, setResizePercent] = useState(100);
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      setUnsupportedReason(null);
      setFileName(file.name);
      setBeforeFields([]);
      setAfterFields([]);
      setRemovedFields([]);
      setCleanBlob(null);
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      if (afterPreview) URL.revokeObjectURL(afterPreview);
      setBeforePreview(URL.createObjectURL(file));
      setAfterPreview(null);
      setMessage("reading…");

      if (!file.type.startsWith("image/")) {
        setMessage("Only images supported for EXIF.");
        setUnsupportedReason("Unsupported file type for metadata cleaning.");
        return;
      }
      if (/heic|heif/i.test(file.type)) {
        setMessage("HEIC parsing is often unsupported in browsers.");
        setUnsupportedReason("HEIC not supported here.");
        return;
      }

      try {
        const dims = await readImageDimensions(file);
        const baseFields = await readMetadata(file);
        setBeforeFields([
          { key: "file", value: file.name },
          { key: "size", value: `${(file.size / 1024).toFixed(1)} KB` },
          { key: "type", value: file.type || "unknown" },
          { key: "dimensions", value: `${dims.width} x ${dims.height}` },
          ...baseFields,
        ]);
        setMessage(baseFields.length ? "metadata parsed" : "no EXIF fields found");

        const cleaned = await renderCleanImage(file, resizePercent / 100);
        const afterMeta = await readMetadata(cleaned.cleanedBlob);
        setCleanBlob(cleaned.cleanedBlob);
        if (afterPreview) URL.revokeObjectURL(afterPreview);
        setAfterPreview(URL.createObjectURL(cleaned.cleanedBlob));
        setAfterFields([{ key: "type", value: cleaned.cleanedBlob.type }, ...afterMeta]);
        setRemovedFields(cleaned.removed);
      } catch (error) {
        console.error(error);
        setMessage("Failed to parse image metadata.");
      }
    },
    [],
  );

  const saveClean = async () => {
    if (!cleanBlob) return;
    const safeName = fileName.replace(/\.[^.]+$/, "") || "clean";
    const url = URL.createObjectURL(cleanBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeName}-clean.${cleanBlob.type.includes("png") ? "png" : "jpg"}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const removedList = useMemo(() => removedFields.join(", "), [removedFields]);

  useEffect(() => {
    return () => {
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      if (afterPreview) URL.revokeObjectURL(afterPreview);
    };
  }, [afterPreview, beforePreview]);

  return (
    <div className="workspace-scroll">
      <div className="guide-link">
        <button type="button" className="guide-link-button" onClick={() => onOpenGuide?.("meta")}>
          ? guide
        </button>
      </div>
      <div className="grid-two">
        <div className="panel" aria-label="Metadata input">
          <div className="panel-heading">
            <span>Metadata Inspector</span>
            <span className="panel-subtext">drop image</span>
          </div>
          <div
            className="dropzone"
            role="button"
            tabIndex={0}
            aria-label="Drop file for inspection"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files?.[0] ?? null);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
              style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
              tabIndex={-1}
            />
            <div className="section-title">drag image</div>
            <div className="microcopy">jpeg / png / webp</div>
          </div>
          <div className="status-line">
            <span>file</span>
            <Chip label={fileName} tone="muted" />
            <Chip label={message} tone="accent" />
          </div>
        </div>
        <div className="panel" aria-label="Clean export">
          <div className="panel-heading">
            <span>Clean export</span>
            <span className="panel-subtext">strip EXIF</span>
          </div>
          <p className="microcopy">
            Images are re-encoded via canvas to drop metadata. Unsupported formats are disabled to avoid false security.
          </p>
          <div className="controls-row">
            <label className="section-title" htmlFor="resize-percent">
              Strip + resize
            </label>
            <select
              id="resize-percent"
              className="select"
              value={resizePercent}
              onChange={(event) => setResizePercent(Number(event.target.value))}
              aria-label="Resize percent"
            >
              <option value={100}>100%</option>
              <option value={75}>75%</option>
              <option value={50}>50%</option>
            </select>
          </div>
          <div className="controls-row">
            <button
              className="button"
              type="button"
              onClick={() => void saveClean()}
              disabled={!cleanBlob || Boolean(unsupportedReason)}
              aria-label="Download cleaned image"
            >
              download clean
            </button>
            {unsupportedReason ? <Chip label="unsupported" tone="danger" /> : <Chip label="ready" tone="accent" />}
          </div>
          <div className="status-line">
            <span>removed</span>
            <span className="microcopy">{removedList || "none"}</span>
          </div>
        </div>
      </div>
      <div className="panel" aria-label="Metadata table">
        <div className="panel-heading">
          <span>Fields</span>
          <span className="panel-subtext">before / after</span>
        </div>
        <div className="grid-two">
          <div>
            <div className="section-title">Previews</div>
            <div className="grid-two">
              <div className="note-box">
                <div className="microcopy">Before</div>
                {beforePreview ? (
                  <img src={beforePreview} alt="Before preview" className="image-preview" />
                ) : (
                  <div className="microcopy">no file</div>
                )}
              </div>
              <div className="note-box">
                <div className="microcopy">After (cleaned)</div>
                {afterPreview ? (
                  <img src={afterPreview} alt="After preview" className="image-preview" />
                ) : (
                  <div className="microcopy">not generated</div>
                )}
              </div>
            </div>
          </div>
          <div>
            <div className="section-title">Before cleaning</div>
            <table className="table">
              <tbody>
                {beforeFields.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={2}>
                      no fields
                    </td>
                  </tr>
                ) : (
                  beforeFields.map((field) => (
                    <tr key={field.key}>
                      <td>{field.key}</td>
                      <td>{field.value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div className="section-title">After cleaning</div>
            <table className="table">
              <tbody>
                {afterFields.length === 0 ? (
                  <tr>
                    <td className="muted" colSpan={2}>
                      stripped (expected empty for JPEG/PNG)
                    </td>
                  </tr>
                ) : (
                  afterFields.map((field) => (
                    <tr key={field.key}>
                      <td>{field.key}</td>
                      <td>{field.value}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

async function readMetadata(file: File | Blob): Promise<MetaField[]> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const fields: MetaField[] = [];
  const exif = parseExif(buffer);
  Object.entries(exif).forEach(([key, value]) => fields.push({ key, value }));
  return fields.slice(0, 60);
}

function parseExif(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer);
  if (view.getUint16(0) !== 0xffd8) return {};
  let offset = 2;
  const result: Record<string, string> = {};
  let gpsOffset: number | null = null;
  while (offset < view.byteLength) {
    if (offset + 4 > view.byteLength) break;
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    if (marker === 0xe1) {
      const header = getString(bytes, offset + 4, 6);
      if (header === "Exif\u0000\u0000") {
        const tiffStart = offset + 10;
        const little = getString(bytes, tiffStart, 2) === "II";
        const ifdOffset = view.getUint32(tiffStart + 4, little);
        const tags = readIfd(view, tiffStart + ifdOffset, little, tiffStart);
        tags.forEach(({ tag, value }) => {
          if (tag === 0x8825 && typeof value === "number") {
            gpsOffset = tiffStart + value;
          } else {
            const label = tagNames[tag];
            if (label) result[label] = String(value);
          }
        });
        if (gpsOffset) {
          const gpsTags = readIfd(view, gpsOffset, little, tiffStart);
          const gps = buildGps(gpsTags);
          if (gps) result.gps = gps;
        }
      }
    }
    if (marker === 0xda) break;
    offset += 2 + length;
  }
  return result;
}

function readIfd(view: DataView, offset: number, little: boolean, start: number) {
  const count = view.getUint16(offset, little);
  const entries: { tag: number; value: string | number | number[] }[] = [];
  for (let i = 0; i < count; i += 1) {
    const entryOffset = offset + 2 + i * 12;
    const tag = view.getUint16(entryOffset, little);
    const type = view.getUint16(entryOffset + 2, little);
    const itemCount = view.getUint32(entryOffset + 4, little);
    const valueOffset = view.getUint32(entryOffset + 8, little);
    const size = typeSize[type] ?? 1;
    const totalSize = size * itemCount;
    const valuePos = totalSize <= 4 ? entryOffset + 8 : start + valueOffset;
    let value: string | number | number[] = "";
    if (type === 2) {
      value = getString(new Uint8Array(view.buffer), valuePos, itemCount).replace(/\u0000+$/, "");
    } else if (type === 3) {
      value = view.getUint16(valuePos, little);
    } else if (type === 4) {
      value = view.getUint32(valuePos, little);
    } else if (type === 5) {
      const values: number[] = [];
      for (let i = 0; i < itemCount; i += 1) {
        const base = valuePos + i * 8;
        const num = view.getUint32(base, little);
        const den = view.getUint32(base + 4, little) || 1;
        values.push(Math.round((num / den) * 1000) / 1000);
      }
      value = itemCount === 1 ? values[0] : values;
    }
    entries.push({ tag, value });
  }
  return entries;
}

function getString(bytes: Uint8Array, offset: number, length: number) {
  return new TextDecoder().decode(bytes.slice(offset, offset + length));
}

const tagNames: Record<number, string> = {
  0x010f: "make",
  0x0110: "model",
  0x0112: "orientation",
  0x0132: "datetime",
  0x9003: "captured",
  0x829a: "exposureTime",
  0x829d: "fNumber",
  0x8827: "iso",
  0x920a: "focalLength",
  0x8825: "gpsInfo",
};

const typeSize: Record<number, number> = {
  1: 1, // BYTE
  2: 1, // ASCII
  3: 2, // SHORT
  4: 4, // LONG
  5: 8, // RATIONAL
};

function buildGps(entries: { tag: number; value: string | number | number[] }[]) {
  const map: Record<number, string | number | number[]> = {};
  entries.forEach((entry) => {
    map[entry.tag] = entry.value;
  });
  const latRef = typeof map[0x0001] === "string" ? (map[0x0001] as string) : undefined;
  const lat = map[0x0002];
  const lonRef = typeof map[0x0003] === "string" ? (map[0x0003] as string) : undefined;
  const lon = map[0x0004];
  const latVal = Array.isArray(lat) ? dmsToDecimal(lat, latRef === "S") : typeof lat === "number" ? lat : null;
  const lonVal = Array.isArray(lon) ? dmsToDecimal(lon, lonRef === "W") : typeof lon === "number" ? lon : null;
  if (latVal != null && lonVal != null) {
    return `${latVal.toFixed(6)}, ${lonVal.toFixed(6)}`;
  }
  return null;
}

function dmsToDecimal(values: number[], negative: boolean | undefined) {
  const [deg = 0, min = 0, sec = 0] = values;
  const decimal = deg + min / 60 + sec / 3600;
  return negative ? -decimal : decimal;
}

async function renderCleanImage(file: File, scale: number): Promise<CleanResult> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    const clampScale = Math.max(0.1, Math.min(1, scale));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * clampScale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * clampScale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0);
    const mime = chooseSafeMime(file.type);
    const cleanedBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error("Failed to export"));
        else resolve(blob);
      }, mime, 0.92);
    });
    const before = await readMetadata(file);
    return {
      cleanedBlob,
      removed: before.map((entry) => entry.key),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = url;
  });
}

function chooseSafeMime(input: string) {
  if (input === "image/png" || input === "image/webp") return input;
  return "image/jpeg";
}

async function readImageDimensions(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return { width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}
