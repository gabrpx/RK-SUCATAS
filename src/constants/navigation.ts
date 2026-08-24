// Fonte única dos itens de navegação (sidebar desktop + bottom nav mobile),
// pra não correr risco das duas listas ficarem dessincronizadas — ver mesmo
// raciocínio em roles.ts. `group` é usado só pra organizar visualmente em
// seções (sidebar) e clusters (menu "Mais" do mobile); não afeta permissão.
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Package,
  Truck,
  Store,
  ShoppingCart,
  Receipt,
  Wallet,
  Users,
  ClipboardList,
  Settings,
  ScrollText,
  Bell,
} from 'lucide-react';
import { TAB_ROLES, type Role } from './roles';

export type Tab = 'dashboard' | 'estoque' | 'vendas' | 'orcamentos' | 'clientes' | 'fiado' | 'caixa' | 'frete' | 'mercadolivre' | 'configuracoes' | 'tarefas' | 'patchnotes' | 'notificacoes';

export type NavGroup = 'estoque' | 'vendas' | 'gestao' | null;

export interface NavItem {
  id: Tab;
  icon: LucideIcon;
  label: string;
  /** Override curto pra caber na barra/menu do mobile; se ausente usa `label`. */
  mobileLabel?: string;
  group: NavGroup;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', mobileLabel: 'Início', group: null, roles: TAB_ROLES.dashboard },
  { id: 'estoque', icon: Package, label: 'Estoque', group: 'estoque', roles: TAB_ROLES.estoque },
  { id: 'frete', icon: Truck, label: 'Frete', group: 'estoque', roles: TAB_ROLES.frete },
  { id: 'mercadolivre', icon: Store, label: 'Mercado Livre', group: 'estoque', roles: TAB_ROLES.mercadolivre },
  { id: 'vendas', icon: ShoppingCart, label: 'Vendas', group: 'vendas', roles: TAB_ROLES.vendas },
  { id: 'orcamentos', icon: Receipt, label: 'Orçamentos', group: 'vendas', roles: TAB_ROLES.orcamentos },
  // Fiado deixou de ser aba própria: o recebimento de vendas fiado agora vive
  // como sub-aba dentro do Caixa (ver CaixaView), pra ficar junto de Pendências.
  { id: 'caixa', icon: Wallet, label: 'Caixa', group: 'vendas', roles: TAB_ROLES.caixa },
  { id: 'clientes', icon: Users, label: 'Clientes', group: 'gestao', roles: TAB_ROLES.clientes },
  { id: 'tarefas', icon: ClipboardList, label: 'Tarefas', group: 'gestao', roles: TAB_ROLES.tarefas },
  { id: 'configuracoes', icon: Settings, label: 'Configurações', mobileLabel: 'Config', group: null, roles: TAB_ROLES.configuracoes },
  { id: 'patchnotes', icon: ScrollText, label: 'Novidades', group: 'gestao', roles: TAB_ROLES.patchnotes },
  { id: 'notificacoes', icon: Bell, label: 'Notificações', group: 'gestao', roles: TAB_ROLES.notificacoes },
];

export const NAV_GROUP_LABELS: Record<Exclude<NavGroup, null>, string> = {
  estoque: 'Estoque',
  vendas: 'Vendas',
  gestao: 'Gestão',
};
