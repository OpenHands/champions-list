"use client";

import { useEffect, useRef } from "react";

function AccessibilityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="accessibility-icon">
      <circle cx="12" cy="4.5" r="2.5" fill="currentColor" />
      <path
        fill="currentColor"
        d="M18.5 8.5h-4v-1.4h-5V8.5h-4v2h4V21h2.2v-5h.8L15.6 21H18l-3.3-6.4V10.5h3.8z"
      />
    </svg>
  );
}

interface AccessibilityControlsProps {
  reduceMotion: boolean;
  highContrast: boolean;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  onSetReduceMotion: (value: boolean) => void;
  onSetHighContrast: (value: boolean) => void;
}

export function AccessibilityControls({
  reduceMotion,
  highContrast,
  isOpen,
  onToggleOpen,
  onClose,
  onSetReduceMotion,
  onSetHighContrast,
}: AccessibilityControlsProps) {
  const accessibilityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (target instanceof Node && !accessibilityRef.current?.contains(target)) {
        onClose();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className="accessibility-fab-wrap" ref={accessibilityRef}>
      <button
        type="button"
        className="accessibility-fab accessibility-icon-button"
        onClick={onToggleOpen}
        aria-label="Open accessibility options"
        aria-expanded={isOpen}
      >
        <AccessibilityIcon />
        <span className="sr-only">Accessibility options</span>
      </button>

      {isOpen ? (
        <div className="accessibility-panel">
          <p className="accessibility-panel-title">Accessibility options</p>
          <p className="accessibility-panel-copy">
            Motion honors reduced-motion preferences. Contrast mode increases foreground/background separation and
            removes translucent surfaces for stronger readability.
          </p>

          <label className="accessibility-toggle">
            <input type="checkbox" checked={reduceMotion} onChange={(event) => onSetReduceMotion(event.target.checked)} />
            <span>Pause ticker motion</span>
          </label>

          <label className="accessibility-toggle">
            <input type="checkbox" checked={highContrast} onChange={(event) => onSetHighContrast(event.target.checked)} />
            <span>High contrast palette</span>
          </label>
        </div>
      ) : null}
    </div>
  );
}
