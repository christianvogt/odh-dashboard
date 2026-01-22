import type { BaselineEvent } from './types';
import {
  getAreaPath,
  getFirstHeading,
  normalizeText,
  compactText,
  slugify,
  MAX_ELEMENT_SLUG_LENGTH,
  getStableId,
  buildBaselineEventName,
} from './baselineDetector';

type FormState = {
  addedAt: number;
  entryEmitted: boolean;
  submitted: boolean;
  submitAt?: number;
  cancelled: boolean;
  networkSuccess?: boolean;
  outcomeEmitted: boolean;
  formName: string;
  areaPath: string[];
  area: string;
};

type WizardEntry = {
  state: FormState;
  currentForm: HTMLFormElement | null;
};

type FormTrackerOptions = {
  onFormEvent: (event: BaselineEvent) => void;
};

const SUBMIT_NETWORK_WINDOW_MS = 10_000;
const WIZARD_SELECTOR = '.pf-v6-c-wizard';

const LANDMARK_ROLES = new Set([
  'main',
  'navigation',
  'banner',
  'contentinfo',
  'complementary',
  'search',
]);
const LANDMARK_TAGS = new Set(['main', 'nav', 'header', 'footer', 'aside']);

const findNearestLandmark = (element: Element): Element | null => {
  let current: Element | null = element.parentElement;
  while (current) {
    const role = current.getAttribute('role');
    if (role && LANDMARK_ROLES.has(role)) {
      return current;
    }
    const tag = current.tagName.toLowerCase();
    if (LANDMARK_TAGS.has(tag)) {
      return current;
    }
    if (role === 'dialog' || tag === 'dialog') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
};

const getDirectLabel = (element: Element): string => {
  const ariaLabel = compactText(element.getAttribute('aria-label'));
  if (ariaLabel) {
    return ariaLabel;
  }
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const doc = element.ownerDocument;
    const text = labelledBy
      .split(/\s+/)
      .filter((id) => id !== element.id)
      .map((id) => normalizeText(doc.getElementById(id)?.textContent))
      .filter(Boolean)
      .join(' ');
    if (text) {
      return compactText(text);
    }
  }
  return '';
};

const getFormName = (form: HTMLFormElement): string => {
  const directLabel = getDirectLabel(form);
  if (directLabel) {
    return directLabel;
  }

  const dialog = form.closest('[role="dialog"]');
  if (dialog) {
    const dialogLabel = getDirectLabel(dialog);
    if (dialogLabel) {
      return dialogLabel;
    }
    const dialogHeading = getFirstHeading(dialog);
    if (dialogHeading) {
      return dialogHeading;
    }
  }

  const landmark = findNearestLandmark(form);
  if (landmark) {
    const landmarkLabel = getDirectLabel(landmark);
    if (landmarkLabel) {
      return landmarkLabel;
    }
    const landmarkHeading = getFirstHeading(landmark);
    if (landmarkHeading) {
      return landmarkHeading;
    }
  }

  const testId = form.getAttribute('data-testid');
  if (testId) {
    return testId;
  }

  if (form.id) {
    return form.id;
  }

  return 'unknown';
};

const getWizardName = (wizard: Element): string => {
  const titleEl = wizard.querySelector('.pf-v6-c-wizard__title-text');
  if (titleEl?.textContent?.trim()) {
    return normalizeText(titleEl.textContent);
  }

  const wizardLabel = getDirectLabel(wizard);
  if (wizardLabel) {
    return wizardLabel;
  }

  const dialog = wizard.closest('[role="dialog"]');
  if (dialog) {
    const dialogLabel = getDirectLabel(dialog);
    if (dialogLabel) {
      return dialogLabel;
    }
    const dialogHeading = getFirstHeading(dialog);
    if (dialogHeading) {
      return dialogHeading;
    }
  }

  const landmark = findNearestLandmark(wizard);
  if (landmark) {
    const landmarkLabel = getDirectLabel(landmark);
    if (landmarkLabel) {
      return landmarkLabel;
    }
    const landmarkHeading = getFirstHeading(landmark);
    if (landmarkHeading) {
      return landmarkHeading;
    }
  }

  return 'wizard';
};

const getAreaFromPath = (areaPath: string[]): string => {
  for (let i = areaPath.length - 1; i >= 0; i--) {
    if (!areaPath[i].includes('[')) {
      return areaPath[i];
    }
  }
  return 'unknown';
};

const isCancelOrClose = (element: Element): boolean => {
  const name = normalizeText(
    element.getAttribute('aria-label') || element.textContent,
  ).toLowerCase();
  return name.includes('cancel') || name === 'close';
};

const scanForForms = (root: Node): HTMLFormElement[] => {
  const forms: HTMLFormElement[] = [];
  if (root instanceof HTMLFormElement) {
    forms.push(root);
  }
  if (root instanceof Element) {
    forms.push(...Array.from(root.querySelectorAll<HTMLFormElement>('form')));
  }
  return forms;
};

const createFormState = (
  element: Element,
  formName: string,
): FormState => {
  const areaPath = getAreaPath(element);
  return {
    addedAt: Date.now(),
    entryEmitted: false,
    submitted: false,
    cancelled: false,
    networkSuccess: undefined,
    outcomeEmitted: false,
    formName,
    areaPath,
    area: getAreaFromPath(areaPath),
  };
};

const emitOutcome = (
  state: FormState,
  onFormEvent: (event: BaselineEvent) => void,
): void => {
  if (state.outcomeEmitted) {
    return;
  }

  if (!state.entryEmitted && !state.submitted && !state.cancelled) {
    return;
  }

  const duration = Date.now() - state.addedAt;

  let outcome: string;
  if (state.submitted && state.networkSuccess === true) {
    outcome = 'success';
  } else if (state.submitted && state.networkSuccess === false) {
    outcome = 'failure';
  } else if (state.submitted) {
    outcome = 'submitted';
  } else if (state.cancelled) {
    outcome = 'cancelled';
  } else {
    outcome = 'abandoned';
  }

  state.outcomeEmitted = true;

  const slugName = slugify(state.formName, MAX_ELEMENT_SLUG_LENGTH);

  onFormEvent({
    pattern: 'formOutcome',
    stableId: getStableId('formOutcome', state.area, slugName),
    eventName: buildBaselineEventName('formOutcome', state.area, slugName),
    properties: {
      interactionType: 'formOutcome',
      elementName: slugName,
      area: state.areaPath,
      outcome,
      duration,
      interacted: state.entryEmitted,
    },
  });
};

const emitEntry = (
  state: FormState,
  onFormEvent: (event: BaselineEvent) => void,
): void => {
  if (state.entryEmitted) {
    return;
  }
  state.entryEmitted = true;

  const slugName = slugify(state.formName, MAX_ELEMENT_SLUG_LENGTH);

  onFormEvent({
    pattern: 'formEntry',
    stableId: getStableId('formEntry', state.area, slugName),
    eventName: buildBaselineEventName('formEntry', state.area, slugName),
    properties: {
      interactionType: 'formEntry',
      elementName: slugName,
      area: state.areaPath,
    },
  });
};

export const createFormTracker = ({ onFormEvent }: FormTrackerOptions) => {
  const activeForms = new Map<HTMLFormElement, FormState>();
  const wizardForms = new Map<Element, WizardEntry>();
  const pendingFinalizations = new Map<FormState, ReturnType<typeof setTimeout>>();
  let observer: MutationObserver | null = null;

  const resolvePending = (state: FormState): void => {
    const timeoutId = pendingFinalizations.get(state);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      pendingFinalizations.delete(state);
      emitOutcome(state, onFormEvent);
    }
  };

  const registerForm = (form: HTMLFormElement): void => {
    const wizard = form.closest(WIZARD_SELECTOR);

    if (wizard) {
      const existing = wizardForms.get(wizard);
      if (existing) {
        existing.currentForm = form;
        return;
      }
      const state = createFormState(wizard, getWizardName(wizard));
      wizardForms.set(wizard, { state, currentForm: form });
      emitEntry(state, onFormEvent);
      return;
    }

    if (activeForms.has(form)) {
      return;
    }

    const formName = getFormName(form);

    // When React replaces the <form> DOM element during a re-render (e.g.,
    // loading state after clicking a submit button), the MutationObserver sees
    // a new element. If the previous element's state is still in activeForms
    // (disconnected) or was already deferred to pendingFinalizations, adopt it
    // instead of creating a duplicate state.
    for (const [existingForm, existingState] of activeForms) {
      if (existingForm !== form && existingState.formName === formName && !existingForm.isConnected) {
        activeForms.delete(existingForm);
        activeForms.set(form, existingState);
        return;
      }
    }
    for (const [pendingState, timeoutId] of pendingFinalizations) {
      if (pendingState.formName === formName) {
        clearTimeout(timeoutId);
        pendingFinalizations.delete(pendingState);
        activeForms.set(form, pendingState);
        return;
      }
    }

    activeForms.set(form, createFormState(form, formName));
  };

  const finalizeForm = (form: HTMLFormElement): void => {
    const state = activeForms.get(form);
    if (!state) {
      return;
    }
    activeForms.delete(form);

    // When submitted but awaiting a network outcome, defer emission so the
    // network response can be correlated. The form DOM element is often removed
    // before the response arrives (React re-renders the modal during the API
    // call, replacing or unmounting the <form>).
    if (
      state.submitted &&
      state.networkSuccess === undefined &&
      state.submitAt !== undefined
    ) {
      const remaining = SUBMIT_NETWORK_WINDOW_MS - (Date.now() - state.submitAt);
      if (remaining > 0) {
        const timeoutId = setTimeout(() => {
          pendingFinalizations.delete(state);
          emitOutcome(state, onFormEvent);
        }, remaining);
        pendingFinalizations.set(state, timeoutId);
        return;
      }
    }

    emitOutcome(state, onFormEvent);
  };

  const finalizeWizard = (wizard: Element): void => {
    const entry = wizardForms.get(wizard);
    if (!entry) {
      return;
    }
    wizardForms.delete(wizard);
    emitOutcome(entry.state, onFormEvent);
  };

  const checkRemovedForms = (): void => {
    for (const form of activeForms.keys()) {
      if (!form.isConnected) {
        finalizeForm(form);
      }
    }
    for (const [wizard, entry] of wizardForms) {
      if (!wizard.isConnected) {
        finalizeWizard(wizard);
      } else if (entry.currentForm && !entry.currentForm.isConnected) {
        entry.currentForm = null;
      }
    }
  };

  const start = (): void => {
    document.querySelectorAll<HTMLFormElement>('form').forEach(registerForm);

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          for (const form of scanForForms(node)) {
            registerForm(form);
          }
        }
        if (mutation.removedNodes.length > 0) {
          checkRemovedForms();
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
    for (const form of Array.from(activeForms.keys())) {
      if (!form.isConnected) {
        finalizeForm(form);
      }
    }
    for (const [wizard] of Array.from(wizardForms)) {
      if (!wizard.isConnected) {
        finalizeWizard(wizard);
      }
    }
    for (const [state, timeoutId] of pendingFinalizations) {
      clearTimeout(timeoutId);
      emitOutcome(state, onFormEvent);
    }
    pendingFinalizations.clear();
    activeForms.clear();
    wizardForms.clear();
  };

  const findWizardState = (element: Element): FormState | null => {
    const wizard = element.closest(WIZARD_SELECTOR);
    if (!wizard) {
      return null;
    }
    return wizardForms.get(wizard)?.state ?? null;
  };

  const notifyInteraction = (element: Element): void => {
    const isButton =
      element.getAttribute('role') === 'button' || element.tagName === 'BUTTON';

    if (isButton && isCancelOrClose(element)) {
      const form = element.closest('form') as HTMLFormElement | null;
      if (form) {
        const wizardState = findWizardState(form);
        if (wizardState) {
          wizardState.cancelled = true;
        } else {
          const state = activeForms.get(form);
          if (state) {
            state.cancelled = true;
          }
        }
      } else {
        const wizardState = findWizardState(element);
        if (wizardState) {
          wizardState.cancelled = true;
        } else {
          for (const state of activeForms.values()) {
            state.cancelled = true;
          }
        }
      }
    }

    const wizardState = findWizardState(element);
    if (wizardState) {
      emitEntry(wizardState, onFormEvent);
      return;
    }

    const form = element.closest('form') as HTMLFormElement | null;
    if (form) {
      const state = activeForms.get(form);
      if (state) {
        emitEntry(state, onFormEvent);
      }
      return;
    }

    // The element is not inside a <form>. In PatternFly modals, action buttons
    // ("Create", "Update", "Save") live in the modal footer outside the <form>.
    // If this is a non-cancel/close button inside a dialog that contains a
    // tracked form, treat it as a form submission signal so that the subsequent
    // network outcome can be correlated.
    if (isButton && !isCancelOrClose(element)) {
      const dialog = element.closest('[role="dialog"]');
      if (dialog) {
        for (const [trackedForm, state] of activeForms) {
          if (dialog.contains(trackedForm) && !state.submitted) {
            emitEntry(state, onFormEvent);
            state.submitted = true;
            state.submitAt = Date.now();
            break;
          }
        }
      }
    }
  };

  const notifySubmit = (form: HTMLFormElement): void => {
    const wizardState = findWizardState(form);
    if (wizardState) {
      wizardState.submitted = true;
      wizardState.submitAt = Date.now();
      return;
    }

    const state = activeForms.get(form);
    if (!state) {
      return;
    }
    state.submitted = true;
    state.submitAt = Date.now();
  };

  const notifyNetworkOutcome = (networkOutcome: 'success' | 'failure'): void => {
    const now = Date.now();
    const applyOutcome = (state: FormState): boolean => {
      if (
        state.submitted &&
        state.submitAt !== undefined &&
        state.networkSuccess === undefined &&
        now - state.submitAt < SUBMIT_NETWORK_WINDOW_MS
      ) {
        state.networkSuccess = networkOutcome === 'success';
        return true;
      }
      return false;
    };
    for (const state of activeForms.values()) {
      applyOutcome(state);
    }
    for (const entry of wizardForms.values()) {
      applyOutcome(entry.state);
    }
    // Resolve deferred finalizations whose forms were unmounted before this
    // network response arrived.
    for (const [state] of pendingFinalizations) {
      if (applyOutcome(state)) {
        resolvePending(state);
      }
    }
  };

  return { start, stop, notifyInteraction, notifySubmit, notifyNetworkOutcome };
};

export type FormTracker = ReturnType<typeof createFormTracker>;
