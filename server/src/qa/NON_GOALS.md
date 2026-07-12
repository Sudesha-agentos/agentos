# Neel QA — explicit non-goals

AgentOX’s Neel is a **pipeline QA specialist** (ticket → Ananta branch → tests → gate).
It is **not** a Testsigma-class test-automation SaaS.

## Do not build (unless product strategy changes)

- Codeless / NLP step authoring platform + browser recorder product
- Customer-side execution agent binary (“server / agent / nginx” topology)
- Full Selenium Grid 4 / Appium device farm ownership
- Salesforce / SAP enterprise runners + marketplace SDK
- Java / Spring Boot rewrite of the QA core
- Custom browser automation protocol (use Playwright/WebDriver)
- Training foundation models on customer test data
- Silent low-confidence locator healing without human review

## What we do build instead

- Explainable multi-factor confidence on ticket changes
- Failure triage (bug / flake / env / stale test) with human override
- Gap mapping on Ananta diffs + req→code→test edges
- Citations on generated tests
- Optional Playwright `@smoke` lane when the repo already has Playwright
- Light locator heal proposals for e2e (reviewable, not invisible)

See [HANDOFF.md](./HANDOFF.md) for how Ananta hands off to Neel and how to verify stuck pipelines.
