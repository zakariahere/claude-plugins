---
description: Scaffold a Pact provider verification test. Provide the provider name, pact source (file path or broker URL), and list of provider states to generate a complete JUnit 5 Spring Boot verification test.
---

You are an expert in Pact JUnit 5 provider verification. Generate a complete provider verification test from the input below.

$ARGUMENTS

## Instructions

### Parse the input for:
- Provider name
- Consumer name(s) (optional — used for `@Consumer` filtering)
- Pact source: `@PactFolder("path")` or `@PactBroker(host="...", port="...")`
- Provider states (list of state strings from the consumer pact)
- Whether the service is Spring Boot (use `@SpringBootTest`) or standalone (use `HttpTestTarget` with a fixed port)
- Whether state setup needs Spring beans injected (determines `@Autowired` in state methods)

### Generate

A complete provider verification test with:

1. Correct class-level annotations
2. `@BeforeEach setUp(PactVerificationContext)` wiring the HTTP target
3. `@TestTemplate` + `PactVerificationInvocationContextProvider` verification loop
4. One `@State` method per provider state — with a `TODO` comment describing the data to seed
5. If Spring Boot: show how to inject a repository/service to seed data
6. If Pact Broker: show `@PactBrokerConsumerVersionSelectors` with `CONSUMER_TAGS` strategy

### Template (Spring Boot)

```java
@Provider("PROVIDER_NAME")
@PactFolder("pacts")                          // or @PactBroker(host = "${PACT_BROKER_HOST}")
@ExtendWith(SpringExtension.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProviderNamePactVerificationTest {

    @LocalServerPort
    private int port;

    @BeforeEach
    void setUp(PactVerificationContext context) {
        context.setTarget(new HttpTestTarget("localhost", port));
    }

    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifyPact(PactVerificationContext context) {
        context.verifyInteraction();
    }

    @State("STATE_DESCRIPTION")
    void givenStateDescription() {
        // TODO: seed test data — e.g., save entity via repository
    }

    @State(value = "STATE_DESCRIPTION", action = StateChangeAction.TEARDOWN)
    void cleanUpStateDescription() {
        // TODO: clean up test data after verification
    }
}
```

### Template (Pact Broker with version selectors)

```java
@Provider("PROVIDER_NAME")
@PactBroker(
    host = "${PACT_BROKER_HOST:localhost}",
    port = "${PACT_BROKER_PORT:9292}",
    consumerVersionSelectors = {
        @VersionSelector(tag = "main"),
        @VersionSelector(latest = "true")
    }
)
```

### Common pitfalls to avoid

- `@State` methods must be **void** — they are not test methods
- Do NOT add `@Test` to `@TestTemplate` methods — it breaks the provider loop
- `HttpTestTarget` vs `HttpsTestTarget` — use HTTPS if the service requires TLS
- If using `@PactBroker`, set `pact.verifier.publishResults=true` in `application-test.properties` to report results back to broker
- For request filters (e.g., adding auth headers to outgoing pact requests): use `@TargetRequestFilter`

Output: complete Java class, then a short explanation of each state method's responsibility.
