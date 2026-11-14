import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { Background } from "./components/Background";
import { TITLE_FONT } from "./fonts";
import type { VideoProps } from "./types";

/** 1280x720 YouTube thumbnail: chapda katta matn, o'ngda personaj yoki sahna rasmi. */
export const Thumbnail: React.FC<VideoProps> = ({ scenes, thumbnailText, channelName }) => {
  const photo = scenes.find((s) => s.image && s.imageKind === "photo");
  const character = scenes.find((s) => s.image && s.imageKind === "character");
  const words = (thumbnailText || "").toUpperCase().split(/\s+/).filter(Boolean);
  const colors = ["#FFE600", "#FFFFFF", "#FF3DB4", "#00E5FF"];

  return (
    <AbsoluteFill>
      {photo?.image ? (
        <Img src={staticFile(photo.image)} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(1.4) contrast(1.1)" }} />
      ) : (
        <Background seed={3} />
      )}
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)" }} />
      {character?.image ? (
        <Img
          src={staticFile(character.image)}
          style={{
            position: "absolute",
            right: 20,
            bottom: 0,
            height: "95%",
            objectFit: "contain",
            filter: "drop-shadow(0 0 30px rgba(255,255,255,0.7))",
          }}
        />
      ) : null}
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 55, paddingRight: character ? 520 : 55 }}>
        <div style={{ fontFamily: TITLE_FONT, fontSize: words.length > 3 ? 115 : 145, lineHeight: 1.0 }}>
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                color: colors[i % colors.length],
                WebkitTextStroke: "14px black",
                paintOrder: "stroke fill",
                textShadow: "0 10px 0 rgba(0,0,0,0.6)",
                marginRight: 22,
                display: "inline-block",
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 40,
          padding: "8px 20px",
          borderRadius: 14,
          background: "#FF0055",
          color: "white",
          fontFamily: TITLE_FONT,
          fontSize: 34,
        }}
      >
        {channelName.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
};
