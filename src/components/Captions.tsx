import { createTikTokStyleCaptions, type Caption } from "@remotion/captions";
import React, { useMemo } from "react";
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { TITLE_FONT } from "../fonts";
import type { Word } from "../types";

/** TikTok uslubidagi subtitr: 2-4 so'zdan iborat sahifa, aytilayotgan so'z sariq bo'lib sakraydi. */
export const Captions: React.FC<{ words: Word[] }> = ({ words }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const vertical = height > width;

  const pages = useMemo(() => {
    const captions: Caption[] = words.map((word, i) => ({
      text: i === 0 ? word.text : ` ${word.text}`,
      startMs: word.startMs,
      endMs: word.endMs,
      timestampMs: word.startMs,
      confidence: 1,
    }));
    return createTikTokStyleCaptions({
      captions,
      combineTokensWithinMilliseconds: vertical ? 900 : 1800,
    }).pages;
  }, [words, vertical]);

  const nowMs = (frame / fps) * 1000;
  const pageIndex = pages.findIndex((page, i) => {
    const next = pages[i + 1];
    const end = next ? next.startMs : page.startMs + page.durationMs + 400;
    return nowMs >= page.startMs && nowMs < end;
  });
  if (pageIndex === -1) return null;
  const page = pages[pageIndex];

  const pageFrame = frame - Math.round((page.startMs / 1000) * fps);
  const pop = spring({ frame: pageFrame, fps, config: { damping: 12, stiffness: 200 }, durationInFrames: 8 });
  const fontSize = vertical ? width * 0.095 : width * 0.042;

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: vertical ? height * 0.24 : height * 0.07,
      }}
    >
      <div
        style={{
          fontFamily: TITLE_FONT,
          fontSize,
          lineHeight: 1.15,
          textAlign: "center",
          maxWidth: vertical ? "88%" : "80%",
          transform: `scale(${0.8 + pop * 0.2})`,
          textTransform: vertical ? "uppercase" : "none",
          letterSpacing: 1,
        }}
      >
        {page.tokens.map((token, i) => {
          const active = nowMs >= token.fromMs && nowMs < token.toMs;
          return (
            <span
              key={`${page.startMs}-${i}`}
              style={{
                color: active ? "#FFE600" : "white",
                display: "inline-block",
                margin: "0 0.18em",
                transform: active ? "scale(1.12) translateY(-4%)" : "none",
                WebkitTextStroke: `${fontSize * 0.09}px black`,
                paintOrder: "stroke fill",
                textShadow: `0 ${fontSize * 0.08}px 0 rgba(0,0,0,0.6)`,
              }}
            >
              {token.text.trim()}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
