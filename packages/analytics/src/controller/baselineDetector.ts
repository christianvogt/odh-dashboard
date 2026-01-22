import type { A11yPath, AnalyticsEventType, BaselineEvent, BaselinePattern } from './types';

type ContextValues = Record<string, unknown[]>;

type BaselineDetectionInput = {
  element: Element;
  eventType: AnalyticsEventType;
  a11y: A11yPath;
  context: ContextValues;
};

const CONTEXT_ROLES = new Set([
  'main',
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
  'region',
  'dialog',
  'form',
  'table',
  'tablist',
  'tab',
  'toolbar',
  'wizard',
]);

const CSS_CLASS_ROLE_MAP: Record<string, string> = {
  'pf-v6-c-wizard': 'wizard',
};

const OUIA_CONTEXT_TYPES = new Set([
  'Toolbar',
  'Card',
  'Modal',
  'ModalContent',
  'Table',
  'Tabs',
  'Navigation',
  'Pagination',
  'Drawer',
]);

const TAG_ROLE_MAP: Record<string, string> = {
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  section: 'region',
  dialog: 'dialog',
  form: 'form',
  table: 'table',
};

export const MAX_ELEMENT_SLUG_LENGTH = 40;

const capSlug = (value: string, maxLength?: number): string => {
  if (!maxLength || value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength);
};

export const slugify = (value: string, maxLength?: number): string => {
  const slug =
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unknown';
  return capSlug(slug, maxLength);
};

export const buildBaselineEventName = (
  pattern: BaselinePattern,
  area: string,
  elementName: string,
): string => {
  const areaSlug = slugify(area);
  const elementSlug = slugify(elementName, MAX_ELEMENT_SLUG_LENGTH);
  return `${pattern}.${areaSlug}.${elementSlug}`;
};

const getContextValue = (context: ContextValues, key: string): string | undefined => {
  if (!(key in context)) {
    return undefined;
  }
  const value = context[key][0];
  return typeof value === 'string' ? value : undefined;
};

const getAreaFromAreaPath = (areaPath: string[], context: ContextValues): string => {
  const contextArea = getContextValue(context, 'area');
  if (contextArea) {
    return contextArea;
  }
  for (let i = areaPath.length - 1; i >= 0; i--) {
    const token = areaPath[i];
    if (!token.includes('[')) {
      return token;
    }
  }
  return 'unknown';
};

export const normalizeText = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }
  return value.replace(/\s+/g, ' ').trim();
};

const MAX_LABEL_LENGTH = 60;

export const compactText = (value: string | null | undefined): string => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= MAX_LABEL_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_LABEL_LENGTH - 3).trim()}...`;
};

const getLabelFromIds = (element: Element, ids: string | null): string => {
  if (!ids) {
    return '';
  }
  const doc = element.ownerDocument;
  return ids
    .split(/\s+/)
    .filter((id) => id !== element.id)
    .map((id) => normalizeText(doc.getElementById(id)?.textContent))
    .filter(Boolean)
    .join(' ');
};

const HEADING_BOUNDARY_ROLES = new Set([
  'alert',
  'alertdialog',
  'dialog',
  'form',
  'table',
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
]);

const HEADING_BOUNDARY_TAGS = new Set(['nav', 'aside', 'dialog', 'form', 'table']);

const HEADING_BOUNDARY_OUIA_TYPES = new Set(['Alert', 'Card', 'Modal', 'ModalContent', 'Table']);

const isBoundaryElement = (el: Element): boolean => {
  const role = el.getAttribute('role');
  if (role && HEADING_BOUNDARY_ROLES.has(role)) {
    return true;
  }
  if (HEADING_BOUNDARY_TAGS.has(el.tagName.toLowerCase())) {
    return true;
  }
  const ouia = el.getAttribute('data-ouia-component-type');
  if (ouia) {
    const name = ouia.replace(/^PF\d+\//, '');
    if (HEADING_BOUNDARY_OUIA_TYPES.has(name)) {
      return true;
    }
  }
  return false;
};

const isInsideBoundary = (descendant: Element, root: Element): boolean => {
  let current = descendant.parentElement;
  while (current && current !== root) {
    if (isBoundaryElement(current)) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
};

export const getFirstHeading = (element: Element): string => {
  const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
  for (const heading of headings) {
    if (!isInsideBoundary(heading, element)) {
      return normalizeText(heading.textContent);
    }
  }
  return '';
};

const getDirectLabel = (element: Element): string => {
  const ariaLabel = compactText(element.getAttribute('aria-label'));
  if (ariaLabel) {
    return ariaLabel;
  }
  const labelledBy = getLabelFromIds(element, element.getAttribute('aria-labelledby'));
  if (labelledBy) {
    return compactText(labelledBy);
  }
  return '';
};

export const getContextLabel = (element: Element): string => {
  const direct = getDirectLabel(element);
  if (direct) {
    return direct;
  }
  const heading = getFirstHeading(element);
  if (heading) {
    return compactText(heading);
  }
  return '';
};

const getContextRole = (element: Element): string | null => {
  const explicitRole = element.getAttribute('role');
  if (explicitRole && CONTEXT_ROLES.has(explicitRole)) {
    return explicitRole;
  }
  const tag = element.tagName.toLowerCase();
  const implicitRole = TAG_ROLE_MAP[tag];
  if (implicitRole && CONTEXT_ROLES.has(implicitRole)) {
    return implicitRole;
  }
  for (const [cls, role] of Object.entries(CSS_CLASS_ROLE_MAP)) {
    if (element.classList.contains(cls)) {
      return role;
    }
  }
  return null;
};

const getOuiaContextType = (element: Element): string | null => {
  const ouiaType = element.getAttribute('data-ouia-component-type');
  if (!ouiaType) {
    return null;
  }
  const componentName = ouiaType.replace(/^PF\d+\//, '');
  return OUIA_CONTEXT_TYPES.has(componentName) ? componentName.toLowerCase() : null;
};

const buildContextTokens = (element: Element): string[] => {
  const role = getContextRole(element);
  const ouiaType = getOuiaContextType(element);
  const contextKey = role ?? ouiaType;
  if (!contextKey) {
    return [];
  }
  const tokens = [contextKey];
  const label =
    role === 'form'
      ? getDirectLabel(element) || getContextLabel(element)
      : getContextLabel(element);
  if (label) {
    tokens.push(`${contextKey}[name=${label}]`);
  }
  const id = normalizeText(element.getAttribute('id'));
  if (id) {
    tokens.push(`${contextKey}[id=${id}]`);
  }
  const testId = normalizeText(element.getAttribute('data-testid'));
  if (testId) {
    tokens.push(`${contextKey}[data-testid=${testId}]`);
  }
  return tokens;
};

export const getAreaPath = (element: Element): string[] => {
  const segments: string[][] = [];
  let current: Element | null = element;
  while (current) {
    const tokens = buildContextTokens(current);
    if (tokens.length > 0) {
      segments.push(tokens);
    }
    current = current.parentElement;
  }
  return segments.reverse().flat();
};

export const getStableId = (
  pattern: BaselinePattern,
  region: string,
  elementName: string,
): string =>
  `baseline.${pattern}.${slugify(region)}.${slugify(elementName, MAX_ELEMENT_SLUG_LENGTH)}`;

const findClosest = (element: Element, selector: string): Element | null =>
  element.closest(selector);

const isTooltipLikeElement = (element: Element): boolean =>
  element.classList.contains('pf-v6-c-popover') ||
  element.classList.contains('pf-v6-c-tooltip') ||
  element.hasAttribute('data-popper-placement') ||
  element.hasAttribute('data-popper-reference-hidden');

type OpenerKind = 'menu' | 'select' | 'popover';

type OpenerRule = {
  kind: OpenerKind;
  test: (element: Element, a11y: A11yPath) => boolean;
};

type FollowUpRule = {
  kind: OpenerKind;
  test: (a11y: A11yPath) => boolean;
};

const OPENER_RULES: OpenerRule[] = [
  {
    kind: 'menu',
    test: (element) =>
      element.getAttribute('aria-haspopup') === 'menu' ||
      element.getAttribute('aria-haspopup') === 'listbox' ||
      element.getAttribute('data-ouia-component-type') === 'PF6/MenuToggle',
  },
  {
    kind: 'select',
    test: (element) =>
      element.getAttribute('data-ouia-component-type') === 'PF6/Select' ||
      element.getAttribute('data-ouia-component-type') === 'PF6/Dropdown',
  },
];

const FOLLOW_UP_RULES: FollowUpRule[] = [
  {
    kind: 'menu',
    test: (a11y) =>
      a11y.role === 'menuitem' ||
      a11y.role === 'menuitemcheckbox' ||
      a11y.role === 'menuitemradio' ||
      a11y.role === 'option',
  },
  {
    kind: 'select',
    test: (a11y) => a11y.role === 'option',
  },
];

const matchOpener = (element: Element, a11y: A11yPath): OpenerKind | null => {
  if (a11y.role !== 'button') {
    return null;
  }
  for (const rule of OPENER_RULES) {
    if (rule.test(element, a11y)) {
      return rule.kind;
    }
  }
  return null;
};

const matchFollowUp = (a11y: A11yPath): OpenerKind | null => {
  for (const rule of FOLLOW_UP_RULES) {
    if (rule.test(a11y)) {
      return rule.kind;
    }
  }
  return null;
};

const isModalClose = (element: Element, a11y: A11yPath): boolean => {
  const modalRoot = findClosest(element, '.pf-v5-c-modal-box,[role="dialog"]');
  if (!modalRoot || isTooltipLikeElement(modalRoot) || a11y.role !== 'button') {
    return false;
  }
  const label = a11y.name.toLowerCase();
  return (
    label.includes('close') ||
    label.includes('cancel') ||
    element.getAttribute('aria-label') === 'Close'
  );
};

const isModalOpen = (element: Element, a11y: A11yPath): boolean =>
  !isTooltipLikeElement(element) &&
  (a11y.role === 'dialog' ||
    element.getAttribute('aria-modal') === 'true' ||
    element.getAttribute('aria-haspopup') === 'dialog' ||
    element.getAttribute('data-ouia-component-type')?.toLowerCase().includes('modal') === true);

const getFormElement = (element: Element): HTMLFormElement | null => element.closest('form');

const isLinkClick = (a11y: A11yPath): boolean => a11y.role === 'link';

const isButtonClick = (a11y: A11yPath): boolean => a11y.role === 'button';

const isTabClick = (a11y: A11yPath): boolean => a11y.role === 'tab';

const isTreeItemClick = (a11y: A11yPath): boolean => a11y.role === 'treeitem';

const STATE_CHANGE_ROLES = new Set(['checkbox', 'radio', 'switch']);

const isStateChange = (a11y: A11yPath): boolean => STATE_CHANGE_ROLES.has(a11y.role);

type PendingOpener = {
  kind: OpenerKind;
  openerName: string;
  areaPath: string[];
  area: string;
  timestamp: number;
};

const OPENER_EXPIRY_MS = 10_000;

export const createBaselineTracker = () => {
  let pendingOpener: PendingOpener | null = null;

  const consumeOpener = (
    followUpKind: OpenerKind,
    fallbackArea: string,
    fallbackAreaPath: string[],
  ): { openerName: string; area: string; areaPath: string[] } => {
    const opener = pendingOpener;
    pendingOpener = null;

    if (
      !opener ||
      opener.kind !== followUpKind ||
      Date.now() - opener.timestamp > OPENER_EXPIRY_MS
    ) {
      return { openerName: 'unknown', area: fallbackArea, areaPath: fallbackAreaPath };
    }
    return { openerName: opener.openerName, area: opener.area, areaPath: opener.areaPath };
  };

  return ({ element, eventType, a11y, context }: BaselineDetectionInput): BaselineEvent | null => {
    const elementName = a11y.name || a11y.role || 'unknown';
    const areaPath = getAreaPath(element);
    const area = getAreaFromAreaPath(areaPath, context);

    if (eventType === 'submit') {
      const form = getFormElement(element);
      if (form) {
        return {
          pattern: 'formComplete',
          stableId: getStableId('formComplete', area, elementName),
          eventName: buildBaselineEventName('formComplete', area, elementName),
          properties: {
            interactionType: 'formComplete',
            elementName,
            area: areaPath,
            outcome: 'submitted',
          },
        };
      }
    }

    if (eventType === 'click') {
      if (isModalClose(element, a11y)) {
        return {
          pattern: 'modalClose',
          stableId: getStableId('modalClose', area, elementName),
          eventName: buildBaselineEventName('modalClose', area, elementName),
          properties: {
            interactionType: 'modalClose',
            elementName,
            area: areaPath,
            outcome: 'cancelled',
          },
        };
      }
      if (isModalOpen(element, a11y)) {
        return {
          pattern: 'modalOpen',
          stableId: getStableId('modalOpen', area, elementName),
          eventName: buildBaselineEventName('modalOpen', area, elementName),
          properties: {
            interactionType: 'modalOpen',
            elementName,
            area: areaPath,
          },
        };
      }

      const openerKind = matchOpener(element, a11y);
      if (openerKind) {
        pendingOpener = {
          kind: openerKind,
          openerName: elementName,
          areaPath,
          area,
          timestamp: Date.now(),
        };
        return null;
      }

      const followUpKind = matchFollowUp(a11y);
      if (followUpKind) {
        const opener = consumeOpener(followUpKind, area, areaPath);
        return {
          pattern: 'menuAction',
          stableId: getStableId('menuAction', opener.area, elementName),
          eventName: buildBaselineEventName('menuAction', opener.area, elementName),
          properties: {
            interactionType: 'menuAction',
            elementName,
            openerName: opener.openerName,
            area: opener.areaPath,
          },
        };
      }

      if (isLinkClick(a11y)) {
        return {
          pattern: 'linkClick',
          stableId: getStableId('linkClick', area, elementName),
          eventName: buildBaselineEventName('linkClick', area, elementName),
          properties: {
            interactionType: 'linkClick',
            elementName,
            area: areaPath,
          },
        };
      }
      if (isButtonClick(a11y)) {
        return {
          pattern: 'buttonClick',
          stableId: getStableId('buttonClick', area, elementName),
          eventName: buildBaselineEventName('buttonClick', area, elementName),
          properties: {
            interactionType: 'buttonClick',
            elementName,
            area: areaPath,
          },
        };
      }
      if (isTabClick(a11y)) {
        return {
          pattern: 'tabClick',
          stableId: getStableId('tabClick', area, elementName),
          eventName: buildBaselineEventName('tabClick', area, elementName),
          properties: {
            interactionType: 'tabClick',
            elementName,
            area: areaPath,
          },
        };
      }
      if (isTreeItemClick(a11y)) {
        return {
          pattern: 'treeItemClick',
          stableId: getStableId('treeItemClick', area, elementName),
          eventName: buildBaselineEventName('treeItemClick', area, elementName),
          properties: {
            interactionType: 'treeItemClick',
            elementName,
            area: areaPath,
          },
        };
      }
      if (isStateChange(a11y)) {
        return {
          pattern: 'stateChange',
          stableId: getStableId('stateChange', area, elementName),
          eventName: buildBaselineEventName('stateChange', area, elementName),
          properties: {
            interactionType: 'stateChange',
            elementName,
            elementRole: a11y.role,
            area: areaPath,
          },
        };
      }
    }

    return null;
  };
};
