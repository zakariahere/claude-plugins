---
description: Parse an OpenAPI spec (YAML or JSON, file path or pasted inline) and generate complete JUnit 5 Pact consumer tests for every selected endpoint, with correct type matchers and provider states.
---

You are an expert in both OpenAPI and Pact JUnit 5 contract testing. Convert the OpenAPI spec below into complete, compilable Pact consumer tests.

$ARGUMENTS

## Instructions

### Step 1: Read the spec

If $ARGUMENTS is a file path, read the file. If it is inline YAML/JSON, parse it directly.

Extract:
- `info.title` → use as provider name (sanitize to PascalCase)
- `servers[0].url` → base path hint
- Each `paths` entry → one or more Pact interactions
- `components/schemas` → reusable body shapes

### Step 2: Ask scoping questions (one message)

Before generating, confirm:

1. **Consumer name?** (the service that will call this API)
2. **Which endpoints to cover?** (list all found paths; ask user to pick or say "all")
3. **Which status codes to cover?** (200 only? or also 400, 404, 401?)
4. **Package name?** (e.g., `com.example.contracts`)
5. **Pact output dir?** (default: `target/pacts`)

### Step 3: Map OpenAPI → Pact DSL

For each selected operation, apply these mapping rules:

| OpenAPI | PactDslJsonBody method |
|---------|----------------------|
| `type: string` | `.stringType("field", "example")` |
| `type: string, format: date-time` | `.timestamp("field", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")` |
| `type: string, format: date` | `.date("field", "yyyy-MM-dd")` |
| `type: string, format: uuid` | `.uuid("field")` |
| `type: string, format: email` | `.stringMatcher("field", "^[^@]+@[^@]+\\.[^@]+$", "user@example.com")` |
| `type: string, pattern: ...` | `.stringMatcher("field", "PATTERN", "example")` |
| `type: string, enum: [...]` | `.stringValue("field", "FIRST_ENUM_VALUE")` (enums are exact) |
| `type: integer` | `.integerType("field", 0)` |
| `type: number` | `.numberType("field", 0.0)` |
| `type: boolean` | `.booleanType("field", true)` |
| `type: object` | `.object("field") ... .closeObject()` |
| `type: array` | `.minArrayLike("field", 1) ... .closeArray()` |
| `nullable: true` (any type) | wrap with `.or("field", PactDslJsonRootValue.TYPE, PactDslJsonRootValue.nullValue())` |
| `$ref` | resolve the referenced schema and apply recursively |

**Path parameters**: use `.matchPath("/users/[0-9]+", "/users/123")` when parameters are numeric IDs; use `.path("/users/abc-123")` for string IDs.

**Query parameters**: use `.matchQuery("status", "active|inactive", "active")` for enums; `.query("page", "1")` for exact.

**Request headers**: always include `Accept: application/json`. Add `Authorization: Bearer token` if the operation has a security scheme.

### Step 4: Generate one class per consumer–provider pair

Group all interactions into a single test class. Use one `@Pact` method per interaction (one per endpoint + status code combination).

Name the class: `{ConsumerName}To{ProviderName}ContractTest`
Name pact methods: `{httpMethod}{ResourceName}{StatusCode}Pact` (e.g., `getUser200Pact`, `postOrder422Pact`)

### Step 5: Generate provider state strings

For each `2xx` response interaction, derive a provider state from the path:
- `GET /users/{id}` → `"user with id {id} exists"`
- `POST /orders` → `"order can be created"`
- `DELETE /items/{id}` → `"item with id {id} exists"`
- `GET /users/{id}` with 404 → `"user with id {id} does not exist"`

Output the full list of state strings as a separate block so the user can copy them into the provider test.

### Step 6: Output

1. Complete consumer test class(es)
2. Provider state strings table
3. Maven dependency block (if not already present)
4. Short note on any spec fields that could not be automatically mapped (e.g., `oneOf`, `anyOf`, polymorphic schemas) with suggestions for manual handling
