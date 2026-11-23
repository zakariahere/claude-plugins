import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSrt, chapters, cues, fitSpeed, joinFilter, layout, parseScript, planSegments, segmentsFilter, sentences, srtTime, ytTime } from "../scripts/lib.mjs";

const SCRIPT = `---
title: Hello Claude from Scala
playlist: anthropic4s
---
# Episode 1 (ignored heading)

## intro [title]
Hi! In this episode we call Claude
from Scala.

## first-request [screen]
We open the template and run it.
> shot: open IntelliJ on the new-agent template
> shot: run sbt run in the terminal
<!-- remember to zoom the font -->

## why-it-works
Every call is an IO value.
`;

test("parseScript reads front matter, scenes, types, shots and joins narration", () => {
  const { meta, scenes } = parseScript(SCRIPT);
  assert.deepEqual(meta, { title: "Hello Claude from Scala", playlist: "anthropic4s" });
  assert.deepEqual(
    scenes.map((s) => [s.id, s.type]),
    [["intro", "title"], ["first-request", "screen"], ["why-it-works", "motion"]],
  );
  assert.equal(scenes[0].text, "Hi! In this episode we call Claude from Scala.");
  assert.equal(scenes[1].text, "We open the template and run it.");
  assert.deepEqual(scenes[1].shots, ["open IntelliJ on the new-agent template", "run sbt run in the terminal"]);
});

test("parseScript handles CRLF and rejects bad input", () => {
  assert.equal(parseScript(SCRIPT.replace(/\n/g, "\r\n")).scenes.length, 3);
  assert.throws(() => parseScript("stray text\n## a\nx"), /before the first/);
  assert.throws(() => parseScript("## a [video]\nx"), /unknown type/);
  assert.throws(() => parseScript("## a\nx\n## a\ny"), /duplicate/);
  assert.throws(() => parseScript("nothing here"), /before the first|no scenes/);
});

test("layout puts gaps between scenes, not after the last", () => {
  const scenes = [{ id: "a", type: "title" }, { id: "b", type: "screen" }];
  const tl = layout(scenes, { a: 2, b: 3.25 }, 0.5);
  assert.deepEqual(tl.scenes, [
    { id: "a", type: "title", start: 0, duration: 2, visual: 2.5 },
    { id: "b", type: "screen", start: 2.5, duration: 3.25, visual: 4.25 },
  ]);
  assert.equal(tl.total, 5.75);
  assert.equal(tl.end, 6.75);
  assert.throws(() => layout(scenes, { a: 2 }), /no duration for scene "b"/);
});

test("cues break at sentences, then at words under the limit", () => {
  assert.deepEqual(cues("One. Two! Three?"), ["One.", "Two!", "Three?"]);
  const long = cues("alpha beta gamma delta epsilon", 12);
  assert.ok(long.every((c) => c.length <= 12), JSON.stringify(long));
  assert.equal(long.join(" "), "alpha beta gamma delta epsilon");
});

test("buildSrt spreads each scene over its cues and stays inside the scene", () => {
  const { scenes } = parseScript(SCRIPT);
  const tl = layout(scenes, { intro: 4, "first-request": 3, "why-it-works": 2 }, 0.5);
  const srt = buildSrt(scenes, tl);
  assert.match(srt, /^1\n00:00:00,000 --> /);
  assert.match(srt, /We open the template and run it\./);
  assert.match(srt, /00:00:04,500 --> 00:00:07,500\nWe open/);
  assert.equal(srt.trim().split("\n\n").length, 4); // "Hi!" + "In this episode…" + 1 + 1
});

test("chapters warn when YouTube would drop them", () => {
  const { scenes } = parseScript(SCRIPT);
  const short = chapters(scenes, layout(scenes, { intro: 4, "first-request": 3, "why-it-works": 2 }));
  assert.equal(short.text.split("\n")[0], "0:00 Intro");
  assert.ok(short.warnings.some((w) => w.includes("shorter than 10 s")));
  const ok = chapters(scenes, layout(scenes, { intro: 12, "first-request": 30, "why-it-works": 20 }));
  assert.deepEqual(ok.warnings, []);
  assert.equal(ok.text, "0:00 Intro\n0:12 First request\n0:43 Why it works");
});

test("fitSpeed never slows down and refuses absurd speed-ups", () => {
  assert.equal(fitSpeed(5, 10), 1);
  assert.equal(fitSpeed(30, 10), 3);
  assert.throws(() => fitSpeed(100, 10), /trim it/);
});

test("planSegments speeds up long stretches, holds short ones, plays the tail at 1x", () => {
  // Take is 40 s. Actions at 3 s, 20 s and 22 s of the take must land at 0, 5 and 9 s of a 12 s scene.
  const segs = planSegments([{ src: 3, at: 0 }, { src: 20, at: 5 }, { src: 22, at: 9 }], 40, 12);
  assert.deepEqual(segs, [
    { src0: 3, src1: 20, at: 0, target: 5, speed: 3.4, hold: 0 }, // 17 s into 5 s
    { src0: 20, src1: 22, at: 5, target: 4, speed: 1, hold: 2 }, // 2 s into 4 s: hold
    { src0: 22, src1: 25, at: 9, target: 3, speed: 1, hold: 0 }, // tail at real time
  ]);
  // The tail holds when the take runs out.
  assert.equal(planSegments([{ src: 0, at: 0 }], 2, 5)[0].hold, 3);
});

test("planSegments rejects marks it cannot honour", () => {
  assert.throws(() => planSegments([], 10, 5), /at least one/);
  assert.throws(() => planSegments([{ src: 1, at: 1 }], 10, 5), /first mark/);
  assert.throws(() => planSegments([{ src: 0, at: 0 }, { src: 0, at: 2 }], 10, 5), /src must increase/);
  assert.throws(() => planSegments([{ src: 0, at: 0 }, { src: 2, at: 0 }], 10, 5), /at must increase/);
  assert.throws(() => planSegments([{ src: 0, at: 0 }, { src: 12, at: 2 }], 10, 5), /outside the take/);
  assert.throws(() => planSegments([{ src: 0, at: 0 }, { src: 2, at: 6 }], 10, 5), /before the scene ends/);
});

test("segmentsFilter builds one split, a retimed branch per segment and a concat", () => {
  const f = segmentsFilter(planSegments([{ src: 0, at: 0 }, { src: 6, at: 2 }], 8, 4), "fps=30");
  assert.match(f, /^\[0:v\]fps=30,split=2\[s0in\]\[s1in\];/);
  assert.match(f, /\[s0in\]trim=start=0:end=6,setpts=\(PTS-STARTPTS\)\/3,fps=30,trim=duration=2/);
  assert.match(f, /\[s0\]\[s1\]concat=n=2:v=1:a=0\[v\]$/);
});

test("time formats", () => {
  assert.equal(srtTime(3723.4567), "01:02:03,457");
  assert.equal(ytTime(65), "1:05");
  assert.equal(ytTime(3725), "1:02:05");
});

test("sentences splits on . ! ? followed by a space, keeping the punctuation", () => {
  assert.deepEqual(sentences("Let's run it. And there's Claude's answer! Done?  Yes"), [
    "Let's run it.",
    "And there's Claude's answer!",
    "Done?",
    "Yes",
  ]);
  assert.deepEqual(sentences("version one point oh, then more."), ["version one point oh, then more."]);
});

test("joinFilter pads every clip but the last and applies the pace", () => {
  assert.equal(
    joinFilter(3, 0.45, 0.93),
    "[0:a]apad=pad_dur=0.45[p0];[1:a]apad=pad_dur=0.45[p1];[p0][p1][2:a]concat=n=3:v=0:a=1,atempo=0.93[a]",
  );
  assert.equal(joinFilter(1, 0.45, 1), "[0:a]concat=n=1:v=0:a=1,anull[a]");
  assert.throws(() => joinFilter(2, 0.4, 0.3), /pace/);
});
