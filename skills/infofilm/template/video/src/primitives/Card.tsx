import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { ease, pop, prog } from "../anim";
import { DISPLAY, UI } from "../fonts";
import { C, CAPTION_H, CARD, TITLE_H, WIN } from "../theme";
import { useScene } from "../timing";

export const ENTER = 18; // frames the card needs to land
export const EXIT = 14; // frames the card needs to leave

/**
 * The instructional card every scene is built on. Title band (code), picture window
 * (AI illustration with a slow camera move + your overlays as children), caption band.
 * Children are positioned in WINDOW coordinates: 0..WIN.w × 0..WIN.h (1800×749).
 */
export const Card: React.FC<{
  title?: string;
  titleNode?: React.ReactNode; // replaces the title text (e.g. a Lobster slogan)
  kicker?: string; // small label at the right of the title band
  caption?: React.ReactNode;
  img?: string | null; // path under public/, e.g. s.img ("img/film-S05.jpg"); none → a drawn halftone ground
  /** camera: zoom from→to over the scene, around focus (0..1, 0..1) */
  zoom?: [number, number];
  focus?: [number, number];
  /** 0..1 darkening of the illustration (for overlays on top) */
  dim?: number;
  children?: React.ReactNode;
}> = ({ title, titleNode, kicker, caption, img, zoom = [1.03, 1.1], focus = [0.5, 0.5], dim = 0, children }) => {
  const s = useScene();
  const f = s.frame;
  const d = s.durationInFrames;
  const tin = pop(f, 0, { damping: 15, stiffness: 120, mass: 0.9 });
  const tout = prog(f, d - EXIT, EXIT, ease.in);
  const y = (1 - tin) * 1150;
  const rot = (1 - tin) * 5 - tout * 7;
  const x = -tout * 2200;
  const z = interpolate(f, [0, d], zoom);

  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`, transformOrigin: "50% 100%" }}>
      <div
        style={{
          position: "absolute",
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          borderRadius: CARD.radius,
          background: C.paper,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 4px 0 rgba(0,0,0,0.25)",
        }}
      >
        {/* picture window */}
        <div style={{ position: "absolute", left: 0, top: TITLE_H, width: WIN.w, height: WIN.h, overflow: "hidden" }}>
          {!img && <Ground zoom={z} focus={focus} />}
          {img && (
            <Img
              src={staticFile(img)}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${z})`,
                transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
              }}
            />
          )}
          {dim > 0 && <AbsoluteFill style={{ background: C.navyDeep, opacity: dim }} />}
          <div style={{ position: "absolute", inset: 0 }}>{children}</div>
        </div>
        {/* title band */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CARD.w,
            height: TITLE_H,
            background: C.band,
            borderBottom: `${CARD.border}px solid ${C.ink}`,
            display: "flex",
            alignItems: "center",
            padding: "0 56px",
            boxSizing: "border-box",
            justifyContent: "space-between",
          }}
        >
          {titleNode ?? (
            // Bowlby One SC caps run ~0.74 em per character; long titles shrink so the kicker keeps one line.
            // The room left for the title is what the kicker leaves (Jost 26 px caps + 0.14 em tracking ≈ 18.5 px a character).
            <div style={{ fontFamily: DISPLAY, fontSize: Math.min(78, Math.floor((CARD.w - 112 - (kicker ? kicker.length * 18.5 + 48 : 0)) / ((title ?? "").length * 0.74))), color: C.ink, lineHeight: 1, whiteSpace: "nowrap" }}>
              {title}
            </div>
          )}
          {kicker && (
            <div style={{ fontFamily: UI, fontWeight: 600, fontSize: 26, letterSpacing: "0.14em", color: C.navy, textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {kicker}
            </div>
          )}
        </div>
        {/* caption band */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: CARD.w,
            height: CAPTION_H,
            background: C.band,
            borderTop: `${CARD.border}px solid ${C.ink}`,
            display: "flex",
            alignItems: "center",
            padding: "0 56px",
            boxSizing: "border-box",
            fontFamily: UI,
            fontWeight: 600,
            fontSize: 38,
            color: C.ink,
            whiteSpace: "nowrap",
          }}
        >
          {caption}
        </div>
        {/* ink border on top of everything */}
        <div style={{ position: "absolute", inset: 0, borderRadius: CARD.radius, border: `${CARD.border}px solid ${C.ink}`, pointerEvents: "none" }} />
      </div>
    </AbsoluteFill>
  );
};

/** Stand-in for a missing illustration: halftone dots and a googie starburst on paper. */
const Ground: React.FC<{ zoom: number; focus: [number, number] }> = ({ zoom, focus }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(circle, ${C.ochre}40 26%, transparent 28%) 0 0 / 26px 26px, radial-gradient(ellipse at 50% 45%, ${C.paperLight} 0%, ${C.paperDark} 100%)`,
      transform: `scale(${zoom})`,
      transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`,
    }}
  >
    <svg width={WIN.w} height={WIN.h} style={{ position: "absolute", opacity: 0.22 }}>
      {Array.from({ length: 24 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 24;
        return <line key={i} x1={WIN.w / 2} y1={WIN.h / 2} x2={WIN.w / 2 + Math.cos(a) * 1200} y2={WIN.h / 2 + Math.sin(a) * 1200} stroke={C.gold} strokeWidth={i % 2 ? 10 : 26} />;
      })}
    </svg>
  </AbsoluteFill>
);

/** A paper plate inside the window for infographics: cream panel with ink border. */
export const Plate: React.FC<{ x: number; y: number; w: number; h: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({
  x,
  y,
  w,
  h,
  style,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      background: C.paperLight,
      border: `4px solid ${C.ink}`,
      borderRadius: 18,
      boxShadow: "0 10px 0 rgba(18,22,23,0.25)",
      overflow: "hidden",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Caption text that swaps on cue: the latest entry whose `at` has passed is shown, sliding in. */
export const Captions: React.FC<{ items: { at: number; text: React.ReactNode }[] }> = ({ items }) => {
  const { frame } = useScene();
  const sorted = [...items].sort((a, b) => a.at - b.at);
  const cur = [...sorted].reverse().find((i) => frame >= i.at) ?? sorted[0];
  const t = prog(frame, cur.at, 10);
  return <div style={{ transform: `translateY(${(1 - t) * 30}px)`, opacity: t }}>{cur.text}</div>;
};
