import * as React from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { useExtensions } from '@odh-dashboard/plugin-core';
import { isRouteExtension } from '@odh-dashboard/plugin-core/extension-points';
import type { RawEvent } from './types';
import { useAnalyticsController } from './useAnalyticsController';
import { getNavigationContext } from './navigationContext';

type DevToolWindowComponent = React.ComponentType<{
  events: RawEvent[];
  onClose: () => void;
  onClear: () => void;
}>;

const DEV_TOOL_KEY = 'analytics-devtool-enabled';
const MAX_EVENTS = 200;

const isDevBuild = (): boolean => process.env.NODE_ENV === 'development';
const createLogId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `log_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const getStoredDevToolState = (): boolean => {
  try {
    return sessionStorage.getItem(DEV_TOOL_KEY) === 'true';
  } catch {
    return false;
  }
};

const setStoredDevToolState = (enabled: boolean): void => {
  try {
    sessionStorage.setItem(DEV_TOOL_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage failures (private browsing or blocked storage)
  }
};

const scorePattern = (pattern: string): number => {
  const segments = pattern.split('/').filter(Boolean);
  let score = segments.length;
  for (const segment of segments) {
    if (segment === '*') {
      score += 0;
    } else if (segment.startsWith(':')) {
      score += 2;
    } else {
      score += 3;
    }
  }
  return score;
};

const getBestRoutePattern = (pathname: string, patterns: string[]): string => {
  const matches = patterns
    .map((pattern) => {
      const match = matchPath({ path: pattern, end: false }, pathname);
      if (!match) {
        return null;
      }
      return { pattern, score: scorePattern(pattern) };
    })
    .filter((x) => x != null);

  if (!matches.length) {
    return pathname;
  }

  return matches.toSorted((a, b) => b.score - a.score)[0].pattern;
};

export const AnalyticsController: React.FC = () => {
  const isDev = isDevBuild();
  const location = useLocation();

  const routeExtensions = useExtensions(isRouteExtension);

  const routePatterns = React.useMemo(
    () => [
      ...routeExtensions.map((extension) => extension.properties.path),
      '/dependency-missing/:area',
      '*',
    ],
    [routeExtensions],
  );

  const routePattern = React.useMemo(
    () => getBestRoutePattern(location.pathname, routePatterns),
    [location.pathname, routePatterns],
  );

  const navigationContext = React.useMemo(() => getNavigationContext(), [location.pathname]);

  const baseProperties = React.useMemo(
    () => ({
      pathname: routePattern,
      ...(navigationContext.length > 0 ? { navigationContext } : {}),
    }),
    [routePattern, navigationContext],
  );

  const [devToolEnabled, setDevToolEnabled] = React.useState<boolean>(() =>
    isDev ? getStoredDevToolState() : false,
  );
  const [rawEvents, setRawEvents] = React.useState<RawEvent[]>([]);
  const [DevToolWindow, setDevToolWindow] = React.useState<DevToolWindowComponent | null>(null);

  const handleRawEvent = React.useCallback((event: RawEvent) => {
    const eventWithLogId = { ...event, logId: createLogId() };
    setRawEvents((prev) => [eventWithLogId, ...prev].slice(0, MAX_EVENTS));
  }, []);

  const handleClear = React.useCallback(() => {
    setRawEvents([]);
  }, []);

  const handleClose = React.useCallback(() => {
    setDevToolEnabled(false);
    setStoredDevToolState(false);
  }, []);

  useAnalyticsController({
    baseProperties,
    locationPathname: location.pathname,
    routePattern,
    devMode: isDev && devToolEnabled,
    onRawEvent: isDev ? handleRawEvent : undefined,
  });

  React.useEffect(() => {
    if (!isDev) {
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    (window as any).debugAnalytics = (enable?: boolean) => {
      setDevToolEnabled((current) => {
        const next = enable === undefined ? !current : enable;
        setStoredDevToolState(next);
        return next;
      });
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
      (window as any).debugAnalytics = undefined;
    };
  }, [isDev]);

  React.useEffect(() => {
    if (!isDev) {
      return;
    }

    if (!devToolEnabled) {
      setDevToolWindow(null);
      return;
    }

    let active = true;
    void import('../devTool/DevToolWindow').then((module) => {
      if (active) {
        setDevToolWindow(() => module.DevToolWindow);
      }
    });

    return () => {
      active = false;
    };
  }, [devToolEnabled, isDev]);

  if (!isDev || !DevToolWindow || !devToolEnabled) {
    return null;
  }

  return (
    <DevToolWindow
      events={rawEvents}
      onClear={handleClear}
      onClose={handleClose}
    />
  );
};
