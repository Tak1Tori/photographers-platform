"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Theme = "dark" | "light";

const themeStorageKey = "framely-theme";
const blackoutCoverDuration = 420;
const blackoutHoldDuration = 180;
const blackoutRevealDuration = 720;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

export function ThemePullToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [isPulling, setIsPulling] = useState(false);
  const [blackoutPhase, setBlackoutPhase] = useState<"covering" | "revealing" | null>(null);
  const timeouts = useRef<number[]>([]);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    const nextTheme: Theme = savedTheme === "light" ? "light" : "dark";

    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  useEffect(() => {
    return () => timeouts.current.forEach((timeout) => window.clearTimeout(timeout));
  }, []);

  const toggleTheme = () => {
    if (isPulling) {
      return;
    }

    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setIsPulling(true);
    setBlackoutPhase("covering");

    timeouts.current = [
      window.setTimeout(() => {
        applyTheme(nextTheme);
        window.localStorage.setItem(themeStorageKey, nextTheme);
        setTheme(nextTheme);
        setBlackoutPhase("revealing");
      }, blackoutCoverDuration + blackoutHoldDuration),
      window.setTimeout(() => {
        setBlackoutPhase(null);
        setIsPulling(false);
      }, blackoutCoverDuration + blackoutHoldDuration + blackoutRevealDuration)
    ];
  };

  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const nextThemeLabel = theme === "dark" ? "светлую" : "темную";

  return (
    <>
      {blackoutPhase && typeof document !== "undefined"
        ? createPortal(
            <span className={`theme-blackout is-${blackoutPhase}`} aria-hidden="true" />,
            document.body
          )
        : null}
      <button
        type="button"
        className="theme-pull-toggle"
        onClick={toggleTheme}
        aria-label={`Включить ${nextThemeLabel} тему`}
        aria-pressed={theme === "light"}
        title={`Включить ${nextThemeLabel} тему`}
      >
        <span className={`theme-pull-cord${isPulling ? " is-pulling" : ""}`}>
          <span className="theme-pull-string" />
          <span className="theme-pull-knob">
            <ThemeIcon className="size-4" aria-hidden="true" />
          </span>
        </span>
      </button>
    </>
  );
}
