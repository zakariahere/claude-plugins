// Integration test for timeline + ingest with real ffmpeg. Skipped when ffmpeg is not on PATH.
// Voice is faked with a generated tone, so pocket-tts is not needed here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const TV = fileURLToPath(new URL("../scripts/tv.mjs", import.meta.url));
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

const ff = (...args) => {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
};
const tv = (...args) => spawnSync(process.execPath, [TV, ...args], { encoding: "utf8" });
const dur = (f) =>
  Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout);

test("timeline + ingest fit a long take into its narration slot", { skip: !hasFfmpeg && "ffmpeg not on PATH" }, () => {
  const ep = mkdtempSync(join(tmpdir(), "tv-episode-"));
  try {
    writeFileSync(join(ep, "script.md"), "## intro [title]\nHello there.\n\n## demo [screen]\nWatch this run.\n> shot: run it\n");
    mkdirSync(join(ep, "audio"));
    ff("-f", "lavfi", "-i", "sine=f=440:d=1.5", join(ep, "audio", "intro.wav"));
    ff("-f", "lavfi", "-i", "sine=f=440:d=2", join(ep, "audio", "demo.wav"));

    const t = tv("timeline", ep);
    assert.equal(t.status, 0, t.stderr);
    const tl = JSON.parse(readFileSync(join(ep, "timeline.json"), "utf8"));
    assert.deepEqual(tl.scenes.map((s) => s.start), [0, 2]);
    const hosts = readFileSync(join(ep, "build", "hosts.html"), "utf8");
    assert.match(hosts, /id="take-demo"[\s\S]*?data-start="2" data-duration="3"/); // narration 2 s + 1 s tail
    assert.match(hosts, /id="intro" [\s\S]*?data-start="0" data-duration="2"/); // covers the 0.5 s gap
    assert.match(hosts, /id="vo-intro"[\s\S]*?data-duration="1.5"/); // the voice keeps its own length
    assert.match(hosts, /root's data-duration="5"/); // 1.5 + 0.5 gap + 2 + 1 s tail
    assert.match(readFileSync(join(ep, "out", "episode.srt"), "utf8"), /Watch this run\./);

    // A 6 s take under 2 s of narration → 3x, then its last frame held for the 1 s tail.
    // --keep-static so frame dropping does not shorten it first.
    mkdirSync(join(ep, "takes", "raw"), { recursive: true });
    ff("-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=6", "-pix_fmt", "yuv420p", join(ep, "takes", "raw", "demo.mp4"));
    const i = tv("ingest", ep, "demo", "--keep-static");
    assert.equal(i.status, 0, i.stderr);
    const out = join(ep, "takes", "demo.mp4");
    assert.ok(existsSync(out));
    assert.ok(Math.abs(dur(out) - 3) < 0.15, `duration ${dur(out)}`);
    const meta = JSON.parse(readFileSync(join(ep, "takes", "demo.json"), "utf8"));
    assert.ok(meta.speed > 2.7 && meta.speed < 3.3, `speed ${meta.speed}`);

    // Narrating is refused without a voice, before pocket-tts is ever called.
    const n = spawnSync(process.execPath, [TV, "narrate", ep], { encoding: "utf8", env: { ...process.env, TUTORIAL_VOICE: "" } });
    assert.notEqual(n.status, 0);
  } finally {
    rmSync(ep, { recursive: true, force: true });
  }
});

test("a short, frozen take is held on its last frame rather than slowed down", { skip: !hasFfmpeg && "ffmpeg not on PATH" }, () => {
  const ep = mkdtempSync(join(tmpdir(), "tv-episode-"));
  try {
    writeFileSync(join(ep, "script.md"), "## demo [screen]\nA long explanation over a short take.\n");
    mkdirSync(join(ep, "audio"));
    ff("-f", "lavfi", "-i", "sine=f=440:d=4", join(ep, "audio", "demo.wav"));
    assert.equal(tv("timeline", ep).status, 0);
    mkdirSync(join(ep, "takes", "raw"), { recursive: true });
    ff("-f", "lavfi", "-i", "testsrc=size=1920x1080:rate=30:duration=1", "-pix_fmt", "yuv420p", join(ep, "takes", "raw", "demo.mp4"));
    const i = tv("ingest", ep, "demo");
    assert.equal(i.status, 0, i.stderr);
    assert.ok(Math.abs(dur(join(ep, "takes", "demo.mp4")) - 5) < 0.15); // 4 s narration + 1 s tail
    const meta = JSON.parse(readFileSync(join(ep, "takes", "demo.json"), "utf8"));
    assert.equal(meta.speed, 1);
    assert.ok(meta.holdSeconds > 2.5);
  } finally {
    rmSync(ep, { recursive: true, force: true });
  }
});

test("a frozen stretch (waiting on sbt) is cut before fitting", { skip: !hasFfmpeg && "ffmpeg not on PATH" }, () => {
  const ep = mkdtempSync(join(tmpdir(), "tv-episode-"));
  try {
    writeFileSync(join(ep, "script.md"), "## demo [screen]\nIt compiles, then runs.\n");
    mkdirSync(join(ep, "audio"));
    ff("-f", "lavfi", "-i", "sine=f=440:d=3", join(ep, "audio", "demo.wav"));
    assert.equal(tv("timeline", ep).status, 0);
    mkdirSync(join(ep, "takes", "raw"), { recursive: true });
    // 1 s of motion, 8 s of a frozen frame, 1 s of motion.
    ff("-f", "lavfi", "-i", "mandelbrot=size=640x360:rate=30", "-f", "lavfi", "-i", "color=c=gray:size=640x360:rate=30:d=8",
       "-filter_complex", "[0]split[x][y];[x]trim=0:1,setpts=PTS-STARTPTS[a];[y]trim=1:2,setpts=PTS-STARTPTS[b];[a][1][b]concat=n=3:v=1",
       "-pix_fmt", "yuv420p", join(ep, "takes", "raw", "demo.mp4"));
    const i = tv("ingest", ep, "demo");
    assert.equal(i.status, 0, i.stderr);
    const meta = JSON.parse(readFileSync(join(ep, "takes", "demo.json"), "utf8"));
    assert.ok(meta.keptSeconds < 3.5, "frozen 8 s should be mostly dropped, kept " + meta.keptSeconds);
    assert.ok(Math.abs(dur(join(ep, "takes", "demo.mp4")) - 4) < 0.15); // 3 s narration + 1 s tail
  } finally {
    rmSync(ep, { recursive: true, force: true });
  }
});

test("--marks lands each action on its narration moment", { skip: !hasFfmpeg && "ffmpeg not on PATH" }, () => {
  const ep = mkdtempSync(join(tmpdir(), "tv-episode-"));
  try {
    writeFileSync(join(ep, "script.md"), "## demo [screen]\nFirst this, then that.\n");
    mkdirSync(join(ep, "audio"));
    ff("-f", "lavfi", "-i", "sine=f=440:d=4", join(ep, "audio", "demo.wav"));
    assert.equal(tv("timeline", ep).status, 0); // visual = 4 + 1 s tail = 5
    mkdirSync(join(ep, "takes", "raw"), { recursive: true });
    // 2 s red, 8 s green, 3 s blue: the cut to green (src 2) must land at 1 s, to blue (src 10) at 3 s.
    ff("-f", "lavfi", "-i", "color=red:size=320x180:rate=30:d=2", "-f", "lavfi", "-i", "color=green:size=320x180:rate=30:d=8",
       "-f", "lavfi", "-i", "color=blue:size=320x180:rate=30:d=3", "-filter_complex", "[0][1][2]concat=n=3:v=1",
       "-pix_fmt", "yuv420p", join(ep, "takes", "raw", "demo.mp4"));
    writeFileSync(join(ep, "marks.json"), JSON.stringify([{ src: 1, at: 0 }, { src: 2, at: 1 }, { src: 10, at: 3 }]));
    const i = tv("ingest", ep, "demo", "--marks", "marks.json");
    assert.equal(i.status, 0, i.stderr);
    const out = join(ep, "takes", "demo.mp4");
    assert.ok(Math.abs(dur(out) - 5) < 0.15, `duration ${dur(out)}`);
    const colorAt = (t) => {
      const r = spawnSync("ffmpeg", ["-v", "error", "-ss", String(t), "-i", out, "-frames:v", "1", "-vf", "crop=8:8:956:536,scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
      const [R, G, B] = r.stdout;
      return R > 150 ? "red" : G > 100 ? "green" : B > 150 ? "blue" : `?${R},${G},${B}`;
    };
    assert.deepEqual([0.5, 1.5, 2.8, 3.3, 4.8].map(colorAt), ["red", "green", "green", "blue", "blue"]);
    const meta = JSON.parse(readFileSync(join(ep, "takes", "demo.json"), "utf8"));
    assert.equal(meta.segments[1].speed, 4); // 8 s of green into 2 s
  } finally {
    rmSync(ep, { recursive: true, force: true });
  }
});
