---
name: mcpascli
description: Grafana observability via mcp2cli. Use when the user wants to interact with Grafana — query metrics (Prometheus), logs (Loki), traces (Tempo), profiles (Pyroscope), manage dashboards, alerts, incidents, on-call schedules, or run Sift investigations. All commands run against the local Grafana MCP server at localhost:8000.
license: Apache-2.0
metadata:
  author: zakariahere
  version: "1.0.0"
---

# mcpascli Plugin

Interact with the full Grafana observability stack using natural language. Commands are executed via `mcp2cli --mcp http://localhost:8000/sse`.

## Available Skill

| Skill | What it does |
|-------|-------------|
| `/mcpascli` | Run any Grafana MCP tool — query metrics, logs, traces, manage incidents, dashboards, alerts, on-call, and more |

## When to Trigger This Skill

- User wants to query Prometheus metrics or PromQL
- User wants to search or tail Loki logs
- User wants to trace slow requests via Tempo
- User wants to inspect profiling data via Pyroscope
- User wants to list, create, or manage Grafana dashboards or folders
- User wants to manage alerts, routing, or alert rules
- User wants to create or update incidents, add timeline notes, or check on-call
- User wants to run a Sift investigation for error pattern or slow request analysis
- User asks about datasources, annotations, or generates deeplinks

## Quick Reference

**Discover first** — run `list-datasources` to find datasource UIDs before querying Prometheus/Loki/Tempo/Pyroscope.

**Workflow pattern**
```
list-datasources → get UID → query/list metrics/logs
```

See `skills/mcpascli/SKILL.md` for the full command reference.
