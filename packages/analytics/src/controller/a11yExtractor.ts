import type { A11yPath } from './types';

const LANDMARK_ROLES = new Set([
  'main',
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
]);

const TAG_ROLE_MAP: Record<string, string> = {
  button: 'button',
  a: 'link',
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  aside: 'complementary',
  form: 'form',
  section: 'region',
  dialog: 'dialog',
};

const normalizeText = (text: string | null | undefined): string => {
  if (!text) {
    return '';
  }
  return text.replace(/\s+/g, ' ').trim();
};

const MAX_NAME_LENGTH = 40;

const compactText = (text: string | null | undefined): string => {
  const normalized = normalizeText(text);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= MAX_NAME_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, MAX_NAME_LENGTH - 3).trim()}...`;
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

const getFirstHeading = (element: Element): string => {
  const heading = element.querySelector('h1, h2, h3, h4, h5, h6, [role="heading"]');
  return heading ? normalizeText(heading.textContent) : '';
};

const getAccessibleName = (element: Element, role: string): string => {
  const ariaLabel = compactText(element.getAttribute('aria-label'));
  if (ariaLabel) {
    return ariaLabel;
  }
  const labelledBy = getLabelFromIds(element, element.getAttribute('aria-labelledby'));
  if (labelledBy) {
    return compactText(labelledBy);
  }
  const heading = getFirstHeading(element);
  if (heading) {
    return compactText(heading);
  }
  if (role === 'dialog') {
    return '';
  }
  const placeholder = compactText(element.getAttribute('placeholder'));
  if (placeholder) {
    return placeholder;
  }
  return compactText(element.textContent);
};

const getImplicitRole = (element: Element): string => {
  const tag = element.tagName.toLowerCase();
  if (tag === 'input') {
    const type = element.getAttribute('type')?.toLowerCase();
    if (type === 'checkbox') {
      return 'checkbox';
    }
    if (type === 'radio') {
      return 'radio';
    }
    if (type === 'submit' || type === 'button') {
      return 'button';
    }
    return 'textbox';
  }
  if (tag === 'select') {
    return 'combobox';
  }
  if (tag === 'textarea') {
    return 'textbox';
  }
  return TAG_ROLE_MAP[tag] || tag;
};

const getRole = (element: Element): string => {
  const explicit = element.getAttribute('role');
  if (explicit) {
    return explicit;
  }
  return getImplicitRole(element);
};

const findNearestAncestor = (
  element: Element,
  predicate: (el: Element) => boolean,
): Element | null => {
  let current: Element | null = element;
  while (current) {
    if (predicate(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const getLandmark = (element: Element): string | undefined => {
  const landmarkEl = findNearestAncestor(element, (el) => {
    const role = el.getAttribute('role') || getImplicitRole(el);
    return LANDMARK_ROLES.has(role);
  });
  if (!landmarkEl) {
    return undefined;
  }
  return getRole(landmarkEl);
};

const getRegion = (element: Element): string | undefined => {
  const regionEl = findNearestAncestor(element, (el) => {
    const role = el.getAttribute('role');
    if (role === 'region') {
      return true;
    }
    return el.tagName.toLowerCase() === 'section' && !!el.getAttribute('aria-label');
  });
  if (!regionEl) {
    return undefined;
  }
  return getAccessibleName(regionEl, getRole(regionEl)) || 'region';
};

const getNearestHeading = (element: Element): string | undefined => {
  const headingEl = findNearestAncestor(element, (el) => {
    const tag = el.tagName.toLowerCase();
    if (
      tag === 'h1' ||
      tag === 'h2' ||
      tag === 'h3' ||
      tag === 'h4' ||
      tag === 'h5' ||
      tag === 'h6'
    ) {
      return true;
    }
    return el.getAttribute('role') === 'heading';
  });
  if (!headingEl) {
    return undefined;
  }
  return normalizeText(headingEl.textContent);
};

export const extractA11yPath = (element: Element): A11yPath => {
  const role = getRole(element);
  const name = getAccessibleName(element, role);
  const landmark = getLandmark(element);
  const region = getRegion(element);
  const nearestHeading = getNearestHeading(element);

  const pathParts: string[] = [];
  if (landmark) {
    pathParts.push(landmark);
  }
  if (region) {
    pathParts.push(`region[${region}]`);
  }
  const rolePart = name ? `${role}[${name}]` : role;
  pathParts.push(rolePart);

  return {
    role,
    name,
    landmark,
    region,
    nearestHeading,
    heading: nearestHeading,
    semanticPath: pathParts.join(' > '),
  };
};
