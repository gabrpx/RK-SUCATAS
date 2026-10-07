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

import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Package,
  ChevronRight,
  Loader2,
  Wrench,
  Trash2,
  Edit,
  Truck,
  Calendar,
  CreditCard,
  MessageCircle,
  FileText,
  Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './utils';
import { DataProvider, useData } from './context/DataContext';
import { GlobalSearch } from './components/GlobalSearch';
import { TasksNavigationDock } from './components/TasksNavigationDock';
import { Modal } from './components/ui/Modal';
import { Button } from './components/ui/button';
import { Login } from './components/Login';
import { formaPagamentoEfetiva } from './features/fiado/metricas';
import type { FiadoRecebimento } from './features/fiado/types';
import { valorVendidoEmPartes, valorRestanteEstimado } from './features/vendas/metricas';
import { Toaster } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/ConfirmProvider';
import { SincronizacaoMlProvider } from './features/mercadolivre/SincronizacaoMlContext';
import { VisualizadorFotos } from './components/ui/VisualizadorFotos';
import { UnidadesEstoque } from './features/estoque/UnidadesEstoque';
import { contarAvarias } from './features/estoque/valorEstoque';
import { NotaCadastroBadge } from './components/NotaCadastroBadge';
import { PromocaoBadge } from './features/promocoes/PromocaoBadge';
import { ComprovantesPixVenda } from './features/comprovantes/ComprovantesPixVenda';
import { VendaClienteResumo } from './features/vendas/VendaClienteResumo';
import type { Tab } from './constants/navigation';
import { telaImersiva } from './appShell';
import { usePermissao } from './hooks/usePermissao';
import { FloatingNotaButton } from './components/DeclaracaoVenda';
import type { Estoque } from './features/estoque/types';
import type { Venda } from './features/vendas/types';

// Cada aba carrega sua própria implementação quando é aberta. Isso reduz o
// JavaScript inicial, sobretudo no iPhone, sem mudar o estado nem as rotas.
const EstoqueView = React.lazy(() => import('./features/estoque/EstoqueView').then((mod) => ({ default: mod.EstoqueView })));
const EstoquePreview = React.lazy(() => import('./features/estoque-preview/EstoquePreview').then((mod) => ({ default: mod.EstoquePreview })));
const VendasView = React.lazy(() => import('./features/vendas/VendasView').then((mod) => ({ default: mod.VendasView })));
const VendasPreview = React.lazy(() => import('./features/vendas-preview/VendasPreview').then((mod) => ({ default: mod.VendasPreview })));
const OrcamentosView = React.lazy(() => import('./features/orcamentos/OrcamentosView').then((mod) => ({ default: mod.OrcamentosView })));
const ClientesView = React.lazy(() => import('./features/clientes/ClientesView').then((mod) => ({ default: mod.ClientesView })));
const CaixaView = React.lazy(() => import('./features/caixa/CaixaView').then((mod) => ({ default: mod.CaixaView })));
const FreteView = React.lazy(() => import('./features/frete/FreteView').then((mod) => ({ default: mod.FreteView })));
const MercadoLivreView = React.lazy(() => import('./features/mercadolivre/MercadoLivreView').then((mod) => ({ default: mod.MercadoLivreView })));
const DashboardView = React.lazy(() => import('./features/dashboard/DashboardView').then((mod) => ({ default: mod.DashboardView })));
const ConfiguracoesView = React.lazy(() => import('./features/configuracoes/ConfiguracoesView').then((mod) => ({ default: mod.ConfiguracoesView })));
const TarefasView = React.lazy(() => import('./features/tarefas/TarefasView').then((mod) => ({ default: mod.TarefasView })));
const PatchNotesView = React.lazy(() => import('./features/patchnotes/PatchNotesView').then((mod) => ({ default: mod.PatchNotesView })));
const NotificacoesView = React.lazy(() => import('./features/notificacoes/NotificacoesView').then((mod) => ({ default: mod.NotificacoesView })));

type DetailItem = Estoque | Venda;
// 'fiado' saiu da navegação: virou sub-aba do Caixa. Não fica em VALID_TABS
// pra a URL /fiado não abrir mais uma aba solta — os botões que iam pra lá
// agora redirecionam pro Caixa na sub-aba de vendas fiado.
const VALID_TABS: Tab[] = ['dashboard', 'estoque', 'vendas', 'vendas-antigo', 'orcamentos', 'clientes', 'caixa', 'frete', 'mercadolivre', 'configuracoes', 'tarefas', 'patchnotes', 'notificacoes', 'estoque-antigo'];

// /estoque é o novo módulo (features/estoque-preview) desde 24/09/2026; a tela
// antiga continua em /estoque-antigo para anúncios, famílias e gavetas. As
// duas usam a mesma permissão de ver estoque.
function permissaoDeVer(tab: Tab) {
  return tab === 'estoque-antigo' ? 'estoque.ver' : tab === 'vendas-antigo' ? 'vendas.ver' : `${tab}.ver`;
}

// Primeira aba que o usuário pode VER — usada como fallback quando a URL pede
// uma aba que ele não tem permissão de ver. `dashboard` como último recurso
// (nunca deveria acontecer: todo usuário vê ao menos patchnotes/notificacoes).
function primeiraAbaPermitida(pode: (chave: string) => boolean): Tab {
  return (VALID_TABS.find((tab) => pode(permissaoDeVer(tab))) ?? 'dashboard') as Tab;
}

function isVenda(item: DetailItem): item is Venda {
  return 'valor_total' in item;
}

// =============================================================================
// AUTENTICAÇÃO
// =============================================================================

// Acesso via localhost pula a tela de login — conveniência de desenvolvimento
// local, espelha o bypass equivalente em middleware/auth.ts no backend. Exclui
// plataforma nativa de propósito: o Capacitor no Android serve o WebView em
// https://localhost/ por padrão, então sem o !isNativePlatform() o app
// empacotado (APK) também cairia nesse bypass e logaria como admin sozinho.
const IS_LOCALHOST = !Capacitor.isNativePlatform() && ['localhost', '127.0.0.1'].includes(window.location.hostname);

// Uma vez que alguém desloga explicitamente em localhost, o bypass acima para
// de reautenticar sozinho nesta aba/sessão — senão o logout nunca "pega" (o
// reload volta a cair no bypass e reloga como admin na hora). Fica em
// sessionStorage de propósito: reseta ao fechar a aba, então não altera o
// fluxo padrão de dev em sessões novas, só depois de um logout explícito.
const FORCE_REAL_AUTH_KEY = 'rk_force_real_auth';

export default function App() {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuthStatus = () => {
      const forcarAuthReal = sessionStorage.getItem(FORCE_REAL_AUTH_KEY) === '1';
      if (IS_LOCALHOST && !forcarAuthReal) {
        setIsUserAuthenticated(true);
        if (window.location.pathname === '/' || window.location.pathname.toLowerCase() === '/login') {
          window.history.replaceState(null, '', '/dashboard');
        }
        return;
      }

      const token = localStorage.getItem('auth_token');
      const roles = localStorage.getItem('user_roles');

      if (token && roles) {
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
    sessionStorage.setItem(FORCE_REAL_AUTH_KEY, '1');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_roles');
    localStorage.removeItem('user_permissoes');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_id');
    setIsUserAuthenticated(false);
    window.location.href = '/login';
  };

  if (isUserAuthenticated === null) {
    return (
      <div className="min-h-screen bg-surface-page flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
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
    // ConfirmProvider no nível mais externo do app autenticado: qualquer
    // feature (Estoque, Vendas, Caixa, etc.) precisa poder chamar useConfirm()
    // pra substituir window.confirm, então tem que envolver DataProvider
    // inteiro, não só AppContent — senão qualquer provider ficaria fora do
    // alcance do diálogo.
    <ConfirmProvider>
      <DataProvider>
        {/* SincronizacaoMlProvider por fora do AppContent pelo mesmo motivo do
            Toaster logo abaixo: precisa sobreviver à troca de aba, senão o
            toast "Sincronizar agora" (disparado de Vendas/Orçamentos) para de
            funcionar assim que a pessoa sai daquela tela antes de clicar. */}
        <SincronizacaoMlProvider>
          <AppContent onLogout={handleLogout} />
        </SincronizacaoMlProvider>
        {/* Fora do AppContent pra sobreviver à troca de aba e continuar
            aparecendo mesmo na tela de login. */}
        <Toaster />
      </DataProvider>
    </ConfirmProvider>
  );
}

// =============================================================================
// DETAIL MODAL — mostra um item de Estoque ou uma Venda
// =============================================================================

const DetailItemBox = ({ label, value, icon: Icon }: { label: string; value: any; icon: any }) => (
  <div className={cn('p-4 rounded-2xl border flex flex-col gap-1.5', 'bg-surface-card/40 border-border-default/50')}>
    <div className="flex items-center gap-2 text-text-muted">
      <Icon size={14} strokeWidth={2.5} />
      <span className="text-[10px] uppercase font-black tracking-widest">{label}</span>
    </div>
    <span className={cn('text-sm md:text-base font-black truncate uppercase', 'text-text-primary')}>{value ?? '-'}</span>
  </div>
);

function DetailModal({
  item,
  onClose,
  onEdit,
  onDelete,
  readOnly,
  onAlterado,
  onAbrirFiado,
  fiadoRecebimentos = [],
  vendas: todasAsVendas = [],
}: {
  item: DetailItem;
  onClose: () => void;
  onEdit?: (item: DetailItem) => void;
  onDelete?: (id: string) => void;
  readOnly?: boolean;
  onAlterado?: () => void;
  onAbrirFiado?: () => void;
  fiadoRecebimentos?: FiadoRecebimento[];
  vendas?: Venda[];
}) {
  const { pode } = usePermissao();
  const podeExcluirComprovante = pode('vendas.excluir_comprovante');
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
    <>
      <Modal
        aberto={true}
        onFechar={onClose}
        titulo={titulo}
        tamanho="lg"
        rodape={
          onEdit || onDelete || estoque ? (
            <div className={cn('grid gap-3', onEdit && onDelete && estoque ? 'grid-cols-3' : 'grid-cols-2')}>
              {onEdit && (
                <Button
                  variant="outline"
                  onClick={() => {
                    onEdit(item);
                    onClose();
                  }}
                  className="h-auto py-4 rounded-control gap-2 font-black text-xs uppercase tracking-[0.2em] bg-surface-card border-border-default text-text-primary hover:bg-surface-raised"
                >
                  <Edit size={16} /> Editar
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="destructive"
                  // Sem window.confirm aqui: quem recebe o onDelete já abre
                  // a própria confirmação (Estoque) ou o modal de
                  // cancelamento (Vendas) — eram duas perguntas seguidas.
                  onClick={() => {
                    onDelete((item as any).id);
                    onClose();
                  }}
                  className="h-auto py-4 rounded-control gap-2 font-black text-xs uppercase tracking-[0.2em] bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20"
                >
                  <Trash2 size={16} /> Excluir
                </Button>
              )}
              {/* WhatsApp só faz sentido pra Estoque (falar sobre a peça) —
                  numa venda já concluída não há nada a "compartilhar". Virou
                  uma ação secundária pequena, não mais o CTA principal do modal —
                  por isso a cor positive/emerald (nem erro, nem o acento
                  principal da tela) em vez do accent usado antes. */}
              {estoque && (
                <Button
                  variant="outline"
                  onClick={handleWhatsAppShare}
                  title="Compartilhar no WhatsApp"
                  className="h-auto py-4 rounded-control gap-2 font-black text-xs uppercase tracking-[0.2em] bg-positive/10 border-positive/20 text-positive hover:bg-positive/20"
                >
                  <MessageCircle size={16} /> WhatsApp
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        <div className="-mx-5 -mt-5 md:-mx-6 md:-mt-6">
          <div className="relative aspect-[4/3] w-full bg-surface-inset overflow-hidden flex items-center justify-center">
            {imagens[indiceImagem] ? (
              <button type="button" onClick={() => setFotoCheiaAberta(true)} className="w-full h-full cursor-zoom-in">
                <img src={imagens[indiceImagem]} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt={titulo} />
              </button>
            ) : (
              <Package size={64} strokeWidth={1} className="opacity-10 text-text-faint" />
            )}
            {imagens.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {imagens.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndiceImagem(i)}
                    aria-label={`Foto ${i + 1}`}
                    className={cn('size-1.5 rounded-full transition-colors', i === indiceImagem ? 'bg-white' : 'bg-media-overlay-dot')}
                  />
                ))}
              </div>
            )}
          </div>

          {imagens.length > 1 && (
            <div className="flex gap-2 px-5 md:px-6 pt-4 overflow-x-auto scrollbar-hide">
              {imagens.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setIndiceImagem(i)}
                  className={cn('size-14 rounded-xl overflow-hidden border-2 shrink-0 transition-colors', i === indiceImagem ? 'border-accent' : 'border-transparent')}
                >
                  <img src={url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt={`${titulo} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-8 pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest rounded-full border border-accent/20">
                  {venda ? 'Venda' : estoque?.categoria?.nome || 'Peça'}
                </span>
                {estoque && <NotaCadastroBadge value={estoque.nota_cadastro} />}
              </div>
              {estoque?.codigo && <span className="text-text-muted text-[10px] font-mono font-bold">#{estoque.codigo}</span>}
            </div>
            {estoque?.promocao_ativa ? (
              <div className="flex items-end gap-3 flex-wrap">
                <div className="text-4xl md:text-5xl font-black tracking-tighter text-text-primary">{formatCurrency(estoque.promocao_ativa.valor_promocional)}</div>
                <div className="flex flex-col gap-1 pb-1">
                  <span className="text-base font-bold text-text-muted line-through">{formatCurrency(valor)}</span>
                  <PromocaoBadge promocao={estoque.promocao_ativa} />
                </div>
              </div>
            ) : (
              <div className="text-4xl md:text-5xl font-black tracking-tighter text-text-primary">{formatCurrency(valor)}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {estoque && (
              <>
                <DetailItemBox
                  label="Quantidade"
                  value={contarAvarias(estoque) > 0 ? `${estoque.quantidade} · ${contarAvarias(estoque)} c/ avaria` : estoque.quantidade}
                  icon={Package}
                />
                <DetailItemBox label="Modelo de Moto" value={estoque.modelo_moto?.nome || 'Universal'} icon={Truck} />
                <DetailItemBox label="Condição" value={estoque.condicao === 'original' ? 'Original' : 'Paralela'} icon={Wrench} />
                {estoque.condicao_nota != null && <DetailItemBox label="Estado físico" value={`${estoque.condicao_nota}/10`} icon={Gauge} />}
                <DetailItemBox label="Ano" value={estoque.ano} icon={Calendar} />
              </>
            )}
            {venda && (
              <>
                <DetailItemBox label="Quantidade" value={venda.quantidade} icon={Package} />
                {(() => {
                  const efetiva = formaPagamentoEfetiva(venda, fiadoRecebimentos);
                  const valorPagamento = efetiva ? `${efetiva.formas.join(', ')}${efetiva.quitadoTotal ? '' : ' (parcial)'}` : venda.forma_pagamento?.nome;
                  return <DetailItemBox label="Pagamento" value={valorPagamento} icon={CreditCard} />;
                })()}
                <DetailItemBox label="Data" value={new Date(venda.data).toLocaleDateString('pt-BR')} icon={Calendar} />
                {venda.cliente_nome && <DetailItemBox label="Cliente" value={venda.cliente_nome} icon={Edit} />}
              </>
            )}
          </div>

          {venda && formaPagamentoEfetiva(venda, fiadoRecebimentos) && (
            <div className={cn('p-4 rounded-3xl border space-y-1.5', 'bg-surface-card/30 border-border-subtle')}>
              <h4 className="text-[10px] font-black uppercase text-accent-soft-fg tracking-[0.1em]">Recebimentos deste fiado</h4>
              {fiadoRecebimentos
                .filter((r) => r.venda_id === venda.id)
                .sort((a, b) => new Date(b.recebido_em).getTime() - new Date(a.recebido_em).getTime())
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-xs">
                    <span className={'text-text-faint'}>
                      {new Date(r.recebido_em).toLocaleDateString('pt-BR')} · {r.forma_pagamento?.nome || '—'}
                    </span>
                    <span className="font-medium text-text-secondary">{formatCurrency(r.valor)}</span>
                  </div>
                ))}
            </div>
          )}

          {venda && (
            <div className="space-y-4">
              <ComprovantesPixVenda vendaId={venda.id} podeExcluir={podeExcluirComprovante} readOnly={readOnly} />
              {venda.cliente_id && (
                <VendaClienteResumo
                  clienteId={venda.cliente_id}
                  venda={venda}
                  podeExcluirComprovante={podeExcluirComprovante}
                  onAbrirFiado={
                    onAbrirFiado
                      ? () => {
                          onAbrirFiado();
                          onClose();
                        }
                      : undefined
                  }
                />
              )}
            </div>
          )}

          {(estoque?.descricao || venda?.observacoes) && (
            <div className={cn('p-6 rounded-3xl border space-y-2', 'bg-surface-card/30 border-border-subtle')}>
              <h4 className="text-[10px] font-black uppercase text-accent-soft-fg tracking-[0.1em] flex items-center gap-2">
                <FileText size={14} /> {venda ? 'Observações' : 'Descrição'}
              </h4>
              <p className={cn('text-sm leading-relaxed', 'text-text-secondary')}>{estoque?.descricao || venda?.observacoes}</p>
            </div>
          )}

          {/* Venda em partes: mostra o cálculo antes mesmo de abrir uma
              venda nova, não só no momento de vender (ver VendasView). */}
          {estoque && (estoque.unidades_incompletas?.length ?? 0) > 0 && (
            <div className={cn('p-4 rounded-3xl border', 'bg-surface-card/30 border-border-subtle')}>
              <h4 className="text-[10px] font-black uppercase text-accent-soft-fg tracking-[0.1em] mb-2">Venda em partes</h4>
              <p className="text-xs text-text-muted mb-1">
                {estoque.unidades_incompletas.length} unidade(s) incompleta(s) — falta: {estoque.unidades_incompletas.map((u) => u.faltando.join(', ')).join(' · ')}
              </p>
              <p className="text-xs text-text-muted">
                Valor original: {formatCurrency(estoque.valor)} · Já vendido em partes: {formatCurrency(valorVendidoEmPartes(estoque.id, todasAsVendas))} · Restante:{' '}
                {formatCurrency(valorRestanteEstimado(estoque.valor, estoque.id, todasAsVendas))}
              </p>
            </div>
          )}

          {/* Unidades físicas desta peça: mesma peça, uma linha só no
              estoque, mas cada unidade diferente (nota própria, avaria,
              nome ou preço) ganha ficha e foto. */}
          {estoque && <UnidadesEstoque item={estoque} readOnly={readOnly} onAlterado={onAlterado} />}
        </div>
      </Modal>

      {fotoCheiaAberta && imagens.length > 0 && (
        <VisualizadorFotos fotos={imagens} indice={indiceImagem} onTrocar={setIndiceImagem} onFechar={() => setFotoCheiaAberta(false)} />
      )}
    </>
  );
}

// =============================================================================
// LOGOUT MODAL
// =============================================================================

const LogoutModal = memo(({ isOpen, onClose, onLogout }: { isOpen: boolean; onClose: () => void; onLogout: () => void }) => {
  return (
    <Modal
      aberto={isOpen}
      onFechar={onClose}
      titulo="Sair da conta?"
      tamanho="sm"
      rodape={
        <div className="flex flex-col gap-3">
          <button onClick={onLogout} className="w-full bg-danger hover:opacity-90 text-surface-page py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl">
            Sim, Sair Agora
          </button>
          <button onClick={onClose} className={cn('w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em]', 'bg-surface-card text-text-secondary hover:bg-surface-raised')}>
            Cancelar
          </button>
        </div>
      }
    >
      <p className="text-sm text-text-secondary">Tem certeza que deseja encerrar sua sessão atual?</p>
    </Modal>
  );
});

// =============================================================================
// APP CONTENT — layout + navegação
// =============================================================================

const TAB_LABELS: Record<Tab, string> = { dashboard: 'Dashboard', estoque: 'Estoque', 'estoque-antigo': 'Estoque · tela antiga', vendas: 'Vendas', 'vendas-antigo': 'Vendas · tela anterior', orcamentos: 'Orçamentos', clientes: 'Clientes', fiado: 'Fiado', caixa: 'Caixa', frete: 'Frete', mercadolivre: 'Mercado Livre', configuracoes: 'Configurações', tarefas: 'Tarefas', patchnotes: 'Novidades', notificacoes: 'Notificações' };

function AppContent({ onLogout }: { onLogout: () => void }) {
  // Usado pelo modal de detalhes pra recarregar a lista depois de mexer nas
  // fichas de unidade (badge de avaria e valor total dependem disso), pra
  // mostrar a forma de pagamento efetiva de uma venda fiado já quitada, e pro
  // cálculo de quanto já foi vendido em partes de um item incompleto.
  const { refreshData, fiadoRecebimentos, vendas: todasAsVendas } = useData();

  // Permissões do usuário logado (ver src/hooks/usePermissao.ts). Substitui o
  // controle por cargo: `pode('tela.acao')` decide o que aparece, `isAdmin`
  // marca o super-usuário. No localhost o hook já devolve admin (mesmo bypass
  // de dev de App/middleware).
  const { pode, isAdmin } = usePermissao();

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const path = window.location.pathname.replace('/', '') as Tab;
    const abaValida = VALID_TABS.includes(path);
    if (abaValida && pode(permissaoDeVer(path))) return path;
    // Aba inexistente OU sem permissão de ver: cai na primeira aba que o
    // usuário pode ver, em vez de sempre tentar 'dashboard'.
    return primeiraAbaPermitida(pode);
  });
  const [pendingEditItem, setPendingEditItem] = useState<Estoque | null>(null);
  const [pendingEstoqueBaixo, setPendingEstoqueBaixo] = useState(false);
  const [pendingClienteId, setPendingClienteId] = useState<string | null>(null);
  const [pendingFiltroSumidos, setPendingFiltroSumidos] = useState(false);
  // Abre o Caixa já na sub-aba de vendas fiado (deep-link que antes ia pra aba Fiado).
  const [pendingCaixaFiado, setPendingCaixaFiado] = useState(false);
  const [pendingTaskNotificationId, setPendingTaskNotificationId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [selectedDetailItem, setSelectedDetailItem] = useState<DetailItem | null>(null);
  const [estoqueActions, setEstoqueActions] = useState<{ edit: (item: Estoque) => void; delete: (id: string) => void } | null>(null);
  const [vendasActions, setVendasActions] = useState<{ edit: (item: Venda) => void; delete: (id: string) => void } | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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

  // "Venda rápida" do modal de família navega aqui via evento customizado
  useEffect(() => {
    const handler = () => setActiveTab('vendas');
    window.addEventListener('rk:ir-para-vendas', handler);
    return () => window.removeEventListener('rk:ir-para-vendas', handler);
  }, []);

  const abrirEstoqueAntigo = useCallback(() => setActiveTab('estoque-antigo'), []);
  const filtroEstoqueBaixoAplicado = useCallback(() => setPendingEstoqueBaixo(false), []);
  const abrirNotificacaoTarefa = useCallback((taskId: string) => {
    setPendingTaskNotificationId(taskId);
    setActiveTab('tarefas');
  }, []);
  const notificacaoTarefaTratada = useCallback((taskId: string) => {
    setPendingTaskNotificationId((current) => current === taskId ? null : current);
  }, []);
  // As ações de editar/excluir peça vêm da tela antiga. Fora dela a referência
  // apontaria para um componente desmontado: limpa, e o "Editar" do detalhe
  // leva à tela antiga (wrapEdit abaixo).
  useEffect(() => {
    if (activeTab !== 'estoque-antigo') setEstoqueActions(null);
  }, [activeTab]);
  useEffect(() => {
    if (activeTab !== 'vendas-antigo') setVendasActions(null);
  }, [activeTab]);
  const imersiva = telaImersiva(activeTab);

  const itemActions = useMemo(() => {
    if (!selectedDetailItem) return { edit: undefined, delete: undefined };

    const wrapEdit = (originalEdit: any, tab: Tab) => (item: any) => {
      if (activeTab !== tab) {
        setActiveTab(tab);
        if (tab === 'estoque-antigo') setPendingEditItem(item);
      } else {
        originalEdit?.(item);
      }
    };

    if (isVenda(selectedDetailItem)) {
      return { edit: undefined, delete: vendasActions?.delete };
    }
    // Edição completa da peça (anúncios, família, gaveta) continua na tela antiga.
    return { edit: wrapEdit(estoqueActions?.edit, 'estoque-antigo'), delete: estoqueActions?.delete };
  }, [selectedDetailItem, estoqueActions, vendasActions, activeTab]);

  return (
    <div
      data-project="rk-sucatas-new"
      data-project-label="RK Sucatas · NOVO SISTEMA"
      className={cn('min-h-[100dvh] transition-colors duration-300 flex font-sans w-full relative overflow-x-hidden', 'bg-[radial-gradient(ellipse_at_top,_var(--color-surface-raised),_var(--color-surface-page))] text-text-primary')}
    >
      {/* Main Content */}
      <main className={cn(
        'flex min-w-0 flex-1 flex-col transition-all duration-300',
        !imersiva && 'pb-[calc(5.75rem+env(safe-area-inset-bottom))]',
      )}>
        {/* No mobile o título da view já aparece grande dentro de cada tela;
            este header só existe pra desktop, pra não duplicar o nome no topo. */}
        {!imersiva && (
          <header className={cn('min-h-16 border-b backdrop-blur-md hidden md:flex items-center justify-between px-4 md:px-6 sticky top-0 z-[100] pt-safe', 'bg-surface-inset/40 border-border-default/50')}>
            <div className="flex items-center gap-2 md:gap-4">
              <h2 className={cn('text-base md:text-lg font-semibold capitalize', 'text-text-primary')}>{TAB_LABELS[activeTab]}</h2>
            </div>
          </header>
        )}

        <div
          ref={contentRef}
          className={imersiva
            ? 'min-h-[100dvh] w-full min-w-0 overflow-x-hidden'
            : 'flex-1 overflow-y-auto overflow-x-hidden p-4 pt-[calc(env(safe-area-inset-top)+1rem)] md:p-6 md:pt-6'}
        >
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full h-full">
              <React.Suspense fallback={<div role="status" className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-text-muted"><Loader2 size={18} className="animate-spin" />Carregando aba…</div>}>
              {activeTab === 'dashboard' ? (
                <DashboardView
                  onSelectItem={setSelectedDetailItem}
                  onTabChange={(tab) => setActiveTab(tab as Tab)}
                  onOpenSearch={() => setIsSearchOpen(true)}
                  onNavigateEstoqueBaixo={() => {
                    setActiveTab('estoque');
                    setPendingEstoqueBaixo(true);
                  }}
                  onNavigateCliente={(clienteId) => {
                    setActiveTab('clientes');
                    setPendingClienteId(clienteId);
                  }}
                  onNavigateClientesSumidos={() => {
                    setActiveTab('clientes');
                    setPendingFiltroSumidos(true);
                  }}
                  onNavigateFiado={() => {
                    setActiveTab('caixa');
                    setPendingCaixaFiado(true);
                  }}
                />
              ) : activeTab === 'estoque' ? (
                <EstoquePreview
                  embutido
                  onAbrirEstoqueAntigo={abrirEstoqueAntigo}
                  filtroEstoqueBaixoInicial={pendingEstoqueBaixo}
                  onFiltroEstoqueBaixoAplicado={filtroEstoqueBaixoAplicado}
                  onOpenTaskNotification={abrirNotificacaoTarefa}
                />
              ) : activeTab === 'estoque-antigo' ? (
                <div className="space-y-4">
                  <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-default bg-surface-card px-4 py-3 text-sm text-text-secondary">
                    <span><strong className="text-text-primary">Tela antiga do estoque.</strong> Use para anúncios, famílias e gavetas. Busca, unidades, endereços e reservas agora ficam no novo Estoque.</span>
                    <button type="button" onClick={() => setActiveTab('estoque')} className="min-h-11 cursor-pointer rounded-control border border-border-default px-3 text-sm font-semibold text-text-primary transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Voltar ao novo Estoque</button>
                  </div>
                  <EstoqueView
                    onSelectItem={setSelectedDetailItem}
                    onRegisterActions={setEstoqueActions}
                    pendingEditItem={pendingEditItem}
                    setPendingEditItem={setPendingEditItem}
                    readOnly={!(pode('estoque.criar') || pode('estoque.editar') || pode('estoque.deletar') || pode('estoque.anunciar_ml') || pode('estoque.anunciar_shopee'))}
                  />
                </div>
              ) : activeTab === 'vendas' ? (
                <VendasPreview embutido onAbrirVendasAntigas={() => setActiveTab('vendas-antigo')} />
              ) : activeTab === 'vendas-antigo' ? (
                <div className="space-y-4">
                  <div role="note" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-default bg-surface-card px-4 py-3 text-sm text-text-secondary">
                    <span>Esta tela mantém as ações anteriores de gerenciamento de vendas.</span>
                    <button type="button" onClick={() => setActiveTab('vendas')} className="min-h-11 rounded-control border border-border-default px-3 text-sm font-semibold text-text-primary hover:text-accent">Voltar à nova tela</button>
                  </div>
                  <VendasView onSelectItem={setSelectedDetailItem} onRegisterActions={setVendasActions} />
                </div>
              ) : activeTab === 'orcamentos' ? (
                <OrcamentosView />
              ) : activeTab === 'clientes' ? (
                <ClientesView
                  pendingClienteId={pendingClienteId}
                  setPendingClienteId={setPendingClienteId}
                  pendingFiltroSumidos={pendingFiltroSumidos}
                  setPendingFiltroSumidos={setPendingFiltroSumidos}
                />
              ) : activeTab === 'caixa' ? (
                <CaixaView pendingFiado={pendingCaixaFiado} setPendingFiado={setPendingCaixaFiado} />
              ) : activeTab === 'frete' ? (
                <FreteView />
              ) : activeTab === 'mercadolivre' ? (
                <MercadoLivreView />
              ) : activeTab === 'tarefas' ? (
                <TarefasView initialTaskId={pendingTaskNotificationId} onInitialTaskHandled={notificacaoTarefaTratada} />
              ) : activeTab === 'patchnotes' ? (
                <PatchNotesView />
              ) : activeTab === 'notificacoes' ? (
                <NotificacoesView />
              ) : (
                <ConfiguracoesView />
              )}
              </React.Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <TasksNavigationDock
        activeTab={activeTab === 'estoque-antigo' ? 'estoque' : activeTab === 'vendas-antigo' ? 'vendas' : activeTab}
        onTabChange={setActiveTab}
        onLogoutClick={() => setIsLogoutModalOpen(true)}
      />

      {!imersiva && (
        <div className="fixed bottom-24 md:bottom-8 right-6 z-[60] flex flex-col gap-3">
          {/* O Dashboard já oferece busca no cabeçalho e precisa manter a área
              de leitura livre no mobile; os FABs continuam disponíveis nas
              telas operacionais onde não há esse atalho no topo. */}
          {activeTab !== 'dashboard' && <FloatingNotaButton />}
          {activeTab !== 'dashboard' && <GlobalSearch onSelectItem={setSelectedDetailItem} isOpen={isSearchOpen} setIsOpen={setIsSearchOpen} customClick={() => setIsSearchOpen(true)} />}
        </div>
      )}

      {selectedDetailItem && (
        <DetailModal
          item={selectedDetailItem}
          onClose={() => setSelectedDetailItem(null)}
          onEdit={itemActions.edit}
          onDelete={itemActions.delete}
          readOnly={!(pode('estoque.editar') || pode('vendas.editar'))}
          onAlterado={refreshData}
          onAbrirFiado={() => {
            setActiveTab('caixa');
            setPendingCaixaFiado(true);
          }}
          fiadoRecebimentos={fiadoRecebimentos}
          vendas={todasAsVendas}
        />
      )}

      <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} onLogout={onLogout} />
    </div>
  );
}
