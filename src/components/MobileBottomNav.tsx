import { LogOut, MoreHorizontal, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NAV_ITEMS, NAV_GROUP_LABELS } from '../constants/navigation';
import type { NavGroup } from '../constants/navigation';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// O que se usa todo dia fica fixo na barra principal — independente da
// ordem de NAV_ITEMS (essa é pensada pra agrupar a sidebar desktop, não pra
// prioridade de uso mobile).
const MOBILE_MAIN_IDS = ['dashboard', 'estoque', 'vendas', 'caixa'];

export const MobileBottomNav = ({ activeTab, setActiveTab, theme, userRoles, isMoreOpen, setIsMoreOpen, onLogoutClick }: any) => {
  const allowedItems = NAV_ITEMS.filter(item => item.roles.some((r: string) => userRoles.includes(r)));

  const mainItems = MOBILE_MAIN_IDS
    .map(id => allowedItems.find(item => item.id === id))
    .filter((item): item is (typeof allowedItems)[number] => Boolean(item));
  const moreItems = allowedItems.filter(item => !MOBILE_MAIN_IDS.includes(item.id));

  // Agrupa moreItems por seção (mesmos grupos da sidebar desktop) mantendo a
  // ordem de NAV_ITEMS; só mostra cabeçalho pra grupo que realmente tem item.
  const moreGroups: Array<{ group: NavGroup; items: typeof moreItems }> = [];
  for (const item of moreItems) {
    const last = moreGroups[moreGroups.length - 1];
    if (last && last.group === item.group) {
      last.items.push(item);
    } else {
      moreGroups.push({ group: item.group, items: [item] });
    }
  }

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    setIsMoreOpen(false);
  };

  const handleLogoutClick = () => {
    setIsMoreOpen(false);
    onLogoutClick();
  };

  return (
    <>
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden border-t pb-safe",
        theme === 'dark' ? "bg-zinc-950 border-zinc-800" : "bg-white border-zinc-200"
      )}>
        <div className="flex justify-around items-center h-16">
          {mainItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative",
                activeTab === item.id
                  ? "text-accent"
                  : theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}
            >
              <item.icon size={22} />
              <span className="text-[10px] font-medium truncate w-full text-center px-1">{item.mobileLabel ?? item.label}</span>
            </button>
          ))}

          {moreItems.length > 0 && (
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative",
                isMoreOpen || moreItems.some(i => i.id === activeTab)
                  ? "text-accent"
                  : theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
              )}
            >
              <MoreHorizontal size={22} />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
          )}
        </div>
      </div>

      {/* Menu "Mais" Overlay */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-[60] md:hidden rounded-t-3xl p-6 pb-nav-safe max-h-[80vh] overflow-y-auto",
                theme === 'dark' ? "bg-zinc-900 border-t border-zinc-800" : "bg-white border-t border-zinc-200"
              )}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn(
                  "text-lg font-bold",
                  theme === 'dark' ? "text-white" : "text-zinc-900"
                )}>
                  Mais Opções
                </h3>
                <button
                  onClick={() => setIsMoreOpen(false)}
                  className={cn(
                    "p-2 rounded-full",
                    theme === 'dark' ? "bg-zinc-800 text-zinc-400" : "bg-zinc-100 text-zinc-500"
                  )}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                {moreGroups.map((section, idx) => (
                  <div key={section.group ?? `no-group-${idx}`}>
                    {section.group && (
                      <span className={cn(
                        "block mb-2 text-[10px] font-black uppercase tracking-[0.2em]",
                        theme === 'dark' ? "text-zinc-500" : "text-zinc-400"
                      )}>
                        {NAV_GROUP_LABELS[section.group]}
                      </span>
                    )}
                    <div className="grid grid-cols-3 gap-4">
                      {section.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleTabClick(item.id)}
                          className={cn(
                            "flex flex-col items-center justify-center gap-3 p-4 rounded-2xl transition-all",
                            activeTab === item.id
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : theme === 'dark' ? "bg-zinc-800/50 text-zinc-400 border border-transparent" : "bg-zinc-50 text-zinc-500 border border-transparent"
                          )}
                        >
                          <item.icon size={24} />
                          <span className="text-[11px] font-bold text-center">{item.mobileLabel ?? item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className={cn('mt-5 pt-5 border-t', theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200')}>
                <button
                  onClick={handleLogoutClick}
                  className="flex items-center gap-3 w-full px-2 py-2 rounded-xl text-danger hover:bg-danger-bg transition-colors"
                >
                  <LogOut size={20} />
                  <span className="text-sm font-bold">Sair</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
