"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

const MOTION_PREFERENCE_KEY = "framely-motion-paused";

export function SiteMotion() {
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setReducedMotion(preference.matches);
    syncPreference();
    try {
      setPaused(window.localStorage.getItem(MOTION_PREFERENCE_KEY) === "true");
    } catch {
      // Motion controls also work when storage is unavailable.
    }
    setReady(true);
    preference.addEventListener("change", syncPreference);
    return () => preference.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const syncVisibility = () => {
      if (paused || reducedMotion || document.hidden) {
        document.querySelectorAll<HTMLElement>('[data-reveal-state="visible"]').forEach((element) => {
          element.dataset.revealState = "complete";
        });
        document.querySelectorAll<HTMLElement>(".hero-light-item").forEach((element) => {
          element.dataset.motionComplete = "true";
        });
      }
      document.documentElement.dataset.motionPaused = String(paused || reducedMotion || document.hidden);
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [paused, reducedMotion]);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;

    const registered = new WeakSet<Element>();
    const reveals = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        const element = target as HTMLElement;
        const motionDisabled = document.documentElement.dataset.motionPaused === "true" ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        element.dataset.revealState = element.dataset.revealState === "waiting" && !motionDisabled
          ? "visible" : "complete";
        reveals.unobserve(target);
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -24px 0px" });

    const scenes = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        (target as HTMLElement).dataset.motionActive = String(isIntersecting);
      });
    });

    const register = (element: HTMLElement) => {
      if (registered.has(element)) return;
      registered.add(element);
      if (element.hasAttribute("data-reveal")) {
        // Keep server-rendered content readable without JavaScript. Only prepare
        // offscreen elements, so hydration cannot hide content already being read.
        const bounds = element.getBoundingClientRect();
        const offscreen = bounds.top >= window.innerHeight - 24 || bounds.bottom <= 0 ||
          bounds.left >= window.innerWidth || bounds.right <= 0;
        element.dataset.revealState = offscreen ? "waiting" : "complete";
        reveals.observe(element);
      }
      if (element.hasAttribute("data-motion-scope")) scenes.observe(element);
    };

    const discover = (root: Element) => {
      if (root instanceof HTMLElement && root.matches("[data-reveal], [data-motion-scope]")) register(root);
      root.querySelectorAll<HTMLElement>("[data-reveal], [data-motion-scope]").forEach(register);
    };
    const forget = (root: Element) => {
      if (root.isConnected) return;
      const unregister = (element: Element) => {
        reveals.unobserve(element);
        scenes.unobserve(element);
        registered.delete(element);
      };
      unregister(root);
      root.querySelectorAll("[data-reveal], [data-motion-scope]").forEach(unregister);
    };
    discover(document.body);

    const finishReveal = (event: AnimationEvent) => {
      if (!(event.target instanceof HTMLElement)) return;
      if (event.animationName === "section-reveal") {
        event.target.dataset.revealState = "complete";
      }
      if (event.animationName === "hero-light-content") {
        event.target.dataset.motionComplete = "true";
      }
    };
    document.addEventListener("animationend", finishReveal);

    // Include streamed content, newly filtered cards and client-side navigation.
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => {
        record.removedNodes.forEach((node) => {
          if (node instanceof Element) forget(node);
        });
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) discover(node);
        });
      });
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      reveals.disconnect();
      scenes.disconnect();
      mutations.disconnect();
      document.removeEventListener("animationend", finishReveal);
    };
  }, []);

  function toggleMotion() {
    const next = !paused;
    setPaused(next);
    try {
      window.localStorage.setItem(MOTION_PREFERENCE_KEY, String(next));
    } catch {
      // The current session still respects the user's choice.
    }
  }

  if (!ready || reducedMotion) return null;

  return (
    <button
      type="button"
      onClick={toggleMotion}
      aria-label={paused ? "Включить анимации" : "Приостановить анимации"}
      aria-pressed={paused}
      title={paused ? "Включить анимации" : "Приостановить анимации"}
      className="motion-control fixed bottom-4 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/90 px-4 text-xs font-medium text-muted-foreground shadow-lg backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {paused ? <Play className="size-3.5" aria-hidden="true" /> : <Pause className="size-3.5" aria-hidden="true" />}
      Анимации
    </button>
  );
}
