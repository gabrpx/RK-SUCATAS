// Wrapper estilizado do Accordion Radix animado — tokens do design system.
import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../../utils';
import {
  Accordion as AccordionPrimitive,
  AccordionItem as AccordionItemPrimitive,
  AccordionTrigger as AccordionTriggerPrimitive,
  AccordionContent as AccordionContentPrimitive,
  type AccordionProps as AccordionPrimitiveProps,
  type AccordionItemProps as AccordionItemPrimitiveProps,
  type AccordionTriggerProps as AccordionTriggerPrimitiveProps,
  type AccordionContentProps as AccordionContentPrimitiveProps,
} from '../../primitives/radix/accordion';

type AccordionProps = AccordionPrimitiveProps;

function Accordion({ className, ...props }: AccordionProps & { className?: string }) {
  return <AccordionPrimitive className={cn('divide-y divide-border-subtle', className)} {...(props as any)} />;
}

type AccordionItemProps = AccordionItemPrimitiveProps;

function AccordionItem({ className, ...props }: AccordionItemProps & { className?: string }) {
  return (
    <AccordionItemPrimitive
      className={cn('border-b border-border-subtle last:border-b-0', className)}
      {...props}
    />
  );
}

type AccordionTriggerProps = AccordionTriggerPrimitiveProps & {
  chevronClassName?: string;
};

function AccordionTrigger({ className, children, chevronClassName, ...props }: AccordionTriggerProps & { className?: string }) {
  return (
    <AccordionTriggerPrimitive
      className={cn(
        'flex w-full items-center justify-between gap-2 py-3 px-4',
        'text-sm font-medium text-text-primary',
        'hover:bg-surface-raised transition-colors',
        'group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        size={14}
        className={cn(
          'shrink-0 text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180',
          chevronClassName
        )}
      />
    </AccordionTriggerPrimitive>
  );
}

type AccordionContentProps = AccordionContentPrimitiveProps;

function AccordionContent({ className, children, ...props }: AccordionContentProps & { className?: string }) {
  return (
    <AccordionContentPrimitive {...props}>
      <div className={cn('px-4 pb-3', className)}>{children}</div>
    </AccordionContentPrimitive>
  );
}

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionContentProps,
};
