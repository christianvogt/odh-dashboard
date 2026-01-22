import type { BaselineEvent } from './types';
import {
  getAreaPath,
  normalizeText,
  slugify,
  MAX_ELEMENT_SLUG_LENGTH,
  getStableId,
  buildBaselineEventName,
} from './baselineDetector';

type AlertTrackerOptions = {
  onAlertEvent: (event: BaselineEvent) => void;
};

const ALERT_SELECTOR = '.pf-v6-c-alert';
const TOAST_GROUP_SELECTOR = '.pf-v6-c-alert-group.pf-m-toast';

const VARIANT_CLASSES: Record<string, string> = {
  'pf-m-danger': 'danger',
  'pf-m-success': 'success',
  'pf-m-warning': 'warning',
  'pf-m-info': 'info',
  'pf-m-custom': 'custom',
};

const getAlertVariant = (alert: Element): string => {
  for (const [cls, variant] of Object.entries(VARIANT_CLASSES)) {
    if (alert.classList.contains(cls)) {
      return variant;
    }
  }
  return 'default';
};

const getAlertTitle = (alert: Element): string => {
  const titleEl = alert.querySelector('.pf-v6-c-alert__title');
  if (!titleEl) {
    return '';
  }
  const screenReaderOnly = titleEl.querySelector('.pf-v6-c-alert__title .pf-v6-screen-reader');
  const raw = screenReaderOnly
    ? titleEl.textContent?.replace(screenReaderOnly.textContent ?? '', '').trim()
    : titleEl.textContent?.trim();

  return raw ? slugify(normalizeText(raw), MAX_ELEMENT_SLUG_LENGTH) : '';
};

const isToast = (alert: Element): boolean =>
  alert.closest(TOAST_GROUP_SELECTOR) !== null;

const getAreaFromPath = (areaPath: string[]): string => {
  for (let i = areaPath.length - 1; i >= 0; i--) {
    if (!areaPath[i].includes('[')) {
      return areaPath[i];
    }
  }
  return 'unknown';
};

export const createAlertTracker = ({ onAlertEvent }: AlertTrackerOptions) => {
  let observer: MutationObserver | null = null;
  const trackedAlerts = new WeakSet<Element>();

  const processAlert = (alert: Element): void => {
    if (trackedAlerts.has(alert)) {
      return;
    }
    trackedAlerts.add(alert);

    const variant = getAlertVariant(alert);
    const title = getAlertTitle(alert);
    const toast = isToast(alert);
    const areaPath = getAreaPath(alert);
    const area = getAreaFromPath(areaPath);
    const elementName = title || variant;

    onAlertEvent({
      pattern: 'alertAppeared',
      stableId: getStableId('alertAppeared', area, elementName),
      eventName: buildBaselineEventName('alertAppeared', area, elementName),
      properties: {
        interactionType: 'alertAppeared',
        elementName,
        alertVariant: variant,
        alertTitle: title,
        isToast: toast,
        area: areaPath,
      },
    });
  };

  const scanForAlerts = (node: Node): Element[] => {
    if (!(node instanceof Element)) {
      return [];
    }
    const alerts: Element[] = [];
    if (node.matches(ALERT_SELECTOR)) {
      alerts.push(node);
    }
    alerts.push(...node.querySelectorAll(ALERT_SELECTOR));
    return alerts;
  };

  const start = (): void => {
    if (observer) {
      return;
    }

    for (const alert of document.querySelectorAll(ALERT_SELECTOR)) {
      processAlert(alert);
    }

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          for (const alert of scanForAlerts(node)) {
            processAlert(alert);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = null;
  };

  return { start, stop };
};

export type AlertTracker = ReturnType<typeof createAlertTracker>;
