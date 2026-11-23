---
name: publish-prep
description: Prepare a rendered tutorial episode for YouTube. Title, description with chapters and links, tags, thumbnail, captions file, playlist placement and the synthetic-voice disclosure, written to out/youtube.md. Use for "prepare the upload", "YouTube description", "thumbnail", "chapters", or after an episode renders.
---

# publish-prep

Writes `out/youtube.md` and `out/thumbnail.png` for the user to paste into YouTube Studio. Never upload,
post or change a channel yourself; the user publishes.

## out/youtube.md

```markdown
# Title (≤ 70 chars, the outcome first: "Call Claude from Scala in 5 minutes | anthropic4s #1")

## Description
Two sentences on what the viewer builds. Then links: docs page(s) from the script's `sources`,
repo, previous/next episode (fill in once their URLs exist).

Chapters:
<contents of out/chapters.txt, with each scene id turned into a short human title>

## Tags
5–10 specific tags (library name, language, framework, "claude api").

## Upload checklist
- [ ] Playlist: <playlist from script.md>, position <episode>
- [ ] Captions: upload out/episode.srt (Subtitles → Upload file → With timing)
- [ ] Altered or synthetic content: **Yes**, the narration is an AI clone of my voice
- [ ] Thumbnail: out/thumbnail.png
- [ ] End screen: next episode + subscribe
```

Rewrite each chapter title from its scene id into words a viewer would scan for. If `timeline`
warned about chapters (fewer than 3, or one under 10 s), say so: YouTube will show none.

## Thumbnail

1280×720 PNG. Render it with HyperFrames from the episode's title composition
(`npx hyperframes snapshot` at a frame where the title is fully in, or a dedicated still composition),
same theme as the video: 3–5 words, large, high contrast, readable at 160 px wide. Look at it at that
size before handing it over.
