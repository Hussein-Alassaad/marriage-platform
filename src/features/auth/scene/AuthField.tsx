import { useState, type ComponentType } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Eye, EyeOff, type LucideProps } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/utils/cn';
import { AnimatedCheck } from '@/components/motion/AnimatedCheck';

interface AuthFieldProps {
  id: string;
  label: string;
  icon: ComponentType<LucideProps>;
  registration: UseFormRegisterReturn;
  type?: string;
  autoComplete?: string;
  error?: string;
  /** Show the emerald valid-check (field touched, no error, has value). */
  valid?: boolean;
  isPassword?: boolean;
}

/**
 * Dark-glass field (MITHAQ §4.2 for the Threshold): leading icon, focus glow,
 * error shake + coral message, optional password reveal, valid check. Wraps the
 * existing RHF registration — validation/handlers are unchanged.
 */
export function AuthField({
  id,
  label,
  icon: Icon,
  registration,
  type = 'text',
  autoComplete,
  error,
  valid,
  isPassword,
}: AuthFieldProps) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [show, setShow] = useState(false);
  const inputType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink-soft text-[13px] font-medium">
        {label}
      </label>
      <motion.div
        className="group relative"
        animate={error && !reduced ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.32 }}
      >
        <span className="text-muted group-focus-within:text-brand-400 pointer-events-none absolute inset-y-0 z-10 grid w-11 place-items-center transition-colors ltr:left-0 rtl:right-0">
          <Icon className="h-[1.15rem] w-[1.15rem]" aria-hidden />
        </span>
        <input
          id={id}
          type={inputType}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={cn(
            'text-ink h-[52px] w-full rounded-xl border bg-[color-mix(in_srgb,var(--color-ink)_4%,transparent)] ps-11 pe-11 text-[15px]',
            'placeholder:text-faint transition-[border-color,box-shadow] duration-200',
            'hover:border-[color-mix(in_srgb,var(--color-ink)_22%,transparent)] focus:outline-none',
            error
              ? 'border-danger/55 focus:[box-shadow:0_0_0_3px_rgba(229,114,106,0.15)]'
              : valid
                ? 'border-brand-400/40'
                : 'focus:border-brand-400 border-[color-mix(in_srgb,var(--color-ink)_12%,transparent)] focus:[box-shadow:0_0_0_3px_rgba(52,211,153,0.15)]',
          )}
          {...registration}
        />
        <span className="absolute inset-y-0 grid w-11 place-items-center ltr:right-0 rtl:left-0">
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
              className="text-muted hover:text-ink focus-visible:outline-brand-400 pointer-events-auto grid h-8 w-8 place-items-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={show ? 'off' : 'on'}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {show ? (
                    <EyeOff className="h-[1.1rem] w-[1.1rem]" />
                  ) : (
                    <Eye className="h-[1.1rem] w-[1.1rem]" />
                  )}
                </motion.span>
              </AnimatePresence>
            </button>
          ) : valid ? (
            <AnimatedCheck size={18} />
          ) : null}
        </span>
      </motion.div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            key="err"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="text-xs text-[#F0938C]"
          >
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
