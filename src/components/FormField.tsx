import { type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

/**
 * Labelled field wrapper (MITHAQ §4.2). When an error appears, the control
 * shakes briefly and a coral message slides down + fades in. Reduced motion
 * skips the shake. Field composition/validation is owned by the caller.
 */
export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  const reduced = useReducedMotion();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      <motion.div
        animate={error && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.32 }}
      >
        {children}
      </motion.div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="text-xs text-danger"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
