# Dropdowns e coerência visual de Clientes

## Objetivo

Corrigir as interações e o alinhamento visual de Clientes a partir das referências de Estoque, Tarefas e Vendas, e eliminar os `<select>` nativos das superfícies ativas da aplicação.

## Escopo

- Animar a troca entre WhatsApp e Instagram no formulário novo de Cliente, respeitando redução de movimento.
- Reintegrar o botão Cancelar do drawer ao tratamento visual dos botões secundários do sistema.
- Posicionar tabs de Clientes à direita em desktop, preservando rolagem horizontal no mobile.
- Aplicar `cursor-pointer` onde linhas e cartões de cliente abrem detalhes.
- Trocar todos os `<select>` de `src/` (fora de dublês de testes) pelo componente `src/components/ui/Select.tsx`, preservando opções, valor, disabled, labels e callbacks.

## Fora do escopo

- API, Supabase, permissões, dados e alterações de fluxo de negócio.
- Migrations, dependências e qualquer criação/alteração de registros reais.

## Critérios de aceite

- A troca de contato é uma transição de opacidade/transform, interrompível e reduzida com `prefers-reduced-motion`.
- Cancelar tem a aparência de ação secundária usada pelos drawers operacionais.
- Em desktop, tabs de Clientes acompanham as ações no lado direito; em mobile, continuam acessíveis por rolagem horizontal.
- Nenhum `<select>` nativo permanece nos componentes de produção em `src/`.
- Cada seletor preserva seleção por mouse, teclado e rótulo acessível.
- Testes afetados, build e revisão de diff registram evidência.

## Riscos e validação

- A substituição global não pode mudar tipos de valores vazios (`''` versus `null`) ou ações de confirmação.
- Validar em especial filtros de Clientes, cadastro de Cliente, pedido operacional e selects de pagamento.
- Rodar testes focados, busca estática de `<select>`, build e `git diff --check`.
