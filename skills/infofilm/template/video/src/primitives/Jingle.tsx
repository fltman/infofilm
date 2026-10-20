import React from "react";
import { AbsoluteFill } from "remotion";
import { clamp01, ease, pop, prog, rand } from "../anim";
import { DISPLAY, SCRIPT, UI } from "../fonts";
import type { Line } from "../lyrics";
import { Captions, Card } from "./Card";
import { C, FPS, WIN } from "../theme";
import { useScene } from "../timing";

// Jingles and commercial breaks: 50s ad shapes, beat-synced kinetic lyrics, a test card and the break itself.
// Sung lines come from src/lyrics.ts (Suno aligned lyrics, seconds from the start of the cut).

export const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/* ------------------------------------------------------------------ shapes */

/** Four-pointed sparkle (the twinkle in 50s ads), centred on 0,0. */
export const sparklePath = (r: number) => `M0 ${-r} Q0 0 ${r} 0 Q0 0 0 ${r} Q0 0 ${-r} 0 Q0 0 0 ${-r} Z`;

/** Starburst polygon (price badge / "New!" sticker), centred on 0,0. */
export const starburstPath = (r: number, points = 18, inner = 0.8) => {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (Math.PI * i) / points - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    pts.push(`${(rr * Math.cos(a)).toFixed(1)} ${(rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(" L")} Z`;
};

/** A starburst badge with content in the middle. Position is its centre. */
export const Starburst: React.FC<{
  x: number;
  y: number;
  r: number;
  fill?: string;
  scale?: number;
  rotate?: number;
  opacity?: number;
  children?: React.ReactNode;
}> = ({ x, y, r, fill = C.gold, scale = 1, rotate = 0, opacity = 1, children }) => (
  <div
    style={{
      position: "absolute",
      left: x - r,
      top: y - r,
      width: r * 2,
      height: r * 2,
      transform: `scale(${scale}) rotate(${rotate}deg)`,
      opacity,
    }}
  >
    <svg width={r * 2 + 16} height={r * 2 + 16} viewBox={`${-r - 8} ${-r - 8} ${r * 2 + 16} ${r * 2 + 16}`} style={{ position: "absolute", left: -8, top: -8 }}>
      <path d={starburstPath(r)} fill="rgba(18,22,23,0.3)" transform="translate(0 7)" />
      <path d={starburstPath(r)} fill={fill} stroke={C.ink} strokeWidth={5} strokeLinejoin="round" />
    </svg>
    <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{children}</div>
  </div>
);

/* ------------------------------------------------------------------ the googie clock */

/* ------------------------------------------------------------------ beat + lyrics */

export type Beat = { bpm: number; phase: number }; // phase: seconds from the cut's start to the first beat

/** 1 on each beat, decaying towards the next one; 0 before `start`. */
export const beatPulse = (frame: number, start: number, beat: Beat) => {
  if (frame < start) return 0;
  const b = (((frame - start) / FPS - beat.phase) * beat.bpm) / 60;
  if (b < 0) return 0;
  return Math.exp(-4.5 * (b - Math.floor(b)));
};

/** Frame of the beat nearest to `frame` (for presses and pops that should land on the beat). */
export const onBeat = (frame: number, start: number, beat: Beat) => {
  const per = (60 / beat.bpm) * FPS;
  const first = start + beat.phase * FPS;
  return Math.round(first + Math.round((frame - first) / per) * per);
};

const syllables = (w: string) => (w.toLowerCase().match(/[aeiouyåäöæøéèáàüï]/g) ?? []).length;

/**
 * Word times (scene frames) inside one sung line. The aligned lyrics only give line times, so the
 * words are spread over the line by syllable count; punctuation-only tokens ride with the next word.
 */
export const wordFrames = (line: Line, at: number) => {
  const words = line.text.split(/\s+/).filter(Boolean);
  const ws = words.map(syllables);
  const total = Math.max(1, ws.reduce((a, b) => a + b, 0));
  const span = (line.end - line.t) * 0.8;
  let acc = 0;
  return words.map((w, i) => {
    const t = at + Math.round((line.t + (span * acc) / total) * FPS);
    acc += ws[i];
    return { w, t };
  });
};

/** Scene frame where line `i` starts. */
export const lineAt = (lines: Line[], at: number, i: number) => at + Math.round(lines[i].t * FPS);

const outline = (px: number, color: string) =>
  [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0.7, -0.7],
    [-0.7, -0.7],
  ]
    .map(([x, y]) => `${(x * px).toFixed(1)}px ${(y * px).toFixed(1)}px 0 ${color}`)
    .join(", ");

const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** The sung lines without their ad-libs ("(ba-da-ba-da)"), for big type; the times stay as Suno gave them. */
export const withoutAdlibs = (lines: Line[]): Line[] => lines.map((l) => ({ ...l, text: l.text.replace(/\s*\([^)]*\)/g, "").trim() }));

/** The sung line as big kinetic type: each word pops in on its time, the line bounces on the beat.
 * `font` defaults to SCRIPT (Lobster, commercial breaks only); pass DISPLAY for the opening theme or the ballad. */
export const KineticLyrics: React.FC<{ lines: Line[]; at: number; beat: Beat; hot?: string[]; size?: number; bottom?: number; font?: string }> = ({
  lines,
  at,
  beat,
  hot = [],
  size = 94,
  bottom = 24,
  font = SCRIPT,
}) => {
  const { frame: f } = useScene();
  let idx = -1;
  lines.forEach((_, i) => {
    if (f >= lineAt(lines, at, i) - 3) idx = i;
  });
  if (idx < 0) return null;
  const words = wordFrames(lines[idx], at);
  const pulse = beatPulse(f, at, beat);
  const hotSet = new Set(hot.map(bare));
  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        bottom,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: size * 0.26,
        lineHeight: 1.12,
        transform: `scale(${1 + 0.018 * pulse})`,
        transformOrigin: "50% 100%",
      }}
    >
      {words.map(({ w, t }, i) => {
        const shown = f >= t;
        const p = pop(f, t, { damping: 9, stiffness: 210, mass: 0.6 });
        const tilt = (rand(`tilt${idx}-${i}`) - 0.5) * 7;
        const isHot = hotSet.has(bare(w));
        const burst = clamp01((f - t) / 14);
        return (
          <span
            key={`${idx}-${i}`}
            style={{
              position: "relative",
              display: "inline-block",
              fontFamily: font,
              fontSize: size,
              color: isHot ? C.gold : C.paperLight,
              textShadow: `${outline(4, C.ink)}, 7px 8px 0 ${C.red}`,
              opacity: shown ? 1 : 0,
              transform: `translateY(${(1 - p) * 40}px) scale(${0.3 + 0.7 * p}) rotate(${tilt * (2 - p)}deg)`,
              transformOrigin: "50% 80%",
            }}
          >
            {w}
            {shown && isHot && burst < 1 && (
              <svg width={80} height={80} viewBox="-40 -40 80 80" style={{ position: "absolute", right: -34, top: -26, overflow: "visible", opacity: 1 - burst }}>
                <path d={sparklePath(10 + 26 * Math.sin(burst * Math.PI))} fill={C.paperLight} stroke={C.ink} strokeWidth={2.5} />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
};

/** A trademark sign in Jost: Lobster has no ™ glyph. */
export const TM: React.FC = () => <span style={{ fontFamily: UI, fontWeight: 600, fontSize: "0.42em", verticalAlign: "0.9em", marginLeft: 2 }}>™</span>;

/** Twinkling sparkles over the commercial, pulsing on the beat. Window coordinates. */
export const Glitter: React.FC<{ seed: string; n?: number; at: number; beat: Beat; avoid?: { y0: number } }> = ({ seed, n = 26, at, beat, avoid }) => {
  const { frame: f } = useScene();
  const pulse = beatPulse(f, at, beat);
  const fade = prog(f, at, 20);
  return (
    <svg width={WIN.w} height={WIN.h} style={{ position: "absolute", left: 0, top: 0, opacity: fade, pointerEvents: "none" }}>
      {Array.from({ length: n }, (_, i) => {
        const x = 40 + rand(`${seed}x${i}`) * (WIN.w - 80);
        const ymax = avoid ? avoid.y0 : WIN.h;
        const y = 30 + rand(`${seed}y${i}`) * (ymax - 60);
        const r0 = 12 + rand(`${seed}r${i}`) * 26;
        const ph = rand(`${seed}p${i}`) * Math.PI * 2;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(ph + f * (0.05 + rand(`${seed}s${i}`) * 0.06)));
        const r = r0 * tw * (0.8 + 0.45 * pulse);
        const gold = i % 3 === 0;
        return <path key={i} d={sparklePath(r)} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} fill={gold ? C.gold : C.paperLight} stroke={C.ink} strokeWidth={2} />;
      })}
    </svg>
  );
};

/* ------------------------------------------------------------------ test card */

/** "We'll be right back": a 1950s test card drawn in SVG, filling the picture window. */
export const TestCard: React.FC<{ text: string }> = ({ text }) => {
  const { frame: f } = useScene();
  const W = WIN.w;
  const H = WIN.h;
  const cx = W / 2;
  const cy = H / 2;
  const R = 300;
  const steps = [C.paperLight, C.paper, C.paperDark, C.band, C.ochre, C.navy, C.ink];
  const hum = ((f * 4) % (H + 240)) - 120; // a slow rolling hum bar
  return (
    <AbsoluteFill style={{ background: C.navy }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {/* grid */}
        {Array.from({ length: 19 }, (_, i) => (
          <line key={`v${i}`} x1={i * 100} y1={0} x2={i * 100} y2={H} stroke={C.navyDeep} strokeWidth={3} />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <line key={`h${i}`} x1={0} y1={cy + (i - 3.5) * 100} x2={W} y2={cy + (i - 3.5) * 100} stroke={C.navyDeep} strokeWidth={3} />
        ))}
        {/* corner circles */}
        {[
          [150, 130],
          [W - 150, 130],
          [150, H - 130],
          [W - 150, H - 130],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={92} fill={C.paperDark} stroke={C.ink} strokeWidth={5} />
            <circle cx={x} cy={y} r={58} fill="none" stroke={C.ink} strokeWidth={4} />
            <circle cx={x} cy={y} r={24} fill={C.ink} />
          </g>
        ))}
        {/* resolution wedges */}
        {Array.from({ length: 9 }, (_, i) => {
          const d = (i - 4) * 14;
          return (
            <g key={`w${i}`} stroke={C.paperLight} strokeWidth={3}>
              <line x1={cx + d} y1={0} x2={cx} y2={cy - R * 0.55} />
              <line x1={cx + d} y1={H} x2={cx} y2={cy + R * 0.55} />
              <line x1={0} y1={cy + d} x2={cx - R * 0.55} y2={cy} />
              <line x1={W} y1={cy + d} x2={cx + R * 0.55} y2={cy} />
            </g>
          );
        })}
        {/* the big circle */}
        <circle cx={cx} cy={cy} r={R + 18} fill={C.ink} />
        <circle cx={cx} cy={cy} r={R} fill={C.paper} stroke={C.paperLight} strokeWidth={6} />
        <circle cx={cx} cy={cy} r={R * 0.72} fill="none" stroke={C.ink} strokeWidth={4} />
        <circle cx={cx} cy={cy} r={R * 0.42} fill="none" stroke={C.ink} strokeWidth={3} />
        <line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke={C.ink} strokeWidth={3} />
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke={C.ink} strokeWidth={3} />
        {/* grey steps across the lower half of the circle */}
        <clipPath id="tc-clip">
          <circle cx={cx} cy={cy} r={R - 3} />
        </clipPath>
        <g clipPath="url(#tc-clip)">
          {steps.map((c, i) => (
            <rect key={i} x={cx - R + (i * 2 * R) / steps.length} y={cy + R * 0.48} width={(2 * R) / steps.length + 1} height={R * 0.6} fill={c} />
          ))}
        </g>
        {/* starburst crown, a googie touch */}
        <g transform={`translate(${cx} ${cy - R * 0.72})`}>
          <path d={starburstPath(46, 12, 0.45)} fill={C.gold} stroke={C.ink} strokeWidth={4} />
        </g>
      </svg>
      {/* station ident bar */}
      <div
        style={{
          position: "absolute",
          left: cx - 480,
          width: 960,
          top: cy - 62,
          height: 124,
          background: C.navyDeep,
          border: `6px solid ${C.paperLight}`,
          borderRadius: 18,
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
          fontFamily: DISPLAY,
          fontSize: 64,
          color: C.paperLight,
          letterSpacing: "0.02em",
          textShadow: `4px 4px 0 ${C.ink}`,
        }}
      >
        {text}
      </div>
      {/* rolling hum bar + a faint flicker */}
      <div style={{ position: "absolute", left: 0, width: W, top: hum, height: 120, background: C.navyDeep, opacity: 0.18 }} />
      <AbsoluteFill style={{ background: C.ink, opacity: 0.03 + rand(`tcf${f}`) * 0.04 }} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ the commercial break */

/**
 * A commercial break: the test card under the narrator's line, then — on the jingle (scene.after) — a CRT
 * switch to the illustration with the sung lines as kinetic type, glitter and stars. The scene adds
 * its own product shots as children (they sit between the picture and the lyrics).
 */
export const CommercialBreak: React.FC<{
  img?: string | null;
  slogan: React.ReactNode;
  sloganSize: number;
  kicker?: string;
  lines: Line[];
  beat: Beat;
  hot: string[];
  captions: { at: number; text: string }[];
  testCard?: string;
  focus?: [number, number];
  zoom?: [number, number];
  dim?: number;
  children?: React.ReactNode;
}> = ({ img, slogan, sloganSize, kicker, lines, beat, hot, captions, testCard = "WE'LL BE RIGHT BACK", focus, zoom, dim = 0, children }) => {
  const s = useScene();
  const f = s.frame;
  const at = s.after?.at ?? s.speechEnd + 6;
  // CRT switch: the test card collapses to a line, the picture opens from it
  const collapse = prog(f, at - 7, 7, ease.in);
  const open = prog(f, at, 10);
  const line = f >= at - 7 && f < at + 10 ? 1 - Math.abs((f - at) / 10) : 0;
  return (
    <Card
      titleNode={
        <div style={{ fontFamily: SCRIPT, fontSize: sloganSize, color: C.red, lineHeight: 1, whiteSpace: "nowrap", textShadow: `3px 3px 0 ${C.ink}` }}>{slogan}</div>
      }
      kicker={kicker}
      img={img}
      focus={focus}
      zoom={zoom}
      dim={f < at ? 0 : dim}
      caption={<Captions items={captions} />}
    >
      {f >= at && (
        <>
          {/* a band of shade so the sung words read over any picture */}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, background: `linear-gradient(to top, ${C.navyDeep}d9, ${C.navyDeep}00)` }} />
          <Glitter seed={img ?? "break"} at={at} beat={beat} avoid={{ y0: 470 }} />
          {children}
          <KineticLyrics lines={lines} at={at} beat={beat} hot={hot} />
        </>
      )}
      {f < at && (
        <div style={{ position: "absolute", inset: 0, background: C.ink }}>
          <div style={{ position: "absolute", inset: 0, transform: `scaleY(${1 - 0.995 * collapse})`, filter: collapse > 0 ? `brightness(${1 + 1.5 * collapse})` : undefined }}>
            <TestCard text={testCard} />
          </div>
        </div>
      )}
      {f >= at && open < 1 && (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: (WIN.h / 2) * (1 - open), background: C.ink }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: (WIN.h / 2) * (1 - open), background: C.ink }} />
        </>
      )}
      {line > 0 && (
        <div
          style={{
            position: "absolute",
            left: WIN.w * 0.5 * (1 - line),
            width: WIN.w * line,
            top: WIN.h / 2 - 3,
            height: 6,
            background: C.paperLight,
            boxShadow: `0 0 24px 8px ${C.paperLight}`,
          }}
        />
      )}
    </Card>
  );
};
