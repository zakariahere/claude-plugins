---
description: Quick consumer-side Pact test generation. Provide an endpoint description, OpenAPI snippet, or existing broken test and get a complete, compilable JUnit 5 consumer test.
---

You are an expert in Pact JUnit 5 consumer contract testing. Generate a complete consumer test from the input below.

$ARGUMENTS

## Instructions

### If $ARGUMENTS contains an OpenAPI path/operation snippet

Parse it and generate a JUnit 5 consumer test following these rules:

1. Map OpenAPI types to Pact DSL matchers using `references/openapi-mapping.md`
2. Use **type matchers** (not exact values) for all response body fields — more resilient contracts
3. Use **exact values** only for: status codes, Content-Type header, required enum discriminators
4. Generate one `@Pact` method per status code variant (200, 404, etc.) if multiple are described

### If $ARGUMENTS is a plain description or a broken test

Fix or generate from the description. Address the most common DSL pitfalls:

- **Unclosed object/array blocks** — every `.object()` needs `.closeObject()`, every `.array()` needs `.closeArray()`
- **Wrong return type** — `@Pact` methods must return `RequestResponsePact`, not `void`
- **Body type mismatch** — `.body(new PactDslJsonBody()...)` vs `.body(LambdaDsl.newJsonBody(o -> {...}).build())`
- **asBody() misuse** — only call `.asBody()` when assigning to a `DslPart` variable, not inside `.body()`
- **Pact 4.6.x V4 default** — always add `pactVersion = PactSpecVersion.V3` to `@PactTestFor`. Without it, 4.6.x rejects `RequestResponsePact` + `PactDslWithProvider` with a method signature error at runtime
- **Empty `@Test` body** — the Pact mock server requires at least one matching HTTP request per interaction. A TODO-only test body fails with "requests were not received". Always generate a real `HttpClient` call

### Output format

Always output:

1. The complete Java test class (compilable, no TODOs in DSL code)
2. A brief comment for each `@State` method explaining what data to seed
3. A `pom.xml` dependency snippet if not already present in the conversation
4. One sentence explaining the matcher choices made

### Template

```java
@ExtendWith(PactConsumerTestExt.class)
@PactTestFor(providerName = "PROVIDER", pactVersion = PactSpecVersion.V3)  // V3 required for RequestResponsePact in 4.6.x
class ConsumerPactTest {

    @Pact(consumer = "CONSUMER")
    public RequestResponsePact interactionName(PactDslWithProvider builder) {
        return builder
            .given("STATE")
            .uponReceiving("DESCRIPTION")
                .path("/path")
                .method("GET")
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(new PactDslJsonBody()
                    .stringType("field", "example")
                )
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "interactionName")
    void testInteractionName(MockServer mockServer) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(mockServer.getUrl() + "/path"))
            .header("Accept", "application/json")
            .GET()
            .build();

        HttpResponse<String> response = HttpClient.newHttpClient()
            .send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(response.statusCode()).isEqualTo(200);
    }
}
```

Refer to `references/dsl/body-builders.md` for nested objects, arrays, and complex shapes.
Refer to `references/dsl/matchers.md` for all available matcher methods.
