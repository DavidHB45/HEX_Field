import { useState, useEffect } from 'react';
import { Share2, X } from 'lucide-react';
import { C } from '../theme';

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isStandalone(): boolean {
  // navigator.standalone is an Apple extension; cast to avoid TS error
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const DISMISSED_KEY = 'ios-install-prompt-dismissed';

export function IOSInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIOS() && !isStandalone() && !localStorage.getItem(DISMISSED_KEY)) {
      // Small delay so the app shell fully renders first
      const t = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Install app"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: C.navy,
        color: C.white,
        borderTop: `3px solid ${C.red}`,
        padding: '16px 20px env(safe-area-inset-bottom, 16px)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {/* Icon */}
      <Share2
        size={22}
        style={{ flexShrink: 0, marginTop: 2, color: C.cream }}
        aria-hidden
      />

      {/* Message */}
      <p style={{ margin: 0, flex: 1, fontSize: 14, lineHeight: 1.5 }}>
        <strong style={{ display: 'block', marginBottom: 2, fontSize: 15 }}>
          Add to Home Screen
        </strong>
        Tap&nbsp;
        <Share2 size={13} style={{ verticalAlign: 'middle', marginBottom: 1 }} aria-hidden />
        &nbsp;<strong>Share</strong>, then&nbsp;
        <strong>Add to Home&nbsp;Screen</strong> to install the Harris Job Walk app.
      </p>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{
          flexShrink: 0,
          color: C.white,
          opacity: 0.7,
          padding: 4,
          lineHeight: 1,
        }}
      >
        <X size={20} />
      </button>
    </div>
  );
}
