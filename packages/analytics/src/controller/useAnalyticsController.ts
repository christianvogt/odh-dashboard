import * as React from 'react';
import { matchPath } from 'react-router-dom';
import type {
  A11yPath,
  AnalyticsEventType,
  BaseProperties,
  BaselineEvent,
  BaselineMatchInfo,
  CapturedEventInfo,
  AnalyticsPayload,
  RawEvent,
  RawInteractionEvent,
  RawNetworkEvent,
} from './types';
import { extractA11yPath } from './a11yExtractor';
import { createBaselineTracker } from './baselineDetector';
import { buildAnalyticsPayload, emitAnalyticsEvent } from './eventEmitter';
import { createNetworkInterceptor } from './networkInterceptor';
import { createFormTracker, type FormTracker } from './formTracker';
import { createAlertTracker, type AlertTracker } from './alertTracker';

type UseAnalyticsControllerArgs = {
  baseProperties: BaseProperties;
  locationPathname: string;
  routePattern: string;
  devMode: boolean;
  onRawEvent?: (event: RawEvent) => void;
};

const AUTO_CAPTURE_NETWORK_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;
const AUTO_CAPTURE_NETWORK_METHOD_SET = new Set<string>(AUTO_CAPTURE_NETWORK_METHODS);
const NETWORK_IGNORE_PATH_PATTERNS = [
  /\/selfsubjectaccessreviews?/i,
  /\/prometheus/i,
  /\/dev-impersonate/i,
];

const isHiddenInput = (element: Element): boolean =>
  element.tagName.toLowerCase() === 'input' &&
  (element.getAttribute('type') || '').toLowerCase() === 'hidden';

const isWrappedInput = (element: Element): boolean => {
  if (element.tagName.toLowerCase() !== 'input') {
    return false;
  }
  const type = (element.getAttribute('type') || '').toLowerCase();
  if (type !== 'checkbox' && type !== 'radio') {
    return false;
  }
  const parent = element.closest('[role="checkbox"], [role="radio"], [role="switch"]');
  return parent !== null && parent !== element;
};

const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="option"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="treeitem"]',
].join(',');

const findAssociatedControl = (label: Element): Element | null => {
  const htmlFor = label.getAttribute('for');
  if (htmlFor) {
    return label.ownerDocument.getElementById(htmlFor);
  }
  return label.querySelector('input, select, textarea, button');
};

const getInteractiveTarget = (element: Element): Element | null => {
  const interactive = element.closest(INTERACTIVE_SELECTOR);
  if (interactive && !isHiddenInput(interactive) && !isWrappedInput(interactive)) {
    return interactive;
  }

  const label = element.closest('label');
  if (label) {
    const control = findAssociatedControl(label);
    if (control && !isHiddenInput(control)) {
      return control;
    }
  }

  const tabbable = element.closest('[tabindex]');
  if (tabbable) {
    const tabIndexAttr = tabbable.getAttribute('tabindex');
    const tabIndex = tabIndexAttr === null ? Number.NaN : Number(tabIndexAttr);
    if (!Number.isNaN(tabIndex) && tabIndex >= 0) {
      return tabbable;
    }
  }

  if (
    element.hasAttribute('contenteditable') &&
    element.getAttribute('contenteditable') !== 'false'
  ) {
    return element;
  }

  return null;
};

const getAttributes = (element: Element): Record<string, string> =>
  Object.fromEntries(Array.from(element.attributes).map((attr) => [attr.name, attr.value]));

const getUrlParams = (pattern: string, pathname: string): Record<string, string> => {
  const match = matchPath({ path: pattern, end: false }, pathname);
  if (!match?.params) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(match.params).flatMap(([key, value]) =>
      value === undefined ? [] : [[key, String(value)]],
    ),
  );
};

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"], [role="dialog"], .pf-v6-c-modal-box';
const TOOLTIP_SELECTOR = '.pf-v6-c-popover, .pf-v6-c-tooltip, [data-popper-placement]';

const isElementVisible = (element: Element): boolean => {
  if (!(element instanceof HTMLElement)) {
    return true;
  }
  if (element.hidden) {
    return false;
  }
  return element.getClientRects().length > 0;
};

const isTooltipLikeElement = (element: Element): boolean =>
  element.matches(TOOLTIP_SELECTOR) || Boolean(element.closest(TOOLTIP_SELECTOR));

const getDialogElements = (): Element[] =>
  Array.from(document.querySelectorAll(MODAL_SELECTOR)).filter(
    (element) => isElementVisible(element) && !isTooltipLikeElement(element),
  );

const buildBaselineMatchInfo = (baseline: {
  pattern: BaselineMatchInfo['pattern'];
  stableId: string;
  eventName: string;
}): BaselineMatchInfo => ({
  pattern: baseline.pattern,
  stableId: baseline.stableId,
  eventName: baseline.eventName,
});

const shouldIgnoreNetworkMethod = (method: string): boolean => {
  const normalized = method.toUpperCase();
  return normalized === 'GET' || normalized === 'HEAD';
};

const shouldIgnoreNetworkPath = (pathname: string, method: string): boolean => {
  const normalizedMethod = method.toUpperCase();
  if (normalizedMethod !== 'POST') {
    return false;
  }
  return NETWORK_IGNORE_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
};

const isAutoCapturedNetworkMethod = (method: string): boolean =>
  AUTO_CAPTURE_NETWORK_METHOD_SET.has(method.toUpperCase());

const MAX_SLUG_LENGTH = 40;

const capSlug = (value: string): string =>
  value.length <= MAX_SLUG_LENGTH ? value : value.slice(0, MAX_SLUG_LENGTH);

const slugify = (value: string): string => {
  const slug =
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  return capSlug(slug);
};

const buildNetworkBaselineId = (method: string, pathname: string): string =>
  `baseline.network.${method.toLowerCase()}.${slugify(pathname)}`;

const MAX_EVENT_NAME_LENGTH = 40;

const capEventName = (value: string): string => {
  if (value.length <= MAX_EVENT_NAME_LENGTH) {
    return value;
  }
  const lastDot = value.lastIndexOf('.');
  if (lastDot > 0) {
    const suffix = value.slice(lastDot);
    const maxPrefix = MAX_EVENT_NAME_LENGTH - suffix.length;
    if (maxPrefix > 0) {
      return `${value.slice(0, maxPrefix)}${suffix}`;
    }
  }
  return value.slice(0, MAX_EVENT_NAME_LENGTH);
};

const buildNetworkBaselineEventName = (method: string): string =>
  capEventName(`networkRequest.${method.toLowerCase()}`);

const appendInteractionMetadata = (
  properties: Record<string, unknown>,
  metadata: {
    elementRole: string;
    interactionType: AnalyticsEventType;
  },
): Record<string, unknown> => ({
  ...properties,
  elementRole: metadata.elementRole,
  eventType: metadata.interactionType,
});

const appendNetworkMetadata = (properties: Record<string, unknown>): Record<string, unknown> => ({
  ...properties,
  eventType: 'network',
});

type NetworkOutcome = {
  outcome: 'success' | 'failure';
  outcomeSource: 'httpStatus' | 'k8sStatus' | 'backendStatus';
  outcomeReason?: string;
};

const isK8sStatus = (
  body: unknown,
): body is { kind: 'Status'; status: string; reason?: string; message?: string; code?: number } =>
  typeof body === 'object' &&
  body !== null &&
  'kind' in body &&
  (body as Record<string, unknown>).kind === 'Status';

const isBackendStatus = (body: unknown): body is { success: boolean; error: string } =>
  typeof body === 'object' &&
  body !== null &&
  'success' in body &&
  typeof (body as Record<string, unknown>).success === 'boolean';

const deriveNetworkOutcome = (
  status: number | undefined,
  responseBody: unknown,
): NetworkOutcome => {
  if (isK8sStatus(responseBody)) {
    return {
      outcome: responseBody.status === 'Success' ? 'success' : 'failure',
      outcomeSource: 'k8sStatus',
      outcomeReason: responseBody.reason,
    };
  }

  if (isBackendStatus(responseBody)) {
    return {
      outcome: responseBody.success ? 'success' : 'failure',
      outcomeSource: 'backendStatus',
      outcomeReason: responseBody.error || undefined,
    };
  }

  if (status !== undefined) {
    return {
      outcome: status >= 200 && status < 400 ? 'success' : 'failure',
      outcomeSource: 'httpStatus',
    };
  }

  return { outcome: 'success', outcomeSource: 'httpStatus' };
};

const createEventId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const buildRawInteractionEvent = ({
  element,
  eventType,
  a11y,
  routePattern,
  locationPathname,
  baselineMatch,
  capturedEvents,
  analyticsPayloads,
}: {
  element: Element;
  eventType: AnalyticsEventType;
  a11y: A11yPath;
  routePattern: string;
  locationPathname: string;
  baselineMatch?: BaselineMatchInfo;
  capturedEvents?: CapturedEventInfo[];
  analyticsPayloads?: AnalyticsPayload[];
}): RawInteractionEvent => ({
  type: 'interaction',
  id: createEventId(),
  timestamp: Date.now(),
  pathname: routePattern,
  location: locationPathname,
  a11y,
  attributes: getAttributes(element),
  context: {},
  urlParams: getUrlParams(routePattern, locationPathname),
  baselineMatch,
  capturedEvents,
  analyticsPayloads,
  eventType,
});

const buildRawNetworkEvent = (
  event: RawNetworkEvent,
  routePattern: string,
  capturedEvents?: CapturedEventInfo[],
  analyticsPayloads?: AnalyticsPayload[],
): RawNetworkEvent => ({
  ...event,
  pathname: routePattern,
  capturedEvents,
  analyticsPayloads,
});

export const useAnalyticsController = ({
  baseProperties,
  locationPathname,
  routePattern,
  devMode,
  onRawEvent,
}: UseAnalyticsControllerArgs): void => {
  const baselineTracker = React.useMemo(() => createBaselineTracker(), []);
  const openDialogsRef = React.useRef<Set<Element>>(new Set());
  const lastClickRef = React.useRef<{ element: Element; timestamp: number } | null>(null);
  const formTrackerRef = React.useRef<FormTracker | null>(null);
  const processFormEventRef = React.useRef<(event: BaselineEvent) => void>(() => {});

  processFormEventRef.current = (formBaseline: BaselineEvent): void => {
    const info = buildBaselineMatchInfo({
      pattern: formBaseline.pattern,
      stableId: formBaseline.stableId,
      eventName: formBaseline.eventName,
    });

    const capturedEvents: CapturedEventInfo[] = [
      { id: formBaseline.stableId, eventName: info.eventName },
    ];

    const adjustedWithMeta: Record<string, unknown> = {
      ...formBaseline.properties,
      eventType: 'lifecycle',
    };
    const analyticsPayloads: AnalyticsPayload[] = [
      {
        source: 'baseline',
        id: formBaseline.stableId,
        eventName: formBaseline.eventName,
        payload: buildAnalyticsPayload(adjustedWithMeta, baseProperties),
      },
    ];
    emitAnalyticsEvent(formBaseline.eventName, adjustedWithMeta, baseProperties);

    if (devMode && onRawEvent) {
      onRawEvent(
        buildRawInteractionEvent({
          element: document.body,
          eventType: 'click',
          a11y: {
            role: 'form',
            name: String(formBaseline.properties.elementName ?? ''),
            semanticPath: 'form',
          },
          routePattern,
          locationPathname,
          baselineMatch: info,
          capturedEvents,
          analyticsPayloads,
        }),
      );
    }
  };

  if (!formTrackerRef.current) {
    const tracker = createFormTracker({
      onFormEvent: (event) => processFormEventRef.current(event),
    });
    formTrackerRef.current = tracker;
    tracker.start();
  }

  React.useEffect(
    () => () => {
      formTrackerRef.current?.stop();
      formTrackerRef.current = null;
    },
    [],
  );

  const alertTrackerRef = React.useRef<AlertTracker | null>(null);
  const processAlertEventRef = React.useRef<(event: BaselineEvent) => void>(() => {});

  processAlertEventRef.current = (alertBaseline: BaselineEvent): void => {
    const info = buildBaselineMatchInfo({
      pattern: alertBaseline.pattern,
      stableId: alertBaseline.stableId,
      eventName: alertBaseline.eventName,
    });

    const capturedEvents: CapturedEventInfo[] = [
      { id: alertBaseline.stableId, eventName: info.eventName },
    ];

    const adjustedWithMeta: Record<string, unknown> = {
      ...alertBaseline.properties,
      eventType: 'systemFeedback',
    };
    const analyticsPayloads: AnalyticsPayload[] = [
      {
        source: 'baseline',
        id: alertBaseline.stableId,
        eventName: alertBaseline.eventName,
        payload: buildAnalyticsPayload(adjustedWithMeta, baseProperties),
      },
    ];
    emitAnalyticsEvent(alertBaseline.eventName, adjustedWithMeta, baseProperties);

    if (devMode && onRawEvent) {
      onRawEvent(
        buildRawInteractionEvent({
          element: document.body,
          eventType: 'click',
          a11y: {
            role: 'alert',
            name: String(alertBaseline.properties.elementName ?? ''),
            semanticPath: 'alert',
          },
          routePattern,
          locationPathname,
          baselineMatch: info,
          capturedEvents,
          analyticsPayloads,
        }),
      );
    }
  };

  if (!alertTrackerRef.current) {
    const tracker = createAlertTracker({
      onAlertEvent: (event) => processAlertEventRef.current(event),
    });
    alertTrackerRef.current = tracker;
    tracker.start();
  }

  React.useEffect(
    () => () => {
      alertTrackerRef.current?.stop();
      alertTrackerRef.current = null;
    },
    [],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    openDialogsRef.current = new Set(getDialogElements());

    const handleInteraction = (event: Event, eventType: AnalyticsEventType): void => {
      if (!event.target || !(event.target instanceof Element)) {
        return;
      }

      const element = eventType === 'click' ? getInteractiveTarget(event.target) : event.target;
      if (!element) {
        return;
      }

      if (eventType === 'click') {
        const last = lastClickRef.current;
        if (last && last.element === element && event.timeStamp - last.timestamp < 50) {
          return;
        }
        lastClickRef.current = { element, timestamp: event.timeStamp };
      }

      formTrackerRef.current?.notifyInteraction(element);

      const a11y = extractA11yPath(element);

      const baseline = baselineTracker({
        element,
        eventType,
        a11y,
        context: {},
      });

      if (baseline?.pattern === 'formComplete') {
        const form = element.closest('form') as HTMLFormElement | null;
        if (form) {
          formTrackerRef.current?.notifySubmit(form);
        }
      }

      let baselineMatchInfo: BaselineMatchInfo | undefined;
      const capturedEvents: CapturedEventInfo[] = [];
      const analyticsPayloads: AnalyticsPayload[] = [];
      if (baseline) {
        const info = buildBaselineMatchInfo({
          pattern: baseline.pattern,
          stableId: baseline.stableId,
          eventName: baseline.eventName,
        });
        baselineMatchInfo = info;
        capturedEvents.push({
          id: baseline.stableId,
          eventName: info.eventName,
        });
        const propertiesWithMeta = appendInteractionMetadata(baseline.properties, {
          elementRole: a11y.role,
          interactionType: eventType,
        });
        analyticsPayloads.push({
          source: 'baseline',
          id: baseline.stableId,
          eventName: baseline.eventName,
          payload: buildAnalyticsPayload(propertiesWithMeta, baseProperties),
        });
        emitAnalyticsEvent(baseline.eventName, propertiesWithMeta, baseProperties);
      }

      if (devMode && onRawEvent) {
        onRawEvent(
          buildRawInteractionEvent({
            element,
            eventType,
            a11y,
            routePattern,
            locationPathname,
            baselineMatch: baselineMatchInfo,
            capturedEvents: capturedEvents.length > 0 ? capturedEvents : undefined,
            analyticsPayloads: analyticsPayloads.length > 0 ? analyticsPayloads : undefined,
          }),
        );
      }

      if (eventType === 'click') {
        const skipModalOpen = baselineMatchInfo?.pattern === 'modalOpen';
        requestAnimationFrame(() => {
          const currentDialogs = getDialogElements();
          const previousDialogs = openDialogsRef.current;
          const currentSet = new Set(currentDialogs);
          openDialogsRef.current = currentSet;

          if (skipModalOpen) {
            return;
          }

          const newDialogs = currentDialogs.filter((dialog) => !previousDialogs.has(dialog));
          if (newDialogs.length === 0) {
            return;
          }

          newDialogs.forEach((dialog) => {
            const dialogA11y = extractA11yPath(dialog);
            const modalBaseline = baselineTracker({
              element: dialog,
              eventType: 'click',
              a11y: dialogA11y,
              context: {},
            });

            if (!modalBaseline || modalBaseline.pattern !== 'modalOpen') {
              return;
            }

            const info = buildBaselineMatchInfo({
              pattern: modalBaseline.pattern,
              stableId: modalBaseline.stableId,
              eventName: modalBaseline.eventName,
            });

            const modalCapturedEvents: CapturedEventInfo[] = [
              { id: modalBaseline.stableId, eventName: info.eventName },
            ];

            const modalPropertiesWithMeta = appendInteractionMetadata(modalBaseline.properties, {
              elementRole: dialogA11y.role,
              interactionType: 'click',
            });
            const modalPayloads: AnalyticsPayload[] = [
              {
                source: 'baseline',
                id: modalBaseline.stableId,
                eventName: modalBaseline.eventName,
                payload: buildAnalyticsPayload(modalPropertiesWithMeta, baseProperties),
              },
            ];
            emitAnalyticsEvent(modalBaseline.eventName, modalPropertiesWithMeta, baseProperties);

            if (devMode && onRawEvent) {
              onRawEvent(
                buildRawInteractionEvent({
                  element: dialog,
                  eventType: 'click',
                  a11y: dialogA11y,
                  routePattern,
                  locationPathname,
                  baselineMatch: info,
                  capturedEvents: modalCapturedEvents,
                  analyticsPayloads: modalPayloads,
                }),
              );
            }
          });
        });
      }
    };

    const registerListener = (type: AnalyticsEventType): void => {
      document.addEventListener(type, (event) => handleInteraction(event, type), {
        capture: true,
        signal: controller.signal,
      });
    };

    registerListener('click');
    registerListener('submit');

    document.addEventListener(
      'focusin',
      (event) => {
        if (event.target instanceof Element) {
          formTrackerRef.current?.notifyInteraction(event.target);
        }
      },
      { capture: true, signal: controller.signal },
    );

    return () => {
      controller.abort();
    };
  }, [baseProperties, devMode, locationPathname, onRawEvent, routePattern, baselineTracker]);

  React.useEffect(() => {
    const interceptor = createNetworkInterceptor();

    const unsubscribe = interceptor.subscribe((event) => {
      if (shouldIgnoreNetworkMethod(event.request.method)) {
        return;
      }
      const url = new URL(event.request.url, window.location.origin);
      if (shouldIgnoreNetworkPath(url.pathname, event.request.method)) {
        return;
      }
      const capturedEvents: CapturedEventInfo[] = [];
      const analyticsPayloads: AnalyticsPayload[] = [];
      const method = event.request.method.toUpperCase();

      if (isAutoCapturedNetworkMethod(method)) {
        const baselineId = buildNetworkBaselineId(method, url.pathname);
        const baselineEventName = buildNetworkBaselineEventName(method);
        const networkOutcome = deriveNetworkOutcome(event.response?.status, event.response?.body);
        formTrackerRef.current?.notifyNetworkOutcome(networkOutcome.outcome);
        const baselineProperties: Record<string, unknown> = {
          interactionType: 'networkRequest',
          requestMethod: method,
          requestPath: url.pathname,
          statusCode: event.response?.status,
          outcome: networkOutcome.outcome,
          outcomeSource: networkOutcome.outcomeSource,
        };
        if (networkOutcome.outcomeReason) {
          baselineProperties.outcomeReason = networkOutcome.outcomeReason;
        }
        capturedEvents.push({
          id: baselineId,
          eventName: baselineEventName,
        });
        const propertiesWithMeta = appendNetworkMetadata(baselineProperties);
        analyticsPayloads.push({
          source: 'baseline',
          id: baselineId,
          eventName: baselineEventName,
          payload: buildAnalyticsPayload(propertiesWithMeta, baseProperties),
        });
        emitAnalyticsEvent(baselineEventName, propertiesWithMeta, baseProperties);
      }

      if (devMode && onRawEvent) {
        onRawEvent(
          buildRawNetworkEvent(
            event,
            routePattern,
            capturedEvents.length > 0 ? capturedEvents : undefined,
            analyticsPayloads.length > 0 ? analyticsPayloads : undefined,
          ),
        );
      }
    });

    return () => {
      unsubscribe();
      interceptor.destroy();
    };
  }, [baseProperties, devMode, onRawEvent, routePattern]);
};
