import React from "react";
import { AbsoluteFill } from "remotion";
import { memberById } from "../crew/characters";
import { CrewSvg } from "../crew/CrewSvg";
import { TITLE_FONT } from "../fonts";
import type { HopProps } from "./types";

/** 1280x720 thumbnail: 4 ta rangli yo'lak, katta qahramonlar va "WHO WINS?" */
export const HopThumbnail: React.FC<HopProps> = ({ lanes, channelName }) => {
  const w = 1280 / lanes.length;
  return (
    <AbsoluteFill style={{ backgroundColor: "#05020C" }}>
      {lanes.map((lane, i) => {
        const member = memberById(lane.member);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: i * w,
              top: 0,
              width: w,
              height: 720,
              background: `radial-gradient(ellipse at 50% 70%, ${lane.color} 0%, ${lane.color}55 35%, #05020C 80%)`,
              borderLeft: i > 0 ? "6px solid #000" : "none",
              overflow: "hidden",
            }}
          >
            {/* neon plitka */}
            <div
              style={{
                position: "absolute",
                left: w * 0.12,
                bottom: 40,
                width: w * 0.76,
                height: 90,
                background: `${lane.color}AA`,
                border: "5px solid white",
                transform: "perspective(300px) rotateX(55deg)",
                boxShadow: `0 0 40px ${lane.color}`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: (w - w * 0.82) / 2,
                bottom: 70,
                transform: `rotate(${i % 2 ? 6 : -6}deg)`,
                filter: `drop-shadow(0 0 22px ${lane.color})`,
              }}
            >
              <CrewSvg member={member} size={w * 0.82} mouthOpen={0.9} mood="shock" />
            </div>
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          top: 18,
          width: "100%",
          textAlign: "center",
          fontFamily: TITLE_FONT,
          fontSize: 150,
          color: "#FFE600",
          WebkitTextStroke: "14px black",
          paintOrder: "stroke fill",
          textShadow: "0 12px 0 rgba(0,0,0,0.6)",
          transform: "rotate(-3deg)",
        }}
      >
        WHO WINS?
      </div>
      <div
        style={{
          position: "absolute",
          right: 18,
          bottom: 12,
          padding: "6px 16px",
          borderRadius: 12,
          background: "#FF0055",
          fontFamily: TITLE_FONT,
          fontSize: 32,
          color: "white",
        }}
      >
        {channelName.toUpperCase()}
      </div>
    </AbsoluteFill>
  );
};
