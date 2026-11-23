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
