import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Word } from "../types";

/**
 * "Coree" — kanalning o'z (original) maskot-boshlovchisi.
 * Gapirayotganda og'zi ochilib-yopiladi, ko'zlarini pirpiratadi va ritmda tebranadi.
 */
export const MascotSvg: React.FC<{ mouthOpen: number; blink: number; size: number; look?: number }> = ({
  mouthOpen,
  blink,
  size,
  look = 0,
}) => {
  const eyeScale = 1 - blink;
  const mouthRy = 4 + mouthOpen * 20;
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="coree-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3DF2FF" />
          <stop offset="100%" stopColor="#7B2FF7" />
        </linearGradient>
      </defs>
      {/* antenna: nota */}
      <path d="M100 40 C100 25 112 12 124 10" stroke="black" strokeWidth={6} fill="none" strokeLinecap="round" />
      <circle cx={128} cy={10} r={11} fill="#FFE600" stroke="black" strokeWidth={5} />
      {/* tana */}
      <rect x={30} y={40} width={140} height={190} rx={65} fill="url(#coree-body)" stroke="black" strokeWidth={7} />
      {/* quloqchin */}
      <path d="M22 120 C22 30 178 30 178 120" stroke="black" strokeWidth={12} fill="none" />
      <path d="M22 120 C22 30 178 30 178 120" stroke="#FF3DB4" strokeWidth={6} fill="none" />
      <rect x={6} y={100} width={34} height={56} rx={14} fill="#FF3DB4" stroke="black" strokeWidth={6} />
      <rect x={160} y={100} width={34} height={56} rx={14} fill="#FF3DB4" stroke="black" strokeWidth={6} />
      {/* ko'zlar */}
      <g transform={`translate(0 ${100 * (1 - eyeScale)}) scale(1 ${eyeScale})`}>
        <ellipse cx={75} cy={100} rx={22} ry={26} fill="white" stroke="black" strokeWidth={5} />
        <ellipse cx={125} cy={100} rx={22} ry={26} fill="white" stroke="black" strokeWidth={5} />
        <circle cx={78 + look * 6} cy={104} r={10} fill="black" />
        <circle cx={128 + look * 6} cy={104} r={10} fill="black" />
        <circle cx={82 + look * 6} cy={99} r={3.5} fill="white" />
        <circle cx={132 + look * 6} cy={99} r={3.5} fill="white" />
      </g>
      {/* yonoqlar */}
      <ellipse cx={58} cy={140} rx={12} ry={7} fill="#FF7AD9" opacity={0.8} />
      <ellipse cx={142} cy={140} rx={12} ry={7} fill="#FF7AD9" opacity={0.8} />
      {/* og'iz */}
      <ellipse cx={100} cy={152} rx={20} ry={mouthRy} fill="#2a0020" stroke="black" strokeWidth={5} />
      {mouthOpen > 0.25 ? <ellipse cx={100} cy={152 + mouthRy * 0.45} rx={11} ry={mouthRy * 0.35} fill="#FF4F7B" /> : null}
    </svg>
  );
};

export const Mascot: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;
  const nowMs = (frame / fps) * 1000;

  const talking = words.some((w) => nowMs >= w.startMs && nowMs < w.endMs + 40);
  const mouthOpen = talking ? 0.35 + 0.65 * Math.abs(Math.sin(frame * 0.85)) : 0;

  // Har ~3.3 soniyada pirpiratadi
  const blinkFrame = frame % 100;
  const blink = interpolate(blinkFrame, [0, 2, 4], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const enter = spring({ frame, fps, config: { damping: 10 } });
  const bob = Math.sin(frame / 7) * (talking ? 10 : 5);
  const tilt = Math.sin(frame / 15) * 4;
  const size = vertical ? width * 0.26 : width * 0.11;

  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? width * 0.03 : width * 0.015,
        bottom: vertical ? height * 0.025 : height * 0.02,
        transform: `translateY(${(1 - enter) * size * 1.5 + bob}px) rotate(${tilt}deg)`,
        transformOrigin: "50% 100%",
        filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.45))",
      }}
    >
      <MascotSvg mouthOpen={mouthOpen} blink={blink} size={size} look={Math.sin(frame / 40)} />
    </div>
  );
};
