---
name: pactjunitplugin
description: Interactive Pact JUnit test generator for Java. Use when the user wants to generate, scaffold, or debug Pact consumer/provider contract tests (JUnit 5), work with PactDslJsonBody, set up provider states, or convert an OpenAPI spec into Pact tests.
license: Apache-2.0
metadata:
  author: zakariahere
  version: "1.0.0"
---

# Pact JUnit Plugin

Generate production-ready Pact contract tests for Java (JUnit 5) through an interactive workflow or quick one-shot commands.

## Available Commands

| Command | What it does |
|---------|-------------|
| `/pact` | Interactive 4-phase workflow: discover → design interactions → generate → review |
| `/pact-consumer` | Quick consumer-side Pact test from a description or OpenAPI spec |
| `/pact-provider` | Quick provider verification test scaffold |
| `/pact-from-spec` | Parse an OpenAPI spec file and generate all consumer tests |

## When to Trigger This Skill

- User mentions "Pact", "contract test", "consumer test", "provider verification"
- User shows `@ExtendWith(PactConsumerTestExt.class)`, `PactDslJsonBody`, `@Pact`, `@PactTestFor`, `@Provider`, `@Consumer`
- User is stuck on DSL chaining, nested objects/arrays, request matchers, or provider states
- User has an OpenAPI spec and wants contract tests

## Quick Reference

**Consumer test annotations (JUnit 5)**
- `@ExtendWith(PactConsumerTestExt.class)` — JUnit 5 extension
- `@PactTestFor(providerName = "...")` — binds test class to a provider
- `@Pact(consumer = "...")` — marks a pact factory method
- `@PactTestFor(pactMethod = "...")` — binds a test method to a pact

**Provider verification annotations (JUnit 5)**
- `@Provider("...")` — identifies the provider
- `@Consumer("...")` — optionally filters by consumer
- `@PactFolder("pacts")` or `@PactBroker(...)` — pact source
- `@State("...")` — method that sets up provider state
- `@TestTemplate` + `@ExtendWith(PactVerificationInvocationContextProvider.class)` — the verification loop

## DSL Quick Reference

**Body builders** — see `references/dsl/body-builders.md`
**Matchers** — see `references/dsl/matchers.md`
**Interaction patterns** — see `references/dsl/interactions.md`
**OpenAPI → Pact mapping** — see `references/openapi-mapping.md`
