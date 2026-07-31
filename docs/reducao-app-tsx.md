# Redução do `src/App.tsx` sem perda de funcionalidade

## Diagnóstico rápido

- Arquivo com ~5.5k linhas e múltiplas responsabilidades (auth, dados globais, roteamento, views, modais, UI de layout, utilitários, integrações externas).
- Há sinais claros de "monólito de tela": muitos `useState`, muitos `useEffect`, componentes grandes no mesmo arquivo e lógica de domínio misturada com renderização.
- Existe código já parcialmente modularizado (`views`, `components`, `utils`), o que facilita extração incremental sem quebrar comportamento.

## O que pode ser feito (prioridade alta, baixo risco)

1. **Extrair hooks utilitários do topo do arquivo**
   - Mover `useDebounce`, `fetchWithRetry`, `parseJson` para `src/hooks/` e `src/lib/api/`.
   - Benefício: remove blocos genéricos de infraestrutura do `App.tsx`.

2. **Extrair helpers de domínio**
   - Mover `normalizarTexto`, `extrairModeloMoto`, `extrairCategoria` para `src/domain/motos/` (ou `src/utils/motos.ts`).
   - Benefício: separa regra de negócio da camada de UI.

3. **Extrair `DataContext` + `DataProvider`**
   - Criar `src/contexts/DataContext.tsx` com estado, cache, polling e `refreshData`.
   - Benefício: reduz centenas de linhas e deixa `App.tsx` focado em composição.

4. **Separar componentes locais grandes**
   - Mover `SalesView`, `MotosView`, `DetailModal`, `MotoCard`, `LogoutModal`, `SidebarItem` para arquivos próprios em `src/views/` e `src/components/`.
   - Benefício: maior ganho de tamanho imediato, sem mudar regra funcional.

5. **Extrair estado e handlers de `AppContent` para hook**
   - Criar `useAppShellState` (tema, sidebar, modais, filtros globais, atalhos, URL tab sync).
   - Benefício: JSX fica legível e lógica de controle centralizada.

6. **Dividir o layout principal por áreas**
   - Quebrar `AppContent` em: `AppSidebar`, `AppHeader`, `AppMainContent`, `AppModals`.
   - Benefício: reduz complexidade cognitiva e facilita manutenção.

## O que pode ser feito (prioridade média)

7. **Extrair integração de notificações (Firestore)**
   - Criar hook `useNotifications(currentUser)`.
   - Benefício: remove efeito com assinatura de snapshot do componente principal.

8. **Extrair fluxo de foto de perfil**
   - Criar hook `useProfilePhoto`.
   - Benefício: separa upload/remoção/cache local do shell de navegação.

9. **Extrair lógica Mercado Livre**
   - Criar hooks `useMlDashboard` e `useMlListings`.
   - Benefício: isola integração externa e reduz blocos de estado derivados.

10. **Padronizar tipos em vez de `any`**
    - Criar tipos (`InventoryItem`, `SaleItem`, `MotoItem`, `NotificationItem`).
    - Benefício: reduz bugs em refatoração e melhora autocompletar sem alterar funcionalidade.

## O que pode ser feito (prioridade baixa, otimizações)

11. **Diminuir imports do `lucide-react` no arquivo raiz**
    - Distribuir ícones por componente após extração.
    - Benefício: `App.tsx` deixa de concentrar dependências visuais.

12. **Consolidar efeitos de lock de scroll/modais**
    - Criar hook único `useBodyScrollLock`.
    - Benefício: remove duplicação de `useEffect`.

13. **Consolidar sincronização de URL/tab/auth**
    - Criar utilitários de navegação local (sem trocar roteador, se não desejar).
    - Benefício: reduz efeito acoplado e repetição de regras de acesso.

## Sequência recomendada (sem quebrar funcionalidades)

### Fase 1 (segura)
- Extrair helpers + hooks utilitários + `DataContext`.
- Garantir que `npm run dev` e fluxos de estoque/vendas/motos continuem idênticos.

### Fase 2 (maior redução de linhas)
- Extrair `SalesView`, `MotosView`, modais e componentes de layout.
- Manter props e contratos atuais para minimizar risco.

### Fase 3 (organização final)
- Extrair hooks de integrações (ML, notificações, perfil) e tipar dados.
- Limpar `App.tsx` para papel de orquestração.

## Meta realista de redução

- `src/App.tsx`: de ~5.5k linhas para algo entre **400-900 linhas**.
- Sem perda funcional, desde que a extração seja **incremental**, com commits pequenos por módulo.

## Critérios de "não perdeu funcionalidade"

- Login/logout e redirecionamento por perfil continuam iguais.
- Abas, filtros, busca, paginação e ações (editar/excluir/criar) iguais.
- Modais e comportamento de scroll/atalhos iguais.
- Polling/cache/localStorage e integrações (Notion/ML/Firestore) com mesmo resultado.

## Sugestão de estrutura final

- `src/app/App.tsx` (casca principal)
- `src/contexts/DataContext.tsx`
- `src/hooks/useAppShellState.ts`
- `src/hooks/useNotifications.ts`
- `src/hooks/useProfilePhoto.ts`
- `src/hooks/useMlDashboard.ts`
- `src/hooks/useMlListings.ts`
- `src/domain/motos/parsers.ts`
- `src/lib/api/fetchWithRetry.ts`
- `src/views/SalesView.tsx`
- `src/views/MotosView.tsx`
- `src/components/modals/DetailModal.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/layout/AppHeader.tsx`
- `src/components/layout/AppModals.tsx`

