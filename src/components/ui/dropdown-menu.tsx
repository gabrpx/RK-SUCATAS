// Menu de AÇÕES animado — Radix DropdownMenu (pacote unificado `radix-ui`)
// retemado com os tokens do projeto e com entrada/saída via Motion, no estilo
// do animate-ui. Diferente do CustomDropdown (que é um SELETOR de valor), este
// é pra listas de ação disparadas por um botão (ex: ⋯ nas ações de uma tarefa).
//
// Padrão de animação: a Root é controlada (open/onOpenChange) e o Content é
// montado com `forceMount` dentro de um AnimatePresence, pra o exit rodar antes
// do Radix desmontar.
'use client';

import * as React from 'react';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../../utils';
import { SPRING_SHEET } from './motion';

// Contexto interno só pra o Content saber se está aberto (a Root do Radix não
// expõe isso pros filhos sem prop drilling).
const OpenContext = React.createContext(false);

function DropdownMenu({
  children,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  const [open, setOpen] = React.useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const value = isControlled ? openProp : open;

  return (
    <OpenContext.Provider value={value}>
      <DropdownMenuPrimitive.Root
        open={value}
        onOpenChange={(o) => {
          if (!isControlled) setOpen(o);
          onOpenChange?.(o);
        }}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Root>
    </OpenContext.Provider>
  );
}

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;

function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  const open = React.useContext(OpenContext);
  return (
    <AnimatePresence>
      {open && (
        <DropdownMenuPrimitive.Portal forceMount>
          <DropdownMenuPrimitive.Content
            asChild
            sideOffset={sideOffset}
            align={align}
            {...props}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={SPRING_SHEET}
              className={cn(
                'z-[200] min-w-[11rem] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-2xl border border-border-default bg-surface-raised/95 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl outline-none',
                className
              )}
            >
              {children}
            </motion.div>
          </DropdownMenuPrimitive.Content>
        </DropdownMenuPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean;
  variant?: 'default' | 'danger';
}) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        // Alvo confortável pro dedo (~40px de altura) e texto legível no
        // celular; no desktop continua compacto o bastante.
        'relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium outline-none transition-colors',
        '[&_svg]:size-4 [&_svg]:shrink-0',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        variant === 'danger'
          ? 'text-danger data-[highlighted]:bg-danger/10'
          : 'text-text-secondary data-[highlighted]:bg-surface-inset data-[highlighted]:text-text-primary',
        inset && 'pl-8',
        className
      )}
      {...props}
    />
  );
}

function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn('px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-faint', className)}
      {...props}
    />
  );
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('my-1 h-px bg-border-default/60', className)}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
};
