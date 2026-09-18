import { useMemo, useRef } from 'react';
import { LogOut } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { NAV_ITEMS } from '../constants/navigation';
import type { Tab } from '../constants/navigation';
import { usePermissao } from '../hooks/usePermissao';
import { cn } from '../utils';

type DockItem = {
  id: string;
  label: string;
  icon: typeof LogOut;
  active?: boolean;
  onClick: () => void;
};

function DockIcon({ item, mouseX }: { item: DockItem; mouseX: ReturnType<typeof useMotionValue<number>> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const distance = useTransform(mouseX, (value) => {
    if (value === Infinity || !ref.current) return 0;
    const bounds = ref.current.getBoundingClientRect();
    return value - (bounds.left + bounds.width / 2);
  });
  const size = useSpring(
    useTransform(distance, [-150, -90, -45, 0, 45, 90, 150], [44, 46, 50, 62, 50, 46, 44]),
    { stiffness: 360, damping: 28, mass: 0.45 },
  );

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={item.label}
      title={item.label}
      onClick={item.onClick}
      style={{ width: size, height: size }}
      whileTap={{ scale: 0.9 }}
      className={cn(
        'group relative grid shrink-0 place-items-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        item.active
          ? 'border-blue-200 bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]'
          : 'border-slate-200 bg-white/90 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
      )}
    >
      <item.icon size={19} strokeWidth={item.active ? 2.2 : 1.8} />
      <span className="pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:block group-hover:opacity-100 group-focus-visible:block group-focus-visible:opacity-100">
        {item.label}
      </span>
    </motion.button>
  );
}

export function TasksNavigationDock({
  activeTab,
  onTabChange,
  onLogoutClick,
}: {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogoutClick: () => void;
}) {
  const { pode } = usePermissao();
  const mouseX = useMotionValue(Infinity);
  const allowedItems = useMemo(() => NAV_ITEMS.filter((item) => pode(`${item.id}.ver`)), [pode]);
  const items: DockItem[] = [
    ...allowedItems.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      active: item.id === activeTab,
      onClick: () => onTabChange(item.id),
    })),
    {
      id: 'logout',
      label: 'Sair',
      icon: LogOut,
      onClick: onLogoutClick,
    },
  ];

  return (
    <nav
      aria-label="Navegação principal"
      onMouseMove={(event) => mouseX.set(event.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="fixed inset-x-2 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-[120] flex justify-center pointer-events-none"
    >
      <div className="pointer-events-auto flex max-w-[calc(100vw-1rem)] items-end gap-1 overflow-x-auto overscroll-x-contain rounded-[1.35rem] border border-slate-200/90 bg-white/80 p-1.5 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5 sm:p-2">
        {items.map((item) => (
          <DockIcon key={item.id} item={item} mouseX={mouseX} />
        ))}
      </div>
    </nav>
  );
}
