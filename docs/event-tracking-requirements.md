# Event Tracking Requirements

This document defines the requirements for event tracking across the ODH Dashboard and its plugins. It serves as the foundation for [RHOAIENG-36965](https://issues.redhat.com/browse/RHOAIENG-36965) - Enhanced Developer Tooling for Segment Event Tracking.

## Table of Contents

- [Overview](#overview)
- [Mechanism Requirements](#mechanism-requirements)
- [Current State Inventory](#current-state-inventory)
- [User Interaction Patterns to Track](#user-interaction-patterns-to-track)
- [API Resource Operations to Track](#api-resource-operations-to-track)
- [Stakeholder Requirements](#stakeholder-requirements)
- [Privacy Requirements](#privacy-requirements)
- [Plugin Tracking Requirements](#plugin-tracking-requirements)
- [Upstream/Midstream Integration Requirements](#upstreammidstream-integration-requirements)
- [Feature-Specific Requirements](#feature-specific-requirements)
- [Considerations for Future Work](#considerations-for-future-work)

---

## Overview

### Purpose

Analytics tracking is critical for understanding user behavior, making data-driven product decisions, and measuring feature adoption.

This document captures stakeholder requirements that tracking infrastructure must fulfill, with a specific focus on **the tracking mechanism**: it must be easy and consistent for teams to (a) identify user interactions and (b) attach relevant context so that events can be produced with minimal effort across the dashboard, plugins, and integrated upstream UIs.

### Stakeholders

- **Product Management:** Feature adoption metrics, user journey analysis
- **UX/Design:** Usability validation, drop-off analysis
- **Research:** User behavior patterns, follow-up research targeting

### Analytics Platform

The dashboard uses **Segment** as the analytics platform, which forwards events to **Amplitude** for analysis and dashboarding.

---

## Mechanism Requirements

The tracking solution must enable engineers to produce required events with minimal incremental work by providing:

- **Consistent interaction capture**: a reliable way to capture common interaction patterns (navigation, actions, forms, search/filter) across the product.
- **Context association**: a reliable way to associate the interaction with relevant context (feature area, resource identifiers, outcomes, errors) needed for analysis.
- **Low-effort adoption**: adding tracking for new features should be easy and repeatable, reducing the likelihood of missed events.
- **Coverage across integration types**: the same ease-of-use should apply to the core dashboard, Module Federation plugins, and midstream-integrated upstream UIs.
- **Customization**: the mechanism must support customizing event names, event property names, and event property values to meet stakeholder reporting needs.
- **Input modality coverage**: the mechanism must work for both mouse and keyboard interactions.

### Baseline “Always Capture” Interaction Set

We must define and maintain a **baseline set of UI interactions that are always tracked** across the dashboard and its integrations. This baseline exists to ensure consistent coverage and to avoid event gaps caused by manual, per-feature instrumentation.

The baseline should include at minimum:

- **Primary actions**: primary CTA interactions (e.g., primary buttons) indicating user intent.
- **Overflow/menu actions**: contextual action menus (e.g., kebab menus) and the selected action.
- **Modal lifecycle**: modal/dialog open and close, including close reason (e.g., cancel vs submit) where applicable.
- **Form lifecycle**: form entry/start and exit/end, including outcome (submitted vs cancelled/abandoned) where applicable.
- **Multi-step flows**: step progression and completion/abandonment for wizard-like flows.
- **Inline validation and errors**: validation errors and failure outcomes for user tasks (captured in a sanitized way; see [Privacy Requirements](#privacy-requirements)).

This baseline must be **customizable** (event naming and properties) to align with stakeholder KPI needs.

---

## Current State Inventory

### Existing Manual Tracking Events

The dashboard currently implements approximately **60+ manual tracking events** across multiple feature areas and shared components.

### Coverage Gaps

| Area | Gap Description |
|------|-----------------|
| Form interactions | No tracking of form abandonment or step-by-step progression |
| Navigation | Only page views tracked, no in-page section navigation |
| Button clicks | Inconsistently tracked, many actions missing |
| API operations | Delete operations rarely tracked, and outcomes are inconsistently captured |
| Plugins | Limited support, no standard pattern |
| Search/Filter | Not consistently tracked across features |
| Error events | Some captured, but not systematic |

---

## User Interaction Patterns to Track

Tracking must support capturing user interactions broadly (see [Mechanism Requirements](#mechanism-requirements)) and support the types of analysis needed by stakeholders (see [Stakeholder Requirements](#stakeholder-requirements)).

---

## API Resource Operations to Track

### CRUD Operations

Tracking must support capturing API resource operations (as required by [RHOAIENG-38685](https://issues.redhat.com/browse/RHOAIENG-38685)):

| Operation | What to Track |
|-----------|---------------|
| Create | Resource creation with success/failure outcome |
| Update | Resource updates with success/failure outcome |
| Delete | Resource deletion with success/failure outcome |

---

## Stakeholder Requirements

This section captures **what stakeholders need from tracking data** based on [RHAIRFE-697](https://issues.redhat.com/browse/RHAIRFE-697) and related strategy issues.

### Questions Stakeholders Need to Answer

#### Adoption Questions

| Question | Required Data |
|----------|---------------|
| What % of projects have feature X enabled? | Feature usage correlated to project |
| What % of users have accessed feature X? | User-to-feature interaction mapping |
| Which features are most/least used? | Interaction counts by feature area |
| Are users given access but never using? | Access grant events + subsequent usage (negative signal) |
| Which organizations have highest/lowest adoption? | Usage segmented by organization |

#### Engagement Questions

| Question | Required Data |
|----------|---------------|
| How often do users return to feature X? | Visit frequency per user per feature |
| What is the typical user journey? | Ordered sequence of navigation events |
| Where do users drop off in multi-step flows? | Step-by-step progression with abandonment points |
| Who are the power users vs occasional users? | Usage frequency distribution |

#### Success/Failure Questions

| Question | Required Data |
|----------|---------------|
| What is the success rate of action X? | Action outcomes (success/failure counts) |
| What errors do users encounter most? | Error types, frequency, and context |
| What causes users to retry actions? | Failure events followed by retry attempts |

### Segmentation Requirements

Stakeholders need to segment data by:

| Segment | Purpose |
|---------|---------|
| By user | Individual behavior patterns, power user identification |
| By project | Project-level adoption metrics |
| By organization | Organization-level rollup |
| By time period | Trend analysis, release impact |

### Metric Requirements

Key metrics stakeholders need to derive:

| Metric Type | Examples |
|-------------|----------|
| Adoption | % of users/projects using feature |
| Frequency | Actions per user per time period |
| Success rate | % of actions completing successfully |
| Drop-off rate | % abandoning at each step |

---

## Privacy Requirements

### Prohibited Data (PII)

The following must **never** be captured in tracking events:

| Data Type | Examples |
|-----------|----------|
| Real names | User display names |
| Email addresses | user@example.com |
| IP addresses | Direct IP capture |
| Resource names with PII | "John's Project" |
| Secrets/tokens | API keys, passwords |
| File contents | Uploaded file data |

### Allowed Identifiers

| Identifier | Description |
|------------|-------------|
| Anonymous User ID | Hashed, non-reversible |
| Resource UIDs | Kubernetes resource UIDs (not names) |

### Data Sanitization

- **Resource names** - Do not include in events; use type and UID only
- **Search queries** - Sanitize or omit if potentially containing PII
- **Error messages** - Scrub any user-generated content

---

## Plugin Tracking Requirements

Plugins must be able to define and capture tracking events with the same capabilities as the core dashboard.

---

## Upstream/Midstream Integration Requirements

### Challenge

Some dashboard features integrate upstream repositories (e.g., Kubeflow Model Registry, Kubeflow Pipelines) through forking and midstream modifications. We need to track user interactions in these upstream UIs without:

- Contributing tracking code to upstream repositories
- Maintaining large divergences from upstream in our forks

### Requirements

| Requirement | Description |
|-------------|-------------|
| Non-invasive tracking | Track events from upstream code without modifying upstream logic |
| Midstream-defined events | Define tracking events in midstream integration code, not upstream |
| Future-proof | Tracking should survive upstream updates/rebases |

### Same-Domain Iframe Integrations (e.g., MLflow)

The dashboard also embeds integrated components (e.g., MLflow) in a same-domain iframe (no CORS constraints). Tracking requirements for these integrations include:

- **Adoption**: ability to measure whether users are successfully integrating and utilizing the embedded component within RHOAI.
- **Entry points**: ability to measure where users discover/launch the embedded component (e.g., global navigation vs project context), including the launch context.
- **Feature usage**: ability to measure which key capabilities within the embedded component are used most frequently.
- **Outcome-based funnels**: ability to measure success vs abandonment for key tasks (start vs complete vs fail), not just “viewed/clicked”.
- **Granularity with context**: events must carry enough context to understand intent and origin (where the user came from).
- **Avoid vanity metrics**: prioritize events that lead to a product decision (e.g., high configuration failure rate implies UX/workflow changes).

---

## Feature-Specific Requirements

The following requirements are explicitly identified in linked RHAISTRAT issues.

### GenAI Studio ([RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169))

#### Playground

| Requirement | Source |
|-------------|--------|
| Track playground creation | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |
| Track user access provisioned | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |
| Track queries submitted | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |
| Track session length | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |

#### AI Available Asset Endpoints

| Requirement | Source |
|-------------|--------|
| Track asset discovery | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |
| Track asset selection | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |
| Track asset usage | [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) |

### Model Catalog ([RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171))

#### Discovery

| Requirement | Source |
|-------------|--------|
| Track catalog page viewed | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |
| Track model details viewed | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |
| Track benchmark/evaluation results viewed | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |
| Track filters or sort options applied | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |
| Track search queries executed | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |

#### Interaction

| Requirement | Source |
|-------------|--------|
| Track model favorited/bookmarked/compared | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |
| Track model selected for deployment or playground | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |
| Track drop-off points between viewing and action | [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) |

### Model Deployment Wizard ([RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170))

#### Wizard Flow

| Requirement | Source |
|-------------|--------|
| Track model selection initiated | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |
| Track deployment configuration started | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |
| Track deployment submission initiated | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |
| Track deployment completed successfully or failed | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |
| Track time-to-deploy from initiation to completion | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |

#### Drop-Off and Error Tracking

| Requirement | Source |
|-------------|--------|
| Track step where users most frequently abandon | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |
| Track common validation or configuration errors | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |
| Track retry attempts or repeated failures | [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) |

---

## Considerations for Future Work

The following are not part of the initial design but are worth considering as the tracking infrastructure matures.

### Developer Inspection Tooling

Developers should be able to identify and inspect trackable interactions in the UI without relying on code inspection. This may include a dedicated developer tool or browser extension that visually highlights tracked elements and shows what events they produce.

### Event Descriptors

A descriptor system could provide a declarative way to describe events: their names, properties, and what context they capture. This would enable:

- **Event property schemas** - Structured definitions of properties for different event types
- **Event naming conventions** - Standard format and rules for event names
- **Standard base properties** - Properties included in all events (e.g., timestamp)

### Release-to-Release Stability

Events should remain consistent across releases. Guardrails (e.g., snapshot tests, descriptor validation) could prevent PRs from unintentionally breaking existing events.

### Documentation and Discoverability

It should be easy to document all events being captured (what, where, and why) so stakeholders and engineers can review coverage. Descriptors could serve as the source of truth for this documentation.

---

## References

- [RHOAIENG-36965](https://issues.redhat.com/browse/RHOAIENG-36965) - Enhanced Developer Tooling for Segment Event Tracking
- [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) - Event Tracking for GenAI Studio
- [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) - Event Tracking for Model Deployment Wizard
- [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) - Event Tracking for Model Catalog
- [RHAIRFE-697](https://issues.redhat.com/browse/RHAIRFE-697) - Event Tracking for GenAI Studio and Related Features
