import { AnimatePresence, motion, type Transition } from 'motion/react';
import { createContext, useContext, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/src/utils';

type TabsContextValue = {
  value: string;
  onValueChange: (value: string) => void;
  contentId: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs devem ser usados dentro de Tabs.');
  return context;
}

export function Tabs({ value, onValueChange, className, children }: { value: string; onValueChange: (value: string) => void; className?: string; children: ReactNode }) {
  const contentId = useId();
  return <TabsContext.Provider value={{ value, onValueChange, contentId }}><div data-slot="tabs" className={cn('flex flex-col gap-3', className)}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return <div role="tablist" data-slot="tabs-list" className={cn('inline-flex w-fit items-center rounded-md border border-slate-200 bg-slate-50 p-0.5', className)}>{children}</div>;
}

export function TabsTrigger({ value, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const tabs = useTabs();
  const active = tabs.value === value;
  return <button type="button" role="tab" aria-selected={active} aria-controls={`${tabs.contentId}-${value}`} data-state={active ? 'active' : 'inactive'} onClick={() => tabs.onValueChange(value)} className={cn('relative isolate rounded px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 data-[state=active]:text-blue-700', className)} {...props}>{active && <motion.span layoutId={`${tabs.contentId}-highlight`} className="absolute inset-0 -z-10 rounded bg-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]" transition={{ type: 'spring', stiffness: 300, damping: 28 }} />}<span className="relative">{children}</span></button>;
}

export function TabsContent({ value, className, children, transition = { type: 'spring', stiffness: 300, damping: 30, bounce: 0 } }: { value: string; className?: string; children: ReactNode; transition?: Transition }) {
  const tabs = useTabs();
  return <AnimatePresence mode="wait" initial={false}>{tabs.value === value && <motion.div key={value} id={`${tabs.contentId}-${value}`} role="tabpanel" data-slot="tabs-content" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={transition} className={className}>{children}</motion.div>}</AnimatePresence>;
}
