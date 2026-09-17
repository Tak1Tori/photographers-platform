"use client";

import { useEffect } from "react";

export function SiteMotion() {
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionState = () => {
      const motionDisabled = preference.matches || document.hidden;
      if (motionDisabled) {
        document.querySelectorAll<HTMLElement>('[data-reveal-state="visible"]').forEach((element) => {
          element.dataset.revealState = "complete";
        });
        document.querySelectorAll<HTMLElement>(".hero-light-item").forEach((element) => {
          element.dataset.motionComplete = "true";
        });
      }
      document.documentElement.dataset.motionPaused = String(motionDisabled);
    };

    syncMotionState();
    document.addEventListener("visibilitychange", syncMotionState);
    preference.addEventListener("change", syncMotionState);
    return () => {
      document.removeEventListener("visibilitychange", syncMotionState);
      preference.removeEventListener("change", syncMotionState);
    };
  }, []);

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

  return null;
}
