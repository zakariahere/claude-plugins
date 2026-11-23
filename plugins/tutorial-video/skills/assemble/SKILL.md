---
name: assemble
description: Turn a narrated tutorial episode into a video. Ingest the user's screen recordings (trim, drop frozen waits, fit to the narration), build the HyperFrames project with title, motion and screen scenes over the voice track, preview it and render episode.mp4. Use for "record the screen for scene X", "ingest my takes", "build the video", "render the episode".
---

# assemble

Needs the HyperFrames plugin (`/plugin install hyperframes@hyperframes`). **Load the `hyperframes`
skill before writing any composition**: its contract (clip timing, `<template>` scenes, host ids equal
to scene ids, `fromTo` not `from`, no `play()`) is what makes the render match the preview.
Scripts: `node <plugin>/scripts/tv.mjs …`, `<plugin>` being two levels above this skill's base directory.

## 1. Screen takes (the user records them)

For each `[screen]` scene, run `tv.mjs record <episode> <scene>` and pass its output on: the shot
list, the narration to match and a one-line PowerShell ffmpeg recorder (press `q` to stop). OBS is
fine too, saved as `takes/raw/<scene>.mkv` or `.mp4`. Tips worth repeating to the user:
- Record the screen at 1920×1080 if they can; at higher resolutions zoom the editor font to 18–22 pt
  and the terminal to match, so code is still readable on a phone.
- Act out the shot list at a calm pace without worrying about waits; ingest cuts frozen stretches.
- Hide notifications, bookmarks bars, tokens, emails and anything private. Never show `.env` files.
Wait for the user to say a take is in, and check `takes/raw/` before believing it. Don't record or
drive their screen unless they ask you to.

### When the user asks Claude to drive the take

Possible when the IDE has an MCP server (JetBrains: open files, apply patches, run configurations):
1. Back up every file you will touch. Dry-run the final code off camera first (it compiles, the run
   works), then restore the starting state. Hide panels that would spoil the result.
2. Record only the IDE window, not an ultra-wide desktop: read its rectangle (Win32 `GetWindowRect`,
   DPI-aware) and use `ffmpeg -f gdigrab -offset_x X -offset_y Y -video_size WxH -draw_mouse 0`,
   as a background task, `-t` as a safety cap. Stop it by stopping that task, never by killing every
   ffmpeg process.
3. Act in script order: open the file, add code a few lines per patch, run. Never show secrets: a run
   configuration's environment can hold an API key; use the configuration, never print its env.
4. Restore the user's files from the backup and check they are identical.

## 2. Ingest

`tv.mjs ingest <episode> <scene>`, with `--from 12.5 --to 80` to cut a take's start and end.
It writes `takes/<scene>.mp4`, fitted exactly to the scene's slot, and `takes/<scene>.json` with the
`speed` used. If ingest refuses (more than 8× needed), trim with `--from/--to` or ask for a shorter take.
`--keep-static` keeps frozen stretches (for a scene that is mostly reading still code).
`--pad #10131a` (or `padColor` in `.tutorial-video.json`) colours the bars around a take that isn't 16:9.

**Per-action sync** (`--marks takes/<scene>.marks.json`): the plain fit speeds the whole take up evenly,
so the middle drifts. Marks pin each action to the word that names it: `[{"src": 6.733, "at": 14.7}, ...]`,
`src` seconds into the raw take, `at` seconds into the scene, the first at `0`. Stretches between marks
are sped up to fit (a fast-forward badge goes over any ≥ 1.5×) or hold their last frame; the tail plays
at 1×. Find `src` with scene detection (`ffmpeg -i raw.mkv -vf "select='gt(scene,0.002)',showinfo"
-f null -` plus a contact sheet of frames to name each change) and `at` from word times
(`npx hyperframes transcribe audio/<scene>.wav --model small.en`).

Look at a few frames before going on: `ffmpeg -ss <t> -i takes/<scene>.mp4 -frames:v 1 frame.png`.
With marks, check a frame just before and just after each `at`.

## 3. Build the HyperFrames project

1. `npx hyperframes init video` inside the episode folder (once), then `tv.mjs timeline <episode>`
   again: it copies voice clips and ingested takes into `video/assets/`.
2. Paste `build/hosts.html` inside the root `#root` of `video/index.html` and set the root's
   `data-duration` to the value in its first comment. It holds, per scene, the composition host, the
   screen take (`[screen]` scenes, under the host) and the voice `<audio>`, all with timings from
   `timeline.json`. Regenerate and re-paste after any timing change; don't hand-edit timings.
3. Write `video/compositions/<scene>.html` for every scene, ids matching the hosts:
   - `[title]`: the episode title and number, the series name, a short subtitle. 2–3 moves, no more.
   - `[motion]`: animate the idea the narration explains, beat by beat. Time each beat to when it
     is said: `npx hyperframes transcribe video/assets/voice/<scene>.wav --model small.en` gives
     word times. Show code as real code from the sources, highlighted, revealed line by line.
   - `[screen]`: the take plays underneath; the composition only adds overlays. A small
     "⏩ 3×" badge whenever `takes/<scene>.json` says speed ≥ 1.5. Callouts or a zoom box on the
     line being talked about, timed from the transcript. Keep the centre of the code clear.
   - Theme: `theme` from `.tutorial-video.json`, else ask once. Same type, colours and title card
     across a playlist; reuse the first episode's compositions as the template for the next.
4. Captions: a captions host from the transcripts, per the hyperframes captions reference, if the
   user wants burned-in captions. `out/episode.srt` is for YouTube either way.

## 4. Check, preview, render

Follow the hyperframes work loop: `npx hyperframes lint`, `check --json` until clean, `snapshot` at
the middle of each scene and read the PNGs (code readable? overlays clear of the code?), then
`preview` and give the user the URL. Render `--quality draft` while iterating; render
`--quality delivery -o ../out/episode.mp4` only after the user approves the preview.
Afterwards confirm `ffprobe` duration ≈ the root `data-duration` and that the voice is audible
throughout (`ffmpeg -i out/episode.mp4 -af volumedetect -f null -`).
