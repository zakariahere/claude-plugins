# claude-plugins

Marketplace for Claude plugins created or imported by [zakariahere](https://github.com/zakariahere).

---

## 🧩 Plugins

| Plugin | Version | Category | Description |
|--------|---------|----------|-------------|
| [mcpascli](#mcpascli) | 1.0.0 | observability | Grafana observability stack via mcp2cli — metrics, logs, traces, incidents, dashboards |
| [pactjunitplugin](#pactjunitplugin) | 1.0.0 | development | Pact JUnit contract test generator for Java |

---

## Plugin Details

### mcpascli

> Grafana observability via mcp2cli — interact with Grafana dashboards, alerts, incidents, Prometheus, Loki, Tempo, and Pyroscope using natural language commands routed through mcp2cli.

- **Author:** zakariahere
- **License:** Apache-2.0
- **Repository:** https://github.com/zakariahere/claude-plugins
- **Tags:** `grafana` · `observability` · `prometheus` · `loki` · `incidents` · `mcp`

#### Skills

| Skill | Description |
|-------|-------------|
| `/mcpascli` | Run any Grafana MCP tool — query metrics, logs, traces, manage incidents, dashboards, alerts, and on-call |

#### When to use

- You want to query Prometheus metrics or run PromQL expressions
- You want to search or tail Loki logs with LogQL
- You want to find slow traces via Tempo or profile with Pyroscope
- You want to list, create, or render Grafana dashboards and panels
- You want to manage incidents, add timeline notes, or check on-call schedules
- You want to run Sift investigations for error pattern or slow request analysis

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
