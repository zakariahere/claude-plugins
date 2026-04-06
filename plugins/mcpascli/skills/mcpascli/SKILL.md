---
name: mcpascli
description: Grafana observability via mcp2cli. Use when the user wants to interact with Grafana — query metrics (Prometheus), logs (Loki), traces (Tempo), profiles (Pyroscope), manage dashboards, alerts, incidents, on-call schedules, or run Sift investigations. All commands run against the local Grafana MCP server at localhost:8000.
user-invocable: true
---

# mcpascli Skill

You have access to a Grafana observability stack via `mcp2cli --mcp http://localhost:8000/sse`.
Use the Bash tool to run these commands directly — no MCP connection needed.

## Prerequisites

Before running any command, ensure `mcp2cli` is installed:

```bash
# Check if mcp2cli is available; install if not
command -v mcp2cli >/dev/null 2>&1 || uv tool install mcp2cli
```

Run this check once at the start of each session before issuing any `mcp2cli` commands.

When the user asks a natural-language question (e.g. "show me error logs for the last hour", "what's the p99 latency?", "is anyone on call?"), map it to the appropriate command below and run it.

---

## Datasources

```bash
# List all datasources (get UIDs for Prometheus, Loki, Tempo, Pyroscope)
mcp2cli --mcp http://localhost:8000/sse list-datasources
mcp2cli --mcp http://localhost:8000/sse list-datasources --type prometheus
mcp2cli --mcp http://localhost:8000/sse list-datasources --type loki
mcp2cli --mcp http://localhost:8000/sse list-datasources --type tempo

# Get a specific datasource by UID or name
mcp2cli --mcp http://localhost:8000/sse get-datasource --uid <uid>
```

> Always run `list-datasources` first to discover the correct `--datasource-uid` values before querying Prometheus, Loki, Tempo, or Pyroscope.

---

## Prometheus (Metrics)

```bash
# Discover available metrics (start here)
mcp2cli --mcp http://localhost:8000/sse list-prometheus-metric-names \
  --datasource-uid <uid> \
  --regex "http.*"       # optional filter

# Get metric metadata (type, help text)
mcp2cli --mcp http://localhost:8000/sse list-prometheus-metric-metadata \
  --datasource-uid <uid>

# List label names for a metric
mcp2cli --mcp http://localhost:8000/sse list-prometheus-label-names \
  --datasource-uid <uid>

# List label values
mcp2cli --mcp http://localhost:8000/sse list-prometheus-label-values \
  --datasource-uid <uid>

# Instant query
mcp2cli --mcp http://localhost:8000/sse query-prometheus \
  --datasource-uid <uid> \
  --expr "up" \
  --query-type instant

# Range query
mcp2cli --mcp http://localhost:8000/sse query-prometheus \
  --datasource-uid <uid> \
  --expr "rate(http_requests_total[5m])" \
  --query-type range \
  --start-time "now-1h" \
  --end-time "now" \
  --step-seconds 60

# Histogram percentiles (p50, p95, p99)
mcp2cli --mcp http://localhost:8000/sse query-prometheus-histogram \
  --datasource-uid <uid> \
  --expr "http_request_duration_seconds" \
  --start-time "now-1h" \
  --end-time "now" \
  --step-seconds 60
```

---

## Loki (Logs)

```bash
# Query logs with LogQL
mcp2cli --mcp http://localhost:8000/sse query-loki-logs \
  --datasource-uid <uid> \
  --logql '{app="my-service"} |= "error"' \
  --start-rfc3339 "2024-01-01T00:00:00Z" \
  --end-rfc3339 "2024-01-01T01:00:00Z" \
  --limit 100 \
  --direction backward   # newest first (default)

# Detect log patterns
mcp2cli --mcp http://localhost:8000/sse query-loki-patterns \
  --datasource-uid <uid> \
  --logql '{app="my-service"}'

# Log stream stats (volume, labels)
mcp2cli --mcp http://localhost:8000/sse query-loki-stats \
  --datasource-uid <uid> \
  --logql '{app="my-service"}'

# Discover label names
mcp2cli --mcp http://localhost:8000/sse list-loki-label-names \
  --datasource-uid <uid>

# Discover label values
mcp2cli --mcp http://localhost:8000/sse list-loki-label-values \
  --datasource-uid <uid> \
  --label-name app
```

---

## Tempo (Traces)

```bash
# Find slow requests (automated Sift analysis)
mcp2cli --mcp http://localhost:8000/sse find-slow-requests \
  --name "slow-requests-investigation" \
  --start "now-1h" \
  --end "now" \
  --labels '{"service": "my-service"}'
```

---

## Pyroscope (Profiling)

```bash
# List available profile types
mcp2cli --mcp http://localhost:8000/sse list-pyroscope-profile-types \
  --datasource-uid <uid>

# List label names for profiles
mcp2cli --mcp http://localhost:8000/sse list-pyroscope-label-names \
  --datasource-uid <uid>

# List label values
mcp2cli --mcp http://localhost:8000/sse list-pyroscope-label-values \
  --datasource-uid <uid> \
  --label-name service_name

# Query profiles
mcp2cli --mcp http://localhost:8000/sse query-pyroscope \
  --datasource-uid <uid>
```

---

## Dashboards & Panels

```bash
# Search dashboards
mcp2cli --mcp http://localhost:8000/sse search-dashboards --query "kubernetes"
mcp2cli --mcp http://localhost:8000/sse search-dashboards --query "kubernetes" --limit 20

# Get full dashboard JSON by UID
mcp2cli --mcp http://localhost:8000/sse get-dashboard-by-uid --uid <uid>

# Get a compact summary (title, panel count, variables)
mcp2cli --mcp http://localhost:8000/sse get-dashboard-summary --uid <uid>

# Extract specific property using JSONPath
mcp2cli --mcp http://localhost:8000/sse get-dashboard-property \
  --uid <uid> \
  --json-path "$.panels[*].title"

# Get all panel queries
mcp2cli --mcp http://localhost:8000/sse get-dashboard-panel-queries --uid <uid>

# Render a panel as PNG
mcp2cli --mcp http://localhost:8000/sse get-panel-image \
  --dashboard-uid <uid> \
  --panel-id <panel-id> \
  --width 1000 \
  --height 500 \
  --theme dark \
  --time-range '{"from": "now-1h", "to": "now"}'

# Create or update a dashboard (full JSON mode)
mcp2cli --mcp http://localhost:8000/sse update-dashboard --stdin < dashboard.json

# Create a folder
mcp2cli --mcp http://localhost:8000/sse create-folder --title "My Folder"

# Search folders
mcp2cli --mcp http://localhost:8000/sse search-folders --query "team"
```

---

## Alerts & Alerting

```bash
# Manage alert rules (CRUD)
mcp2cli --mcp http://localhost:8000/sse alerting-manage-rules --stdin < rule.json

# Manage notification routing
mcp2cli --mcp http://localhost:8000/sse alerting-manage-routing --stdin < routing.json
```

---

## Incidents

```bash
# List incidents
mcp2cli --mcp http://localhost:8000/sse list-incidents
mcp2cli --mcp http://localhost:8000/sse list-incidents --status active
mcp2cli --mcp http://localhost:8000/sse list-incidents --status resolved --limit 20

# Get a single incident
mcp2cli --mcp http://localhost:8000/sse get-incident --incident-id <id>

# Create an incident
mcp2cli --mcp http://localhost:8000/sse create-incident \
  --title "Database latency spike" \
  --severity critical \
  --status active

# Add a note to an incident timeline
mcp2cli --mcp http://localhost:8000/sse add-activity-to-incident \
  --incident-id <id> \
  --body "Rolled back deployment, latency returning to normal"
```

---

## On-Call

```bash
# List on-call teams
mcp2cli --mcp http://localhost:8000/sse list-oncall-teams

# List on-call users
mcp2cli --mcp http://localhost:8000/sse list-oncall-users

# Who is on call right now?
mcp2cli --mcp http://localhost:8000/sse get-current-oncall-users --schedule-id <id>

# List schedules
mcp2cli --mcp http://localhost:8000/sse list-oncall-schedules

# Get a specific shift
mcp2cli --mcp http://localhost:8000/sse get-oncall-shift --shift-id <id>

# List alert groups
mcp2cli --mcp http://localhost:8000/sse list-alert-groups

# Get a specific alert group
mcp2cli --mcp http://localhost:8000/sse get-alert-group --alert-group-id <id>
```

---

## Sift Investigations

```bash
# Find elevated error patterns vs baseline
mcp2cli --mcp http://localhost:8000/sse find-error-pattern-logs \
  --name "error-spike-investigation" \
  --start "now-1h" \
  --end "now" \
  --labels '{"app": "my-service"}'

# List past investigations
mcp2cli --mcp http://localhost:8000/sse list-sift-investigations

# Get an investigation by UUID
mcp2cli --mcp http://localhost:8000/sse get-sift-investigation --investigation-id <uuid>

# Get a specific analysis within an investigation
mcp2cli --mcp http://localhost:8000/sse get-sift-analysis \
  --investigation-id <uuid> \
  --analysis-id <uuid>
```

---

## Annotations

```bash
# Create an annotation (e.g. mark a deployment)
mcp2cli --mcp http://localhost:8000/sse create-annotation \
  --dashboard-uid <uid> \
  --text "Deployed v1.2.3" \
  --time 1700000000000   # epoch ms

# Fetch annotations
mcp2cli --mcp http://localhost:8000/sse get-annotations \
  --dashboard-uid <uid>

# List annotation tags
mcp2cli --mcp http://localhost:8000/sse get-annotation-tags

# Update an annotation
mcp2cli --mcp http://localhost:8000/sse update-annotation \
  --annotation-id <id> \
  --text "Updated note"
```

---

## Misc

```bash
# Generate a deeplink to a dashboard, panel, or explore view
mcp2cli --mcp http://localhost:8000/sse generate-deeplink \
  --dashboard-uid <uid>

# Get assertions for an entity
mcp2cli --mcp http://localhost:8000/sse get-assertions \
  --entity-name my-service \
  --entity-type service \
  --env production
```

---

## Usage Notes

- Run `list-datasources` first to get UIDs — commands that query Prometheus/Loki/Tempo/Pyroscope all require `--datasource-uid`.
- Time formats: use RFC3339 (`2024-01-01T00:00:00Z`) or relative (`now`, `now-1h`, `now-2h30m`) where supported.
- For commands that take complex JSON arguments (`--labels`, `--time-range`, `--variables`), pass them as inline JSON strings.
- For commands that require full JSON bodies (`update-dashboard`, `alerting-manage-rules`), use `--stdin` and pipe the JSON file.
- `create-incident` with `--is-drill` creates a drill incident — safe for testing.
- `find-error-pattern-logs` and `find-slow-requests` are asynchronous — they start a Sift investigation; use `get-sift-investigation` to poll results.
