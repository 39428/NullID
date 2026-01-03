import { themeTokens, ThemeMode } from "./tokens";

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  const palette = themeTokens[mode];
  Object.entries(palette).forEach(([key, value]) => {
    root.style.setProperty(`--${toKebab(key)}`, value);
  });
  root.dataset.theme = mode;
}

function toKebab(value: string) {
  return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
