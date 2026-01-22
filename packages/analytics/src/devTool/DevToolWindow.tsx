import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { AnalyticsDevTool } from './AnalyticsDevTool';
import type { RawEvent } from '../controller/types';

const WINDOW_NAME = 'analytics-devtool-window';

type DevToolWindowProps = {
  events: RawEvent[];
  onClose: () => void;
  onClear: () => void;
};

const copyStylesToPopup = (popup: Window): void => {
  // Copy all stylesheets from parent window to popup
  const parentStylesheets = document.querySelectorAll('link[rel="stylesheet"], style');
  parentStylesheets.forEach((node) => {
    popup.document.head.appendChild(node.cloneNode(true));
  });
};

const getPopupHtml = (): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Analytics Dev Tool</title>
  <style>
    html, body, #devtool-root {
      margin: 0;
      padding: 0;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="devtool-root"></div>
</body>
</html>
`;

const openOrReusePopup = (onClose: () => void): Window | null => {
  // Try to reuse existing popup
  const existingPopup = window.open('', WINDOW_NAME);
  if (existingPopup?.document.getElementById('devtool-root')) {
    existingPopup.focus();
    return existingPopup;
  }

  // Open new popup
  const popup = window.open(
    '',
    WINDOW_NAME,
    'width=1024,height=768,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes',
  );

  if (!popup) {
    // eslint-disable-next-line no-console
    console.warn('Analytics DevTool popup was blocked. Please allow popups for this site.');
    onClose();
    return null;
  }

  popup.document.write(getPopupHtml());
  popup.document.close();
  copyStylesToPopup(popup);

  return popup;
};

export const DevToolWindow: React.FC<DevToolWindowProps> = ({ events, onClose, onClear }) => {
  const popupRef = React.useRef<Window | null>(null);
  const rootRef = React.useRef<Root | null>(null);

  // Open popup window on mount
  React.useEffect(() => {
    const popup = openOrReusePopup(onClose);
    if (!popup) {
      return undefined;
    }

    popupRef.current = popup;

    // Create React root in popup
    const container = popup.document.getElementById('devtool-root');
    if (container && !rootRef.current) {
      rootRef.current = createRoot(container);
    }

    // Handle popup close
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        onClose();
      }
    }, 500);

    return () => {
      clearInterval(checkClosed);
    };
  }, [onClose]);

  // Render into popup whenever events change
  React.useEffect(() => {
    if (rootRef.current && popupRef.current && !popupRef.current.closed) {
      rootRef.current.render(
        <AnalyticsDevTool events={events} onClear={onClear} onClose={onClose} />,
      );
    }
  }, [events, onClear, onClose]);

  // Cleanup on unmount
  React.useEffect(
    () => () => {
      rootRef.current?.unmount();
      rootRef.current = null;
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    },
    [],
  );

  return null;
};
