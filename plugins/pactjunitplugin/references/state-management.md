# Provider State Management

Patterns for defining and implementing `@State` methods in Pact JUnit 5 provider verification tests.

---

## What is a provider state?

A provider state is a precondition string set by the consumer (in `@Pact` method's `.given("...")`) that the provider must fulfill before verifying the interaction. The provider implements each state as a `@State`-annotated method.

---

## Basic state method

```java
@State("user 123 exists")
void userExists() {
    userRepository.save(User.builder()
        .id("123")
        .name("John Doe")
        .email("john@example.com")
        .active(true)
        .build());
}
```

---

## State with parameters (passed from consumer)

Consumer side:
```java
.given("user exists", Map.of("userId", "456", "name", "Alice"))
```

Provider side:
```java
@State("user exists")
void userExists(Map<String, Object> params) {
    String userId = (String) params.get("userId");
    String name   = (String) params.get("name");
    userRepository.save(User.builder()
        .id(userId)
        .name(name)
        .build());
}
```

---

## State with setup AND teardown

```java
@State(value = "order in PENDING status", action = StateChangeAction.SETUP)
void createPendingOrder() {
    orderRepository.save(Order.builder()
        .id("order-1")
        .status(OrderStatus.PENDING)
        .build());
}

@State(value = "order in PENDING status", action = StateChangeAction.TEARDOWN)
void deletePendingOrder() {
    orderRepository.deleteById("order-1");
}
```

---

## State requiring Spring beans

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProviderPactVerificationTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OrderRepository orderRepository;

    @BeforeEach
    void cleanDatabase() {
        // always start clean
        orderRepository.deleteAll();
        userRepository.deleteAll();
    }

    @State("user 123 exists")
    void userExists() {
        userRepository.save(new User("123", "John Doe", "john@example.com"));
    }

    @State("user 123 has 3 orders")
    void userHasOrders() {
        User user = userRepository.save(new User("123", "John Doe", "john@example.com"));
        orderRepository.saveAll(List.of(
            new Order("ord-1", user, OrderStatus.COMPLETED),
            new Order("ord-2", user, OrderStatus.COMPLETED),
            new Order("ord-3", user, OrderStatus.PENDING)
        ));
    }
}
```

---

## State requiring MockBean (for external dependencies)

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProviderPactVerificationTest {

    @MockBean
    private PaymentGatewayClient paymentClient;

    @State("payment gateway is available")
    void paymentGatewayAvailable() {
        when(paymentClient.charge(any())).thenReturn(PaymentResult.success("txn-123"));
    }

    @State("payment gateway is down")
    void paymentGatewayDown() {
        when(paymentClient.charge(any())).thenThrow(new PaymentGatewayException("Service unavailable"));
    }
}
```

---

## State for "empty" scenarios

```java
@State("no users exist")
void noUsersExist() {
    userRepository.deleteAll();
    // nothing to seed — just ensure clean state
}

@State("empty cart")
void emptyCart() {
    cartRepository.deleteAll();
}
```

---

## State naming conventions

| Scenario | State string pattern |
|----------|---------------------|
| Resource exists by ID | `"{resource} with id {id} exists"` |
| Resource does not exist | `"{resource} with id {id} does not exist"` |
| Collection is non-empty | `"{resources} exist"` |
| Collection is empty | `"no {resources} exist"` |
| User is authenticated | `"user is authenticated as {role}"` |
| External service available | `"{service} is available"` |
| External service unavailable | `"{service} is unavailable"` |
| Feature flag on/off | `"feature {flag} is enabled"` / `"feature {flag} is disabled"` |

---

## Request filter (add auth header to outgoing verification requests)

If the provider requires an `Authorization` header but you don't want the consumer to assert on it:

```java
@TargetRequestFilter
public void addAuthHeader(HttpRequest request) {
    request.addHeader("Authorization", "Bearer test-token");
}
```

This runs on every outgoing HTTP request during provider verification — useful for bypassing auth in test without encoding the token in the pact file.

---

## Publishing results to Pact Broker

In `src/test/resources/application-pact.properties`:
```properties
pact.verifier.publishResults=true
pact.provider.version=${project.version}
pact.provider.branch=main
```

Run with:
```bash
mvn test -Dspring.profiles.active=pact -Dtest=ProviderPactVerificationTest
```
