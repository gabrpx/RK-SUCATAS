import type { Tab } from './constants/navigation';

// Módulos com casca própria no padrão operacional novo não devem herdar o
// cabeçalho, o espaçamento ou o fundo das telas legadas do App.
export function telaImersiva(tab: Tab): boolean {
  return tab === 'tarefas' || tab === 'estoque' || tab === 'vendas' || tab === 'clientes';
}
