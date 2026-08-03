// ============================================
// APP.TSX — Shell da aplicação RK Sucatas
// ============================================
// Responsável só por: autenticação, layout (sidebar/header/nav) e troca de
// aba. Nenhum estado de domínio mora aqui — isso vive em DataContext.
// Views: Dashboard, Estoque, Vendas, Caixa, Frete.
// ============================================

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import {
  LayoutDashboard,
  Package,
  TrendingUp,
  Receipt,
  ShoppingCart,
  Wallet,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Wrench,
  Sun,
  Moon,
  Trash2,
  Edit,
  Truck,
  Calendar,
  CreditCard,
  MessageCircle,
  FileText,
  LogOut,
  Settings,
  ClipboardList,
  Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { DataProvider, useData } from './context/DataContext';
import { GlobalSearch } from './components/GlobalSearch';
import { MobileBottomNav } from './components/MobileBottomNav';
import { Login } from './components/Login';
import { EstoqueView } from './features/estoque/EstoqueView';
import { VendasView } from './features/vendas/VendasView';
import { OrcamentosView } from './features/orcamentos/OrcamentosView';
import { CaixaView } from './features/caixa/CaixaView';
import { FreteView } from './features/frete/FreteView';
import { DashboardView } from './features/dashboard/DashboardView';
import { ConfiguracoesView } from './features/configuracoes/ConfiguracoesView';
import { TarefasView } from './features/tarefas/TarefasView';
import { Toaster } from './components/ui/toast';
import { VisualizadorFotos } from './components/ui/VisualizadorFotos';
import { UnidadesAvaria } from './features/estoque/UnidadesAvaria';
import { contarAvarias } from './features/estoque/valorEstoque';
import { NotaCadastroBadge } from './components/NotaCadastroBadge';
import { PromocaoBadge } from './features/promocoes/PromocaoBadge';
import { TAB_ROLES } from './constants/roles';
import type { Role } from './constants/roles';
import type { Estoque } from './features/estoque/types';
import type { Venda } from './features/vendas/types';

type DetailItem = Estoque | Venda;
type Tab = 'dashboard' | 'estoque' | 'vendas' | 'orcamentos' | 'caixa' | 'frete' | 'configuracoes' | 'tarefas';
const VALID_TABS: Tab[] = ['dashboard', 'estoque', 'vendas', 'orcamentos', 'caixa', 'frete', 'configuracoes', 'tarefas'];

// Primeira aba visível pra cada papel — usada como fallback quando a URL
// pede uma aba que o papel logado não pode ver.
function primeiraAbaPermitida(role: Role): Tab {
  return VALID_TABS.find((tab) => TAB_ROLES[tab].includes(role)) as Tab;
}

function isVenda(item: DetailItem): item is Venda {
  return 'valor_total' in item;
}

// =============================================================================
// AUTENTICAÇÃO
// =============================================================================

// Acesso via localhost pula a tela de login — conveniência de desenvolvimento
// local, espelha o bypass equivalente em middleware/auth.ts no backend. Nunca
// ativa fora da própria máquina, já que checa o hostname que o navegador
// realmente carregou.
const IS_LOCALHOST = ['localhost', '127.0.0.1'].includes(window.location.hostname);

export default function App() {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = () => {
      if (IS_LOCALHOST) {
        setIsUserAuthenticated(true);
        if (window.location.pathname === '/' || window.location.pathname.toLowerCase() === '/login') {
          window.history.replaceState(null, '', '/dashboard');
        }
        return;
      }

      const token = localStorage.getItem('auth_token');
      const role = localStorage.getItem('user_role');

      if (token && role) {
        setIsUserAuthenticated(true);
        if (window.location.pathname.toLowerCase() === '/login' || window.location.pathname === '/') {
          window.history.replaceState(null, '', '/dashboard');
        }
      } else {
        setIsUserAuthenticated(false);
        if (window.location.pathname === '/' || window.location.pathname === '') {
          window.history.replaceState(null, '', '/login');
        }
      }
    };

    checkAuthStatus();
    window.addEventListener('local-login-success', checkAuthStatus);
    return () => window.removeEventListener('local-login-success', checkAuthStatus);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_id');
    setIsUserAuthenticated(false);
    window.location.href = '/login';
  };

  if (isUserAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const isLoginRoute = window.location.pathname.toLowerCase() === '/login';

  if (isLoginRoute && !isUserAuthenticated) {
    return <Login onLogin={() => {}} />;
  }

  if (!isUserAuthenticated && !isLoginRoute) {
    window.location.href = '/login';
    return null;
  }

  return (
    <DataProvider>
      <AppContent onLogout={handleLogout} />
      {/* Fora do AppContent pra sobreviver à troca de aba e continuar
          aparecendo mesmo na tela de login. */}
      <Toaster />
    </DataProvider>
  );
}

// =============================================================================
// SIDEBAR ITEM
// =============================================================================

const SidebarItem = memo(({ icon: Icon, label, active, onClick, theme, className }: { icon: any; label: string; active: boolean; onClick: () => void; theme: 'light' | 'dark'; className?: string }) => (
  <motion.button
    whileHover={{ x: 4 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group relative overflow-hidden transform-gpu',
      active ? 'bg-violet-600 text-white shadow-[0_10px_30px_rgba(139,92,246,0.3)]' : theme === 'dark' ? 'text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900',
      className
    )}
  >
    <Icon size={20} strokeWidth={active ? 3 : 2} className="relative z-10" />
    {label && <span className="font-black text-xs uppercase tracking-[0.2em] whitespace-nowrap relative z-10">{label}</span>}
  </motion.button>
));

// =============================================================================
// DETAIL MODAL — mostra um item de Estoque ou uma Venda
// =============================================================================

const DetailItemBox = ({ label, value, icon: Icon, theme }: { label: string; value: any; icon: any; theme: 'light' | 'dark' }) => (
  <div className={cn('p-4 rounded-2xl border flex flex-col gap-1.5', theme === 'dark' ? 'bg-zinc-900/40 border-zinc-800/50' : 'bg-zinc-50 border-zinc-200')}>
    <div className="flex items-center gap-2 text-zinc-500">
      <Icon size={14} strokeWidth={2.5} />
      <span className="text-[10px] uppercase font-black tracking-widest">{label}</span>
    </div>
    <span className={cn('text-sm md:text-base font-black truncate uppercase', theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900')}>{value ?? '-'}</span>
  </div>
);

function DetailModal({
  item,
  onClose,
  theme,
  onEdit,
  onDelete,
  readOnly,
  onAlterado,
}: {
  item: DetailItem;
  onClose: () => void;
  theme: 'light' | 'dark';
  onEdit?: (item: DetailItem) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
  onAlterado?: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const venda = isVenda(item) ? item : null;
  const estoque = !venda ? (item as Estoque) : null;
  const imagens = estoque?.imagens ?? [];
  const [indiceImagem, setIndiceImagem] = useState(0);
  const [fotoCheiaAberta, setFotoCheiaAberta] = useState(false);

  // Troca de item (ex: clicar em outro card sem fechar o modal) reinicia a
  // galeria pra capa, em vez de manter o índice do item anterior.
  useEffect(() => {
    setIndiceImagem(0);
  }, [estoque?.id]);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

  const handleWhatsAppShare = () => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    const nome = venda ? venda.nome_item : estoque!.nome;
    const text = `${greeting}, quero mais detalhes sobre ${nome}.`;
    window.open(`https://wa.me/5583982039490?text=${encodeURIComponent(text)}`, '_blank');
  };

  const titulo = venda ? venda.nome_item : estoque!.nome;
  const valor = venda ? venda.valor_total : estoque!.valor;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn('w-[95%] md:max-w-2xl h-[90vh] md:h-auto md:max-h-[90vh] rounded-[2.5rem] overflow-hidden border shadow-2xl flex flex-col relative', theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200')}
      >
        <div className="md:hidden w-full flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 rounded-full bg-zinc-800/50" />
        </div>
        <button onClick={onClose} className={cn('absolute top-6 right-6 z-50 p-2 rounded-full shadow-xl border', theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white' : 'bg-zinc-100 border-zinc-200 text-zinc-500')}>
          <X size={20} />
        </button>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="relative aspect-[4/3] w-full bg-zinc-950 overflow-hidden flex items-center justify-center">
            {imagens[indiceImagem] ? (
              <button type="button" onClick={() => setFotoCheiaAberta(true)} className="w-full h-full cursor-zoom-in">
                <img src={imagens[indiceImagem]} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={titulo} />
              </button>
            ) : (
              <Package size={64} strokeWidth={1} className="opacity-10 text-zinc-700" />
            )}
            {imagens.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {imagens.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndiceImagem(i)}
                    aria-label={`Foto ${i + 1}`}
                    className={cn('size-1.5 rounded-full transition-colors', i === indiceImagem ? 'bg-white' : 'bg-white/30')}
                  />
                ))}
              </div>
            )}
          </div>

          {imagens.length > 1 && (
            <div className="flex gap-2 px-8 pt-4 overflow-x-auto scrollbar-hide">
              {imagens.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setIndiceImagem(i)}
                  className={cn('size-14 rounded-xl overflow-hidden border-2 shrink-0 transition-colors', i === indiceImagem ? 'border-violet-500' : 'border-transparent')}
                >
                  <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={`${titulo} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}

          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-violet-500/10 text-violet-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-violet-500/20">
                    {venda ? 'Venda' : estoque?.categoria?.nome || 'Peça'}
                  </span>
                  {estoque && <NotaCadastroBadge value={estoque.nota_cadastro} />}
                </div>
                {estoque?.codigo && <span className="text-zinc-500 text-[10px] font-mono font-bold">#{estoque.codigo}</span>}
              </div>
              <h2 className={cn('text-3xl md:text-4xl font-black tracking-tight uppercase leading-none', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{titulo}</h2>
              {estoque?.promocao_ativa ? (
                <div className="flex items-end gap-3 flex-wrap">
                  <div className="text-4xl md:text-5xl font-black tracking-tighter text-emerald-500">{formatCurrency(estoque.promocao_ativa.valor_promocional)}</div>
                  <div className="flex flex-col gap-1 pb-1">
                    <span className="text-base font-bold text-zinc-500 line-through">{formatCurrency(valor)}</span>
                    <PromocaoBadge promocao={estoque.promocao_ativa} />
                  </div>
                </div>
              ) : (
                <div className="text-4xl md:text-5xl font-black tracking-tighter text-emerald-500">{formatCurrency(valor)}</div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {estoque && (
                <>
                  <DetailItemBox
                    label="Quantidade"
                    value={contarAvarias(estoque) > 0 ? `${estoque.quantidade} · ${contarAvarias(estoque)} c/ avaria` : estoque.quantidade}
                    icon={Package}
                    theme={theme}
                  />
                  <DetailItemBox label="Modelo de Moto" value={estoque.modelo_moto?.nome || 'Universal'} icon={Truck} theme={theme} />
                  <DetailItemBox label="Condição" value={estoque.condicao === 'original' ? 'Original' : 'Paralela'} icon={Wrench} theme={theme} />
                  {estoque.condicao_nota != null && <DetailItemBox label="Estado físico" value={`${estoque.condicao_nota}/10`} icon={Gauge} theme={theme} />}
                  <DetailItemBox label="Ano" value={estoque.ano} icon={Calendar} theme={theme} />
                </>
              )}
              {venda && (
                <>
                  <DetailItemBox label="Quantidade" value={venda.quantidade} icon={Package} theme={theme} />
                  <DetailItemBox label="Pagamento" value={venda.forma_pagamento?.nome} icon={CreditCard} theme={theme} />
                  <DetailItemBox label="Data" value={new Date(venda.data).toLocaleDateString('pt-BR')} icon={Calendar} theme={theme} />
                  {venda.cliente_nome && <DetailItemBox label="Cliente" value={venda.cliente_nome} icon={Edit} theme={theme} />}
                </>
              )}
            </div>

            {(estoque?.descricao || venda?.observacoes) && (
              <div className={cn('p-6 rounded-3xl border space-y-2', theme === 'dark' ? 'bg-zinc-900/30 border-zinc-800' : 'bg-zinc-50 border-zinc-100')}>
                <h4 className="text-[10px] font-black uppercase text-amber-400 tracking-[0.1em] flex items-center gap-2">
                  <FileText size={14} /> {venda ? 'Observações' : 'Descrição'}
                </h4>
                <p className={cn('text-sm leading-relaxed', theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600')}>{estoque?.descricao || venda?.observacoes}</p>
              </div>
            )}

            {/* Unidades físicas com avaria: mesma peça, uma linha só no
                estoque, mas cada unidade diferente ganha ficha e foto. */}
            {estoque && <UnidadesAvaria item={estoque} readOnly={readOnly} onAlterado={onAlterado} />}

            <div className="flex flex-col gap-3 pt-4">
              <button onClick={handleWhatsAppShare} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3">
                <MessageCircle size={20} /> Compartilhar no WhatsApp
              </button>

              {(onEdit || onDelete) && (
                <div className="grid grid-cols-2 gap-3">
                  {onEdit && (
                    <button
                      onClick={() => {
                        onEdit(item);
                        onClose();
                      }}
                      className={cn('py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border flex items-center justify-center gap-2', theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800' : 'bg-white border-zinc-200 text-zinc-900')}
                    >
                      <Edit size={16} /> Editar
                    </button>
                  )}
                  {onDelete && (
                    <button
                      // Sem window.confirm aqui: quem recebe o onDelete já abre
                      // a própria confirmação (Estoque) ou o modal de
                      // cancelamento (Vendas) — eram duas perguntas seguidas.
                      onClick={() => {
                        onDelete((item as any).id);
                        onClose();
                      }}
                      className="py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center gap-2"
                    >
                      <Trash2 size={16} /> Excluir
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {fotoCheiaAberta && imagens.length > 0 && (
        <VisualizadorFotos fotos={imagens} indice={indiceImagem} onTrocar={setIndiceImagem} onFechar={() => setFotoCheiaAberta(false)} />
      )}
    </div>
  );
}

// =============================================================================
// LOGOUT MODAL
// =============================================================================

const LogoutModal = memo(({ isOpen, onClose, onLogout, theme }: { isOpen: boolean; onClose: () => void; onLogout: () => void; theme: 'light' | 'dark' }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className={cn('relative w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl p-8 text-center', theme === 'dark' ? 'bg-zinc-950 border border-zinc-800' : 'bg-white')}>
        <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mx-auto mb-6">
          <LogOut size={36} />
        </div>
        <h2 className={cn('text-2xl font-black tracking-tight mb-2', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>Sair da Conta?</h2>
        <p className="text-zinc-500 text-sm font-medium mb-8">Tem certeza que deseja encerrar sua sessão atual?</p>
        <div className="flex flex-col gap-3">
          <button onClick={onLogout} className="w-full bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-rose-500/20">
            Sim, Sair Agora
          </button>
          <button onClick={onClose} className={cn('w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em]', theme === 'dark' ? 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-600')}>
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
});

// =============================================================================
// APP CONTENT — layout + navegação
// =============================================================================

const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', estoque: 'Estoque', vendas: 'Vendas', orcamentos: 'Orçamentos', caixa: 'Caixa', frete: 'Frete', configuracoes: 'Configurações', tarefas: 'Tarefas' };

function AppContent({ onLogout }: { onLogout: () => void }) {
  // Usado pelo modal de detalhes pra recarregar a lista depois de mexer nas
  // fichas de unidade (badge de avaria e valor total dependem disso).
  const { refreshData } = useData();

  // IS_LOCALHOST pula o login (ver comentário acima) e nunca grava user_role
  // no localStorage — nesse caso replica o mesmo 'admin' que o backend
  // atribui via bypass de loopback. Fora do localhost, checkAuthStatus só
  // autentica com token E role presentes, então este branch não deveria ser
  // alcançável — mas se o storage for corrompido/alterado em runtime, cai no
  // papel menos privilegiado em vez de assumir admin.
  const userRole = ((localStorage.getItem('user_role') as Role) || (IS_LOCALHOST ? 'admin' : 'estoque_leitura')) as Role;

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const path = window.location.pathname.replace('/', '') as Tab;
    const abaValida = VALID_TABS.includes(path);
    if (abaValida && TAB_ROLES[path].includes(userRole)) return path;
    // Aba inexistente OU papel sem permissão pra ela: cai na primeira aba
    // que o papel logado pode ver, em vez de sempre tentar 'dashboard'
    // (que Eloisa/mandados/mecanico não conseguem ver).
    return primeiraAbaPermitida(userRole);
  });
  const [pendingEditItem, setPendingEditItem] = useState<Estoque | null>(null);
  const [pendingEstoqueBaixo, setPendingEstoqueBaixo] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [estoqueActions, setEstoqueActions] = useState<{ edit: (item: Estoque) => void; delete: (id: string) => void } | null>(null);
  const [vendasActions, setVendasActions] = useState<{ edit: (item: Venda) => void; delete: (id: string) => void } | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('theme') as 'light' | 'dark') || 'dark');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (activeTab) window.history.pushState(null, '', `/${activeTab}`);
    window.scrollTo(0, 0);
    contentRef.current?.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const shouldLock = isLogoutModalOpen || !!selectedDetailItem;
    document.body.style.overflow = shouldLock ? 'hidden' : 'unset';
  }, [isLogoutModalOpen, selectedDetailItem]);

  const itemActions = useMemo(() => {
    if (!selectedDetailItem) return { edit: undefined, delete: undefined };

    const wrapEdit = (originalEdit: any, tab: Tab) => (item: any) => {
      if (activeTab !== tab) {
        setActiveTab(tab);
        if (tab === 'estoque') setPendingEditItem(item);
      } else {
        originalEdit?.(item);
      }
    };

    if (isVenda(selectedDetailItem)) {
      return { edit: undefined, delete: vendasActions?.delete };
    }
    return { edit: wrapEdit(estoqueActions?.edit, 'estoque'), delete: estoqueActions?.delete };
  }, [selectedDetailItem, estoqueActions, vendasActions, activeTab]);

  return (
    <div className={cn('min-h-screen transition-colors duration-300 flex font-sans w-full relative overflow-x-hidden', theme === 'dark' ? 'bg-[radial-gradient(ellipse_at_top,_#1a1b1f,_#09090b)] text-zinc-100' : 'bg-zinc-50 text-zinc-900')}>
      <AnimatePresence>
        {isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" />}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 h-screen inset-y-0 left-0 z-50 transition-all duration-300 ease-in-out border-r hidden md:flex overflow-y-auto',
          theme === 'dark' ? 'bg-zinc-950/50 border-zinc-800/50 backdrop-blur-xl' : 'bg-white border-zinc-200 shadow-xl',
          isSidebarOpen ? 'w-64' : 'w-20'
        )}
      >
        <div className={cn('h-full flex flex-col p-4', theme === 'dark' ? 'bg-zinc-950' : 'bg-white')}>
          <div className="flex items-center gap-3 px-2 mb-10 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <Wrench className={theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'} size={20} />
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col min-w-0">
                <span className={cn('font-black text-xl tracking-tighter truncate', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>
                  RK <span className="text-violet-500">SUCATAS</span>
                </span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Gestão Inteligente</span>
              </motion.div>
            )}
          </div>

          <nav className="flex-1 space-y-2">
            {TAB_ROLES.dashboard.includes(userRole) && (
              <SidebarItem icon={LayoutDashboard} label={isSidebarOpen ? 'Dashboard' : ''} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} theme={theme} />
            )}
            {TAB_ROLES.estoque.includes(userRole) && (
              <SidebarItem icon={Package} label={isSidebarOpen ? 'Estoque' : ''} active={activeTab === 'estoque'} onClick={() => setActiveTab('estoque')} theme={theme} />
            )}
            {TAB_ROLES.vendas.includes(userRole) && (
              <SidebarItem icon={ShoppingCart} label={isSidebarOpen ? 'Vendas' : ''} active={activeTab === 'vendas'} onClick={() => setActiveTab('vendas')} theme={theme} />
            )}
            {TAB_ROLES.orcamentos.includes(userRole) && (
              <SidebarItem icon={Receipt} label={isSidebarOpen ? 'Orçamentos' : ''} active={activeTab === 'orcamentos'} onClick={() => setActiveTab('orcamentos')} theme={theme} />
            )}
            {TAB_ROLES.caixa.includes(userRole) && (
              <SidebarItem icon={Wallet} label={isSidebarOpen ? 'Caixa' : ''} active={activeTab === 'caixa'} onClick={() => setActiveTab('caixa')} theme={theme} />
            )}
            {TAB_ROLES.frete.includes(userRole) && (
              <SidebarItem icon={Truck} label={isSidebarOpen ? 'Frete' : ''} active={activeTab === 'frete'} onClick={() => setActiveTab('frete')} theme={theme} />
            )}
            {TAB_ROLES.tarefas.includes(userRole) && (
              <SidebarItem icon={ClipboardList} label={isSidebarOpen ? 'Tarefas' : ''} active={activeTab === 'tarefas'} onClick={() => setActiveTab('tarefas')} theme={theme} />
            )}
            {TAB_ROLES.configuracoes.includes(userRole) && (
              <SidebarItem icon={Settings} label={isSidebarOpen ? 'Configurações' : ''} active={activeTab === 'configuracoes'} onClick={() => setActiveTab('configuracoes')} theme={theme} />
            )}
            <SidebarItem icon={LogOut} label={isSidebarOpen ? 'Sair' : ''} active={false} onClick={() => setIsLogoutModalOpen(true)} theme={theme} className="text-rose-500 hover:bg-rose-500/10 hover:text-rose-600" />
          </nav>

          <button onClick={() => setIsSidebarOpen((v) => !v)} className={cn('mt-4 p-3 rounded-xl flex items-center justify-center', theme === 'dark' ? 'text-zinc-500 hover:bg-zinc-900' : 'text-zinc-400 hover:bg-zinc-100')}>
            {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn('flex-1 flex flex-col min-w-0 pb-nav-safe md:pb-0 transition-all duration-300', isSidebarOpen ? 'md:ml-64' : 'md:ml-20')}>
        <header className={cn('min-h-16 border-b backdrop-blur-md flex items-center justify-between px-4 md:px-6 sticky top-0 z-[100] pt-safe', theme === 'dark' ? 'bg-zinc-950/40 border-zinc-800/50' : 'bg-white/50 border-zinc-200')}>
          <div className="flex items-center gap-2 md:gap-4">
            <h2 className={cn('text-base md:text-lg font-semibold capitalize', theme === 'dark' ? 'text-white' : 'text-zinc-900')}>{TAB_LABELS[activeTab]}</h2>
          </div>
          <button onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} className={cn('p-2 rounded-lg transition-all', theme === 'dark' ? 'hover:bg-zinc-800 text-amber-400' : 'hover:bg-zinc-100 text-violet-600')}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div ref={contentRef} className="p-4 md:p-6 pb-32 md:pb-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full h-full">
              {activeTab === 'dashboard' ? (
                <DashboardView
                  theme={theme}
                  onSelectItem={setSelectedDetailItem}
                  onTabChange={(tab) => setActiveTab(tab as Tab)}
                  onOpenSearch={() => setIsSearchOpen(true)}
                  onNavigateEstoqueBaixo={() => {
                    setActiveTab('estoque');
                    setPendingEstoqueBaixo(true);
                  }}
                />
              ) : activeTab === 'estoque' ? (
                <EstoqueView
                  theme={theme}
                  onSelectItem={setSelectedDetailItem}
                  onRegisterActions={setEstoqueActions}
                  pendingEditItem={pendingEditItem}
                  setPendingEditItem={setPendingEditItem}
                  filtroEstoqueBaixoInicial={pendingEstoqueBaixo}
                  setFiltroEstoqueBaixoInicial={setPendingEstoqueBaixo}
                  readOnly={userRole === 'estoque_leitura'}
                />
              ) : activeTab === 'vendas' ? (
                <VendasView theme={theme} onSelectItem={setSelectedDetailItem} onRegisterActions={setVendasActions} />
              ) : activeTab === 'orcamentos' ? (
                <OrcamentosView theme={theme} />
              ) : activeTab === 'caixa' ? (
                <CaixaView theme={theme} />
              ) : activeTab === 'frete' ? (
                <FreteView />
              ) : activeTab === 'tarefas' ? (
                <TarefasView userRole={userRole} />
              ) : (
                <ConfiguracoesView theme={theme} userRole={userRole} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <MobileBottomNav activeTab={activeTab} setActiveTab={setActiveTab} theme={theme} userRole={userRole} isMoreOpen={isMoreMenuOpen} setIsMoreOpen={setIsMoreMenuOpen} />

      {!isMoreMenuOpen && (
        <div className="fixed bottom-24 md:bottom-8 right-6 z-[60] flex flex-col gap-3">
          <GlobalSearch theme={theme} onSelectItem={setSelectedDetailItem} isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} customClick={() => setIsSearchOpen(true)} />
        </div>
      )}

      <AnimatePresence>
        {selectedDetailItem && (
          <DetailModal
            item={selectedDetailItem}
            theme={theme}
            onClose={() => setSelectedDetailItem(null)}
            onEdit={itemActions.edit}
            onDelete={itemActions.delete}
            readOnly={userRole === 'estoque_leitura'}
            onAlterado={refreshData}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>{isLogoutModalOpen && <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} onLogout={onLogout} theme={theme} />}</AnimatePresence>
    </div>
  );
}
