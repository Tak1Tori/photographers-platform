"use client";

import { useEffect, useRef } from "react";

export function CursorGlow() {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = glowRef.current;

    if (!glow) {
      return;
    }

    const motionPreference = window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)");
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let animationFrame = 0;

    const isMotionDisabled = () =>
      motionPreference.matches ||
      document.hidden ||
      document.documentElement.dataset.motionPaused === "true";

    const hideGlow = () => {
      glow.dataset.visible = "false";
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    const updatePosition = () => {
      animationFrame = 0;

      if (isMotionDisabled()) {
        hideGlow();
        return;
      }

      const isSettled = Math.abs(targetX - currentX) < 0.15 && Math.abs(targetY - currentY) < 0.15;
      currentX = isSettled ? targetX : currentX + (targetX - currentX) * 0.16;
      currentY = isSettled ? targetY : currentY + (targetY - currentY) * 0.16;
      glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;

      if (!isSettled) {
        animationFrame = window.requestAnimationFrame(updatePosition);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (
        isMotionDisabled() ||
        (event.target instanceof Element && event.target.closest("[data-dot-scene]"))
      ) {
        hideGlow();
        return;
      }

      targetX = event.clientX;
      targetY = event.clientY;

      if (glow.dataset.visible !== "true") {
        currentX = targetX;
        currentY = targetY;
      }

      glow.dataset.visible = "true";

      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updatePosition);
      }
    };

    const handleMotionChange = () => {
      if (isMotionDisabled()) hideGlow();
    };

    const motionObserver = new MutationObserver(handleMotionChange);
    motionObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion-paused"]
    });

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", hideGlow);
    document.documentElement.addEventListener("mouseleave", hideGlow);
    document.addEventListener("visibilitychange", handleMotionChange);
    motionPreference.addEventListener("change", handleMotionChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", hideGlow);
      document.documentElement.removeEventListener("mouseleave", hideGlow);
      document.removeEventListener("visibilitychange", handleMotionChange);
      motionPreference.removeEventListener("change", handleMotionChange);
      motionObserver.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <>
      <svg className="cursor-filter-definitions" aria-hidden="true">
        <filter id="cursor-refraction" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018 0.028"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="B"
          />
        </filter>
      </svg>
      <div ref={glowRef} className="cursor-glow" data-visible="false" aria-hidden="true">
        <div className="cursor-lens">
          <div className="cursor-lens-distortion" />
          <div className="cursor-lens-edge" />
        </div>
      </div>
    </>
  );
}
