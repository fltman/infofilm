import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";
import { FPS } from "./theme";

// One word of narration with its time in seconds, relative to the start of the scene's audio.
export type Word = { w: string; s: number; e: number };

/** A music cut that plays at a scene-relative frame. */
export type MusicAt = { key: string; at: number };

export type SceneData = {
  id: string; // "S05"
  name: string; // "the-year" — components are looked up by this
  part: string; // the "# PART" heading the scene sits under
  kicker: string; // small label at the right of the title band (film.json "parts")
  title: string; // the card title (<!-- title: … --> in the script)
  bed: string | null; // music bed key for this part
  from: number; // absolute start frame
  durationInFrames: number;
  lead: number; // frames between scene start and first spoken sound
  audio: string | null; // path under public/
  audioFrames: number;
  intro: MusicAt | null; // opening theme under the start of the scene (ducked under the speech)
  after: MusicAt | null; // jingle/ballad after the speech
  text: string;
  words: Word[];
  estimated: boolean; // no narration yet: word times are estimated from the text
  img: string | null; // "img/film-S05.jpg" when that file exists in public/
};

export type MusicCut = { src: string; inFrames: number; outFrames: number; fadeFrames: number; gain?: number }; // gain: linear, from cuts.json dB

export type Timeline = {
  title: string;
  locale: string;
  fps: number;
  durationInFrames: number;
  music: Record<string, MusicCut>;
  scenes: SceneData[];
};

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}'%]+/gu, " ")
    .trim();

type SceneApi = SceneData & {
  /** frame (scene-relative) where `phrase` starts being spoken; nth occurrence, 1-based */
  cue: (phrase: string, nth?: number) => number;
  /** frame where `phrase` has finished being spoken */
  cueEnd: (phrase: string, nth?: number) => number;
  /** frames since the scene started */
  frame: number;
  /** frame where narration ends */
  speechEnd: number;
};

const Ctx = createContext<SceneData | null>(null);

export const SceneProvider: React.FC<{ scene: SceneData; children: React.ReactNode }> = ({ scene, children }) => (
  <Ctx.Provider value={scene}>{children}</Ctx.Provider>
);

export const missingCues = new Set<string>();

function findPhrase(words: Word[], phrase: string, nth: number): [number, number] | null {
  const target = norm(phrase).split(" ").filter(Boolean);
  if (!target.length) return null;
  const toks: { t: string; wi: number }[] = [];
  words.forEach((w, wi) =>
    norm(w.w)
      .split(" ")
      .filter(Boolean)
      .forEach((t) => toks.push({ t, wi })),
  );
  let seen = 0;
  for (let i = 0; i + target.length <= toks.length; i++) {
    let ok = true;
    for (let j = 0; j < target.length; j++) {
      const tok = toks[i + j].t;
      // the last target token may be a prefix ("percent" matches "percentage")
      if (!(tok === target[j] || (j === target.length - 1 && tok.startsWith(target[j])))) {
        ok = false;
        break;
      }
    }
    if (ok && ++seen === nth) return [toks[i].wi, toks[i + target.length - 1].wi];
  }
  return null;
}

export function useScene(): SceneApi {
  const scene = useContext(Ctx);
  const frame = useCurrentFrame();
  if (!scene) throw new Error("useScene() outside <SceneProvider>");
  const toFrame = (sec: number) => scene.lead + Math.round(sec * FPS);
  const find = (phrase: string, nth: number) => {
    const hit = findPhrase(scene.words, phrase, nth);
    if (!hit) {
      const key = `${scene.id}: "${phrase}"#${nth}`;
      if (!missingCues.has(key)) console.warn(`[cue-missing] ${key}`);
      missingCues.add(key);
    }
    return hit;
  };
  const cue = (phrase: string, nth = 1) => {
    const hit = find(phrase, nth);
    return hit ? toFrame(scene.words[hit[0]].s) : Math.round(scene.durationInFrames / 2);
  };
  const cueEnd = (phrase: string, nth = 1) => {
    const hit = find(phrase, nth);
    return hit ? toFrame(scene.words[hit[1]].e) : Math.round(scene.durationInFrames / 2);
  };
  return { ...scene, cue, cueEnd, frame, speechEnd: scene.lead + scene.audioFrames };
}
