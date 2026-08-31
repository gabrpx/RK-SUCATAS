// Wrap do Accordion do Radix com nossos tokens — mesmo padrão do Modal.tsx
// (radix-ui unificado, não @radix-ui/react-accordion separado).
import * as React from 'react';
import { Accordion as A } from 'radix-ui';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils';

interface AccordionProps {
  items: Array<{ key: string; title: string; content: React.ReactNode }>;
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
}

export function Accordion({ items, type = 'single', defaultValue }: AccordionProps) {
  const Root = A.Root as React.ComponentType<Record<string, unknown>>;
  return (
    <Root
      type={type}
      collapsible={type === 'single' ? true : undefined}
      defaultValue={defaultValue}
      className="divide-y divide-border-subtle rounded-card border border-border-default overflow-hidden"
    >
      {items.map((it) => (
        <A.Item key={it.key} value={it.key}>
          <A.Header>
            <A.Trigger className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-medium text-text-primary hover:bg-surface-raised data-[state=open]:bg-surface-raised group">
              {it.title}
              <ChevronDown size={16} className="text-text-muted transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </A.Trigger>
          </A.Header>
          <A.Content className={cn('overflow-hidden text-sm text-text-secondary', 'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out')}>
            <div className="px-4 py-3 bg-surface-inset">{it.content}</div>
          </A.Content>
        </A.Item>
      ))}
    </Root>
  );
}
