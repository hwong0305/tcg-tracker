import React, { useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";
const STORAGE_KEY = "cardtracker-theme";
const VALID_MODES: ThemeMode[] = ["system", "light", "dark"];

function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID_MODES.includes(stored as ThemeMode) ? (stored as ThemeMode) : "system";
}

function getEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

function applyTheme(effective: "light" | "dark") {
  document.documentElement.dataset.theme = effective;
}

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);

  useEffect(() => {
    applyTheme(getEffectiveTheme(mode));
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  useEffect(() => {
    if (mode !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(getEffectiveTheme("system"));
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [mode]);

  return (
    <label className="theme-toggle">
      <span className="theme-label">Theme</span>
      <select
        aria-label="Theme"
        value={mode}
        onChange={(e) => setMode(e.target.value as ThemeMode)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
