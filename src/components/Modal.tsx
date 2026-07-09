import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

/**
 * Centered dialog (MITHAQ §4.9): dark scrim + blur fades in; the panel enters
 * with a small scale+rise (320ms ease-out-expo) and exits quicker (180ms).
 * Behaviour (Esc to close, backdrop click) is unchanged.
 */
export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'relative z-10 w-full max-w-lg rounded-card bg-surface p-6 shadow-elevated ring-1 ring-line [box-shadow:var(--shadow-elevated),var(--inner-hi)]',
              className,
            )}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { duration: 0.32, ease: EASE_EXPO } }}
            exit={{ opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.18, ease: EASE_EXPO } }}
          >
            {title ? <h2 className="mb-4 pe-8 text-lg font-semibold text-ink">{title}</h2> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute end-4 top-4 grid h-9 w-9 place-items-center rounded-md text-muted transition-colors hover:bg-bg-3 hover:text-ink"
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
