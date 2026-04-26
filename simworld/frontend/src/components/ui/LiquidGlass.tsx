"use client";

/**
 * LiquidGlass
 * -----------
 * Liquid-glass UI primitives (button, dock, generic wrapper) with an
 * SVG-displacement-driven distortion. Adapted for SimWorld's dark
 * emerald-accent theme — the original component was tuned for light
 * backgrounds with `text-black` and a 25% white tint.
 *
 * Usage:
 *   <GlassFilter />            // mount once per page that uses glass
 *   <GlassButton>...</GlassButton>
 *   <GlassEffect className="rounded-2xl px-4 py-2">...</GlassEffect>
 *
 * Notes:
 * - GlassFilter renders an SVG <filter> with id "glass-distortion".
 *   Only one instance per page is needed.
 * - Distortion uses backdrop-filter + an SVG displacement map. The effect
 *   is most visible over photographic / colorful backgrounds; over a flat
 *   dark canvas you'll mostly see the inset highlight + soft refraction.
 */

import React from "react";

// ─── Types ────────────────────────────────────────────────────────────

interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
  onClick?: () => void;
  /** Subtle / standard / strong tint of the glass surface. Default: standard. */
  tint?: "subtle" | "standard" | "strong";
}

export interface DockIcon {
  src: string;
  alt: string;
  onClick?: () => void;
}

// ─── Tint presets tuned for dark backgrounds ───────────────────────────

const TINTS: Record<NonNullable<GlassEffectProps["tint"]>, string> = {
  subtle: "rgba(255, 255, 255, 0.06)",
  standard: "rgba(255, 255, 255, 0.10)",
  strong: "rgba(255, 255, 255, 0.16)",
};

// ─── Glass effect wrapper ──────────────────────────────────────────────

export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
  onClick,
  tint = "standard",
}) => {
  const glassStyle: React.CSSProperties = {
    boxShadow:
      "0 6px 14px rgba(0, 0, 0, 0.35), 0 0 30px rgba(39, 180, 120, 0.04)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const content = (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center font-medium overflow-hidden cursor-pointer transition-all duration-700 text-white/90 ${className}`}
      style={glassStyle}
    >
      {/* L1 — distortion + blur of the layer behind */}
      <div
        className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
        style={{
          backdropFilter: "blur(6px) saturate(1.4)",
          WebkitBackdropFilter: "blur(6px) saturate(1.4)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
          borderRadius: "inherit",
        }}
      />
      {/* L2 — soft white tint */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: TINTS[tint], borderRadius: "inherit" }}
      />
      {/* L3 — inset highlight ("the lit edge of glass") */}
      <div
        className="absolute inset-0 z-20 pointer-events-none"
        style={{
          boxShadow:
            "inset 1px 1px 0.5px 0 rgba(255, 255, 255, 0.35), inset -1px -1px 1px 0 rgba(255, 255, 255, 0.08)",
          borderRadius: "inherit",
        }}
      />
      {/* Content */}
      <div className="relative z-30 flex items-center gap-2">{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="inline-block">
      {content}
    </a>
  ) : (
    content
  );
};

// ─── Button variant ────────────────────────────────────────────────────

interface GlassButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  tint?: GlassEffectProps["tint"];
}

const SIZE_CLASS: Record<NonNullable<GlassButtonProps["size"]>, string> = {
  sm: "rounded-2xl px-3.5 py-2 text-[13px] hover:px-4 hover:py-2.5",
  md: "rounded-3xl px-5 py-3 text-[14px] hover:px-6 hover:py-3.5",
  lg: "rounded-3xl px-10 py-6 text-[18px] hover:px-11 hover:py-7",
};

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  href,
  onClick,
  className = "",
  size = "md",
  tint = "standard",
}) => (
  <GlassEffect
    href={href}
    onClick={onClick}
    tint={tint}
    className={`${SIZE_CLASS[size]} overflow-hidden ${className}`}
  >
    <div
      className="transition-transform duration-700 hover:scale-[0.97] flex items-center gap-2"
      style={{ transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)" }}
    >
      {children}
    </div>
  </GlassEffect>
);

// ─── Dock variant ──────────────────────────────────────────────────────

export const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({ icons, href }) => (
  <GlassEffect href={href} className="rounded-3xl p-3 hover:p-4">
    <div className="flex items-center justify-center gap-2 px-0.5">
      {icons.map((icon, index) => (
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          className="w-14 h-14 transition-all duration-700 hover:scale-110 cursor-pointer"
          style={{
            transformOrigin: "center center",
            transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
          }}
          onClick={icon.onClick}
        />
      ))}
    </div>
  </GlassEffect>
);

// ─── SVG distortion filter (mount once per page) ───────────────────────

export const GlassFilter: React.FC = () => (
  <svg style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }} aria-hidden="true">
    <defs>
      <filter
        id="glass-distortion"
        x="0%"
        y="0%"
        width="100%"
        height="100%"
        filterUnits="objectBoundingBox"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.008 0.012"
          numOctaves="2"
          seed="17"
          result="turbulence"
        />
        <feComponentTransfer in="turbulence" result="mapped">
          <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
          <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
          <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
        </feComponentTransfer>
        <feGaussianBlur in="turbulence" stdDeviation="2.4" result="softMap" />
        <feSpecularLighting
          in="softMap"
          surfaceScale="4"
          specularConstant="0.9"
          specularExponent="100"
          lightingColor="white"
          result="specLight"
        >
          <fePointLight x="-200" y="-200" z="300" />
        </feSpecularLighting>
        <feComposite
          in="specLight"
          operator="arithmetic"
          k1="0"
          k2="1"
          k3="1"
          k4="0"
          result="litImage"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="softMap"
          scale="40"
          xChannelSelector="R"
          yChannelSelector="G"
        />
      </filter>
    </defs>
  </svg>
);
