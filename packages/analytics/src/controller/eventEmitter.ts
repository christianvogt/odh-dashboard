import type { BaseProperties } from './types';

const isCypress = (): boolean => Boolean((window as { Cypress?: unknown }).Cypress);

const sendToCypress = (eventName: string, properties: Record<string, unknown>): void => {
  void fetch('/__analytics__', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: eventName, properties }),
  });
};

export const buildAnalyticsPayload = (
  properties: Record<string, unknown>,
  baseProperties: BaseProperties,
): Record<string, unknown> => ({
  ...properties,
  ...baseProperties,
  automaticEventCapture: true,
});

export const emitAnalyticsEvent = (
  eventName: string,
  properties: Record<string, unknown>,
  baseProperties: BaseProperties,
): void => {
  const payload = buildAnalyticsPayload(properties, baseProperties);

  if (isCypress()) {
    sendToCypress(eventName, payload);
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.info('[analytics]', eventName, payload);
  }

  if (window.analytics?.track) {
    window.analytics.track(eventName, payload);
  }
};
