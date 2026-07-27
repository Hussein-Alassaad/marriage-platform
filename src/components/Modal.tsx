import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

import { cn } from '@/utils/cn';
import { EASE_EXPO } from '@/lib/motion';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Centered dialog (MITHAQ §4.9): dark scrim + blur fades in; the panel enters
 * with a small scale+rise (320ms ease-out-expo) and exits quicker (180ms).
 * Behaviour (Esc to close, backdrop click) is unchanged.
 *
 * Focus is trapped inside while open (Tab/Shift+Tab cannot reach the page
 * behind the scrim) and returns to whatever triggered the modal on close —
 * without this a keyboard or screen-reader user can tab straight through a
 * modal that is still visually covering the page.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const { t } = useTranslation();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    // Move focus into the dialog once it has mounted (next paint).
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel).focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-[rgba(4,9,7,0.62)] backdrop-blur-md"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? t('common.dialog')}
            tabIndex={-1}
            className={cn(
              'rounded-card bg-surface shadow-elevated ring-line relative z-10 w-full max-w-lg p-6 ring-1 [box-shadow:var(--shadow-elevated),var(--inner-hi)] focus:outline-none',
              className,
            )}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.32, ease: EASE_EXPO },
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: 12,
              transition: { duration: 0.18, ease: EASE_EXPO },
            }}
          >
            {title ? <h2 className="text-ink mb-4 pe-8 text-lg font-semibold">{title}</h2> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="text-muted hover:bg-bg-3 hover:text-ink absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-md transition-colors"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            {children}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
