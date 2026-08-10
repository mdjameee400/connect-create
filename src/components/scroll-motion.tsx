"use client";

import { motion, useScroll, useSpring, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Thin ink progress bar pinned under the sticky header. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  return (
    <motion.div
      id="scroll-indicator"
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-50 h-[3px] bg-foreground origin-left"
      style={{ scaleX }}
    />
  );
}

const HEADER_OFFSET = 64;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Eased scroll to an element id, accounting for the sticky header. */
export function smoothScrollTo(id: string, reduced = false) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
  if (reduced) {
    window.scrollTo(0, target);
    return;
  }
  const start = window.scrollY;
  const distance = target - start;
  const duration = Math.min(1100, Math.max(450, Math.abs(distance) * 0.6));
  let startTime: number | null = null;

  const step = (now: number) => {
    if (startTime === null) startTime = now;
    const progress = Math.min(1, (now - startTime) / duration);
    window.scrollTo(0, start + distance * easeInOutCubic(progress));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Anchor that glides to its section instead of jumping. */
export function SmoothLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const id = href.replace("#", "");
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        smoothScrollTo(id, !!reduced);
        window.history.replaceState(null, "", href);
      }}
    >
      {children}
    </a>
  );
}

/** Fade + rise a section into view as it enters the viewport. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
