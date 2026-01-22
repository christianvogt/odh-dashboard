export type AnalyticsEventType = 'click' | 'submit';

/** ARIA roles that indicate an element is interactive and should be tracked on click */
export const INTERACTIVE_ROLES = [
  'button',
  'link',
  'checkbox',
  'radio',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'tab',
  'switch',
  'treeitem',
  'combobox',
  'listbox',
  'slider',
  'spinbutton',
  'searchbox',
  'textbox',
] as const;

/** Native HTML elements that are interactive by default */
export const INTERACTIVE_ELEMENTS = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'summary',
] as const;

export type A11yPath = {
  /** Element's ARIA role (or implicit role from tag) */
  role: string;
  /** Accessible name (aria-label, aria-labelledby, or textContent) */
  name: string;
  /** Landmark ancestor (main, navigation, banner, contentinfo) */
  landmark?: string;
  /** Nearest region with label */
  region?: string;
  /** Nearest heading text */
  nearestHeading?: string;
  /** Alias for nearestHeading (used in property mapping) */
  heading?: string;
  /** Full semantic path for debugging */
  semanticPath: string;
};

export type BaselinePattern =
  | 'networkRequest'
  | 'buttonClick'
  | 'linkClick'
  | 'tabClick'
  | 'treeItemClick'
  | 'menuAction'
  | 'modalOpen'
  | 'modalClose'
  | 'formComplete'
  | 'formEntry'
  | 'formOutcome'
  | 'stateChange'
  | 'alertAppeared';

export type BaselineEvent = {
  pattern: BaselinePattern;
  stableId: string;
  eventName: string;
  properties: Record<string, unknown>;
};

export type BaseProperties = {
  pathname: string;
  navigationContext?: string[];
};

export type BaselineMatchInfo = {
  pattern: BaselinePattern;
  stableId: string;
  eventName: string;
};

export type CapturedEventInfo = {
  id: string;
  eventName: string;
};

export type AnalyticsPayload = {
  source: string;
  id: string;
  eventName: string;
  payload: Record<string, unknown>;
};

export type RawEventBase = {
  id: string;
  /** Unique log identifier for dev tool list rendering */
  logId?: string;
  timestamp: number;
  pathname: string;
  location: string;
  a11y: A11yPath;
  attributes: Record<string, string>;
  context: Record<string, unknown>;
  urlParams: Record<string, string>;
  baselineMatch?: BaselineMatchInfo;
  capturedEvents?: CapturedEventInfo[];
  analyticsPayloads?: AnalyticsPayload[];
};

export type RawInteractionEvent = RawEventBase & {
  type: 'interaction';
  eventType: AnalyticsEventType;
};

export type NetworkRequestData = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
};

export type NetworkResponseData = {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
};

export type RawNetworkEvent = {
  type: 'network';
  id: string;
  /** Unique log identifier for dev tool list rendering */
  logId?: string;
  timestamp: number;
  pathname: string;
  location: string;
  urlPattern?: string;
  request: NetworkRequestData;
  response?: NetworkResponseData;
  capturedEvents?: CapturedEventInfo[];
  analyticsPayloads?: AnalyticsPayload[];
};

export type RawEvent = RawInteractionEvent | RawNetworkEvent;
