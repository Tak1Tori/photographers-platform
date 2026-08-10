"use client";

import { useEffect, useRef } from "react";

const COLUMNS = 12;
const ROWS = 7;
const DOTS = Array.from({ length: COLUMNS * ROWS }, (_, index) => {
  const column = (index % COLUMNS) + 1;
  const row = Math.floor(index / COLUMNS) + 1;

  return {
    column,
    row,
    x: (column - 0.5) / COLUMNS,
    y: (row - 0.5) / ROWS,
    isMobileVisible:
      (column % 2 === 1 && row % 2 === 1) ||
      (column % 3 === 0 && (row === 2 || row === 6))
  };
}).filter(({ x, y }) => {
  const horizontalDistance = (x - 0.5) / 0.38;
  const verticalDistance = (y - 0.5) / 0.27;

  return horizontalDistance ** 2 + verticalDistance ** 2 >= 1;
});

export function HeroDotField() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const field = fieldRef.current;

    if (
      !field ||
      window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let frame = 0;
    let pointer: { x: number; y: number } | undefined;
    let wasActive = false;

    const resetDots = () => {
      dotRefs.current.forEach((dot) => {
        dot?.style.setProperty("--dot-scale", "1");
        dot?.style.setProperty("--dot-opacity", "1");
        dot?.style.setProperty("--dot-lightness", "91%");
      });
    };

    const render = () => {
      frame = 0;
      const activePointer = pointer;

      if (!activePointer) {
        if (wasActive) {
          resetDots();
          wasActive = false;
        }
        return;
      }

      const bounds = field.getBoundingClientRect();
      const radius = Math.min(bounds.width, bounds.height) * 0.24;

      DOTS.forEach((dot, index) => {
        const element = dotRefs.current[index];
        if (!element) return;

        const x = bounds.left + bounds.width * dot.x;
        const y = bounds.top + bounds.height * dot.y;
        const distance = Math.hypot(activePointer.x - x, activePointer.y - y);
        const proximity = Math.max(0, 1 - distance / radius);

        element.style.setProperty("--dot-scale", `${1 + proximity * 3.4}`);
        element.style.setProperty("--dot-opacity", `${0.56 + proximity * 0.44}`);
        element.style.setProperty("--dot-lightness", proximity > 0.05 ? "100%" : "91%");
      });

      wasActive = true;
    };

    const scheduleRender = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(render);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = field.getBoundingClientRect();
      const isInside =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;

      pointer = isInside ? { x: event.clientX, y: event.clientY } : undefined;
      scheduleRender();
    };

    const handlePointerLeave = () => {
      pointer = undefined;
      scheduleRender();
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener("mouseleave", handlePointerLeave);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={fieldRef} className="hero-dot-field pointer-events-none absolute inset-0" aria-hidden="true">
      {DOTS.map((dot, index) => (
        <span
          key={index}
          ref={(element) => {
            dotRefs.current[index] = element;
          }}
          className={`hero-dot${dot.isMobileVisible ? ` hero-dot-pulse-${index % 4}` : ""}`}
          data-mobile-visible={dot.isMobileVisible}
          style={{ gridColumn: dot.column, gridRow: dot.row }}
        />
      ))}
    </div>
  );
}
