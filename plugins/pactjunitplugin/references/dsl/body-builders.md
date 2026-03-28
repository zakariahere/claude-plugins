# PactDslJsonBody — Body Builder Patterns

Complete reference for `au.com.dius.pact.consumer.dsl.PactDslJsonBody`.

---

## Flat object (most common)

```java
new PactDslJsonBody()
    .stringType("id", "user-123")
    .stringType("name", "John Doe")
    .integerType("age", 30)
    .booleanType("active", true)
    .numberType("score", 9.5)
```

---

## Nested object

```java
new PactDslJsonBody()
    .stringType("id", "order-1")
    .object("customer")           // ← opens nested object
        .stringType("id", "cust-1")
        .stringType("email", "a@b.com")
    .closeObject()                // ← REQUIRED — closes "customer"
    .object("address")
        .stringType("street", "1 Main St")
        .stringType("city", "Springfield")
        .stringType("country", "US")
    .closeObject()
```

> **Critical**: every `.object()` must be paired with `.closeObject()` at the same nesting level.
> Missing `.closeObject()` compiles fine but produces a malformed pact JSON at runtime.

---

## Deeply nested objects

```java
new PactDslJsonBody()
    .object("order")
        .stringType("id", "ord-1")
        .object("shipping")
            .object("address")
                .stringType("zip", "12345")
            .closeObject()        // closes "address"
        .closeObject()            // closes "shipping"
    .closeObject()                // closes "order"
```

---

## Array of typed items (eachLike)

```java
new PactDslJsonBody()
    .eachLike("items")            // array where each item matches this shape
        .stringType("id", "item-1")
        .numberType("price", 9.99)
        .integerType("quantity", 1)
    .closeArray()
```

`eachLike` generates: at least 1 item matching the inner shape.

---

## Array with min/max size

```java
// At least 1 item
new PactDslJsonBody()
    .minArrayLike("tags", 1)
        .stringType("name", "java")
    .closeArray()

// At most 5 items
new PactDslJsonBody()
    .maxArrayLike("results", 5)
        .stringType("id", "r-1")
    .closeArray()

// Between 1 and 10 items
new PactDslJsonBody()
    .minMaxArrayLike("items", 1, 10)
        .stringType("sku", "SKU-001")
        .numberType("price", 0.01)
    .closeArray()
```

---

## Array of primitives

```java
// Array of strings
new PactDslJsonBody()
    .array("roles")
        .stringType("admin")      // each element is a string type
    .closeArray()

// Array of integers
new PactDslJsonBody()
    .array("scores")
        .integerType(100)
    .closeArray()
```

---

## Nullable field

```java
import au.com.dius.pact.consumer.dsl.PactDslJsonRootValue;

new PactDslJsonBody()
    .stringType("name", "John")
    // field that can be string OR null:
    .or("deletedAt",
        PactDslJsonRootValue.stringType("2024-01-01T00:00:00Z"),
        PactDslJsonRootValue.nullValue())
```

---

## Exact null value

```java
new PactDslJsonBody()
    .nullValue("archivedAt")      // field must be JSON null
```

---

## Lambda DSL (alternative style — avoids unclosed block bugs)

```java
import static au.com.dius.pact.consumer.dsl.LambdaDsl.newJsonBody;

DslPart body = newJsonBody(root -> {
    root.stringType("id", "123");
    root.object("address", addr -> {
        addr.stringType("street", "1 Main St");
        addr.array("tags", tags -> {
            tags.stringType("java");
        });
    });
}).build();
```

Lambda DSL is safer for complex shapes — the compiler catches mismatched closures via lambda scope.

---

## Assigning to a variable vs inline

```java
// Inline (pass directly to .body()) — do NOT call .asBody()
.willRespondWith()
    .body(new PactDslJsonBody()
        .stringType("id", "1"))

// Variable (assign to DslPart) — call .asBody()
DslPart bodyDsl = new PactDslJsonBody()
    .stringType("id", "1")
    .asBody();
.willRespondWith()
    .body(bodyDsl)
```

---

## Request body (POST/PUT)

```java
.uponReceiving("create order")
    .path("/orders")
    .method("POST")
    .headers(Map.of("Content-Type", "application/json"))
    .body(new PactDslJsonBody()
        .stringType("productId", "prod-1")
        .integerType("quantity", 2))
.willRespondWith()
    .status(201)
    ...
```
