// Wrapper estilizado das Tabs animadas do animate-ui (@animate-ui/components-animate-tabs).
// Diferença do template original: os tokens do shadcn (bg-muted, bg-background,
// text-foreground, border-input, dark:*) — que não existem nesta base — foram
// trocados pelos tokens do design system (ver src/styles/theme.css). A "pílula"
// que desliza usa uma superfície elevada neutra (surface-overlay) em vez de
// accent, pra respeitar a regra de "no máximo um accent preenchido por tela".
import * as React from 'react';
import { useReducedMotion } from 'motion/react';

import { SPRING_MICRO } from '../../../ui/motion';
import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsContents as TabsContentsPrimitive,
  TabsHighlight as TabsHighlightPrimitive,
  TabsHighlightItem as TabsHighlightItemPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  type TabsContentProps as TabsContentPrimitiveProps,
  type TabsContentsProps as TabsContentsPrimitiveProps,
} from '../../primitives/animate/tabs';
import { cn } from '../../../../utils';

type TabsProps = TabsPrimitiveProps;

function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive className={cn('flex flex-col gap-2', className)} {...props} />
  );
}

type TabsListProps = TabsListPrimitiveProps;

function TabsList({ className, ...props }: TabsListProps) {
  // A "pílula" desliza com o spring padrão da base; com `prefers-reduced-motion`
  // ela apenas troca de lugar, sem percorrer o caminho.
  const reduce = useReducedMotion();

  return (
    <TabsHighlightPrimitive
      transition={reduce ? { duration: 0 } : SPRING_MICRO}
      className="absolute z-0 inset-0 rounded-control border border-border-default bg-surface-overlay shadow-elevated-sm"
    >
      <TabsListPrimitive
        className={cn(
          'inline-flex h-9 w-fit items-center justify-center rounded-control border border-border-subtle bg-surface-inset p-1 text-text-muted',
          className,
        )}
        {...props}
      />
    </TabsHighlightPrimitive>
  );
}

type TabsTriggerProps = TabsTriggerPrimitiveProps;

function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  return (
    <TabsHighlightItemPrimitive value={props.value} className="flex-1">
      <TabsTriggerPrimitive
        className={cn(
          "inline-flex h-[calc(100%-1px)] w-full flex-1 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-3 py-1 text-sm font-medium text-text-muted transition-colors duration-base ease-standard data-[state=active]:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className,
        )}
        {...props}
      />
    </TabsHighlightItemPrimitive>
  );
}

type TabsContentsProps = TabsContentsPrimitiveProps;

function TabsContents(props: TabsContentsProps) {
  return <TabsContentsPrimitive {...props} />;
}

type TabsContentProps = TabsContentPrimitiveProps;

function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsContentPrimitive className={cn('outline-none', className)} {...props} />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentsProps,
  type TabsContentProps,
};
