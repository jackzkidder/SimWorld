"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import type { TimelineRound } from "@/lib/mock-network-data";

interface TimelineScrubberProps {
  rounds: TimelineRound[];
  currentRound: number;
  onRoundChange: (round: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

export default function TimelineScrubber({
  rounds,
  currentRound,
  onRoundChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onSpeedChange,
}: TimelineScrubberProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const totalRounds = rounds.length;
  const maxSentiment = Math.max(...rounds.map((r) => Math.abs(r.aggregate_sentiment)), 0.5);

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      const round = Math.max(1, Math.min(totalRounds, Math.round(pct * totalRounds) + 1));
      onRoundChange(round);
    },
    [totalRounds, onRoundChange]
  );

  const handleDragStart = useCallback(() => setIsDragging(true), []);

  useEffect(() => {
    if (!isDragging) return;

    function handleMove(e: MouseEvent) {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const pct = x / rect.width;
      const round = Math.max(1, Math.min(totalRounds, Math.round(pct * totalRounds) + 1));
      onRoundChange(round);
    }

    function handleUp() {
      setIsDragging(false);
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDragging, totalRounds, onRoundChange]);

  const speeds = [0.5, 1, 2, 4];

  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0A0A0F] via-[#0A0A0F]/95 to-transparent pt-8 pb-4 px-6 z-40">
      {/* Mini sentiment chart */}
      <div className="h-12 mb-2 flex items-end gap-[2px] px-12">
        {rounds.map((round) => {
          const height = (Math.abs(round.aggregate_sentiment) / maxSentiment) * 100;
          const isPositive = round.aggregate_sentiment >= 0;
          const isCurrent = round.round_number === currentRound;
          const isEvent = round.key_event !== null;

          return (
            <div
              key={round.round_number}
              className="flex-1 flex flex-col items-center justify-end relative group"
            >
              {/* Event marker */}
              {isEvent && (
                <div className="absolute -top-3 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
              <div
                className={`w-full rounded-t-sm transition-all duration-150 ${
                  isCurrent ? "opacity-100" : "opacity-60 hover:opacity-80"
                }`}
                style={{
                  height: `${Math.max(height, 4)}%`,
                  backgroundColor: isPositive
                    ? isCurrent ? "#22C55E" : "#22C55E80"
                    : isCurrent ? "#EF4444" : "#EF444480",
                }}
              />
              {/* Tooltip on hover */}
              {isEvent && (
                <div className="hidden group-hover:block absolute bottom-full mb-6 bg-[#0D0D15] border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white/70 whitespace-nowrap z-50 pointer-events-none">
                  {round.key_event}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Scrubber track */}
      <div className="flex items-center gap-4">
        {/* Play/Pause */}
        <button
          onClick={onTogglePlay}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-indigo-600 flex items-center justify-center text-white transition-colors flex-shrink-0"
        >
          {isPlaying ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <rect x="2" y="1" width="3" height="10" rx="0.5" />
              <rect x="7" y="1" width="3" height="10" rx="0.5" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <polygon points="2,1 11,6 2,11" />
            </svg>
          )}
        </button>

        {/* Round indicator */}
        <div className="text-xs font-mono text-white/60 w-16 flex-shrink-0">
          <span className="text-white font-bold">{currentRound}</span>
          <span className="text-white/30">/{totalRounds}</span>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          onMouseDown={handleDragStart}
          className="flex-1 h-6 relative cursor-pointer group"
        >
          {/* Background track */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/10 rounded-full" />

          {/* Progress fill */}
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-indigo-500 rounded-full transition-[width] duration-100"
            style={{ width: `${((currentRound - 1) / (totalRounds - 1)) * 100}%` }}
          />

          {/* Event markers on track */}
          {rounds
            .filter((r) => r.key_event)
            .map((r) => (
              <div
                key={r.round_number}
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 -translate-x-1/2"
                style={{
                  left: `${((r.round_number - 1) / (totalRounds - 1)) * 100}%`,
                }}
              />
            ))}

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-lg shadow-indigo-500/30 border-2 border-indigo-500 transition-[left] duration-100"
            style={{
              left: `${((currentRound - 1) / (totalRounds - 1)) * 100}%`,
            }}
            onMouseDown={handleDragStart}
          />
        </div>

        {/* Speed control */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => onSpeedChange(s)}
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-colors ${
                playbackSpeed === s
                  ? "bg-indigo-600 text-white"
                  : "text-white/30 hover:text-white/60"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Aggregate sentiment */}
        <div className="text-xs font-mono flex-shrink-0">
          <span className="text-white/30">sent: </span>
          <span
            style={{
              color: rounds[currentRound - 1]?.aggregate_sentiment >= 0 ? "#22C55E" : "#EF4444",
            }}
          >
            {rounds[currentRound - 1]?.aggregate_sentiment.toFixed(2) || "0.00"}
          </span>
        </div>
      </div>
    </div>
  );
}
