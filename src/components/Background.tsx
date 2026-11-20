import React, { useMemo } from "react";
import { AbsoluteFill, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTES } from "../types";

/** Rang-barang, sekin harakatlanuvchi fon: gradient + suzuvchi "musiqa pufakchalari". */
export const Background: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [a, b, c] = PALETTES[seed % PALETTES.length];

  const bubbles = useMemo(
    () =>
      new Array(26).fill(0).map((_, i) => ({
        x: random(`x-${seed}-${i}`) * width,
        y: random(`y-${seed}-${i}`) * height,
        r: 10 + random(`r-${seed}-${i}`) * Math.min(width, height) * 0.05,
        speed: 0.4 + random(`s-${seed}-${i}`) * 1.4,
        phase: random(`p-${seed}-${i}`) * Math.PI * 2,
      })),
    [seed, width, height],
  );

  const angle = interpolate(frame, [0, 600], [135, 225], { extrapolateRight: "extend" });

  return (
    <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 45%, ${c} 100%)` }}>
      {bubbles.map((bubble, i) => {
        const y = (bubble.y - frame * bubble.speed * 2 + height * 2) % (height + bubble.r * 4) - bubble.r * 2;
        const x = bubble.x + Math.sin(frame / 25 + bubble.phase) * 20;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: bubble.r * 2,
              height: bubble.r * 2,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.18)",
              filter: "blur(2px)",
            }}
          />
        );
      })}
      <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 45%, transparent 40%, rgba(0,0,0,0.45) 100%)" }} />
    </AbsoluteFill>
  );
};
