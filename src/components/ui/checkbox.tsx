// src/components/ui/checkbox.tsx
// Checkbox animado — radix-ui + motion, mesmo padrão de switch.tsx (ver nota
// na Task 1 do plano de componentes animados do Estoque sobre por que não é
// o pacote @animate-ui/components-radix-checkbox).
import type { ComponentProps } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '../../utils';
import { SPRING_MICRO } from './motion';

function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer flex size-5 shrink-0 items-center justify-center rounded-[5px] border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=unchecked]:bg-surface-inset data-[state=unchecked]:border-border-default',
        'focus-visible:ring-[3px] focus-visible:ring-accent/30',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator asChild forceMount>
        <AnimatePresence>
          {props.checked && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={SPRING_MICRO}
              className="flex items-center justify-center text-white"
            >
              <Check size={13} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
