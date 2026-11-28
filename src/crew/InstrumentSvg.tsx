import React from "react";
import type { CrewMember } from "./characters";
import type { CrewLook } from "./CrewSvg";

/**
 * "Band" personajlari: jonli musiqa asboblari va narsalar (original chizilgan).
 * viewBox 200x260, pastki chegara = poydevor.
 */
type Props = {
  member: CrewMember;
  size: number;
  colorOverride?: string;
  look?: CrewLook;
  mouthOpen?: number;
  blink?: number;
  lookX?: number;
  mood?: "smile" | "shock" | "flat";
};

const Eye: React.FC<{ cx: number; cy: number; r: number; horror: boolean; ink: string; blink: number; lookX: number; shock: boolean }> = ({
  cx, cy, r, horror, ink, blink, lookX, shock,
}) => {
  if (horror) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="#FF2E2E" stroke={ink} strokeWidth={4} />
        <circle cx={cx + lookX * 3} cy={cy} r={r * 0.38} fill="#FFF" />
      </g>
    );
  }
  const s = Math.max(0.08, 1 - blink);
  return (
    <g transform={`translate(0 ${cy * (1 - s)}) scale(1 ${s})`}>
      <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.12} fill="#FFF" stroke={ink} strokeWidth={4.5} />
      <circle cx={cx + 1 + lookX * 4} cy={cy + 2} r={shock ? r * 0.25 : r * 0.45} fill="#111" />
      <circle cx={cx + 3 + lookX * 4} cy={cy - 2} r={r * 0.15} fill="#FFF" />
    </g>
  );
};

const Mouth: React.FC<{ x: number; y: number; w: number; open: number; mood: string; horror: boolean; ink: string }> = ({ x, y, w, open, mood, horror, ink }) => {
  if (horror) {
    const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => `${x - w + (i * w) / 3},${y + (i % 2 ? 12 : 0)}`).join(" ");
    return <polyline points={pts} fill="none" stroke="#FFF" strokeWidth={4.5} strokeLinejoin="round" />;
  }
  if (mood === "flat") return <path d={`M${x - w * 0.6} ${y} L${x + w * 0.6} ${y}`} stroke={ink} strokeWidth={5} strokeLinecap="round" />;
  if (open > 0.15 || mood === "shock") {
    return <ellipse cx={x} cy={y + 2} rx={w * 0.6} ry={mood === "shock" ? w * 0.6 : 2 + open * w * 0.7} fill="#2A0012" stroke={ink} strokeWidth={4.5} />;
  }
  return <path d={`M${x - w} ${y - 3} Q${x} ${y + w * 0.9} ${x + w} ${y - 3}`} fill="none" stroke={ink} strokeWidth={5} strokeLinecap="round" />;
};

export const InstrumentSvg: React.FC<Props> = ({
  member, size, colorOverride, look = "normal", mouthOpen = 0, blink = 0, lookX = 0, mood = "smile",
}) => {
  const horror = look === "horror";
  const ink = horror ? "#FF2E2E" : "#111";
  const fill = horror ? "#0B0B0B" : colorOverride ?? member.color;
  const accent = horror ? "#1A1A1A" : member.accent;
  const st = { stroke: ink, strokeWidth: 6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  const shock = mood === "shock";
  const eyes = (pts: [number, number][], r: number) =>
    pts.map(([cx, cy]) => <Eye key={cx} cx={cx} cy={cy} r={r} horror={horror} ink={ink} blink={blink} lookX={lookX} shock={shock} />);

  let body: React.ReactNode = null;
  let face: React.ReactNode = null;

  switch (member.shape) {
    case "sax":
      body = (
        <g>
          {/* og'izlik */}
          <path d="M52 30 L82 46" {...st} strokeWidth={12} stroke={ink} />
          <path d="M52 30 L82 46" stroke={horror ? "#222" : "#2B2B2B"} strokeWidth={6} strokeLinecap="round" />
          {/* trubka va qo'ng'iroq */}
          <path d="M80 40 C96 38 112 44 112 62 L112 196 C112 236 160 236 160 196 L160 168" fill="none" {...st} strokeWidth={40} stroke={ink} />
          <path d="M80 40 C96 38 112 44 112 62 L112 196 C112 236 160 236 160 196 L160 168" fill="none" stroke={fill} strokeWidth={28} strokeLinecap="round" />
          <ellipse cx={160} cy={160} rx={34} ry={14} fill={accent} {...st} />
          {[96, 124, 152, 180].map((y) => (
            <circle key={y} cx={112} cy={y} r={7} fill={horror ? "#333" : "#FFF3C4"} stroke={ink} strokeWidth={3} />
          ))}
        </g>
      );
      face = (
        <g>
          {eyes([[96, 62], [128, 60]], 15)}
          <Mouth x={112} y={88} w={8} open={mouthOpen} mood={mood} horror={horror} ink={ink} />
        </g>
      );
      break;
    case "ukulele":
      body = (
        <g>
          <rect x={90} y={14} width={20} height={26} rx={4} fill={accent} {...st} strokeWidth={5} />
          {[20, 32].map((y) => (
            <g key={y}>
              <circle cx={84} cy={y} r={4} fill={horror ? "#333" : "#EEE"} stroke={ink} strokeWidth={3} />
              <circle cx={116} cy={y} r={4} fill={horror ? "#333" : "#EEE"} stroke={ink} strokeWidth={3} />
            </g>
          ))}
          <rect x={92} y={38} width={16} height={84} fill={accent} {...st} strokeWidth={5} />
          <path d="M100 112 C58 112 52 150 70 168 C40 186 50 252 100 252 C150 252 160 186 130 168 C148 150 142 112 100 112 Z" fill={fill} {...st} />
          <circle cx={100} cy={196} r={15} fill={horror ? "#000" : "#3A1C08"} stroke={ink} strokeWidth={4} />
          <rect x={82} y={228} width={36} height={8} rx={3} fill={accent} stroke={ink} strokeWidth={3} />
          {[94, 98, 102, 106].map((x) => (
            <line key={x} x1={x} y1={40} x2={x} y2={232} stroke={horror ? "#550000" : "#F2E6C9"} strokeWidth={1.5} />
          ))}
        </g>
      );
      face = (
        <g>
          {eyes([[80, 140], [120, 140]], 12)}
          <Mouth x={100} y={164} w={10} open={mouthOpen} mood={mood} horror={horror} ink={ink} />
        </g>
      );
      break;
    case "tree":
      body = (
        <g>
          <path d="M72 252 L78 112 L122 112 L128 252 Z" fill={fill} {...st} />
          <path d="M88 150 Q92 170 86 190 M112 200 Q108 220 114 236" fill="none" stroke={horror ? "#550000" : "#5A3418"} strokeWidth={4} strokeLinecap="round" />
          <g fill={horror ? "#140000" : accent} {...st}>
            <circle cx={62} cy={88} r={34} />
            <circle cx={138} cy={88} r={34} />
            <circle cx={100} cy={56} r={44} />
            <circle cx={76} cy={44} r={26} />
            <circle cx={128} cy={46} r={26} />
          </g>
          {!horror ? (
            <g fill="#FF5A7A" stroke={ink} strokeWidth={3}>
              <circle cx={70} cy={70} r={7} />
              <circle cx={130} cy={58} r={7} />
              <circle cx={104} cy={30} r={7} />
            </g>
          ) : null}
        </g>
      );
      face = (
        <g>
          {eyes([[86, 142], [114, 142]], 13)}
          <Mouth x={100} y={176} w={13} open={mouthOpen} mood={mood} horror={horror} ink={ink} />
        </g>
      );
      break;
    case "cheese":
      body = (
        <g>
          <path d="M28 244 L28 150 L172 104 L172 244 Z" fill={fill} {...st} />
          <path d="M28 150 L172 104 L176 98" fill="none" stroke={ink} strokeWidth={3} />
          {[[60, 214, 10], [150, 214, 13], [146, 134, 8], [52, 172, 6]].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill={horror ? "#220000" : "#E8B84A"} stroke={ink} strokeWidth={3} />
          ))}
          {/* beret */}
          <path d="M110 112 C108 82 176 70 182 96 C184 108 150 112 110 112 Z" fill={accent} {...st} strokeWidth={5} />
          <path d="M148 80 L152 66" {...st} strokeWidth={5} fill="none" />
        </g>
      );
      face = (
        <g>
          {eyes([[84, 168], [124, 156]], 16)}
          <Mouth x={104} y={198} w={14} open={mouthOpen} mood={mood} horror={horror} ink={ink} />
        </g>
      );
      break;
    default:
      return null;
  }

  // Saksofonning og'zi qo'ng'irog'ida "kuylaydi"
  const saxMouth =
    member.shape === "sax" && !horror && mouthOpen > 0.15 ? (
      <g fill="none" stroke={ink} strokeWidth={4} strokeLinecap="round" opacity={0.8}>
        <path d={`M178 ${132 - mouthOpen * 6} q8 -10 0 -20`} />
        <path d={`M186 ${126 - mouthOpen * 8} q12 -14 0 -28`} />
      </g>
    ) : null;

  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 200 260" style={{ overflow: "visible", display: "block" }}>
      {body}
      {!horror && member.shape !== "sax" ? (
        <g opacity={0.55} fill="#FF7AD9">
          {member.shape === "ukulele" ? (
            <>
              <ellipse cx={70} cy={156} rx={8} ry={5} />
              <ellipse cx={130} cy={156} rx={8} ry={5} />
            </>
          ) : null}
        </g>
      ) : null}
      {face}
      {saxMouth}
    </svg>
  );
};
