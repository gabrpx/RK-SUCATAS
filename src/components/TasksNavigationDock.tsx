import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { LogOut, MoreHorizontal, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { NAV_ITEMS } from '../constants/navigation';
import type { NavItem, Tab } from '../constants/navigation';
import { usePermissao } from '../hooks/usePermissao';
import { cn } from '../utils';

type DockItem = {
  id: string;
  label: string;
  icon: NavItem['icon'];
  active?: boolean;
  onClick: () => void;
};

type TooltipState = {
  label: string;
  left: number;
  top: number;
};

// Quatro atalhos diretos preservam o uso diário no celular. O restante fica
// no painel "Mais", sem obrigar a dock a virar uma barra horizontal rolável.
const MOBILE_MAIN_IDS = ['dashboard', 'tarefas', 'vendas', 'caixa'] as const;

function DockIcon({
  item,
  onTooltipShow,
  onTooltipHide,
}: {
  item: DockItem;
  onTooltipShow: (label: string, target: HTMLButtonElement) => void;
  onTooltipHide: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  const handlePointerEnter = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Touch devices do not have a hover state; aria-label remains available
    // to assistive technology and the More panel supplies visible labels.
    if (event.pointerType !== 'touch') onTooltipShow(item.label, event.currentTarget);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      aria-label={item.label}
      title={item.label}
      onClick={item.onClick}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') onTooltipHide();
      }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={onTooltipHide}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) onTooltipShow(item.label, event.currentTarget);
      }}
      onBlur={onTooltipHide}
      className={cn(
        'cursor-pointer group relative grid size-10 shrink-0 place-items-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:size-11',
        item.active
          ? 'border-blue-200 bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]'
          : 'border-slate-200 bg-white/90 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
      )}
    >
      <item.icon size={19} strokeWidth={item.active ? 2.2 : 1.8} />
    </motion.button>
  );
}

function PlainDockButton({ item, onTooltipShow, onTooltipHide }: {
  item: DockItem;
  onTooltipShow: (label: string, target: HTMLButtonElement) => void;
  onTooltipHide: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={item.label}
      onClick={item.onClick}
      onPointerDown={(event) => {
        if (event.pointerType === 'touch') onTooltipHide();
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== 'touch') onTooltipShow(item.label, event.currentTarget);
      }}
      onPointerLeave={onTooltipHide}
      onFocus={(event) => {
        if (event.currentTarget.matches(':focus-visible')) onTooltipShow(item.label, event.currentTarget);
      }}
      onBlur={onTooltipHide}
      className={cn(
        'cursor-pointer grid size-10 shrink-0 place-items-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 lg:size-11',
        item.active
          ? 'border-blue-200 bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]'
          : 'border-slate-200 bg-white/90 text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
      )}
    >
      <item.icon size={19} strokeWidth={item.active ? 2.2 : 1.8} />
    </button>
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
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const allowedItems = useMemo(() => NAV_ITEMS.filter((item) => pode(`${item.id}.ver`)), [pode]);
  const items: DockItem[] = [
    ...allowedItems.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      active: item.id === activeTab,
      onClick: () => {
        setMobileMoreOpen(false);
        onTabChange(item.id);
      },
    })),
    {
      id: 'logout',
      label: 'Sair',
      icon: LogOut,
      onClick: () => {
        setMobileMoreOpen(false);
        onLogoutClick();
      },
    },
  ];
  const navItems = items.filter((item) => item.id !== 'logout');
  const mobileMainItems = MOBILE_MAIN_IDS
    .map((id) => navItems.find((item) => item.id === id))
    .filter((item): item is DockItem => Boolean(item));
  const mobileMoreItems = navItems.filter((item) => !MOBILE_MAIN_IDS.includes(item.id as typeof MOBILE_MAIN_IDS[number]));
  const mobileMoreActive = mobileMoreItems.some((item) => item.active);

  useEffect(() => {
    if (!mobileMoreOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMoreOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMoreOpen]);

  const showTooltip = (label: string, target: HTMLButtonElement) => {
    const rect = target.getBoundingClientRect();
    const left = Math.min(Math.max(rect.left + rect.width / 2, 8), window.innerWidth - 8);
    setTooltip({ label, left, top: Math.max(rect.top - 8, 8) });
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        onMouseLeave={() => setTooltip(null)}
        className="pointer-events-none fixed inset-x-2 bottom-[max(0.65rem,env(safe-area-inset-bottom))] z-[120] flex justify-center"
      >
        <div
          data-dock-scroll-region
          className="pointer-events-auto hidden max-w-[calc(100vw-1rem)] items-end gap-1 overflow-x-auto overscroll-x-contain rounded-[1.35rem] border border-slate-200/90 bg-white/80 p-1.5 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex sm:gap-1.5 sm:p-2"
        >
          {items.map((item) => (
            <DockIcon key={item.id} item={item} onTooltipShow={showTooltip} onTooltipHide={() => setTooltip(null)} />
          ))}
        </div>

        <div data-testid="tasks-navigation-mobile" className="pointer-events-auto flex items-end gap-1.5 rounded-[1.35rem] border border-slate-200/90 bg-white/85 p-2 shadow-[0_16px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl lg:hidden">
          {mobileMainItems.map((item) => (
            <DockIcon key={item.id} item={item} onTooltipShow={showTooltip} onTooltipHide={() => setTooltip(null)} />
          ))}
          <PlainDockButton
            item={{
              id: 'more',
              label: 'Mais opções de navegação',
              active: mobileMoreActive,
              icon: mobileMoreOpen ? X : MoreHorizontal,
              onClick: () => setMobileMoreOpen((open) => !open),
            }}
            onTooltipShow={showTooltip}
            onTooltipHide={() => setTooltip(null)}
          />
        </div>
      </nav>

      {tooltip && typeof document !== 'undefined' && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[5000] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white shadow-lg"
          style={{ left: tooltip.left, top: tooltip.top }}
        >
          {tooltip.label}
        </div>
      )}

      <AnimatePresence>
        {mobileMoreOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Fechar mais opções"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMoreOpen(false)}
              className="cursor-pointer pointer-events-auto fixed inset-0 z-[110] bg-slate-950/20 lg:hidden"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Mais opções de navegação"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="pointer-events-auto fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[130] max-h-[min(70vh,34rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.2)] lg:hidden"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Navegação</p>
                  <h2 className="text-sm font-semibold text-slate-900">Mais opções</h2>
                </div>
                <button type="button" aria-label="Fechar mais opções" onClick={() => setMobileMoreOpen(false)} className="cursor-pointer grid size-9 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  <X size={18} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {mobileMoreItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    onClick={item.onClick}
                    className={cn(
                      'cursor-pointer flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                      item.active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
                    )}
                  >
                    <item.icon size={18} strokeWidth={item.active ? 2.2 : 1.8} />
                    <span>{item.label}</span>
                  </button>
                ))}
                <button type="button" aria-label="Sair" onClick={items[items.length - 1].onClick} className="cursor-pointer flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border border-rose-100 px-2 py-2 text-center text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                  <LogOut size={18} />
                  <span>Sair</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
