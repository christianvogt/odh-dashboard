import type { RawNetworkEvent, NetworkRequestData, NetworkResponseData } from './types';

type NetworkEventHandler = (event: RawNetworkEvent) => void;

type NetworkInterceptor = {
  subscribe: (handler: NetworkEventHandler) => () => void;
  destroy: () => void;
};

const createEventId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `net_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const headersToRecord = (headers: Headers): Record<string, string> =>
  Array.from(headers.entries()).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});

const parseBody = (text: string | undefined | null): unknown => {
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const readResponseBody = async (response: Response): Promise<unknown> => {
  try {
    const text = await response.clone().text();
    return parseBody(text);
  } catch {
    return undefined;
  }
};

const buildNetworkEvent = (
  request: NetworkRequestData,
  response: NetworkResponseData | undefined,
): RawNetworkEvent => {
  const url = new URL(request.url, window.location.origin);
  return {
    type: 'network',
    id: createEventId(),
    timestamp: Date.now(),
    pathname: url.pathname,
    location: url.pathname + url.search,
    request,
    response,
  };
};

const patchFetch = (emit: (event: RawNetworkEvent) => void): (() => void) => {
  const original = window.fetch;

  window.fetch = async function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const request = new Request(input, init);
    const method = request.method.toUpperCase();

    if (method === 'GET' || method === 'HEAD') {
      return original.call(this, input, init);
    }

    let requestBody: unknown;
    try {
      const text = await request.clone().text();
      requestBody = parseBody(text);
    } catch {
      requestBody = undefined;
    }

    const requestData: NetworkRequestData = {
      url: request.url,
      method: request.method,
      headers: headersToRecord(request.headers),
      body: requestBody,
    };

    const response = await original.call(this, input, init);

    const responseBody = await readResponseBody(response);
    const responseData: NetworkResponseData = {
      status: response.status,
      headers: headersToRecord(response.headers),
      body: responseBody,
    };

    emit(buildNetworkEvent(requestData, responseData));

    return response;
  };

  return () => {
    window.fetch = original;
  };
};

type XHRMeta = {
  method: string;
  url: string;
  headers: Record<string, string>;
};

const xhrMetaMap = new WeakMap<XMLHttpRequest, XHRMeta>();

const patchXHR = (emit: (event: RawNetworkEvent) => void): (() => void) => {
  const OriginalXHR = window.XMLHttpRequest;
  const originalOpen = OriginalXHR.prototype.open;
  const originalSend = OriginalXHR.prototype.send;
  const originalSetRequestHeader = OriginalXHR.prototype.setRequestHeader;

  OriginalXHR.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null,
  ): void {
    xhrMetaMap.set(this, { method, url: String(url), headers: {} });
    return originalOpen.call(this, method, url, async ?? true, username, password);
  };

  OriginalXHR.prototype.setRequestHeader = function patchedSetRequestHeader(
    name: string,
    value: string,
  ): void {
    const meta = xhrMetaMap.get(this);
    if (meta) {
      meta.headers[name.toLowerCase()] = value;
    }
    return originalSetRequestHeader.call(this, name, value);
  };

  OriginalXHR.prototype.send = function patchedSend(
    body?: Document | XMLHttpRequestBodyInit | null,
  ): void {
    const meta = xhrMetaMap.get(this);
    if (!meta) {
      return originalSend.call(this, body);
    }

    const method = meta.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD') {
      return originalSend.call(this, body);
    }

    const resolvedUrl = (() => {
      try {
        return new URL(meta.url, window.location.origin).href;
      } catch {
        return meta.url;
      }
    })();

    const requestData: NetworkRequestData = {
      url: resolvedUrl,
      method: meta.method,
      headers: { ...meta.headers },
      body: typeof body === 'string' ? parseBody(body) : undefined,
    };

    this.addEventListener('load', () => {
      let responseHeaders: Record<string, string> = {};
      try {
        const raw = this.getAllResponseHeaders();
        responseHeaders = raw
          .trim()
          .split(/[\r\n]+/)
          .reduce<Record<string, string>>((acc, line) => {
            const idx = line.indexOf(':');
            if (idx > 0) {
              acc[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
            }
            return acc;
          }, {});
      } catch {
        // ignore header parsing failures
      }

      const responseData: NetworkResponseData = {
        status: this.status,
        headers: responseHeaders,
        body: parseBody(this.responseText),
      };

      emit(buildNetworkEvent(requestData, responseData));
    });

    return originalSend.call(this, body);
  };

  return () => {
    OriginalXHR.prototype.open = originalOpen;
    OriginalXHR.prototype.send = originalSend;
    OriginalXHR.prototype.setRequestHeader = originalSetRequestHeader;
  };
};

export const createNetworkInterceptor = (): NetworkInterceptor => {
  const handlers = new Set<NetworkEventHandler>();

  const emit = (event: RawNetworkEvent): void => {
    for (const handler of handlers) {
      try {
        handler(event);
      } catch {
        // don't let a bad handler break the interceptor
      }
    }
  };

  const restoreFetch = patchFetch(emit);
  const restoreXHR = patchXHR(emit);

  return {
    subscribe: (handler: NetworkEventHandler): (() => void) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    destroy: () => {
      restoreFetch();
      restoreXHR();
      handlers.clear();
    },
  };
};
