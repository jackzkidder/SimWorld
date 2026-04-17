"use client";

import { useEffect, useRef, ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  delay?: number;
  threshold?: number;
}

export function Reveal({
  children,
  className = "",
  stagger = false,
  delay,
  threshold = 0.15,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  const delayClass = delay ? `reveal-delay-${delay}` : "";
  const baseClass = stagger ? "reveal-stagger reveal" : "reveal";

  return (
    <div ref={ref} className={`${baseClass} ${delayClass} w-full ${className}`}>
      {children}
    </div>
  );
}
