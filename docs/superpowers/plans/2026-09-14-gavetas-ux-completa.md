# Área de Gavetas — Plano de Implementação UX

> **Para agentes de implementação:** use `superpowers:subagent-driven-development` ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Faça commits pequenos e independentes. Antes de alterar código, confirme o estado real do repositório.

**Objetivo:** elevar a área de gavetas de uma listagem hierárquica para um painel operacional que mostre pendências, acelere a organização e permita acompanhar cada unidade do estoque sem trabalho duplicado.

**Arquitetura:** preservar a hierarquia existente `gaveta → variante → unidade`, concentrando regras de pendência em helpers testáveis e reutilizando os componentes atuais. A primeira etapa deve ser somente frontend e APIs já existentes; não criar migration, alterar RLS ou inventar endpoint sem decisão explícita. A branch deve partir de `origin/main` e ser isolada do trabalho atual de `codex/estoque-gavetas-acabamento`.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind, Motion, Radix/Animate UI, Express e Supabase através da API existente.

**Spec:** esta auditoria e seus critérios estão neste arquivo; a evidência visual original está na área de Gavetas em `http://127.0.0.1:3011/estoque`.

## Branch e colaboração

- Branch sugerida: `claude/ux-gavetas-operacao`, criada a partir de `origin/main`.
- Não trabalhar na branch `main` local nem na `codex/estoque-gavetas-acabamento`.
- Não fazer merge, push para `main` ou deploy sem pedido explícito.
- Antes de editar: ler `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md` e `CLAUDE.md`; executar `git status --short --branch`.
- Preservar alterações locais existentes. Se houver conflito nos arquivos listados, parar e registrar no relatório.

## Como usar a skill `ux-audit`

1. Localizar a skill antes de começar:

   ```powershell
   Get-ChildItem -Path . -Recurse -Force -File -ErrorAction SilentlyContinue |
     Where-Object { $_.FullName -match 'ux.?audit' -or $_.Name -match 'SKILL.md' }
   ```

2. Ler completamente o `SKILL.md` da `ux-audit`, incluindo referências apontadas por ele. Não inventar regras da skill.
3. Se a skill não estiver no repositório nem no diretório de skills do Claude Code, registrar essa limitação e usar como fallback o framework de auditoria de `product-design:audit`, sem alegar que a `ux-audit` foi executada.
4. Capturar screenshots da área preenchida e dos fluxos principais antes e depois da implementação:
   - lista de gavetas;
   - busca com resultado dentro de uma gaveta;
   - detalhe da gaveta;
   - ficha da unidade com foto;
   - item não agrupado;
   - adição em lote;
   - criação/edição de gaveta;
   - estados vazio, erro, offline e carregamento.
5. Em cada captura, registrar pontos fortes, problema, impacto, evidência, recomendação e risco de acessibilidade.
6. Ao terminar, entregar no relatório final:
   - o que já existia;
   - o que foi implementado;
   - arquivos modificados;
   - commits realizados;
   - comandos executados e resultados reais;
   - limitações da validação;
   - screenshots antes/depois;
   - itens que ainda precisam de decisão humana.

## Restrições de produto

- “Gavetas” continua sendo a visão padrão.
- O organizador/variante não deve usar foto da unidade como capa; fotos devem aparecer nas unidades.
- Fotos legadas podem ser exibidas como fotos efetivas, mas a interface deve deixar clara a origem quando ela ainda não foi persistida como foto própria da unidade.
- Nenhuma peça pode ser apagada ao excluir uma gaveta; as peças devem voltar para “Itens não agrupados”.
- Vendas, baixa de estoque e caixa não podem ser reimplementadas na UI.
- O frontend não acessa Supabase diretamente.
- Não editar migration aplicada nem alterar dados reais durante testes.
- Não adicionar dependência nova sem justificativa.

---

### Tarefa 1: Reconstruir a baseline com `ux-audit`

**Arquivos:**
- Inspecionar: `src/features/estoque/EstoqueView.tsx`
- Inspecionar: `src/features/estoque/gaveta/GavetaList.tsx`
- Inspecionar: `src/features/estoque/gaveta/GavetaDetail.tsx`
- Inspecionar: `src/features/estoque/gaveta/VarianteCard.tsx`
- Inspecionar: `src/features/estoque/gaveta/UnidadeRow.tsx`
- Inspecionar: `src/features/estoque/gaveta/UnidadeDetailDialog.tsx`
- Inspecionar: `src/features/estoque/gaveta/AdicionarPecasGaveta.tsx`
- Inspecionar: `src/features/estoque/gaveta/EstadosGaveta.tsx`

- [ ] Ler a skill `ux-audit` e documentar a localização usada.
- [ ] Executar a auditoria visual antes de modificar código.
- [ ] Confirmar se a preview está carregando dados; se não estiver, separar claramente falha de ambiente de falha de produto.
- [ ] Criar um inventário dos componentes, estados e rotas realmente existentes.
- [ ] Registrar findings com severidade P0/P1/P2, sem implementar melhorias ainda.
- [ ] Commitar somente se o projeto usar documentação versionada para a auditoria; caso contrário manter o relatório no handoff.

**Aceite:** existe uma baseline com screenshots e uma lista de findings ligada a componentes reais, sem depender apenas de screenshots antigas.

### Tarefa 2: Criar o modelo comum de pendências

**Arquivos:**
- Criar: `src/features/estoque/gaveta/pendenciasGaveta.ts`
- Criar: `src/features/estoque/gaveta/pendenciasGaveta.test.ts`
- Modificar: `src/features/estoque/gaveta/GavetaList.tsx`
- Modificar: `src/features/estoque/gaveta/GavetaRow.tsx`
- Modificar: `src/features/estoque/gaveta/VarianteCard.tsx`
- Modificar: `src/features/estoque/gaveta/UnidadeRow.tsx`

**Interfaces:**

```ts
export type PendenciaGaveta =
  | 'sem_gaveta'
  | 'ficha_pendente'
  | 'sem_foto'
  | 'foto_legada'
  | 'com_avaria'
  | 'sem_preco';

export interface ResumoPendencias {
  total: number;
  porTipo: Record<PendenciaGaveta, number>;
}

export function resumirPendenciasEstoque(itens: Estoque[]): ResumoPendencias;
export function pendenciasDaVariante(item: Estoque): PendenciaGaveta[];
export function pendenciasDaUnidade(unidade: EstoqueUnidade): PendenciaGaveta[];
```

- [ ] Escrever testes para quantidade maior que fichas, unidade sem foto, unidade com avaria, item sem gaveta e item com foto legada.
- [ ] Rodar os testes e confirmar falha antes da implementação.
- [ ] Implementar helpers puros, sem chamadas de API e sem JSX.
- [ ] Rodar os testes novamente e confirmar aprovação.
- [ ] Exibir contagens resumidas nas linhas de gaveta e variante.
- [ ] Usar texto além de cor/ícone: “2 sem foto”, “1 ficha pendente”, “3 sem gaveta”.

**Aceite:** toda pendência exibida na UI vem de uma função testada e os totais não mudam silenciosamente quando a tela é filtrada.

### Tarefa 3: Tornar busca e filtros operacionais

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/GavetaList.tsx`
- Modificar: `src/features/estoque/gaveta/FilterChips.tsx`
- Modificar: `src/features/estoque/gaveta/StatsRow.tsx`
- Modificar: `src/features/estoque/gaveta/buscaGavetas.ts`
- Testar: `src/features/estoque/gaveta/buscaGavetas.test.ts`

- [ ] Escrever testes para busca por nome de gaveta, nome de variante, código e categoria.
- [ ] Fazer a busca retornar contexto: gaveta, variante e motivo do resultado.
- [ ] Quando a busca atingir uma variante, mostrar somente as variantes correspondentes dentro da gaveta ou marcar claramente as correspondentes.
- [ ] Adicionar botão “Limpar busca”.
- [ ] Adicionar filtros rápidos: “Pendentes”, “Sem foto”, “Com avaria”, “Disponíveis”, “Vendidas” e “Sem preço”.
- [ ] Exibir “X resultados em Y gavetas”.
- [ ] Separar “Resumo do estoque” de “Resultado atual” para não misturar totais gerais com totais filtrados.
- [ ] Garantir que os filtros sejam acessíveis por teclado e tenham estado selecionado anunciado.

**Aceite:** um funcionário consegue digitar parte do nome/código e chegar à unidade/variante correta sem abrir gavetas irrelevantes.

### Tarefa 4: Transformar itens não agrupados em fila de trabalho

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/GavetaList.tsx`
- Criar ou modificar: `src/features/estoque/gaveta/ItemNaoAgrupadoRow.tsx`
- Modificar: `src/features/estoque/gaveta/AdicionarPecasGaveta.tsx`
- Reutilizar: `src/features/estoque/gaveta/hooks.ts` e `src/features/estoque/gaveta/api.ts`

- [ ] Exibir o total de itens aguardando organização no título da seção.
- [ ] Adicionar ação direta “Mover para gaveta”.
- [ ] Permitir selecionar vários itens não agrupados.
- [ ] Reutilizar o fluxo de movimentação em lote existente, sem duplicar endpoint.
- [ ] Oferecer “Criar nova gaveta” como alternativa quando nenhuma gaveta serve.
- [ ] Após mover, mostrar feedback e atualizar a lista sem recarregar a página inteira.

**Aceite:** organizar um grupo de itens não exige abrir e fechar a ficha de cada item individualmente.

### Tarefa 5: Melhorar o detalhe e a organização interna da gaveta

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/GavetaDetail.tsx`
- Modificar: `src/features/estoque/gaveta/VarianteCard.tsx`
- Modificar: `src/features/estoque/gaveta/hooks.ts`
- Testar: testes existentes de gaveta e movimentação

- [ ] Mostrar no cabeçalho da gaveta: variantes, unidades disponíveis, fichas pendentes e pendências totais.
- [ ] Adicionar ordenação por nome, quantidade, valor e pendências.
- [ ] Adicionar filtro interno por status.
- [ ] Mostrar fichas pendentes quando `quantidade` for maior que as fichas existentes.
- [ ] Mostrar unidades vendidas em seção recolhida, sem misturá-las com disponíveis.
- [ ] Trocar “Soltar da gaveta” por uma ação com confirmação leve, toast de sucesso e “Desfazer” quando a API permitir.
- [ ] Exibir erro de salvar título de forma visível e acionável.
- [ ] Adicionar seleção múltipla de variantes somente se o endpoint existente suportar a operação sem quebrar atomicidade.

**Aceite:** ao abrir uma gaveta, o usuário sabe imediatamente o que está disponível, o que está pendente e o que precisa de ação.

### Tarefa 6: Completar o ciclo de vida da unidade

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/UnidadeRow.tsx`
- Modificar: `src/features/estoque/gaveta/UnidadeDetailDialog.tsx`
- Modificar: `src/features/estoque/gaveta/UnidadeForm.tsx`
- Modificar: `src/server/fotosUnidade.ts`
- Testar: `UnidadeRow.test.tsx`, `UnidadeDetailDialog.test.tsx`, `fotosUnidade.test.ts`

- [ ] Diferenciar visualmente “foto própria” de “foto legada herdada”, sem esconder a foto.
- [ ] Mostrar status textual: Disponível, Vendida, Com avaria, Ficha incompleta.
- [ ] Manter unidades vendidas acessíveis em seção recolhida.
- [ ] Adicionar bloco “Pendências desta ficha”.
- [ ] Adicionar ação “Completar ficha”.
- [ ] Criar fluxo “Salvar e adicionar próxima unidade”.
- [ ] Deixar explícito quando preço/condição são herdados da variante.
- [ ] Não duplicar fotos no banco nem fazer migração automática sem aprovação explícita.

**Aceite:** o funcionário consegue distinguir uma unidade pronta para venda de uma unidade ainda incompleta, sem abrir várias telas.

### Tarefa 7: Melhorar adição em lote e criação/edição de gaveta

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/AdicionarPecasGaveta.tsx`
- Modificar: `src/features/estoque/gaveta/GavetaList.tsx`
- Modificar: `src/features/estoque/gaveta/EditarGavetaDialog.tsx`
- Reutilizar: `src/components/animate-ui/components/radix/dropdown-menu.tsx`

- [ ] Adicionar “Selecionar todos os resultados” e contador selecionado.
- [ ] Exibir resumo antes de mover: quantidade e nome da gaveta destino.
- [ ] Preservar feedback de falha parcial por item.
- [ ] Usar o dropdown pesquisável do Animate UI para categorias em criação e edição.
- [ ] Manter teclado, `Esc`, foco e seleção acessíveis.
- [ ] Se a lista de categorias for grande, manter área rolável e busca com “Nenhum resultado”.
- [ ] Avaliar campos opcionais de localização física somente se já houver suporte no modelo; não criar banco sem decisão.

**Aceite:** categorizar ou mover peças é rápido com teclado e mouse, mesmo com dezenas de opções.

### Tarefa 8: Estados, acessibilidade e responsividade

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/EstadosGaveta.tsx`
- Modificar: componentes alterados nas tarefas anteriores
- Testar: navegação manual e, se disponível, auditoria de acessibilidade

- [ ] Separar estado vazio, erro de rede, sem permissão, carregamento e sem resultados.
- [ ] Adicionar “Tentar novamente” ao erro recuperável.
- [ ] Não depender apenas de opacidade ou cor para indicar pendência.
- [ ] Verificar foco após abrir/fechar menus e modais.
- [ ] Verificar zoom de 200%, teclado, leitores de tela e tela estreita.
- [ ] Respeitar `prefers-reduced-motion` nas animações do Animate UI.

**Aceite:** os fluxos principais são operáveis sem mouse e continuam compreensíveis com zoom ou baixa percepção de cor.

### Tarefa 9: Auditoria final e handoff

**Arquivos:**
- Inspecionar todos os arquivos alterados.
- Criar, se o projeto aceitar documentação de auditoria: `docs/auditorias/ux-gavetas-pos-implementacao.md`.

- [ ] Reexecutar a `ux-audit` com screenshots depois da implementação.
- [ ] Comparar cada finding inicial com o estado final.
- [ ] Executar validações disponíveis:

  ```powershell
  npm run lint
  npm run build
  ```

- [ ] Executar testes específicos e registrar resultados reais.
- [ ] Testar manualmente a preview em `http://127.0.0.1:3011/estoque` com dados reais disponíveis no ambiente.
- [ ] Revisar `git diff`, status e arquivos críticos.
- [ ] Fazer commits pequenos por tarefa, com mensagens claras.
- [ ] No relatório final, explicar para o Codex exatamente o que foi feito, o que ficou pendente, quais limitações ocorreram e qual é o próximo passo.

**Aceite:** o handoff permite que outro agente continue sem depender de memória de conversa.

### Tarefa 10: Preservar nomes completos na seleção de peças

**Arquivos:**
- Modificar: `src/features/estoque/gaveta/AdicionarPecasGaveta.tsx`
- Criar/testar: `src/features/estoque/gaveta/AdicionarPecasGaveta.test.tsx`

- [ ] Não usar `truncate` no nome principal da peça.
- [ ] Usar uma grade responsiva com coluna própria para checkbox, foto, nome e preço.
- [ ] Permitir quebra de linha natural no nome e no subtítulo, inclusive em nomes muito longos sem espaços.
- [ ] Manter o preço alinhado e visível em desktop e mobile usando `whitespace-nowrap` e `tabular-nums`.
- [ ] Validar com nomes longos como `TAMPA DO CUBO TRASEIRO YES 125 ESPELHO DE FREIO`.
- [ ] Capturar screenshot em viewport desktop e mobile; confirmar que nenhum nome fica cortado.

**Aceite:** o funcionário consegue ler o nome completo de cada peça na janela “Adicionar peças”, sem depender de tooltip, hover ou abertura de detalhes.

## Critérios globais de conclusão

- A visão de Gavetas continua padrão.
- Pendências são visíveis em gaveta, variante e unidade.
- Busca e filtros levam ao resultado correto com contexto.
- Itens não agrupados funcionam como fila de organização.
- Fichas faltantes não ficam ocultas quando a quantidade exige mais unidades.
- Fotos legadas continuam disponíveis sem serem confundidas com fotos novas da unidade.
- Unidades vendidas não desaparecem sem explicação.
- Movimentações têm feedback e recuperação quando possível.
- Nomes de peças aparecem completos, com quebra de linha, no desktop e no mobile.
- Dropdowns e modais funcionam com teclado.
- `npm run lint`, `npm run build` e testes pertinentes foram executados, com limitações documentadas.
- Claude Code entrega o relatório final solicitado antes de encerrar.
