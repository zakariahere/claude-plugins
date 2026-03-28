# Pact Interaction Patterns

Common request/response interaction shapes for `PactDslWithProvider`.

---

## GET — single resource

```java
builder
    .given("user 123 exists")
    .uponReceiving("GET user by id")
        .path("/users/123")
        .method("GET")
        .headers(Map.of("Accept", "application/json"))
    .willRespondWith()
        .status(200)
        .headers(Map.of("Content-Type", "application/json"))
        .body(new PactDslJsonBody()
            .uuid("id")
            .stringType("name", "John Doe")
            .stringMatcher("email", "^[^@]+@[^@]+\\.[^@]+$", "john@example.com"))
    .toPact()
```

---

## GET — dynamic path param

```java
builder
    .given("user exists")
    .uponReceiving("GET user by id (dynamic)")
        .matchPath("/users/[0-9]+", "/users/123")
        .method("GET")
    .willRespondWith()
        .status(200)
        .body(new PactDslJsonBody()
            .integerType("id", 123)
            .stringType("name", "Alice"))
    .toPact()
```

---

## GET — collection / list

```java
builder
    .given("users exist")
    .uponReceiving("GET all users")
        .path("/users")
        .method("GET")
        .matchQuery("page", "[0-9]+", "1")
        .matchQuery("size", "[0-9]+", "20")
    .willRespondWith()
        .status(200)
        .body(new PactDslJsonBody()
            .integerType("total", 100)
            .integerType("page", 1)
            .minArrayLike("content", 1)
                .uuid("id")
                .stringType("name", "Alice")
            .closeArray())
    .toPact()
```

---

## POST — create resource

```java
builder
    .given("product SKU-001 exists")
    .uponReceiving("POST create order")
        .path("/orders")
        .method("POST")
        .headers(Map.of(
            "Content-Type", "application/json",
            "Accept", "application/json"))
        .body(new PactDslJsonBody()
            .stringType("productId", "SKU-001")
            .integerType("quantity", 2))
    .willRespondWith()
        .status(201)
        .headers(Map.of("Content-Type", "application/json"))
        .body(new PactDslJsonBody()
            .uuid("id")
            .stringValue("status", "PENDING")
            .timestamp("createdAt", "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"))
    .toPact()
```

---

## PUT — full update

```java
builder
    .given("user 123 exists")
    .uponReceiving("PUT update user")
        .path("/users/123")
        .method("PUT")
        .headers(Map.of("Content-Type", "application/json"))
        .body(new PactDslJsonBody()
            .stringType("name", "Jane Doe")
            .stringMatcher("email", "^[^@]+@[^@]+\\.[^@]+$", "jane@example.com"))
    .willRespondWith()
        .status(200)
        .body(new PactDslJsonBody()
            .stringValue("id", "123")
            .stringType("name", "Jane Doe"))
    .toPact()
```

---

## DELETE

```java
builder
    .given("user 123 exists")
    .uponReceiving("DELETE user")
        .path("/users/123")
        .method("DELETE")
    .willRespondWith()
        .status(204)
        .body("")
    .toPact()
```

---

## 404 — not found

```java
builder
    .given("user 999 does not exist")
    .uponReceiving("GET non-existent user")
        .path("/users/999")
        .method("GET")
    .willRespondWith()
        .status(404)
        .headers(Map.of("Content-Type", "application/json"))
        .body(new PactDslJsonBody()
            .stringType("error", "Not Found")
            .stringType("message", "User not found"))
    .toPact()
```

---

## 401 — unauthorized

```java
builder
    .given("no auth token provided")
    .uponReceiving("GET protected resource without token")
        .path("/orders")
        .method("GET")
    .willRespondWith()
        .status(401)
        .headers(Map.of("Content-Type", "application/json"))
        .body(new PactDslJsonBody()
            .stringValue("error", "Unauthorized"))
    .toPact()
```

---

## 422 — validation error

```java
builder
    .given("invalid request body")
    .uponReceiving("POST order with missing quantity")
        .path("/orders")
        .method("POST")
        .headers(Map.of("Content-Type", "application/json"))
        .body(new PactDslJsonBody()
            .stringType("productId", "SKU-001"))  // quantity missing
    .willRespondWith()
        .status(422)
        .body(new PactDslJsonBody()
            .stringValue("error", "Unprocessable Entity")
            .minArrayLike("violations", 1)
                .stringType("field", "quantity")
                .stringType("message", "must not be null")
            .closeArray())
    .toPact()
```

---

## Authenticated request (Bearer token)

```java
builder
    .given("user 123 exists")
    .uponReceiving("GET user with auth token")
        .path("/users/123")
        .method("GET")
        .matchHeader("Authorization", "Bearer .+", "Bearer eyJ...")
        .headers(Map.of("Accept", "application/json"))
    .willRespondWith()
        .status(200)
        .body(new PactDslJsonBody()
            .uuid("id")
            .stringType("name", "Alice"))
    .toPact()
```

---

## Multiple interactions in one pact

```java
return builder
    // Interaction 1
    .given("user 123 exists")
    .uponReceiving("GET user")
        .path("/users/123")
        .method("GET")
    .willRespondWith()
        .status(200)
        .body(new PactDslJsonBody().stringType("name", "Alice"))

    // Interaction 2
    .given("user 123 exists")
    .uponReceiving("DELETE user")
        .path("/users/123")
        .method("DELETE")
    .willRespondWith()
        .status(204)
        .body("")

    .toPact();
```

> Each `.given().uponReceiving()...willRespondWith()` block adds one interaction.
> `.toPact()` is only called **once** at the very end.
