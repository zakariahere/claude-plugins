#!/usr/bin/env node
// tutorial-video CLI. Node 18+, plus ffmpeg/ffprobe and pocket-tts on PATH. No npm dependencies.
//
//   node tv.mjs status   <episode>
//   node tv.mjs narrate  <episode> [--scene id[,id]] [--voice path|name] [--temperature 0.8] [--language english] [--pace 0.93] [--sentence-pause 0.45]
//   node tv.mjs timeline <episode> [--gap 0.5]
//   node tv.mjs record   <episode> <scene>
//   node tv.mjs ingest   <episode> <scene> [--from s] [--to s] [--keep-static] [--max-speed 8] [--pad #rrggbb]
//   node tv.mjs ingest   <episode> <scene> --marks marks.json   (pin each action: [{"src": s, "at": s}])
//
// <episode> is a folder holding script.md. See ../skills/tutorial-video/SKILL.md for the layout.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSrt, chapters, fitSpeed, joinFilter, layout, parseScript, planSegments, segmentsFilter, sentences } from "./lib.mjs";

const TAKE_EXTS = [".mkv", ".mp4", ".mov", ".webm"];

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else flags[key] = argv[++i];
    } else pos.push(a);
  }
  return { pos, flags };
}

function run(cmd, args, { quiet = false } = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: quiet ? "pipe" : ["ignore", "inherit", "pipe"] });
  if (r.error) die(`${cmd} could not start (${r.error.code}). Is it installed and on PATH?`);
  if (r.status !== 0) die(`${cmd} failed (exit ${r.status}):\n${(r.stderr ?? "").split("\n").slice(-15).join("\n")}`);
  return r.stdout ?? "";
}

export function probeDuration(file) {
  const out = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { quiet: true });
  const d = Number.parseFloat(out.trim());
  if (!(d > 0)) die(`ffprobe found no duration in ${file}`);
  return d;
}

function loadEpisode(dir) {
  const root = resolve(dir);
  const scriptPath = join(root, "script.md");
  if (!existsSync(scriptPath)) die(`no script.md in ${root}`);
  try {
    return { root, ...parseScript(readFileSync(scriptPath, "utf8")) };
  } catch (e) {
    die(`script.md: ${e.message}`);
  }
}

/** Settings: --flag, then env, then the nearest .tutorial-video.json from the episode upwards. */
function settings(root, flags) {
  let config = {};
  for (let d = root; ; d = dirname(d)) {
    const f = join(d, ".tutorial-video.json");
    if (existsSync(f)) {
      config = JSON.parse(readFileSync(f, "utf8"));
      break;
    }
    if (dirname(d) === d) break;
  }
  return {
    voice: flags.voice ?? process.env.TUTORIAL_VOICE ?? config.voice,
    temperature: String(flags.temperature ?? config.temperature ?? 0.8),
    language: flags.language ?? config.language,
    gap: Number(flags.gap ?? config.gap ?? 0.5),
    maxChars: Number(config.captionChars ?? 84),
    padColor: config.padColor,
    pace: Number(flags.pace ?? config.pace ?? 1),
    sentencePause: Number(flags["sentence-pause"] ?? config.sentencePause ?? 0),
  };
}

/** Colour of the bars around a take that is not 16:9: --pad, else "padColor" in .tutorial-video.json, else black. */
function padColor(root, flags) {
  const c = String(flags.pad ?? settings(root, {}).padColor ?? "black");
  if (!/^(#[0-9a-fA-F]{6}|[a-z]+)$/.test(c)) die(`bad pad colour "${c}": use #rrggbb or a name`);
  return c.replace("#", "0x");
}

function findTake(root, id) {
  for (const ext of TAKE_EXTS) {
    const f = join(root, "takes", "raw", id + ext);
    if (existsSync(f)) return f;
  }
  return null;
}

function readTimeline(root) {
  const f = join(root, "timeline.json");
  if (!existsSync(f)) die("no timeline.json yet: run `narrate`, then `timeline`");
  return JSON.parse(readFileSync(f, "utf8"));
}

// ---------------------------------------------------------------- commands

function status(dir) {
  const ep = loadEpisode(dir);
  const tl = existsSync(join(ep.root, "timeline.json")) ? readTimeline(ep.root) : null;
  console.log(`${ep.meta.title ?? "(untitled)"} — ${ep.scenes.length} scenes`);
  for (const s of ep.scenes) {
    const wav = existsSync(join(ep.root, "audio", `${s.id}.wav`));
    const slot = tl?.scenes.find((t) => t.id === s.id);
    const cols = [
      s.id.padEnd(22),
      s.type.padEnd(7),
      wav ? "voice ✓" : "voice ·",
      slot ? `${slot.duration.toFixed(1)}s`.padStart(6) : "     -",
    ];
    if (s.type === "screen") {
      cols.push(findTake(ep.root, s.id) ? "take ✓" : "take ·");
      cols.push(existsSync(join(ep.root, "takes", `${s.id}.mp4`)) ? "ingested ✓" : "ingested ·");
    }
    console.log("  " + cols.join("  "));
  }
  if (tl) console.log(`total ${tl.total.toFixed(1)} s`);
}

function narrate(dir, flags) {
  const ep = loadEpisode(dir);
  const cfg = settings(ep.root, flags);
  if (!cfg.voice) die("no voice: pass --voice, set $env:TUTORIAL_VOICE, or add {\"voice\": \"...\"} to .tutorial-video.json");
  // A bare name ("george") is one of pocket-tts's built-in voices; anything else is a file to clone.
  const builtIn = /^[a-z_]+$/.test(cfg.voice);
  if (!builtIn && !existsSync(cfg.voice)) die(`voice file not found: ${cfg.voice}`);

  const only = typeof flags.scene === "string" ? flags.scene.split(",") : null;
  for (const id of only ?? []) if (!ep.scenes.some((s) => s.id === id)) die(`no scene "${id}" in script.md`);
  const audioDir = join(ep.root, "audio");
  mkdirSync(audioDir, { recursive: true });

  for (const s of ep.scenes) {
    if (!s.text) die(`scene "${s.id}" has no narration`);
    const out = join(audioDir, `${s.id}.wav`);
    if (existsSync(out)) {
      if (!only?.includes(s.id)) {
        console.log(`· ${s.id}: kept (pass --scene ${s.id} to redo it)`);
        continue;
      }
      let n = 1;
      while (existsSync(join(audioDir, `${s.id}.prev-${n}.wav`))) n++;
      renameSync(out, join(audioDir, `${s.id}.prev-${n}.wav`));
    } else if (only && !only.includes(s.id)) continue;

    console.log(`▶ ${s.id}: ${s.text.length} chars`);
    const say = (text, path) => {
      const args = ["generate", "--voice", cfg.voice, "--temperature", cfg.temperature, "--text", text, "--output-path", path, "-q"];
      if (cfg.language) args.push("--language", cfg.language);
      run("pocket-tts", args);
    };
    if (cfg.pace === 1 && cfg.sentencePause === 0) say(s.text, out);
    else {
      // Voice each sentence alone, then join them with a pause and apply the pace: TTS models rush
      // sentence boundaries, and pauses fix most of that before any slow-down is needed.
      const parts = sentences(s.text);
      const tmp = join(audioDir, `.${s.id}.parts`);
      mkdirSync(tmp, { recursive: true });
      const files = parts.map((text, i) => {
        const f = join(tmp, `${i}.wav`);
        say(text, f);
        return f;
      });
      run("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", joinFilter(files.length, cfg.sentencePause, cfg.pace), "-map", "[a]", out]);
      rmSync(tmp, { recursive: true, force: true });
    }
    console.log(`✓ ${s.id}: ${probeDuration(out).toFixed(2)} s`);
  }
  console.log("next: `timeline` to lay the scenes out");
}

function timeline(dir, flags) {
  const ep = loadEpisode(dir);
  const cfg = settings(ep.root, flags);
  const durations = {};
  for (const s of ep.scenes) {
    const wav = join(ep.root, "audio", `${s.id}.wav`);
    if (!existsSync(wav)) die(`scene "${s.id}" is not narrated yet`);
    durations[s.id] = probeDuration(wav);
  }
  const tl = layout(ep.scenes, durations, cfg.gap);
  writeFileSync(join(ep.root, "timeline.json"), JSON.stringify(tl, null, 2) + "\n");

  mkdirSync(join(ep.root, "out"), { recursive: true });
  writeFileSync(join(ep.root, "out", "episode.srt"), buildSrt(ep.scenes, tl, cfg.maxChars));
  const ch = chapters(ep.scenes, tl);
  writeFileSync(join(ep.root, "out", "chapters.txt"), ch.text + "\n");

  mkdirSync(join(ep.root, "build"), { recursive: true });
  writeFileSync(join(ep.root, "build", "hosts.html"), hostsHtml(ep, tl));

  const video = join(ep.root, "video");
  let copied = "";
  if (existsSync(join(video, "index.html"))) {
    for (const s of ep.scenes) {
      mkdirSync(join(video, "assets", "voice"), { recursive: true });
      copyFileSync(join(ep.root, "audio", `${s.id}.wav`), join(video, "assets", "voice", `${s.id}.wav`));
      const take = join(ep.root, "takes", `${s.id}.mp4`);
      if (s.type === "screen" && existsSync(take)) {
        mkdirSync(join(video, "assets", "takes"), { recursive: true });
        copyFileSync(take, join(video, "assets", "takes", `${s.id}.mp4`));
      }
    }
    copied = "copied voice and takes into video/assets/";
  } else copied = "video/ has no index.html yet: run `npx hyperframes init video`, then `timeline` again to copy assets";

  for (const s of tl.scenes) console.log(`  ${s.start.toFixed(2).padStart(7)}  +${s.duration.toFixed(2).padStart(6)}  ${s.id}`);
  console.log(`✓ total ${tl.total.toFixed(2)} s → timeline.json, out/episode.srt, out/chapters.txt, build/hosts.html`);
  for (const w of ch.warnings) console.log(`! chapters: ${w}`);
  console.log(copied);
}

/** Root-composition markup: one host per scene, the takes under them, a voice track per scene. */
export function hostsHtml(ep, tl) {
  const end = tl.end;
  const L = [
    `<!-- generated by tv.mjs timeline; paste inside #root and set the root's data-duration="${end}" -->`,
  ];
  for (const s of tl.scenes) {
    const scene = ep.scenes.find((x) => x.id === s.id);
    L.push(`<!-- ${s.id} [${scene.type}] at ${s.start}s: voice ${s.duration}s, on screen ${s.visual}s -->`);
    if (scene.type === "screen") {
      L.push(
        `<video id="take-${s.id}" class="clip" src="assets/takes/${s.id}.mp4" muted playsinline`,
        `  data-start="${s.start}" data-duration="${s.visual}" data-track-index="0"`,
        `  style="position:absolute;left:0;top:0;width:1920px;height:1080px;object-fit:contain;z-index:0"></video>`,
      );
    }
    L.push(
      `<div id="${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html"`,
      `  data-start="${s.start}" data-duration="${s.visual}" data-track-index="1" data-track-kind="graphics"`,
      `  data-width="1920" data-height="1080" style="z-index:1"></div>`,
      `<audio id="vo-${s.id}" class="clip" src="assets/voice/${s.id}.wav"`,
      `  data-start="${s.start}" data-duration="${s.duration}" data-track-index="2" data-volume="1"></audio>`,
    );
  }
  return L.join("\n") + "\n";
}

function record(dir, id) {
  const ep = loadEpisode(dir);
  const s = ep.scenes.find((x) => x.id === id);
  if (!s) die(`no scene "${id}"`);
  if (s.type !== "screen") die(`scene "${id}" is [${s.type}], not [screen]`);
  const out = join(ep.root, "takes", "raw", `${id}.mkv`);
  if (existsSync(out)) die(`${out} exists: rename or delete it before a new take`);
  const tl = existsSync(join(ep.root, "timeline.json")) ? readTimeline(ep.root) : null;
  const slot = tl?.scenes.find((x) => x.id === id);

  console.log(`Shot list for "${id}"${slot ? ` (narration ${slot.duration.toFixed(1)} s)` : ""}:`);
  for (const shot of s.shots.length ? s.shots : ["(no `> shot:` lines in script.md)"]) console.log(`  - ${shot}`);
  console.log(`\nNarration it must match:\n  ${s.text}\n`);
  console.log("Record the primary screen (press q in that window to stop; mkv survives a hard stop):");
  console.log(
    `New-Item -ItemType Directory -Force '${dirname(out)}' | Out-Null; ffmpeg -hide_banner -f gdigrab -framerate 30 -draw_mouse 1 -i desktop -c:v libx264 -preset ultrafast -crf 18 -pix_fmt yuv420p '${out}'`,
  );
  console.log(`\nOBS works too: save the file as takes/raw/${id}.mkv (or .mp4). Then: tv.mjs ingest ${dir} ${id}`);
}

function ingest(dir, id, flags) {
  const ep = loadEpisode(dir);
  const s = ep.scenes.find((x) => x.id === id);
  if (!s) die(`no scene "${id}"`);
  const src = findTake(ep.root, id);
  if (!src) die(`no take at takes/raw/${id}{${TAKE_EXTS.join(",")}}: run \`record\` first`);
  const slot = readTimeline(ep.root).scenes.find((x) => x.id === id);
  if (!slot) die(`scene "${id}" is not in timeline.json: run \`timeline\` again`);

  const tmp = join(ep.root, "takes", `${id}.pass1.mp4`);
  const out = join(ep.root, "takes", `${id}.mp4`);
  if (flags.marks) return ingestMarks(ep, id, src, slot, out, flags);
  const trim = [];
  if (flags.from) trim.push("-ss", String(flags.from));
  if (flags.to) trim.push("-to", String(flags.to));

  // Pass 1: trim, drop frozen stretches (waiting on sbt or the model), normalise to 1920x1080@30.
  const vf1 = [
    flags["keep-static"] ? null : "mpdecimate=hi=64*12:lo=64*5:frac=0.33,setpts=N/FRAME_RATE/TB",
    "scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos",
    `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${padColor(ep.root, flags)}`,
    "fps=30",
  ].filter(Boolean).join(",");
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...trim, "-i", src, "-an", "-vf", vf1, "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", tmp]);
  const kept = probeDuration(tmp);

  // Pass 2: speed up so the action ends with the narration (never slow down), then hold the last
  // frame until the scene leaves the screen (its `visual` slot covers the pause before the next scene).
  let speed;
  try {
    speed = fitSpeed(kept, slot.duration, Number(flags["max-speed"] ?? 8));
  } catch (e) {
    rmSync(tmp, { force: true });
    die(e.message);
  }
  const visual = slot.visual ?? slot.duration;
  const hold = Math.max(0, visual - kept / speed);
  const vf2 = [`setpts=PTS/${speed}`, hold > 0 ? `tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}` : null, "fps=30"].filter(Boolean).join(",");
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", tmp, "-vf", vf2, "-t", String(visual), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);
  rmSync(tmp, { force: true });

  const meta = { source: src, keptSeconds: Number(kept.toFixed(3)), speed, holdSeconds: Number(hold.toFixed(3)), narration: slot.duration, visual };
  writeFileSync(join(ep.root, "takes", `${id}.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`✓ takes/${id}.mp4: ${kept.toFixed(1)} s of action at ${speed}x${hold > 0 ? `, last frame held ${hold.toFixed(1)} s` : ""}`);
  if (speed >= 1.5) console.log(`  speed ${speed}x: show a fast-forward badge in compositions/${id}.html`);
}

/** --marks <file.json>: [{src, at}] pins each action in the raw take to its moment in the narration. */
function ingestMarks(ep, id, src, slot, out, flags) {
  if (flags.from || flags.to) die("--marks already says where the take starts; drop --from/--to");
  const marksFile = resolve(ep.root, String(flags.marks));
  if (!existsSync(marksFile)) die(`marks file not found: ${marksFile}`);
  const raw = JSON.parse(readFileSync(marksFile, "utf8"));
  const marks = Array.isArray(raw) ? raw : raw.marks;
  const visual = slot.visual ?? slot.duration;
  let segs;
  try {
    segs = planSegments(marks, probeDuration(src), visual);
  } catch (e) {
    die(e.message);
  }
  const normalise = ["scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos", `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=${padColor(ep.root, flags)}`, "fps=30"].join(",");
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src, "-an", "-filter_complex", segmentsFilter(segs, normalise), "-map", "[v]", "-t", String(visual), "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-g", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]);

  const meta = { source: src, marks: marksFile, narration: slot.duration, visual, segments: segs };
  writeFileSync(join(ep.root, "takes", `${id}.json`), JSON.stringify(meta, null, 2) + "\n");
  console.log(`✓ takes/${id}.mp4: ${segs.length} segments pinned to the narration`);
  for (const s of segs) {
    const note = s.speed > 1 ? `${s.speed}x` : s.hold > 0 ? `1x, holds ${s.hold}s` : "1x";
    console.log(`  at ${String(s.at).padStart(6)}s  src ${s.src0}–${s.src1}  ${note}`);
  }
  if (segs.some((s) => s.speed >= 1.5)) console.log(`  fast segments: show a fast-forward badge over them in compositions/${id}.html`);
}

// ---------------------------------------------------------------- main

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  const { pos, flags } = parseArgs(rest);
  const need = (n, usage) => pos.length >= n || die(`usage: tv.mjs ${usage}`);
  switch (cmd) {
    case "status": need(1, "status <episode>"); status(pos[0]); break;
    case "narrate": need(1, "narrate <episode> [--scene id]"); narrate(pos[0], flags); break;
    case "timeline": need(1, "timeline <episode>"); timeline(pos[0], flags); break;
    case "record": need(2, "record <episode> <scene>"); record(pos[0], pos[1]); break;
    case "ingest": need(2, "ingest <episode> <scene>"); ingest(pos[0], pos[1], flags); break;
    default:
      die("commands: status | narrate | timeline | record | ingest   (see the header of tv.mjs)");
  }
}
