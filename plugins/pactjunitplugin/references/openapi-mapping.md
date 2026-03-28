# OpenAPI → Pact DSL Mapping

Reference for converting OpenAPI 3.x schema properties to `PactDslJsonBody` matcher methods.

---

## Primitive types

| OpenAPI schema | PactDslJsonBody method | Notes |
|---------------|----------------------|-------|
| `type: string` | `.stringType("f", "example")` | Generic string — type match only |
| `type: string` + `format: date-time` | `.timestamp("f", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")` | ISO 8601 |
| `type: string` + `format: date` | `.date("f", "yyyy-MM-dd")` | Date only |
| `type: string` + `format: time` | `.time("f", "HH:mm:ss")` | Time only |
| `type: string` + `format: uuid` | `.uuid("f")` | Any UUID v4 |
| `type: string` + `format: email` | `.stringMatcher("f", "^[^@]+@[^@]+\\.[^@]+$", "a@b.com")` | |
| `type: string` + `format: uri` | `.stringMatcher("f", "https?://.+", "https://example.com")` | |
| `type: string` + `pattern: REGEX` | `.stringMatcher("f", "REGEX", "example")` | Use schema pattern directly |
| `type: string` + `enum: [A, B]` | `.stringValue("f", "A")` | Enums are exact — pick first value |
| `type: integer` | `.integerType("f", 0)` | |
| `type: integer` + `format: int64` | `.integerType("f", 0L)` | |
| `type: number` | `.numberType("f", 0.0)` | |
| `type: number` + `format: float` | `.decimalType("f", 0.0f)` | |
| `type: boolean` | `.booleanType("f", true)` | |

---

## Composite types

| OpenAPI schema | PactDslJsonBody method |
|---------------|----------------------|
| `type: object` + `properties: {...}` | `.object("f") ... .closeObject()` — recurse into properties |
| `type: array` + `items: {...}` | `.minArrayLike("f", 1) ... .closeArray()` — recurse into items schema |
| `type: array` + `minItems: N` | `.minArrayLike("f", N) ... .closeArray()` |
| `type: array` + `maxItems: N` | `.maxArrayLike("f", N) ... .closeArray()` |
| `type: array` + `minItems: M` + `maxItems: N` | `.minMaxArrayLike("f", M, N) ... .closeArray()` |
| `$ref: '#/components/schemas/Foo'` | Resolve `Foo` schema and apply recursively |

---

## Nullability

| OpenAPI nullability | PactDslJsonBody approach |
|--------------------|--------------------------|
| `nullable: true` (OpenAPI 3.0) | `.or("f", PactDslJsonRootValue.TYPE, PactDslJsonRootValue.nullValue())` |
| `type: [string, null]` (OpenAPI 3.1) | same as above |
| field not in `required` array | Still add a matcher — absence of a field in the contract means the consumer doesn't need it, but if it's present in responses you want to validate its type |

---

## HTTP method → Pact interaction mapping

| OpenAPI operation | `.method()` | Request body? | Common status codes |
|-------------------|-------------|---------------|---------------------|
| `get` | `"GET"` | No | 200, 404, 401 |
| `post` | `"POST"` | Yes | 201, 400, 422, 409 |
| `put` | `"PUT"` | Yes | 200, 404, 400 |
| `patch` | `"PATCH"` | Yes (partial) | 200, 404, 400 |
| `delete` | `"DELETE"` | No | 204, 404 |

---

## Path parameters

| OpenAPI path param type | Pact path approach |
|------------------------|-------------------|
| `integer` / `int64` | `.matchPath("/resource/[0-9]+", "/resource/1")` |
| `string` (UUID) | `.matchPath("/resource/[0-9a-f-]{36}", "/resource/550e8400-e29b-41d4-a716-446655440000")` |
| `string` (slug/name) | `.matchPath("/resource/[a-z0-9-]+", "/resource/my-item")` |
| `string` (opaque) | `.path("/resource/abc123")` — exact is fine for opaque IDs |

---

## Query parameters

| OpenAPI query param | Pact query approach |
|--------------------|---------------------|
| `type: integer` | `.matchQuery("page", "[0-9]+", "1")` |
| `type: string` + `enum` | `.matchQuery("status", "active\|inactive", "active")` |
| `type: boolean` | `.matchQuery("includeDeleted", "true\|false", "false")` |
| `type: string` (free text) | `.query("q=searchterm")` or omit if not required |
| `required: false` | Only include if the consumer sends it — don't add optional params you don't use |

---

## Security schemes

| OpenAPI security scheme | Pact header approach |
|------------------------|----------------------|
| `bearerAuth` (Bearer JWT) | `.matchHeader("Authorization", "Bearer .+", "Bearer eyJ...")` |
| `apiKey` in header | `.matchHeader("X-Api-Key", ".+", "test-key")` |
| `basicAuth` | `.matchHeader("Authorization", "Basic .+", "Basic dXNlcjpwYXNz")` |

---

## Schemas to handle manually

These OpenAPI constructs require human judgment — flag them and ask the user:

| Construct | Why it needs manual handling |
|-----------|------------------------------|
| `oneOf` / `anyOf` / `allOf` | Pact doesn't support polymorphic matchers natively — pick the most common variant |
| `discriminator` | Map the discriminator field as `.stringValue()` (exact) then model the specific variant |
| `additionalProperties: true` | Pact ignores extra fields by default — no special handling needed |
| `additionalProperties: false` | Pact can't enforce this — document it as a known gap |
| Recursive `$ref` | Flatten to 1–2 levels deep to avoid infinite DSL chains |
| Binary / file upload (`format: binary`) | Use `.body(fileContent, "application/octet-stream")` — skip `PactDslJsonBody` |
