---
name: script-episode
description: Write or revise the script.md of a tutorial video episode, or plan a playlist of episodes, from docs, a repo or a topic. Narration to be spoken by TTS, split into title, motion and screen scenes, with a shot list for each screen recording. Use for "write the script", "plan the playlist", "episode outline", or before narrating a new episode.
---

# script-episode

## Playlist first (once per series)

When the user asks for a series, propose the episode list before writing any script: one idea per
episode, 3 to 7 minutes each, in an order where every episode only needs the earlier ones. Map
episodes to the source's own chapters where it has them. Create `episodes/NN-slug/` folders only
after the user agrees.

## script.md format

```markdown
---
title: Hello Claude from Scala
episode: 1
playlist: anthropic4s in 10 minutes
sources: https://anthropic4s.zakaria.lu/docs/quick-start/
---

## intro [title]
In the next five minutes, you'll call Claude from Scala and get a reply back.

## first-request [screen]
We start from the new-agent template. One dependency, one client, one request.
> shot: IntelliJ, font size 20, open build.sbt and point at the anthropic4s line
> shot: open Main.scala, select the MessageRequest
> shot: terminal, sbt run, wait for the reply

## why-io [motion]
Nothing has happened yet when you build a request. It's a value...
```

- `## <id> [type]`: kebab-case id, unique. Types: `title` (a card), `motion` (an animated
  explanation, HyperFrames), `screen` (the user's real recording). No type means `motion`.
- Plain lines are spoken. `> shot:` lines are the shot list (never spoken). `<!-- -->` is a note.
- Check it with `node <tv.mjs> status <episode>`, which fails with a clear message on a bad script.

## Writing for the ear

The voice reads exactly what is written, so write the way the narrator talks:
- Short sentences, one idea each. Contractions. Second person ("you'll see").
- Say code, don't spell it: "the message request" not "`MessageRequest`"; "sbt run";
  "max tokens"; never read punctuation, brackets or package paths aloud.
- Numbers and units in words when spoken oddly: "four oh four", "ten megabytes", "version one point oh".
- No markdown, emoji, URLs or abbreviations the TTS will mangle in the spoken lines.
- About 150 spoken words per minute. Aim for 20 to 60 seconds per scene; split longer ones.
- A `screen` scene's narration describes what the viewer sees happen, in the order it happens, so the
  take can be fitted under it. Every action in the narration has a `> shot:` line.
- Open with what the viewer will have at the end, not with a greeting. End with the next episode's hook.
- YouTube chapters need 3 or more scenes of 10 s or longer; `timeline` warns otherwise.

## Accuracy

Every claim and every line of code shown must come from the sources listed in front matter or the
project's own code. Quote code from the real files (snippet files, a template project, tests), and
say in the script which file a screen take shows.
