import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSrt, chapters, cues, fitSpeed, layout, parseScript, srtTime, ytTime } from "../scripts/lib.mjs";

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

test("time formats", () => {
  assert.equal(srtTime(3723.4567), "01:02:03,457");
  assert.equal(ytTime(65), "1:05");
  assert.equal(ytTime(3725), "1:02:05");
});
