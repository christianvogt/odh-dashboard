const getNavLinkText = (navItem: Element): string => {
  const button = navItem.querySelector(':scope > button.pf-v6-c-nav__link');
  if (button) {
    const textSpan = button.querySelector('.pf-v6-c-nav__link-text');
    return textSpan?.textContent?.trim() ?? '';
  }
  const link = navItem.querySelector(':scope > a.pf-v6-c-nav__link');
  return link?.textContent?.trim() ?? '';
};

export const getNavigationContext = (): string[] => {
  const activeLink = document.querySelector(
    'nav.pf-v6-c-nav a.pf-v6-c-nav__link.pf-m-current',
  );
  if (!activeLink) {
    return [];
  }

  const hierarchy: string[] = [];
  let current: Element | null = activeLink.closest('li.pf-v6-c-nav__item');

  while (current) {
    const text = getNavLinkText(current);
    if (text) {
      hierarchy.unshift(text);
    }

    const parentList = current.parentElement?.closest('li.pf-v6-c-nav__item');
    current = parentList ?? null;
  }

  return hierarchy;
};
