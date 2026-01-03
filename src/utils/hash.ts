import { toBase64, toHex, utf8ToBytes } from "./encoding.js";

export type HashAlgorithm = "SHA-256" | "SHA-512" | "SHA-1";

export interface HashResult {
  hex: string;
  base64: string;
}

export interface HashOptions {
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export async function hashText(text: string, algorithm: HashAlgorithm): Promise<HashResult> {
  const digest = await crypto.subtle.digest(algorithm, utf8ToBytes(text).buffer as ArrayBuffer);
  const bytes = new Uint8Array(digest);
  return {
    hex: toHex(bytes),
    base64: toBase64(bytes),
  };
}

export async function hashFile(file: File, algorithm: HashAlgorithm, options?: HashOptions): Promise<HashResult> {
  const chunkSize = 1024 * 1024 * 2; // 2MB chunks
  const chunks: Uint8Array[] = [];
  let offset = 0;
  let total = 0;
  while (offset < file.size) {
    const end = Math.min(offset + chunkSize, file.size);
    const slice = file.slice(offset, end);
    const buffer = new Uint8Array(await slice.arrayBuffer());
    chunks.push(buffer);
    total += buffer.length;
    offset = end;
    options?.onProgress?.(Math.round((offset / file.size) * 100));
    if (options?.signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  const merged = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => {
    merged.set(chunk, cursor);
    cursor += chunk.length;
  });
  const digest = await crypto.subtle.digest(algorithm, merged.buffer);
  const bytes = new Uint8Array(digest);
  return {
    hex: toHex(bytes),
    base64: toBase64(bytes),
  };
}

export function normalizeHashInput(value: string): string {
  return value.replace(/[^a-f0-9]/gi, "").toLowerCase();
}

export const expectedHashLengths: Record<HashAlgorithm, number> = {
  "SHA-1": 40,
  "SHA-256": 64,
  "SHA-512": 128,
};
