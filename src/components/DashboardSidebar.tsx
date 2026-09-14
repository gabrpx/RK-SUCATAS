import { useState, memo } from 'react';
import {
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Wrench,
} from 'lucide-react';
import { NAV_ITEMS, NAV_GROUP_LABELS } from '../constants/navigation';
import type { Tab, NavGroup, NavItem } from '../constants/navigation';
import { cn } from '../utils';
import { Tooltip } from './ui/beui-tooltip';
import { usePermissao } from '../hooks/usePermissao';

const SidebarNavItem = memo(({
  item,
  activeId,
  onSelect,
  level = 0,
}: {
  item: NavItem;
  activeId: string;
  onSelect: (id: string) => void;
  level?: number;
}) => {
  const isActive = activeId === item.id;

  return (
    <div
      className={cn(
        'group flex items-center justify-between px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none',
        isActive
          ? 'bg-accent/15 text-accent font-medium'
          : 'text-text-muted hover:bg-surface-raised hover:text-text-secondary',
      )}
      style={level > 0 ? { paddingLeft: `${level * 12 + 10}px` } : undefined}
      onClick={() => onSelect(item.id)}
    >
      <div className="flex items-center gap-2.5">
        <item.icon
          className={cn(
            'w-4 h-4 shrink-0 transition-colors',
            isActive ? 'text-accent' : 'text-text-faint group-hover:text-text-muted',
          )}
          strokeWidth={isActive ? 2 : 1.5}
        />
        <span className="text-[13px] tracking-wide truncate">
          {item.label}
        </span>
      </div>
    </div>
  );
});

interface DashboardSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isOpen: boolean;
  onToggle: () => void;
  onLogoutClick: () => void;
}

export function DashboardSidebar({
  activeTab,
  onTabChange,
  isOpen,
  onToggle,
  onLogoutClick,
}: DashboardSidebarProps) {
  const { pode } = usePermissao();
  const visibleItems = NAV_ITEMS.filter((item) => pode(`${item.id}.ver`));

  const groups: Array<{ group: NavGroup; label?: string; items: NavItem[] }> = [];
  for (const item of visibleItems) {
    const last = groups[groups.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      groups.push({
        group: item.group,
        label: item.group ? NAV_GROUP_LABELS[item.group] : undefined,
        items: [item],
      });
    }
  }

  return (
    <aside
      className={cn(
        'fixed top-0 h-screen inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out border-r hidden md:flex',
        'bg-surface-inset border-border-default/50',
        isOpen ? 'w-[260px]' : 'w-[68px]',
      )}
    >
      <div className="h-full flex flex-col w-full">
        {/* Header / Branding */}
        <div className={cn(
          'flex items-center gap-3 px-3 pt-4 pb-6 overflow-hidden',
          !isOpen && 'justify-center px-0',
        )}>
          <div className="w-9 h-9 shrink-0 rounded-[8px] bg-accent text-white flex items-center justify-center shadow-sm">
            <Wrench size={18} strokeWidth={2} />
          </div>
          {isOpen && (
            <div className="flex flex-col min-w-0">
              <span className="text-[14px] font-semibold leading-none mb-1 text-text-primary truncate">
                RK <span className="text-accent">Sucatas</span>
              </span>
              <span className="text-[11px] text-text-faint leading-none">
                Gestão Inteligente
              </span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-2 flex flex-col gap-3">
          {groups.map((section, idx) => (
            <div key={`${section.group ?? 'no-group'}-${idx}`} className="flex flex-col gap-0.5">
              {section.label && isOpen && (
                <span className="px-2.5 mb-1 text-[10px] font-semibold tracking-wider text-text-faint/60 uppercase">
                  {section.label}
                </span>
              )}
              {section.label && !isOpen && (
                <div className="flex justify-center py-1">
                  <span className="block w-5 border-t border-border-default" />
                </div>
              )}
              {section.items.map((item) =>
                isOpen ? (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    activeId={activeTab}
                    onSelect={(id) => onTabChange(id as Tab)}
                  />
                ) : (
                  <CollapsedNavItem
                    key={item.id}
                    item={item}
                    active={activeTab === item.id}
                    onClick={() => onTabChange(item.id)}
                  />
                )
              )}
            </div>
          ))}
        </nav>

        {/* Bottom items */}
        <div className="px-2 pb-3 pt-2 border-t border-border-default/50 flex flex-col gap-0.5">
          {isOpen ? (
            <div
              className="group flex items-center gap-2.5 px-2.5 py-[7px] rounded-[6px] cursor-pointer transition-all duration-200 select-none text-danger hover:bg-danger-bg"
              onClick={onLogoutClick}
            >
              <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="text-[13px] tracking-wide">Sair</span>
            </div>
          ) : (
            <CollapsedNavItem
              item={{ id: 'logout' as Tab, icon: LogOut, label: 'Sair', group: null, roles: [] }}
              active={false}
              onClick={onLogoutClick}
              className="text-danger hover:bg-danger-bg hover:text-danger"
            />
          )}

          {/* Collapse toggle */}
          {isOpen ? (
            <div
              className="flex items-center justify-center mt-1 py-1.5 rounded-[6px] cursor-pointer transition-colors text-text-faint hover:bg-surface-raised hover:text-text-muted"
              onClick={onToggle}
            >
              <PanelLeftClose className="w-[18px] h-[18px]" strokeWidth={1.5} />
            </div>
          ) : (
            <Tooltip content="Expandir menu" side="right" wrapperClassName="!flex w-full justify-center">
              <div
                className="flex items-center justify-center w-full mt-1 py-1.5 rounded-[6px] cursor-pointer transition-colors text-text-faint hover:bg-surface-raised hover:text-text-muted"
                onClick={onToggle}
              >
                <PanelLeftOpen className="w-[18px] h-[18px]" strokeWidth={1.5} />
              </div>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}

const CollapsedNavItem = memo(({
  item,
  active,
  onClick,
  className,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <Tooltip content={item.label} side="right" wrapperClassName="!flex w-full justify-center">
    <div
      className={cn(
        'flex items-center justify-center w-full py-2 rounded-[6px] cursor-pointer transition-all duration-200',
        active
          ? 'bg-accent/15 text-accent'
          : 'text-text-faint hover:bg-surface-raised hover:text-text-muted',
        className,
      )}
      onClick={onClick}
    >
      <item.icon className="w-[18px] h-[18px]" strokeWidth={active ? 2 : 1.5} />
    </div>
  </Tooltip>
));
