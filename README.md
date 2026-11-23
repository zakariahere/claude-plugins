# claude-plugins

Marketplace for Claude plugins created or imported by [zakariahere](https://github.com/zakariahere).

---

## 🧩 Plugins

| Plugin | Version | Category | Description |
|--------|---------|----------|-------------|
| [mcpascli](#mcpascli) | 1.0.0 | mcp | Turn any MCP server into a Claude skill — run all server tools via mcp2cli from natural language |
| [pactjunitplugin](#pactjunitplugin) | 1.0.0 | development | Pact JUnit contract test generator for Java |
| [tutorial-video](#tutorial-video) | 0.1.0 | media | Narrated tutorial videos and YouTube playlists with a cloned voice, screen takes and HyperFrames |

---

## Plugin Details

### mcpascli

> Turn any MCP server into a Claude skill. Point `mcp2cli` at any MCP SSE endpoint and run all its tools through natural language — no MCP client configuration required.

- **Author:** zakariahere
- **License:** Apache-2.0
- **Repository:** https://github.com/zakariahere/claude-plugins
- **Tags:** `mcp` · `mcp2cli` · `cli` · `tools` · `skill`

#### How it works

`mcpascli` uses [`mcp2cli`](https://github.com/zakariahere/mcp2cli) to bridge any MCP server to the command line. The included skill is pre-configured for a Grafana MCP server (`localhost:8000`) but the pattern works with **any MCP SSE endpoint** — point it at a different URL and all tools exposed by that server become available.

```bash
# General pattern
mcp2cli --mcp <SSE_URL> <tool-name> [--arg value ...]

# Example: Grafana MCP server
mcp2cli --mcp http://localhost:8000/sse list-datasources
```

#### Skills

| Skill | Description |
|-------|-------------|
| `/mcpascli` | Invoke any tool from a running MCP server using natural language |

#### Bundled tool coverage (Grafana MCP)

The skill ships with a full command reference for the Grafana MCP server, covering:

- **Prometheus** — metric discovery, PromQL instant & range queries, histogram percentiles
- **Loki** — LogQL queries, pattern detection, label discovery
- **Tempo** — slow request trace analysis via Sift
- **Pyroscope** — profile type listing, label discovery, profile queries
- **Dashboards & Panels** — search, render, create, update, deeplinks
- **Incidents** — create, list, update, add timeline activities
- **On-Call** — schedules, shifts, current on-call users, alert groups
- **Sift Investigations** — error pattern analysis, slow request detection
- **Alerting** — alert rules and notification routing management
- **Annotations** — create, fetch, update

#### When to use

- You have any MCP server running and want to interact with it via Claude without configuring MCP clients
- You want to run MCP tools from Bash commands inside Claude Code
- You need a ready-made skill for the Grafana observability stack

---

### pactjunitplugin

> Interactive Pact JUnit test generator — guides you through building consumer and provider contract tests from OpenAPI specs or scratch, with full DSL support for `PactDslJsonBody`, matchers, and state management.

- **Author:** zakariahere
- **License:** Apache-2.0
- **Repository:** https://github.com/zakariahere/pactjunitplugin
- **Tags:** `pact` · `java` · `contract-testing` · `junit`

#### Commands

| Command | Description |
|---------|-------------|
| `/pact` | Interactive 4-phase workflow: discover → design interactions → generate → review |
| `/pact-consumer` | Quick consumer-side Pact test from a description or OpenAPI spec |
| `/pact-provider` | Quick provider verification test scaffold |
| `/pact-from-spec` | Parse an OpenAPI spec file and generate all consumer tests |

#### When to use

- You need to generate Pact consumer or provider contract tests in Java (JUnit 5)
- You want to scaffold `PactDslJsonBody` interactions, matchers, or provider states
- You have an OpenAPI spec and want to convert it to Pact tests

---

### tutorial-video

> Make narrated tutorial videos and whole YouTube playlists from docs or code. The voice comes first (a local cloned voice through Kyutai pocket-tts), real screen recordings are trimmed and fitted under the narration, and the explanations are HyperFrames motion graphics.

- **Author:** zakariahere
- **License:** Apache-2.0
- **Repository:** https://github.com/zakariahere/claude-plugins
- **Tags:** `video` · `tutorial` · `youtube` · `tts` · `screen-recording` · `hyperframes`

#### Requirements

- Node 18+, `ffmpeg` + `ffprobe`, and [`pocket-tts`](https://github.com/kyutai-labs/pocket-tts) (`uv tool install pocket-tts`) on PATH
- The HyperFrames plugin: `/plugin marketplace add heygen-com/hyperframes`, then `/plugin install hyperframes@hyperframes`
- A voice: `pocket-tts export-voice sample.wav myvoice.safetensors`, then point the plugin at it with
  `$env:TUTORIAL_VOICE` or `{"voice": "..."}` in a `.tutorial-video.json`. The voice file never goes in Git.

#### Skills

| Skill | Description |
|-------|-------------|
| `/tutorial-video` | The pipeline and episode folder layout; start here |
| `/script-episode` | Playlist plan and `script.md`: title / motion / screen scenes, written for the ear, with shot lists |
| `/narrate` | Voice each scene, then lay out the timeline, `.srt` captions and YouTube chapters |
| `/assemble` | Ingest screen takes, build the HyperFrames project, preview and render |
| `/publish-prep` | YouTube title, description, chapters, thumbnail and upload checklist |

#### The CLI

`plugins/tutorial-video/scripts/tv.mjs` does the deterministic parts (no npm dependencies):
`status`, `narrate`, `timeline`, `record` (prints the shot list and an ffmpeg screen recorder),
`ingest` (trim, drop frozen waits, 1080p, fit the take to its narration). Tests: `node --test plugins/tutorial-video/test/*.test.mjs`.
