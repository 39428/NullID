import { useEffect, useRef, useState } from "react";

export function useCommandHistory(key: string) {
  const storageKey = `nullid-history:${key}`;
  const [entries, setEntries] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const cursor = useRef<number>(entries.length);

  useEffect(() => {
    cursor.current = entries.length;
    localStorage.setItem(storageKey, JSON.stringify(entries.slice(-50)));
  }, [entries, storageKey]);

  const push = (value: string) => {
    if (!value.trim()) return;
    setEntries((prev) => [...prev.filter((entry) => entry !== value), value]);
  };

  const navigate = (delta: 1 | -1): string => {
    const next = Math.min(Math.max(0, cursor.current + delta), entries.length);
    cursor.current = next;
    return entries[next] ?? "";
  };

  const resetCursor = () => {
    cursor.current = entries.length;
  };

  return { entries, push, navigate, resetCursor };
}
