# Automatic Event Capture POC - Evaluation Report

This document evaluates the proof-of-concept (POC) for automatic event tracking ([RHOAIENG-38686](https://issues.redhat.com/browse/RHOAIENG-38686)) against the requirements and the acceptance criteria of related Jira issues.

---

## Executive Summary

The automatic event capture POC demonstrates that **zero-instrumentation baseline tracking is technically feasible** and provides broad interaction coverage across the dashboard. However, the approach has a significant **data quality gap** compared to targeted manual instrumentation. The fundamental constraint is that automatic capture cannot safely include form data or network request/response bodies due to PII risk, which limits the depth of captured events.

### Key Metrics

Based on an analysis of 34 discrete tracking requirements drawn from stakeholder questions ([RHAIRFE-697](https://issues.redhat.com/browse/RHAIRFE-697)) and feature-specific needs ([RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169), [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170), [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171)):

| Metric                                                       | Auto Capture | Manual Instrumentation |
| ------------------------------------------------------------ | ------------ | ---------------------- |
| Interaction detection rate                                   | **82%**      | **100%**               |
| Requirements fully met (data sufficient for stakeholder use) | **38%**      | **97%**                |
| Requirements with at least partial data                      | **91%**      | **100%**               |

**Interpretation:** Automatic capture detects most user interactions and provides _some_ data for nearly all of them (91%), but only **38% produce data detailed enough for direct stakeholder decision-making**. The 59-point gap in fully met requirements is caused by:

- **No form data** (PII constraint) -- cannot distinguish _what_ was configured, only _whether_ a form was completed.
- **No request/response bodies** (PII constraint) -- cannot identify _which_ resource was acted on.
- **Generic event names** -- auto-generated from DOM structure, not business-meaningful labels.
- **Inconsistent a11y context** -- event area and element identification degrade where HTML/ARIA quality is poor.

Manual instrumentation closes these gaps because developers can selectively include safe, non-PII context (resource UIDs, sanitized identifiers, enum values) and assign semantically meaningful event names. With AI tools writing an increasing share of feature code, the cost of explicit instrumentation drops to near-zero -- the AI generates tracking calls as part of writing features, achieving manual-quality data without the traditional developer effort. This shifts the cost equation that originally motivated auto capture (see [Alternative Approaches Evaluation](#alternative-approaches-evaluation)).

### Feature-Specific Projection

If the tracking requirements from the three feature-specific areas (GenAI Studio, Model Catalog, Deployment Wizard) are taken as representative of what all dashboard features would need:

| Metric                                  | Auto Capture | Manual Instrumentation |
| --------------------------------------- | ------------ | ---------------------- |
| Interaction detection rate              | **83%**      | **100%**               |
| Requirements fully met                  | **30%**      | **100%**               |
| Requirements with at least partial data | **91%**      | **100%**               |

### Where Automatic Capture Works Well

Automatic capture excels at answering **behavioral and structural questions** -- understanding _what users do_ and _how they move through the product_:

| Analysis Type                      | Example Questions                                                                                      | Why Auto Capture Works                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **User flows and journeys**        | What is the typical path from model catalog to deployment? Where do users go after creating a project? | Every navigation, click, and page transition is captured with route context, producing a complete sequence of actions. |
| **Feature adoption**               | What % of users have used the deployment wizard? Which features are most/least visited?                | Route-level interaction events with anonymous user IDs directly answer adoption questions.                             |
| **Funnel completion and drop-off** | At which wizard step do users most frequently abandon? What % of form starts result in submission?     | Form lifecycle tracking captures entry, completion, abandonment, and step progression with duration.                   |
| **Success/failure rates**          | What % of deployments succeed on the first attempt? What % of API operations fail?                     | Network outcome tracking with HTTP status and K8s Status object parsing provides action-level success/failure.         |
| **Engagement patterns**            | How often do users return to a feature? Who are the power users?                                       | Timestamp and user-level event data support frequency and recency analysis in Amplitude.                               |
| **Error visibility**               | Are users encountering errors? Which areas produce the most alerts?                                    | Alert tracking captures error appearances by variant, area, and title.                                                 |

### Where Automatic Capture Falls Short

Automatic capture struggles with **content and context questions** -- understanding _what specific choices users made_ and _what data was involved_:

| Analysis Type                        | Example Questions                                                                                    | Why Auto Capture Cannot Answer                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User input and selections**        | Which model size do users select most often? What runtime configuration is most common?              | Form field values are never captured (PII risk). The tracking knows a form was submitted, not what was in it.                                                              |
| **Resource identification**          | Which specific model was deployed? Which project was the notebook created in?                        | Request/response bodies are excluded (PII risk). Only the URL path and HTTP method are available, not the resource details.                                                |
| **Search and filter intent**         | What are users searching for? Which filters are applied most?                                        | Search query text and filter values are not captured. Only the fact that a search or filter action occurred is tracked.                                                    |
| **Content-level engagement**         | Which documentation sections are read? Which benchmark metrics do users compare?                     | Scrolling and reading behavior are not tracked. Only interactive element activations (clicks, submits) are captured.                                                       |
| **Session and duration metrics**     | How long do users spend in the playground per session? What is the average time on the catalog page? | No session boundary concept exists. Only form-level duration (entry to outcome) is tracked.                                                                                |
| **Negative signals and access gaps** | Which users were granted access but never used the feature?                                          | Auto capture only records actions that happen. Detecting _inaction_ requires comparing backend access data against frontend usage.                                         |
| **Business-labeled events**          | How many "Model Deployments" happened this week? (using a stakeholder-defined event name)            | All events use auto-generated names from DOM structure (e.g., `buttonClick.model-serving.deploy-model`), not business-meaningful labels like `Model Deployment Initiated`. |

Automatic capture is strongest as a **broad behavioral safety net** -- it ensures no user interaction goes completely untracked, and it excels at the structural questions (flows, funnels, adoption, success rates) that form the foundation of product analytics. For questions that require understanding _what specific data was involved_ in an interaction, targeted manual instrumentation is needed to selectively include safe, non-PII context that automatic capture cannot infer from the DOM.

---

## Feasibility Metrics - Detailed Breakdown

The following analysis scores every discrete tracking requirement against both automatic capture and manual instrumentation on two dimensions:

- **Detected?** -- Does the approach fire an event for this interaction?
- **Sufficient?** -- Is the captured data detailed enough for stakeholders to make decisions?

### Feature-Specific Requirements (23 items)

These represent the tracking needs for three planned feature areas. If extrapolated to all dashboard features, they indicate what coverage to expect product-wide.

| #   | Requirement                | Auto Detected? | Auto Sufficient? | Manual Sufficient? | Gap Reason                                                 |
| --- | -------------------------- | -------------- | ---------------- | ------------------ | ---------------------------------------------------------- |
| 1   | Playground creation        | Yes            | Low              | Yes                | Generic `networkRequest.POST`; no resource detail          |
| 2   | Queries submitted          | Yes            | Low              | Yes                | Generic `networkRequest.POST`; no query content            |
| 3   | Session length             | **No**         | None             | Yes                | No session concept in auto capture                         |
| 4   | Asset discovery            | Yes            | Medium           | Yes                | Page view detected; specific asset context depends on a11y |
| 5   | Asset selection            | Yes            | Low              | Yes                | Click detected; which asset depends on a11y context        |
| 6   | Asset usage                | Yes            | Low              | Yes                | Network requests detected; no resource identification      |
| 7   | Catalog page viewed        | Yes            | **High**         | Yes                | Route pattern match                                        |
| 8   | Model details viewed       | Yes            | **High**         | Yes                | Route pattern match                                        |
| 9   | Benchmarks viewed          | Partial        | Medium           | Yes                | Depends on UI implementation (tab vs expand vs navigate)   |
| 10  | Filters/sort applied       | Yes            | Low              | Yes                | Click detected; filter values not captured                 |
| 11  | Search queries executed    | Yes            | Low              | Partial            | Submit detected; query text excluded (privacy)             |
| 12  | Model favorited            | Yes            | Low              | Yes                | Click detected; which model depends on a11y/URL context    |
| 13  | Model selected for deploy  | Yes            | Low              | Yes                | Click detected; model identity depends on context          |
| 14  | Drop-off viewing to action | Partial        | Low              | Yes                | Requires Amplitude funnel config; not explicit             |
| 15  | Model selection initiated  | Yes            | Low              | Yes                | Generic click event; not labeled as "model selection"      |
| 16  | Configuration started      | Yes            | **High**         | Yes                | `formEntry` captured with area context                     |
| 17  | Submission initiated       | Yes            | **High**         | Yes                | `formComplete` captured                                    |
| 18  | Completed/failed           | Yes            | **High**         | Yes                | Network outcome + form outcome correlation                 |
| 19  | Time-to-deploy             | Yes            | **High**         | Yes                | `formOutcome` includes duration                            |
| 20  | Step abandonment           | Yes            | **High**         | Yes                | Wizard step tracking with abandonment detection            |
| 21  | Validation errors          | Partial        | Medium           | Yes                | Alert-level errors captured; field-level not               |
| 22  | Retry attempts             | Partial        | Low              | Yes                | Sequential events not correlated as retries                |
| 23  | Configuration choices      | **No**         | None             | Yes                | Form values never captured (PII constraint)                |

**Feature-specific totals:**

| Rating                            | Auto Capture | Manual Instrumentation |
| --------------------------------- | ------------ | ---------------------- |
| Fully sufficient (High)           | **7** (30%)  | **23** (100%)          |
| Partially sufficient (Medium/Low) | **14** (61%) | **0** (0%)             |
| Not achievable                    | **2** (9%)   | **0** (0%)             |

### Stakeholder Analysis Questions (11 items)

These represent the analytical questions stakeholders need to answer. Organization segmentation is excluded because it depends on Segment user traits, not the tracking mechanism.

| #   | Question                        | Auto Detected? | Auto Sufficient? | Manual Sufficient? | Gap Reason                                        |
| --- | ------------------------------- | -------------- | ---------------- | ------------------ | ------------------------------------------------- |
| 24  | % users accessed feature X      | Yes            | **High**         | Yes                | User ID + route pathname                          |
| 25  | Most/least used features        | Yes            | Medium           | Yes                | Interaction counts available; area quality varies |
| 26  | % projects with feature enabled | Partial        | Low              | Yes                | Usage captured; enablement state not observable   |
| 27  | Access but never using          | **No**         | None             | Partial            | Negative signal; needs backend access data        |
| 28  | Return frequency                | Yes            | **High**         | Yes                | Timestamp-based frequency analysis                |
| 29  | User journey                    | Yes            | **High**         | Yes                | Ordered event sequence                            |
| 30  | Drop-off in multi-step flows    | Yes            | **High**         | Yes                | Wizard step + form outcome tracking               |
| 31  | Power users vs occasional       | Yes            | **High**         | Yes                | Usage frequency distribution                      |
| 32  | Success rate of action X        | Yes            | **High**         | Yes                | Network outcomes + form outcomes                  |
| 33  | Common errors                   | Yes            | Medium           | Yes                | Alert variant captured; message detail limited    |
| 34  | Retry causes                    | Partial        | Low              | Yes                | Events not correlated as retries                  |

**Stakeholder question totals:**

| Rating                            | Auto Capture | Manual Instrumentation |
| --------------------------------- | ------------ | ---------------------- |
| Fully sufficient (High)           | **6** (55%)  | **10** (91%)           |
| Partially sufficient (Medium/Low) | **4** (36%)  | **0** (0%)             |
| Not achievable                    | **1** (9%)   | **1** (9%)             |

### What Drives the Gap

The 59-point difference in fully met requirements (38% auto vs 97% manual) breaks down by root cause:

| Root Cause                                  | # of Requirements Affected | Examples                                                               |
| ------------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| No form data (PII constraint)               | 6                          | Filter values, configuration choices, search queries                   |
| No request/response bodies (PII constraint) | 5                          | Resource identification, playground config, query content              |
| Generic event names (no customization)      | 5                          | All network events are `networkRequest.POST`, not "Playground Created" |
| A11y context inconsistencies                | 3                          | Feature area, element identity degraded by HTML quality                |
| No session/negative signal concept          | 2                          | Session length, feature enablement                                     |

The PII constraints (form data and request/response bodies) account for **11 of the 21 requirements** where auto capture is insufficient. These are not solvable by improving the auto capture mechanism -- they are fundamental privacy constraints that manual instrumentation addresses through selective, developer-curated inclusion of safe context.

---

## Alternative Approaches Evaluation

The auto capture POC achieves 38% fully sufficient data. The remaining gap could be addressed by additional infrastructure (network descriptors), by explicit instrumentation, or by leveraging AI tools to generate instrumentation. Each approach has different cost/benefit tradeoffs.

### Network Endpoint Descriptors

**Concept:** Teams register declarative JSON descriptors that map API endpoints to whitelisted request/response properties that are safe to capture. The network interceptor (which already sees full request/response bodies in dev mode) would extract only the specified properties for production analytics events.

```json
{
  "urlPattern": "/api/namespaces/:ns/projects",
  "method": "POST",
  "eventName": "Project Created",
  "extract": {
    "resourceId": "response.metadata.uid",
    "resourceKind": "response.kind"
  }
}
```

**What this solves:**

| Gap                         | How Descriptors Address It                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| Generic event names         | Custom `eventName` per endpoint (e.g., `Project Created` instead of `networkRequest.POST`)  |
| No resource identification  | Whitelisted response fields (UIDs, kinds, resource types)                                   |
| No request context          | Whitelisted request fields (enum values, non-PII configuration)                             |
| Plugin extensibility        | Descriptors could be registered via extension points by plugin teams                        |
| Upstream/midstream coverage | Descriptors work without modifying upstream code since interception is at the network level |

**What this does NOT solve:**

| Gap                                | Why Not                                                         |
| ---------------------------------- | --------------------------------------------------------------- |
| Form field values                  | Descriptors operate on network requests, not DOM form state     |
| Session duration                   | No network signal for session boundaries                        |
| Negative signals                   | Still only captures actions that happen                         |
| A11y context quality for UI events | Descriptors only improve network events, not interaction events |

**Estimated impact on metrics:** Network descriptors would address ~10 of the 21 requirements currently rated as insufficient -- primarily the 5 affected by "no request/response bodies" and the 5 affected by "generic event names" for network events. This could raise the fully sufficient rate from **38% to ~68%** for requirements where the team authors descriptors.

**The effort question:** Authoring a descriptor requires a team to:

1. Identify the API endpoint to track
2. Decide on a meaningful event name
3. Identify which request/response properties are safe (non-PII)
4. Write and register the descriptor JSON
5. Maintain the descriptor when API shape changes

This per-endpoint effort is comparable to writing an explicit `segment.track()` call at the API call site. The difference is _where_ the work happens:

| Factor                   | Descriptors                                             | Explicit Instrumentation                                                         |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Where work lives         | Centralized descriptor files or extension registrations | Distributed across feature code at call sites                                    |
| Code changes to features | None (interceptor handles extraction)                   | Yes (add tracking calls to API utilities)                                        |
| Works for upstream code  | Yes (no upstream modification needed)                   | Yes (via midstream fork; merge conflict risk mitigated by AI tools)              |
| Works for plugin code    | Yes (plugins register descriptors as extensions)        | Requires each plugin to instrument its own calls                                 |
| Flexibility              | Limited to extracting existing request/response fields  | Full flexibility (computed values, conditional logic, cross-request correlation) |
| Auditability             | Single manifest of all tracked endpoints                | Scattered across codebase; requires search to inventory                          |

**The upstream argument and the midstream fork reality:**

The strongest case for descriptors is that they work for upstream code without modification. However, this project always maintains a **midstream fork** of upstream components. Instrumentation _can_ be added in midstream via explicit `segment.track()` calls, which provides the same data quality as any other explicit approach.

The tradeoff between descriptors and midstream instrumentation:

| Factor              | Descriptors                                    | Explicit in Midstream Fork                                      |
| ------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Merge conflict risk | None (separate from upstream code)             | Instrumentation lines may conflict during upstream rebases      |
| Data quality        | Limited to extractable request/response fields | Full flexibility (computed values, conditional logic)           |
| Form data coverage  | None (network layer only)                      | Yes (at the component level)                                    |
| Maintenance burden  | Author and update descriptor per endpoint      | Resolve conflicts during upstream syncs                         |
| AI mitigation       | N/A                                            | AI tools increasingly handle conflict resolution during rebases |

The merge conflict concern is real but diminishing. Instrumentation calls are typically added at the end of handler functions or in wrapper hooks, which are low-conflict locations. And as AI tools take on more of the rebase and conflict resolution work, the maintenance cost of midstream instrumentation continues to drop.

**Verdict:** Network descriptors are a viable approach for tracking upstream API operations without touching upstream code, but the case for building descriptor infrastructure is weakened by the midstream fork. Explicit instrumentation in midstream achieves higher data quality and covers both network and form interactions, with merge conflict risk as the primary cost -- a cost that AI tools are increasingly able to absorb. Descriptors remain worth considering for **plugin teams** that register extensions but do not maintain a fork.

### Explicit Instrumentation with AI Tools

The output of AI-assisted instrumentation is identical to manual instrumentation at near-zero marginal cost. The cost equation that originally motivated auto capture -- developers forgetting or deprioritizing tracking -- is largely eliminated when AI tools generate instrumentation as part of writing features. This applies to upstream code as well, since the project maintains a **midstream fork** where instrumentation can be added during adoption, with AI tools handling merge conflict resolution during upstream rebases.

**Prerequisite:** For AI tools to produce consistent, correct instrumentation, **tracking rules must be authored** as AGENTS.md rules or equivalent. These rules need to define:

- Event naming conventions and required base properties
- When tracking calls are required (API call sites, form submissions, navigation actions)
- PII exclusion rules (which fields are safe to include, which are not)
- Standard patterns and utilities to use for tracking calls

### Where Each Approach Adds Value

| Scenario                                                       | Best Approach            | Why                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New features and midstream upstream adoption**               | Explicit instrumentation | Full control over event names, properties, and context. ~94% data sufficiency. AI tools eliminate the cost disadvantage relative to auto capture. |
| **Existing uninstrumented features**                           | Auto capture baseline    | Immediate coverage with zero code changes. Low-detail but establishes a behavioral baseline.                                                      |
| **Plugin API operations**                                      | Network descriptors      | Plugin teams register descriptors as extensions without maintaining a fork.                                                                       |
| **Behavioral analysis (flows, funnels, adoption)**             | Auto capture baseline    | Structural analysis works well with the data auto capture already provides.                                                                       |
| **Content-level analysis (what was selected, which resource)** | Explicit instrumentation | Only approach that can safely include form data and resource identifiers.                                                                         |

Auto capture retains value as a **safety net** (retroactive coverage of uninstrumented code, behavioral analysis) and network descriptors remain relevant for **plugin teams** that register extensions without maintaining a fork. But for both new feature development and upstream adoption through midstream, explicit instrumentation is likely to produce better analytics outcomes with less infrastructure investment than improving auto capture.

---

## What Is Implemented

The POC is implemented in `packages/analytics/` and provides automatic, zero-instrumentation baseline tracking. No code changes are required in feature components to capture events. For a concrete example of the Segment payloads emitted during a real user session, see [Example Output: Project Create / Edit / Delete](./event-tracking-poc-example-output.md).

### Interaction Tracking

Document-level capture-phase listeners detect and emit events for interactive elements only (buttons, links, inputs, and elements with interactive ARIA roles). Non-interactive elements are ignored.

| Pattern         | What Is Tracked                     | Event Name Format                    |
| --------------- | ----------------------------------- | ------------------------------------ |
| `buttonClick`   | All button clicks                   | `buttonClick.{area}.{elementName}`   |
| `linkClick`     | Link/anchor clicks                  | `linkClick.{area}.{elementName}`     |
| `tabClick`      | Tab selections                      | `tabClick.{area}.{elementName}`      |
| `treeItemClick` | Tree item selections                | `treeItemClick.{area}.{elementName}` |
| `menuAction`    | Kebab/dropdown item selection       | `menuAction.{area}.{elementName}`    |
| `stateChange`   | Checkbox, radio, and switch toggles | `stateChange.{area}.{elementName}`   |

Each interaction event includes: `interactionType`, `elementName`, `area`, `elementRole`, `eventType`. Menu actions additionally include `openerName`. Capture-phase listeners fire for both mouse clicks and keyboard activations.

### Form Lifecycle Tracking

MutationObserver-based tracking of `<form>` elements and PatternFly v6 wizard components (`.pf-v6-c-wizard`):

| Pattern        | What Is Tracked                    | Properties                                                 |
| -------------- | ---------------------------------- | ---------------------------------------------------------- |
| `formEntry`    | First user interaction with a form | `elementName`, `area`                                      |
| `formComplete` | Form submission                    | `elementName`, `area`, `outcome: 'submitted'`              |
| `formOutcome`  | End of form lifecycle              | `elementName`, `area`, `outcome`, `duration`, `interacted` |

Outcome values: `success`, `failure`, `submitted`, `cancelled`, `abandoned`. Duration measures time from first interaction to outcome. Form outcomes are correlated with network request outcomes within a 10-second window to determine success vs failure. If the correlation window expires without a network response, the outcome is `submitted`. Wizard step progression and abandonment are tracked.

Form field values, selections, and input contents are **never captured** (PII risk).

#### Modal-form outcome correlation

A common PatternFly modal pattern places form content in the modal body with action buttons ("Create", "Update", "Cancel") in a separate modal footer region, **outside** the `<form>` element. Because the submit button is not a descendant of the `<form>`, clicking it does not fire a native `submit` event, and the form tracker cannot use standard form semantics to detect submission. This is a consequence of how the application's HTML is structured rather than a limitation of the tracking approach itself -- but it means the tracker must rely on heuristics to infer intent from surrounding context.

The form tracker works around this with two mechanisms:

1. **Dialog-aware submission detection:** When a non-cancel/close button click occurs inside a `[role="dialog"]` that contains a tracked `<form>`, the tracker treats it as a submission signal, even when the button is outside the `<form>` element. The `isCancelOrClose` heuristic (matches buttons whose accessible name contains "cancel" or equals "close") distinguishes cancel/close buttons from action buttons.

2. **Deferred finalization:** When a submitted form is unmounted before a network response arrives (common because React re-renders the modal during the API call, replacing or unmounting the `<form>`), the form tracker defers the outcome emission. The form state moves to a pending map rather than emitting immediately. When `notifyNetworkOutcome` fires, it resolves the pending state and emits the correlated outcome. A safety timeout (matching the network correlation window) ensures the emission always fires even if no network response arrives.

Additionally, React Strict Mode (used in development) double-mounts components, which can create duplicate tracker instances observing the same form. The tracker suppresses outcome emission for forms that were never interacted with (no focus, no submission, no cancellation), which filters out these ghost registrations.

**Brittleness and limitations:** This correlation is inherently fragile. It depends on specific DOM structure assumptions (a `[role="dialog"]` ancestor, button text not matching "cancel"/"close", a single tracked form per dialog) that may not hold for all modal patterns in the application. Dialogs with multiple forms, non-standard button labels, or multi-step flows that don't use the wizard pattern could produce incorrect outcomes. The broader concern is that automatic tracking must continuously work around the gap between the application's actual HTML semantics and the semantics the tracker expects -- and each new UI pattern may introduce another edge case requiring a new heuristic. This is a fundamental trade-off of zero-instrumentation tracking: it avoids per-feature developer effort but shifts that effort into maintaining increasingly specific DOM inference rules.

The resulting event sequence for a successful modal form submission:

1. `buttonClick` on a primary action button in the modal footer (outside `<form>`)
2. Form tracker recognizes the button is inside a dialog containing a tracked form, and is not a cancel/close button -- marks the form as submitted
3. React re-renders the modal (loading state) -- `<form>` may be unmounted; finalization deferred
4. `networkRequest` succeeds (POST/PUT/PATCH returns success) -- resolves the deferred finalization with `networkSuccess: true`
5. `formOutcome` emits `outcome: "success"` (correlated with the network result)

See [Example Output](./event-tracking-poc-example-output.md) Events 3-5 for the concrete event sequence.

### Modal and Alert Tracking

| Pattern         | What Is Tracked                 | Properties                                                     |
| --------------- | ------------------------------- | -------------------------------------------------------------- |
| `modalOpen`     | Dialog appearance               | `elementName`, `area`                                          |
| `modalClose`    | Dialog dismissal                | `elementName`, `area`, `outcome`                               |
| `alertAppeared` | PatternFly v6 alert appearances | `elementName`, `alertVariant`, `alertTitle`, `isToast`, `area` |

### Network Request Tracking

Network requests are intercepted via monkey-patching of `window.fetch` and `XMLHttpRequest.prototype`. This replaced an earlier service worker approach because service workers are shared across all tabs on the same origin, causing duplicate events when multiple tabs are open. Monkey-patching operates per-tab by design.

XMLHttpRequest is patched in addition to fetch because the project uses Axios (which defaults to XHR), and in a Module Federation setup each federated module can bundle its own Axios instance. Patching at the `window` level catches all instances regardless of which module made the call.

| Capability            | Detail                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------- |
| Methods tracked       | POST, PUT, PATCH, DELETE                                                                  |
| GET/HEAD excluded     | Read operations filtered out (background traffic, not user intent)                        |
| Outcome determination | HTTP status codes, Kubernetes `Status` objects, backend `{ success }` responses           |
| Noise filtering       | Excludes internal paths (`selfsubjectaccessreviews`, `prometheus`, etc.)                  |
| Event name format     | `networkRequest.{METHOD}` (e.g., `networkRequest.POST`)                                   |
| Properties            | `requestMethod`, `requestPath`, `statusCode`, `outcome`, `outcomeSource`, `outcomeReason` |

Request and response bodies are **not included** in analytics events (PII risk). Only the URL path and HTTP method are available.

### Context Extraction

Every interaction event includes context derived from the DOM accessibility tree and route system:

| Property            | Source                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| `role`              | ARIA role or implicit role from tag                                        |
| `name`              | `aria-label`, `aria-labelledby`, or text content (truncated to 40 chars)   |
| `landmark`          | Nearest ARIA landmark ancestor                                             |
| `region`            | Nearest labeled region ancestor                                            |
| `nearestHeading`    | Closest heading element text                                               |
| `semanticPath`      | Full semantic path (e.g., `main > region[Model Serving] > button[Deploy]`) |
| `pathname`          | Best-matching route pattern from registered extensions                     |
| `navigationContext` | Active PatternFly nav link hierarchy                                       |

The `area` property used in event names is derived from the region label, landmark, or OUIA component type. Context quality depends on HTML/ARIA quality -- where accessible names, region labels, or landmarks are missing, event context degrades. This was identified as a significant issue during evaluation:

> "Attempting to identify generic event context has a lot of inconsistencies because of the way we structure html and don't always adhere to best a11y practices of semantic html."
> -- [RHOAIENG-38683 comment, Feb 24 2026](https://issues.redhat.com/browse/RHOAIENG-38683)

### Segment Integration

Events are emitted to Segment via `window.analytics.track()` in production, with `automaticEventCapture: true` to distinguish from existing manual tracking calls. In test environments, events are posted to `/__analytics__` for Cypress interception.

---

## Requirements Evaluation

### Mechanism Requirements

| Requirement                       | Status                 | Detail                                                                                                                                                                                                                       |
| --------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consistent interaction capture    | **Achieved**           | Baseline patterns capture clicks, submits, modals, forms, menus, state changes, network requests, and alerts automatically.                                                                                                  |
| Context association               | **Partially Achieved** | A11y path extraction provides role, name, landmark, region, heading. Inconsistent HTML/ARIA quality means context is often incomplete. No mechanism exists to supplement context via data attributes or explicit annotation. |
| Low-effort adoption               | **Achieved**           | Zero code needed. Adding `<AnalyticsController />` to App.tsx is the only integration point.                                                                                                                                 |
| Coverage across integration types | **Partially Achieved** | Core dashboard and Module Federation plugins in the same window are covered. Iframe content is **not** covered.                                                                                                              |
| Customization                     | **Not Achieved**       | All events use auto-generated baseline names and properties. No mechanism to customize event names or property values.                                                                                                       |
| Input modality coverage           | **Achieved**           | Capture-phase listeners fire for both mouse clicks and keyboard activations.                                                                                                                                                 |

### Baseline Interaction Set

| Required Pattern                         | Status                 | Detail                                                                                                                                          |
| ---------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary actions (CTA buttons)            | **Achieved**           | `buttonClick` pattern detects all button clicks with role and accessible name.                                                                  |
| Overflow/menu actions                    | **Achieved**           | `menuAction` pattern detects menu opener and defers tracking until the follow-up item is selected, capturing actual user intent.                |
| Modal lifecycle (open/close with reason) | **Achieved**           | `modalOpen` and `modalClose` patterns detect dialog appearance and dismissal with close reason.                                                 |
| Form lifecycle (entry/exit with outcome) | **Achieved** | `formEntry` tracks first interaction. `formOutcome` tracks submitted/cancelled/abandoned/failure with duration and network outcome correlation. Modal-based forms where the submit button is outside the `<form>` element are handled via [dialog-aware submission detection](#modal-form-outcome-correlation). |
| Multi-step flows (wizard)                | **Achieved**           | `formTracker` detects PatternFly v6 wizard components and tracks step progression and abandonment.                                              |
| Inline validation and errors             | **Partially Achieved** | Alert-level errors captured via `alertTracker`. Field-level inline validation errors not individually tracked.                                  |

### API Resource Operations

| Requirement             | Status           | Detail                                                                                                |
| ----------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| Create (POST)           | **Achieved**     | Network interceptor captures POST requests with outcome.                                              |
| Update (PUT/PATCH)      | **Achieved**     | Network interceptor captures PUT and PATCH requests with outcome.                                     |
| Delete (DELETE)         | **Achieved**     | Network interceptor captures DELETE requests with outcome.                                            |
| Success/failure outcome | **Achieved**     | Determined from HTTP status codes, K8s `Status` objects, and backend `{ success }` response patterns. |
| Resource identification | **Not Achieved** | Request/response bodies excluded from events (PII). Only URL path and HTTP method available.          |

### Privacy Requirements

| Requirement                | Status                 | Detail                                                                                                                              |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| No PII in events           | **Achieved**           | Form field values never captured. Request/response bodies excluded. Element text truncated to 40 characters.                        |
| Resource name sanitization | **Partially Achieved** | Route patterns used for `pathname`. However, `requestPath` in network events contains the raw URL which may include resource names. |
| Allowed identifiers only   | **Achieved**           | Segment handles anonymous user IDs. No real names, emails, or IP addresses captured.                                                |

### Plugin and Integration Requirements

| Requirement                    | Status                     | Detail                                                                                                                                                                                            |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugins define custom events   | **Not Achieved**           | No extension points for plugins to register custom event definitions or context sources.                                                                                                          |
| Baseline tracking in plugins   | **Partially Achieved**     | Baseline patterns fire automatically for plugin UI in the same window (Module Federation). Network interceptor catches all Axios/fetch/XHR at window level. Plugins cannot customize event names. |
| Non-invasive upstream tracking | **Achieved (same-window)** | Capture-phase listeners and network interceptor operate at window/document level, working for upstream code without modifications.                                                                |
| Midstream-defined events       | **Not Achieved**           | No mechanism for midstream code to define custom events for upstream interactions.                                                                                                                |
| Same-domain iframe tracking    | **Not Achieved**           | DOM listeners and network interceptor operate on parent window only.                                                                                                                              |

---

## Summary Matrix

| Requirement Category                     | Achieved | Partially | Not Achieved |
| ---------------------------------------- | -------- | --------- | ------------ |
| **Mechanism Requirements**               | 3        | 2         | 1            |
| **Baseline Interaction Set**             | 6        | 0         | 0            |
| **API Resource Operations**              | 4        | 0         | 1            |
| **Privacy Requirements**                 | 2        | 1         | 0            |
| **Plugin and Integration**               | 1        | 1         | 3            |
| **Stakeholder Data Needs**               | 6        | 4         | 1            |
| **Feature-Specific (GenAI Studio)**      | 0        | 5         | 2            |
| **Feature-Specific (Model Catalog)**     | 2        | 6         | 0            |
| **Feature-Specific (Deployment Wizard)** | 5        | 3         | 1            |
| **Total**                                | **28**   | **23**    | **9**        |

See [Feasibility Metrics](#feasibility-metrics---detailed-breakdown) for per-requirement scoring of stakeholder and feature-specific items.

---

## Jira Context

### Issue Hierarchy

| Issue                                                             | Type       | Status      | Summary                                               |
| ----------------------------------------------------------------- | ---------- | ----------- | ----------------------------------------------------- |
| [RHOAIENG-36965](https://issues.redhat.com/browse/RHOAIENG-36965) | Initiative | In Progress | Enhanced Developer Tooling for Segment Event Tracking |
| [RHOAIENG-38683](https://issues.redhat.com/browse/RHOAIENG-38683) | Epic       | In Progress | Generic Event Tracking in Dashboard                   |
| [RHOAIENG-38685](https://issues.redhat.com/browse/RHOAIENG-38685) | Story      | **Closed**  | Spike - Define Event Tracking Requirements            |
| [RHOAIENG-38686](https://issues.redhat.com/browse/RHOAIENG-38686) | Story      | In Progress | Spike - POC Automatic Event Capture                   |

### Stakeholder Requirements (RFEs and Strategy)

| Issue                                                           | Type            | Status     | Summary                                                             |
| --------------------------------------------------------------- | --------------- | ---------- | ------------------------------------------------------------------- |
| [RHAIRFE-697](https://issues.redhat.com/browse/RHAIRFE-697)     | Feature Request | Approved   | Event Tracking for GenAI Studio and Related Features                |
| [RHAISTRAT-167](https://issues.redhat.com/browse/RHAISTRAT-167) | Outcome         | New        | Event Tracking for GenAI Studio and Related Features                |
| [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) | Feature         | **Closed** | Event Tracking for GenAI Studio - Playground and AI Asset Endpoints |
| [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) | Feature         | New        | Event Tracking for Model Deployment Wizard                          |
| [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) | Feature         | New        | Event Tracking for Model Catalog                                    |

### UX Dependencies

| Issue                                                         | Type | Status     | Summary                             |
| ------------------------------------------------------------- | ---- | ---------- | ----------------------------------- |
| [RHOAIUX-1196](https://issues.redhat.com/browse/RHOAIUX-1196) | Epic | In Review  | Event Tracking for Jounce UI        |
| [RHOAIUX-1240](https://issues.redhat.com/browse/RHOAIUX-1240) | Epic | **Closed** | Event Tracking for GenAI Studio     |
| [RHOAIUX-1367](https://issues.redhat.com/browse/RHOAIUX-1367) | Epic | **Closed** | Event Tracking for Model Deployment |

---

## References

- [Example Output: Project Create / Edit / Delete](./event-tracking-poc-example-output.md)
- [Event Tracking Requirements](./event-tracking-requirements.md)
- [RHOAIENG-36965](https://issues.redhat.com/browse/RHOAIENG-36965) - Enhanced Developer Tooling for Segment Event Tracking
- [RHOAIENG-38683](https://issues.redhat.com/browse/RHOAIENG-38683) - Generic Event Tracking in Dashboard
- [RHOAIENG-38685](https://issues.redhat.com/browse/RHOAIENG-38685) - Spike - Define Event Tracking Requirements
- [RHOAIENG-38686](https://issues.redhat.com/browse/RHOAIENG-38686) - Spike - POC Automatic Event Capture
- [RHAIRFE-697](https://issues.redhat.com/browse/RHAIRFE-697) - Event Tracking for GenAI Studio and Related Features
- [RHAISTRAT-169](https://issues.redhat.com/browse/RHAISTRAT-169) - Event Tracking for GenAI Studio
- [RHAISTRAT-170](https://issues.redhat.com/browse/RHAISTRAT-170) - Event Tracking for Model Deployment Wizard
- [RHAISTRAT-171](https://issues.redhat.com/browse/RHAISTRAT-171) - Event Tracking for Model Catalog
