export const PROFILE_SCHEMA_VERSION = 1;
const PREFIX = "nullid:";

export type ProfileSnapshot = {
  schemaVersion: number;
  exportedAt: string;
  entries: Record<string, unknown>;
};

export function collectProfile(): ProfileSnapshot {
  const entries: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIX)) continue;
    const value = localStorage.getItem(key);
    try {
      entries[key] = value ? JSON.parse(value) : null;
    } catch {
      entries[key] = value;
    }
  }
  return {
    schemaVersion: PROFILE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entries,
  };
}

export function downloadProfile(filename = "nullid-profile.json") {
  const snapshot = collectProfile();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function importProfileFile(file: File): Promise<{ applied: number }> {
  const text = await file.text();
  const parsed = JSON.parse(text) as Partial<ProfileSnapshot>;
  if (parsed.schemaVersion !== PROFILE_SCHEMA_VERSION) {
    throw new Error("Unsupported profile schema");
  }
  if (!parsed.entries || typeof parsed.entries !== "object") {
    throw new Error("Invalid profile payload");
  }
  const entries = parsed.entries as Record<string, unknown>;
  let applied = 0;
  Object.entries(entries).forEach(([key, value]) => {
    if (!key.startsWith(PREFIX)) return;
    if (!isSupportedValue(value)) return;
    localStorage.setItem(key, JSON.stringify(value));
    applied += 1;
  });
  return { applied };
}

function isSupportedValue(value: unknown): value is string | number | boolean | null | Record<string, unknown> | unknown[] {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return true;
  if (Array.isArray(value)) return value.every(isSupportedValue);
  if (t === "object") return Object.values(value as Record<string, unknown>).every(isSupportedValue);
  return false;
}
