---
name: tutorial-video
description: Make a narrated tutorial video or a YouTube playlist of them, from docs or code, with a cloned voice, real screen recordings and HyperFrames motion graphics. Use when the user wants a tutorial video, screencast, explainer episode, YouTube series or playlist, or asks "what's next" on an episode folder (one holding script.md). Start here; it routes to script-episode, narrate, assemble and publish-prep.
---

# Tutorial video: the pipeline

One episode is one folder. Voice comes first: the narration's length sets every scene's length, and
screen takes and animations are fitted to it, never the other way round.

```
<series>/
  .tutorial-video.json        {"voice": "C:/path/myvoice.safetensors", "theme": "...", "playlist": "..."}
  episodes/01-hello-claude/
    script.md                 scenes + narration + shot lists         ← script-episode
    audio/<scene>.wav         one clip per scene                      ← narrate
    timeline.json             start/duration per scene                ← narrate (tv.mjs timeline)
    takes/raw/<scene>.mkv     the user's screen recordings            ← record (the user)
    takes/<scene>.mp4 (.json) trimmed, 1080p, fitted to the slot      ← assemble (tv.mjs ingest)
    video/                    HyperFrames project                     ← assemble
    build/hosts.html          generated scene hosts + voice tracks
    out/episode.mp4 .srt chapters.txt youtube.md thumbnail.png        ← assemble, publish-prep
```

## The CLI

Every step that can be deterministic is in `tv.mjs`, in this plugin's `scripts/` folder: two levels
above this skill's base directory (`<base>/../../scripts/tv.mjs`). Node 18+, `ffmpeg`/`ffprobe` and
`pocket-tts` on PATH. Run `node <tv.mjs> status <episode>` first whenever you pick an episode back up:
it says which scenes have voice, takes and ingested takes.

| Command | Does |
|---|---|
| `status <ep>` | Table of scenes: type, voice ✓, slot length, take ✓, ingested ✓ |
| `narrate <ep> [--scene a,b]` | pocket-tts per scene → `audio/`. Keeps existing clips; `--scene` redoes one and keeps the old as `.prev-N.wav` |
| `timeline <ep>` | ffprobe the clips → `timeline.json`, `out/episode.srt`, `out/chapters.txt`, `build/hosts.html`; copies assets into `video/assets/` once `video/index.html` exists |
| `record <ep> <scene>` | Prints the shot list, the narration to match and a PowerShell ffmpeg recorder one-liner |
| `ingest <ep> <scene> [--from s --to s] [--keep-static]` | Trims, drops frozen stretches, 1920×1080@30, speeds up to fit the slot (max 8×, never slower; holds the last frame if short) |

## Order of work

1. **script-episode**: write `script.md` from the sources. Get the user's OK on the script before voicing.
2. **narrate**: voice every scene, listen to one clip with the user, run `timeline`.
3. **Screen takes**: for each `[screen]` scene, run `record` and give the user its output. The user
   records; you never drive their IDE or terminal for a take. Wait until they say the takes are in.
4. **assemble**: ingest the takes, build the HyperFrames project, preview, render.
5. **publish-prep**: YouTube title, description, chapters, thumbnail, playlist.

Steps 3 and 4 can overlap: motion scenes can be built while the user records.

## Rules

- Never overwrite a narration clip, a raw take or a rendered episode; new versions get new names.
- Never commit or upload the voice model. Its path comes from `--voice`, `$env:TUTORIAL_VOICE` or
  `.tutorial-video.json`, in that order.
- Code on screen is real code that compiles. Take it from the project's own sources or snippet files,
  never retype it from memory.
- A cloned voice is synthetic content: publish-prep reminds the user to tick YouTube's disclosure.
- Give commands for the user to run as one-line PowerShell.
