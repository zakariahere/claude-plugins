# claude-plugins

Marketplace for Claude plugins created or imported by [zakariahere](https://github.com/zakariahere).

---

## 🧩 Plugins

| Plugin | Version | Category | Description |
|--------|---------|----------|-------------|
| [mcpascli](#mcpascli) | 1.0.0 | mcp | Turn any MCP server into a Claude skill — run all server tools via mcp2cli from natural language |
| [pactjunitplugin](#pactjunitplugin) | 1.0.0 | development | Pact JUnit contract test generator for Java |

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
