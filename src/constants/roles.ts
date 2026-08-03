// Papéis reais de login (ver supabase/migration_011_usuarios.sql,
// supabase/migration_013_mecanico.sql e middleware/auth.ts) e o mapa único de
// "quem vê qual aba" — fonte compartilhada entre App.tsx (sidebar + guard de
// rota), MobileBottomNav.tsx e o backend (server.ts + src/server/routes/*),
// pra não correr risco das listas ficarem dessincronizadas. server.ts importa
// este arquivo diretamente (tudo roda no mesmo projeto TS via tsx), então
// backend e frontend sempre leem a mesma definição de cargo.
export type Role = 'admin' | 'equipe' | 'estoque_leitura' | 'mandados' | 'mecanico';

export const ALL_ROLES: Role[] = ['admin', 'equipe', 'estoque_leitura', 'mandados', 'mecanico'];

export const TAB_ROLES: Record<string, Role[]> = {
  dashboard: ['admin', 'equipe'],
  estoque: ['admin', 'equipe', 'estoque_leitura'],
  vendas: ['admin', 'equipe'],
  orcamentos: ['admin', 'equipe'],
  caixa: ['admin', 'equipe'],
  frete: ['admin', 'equipe'],
  configuracoes: ['admin', 'equipe'],
  tarefas: ['admin', 'equipe', 'mandados', 'mecanico'],
};

// Cargos "de campo" que só recebem tarefas e dão baixa nas próprias —
// 'mandados' (Pitoco) e 'mecanico' (Itinho) têm hoje exatamente o mesmo
// acesso dentro de Tarefas; por enquanto tratados como equivalentes só
// pra essa funcionalidade, mas como papéis distintos no cadastro de usuário
// pra poder divergir depois sem precisar migrar dado nenhum.
export const EXECUTORES_TAREFA: Role[] = ['mandados', 'mecanico'];
