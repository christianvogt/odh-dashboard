# Auto-Captured Event Data - Example Output

This document records the actual Segment events emitted by the automatic event capture POC during a complete project lifecycle (create, navigate, edit, delete) on the ODH Dashboard. It serves as a concrete reference for evaluating the data captured by each baseline pattern.

The session was performed against `localhost:4010` with the dashboard running in development mode. All events below were emitted via `window.analytics.track()` (or logged to `console.info` in dev).

---

## Session: Project Create / Edit / Delete

**Route:** `/projects/*`

### Event 1 -- Button Click: "Create project"

| Field | Value |
|-------|-------|
| **Event name** | `buttonClick.toolbar.create-project` |
| **Pattern** | `buttonClick` |

```json
{
  "interactionType": "buttonClick",
  "elementName": "Create project",
  "area": [
    "main",
    "main[name=Projects]",
    "main[id=dashboard-page-main]",
    "region",
    "toolbar",
    "toolbar[id=pf-random-id-5]"
  ],
  "elementRole": "button",
  "eventType": "click",
  "pathname": "/projects/*",
  "automaticEventCapture": true
}
```

---

### Event 2 -- Modal Open: "Create project"

| Field | Value |
|-------|-------|
| **Event name** | `modalOpen.dialog.create-project` |
| **Pattern** | `modalOpen` |

```json
{
  "interactionType": "modalOpen",
  "elementName": "Create project",
  "area": [
    "dialog",
    "dialog[name=Create project]",
    "dialog[id=pf-modal-part-1]"
  ],
  "elementRole": "dialog",
  "eventType": "click",
  "pathname": "/projects/*",
  "automaticEventCapture": true
}
```

---

### Event 3 -- Button Click: "Create" (form submit)

| Field | Value |
|-------|-------|
| **Event name** | `buttonClick.contentinfo.create` |
| **Pattern** | `buttonClick` |

```json
{
  "interactionType": "buttonClick",
  "elementName": "Create",
  "area": [
    "dialog",
    "dialog[name=Create project]",
    "dialog[id=pf-modal-part-1]",
    "contentinfo"
  ],
  "elementRole": "button",
  "eventType": "click",
  "pathname": "/projects/*",
  "automaticEventCapture": true
}
```

---

### Event 4 -- Network Request: POST (project creation)

| Field | Value |
|-------|-------|
| **Event name** | `networkRequest.post` |
| **Pattern** | `networkRequest` |

```json
{
  "interactionType": "networkRequest",
  "requestMethod": "POST",
  "requestPath": "/api/k8s/apis/project.openshift.io/v1/projectrequests",
  "statusCode": 200,
  "outcome": "success",
  "outcomeSource": "httpStatus",
  "eventType": "network",
  "pathname": "/projects/*",
  "automaticEventCapture": true
}
```

---

### Event 5 -- Form Outcome: create-project

| Field | Value |
|-------|-------|
| **Event name** | `formOutcome.form.create-project` |
| **Pattern** | `formOutcome` |

```json
{
  "interactionType": "formOutcome",
  "elementName": "create-project",
  "area": [
    "dialog",
    "dialog[name=Create project]",
    "dialog[id=pf-modal-part-1]",
    "form"
  ],
  "outcome": "success",
  "duration": 17304,
  "interacted": true,
  "eventType": "lifecycle",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

> **Note:** The form tracker detects that the "Create" button (Event 3) is inside a dialog containing a tracked form but is not a cancel/close button, and treats it as a submission signal. When the network request succeeds (Event 4), the outcome is correlated as `"success"`. See [Modal-form outcome correlation](./event-tracking-poc-evaluation.md#modal-form-outcome-correlation) for how this heuristic works.

---

### Event 6 -- Tab Click: "Workbenches"

| Field | Value |
|-------|-------|
| **Event name** | `tabClick.tab.workbenches` |
| **Pattern** | `tabClick` |

```json
{
  "interactionType": "tabClick",
  "elementName": "Workbenches",
  "area": [
    "main",
    "main[name=analytics-test-project]",
    "main[id=dashboard-page-main]",
    "region",
    "region[name=horizontal-bar-tab-section]",
    "tabs",
    "tabs[name=Horizontal bar]",
    "tablist",
    "tab",
    "tab[id=pf-tab-workbenches-pf-1772558903098vs3kn8c4gz]",
    "tab[data-testid=workbenches-tab]"
  ],
  "elementRole": "tab",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 7 -- Menu Action: "Edit project"

| Field | Value |
|-------|-------|
| **Event name** | `menuAction.region.edit-project` |
| **Pattern** | `menuAction` |

```json
{
  "interactionType": "menuAction",
  "elementName": "Edit project",
  "openerName": "Actions",
  "area": [
    "main",
    "main[name=analytics-test-project]",
    "main[id=dashboard-page-main]",
    "region",
    "region[name=analytics-test-project]"
  ],
  "elementRole": "menuitem",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 8 -- Modal Open: "Edit project"

| Field | Value |
|-------|-------|
| **Event name** | `modalOpen.dialog.edit-project` |
| **Pattern** | `modalOpen` |

```json
{
  "interactionType": "modalOpen",
  "elementName": "Edit project",
  "area": [
    "dialog",
    "dialog[name=Edit project]",
    "dialog[id=pf-modal-part-3]"
  ],
  "elementRole": "dialog",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 9 -- Modal Close: Cancel (edit)

| Field | Value |
|-------|-------|
| **Event name** | `modalClose.contentinfo.cancel` |
| **Pattern** | `modalClose` |

```json
{
  "interactionType": "modalClose",
  "elementName": "Cancel",
  "area": [
    "dialog",
    "dialog[name=Edit project]",
    "dialog[id=pf-modal-part-3]",
    "contentinfo"
  ],
  "outcome": "cancelled",
  "elementRole": "button",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 10 -- Form Outcome: edit-project

| Field | Value |
|-------|-------|
| **Event name** | `formOutcome.form.edit-project` |
| **Pattern** | `formOutcome` |

```json
{
  "interactionType": "formOutcome",
  "elementName": "edit-project",
  "area": [
    "dialog",
    "dialog[name=Edit project]",
    "dialog[id=pf-modal-part-3]",
    "form"
  ],
  "outcome": "cancelled",
  "duration": 48023,
  "interacted": false,
  "eventType": "lifecycle",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 11 -- Menu Action: "Delete project"

| Field | Value |
|-------|-------|
| **Event name** | `menuAction.region.delete-project` |
| **Pattern** | `menuAction` |

```json
{
  "interactionType": "menuAction",
  "elementName": "Delete project",
  "openerName": "Actions",
  "area": [
    "main",
    "main[name=analytics-test-project]",
    "main[id=dashboard-page-main]",
    "region",
    "region[name=analytics-test-project]"
  ],
  "elementRole": "menuitem",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 12 -- Modal Open: Delete confirmation

| Field | Value |
|-------|-------|
| **Event name** | `modalOpen.dialog.warning-alert-delete-project` |
| **Pattern** | `modalOpen` |

```json
{
  "interactionType": "modalOpen",
  "elementName": "Warning alert:Delete project?",
  "area": [
    "dialog",
    "dialog[name=Warning alert:Delete project?]",
    "dialog[id=pf-modal-part-5]",
    "dialog[data-testid=delete-modal]"
  ],
  "elementRole": "dialog",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 13 -- Button Click: "Delete project" (confirmation)

| Field | Value |
|-------|-------|
| **Event name** | `buttonClick.contentinfo.delete-project` |
| **Pattern** | `buttonClick` |

```json
{
  "interactionType": "buttonClick",
  "elementName": "Delete project",
  "area": [
    "dialog",
    "dialog[name=Warning alert:Delete project?]",
    "dialog[id=pf-modal-part-5]",
    "dialog[data-testid=delete-modal]",
    "contentinfo"
  ],
  "elementRole": "button",
  "eventType": "click",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

### Event 14 -- Network Request: DELETE (project deletion)

| Field | Value |
|-------|-------|
| **Event name** | `networkRequest.delete` |
| **Pattern** | `networkRequest` |

```json
{
  "interactionType": "networkRequest",
  "requestMethod": "DELETE",
  "requestPath": "/api/k8s/apis/project.openshift.io/v1/projects/analytics-test-project",
  "statusCode": 200,
  "outcome": "success",
  "outcomeSource": "k8sStatus",
  "eventType": "network",
  "pathname": "/projects/*",
  "navigationContext": ["Projects"],
  "automaticEventCapture": true
}
```

---

## Pattern Summary

| Pattern | Occurrences | Example Event Name |
|---------|------------|-------------------|
| `buttonClick` | 3 | `buttonClick.toolbar.create-project` |
| `modalOpen` | 3 | `modalOpen.dialog.create-project` |
| `modalClose` | 1 | `modalClose.contentinfo.cancel` |
| `menuAction` | 2 | `menuAction.region.edit-project` |
| `tabClick` | 1 | `tabClick.tab.workbenches` |
| `networkRequest` | 2 | `networkRequest.post`, `networkRequest.delete` |
| `formOutcome` | 2 | `formOutcome.form.create-project` |

**Total events emitted for a single create/edit/delete lifecycle: 14** (excluding form tracker duplicates).

---

## Common Payload Structure

### Present on every event

| Property | Type | Description |
|----------|------|-------------|
| `automaticEventCapture` | `boolean` | Always `true`; distinguishes auto-captured from manual events |
| `pathname` | `string` | Best-matching route pattern (e.g. `/projects/*`) |
| `eventType` | `string` | `"click"`, `"network"`, or `"lifecycle"` |

### Interaction events (`buttonClick`, `tabClick`, `menuAction`, `modalOpen`, `modalClose`)

| Property | Type | Description |
|----------|------|-------------|
| `interactionType` | `string` | The pattern name |
| `elementName` | `string` | Accessible name of the element (from `aria-label`, `aria-labelledby`, or text content) |
| `area` | `string[]` | Hierarchical context: ARIA landmarks, regions, OUIA component types |
| `elementRole` | `string` | ARIA role (`button`, `tab`, `menuitem`, `dialog`) |
| `navigationContext` | `string[]` | Active PatternFly nav link hierarchy (when available) |

### Menu action events (`menuAction`)

| Property | Type | Description |
|----------|------|-------------|
| `openerName` | `string` | The element that opened the dropdown (e.g. `"Actions"`, `"Kebab toggle"`) |

### Modal close events (`modalClose`)

| Property | Type | Description |
|----------|------|-------------|
| `outcome` | `string` | `"cancelled"` (Cancel button), `"dismissed"` (X button), or `"submitted"` |

### Network events (`networkRequest`)

| Property | Type | Description |
|----------|------|-------------|
| `requestMethod` | `string` | HTTP method (`POST`, `PUT`, `PATCH`, `DELETE`) |
| `requestPath` | `string` | URL pathname of the request |
| `statusCode` | `number` | HTTP response status code |
| `outcome` | `string` | `"success"` or `"failure"` |
| `outcomeSource` | `string` | How outcome was determined: `"httpStatus"`, `"k8sStatus"`, or `"responseBody"` |
| `outcomeReason` | `string` | Reason for failure (when applicable) |

### Form lifecycle events (`formOutcome`)

| Property | Type | Description |
|----------|------|-------------|
| `elementName` | `string` | Form identifier (derived from form `id` or dialog name) |
| `outcome` | `string` | `"success"`, `"failure"`, `"submitted"`, `"cancelled"`, or `"abandoned"` |
| `duration` | `number` | Milliseconds from first interaction to outcome |
| `interacted` | `boolean` | Whether the user modified any form fields |

---

## Observations

### What auto-capture provides well

- **Complete interaction sequence:** Every user action in the create/edit/delete flow was captured, producing a full behavioral trace.
- **Modal lifecycle:** Open and close events with outcome (`cancelled` vs `submitted` vs `dismissed`) provide funnel analysis data.
- **Network outcomes:** Success/failure with outcome source (`httpStatus`, `k8sStatus`) enables success rate analysis without touching feature code.
- **Area context:** The `area` array provides a hierarchical location within the page, useful for distinguishing the same button label in different contexts.
- **Menu tracking:** `openerName` on `menuAction` events identifies which dropdown menu was used, capturing the two-click intent (open menu, select item) as a single meaningful event.

### What auto-capture cannot provide

- **Resource identity:** No event reveals which project was created, edited, or deleted. The project name, description, and configuration are absent from all payloads. The only exception is `requestPath` in network events, which includes the resource name in the URL path.
- **Form field values:** The project name and description entered by the user are not captured (PII exclusion). An analyst can see that a form was submitted but not what was in it.
- **Business-meaningful event names:** `networkRequest.post` would need to be `"Project Created"` for stakeholder dashboards. `menuAction.region.delete-project` is structurally descriptive but not a business label.
- **Stable identifiers:** `area` arrays contain auto-generated PatternFly IDs (`pf-random-id-5`, `pf-modal-part-1`) that are not stable across sessions. OUIA IDs and `data-testid` attributes are stable when present.

### Notes

- **Modal-form outcome correlation:** The `formOutcome` for the create flow (Event 5) correlates a button click in the modal footer with the subsequent network outcome, even though the submit button resides outside the `<form>` element. The form tracker detects non-cancel/close buttons inside a dialog containing a tracked form and treats them as submission signals. See [Modal-form outcome correlation](./event-tracking-poc-evaluation.md#modal-form-outcome-correlation) in the evaluation document.
- **requestPath contains resource names:** While request/response bodies are excluded, the URL path in network events (`/api/k8s/.../projects/analytics-test-project`) reveals the resource name. This is useful for analysis but may need PII review depending on naming conventions.
