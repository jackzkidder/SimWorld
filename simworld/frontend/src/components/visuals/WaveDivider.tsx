"use client";

interface Props {
  className?: string;
  fromColor?: string;
  toColor?: string;
  height?: number;
}

export function WaveDivider({
  className = "",
  fromColor = "hsl(25, 50%, 3%)",
  toColor = "hsl(38, 40%, 98%)",
  height = 160,
}: Props) {
  return (
    <div className={`relative w-full overflow-hidden ${className}`} style={{ height }}>
      {/* Background gradient */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${fromColor}, ${toColor})` }}
      />

      {/* Layered SVG waves */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wave 1 — primary, subtle */}
        <path
          d="M0,80 C240,40 480,120 720,80 C960,40 1200,100 1440,60 L1440,160 L0,160 Z"
          fill="rgba(64,180,130,0.04)"
        />
        {/* Wave 2 — offset */}
        <path
          d="M0,100 C180,70 420,130 720,90 C1020,50 1260,110 1440,80 L1440,160 L0,160 Z"
          fill="rgba(64,180,130,0.03)"
        />
        {/* Wave 3 — gentle */}
        <path
          d="M0,120 C360,100 720,140 1080,110 C1260,95 1380,120 1440,105 L1440,160 L0,160 Z"
          fill="rgba(64,180,130,0.02)"
        />
        {/* Scattered dots along the wave crest */}
        {[120, 280, 440, 600, 760, 920, 1080, 1240].map((x) => (
          <circle
            key={x}
            cx={x}
            cy={75 + Math.sin(x * 0.005) * 15}
            r="1.5"
            fill="rgba(64,180,130,0.12)"
          />
        ))}
      </svg>
    </div>
  );
}
