import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';
import { createContext, useContext, useId, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/src/utils';

type TabsContextValue = { value: string; onValueChange: (value: string) => void; contentId: string };
const TabsContext = createContext<TabsContextValue | null>(null);

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tabs devem ser usados dentro de Tabs.');
  return context;
}

export function Tabs({ value, onValueChange, className, children }: { value: string; onValueChange: (value: string) => void; className?: string; children: ReactNode }) {
  const contentId = useId();
  return <TabsContext.Provider value={{ value, onValueChange, contentId }}><div data-slot="tabs" className={cn('flex flex-col gap-3', className)}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ className, children, ...props }: ComponentProps<'div'>) {
  return <div {...props} role="tablist" data-slot="tabs-list" className={cn('inline-flex w-fit items-center rounded-md border border-slate-200 bg-slate-50 p-0.5', className)}>{children}</div>;
}

export function TabsTrigger({ value, id, className, children, onKeyDown, 'aria-controls': ariaControls, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const tabs = useTabs();
  const reduceMotion = useReducedMotion();
  const active = tabs.value === value;
  return <button {...props} id={id ?? `${tabs.contentId}-tab-${safeId(value)}`} type="button" role="tab" tabIndex={active ? 0 : -1} aria-selected={active} aria-controls={ariaControls} data-state={active ? 'active' : 'inactive'} onClick={() => tabs.onValueChange(value)} onKeyDown={(event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || props.disabled) return;
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const siblings = Array.from(event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)') ?? []);
    if (!siblings.length) return;
    const index = siblings.indexOf(event.currentTarget);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + siblings.length) % siblings.length;
    siblings[nextIndex]?.focus();
    siblings[nextIndex]?.click();
  }} className={cn('relative isolate cursor-pointer rounded px-2.5 py-1.5 text-xs font-medium text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 data-[state=active]:text-blue-700', className)}>{active && <motion.span layoutId={`${tabs.contentId}-highlight`} className="absolute inset-0 -z-10 rounded bg-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 28 }} />}<span className="relative">{children}</span></button>;
}

export function TabsContent({ value, className, children, transition = { type: 'spring', stiffness: 300, damping: 30, bounce: 0 } }: { value: string; className?: string; children: ReactNode; transition?: Transition }) {
  const tabs = useTabs();
  const reduceMotion = useReducedMotion();
  return <AnimatePresence mode="wait" initial={false}>{tabs.value === value && <motion.div key={value} id={`${tabs.contentId}-${safeId(value)}`} aria-labelledby={`${tabs.contentId}-tab-${safeId(value)}`} role="tabpanel" tabIndex={0} initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -4 }} transition={reduceMotion ? { duration: 0 } : transition} className={className}>{children}</motion.div>}</AnimatePresence>;
}
