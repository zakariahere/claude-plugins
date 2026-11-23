---
name: narrate
description: Voice a tutorial episode's script.md scene by scene with a local cloned voice (Kyutai pocket-tts), then lay out the timeline, captions and chapters. Use for "narrate", "voice it", "redo the voice for scene X", "make the audio", or after a script is approved.
---

# narrate

Scripts: `node <plugin>/scripts/tv.mjs …`, where `<plugin>` is two levels above this skill's base directory.

## Voice setup (once per machine)

`pocket-tts` must be on PATH (`uv tool install pocket-tts`). The voice is a `.safetensors` exported
with `pocket-tts export-voice <sample.wav> <voice.safetensors>` (WAV/MP3/FLAC; convert MP4/M4A first
with `ffmpeg -i in.m4a -ac 1 -ar 24000 out.wav`). Point the plugin at it by any of:
`--voice <path>`, `$env:TUTORIAL_VOICE='<path>'`, or `{"voice": "<path>"}` in a
`.tutorial-video.json` in the episode folder or any parent (the series root is the usual place).
Only clone the user's own voice, or a voice they have the rights to.

**Or use a built-in voice**: a bare name instead of a path (`"voice": "george"`). English: alba, anna,
vera, fantine, eponine, azelma, mary, jane, eve, caro_davy, cosette (female); jean, marius, javert,
charles, paul, george, michael, bill_boerst, peter_yearsley, stuart_bell (male). Nothing to keep
private, and it sounds the same on every machine. If the user isn't sure, voice one line in four or
five of them with `pocket-tts generate --voice <name> --text "..." --output-path <name>.wav` and let
them pick by ear.

Optional keys in `.tutorial-video.json`: `temperature` (default 0.8; 0.6 calmer, 1.0 livelier),
`language` (pocket-tts model, e.g. `french_24l`), `gap` (seconds of silence between scenes, 0.5),
`captionChars` (84), and two for pace:
- `sentencePause` (seconds, default 0): voices each sentence on its own and joins them with this much
  silence. pocket-tts runs sentences together; 0.4–0.5 fixes most "too fast" complaints.
- `pace` (default 1): slows (below 1) or speeds up the joined clip without changing pitch. Stay at
  0.9 or above; slower sounds dragged. `0.93` with `sentencePause: 0.45` is about 150 words a minute.

## Steps

1. `tv.mjs narrate <episode>`: one `audio/<scene>.wav` per scene. Existing clips are kept. The model
   downloads on first use; allow a few minutes of timeout.
2. Send one clip to the user (the first scene) before going on, so they can judge pace and tone.
3. Fix what they don't like:
   - a word said wrong: respell it phonetically in script.md ("Anthropic-four-S", "Scala" → "Skah-la"
     only if needed), then `tv.mjs narrate <episode> --scene <id>`. The old take is kept as `.prev-N.wav`.
   - flat delivery: raise `temperature` for that run (`--temperature 0.95`), regenerate the scene.
   - too fast: set `sentencePause` and `pace` (above), regenerate every scene so the episode sounds even.
   - the voice itself: switch to a built-in voice (above). Re-voicing changes every slot, so re-run
     `timeline`, re-transcribe, move each take mark's `at` and every composition beat to the new word
     times, and re-ingest.
4. `tv.mjs timeline <episode>`: writes `timeline.json`, `out/episode.srt`, `out/chapters.txt`,
   `build/hosts.html`, and prints each scene's start and length. Rerun it after any re-narration,
   then re-ingest takes whose slot changed.

The `.srt` is built from the script, so its words are exactly right; its timing is spread by
character count within each scene. For word-exact burned-in captions, `assemble` uses
`npx hyperframes transcribe` on the voice clips instead.
