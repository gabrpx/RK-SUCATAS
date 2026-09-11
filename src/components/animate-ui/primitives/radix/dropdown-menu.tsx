'use client';

// Portado do animate-ui (variante Radix UI). Reexporta os primitivos do
// @radix-ui/react-dropdown-menu com um Content animado via Motion.
import * as React from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { motion, AnimatePresence, type Transition, type HTMLMotionProps } from 'motion/react';

type DropdownMenuProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>;
const DropdownMenu = DropdownMenuPrimitive.Root;

type DropdownMenuTriggerProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

type DropdownMenuGroupProps = React.ComponentPropsWithoutRef<typeof DropdownMenuGroup>;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

type DropdownMenuPortalProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Portal>;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

type DropdownMenuSeparatorProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>;
const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;

type DropdownMenuLabelProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>;
const DropdownMenuLabel = DropdownMenuPrimitive.Label;

type DropdownMenuItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>;
const DropdownMenuItem = DropdownMenuPrimitive.Item;

type DropdownMenuCheckboxItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>;
const DropdownMenuCheckboxItem = DropdownMenuPrimitive.CheckboxItem;

type DropdownMenuRadioGroupProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioGroup>;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

type DropdownMenuRadioItemProps = React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>;
const DropdownMenuRadioItem = DropdownMenuPrimitive.RadioItem;

type DropdownMenuContentProps = Omit<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>,
  'asChild'
> & {
  transition?: Transition;
  motionProps?: HTMLMotionProps<'div'>;
  open?: boolean;
};

function DropdownMenuContent({
  children,
  transition = { type: 'spring', stiffness: 400, damping: 30 },
  motionProps,
  sideOffset = 4,
  open,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPortal forceMount>
      <AnimatePresence>
        {open && (
          <DropdownMenuPrimitive.Content asChild forceMount sideOffset={sideOffset} {...props}>
            <motion.div
              data-slot="dropdown-menu-content"
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={transition}
              {...motionProps}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.Content>
        )}
      </AnimatePresence>
    </DropdownMenuPortal>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuPortal,
  type DropdownMenuProps,
  type DropdownMenuTriggerProps,
  type DropdownMenuContentProps,
  type DropdownMenuGroupProps,
  type DropdownMenuSeparatorProps,
  type DropdownMenuLabelProps,
  type DropdownMenuItemProps,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuRadioGroupProps,
  type DropdownMenuRadioItemProps,
  type DropdownMenuPortalProps,
};
