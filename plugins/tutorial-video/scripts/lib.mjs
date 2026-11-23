// Pure helpers shared by the tutorial-video scripts. No dependencies, no I/O.

export const SCENE_TYPES = ["title", "motion", "screen"];

/**
 * Parse an episode script.
 *
 *   ---
 *   title: Hello Claude from Scala
 *   ---
 *   ## intro [title]
 *   Spoken narration, any number of lines.
 *   > shot: a line for the shot list (never spoken)
 *   <!-- a comment (never spoken) -->
 */
export function parseScript(md) {
  const text = md.replace(/\r\n/g, "\n");
  const meta = {};
  let body = text;
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    }
    body = text.slice(fm[0].length);
  }
  body = body.replace(/<!--[\s\S]*?-->/g, "");

  const scenes = [];
  let cur = null;
  for (const line of body.split("\n")) {
    const h = line.match(/^##\s+([a-z0-9][a-z0-9-]*)\s*(?:\[(\w+)\])?\s*$/);
    if (h) {
      const type = h[2] ?? "motion";
      if (!SCENE_TYPES.includes(type)) {
        throw new Error(`scene "${h[1]}": unknown type [${type}], use one of ${SCENE_TYPES.join(", ")}`);
      }
      if (scenes.some((s) => s.id === h[1])) throw new Error(`duplicate scene id "${h[1]}"`);
      cur = { id: h[1], type, lines: [], shots: [] };
      scenes.push(cur);
      continue;
    }
    if (/^#\s/.test(line)) continue; // a top-level heading is for humans
    if (!cur) {
      if (line.trim()) throw new Error(`text before the first "## scene-id [type]" heading: "${line.trim()}"`);
      continue;
    }
    const shot = line.match(/^>\s*shot:\s*(.*)$/i);
    if (shot) cur.shots.push(shot[1].trim());
    else if (!/^>/.test(line)) cur.lines.push(line);
  }
  if (scenes.length === 0) throw new Error('no scenes: add at least one "## scene-id [type]" heading');

  return {
    meta,
    scenes: scenes.map(({ lines, ...s }) => ({
      ...s,
      text: lines.join(" ").replace(/\s+/g, " ").trim(),
    })),
  };
}

/**
 * Lay scenes end to end with `gap` seconds of silence between them.
 * `duration` is the narration; `visual` is how long the scene stays on screen: up to the next scene's
 * start (covering the gap), and for the last scene up to `end` (total + `tail`), so nothing goes blank.
 */
export function layout(scenes, durations, gap = 0.5, tail = 1) {
  let t = 0;
  const out = scenes.map((s, i) => {
    const duration = durations[s.id];
    if (typeof duration !== "number" || !(duration > 0)) throw new Error(`no duration for scene "${s.id}"`);
    const start = round(t);
    t += duration + (i < scenes.length - 1 ? gap : 0);
    return { id: s.id, type: s.type, start, duration: round(duration) };
  });
  const total = round(t);
  const end = round(total + tail);
  out.forEach((s, i) => {
    s.visual = round((out[i + 1]?.start ?? end) - s.start);
  });
  return { gap, total, end, scenes: out };
}

/** Split narration into caption cues of at most `maxChars`, breaking at sentence ends first. */
export function cues(text, maxChars = 84) {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
  const out = [];
  for (const s of sentences) {
    if (s.length <= maxChars) {
      out.push(s);
      continue;
    }
    let line = "";
    for (const word of s.split(" ")) {
      if (line && (line + " " + word).length > maxChars) {
        out.push(line);
        line = word;
      } else line = line ? line + " " + word : word;
    }
    if (line) out.push(line);
  }
  return out;
}

/** SRT for the whole episode. Each scene's time is spread over its cues by character count. */
export function buildSrt(scenes, timeline, maxChars) {
  const byId = Object.fromEntries(timeline.scenes.map((s) => [s.id, s]));
  const entries = [];
  for (const s of scenes) {
    const slot = byId[s.id];
    const parts = cues(s.text, maxChars);
    const chars = parts.reduce((n, p) => n + p.length, 0);
    let t = slot.start;
    for (const p of parts) {
      const d = (slot.duration * p.length) / chars;
      entries.push({ start: t, end: t + d, text: p });
      t += d;
    }
  }
  return (
    entries.map((e, i) => `${i + 1}\n${srtTime(e.start)} --> ${srtTime(e.end)}\n${e.text}\n`).join("\n")
  );
}

/** YouTube chapter lines. YouTube needs the first at 0:00 and at least three, each 10 s or longer. */
export function chapters(scenes, timeline) {
  const titles = Object.fromEntries(scenes.map((s) => [s.id, s.title ?? humanize(s.id)]));
  const lines = timeline.scenes.map((s) => `${ytTime(s.start)} ${titles[s.id]}`);
  const warnings = [];
  if (timeline.scenes.length < 3) warnings.push("YouTube shows chapters only with 3 or more");
  timeline.scenes.forEach((s, i) => {
    const next = timeline.scenes[i + 1]?.start ?? timeline.total;
    if (next - s.start < 10) warnings.push(`chapter "${s.id}" is shorter than 10 s; YouTube will drop all chapters`);
  });
  return { text: lines.join("\n"), warnings };
}

/** Speed factor to fit a take of `takeSeconds` into `slotSeconds`. Never slower than real time. */
export function fitSpeed(takeSeconds, slotSeconds, maxSpeed = 8) {
  if (!(takeSeconds > 0) || !(slotSeconds > 0)) throw new Error("durations must be positive");
  const speed = Math.max(1, takeSeconds / slotSeconds);
  if (speed > maxSpeed) {
    throw new Error(
      `take is ${takeSeconds.toFixed(1)} s for a ${slotSeconds.toFixed(1)} s scene (${speed.toFixed(1)}x): ` +
        `trim it (--from/--to) or lengthen the narration`,
    );
  }
  return round(speed, 3);
}

/**
 * Piecewise retiming for a take with known action moments.
 * `marks`: [{src, at}] — `src` seconds into the raw take, `at` seconds into the scene where that moment must land.
 * The first mark is where the scene starts (`at` 0). Each stretch between marks is sped up to fit its target
 * (never slowed down); a stretch shorter than its target holds its last frame. After the last mark the take plays
 * at real time until `visual`, holding its last frame if it runs out.
 */
export function planSegments(marks, takeSeconds, visual) {
  if (!Array.isArray(marks) || marks.length === 0) throw new Error("marks: need at least one {src, at}");
  if (marks[0].at !== 0) throw new Error("marks: the first mark must have at: 0 (where the scene starts)");
  marks.forEach((m, i) => {
    if (!(typeof m.src === "number" && typeof m.at === "number")) throw new Error(`marks[${i}]: src and at must be numbers`);
    if (m.src < 0 || m.src > takeSeconds) throw new Error(`marks[${i}]: src ${m.src} is outside the take (0..${takeSeconds.toFixed(2)})`);
    if (i > 0 && !(m.src > marks[i - 1].src)) throw new Error(`marks[${i}]: src must increase`);
    if (i > 0 && !(m.at > marks[i - 1].at)) throw new Error(`marks[${i}]: at must increase`);
  });
  if (marks.at(-1).at >= visual) throw new Error(`marks: the last at (${marks.at(-1).at}) must be before the scene ends (${visual})`);

  const segs = [];
  for (let i = 0; i < marks.length; i++) {
    const a = marks[i];
    const b = marks[i + 1];
    const src0 = a.src;
    const target = (b ? b.at : visual) - a.at;
    const src1 = b ? b.src : Math.min(takeSeconds, a.src + target);
    const len = src1 - src0;
    const speed = b && len > target ? len / target : 1;
    const hold = Math.max(0, target - len / speed);
    segs.push({ src0: round(src0), src1: round(src1), at: round(a.at), target: round(target), speed: round(speed, 3), hold: round(hold) });
  }
  return segs;
}

/** Narration split into sentences, so each can be voiced alone and joined with a pause between them. */
export function sentences(text) {
  return text
    .split(/(?<=[.!?])\s+(?=\S)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * ffmpeg -filter_complex joining n sentence clips (inputs 0..n-1) with `pause` seconds of silence between them,
 * then slowed (or sped up) by `pace` without changing pitch. Output label [a].
 */
export function joinFilter(n, pause, pace) {
  if (!(pace >= 0.5 && pace <= 2)) throw new Error(`pace ${pace} must be between 0.5 and 2`);
  if (!(pause >= 0)) throw new Error(`sentencePause ${pause} must be 0 or more`);
  const parts = [];
  const ins = [];
  for (let i = 0; i < n; i++) {
    if (i < n - 1 && pause > 0) {
      parts.push(`[${i}:a]apad=pad_dur=${pause}[p${i}]`);
      ins.push(`[p${i}]`);
    } else ins.push(`[${i}:a]`);
  }
  const tempo = pace === 1 ? "anull" : `atempo=${pace}`;
  parts.push(`${ins.join("")}concat=n=${n}:v=0:a=1,${tempo}[a]`);
  return parts.join(";");
}

/** ffmpeg -filter_complex for planSegments: normalise, split, retime each stretch, concat. Output label [v]. */
export function segmentsFilter(segs, normalise) {
  const n = segs.length;
  const labels = segs.map((_, i) => `s${i}`);
  const parts = [`[0:v]${normalise},split=${n}${labels.map((l) => `[${l}in]`).join("")}`];
  segs.forEach((s, i) => {
    const f = [`trim=start=${s.src0}:end=${s.src1}`, `setpts=(PTS-STARTPTS)/${s.speed}`];
    if (s.hold > 0) f.push(`tpad=stop_mode=clone:stop_duration=${s.hold}`);
    f.push("fps=30", `trim=duration=${s.target}`, "setpts=PTS-STARTPTS");
    parts.push(`[${labels[i]}in]${f.join(",")}[${labels[i]}]`);
  });
  parts.push(`${labels.map((l) => `[${l}]`).join("")}concat=n=${n}:v=1:a=0[v]`);
  return parts.join(";");
}

export function humanize(id) {
  const s = id.replace(/^\d+-/, "").replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function srtTime(sec) {
  const ms = Math.round(sec * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

export function ytTime(sec) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function round(n, digits = 3) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
