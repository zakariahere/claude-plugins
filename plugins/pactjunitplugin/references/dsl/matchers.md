# PactDslJsonBody — Matcher Reference

All matcher methods available on `PactDslJsonBody`. Use type/format matchers in consumer tests rather than exact values — this produces resilient contracts that survive unrelated field changes.

---

## String matchers

```java
// Type only — any non-null string
.stringType("field", "example value")

// Exact value — use sparingly (discriminators, enum values)
.stringValue("field", "ACTIVE")

// Regex match
.stringMatcher("field", "^[A-Z]{2}[0-9]{4}$", "AB1234")
// args: (fieldName, regex, exampleValue)
// ⚠ exampleValue MUST match the regex — Pact validates this at build time

// Includes substring
.stringContains("field", "foo")

// Starts with
.stringStartsWith("field", "usr_")
```

---

## Numeric matchers

```java
// Integer (no decimals)
.integerType("count", 0)

// Decimal number
.numberType("price", 9.99)
.decimalType("tax", 1.23)

// Exact number — use for constants like status codes in embedded objects
.numberValue("version", 1)
```

---

## Boolean

```java
.booleanType("active", true)
.booleanValue("featured", false)   // exact value
```

---

## Date and time matchers

```java
import java.util.Date;

// ISO 8601 datetime
.timestamp("createdAt", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
.timestamp("updatedAt", "yyyy-MM-dd'T'HH:mm:ss.SSSXXX", new Date())

// Date only
.date("birthDate", "yyyy-MM-dd")
.date("startDate", "yyyy-MM-dd", new Date())

// Time only
.time("openTime", "HH:mm:ss")

// ISO 8601 shorthand — most common for REST APIs
.datetime("createdAt", "yyyy-MM-dd'T'HH:mm:ssXXX")
```

> **Tip**: The format string must be a valid `java.text.SimpleDateFormat` pattern, not `java.time.format.DateTimeFormatter` syntax.

---

## UUID

```java
// Matches any UUID v4 string
.uuid("id")
.uuid("correlationId", "550e8400-e29b-41d4-a716-446655440000")
```

---

## Null and optional

```java
// Field must be null
.nullValue("deletedAt")

// Field can be string OR null
.or("field",
    PactDslJsonRootValue.stringType("example"),
    PactDslJsonRootValue.nullValue())

// Field can be integer OR null
.or("count",
    PactDslJsonRootValue.integerType(0),
    PactDslJsonRootValue.nullValue())
```

---

## Array matchers

```java
// Array where every element matches this shape (min 1)
.eachLike("items")
    .stringType("id", "1")
.closeArray()

// Min size
.minArrayLike("items", 2)
    .stringType("id", "1")
.closeArray()

// Max size
.maxArrayLike("items", 10)
    .stringType("id", "1")
.closeArray()

// Min and max
.minMaxArrayLike("items", 1, 5)
    .stringType("id", "1")
.closeArray()

// Each element matches a value matcher (primitive array)
.eachValue(PactDslJsonRootValue.integerType(1))   // array of integers
```

---

## Object inclusion / ignoring extra fields

By default Pact uses "loose" matching on response bodies — **extra fields returned by the provider are ignored**. You only need to specify the fields the consumer actually uses.

```java
// Consumer only cares about id and name — ignores any other fields in response
new PactDslJsonBody()
    .stringType("id", "1")
    .stringType("name", "Alice")
// other fields the provider returns are fine — contract won't break
```

---

## Request path matchers

```java
// Exact path (default — use for most cases)
.path("/users/123")

// Regex path (use when path param is dynamic)
.matchPath("/users/[0-9]+", "/users/123")
// args: (regex, examplePath)
```

---

## Request query matchers

```java
// Exact query parameter
.query("page=1&size=20")

// Single param match
.matchQuery("status", "active|inactive", "active")
// args: (paramName, regex, exampleValue)
```

---

## Header matchers

```java
// Exact header
.headers(Map.of("Content-Type", "application/json"))

// Regex header value
.matchHeader("Content-Type", "application/json;.*", "application/json; charset=UTF-8")
// args: (name, regex, exampleValue)
```

---

## Combining matchers in one body

```java
new PactDslJsonBody()
    .uuid("id")
    .stringType("name", "John")
    .integerType("age", 25)
    .booleanType("active", true)
    .timestamp("createdAt", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")
    .stringMatcher("email", "^[^@]+@[^@]+\\.[^@]+$", "john@example.com")
    .nullValue("deletedAt")
    .object("address")
        .stringType("street", "1 Main St")
        .stringMatcher("postcode", "^[0-9]{5}$", "12345")
    .closeObject()
    .minArrayLike("roles", 1)
        .stringValue("name", "USER")
    .closeArray()
```
