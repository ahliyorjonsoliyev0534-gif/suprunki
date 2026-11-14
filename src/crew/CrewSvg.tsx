import React from "react";
import type { Accessory, CrewMember } from "./characters";
import { InstrumentSvg } from "./InstrumentSvg";

export type CrewLook = "normal" | "horror";

type Props = {
  member: CrewMember;
  size: number;
  /** Tananing rangini almashtirish (rang almashtirish formatlari uchun) */
  colorOverride?: string;
  look?: CrewLook;
  mouthOpen?: number;
  blink?: number;
  /** -1..1: ko'z qorachig'i qaysi tomonga qaraydi */
  lookX?: number;
  mood?: "smile" | "shock" | "flat";
};

const AccessoryShape: React.FC<{ type: Accessory; accent: string; ink: string; body: string }> = ({ type, accent, ink, body }) => {
  const s = { stroke: ink, strokeWidth: 6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (type) {
    case "headphones":
      return (
        <g>
          <path d="M34 140 C34 40 166 40 166 140" fill="none" {...s} strokeWidth={13} />
          <path d="M34 140 C34 40 166 40 166 140" fill="none" stroke={accent} strokeWidth={6} />
          <rect x={18} y={118} width={32} height={54} rx={13} fill={accent} {...s} />
          <rect x={150} y={118} width={32} height={54} rx={13} fill={accent} {...s} />
        </g>
      );
    case "bolt":
      return <path d="M108 4 L82 50 L102 50 L90 86 L126 36 L104 36 L118 4 Z" fill={accent} {...s} />;
    case "curlyHorns":
      return (
        <g fill={accent} {...s}>
          <path d="M62 84 C40 70 36 40 58 28 C70 22 80 32 72 42 C66 50 74 66 86 72 Z" />
          <path d="M138 84 C160 70 164 40 142 28 C130 22 120 32 128 42 C134 50 126 66 114 72 Z" />
        </g>
      );
    case "sprout":
      return (
        <g {...s}>
          <path d="M100 74 L100 34" fill="none" />
          <path d="M100 44 C80 20 52 26 54 40 C56 54 84 54 100 44 Z" fill={accent} />
          <path d="M100 38 C116 12 146 16 146 30 C146 46 118 48 100 38 Z" fill={body} />
        </g>
      );
    case "beanie":
      return (
        <g {...s}>
          <path d="M44 100 C44 40 156 40 156 100 Z" fill={accent} />
          <rect x={38} y={92} width={124} height={22} rx={10} fill={accent} />
          <circle cx={100} cy={36} r={14} fill={accent} />
        </g>
      );
    case "crown":
      return <path d="M58 86 L54 34 L80 58 L100 22 L120 58 L146 34 L142 86 Z" fill={accent} {...s} />;
    case "cap":
      return (
        <g {...s}>
          <path d="M48 98 C48 46 152 46 152 98 Z" fill={accent} />
          <path d="M140 92 L188 100 C190 108 150 110 136 104 Z" fill={accent} />
        </g>
      );
    case "feather":
      return (
        <g {...s}>
          <path d="M104 76 C92 50 96 18 122 4 C130 30 124 58 104 76 Z" fill={accent} />
          <path d="M104 76 L118 14" fill="none" strokeWidth={3} />
        </g>
      );
    case "halo":
      return <ellipse cx={100} cy={34} rx={50} ry={14} fill="none" stroke={accent} strokeWidth={10} />;
    case "starEars":
      return (
        <g fill={body} {...s}>
          <path d="M56 90 L40 32 L70 54 L86 30 L88 80 Z" />
          <path d="M144 90 L160 32 L130 54 L114 30 L112 80 Z" />
        </g>
      );
    case "visor":
      return null; // ko'z ustida chiziladi
    case "bowtie":
      return null; // tanada chiziladi
    case "none":
      return null;
  }
};

/** Bitta Crew personaji (SVG). viewBox 200x260, oyoqlari pastki chegarada. */
export const CrewSvg: React.FC<Props> = ({
  member,
  size,
  colorOverride,
  look = "normal",
  mouthOpen = 0,
  blink = 0,
  lookX = 0,
  mood = "smile",
}) => {
  if (member.shape && member.shape !== "capsule") {
    return (
      <InstrumentSvg member={member} size={size} colorOverride={colorOverride} look={look} mouthOpen={mouthOpen} blink={blink} lookX={lookX} mood={mood} />
    );
  }
  const horror = look === "horror";
  const ink = horror ? "#FF2E2E" : "#111";
  const body = horror ? "#0B0B0B" : colorOverride ?? member.color;
  const accent = horror ? "#0B0B0B" : member.accent;
  const eyeScale = Math.max(0.08, 1 - blink);
  const px = lookX * 5;

  const eye = (cx: number) => {
    if (horror) {
      return (
        <g key={cx}>
          <circle cx={cx} cy={128} r={19} fill="#FF2E2E" stroke={ink} strokeWidth={4} />
          <circle cx={cx + px} cy={128} r={7} fill="#FFF" />
        </g>
      );
    }
    if (member.eyes === "happy" && mood !== "shock") {
      return <path key={cx} d={`M${cx - 15} 134 Q${cx} 112 ${cx + 15} 134`} fill="none" stroke={ink} strokeWidth={7} strokeLinecap="round" />;
    }
    const lid = member.eyes === "sleepy" && mood !== "shock";
    const pupil = mood === "shock" ? 5 : 9;
    return (
      <g key={cx} transform={`translate(0 ${128 * (1 - eyeScale)}) scale(1 ${eyeScale})`}>
        <ellipse cx={cx} cy={128} rx={20} ry={23} fill="#FFF" stroke={ink} strokeWidth={5} />
        <circle cx={cx + 2 + px} cy={132} r={pupil} fill="#111" />
        <circle cx={cx + 5 + px} cy={127} r={3} fill="#FFF" />
        {lid ? <path d={`M${cx - 21} 126 Q${cx} 100 ${cx + 21} 126 Z`} fill={body} stroke={ink} strokeWidth={5} /> : null}
      </g>
    );
  };

  const mouthY = 182;
  const mouthRy = 3 + mouthOpen * 16;
  const mouth = horror ? (
    <path d="M70 178 L80 196 L90 180 L100 198 L110 180 L120 196 L130 178" fill="none" stroke="#FFF" strokeWidth={5} strokeLinejoin="round" />
  ) : mood === "flat" ? (
    <path d={`M84 ${mouthY} L116 ${mouthY}`} stroke={ink} strokeWidth={6} strokeLinecap="round" />
  ) : mouthOpen > 0.15 || mood === "shock" ? (
    <ellipse cx={100} cy={mouthY} rx={mood === "shock" ? 12 : 16} ry={mood === "shock" ? 14 : mouthRy} fill="#2A0012" stroke={ink} strokeWidth={5} />
  ) : (
    <path d={`M80 ${mouthY - 4} Q100 ${mouthY + 14} 120 ${mouthY - 4}`} fill="none" stroke={ink} strokeWidth={6} strokeLinecap="round" />
  );

  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 200 260" style={{ overflow: "visible", display: "block" }}>
      {member.accessory !== "headphones" ? <AccessoryShape type={member.accessory} accent={accent} ink={ink} body={body} /> : null}
      <rect x={40} y={70} width={120} height={184} rx={60} fill={body} stroke={ink} strokeWidth={7} />
      {member.accessory === "headphones" ? <AccessoryShape type="headphones" accent={accent} ink={ink} body={body} /> : null}
      {!horror ? (
        <g>
          <ellipse cx={64} cy={160} rx={11} ry={6} fill="#FF7AD9" opacity={0.6} />
          <ellipse cx={136} cy={160} rx={11} ry={6} fill="#FF7AD9" opacity={0.6} />
        </g>
      ) : null}
      {eye(76)}
      {eye(124)}
      {member.accessory === "visor" && !horror ? (
        <rect x={46} y={108} width={108} height={36} rx={14} fill="#1E1E1E" stroke={ink} strokeWidth={5} opacity={0.92} />
      ) : null}
      {mouth}
      {member.accessory === "bowtie" ? (
        <path d="M100 222 L76 208 L76 236 Z M100 222 L124 208 L124 236 Z" fill={accent} stroke={ink} strokeWidth={5} strokeLinejoin="round" />
      ) : null}
    </svg>
  );
};
