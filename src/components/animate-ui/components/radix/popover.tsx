// Wrapper estilizado do Popover Radix animado — tokens do design system.
import * as React from 'react';
import { cn } from '../../../../utils';
import {
  Popover as PopoverPrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
  PopoverContent as PopoverContentPrimitive,
  PopoverClose as PopoverClosePrimitive,
  PopoverAnchor as PopoverAnchorPrimitive,
  type PopoverContentProps as PopoverContentPrimitiveProps,
} from '../../primitives/radix/popover';

type PopoverProps = React.ComponentProps<typeof PopoverPrimitive>;
const Popover = PopoverPrimitive;

type PopoverTriggerProps = React.ComponentProps<typeof PopoverTriggerPrimitive>;
const PopoverTrigger = PopoverTriggerPrimitive;

type PopoverCloseProps = React.ComponentProps<typeof PopoverClosePrimitive>;
const PopoverClose = PopoverClosePrimitive;

type PopoverAnchorProps = React.ComponentProps<typeof PopoverAnchorPrimitive>;
const PopoverAnchor = PopoverAnchorPrimitive;

type PopoverContentProps = PopoverContentPrimitiveProps & { className?: string };

function PopoverContent({ className, align = 'center', ...props }: PopoverContentProps) {
  return (
    <PopoverContentPrimitive
      align={align}
      className={cn(
        'z-50 w-72 rounded-card border border-border-default bg-surface-card p-3 shadow-elevated-md',
        'text-text-primary focus:outline-none',
        className
      )}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
  PopoverAnchor,
  type PopoverProps,
  type PopoverTriggerProps,
  type PopoverContentProps,
  type PopoverCloseProps,
  type PopoverAnchorProps,
};
