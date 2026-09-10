// Wrapper estilizado do DropdownMenu Radix animado — tokens do design system.
import * as React from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { cn } from '../../../../utils';
import {
  DropdownMenu as DropdownMenuPrimitive,
  DropdownMenuTrigger as DropdownMenuTriggerPrimitive,
  DropdownMenuContent as DropdownMenuContentPrimitive,
  DropdownMenuGroup as DropdownMenuGroupPrimitive,
  DropdownMenuItem as DropdownMenuItemPrimitive,
  DropdownMenuCheckboxItem as DropdownMenuCheckboxItemPrimitive,
  DropdownMenuRadioGroup as DropdownMenuRadioGroupPrimitive,
  DropdownMenuRadioItem as DropdownMenuRadioItemPrimitive,
  DropdownMenuSeparator as DropdownMenuSeparatorPrimitive,
  DropdownMenuLabel as DropdownMenuLabelPrimitive,
  type DropdownMenuContentProps as DropdownMenuContentPrimitiveProps,
} from '../../primitives/radix/dropdown-menu';

type DropdownMenuProps = React.ComponentProps<typeof DropdownMenuPrimitive>;
const DropdownMenu = DropdownMenuPrimitive;

type DropdownMenuTriggerProps = React.ComponentProps<typeof DropdownMenuTriggerPrimitive>;
const DropdownMenuTrigger = DropdownMenuTriggerPrimitive;

type DropdownMenuGroupProps = React.ComponentProps<typeof DropdownMenuGroupPrimitive>;
const DropdownMenuGroup = DropdownMenuGroupPrimitive;

type DropdownMenuRadioGroupProps = React.ComponentProps<typeof DropdownMenuRadioGroupPrimitive>;
const DropdownMenuRadioGroup = DropdownMenuRadioGroupPrimitive;

type DropdownMenuContentProps = DropdownMenuContentPrimitiveProps & { className?: string };

function DropdownMenuContent({ className, ...props }: DropdownMenuContentProps) {
  return (
    <DropdownMenuContentPrimitive
      className={cn(
        'z-50 min-w-[10rem] overflow-hidden rounded-card border border-border-default bg-surface-card p-1 shadow-elevated-md text-text-primary',
        className
      )}
      {...props}
    />
  );
}

type DropdownMenuItemProps = React.ComponentProps<typeof DropdownMenuItemPrimitive> & {
  inset?: boolean;
};

function DropdownMenuItem({ className, inset, ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuItemPrimitive
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-control px-2.5 py-1.5 text-sm text-text-primary',
        'outline-none transition-colors',
        'focus:bg-surface-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  );
}

type DropdownMenuCheckboxItemProps = React.ComponentProps<typeof DropdownMenuCheckboxItemPrimitive>;

function DropdownMenuCheckboxItem({ className, children, checked, ...props }: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuCheckboxItemPrimitive
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-control py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors',
        'focus:bg-surface-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <Check size={12} />}
      </span>
      {children}
    </DropdownMenuCheckboxItemPrimitive>
  );
}

type DropdownMenuRadioItemProps = React.ComponentProps<typeof DropdownMenuRadioItemPrimitive>;

function DropdownMenuRadioItem({ className, children, ...props }: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuRadioItemPrimitive
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-control py-1.5 pl-8 pr-2.5 text-sm outline-none transition-colors',
        'focus:bg-surface-raised data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        className
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <span className="size-2 rounded-full bg-text-primary" />
      </span>
      {children}
    </DropdownMenuRadioItemPrimitive>
  );
}

type DropdownMenuLabelProps = React.ComponentProps<typeof DropdownMenuLabelPrimitive> & { inset?: boolean };

function DropdownMenuLabel({ className, inset, ...props }: DropdownMenuLabelProps) {
  return (
    <DropdownMenuLabelPrimitive
      className={cn(
        'px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  );
}

type DropdownMenuSeparatorProps = React.ComponentProps<typeof DropdownMenuSeparatorPrimitive>;

function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuSeparatorPrimitive
      className={cn('-mx-1 my-1 h-px bg-border-subtle', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  type DropdownMenuProps,
  type DropdownMenuTriggerProps,
  type DropdownMenuContentProps,
  type DropdownMenuGroupProps,
  type DropdownMenuItemProps,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuRadioGroupProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuLabelProps,
  type DropdownMenuSeparatorProps,
};
