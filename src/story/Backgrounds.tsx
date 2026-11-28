// Hikoya sahnalari uchun animatsiyali fonlar (SVG, 1920x1080 viewBox, vertikalda markazdan kesiladi)
import React from "react";
import { random, useCurrentFrame } from "remotion";
import type { Location } from "./types";

const W = 1920;
const H = 1080;
export const FLOOR_Y = 0.76; // qahramonlar turadigan chiziq (balandlik ulushi)

const Stars: React.FC<{ n: number; seed: string; frame: number }> = ({ n, seed, frame }) => (
  <g>
    {new Array(n).fill(0).map((_, i) => (
      <circle
        key={i}
        cx={random(`${seed}x${i}`) * W}
        cy={random(`${seed}y${i}`) * H * 0.6}
        r={1.5 + random(`${seed}r${i}`) * 3}
        fill="white"
        opacity={0.4 + 0.6 * Math.abs(Math.sin(frame / 20 + i))}
      />
    ))}
  </g>
);

const Clouds: React.FC<{ frame: number; color?: string }> = ({ frame, color = "white" }) => (
  <g opacity={0.85}>
    {[0, 1, 2, 3].map((i) => {
      const x = ((i * 620 + frame * (0.6 + i * 0.2)) % (W + 600)) - 300;
      const y = 120 + i * 70;
      return (
        <g key={i} transform={`translate(${x} ${y})`} fill={color}>
          <ellipse cx={0} cy={0} rx={110} ry={45} />
          <ellipse cx={70} cy={-25} rx={80} ry={50} />
          <ellipse cx={140} cy={5} rx={90} ry={38} />
        </g>
      );
    })}
  </g>
);

const Sky: React.FC<{ top: string; bottom: string; id: string }> = ({ top, bottom, id }) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={top} />
        <stop offset="1" stopColor={bottom} />
      </linearGradient>
    </defs>
    <rect width={W} height={H} fill={`url(#${id})`} />
  </>
);

const ground = (color: string, edge: string) => (
  <>
    <rect y={H * FLOOR_Y - 10} width={W} height={H} fill={color} />
    <rect y={H * FLOOR_Y - 10} width={W} height={14} fill={edge} />
  </>
);

export const SceneBackground: React.FC<{ location: Location; time: "day" | "night" }> = ({ location, time }) => {
  const frame = useCurrentFrame();
  const night = time === "night";
  let body: React.ReactNode;
  switch (location) {
    case "forest":
      body = (
        <>
          <Sky id="sf" top={night ? "#0b1a3a" : "#7ED3FF"} bottom={night ? "#1d3b4a" : "#D8F6FF"} />
          {night ? <Stars n={60} seed="f" frame={frame} /> : <Clouds frame={frame} />}
          {[0, 1].map((layer) =>
            new Array(9).fill(0).map((_, i) => {
              const x = i * 240 + (layer ? 120 : 0) - 60;
              const h = 330 + random(`t${layer}${i}`) * 160;
              const base = H * FLOOR_Y;
              return (
                <g key={`${layer}-${i}`} opacity={layer ? 1 : 0.6}>
                  <rect x={x - 18} y={base - h * 0.35} width={36} height={h * 0.35} fill="#6B3E1F" />
                  <polygon points={`${x},${base - h} ${x - 120},${base - h * 0.3} ${x + 120},${base - h * 0.3}`} fill={layer ? "#2FAE4E" : "#1F7A3A"} stroke="black" strokeWidth={layer ? 5 : 0} />
                </g>
              );
            }),
          )}
          {ground("#4CCB5A", "#2E9E3E")}
          {night
            ? new Array(18).fill(0).map((_, i) => (
                <circle key={i} cx={(random(`ff${i}`) * W + frame * 0.8) % W} cy={H * 0.4 + Math.sin(frame / 15 + i) * 60 + random(`fy${i}`) * 250} r={6} fill="#FFF67A" opacity={0.5 + 0.5 * Math.sin(frame / 7 + i)} />
              ))
            : null}
        </>
      );
      break;
    case "city":
      body = (
        <>
          <Sky id="sc" top={night ? "#120a35" : "#FF9ACB"} bottom={night ? "#3a1f6b" : "#FFE0A3"} />
          {night ? <Stars n={50} seed="c" frame={frame} /> : <Clouds frame={frame} />}
          {new Array(14).fill(0).map((_, i) => {
            const w = 110 + random(`bw${i}`) * 60;
            const h = 280 + random(`bh${i}`) * 380;
            const x = i * 140 - 20;
            return (
              <g key={i}>
                <rect x={x} y={H * FLOOR_Y - h} width={w} height={h} fill={["#3D2A8C", "#5B3FC4", "#2A1F66"][i % 3]} stroke="black" strokeWidth={5} />
                {new Array(Math.floor(h / 60)).fill(0).map((__, r) =>
                  [0, 1].map((c) => (
                    <rect key={`${r}-${c}`} x={x + 20 + c * (w / 2 - 5)} y={H * FLOOR_Y - h + 20 + r * 60} width={w / 2 - 35} height={30} fill={(night ? random(`win${i}${r}${c}`) > 0.35 : random(`win${i}${r}${c}`) > 0.8) ? "#FFE66B" : "#1a1240"} />
                  )),
                )}
              </g>
            );
          })}
          {ground("#3b3b4f", "#FF3DB4")}
        </>
      );
      break;
    case "space":
      body = (
        <>
          <Sky id="ss" top="#05021a" bottom="#2a0b4f" />
          <Stars n={140} seed="s" frame={frame} />
          <circle cx={1500} cy={260 + Math.sin(frame / 60) * 10} r={150} fill="#FF8AD8" stroke="black" strokeWidth={6} />
          <ellipse cx={1500} cy={260 + Math.sin(frame / 60) * 10} rx={240} ry={40} fill="none" stroke="#FFE14D" strokeWidth={14} />
          <circle cx={300} cy={200} r={70} fill="#3DF2FF" stroke="black" strokeWidth={5} />
          {ground("#6b5fa8", "#A04DFF")}
          {new Array(8).fill(0).map((_, i) => (
            <ellipse key={i} cx={i * 260 + 80} cy={H * FLOOR_Y + 60 + (i % 2) * 70} rx={60} ry={20} fill="#544a8c" />
          ))}
        </>
      );
      break;
    case "beach":
      body = (
        <>
          <Sky id="sb" top={night ? "#0f1c4d" : "#3DC8FF"} bottom={night ? "#3b2a6b" : "#BDF0FF"} />
          {night ? <Stars n={60} seed="b" frame={frame} /> : <Clouds frame={frame} />}
          <circle cx={W * 0.78} cy={220} r={110} fill={night ? "#F4F4F4" : "#FFE14D"} stroke="black" strokeWidth={6} />
          <rect y={H * 0.55} width={W} height={H * 0.25} fill={night ? "#1d3a8a" : "#2E8BFF"} />
          {new Array(10).fill(0).map((_, i) => (
            <path key={i} d={`M ${i * 200 + ((frame * 2) % 200) - 200} ${H * 0.6 + (i % 3) * 40} q 50 -25 100 0`} stroke="white" strokeWidth={6} fill="none" opacity={0.7} />
          ))}
          {ground("#FFD98A", "#E8B85C")}
          <g transform={`translate(240 ${H * FLOOR_Y}) rotate(${Math.sin(frame / 30) * 3})`}>
            <rect x={-14} y={-380} width={28} height={380} fill="#8B5A2B" stroke="black" strokeWidth={5} />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <ellipse key={a} cx={0} cy={-380} rx={130} ry={30} fill="#2FAE4E" stroke="black" strokeWidth={5} transform={`rotate(${a} 0 -380) translate(90 0)`} />
            ))}
          </g>
        </>
      );
      break;
    case "castle":
      body = (
        <>
          <Sky id="sk" top={night ? "#0c0626" : "#8E7BFF"} bottom={night ? "#3d1d5c" : "#FFC7F0"} />
          {night ? <Stars n={80} seed="k" frame={frame} /> : <Clouds frame={frame} />}
          <circle cx={1550} cy={180} r={90} fill="#FFF6C8" opacity={night ? 1 : 0.5} />
          <g fill="#3a2a5c" stroke="black" strokeWidth={6}>
            <rect x={560} y={330} width={800} height={500} />
            {[500, 840, 1300].map((x, i) => (
              <g key={x}>
                <rect x={x} y={i === 1 ? 160 : 240} width={i === 1 ? 240 : 140} height={600} />
                <polygon points={`${x - 20},${i === 1 ? 160 : 240} ${x + (i === 1 ? 120 : 70)},${i === 1 ? 20 : 120} ${x + (i === 1 ? 260 : 160)},${i === 1 ? 160 : 240}`} fill="#A04DFF" />
              </g>
            ))}
          </g>
          {[700, 1000, 1200].map((x, i) => (
            <rect key={x} x={x} y={460} width={60} height={90} rx={30} fill="#FFD23F" opacity={0.6 + 0.4 * Math.sin(frame / 10 + i)} />
          ))}
          {ground("#4a3b6b", "#2a1f44")}
        </>
      );
      break;
    case "cave":
      body = (
        <>
          <Sky id="sv" top="#140b07" bottom="#3a2416" />
          {new Array(12).fill(0).map((_, i) => (
            <polygon key={i} points={`${i * 170},0 ${i * 170 + 60},${120 + (i % 3) * 60} ${i * 170 + 120},0`} fill="#2a1a10" stroke="black" strokeWidth={4} />
          ))}
          {new Array(9).fill(0).map((_, i) => {
            const x = 100 + i * 210;
            const glow = 0.5 + 0.5 * Math.sin(frame / 12 + i);
            const c = ["#3DF2FF", "#FF3DB4", "#A04DFF"][i % 3];
            return (
              <g key={i} opacity={0.7 + glow * 0.3}>
                <polygon points={`${x},${H * FLOOR_Y} ${x + 30},${H * FLOOR_Y - 140 - (i % 2) * 60} ${x + 60},${H * FLOOR_Y}`} fill={c} stroke="black" strokeWidth={4} />
                <circle cx={x + 30} cy={H * FLOOR_Y - 60} r={90} fill={c} opacity={0.15 * glow} />
              </g>
            );
          })}
          {ground("#4a3020", "#2a1a10")}
        </>
      );
      break;
    case "studio":
      body = (
        <>
          <Sky id="st" top="#1a1340" bottom="#2c1f5e" />
          {new Array(10).fill(0).map((_, i) =>
            [0, 1, 2].map((r) => <rect key={`${i}-${r}`} x={40 + i * 190} y={60 + r * 150} width={160} height={120} rx={14} fill={(i + r) % 2 ? "#3a2c7a" : "#4a3a96"} stroke="black" strokeWidth={4} />),
          )}
          <text x={W / 2} y={150} textAnchor="middle" fontSize={110} fontFamily="sans-serif" fontWeight={900} fill="#FF3DB4" opacity={0.75 + 0.25 * Math.sin(frame / 6)} stroke="black" strokeWidth={4}>
            ON AIR
          </text>
          <rect x={W / 2 - 400} y={H * FLOOR_Y - 170} width={800} height={170} rx={20} fill="#222" stroke="black" strokeWidth={6} />
          {new Array(16).fill(0).map((_, i) => (
            <rect key={i} x={W / 2 - 370 + i * 46} y={H * FLOOR_Y - 140 + 60 * (1 - Math.abs(Math.sin(frame / 5 + i)))} width={26} height={110 - 60 * (1 - Math.abs(Math.sin(frame / 5 + i)))} fill={["#36E27B", "#FFD23F", "#FF4D6D"][i % 3]} />
          ))}
          {ground("#2a2140", "#3DF2FF")}
        </>
      );
      break;
    case "candy":
      body = (
        <>
          <Sky id="sy" top={night ? "#3a1450" : "#FFB3E6"} bottom={night ? "#6b2a7a" : "#FFF0B3"} />
          {night ? <Stars n={50} seed="y" frame={frame} /> : <Clouds frame={frame} color="#FFF6FB" />}
          {[150, 520, 1350, 1750].map((x, i) => (
            <g key={x} transform={`translate(${x} ${H * FLOOR_Y})`}>
              <rect x={-10} y={-300} width={20} height={300} fill="white" stroke="black" strokeWidth={4} />
              <circle cx={0} cy={-340} r={90} fill={["#FF4D6D", "#3DF2FF", "#FFE14D", "#A04DFF"][i]} stroke="black" strokeWidth={6} />
              <path d="M -60 -340 a 60 60 0 0 1 120 0 a 40 40 0 0 1 -80 0 a 20 20 0 0 1 40 0" stroke="white" strokeWidth={10} fill="none" transform={`rotate(${frame * 2} 0 -340)`} />
            </g>
          ))}
          <ellipse cx={W * 0.3} cy={H * FLOOR_Y} rx={600} ry={160} fill="#FF8AD8" stroke="black" strokeWidth={5} />
          <ellipse cx={W * 0.8} cy={H * FLOOR_Y} rx={500} ry={130} fill="#7FFFD4" stroke="black" strokeWidth={5} />
          {ground("#FFC4E8", "#FF3DB4")}
        </>
      );
      break;
    default: {
      // stage
      body = (
        <>
          <Sky id="sg" top="#14052e" bottom="#4a1478" />
          {[0, 1, 2, 3].map((i) => {
            const a = Math.sin(frame / 25 + i * 1.7) * 18;
            const x = 300 + i * 440;
            return (
              <polygon
                key={i}
                points={`${x},0 ${x - 180},${H} ${x + 180},${H}`}
                fill={["#FF3DB4", "#3DF2FF", "#FFE14D", "#A04DFF"][i]}
                opacity={0.16}
                transform={`rotate(${a} ${x} 0)`}
              />
            );
          })}
          {[160, 1760].map((x) => (
            <g key={x}>
              <rect x={x - 90} y={H * FLOOR_Y - 300} width={180} height={300} rx={16} fill="#1b1b2b" stroke="black" strokeWidth={6} />
              <circle cx={x} cy={H * FLOOR_Y - 200} r={50 + 6 * Math.abs(Math.sin(frame / 4))} fill="#333" stroke="#777" strokeWidth={6} />
              <circle cx={x} cy={H * FLOOR_Y - 70} r={34} fill="#333" stroke="#777" strokeWidth={6} />
            </g>
          ))}
          {ground("#2b1a4a", "#FFE14D")}
          {new Array(12).fill(0).map((_, i) => (
            <rect key={i} x={i * 165} y={H * FLOOR_Y + 30} width={150} height={10} fill="#3d2766" />
          ))}
        </>
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax slice" style={{ position: "absolute", width: "100%", height: "100%" }}>
      {body}
      {night && location !== "space" && location !== "cave" ? <rect width={W} height={H} fill="#0a0530" opacity={0.25} /> : null}
    </svg>
  );
};
