import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import type { MusicCut, SceneData, Timeline } from "./timing";

const BED = 0.3; // bed alone
const DUCKED = 0.055; // bed under narration
const RAMP = 10; // frames
const JINGLE = 0.95;
const INTRO_DUCK = 0.85; // how far the opening theme steps down under the first words

const clampI = (f: number, x: number[], y: number[]) => interpolate(f, x, y, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** 1 while someone is speaking (with ramps), 0 in gaps. */
const speaking = (scenes: SceneData[], abs: number) => {
  let v = 0;
  for (const s of scenes) {
    if (!s.audio) continue;
    const a = s.from + s.lead;
    const b = a + s.audioFrames;
    if (abs < a - RAMP || abs > b + RAMP) continue;
    v = Math.max(v, clampI(abs, [a - RAMP, a, b, b + RAMP], [0, 1, 1, 0]));
  }
  return v;
};

/** 1 while a jingle/ballad plays (the bed steps aside). */
const jingling = (scenes: SceneData[], music: Record<string, MusicCut>, abs: number) => {
  let v = 0;
  for (const s of scenes) {
    const m = s.after && music[s.after.key];
    if (!s.after || !m) continue;
    const a = s.from + s.after.at;
    const b = a + (m.outFrames - m.inFrames);
    v = Math.max(v, clampI(abs, [a - 20, a, b, b + 20], [0, 1, 1, 0]));
  }
  return v;
};

const Cut: React.FC<{ cut: MusicCut; from: number; volume: (f: number) => number }> = ({ cut, from, volume }) => {
  const len = cut.outFrames - cut.inFrames;
  return (
    <Sequence from={from} durationInFrames={len} layout="none">
      <Audio
        src={staticFile(cut.src)}
        startFrom={cut.inFrames}
        endAt={cut.outFrames}
        volume={(f) => volume(f) * (cut.gain ?? 1) * clampI(f, [len - cut.fadeFrames, len], [1, 0])}
      />
    </Sequence>
  );
};

/** All music: the opening theme, one looping bed per part (ducked under speech), jingles after speech. */
export const Music: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const { scenes, music } = timeline;
  // beds: one per run of scenes with the same bed key, from its first to its last scene
  const beds: { key: string; from: number; to: number }[] = [];
  for (const s of scenes) {
    if (!s.bed || !music[s.bed]) continue;
    const last = beds[beds.length - 1];
    if (last && last.key === s.bed && last.to === s.from) last.to = s.from + s.durationInFrames;
    else beds.push({ key: s.bed, from: s.from, to: s.from + s.durationInFrames });
  }
  return (
    <>
      {scenes
        .filter((s) => s.intro && music[s.intro.key])
        .map((s) => {
          const from = s.from + s.intro!.at;
          return (
            <Cut key={`intro-${s.id}`} cut={music[s.intro!.key]} from={from} volume={(f) => JINGLE * (1 - INTRO_DUCK * speaking(scenes, from + f))} />
          );
        })}
      {beds.map((b, i) => {
        const m = music[b.key];
        const len = b.to - b.from + 30;
        return (
          <Sequence key={`${b.key}${i}`} from={b.from} durationInFrames={len} layout="none">
            <Audio
              src={staticFile(m.src)}
              loop
              volume={(f) => {
                const abs = b.from + f;
                const fade = clampI(f, [0, 30, len - 45, len], [0, 1, 1, 0]);
                const duck = BED + (DUCKED - BED) * speaking(scenes, abs);
                return duck * fade * (1 - jingling(scenes, music, abs));
              }}
            />
          </Sequence>
        );
      })}
      {scenes
        .filter((s) => s.after && music[s.after.key])
        .map((s) => (
          <Cut key={s.id} cut={music[s.after!.key]} from={s.from + s.after!.at} volume={() => JINGLE} />
        ))}
    </>
  );
};
