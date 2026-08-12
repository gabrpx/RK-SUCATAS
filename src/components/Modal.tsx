import React from 'react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  icon,
  iconBgColor = 'bg-surface-raised/50',
  iconColor = 'text-text-muted',
  footer
}) => {
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[9999] bg-overlay-scrim backdrop-blur-sm animate-in fade-in duration-200" />

        {/* Modal Content */}
        <DialogPrimitive.Content className={cn(
          "fixed z-[9999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] rounded-3xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col outline-none",
          maxWidth,
          "bg-surface-card border-border-default text-text-primary"
        )}>
          {/* Header */}
          <div className={cn(
            "p-6 border-b flex items-center justify-between shrink-0",
            "border-border-default/50"
          )}>
            <div className="flex items-center gap-3">
              {icon && (
                <div className={cn("p-2 rounded-xl", iconBgColor, iconColor)}>
                  {icon}
                </div>
              )}
              {title ? (
                <DialogPrimitive.Title asChild>
                  <h3 className="text-lg font-bold">{title}</h3>
                </DialogPrimitive.Title>
              ) : (
                <VisuallyHidden.Root asChild>
                  <DialogPrimitive.Title>Diálogo</DialogPrimitive.Title>
                </VisuallyHidden.Root>
              )}
            </div>
            <DialogPrimitive.Close
              className={cn(
                "p-2 rounded-xl transition-colors",
                "hover:bg-surface-raised text-text-muted"
              )}
            >
              <X size={20} />
            </DialogPrimitive.Close>
          </div>

          <VisuallyHidden.Root asChild>
            <DialogPrimitive.Description>Conteúdo do diálogo</DialogPrimitive.Description>
          </VisuallyHidden.Root>

          {/* Body */}
          <div className="p-6 overflow-y-auto max-h-[calc(100vh-12rem)]">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className={cn(
              "p-6 border-t flex items-center justify-end gap-3 shrink-0",
              "border-border-default/50 bg-surface-inset/20"
            )}>
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
