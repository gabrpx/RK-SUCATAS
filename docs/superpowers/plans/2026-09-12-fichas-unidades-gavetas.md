# Fichas de Unidades e Organização por Gavetas — Plano de Implementação

> **Para agentes de IA:** SUB-SKILL OBRIGATÓRIA: use `superpowers:executing-plans` ou `superpowers:subagent-driven-development` para executar este plano tarefa por tarefa. As etapas usam caixas de seleção para acompanhamento.

**Objetivo:** Fazer a organização por gavetas refletir a operação física: a variante é neutra e cada unidade possui uma ficha de consulta própria, com suas fotos, preço, condição e origem, sem abrir edição ao ser selecionada.

**Arquitetura:** Manter `Estoque` como a variante exibida sob uma gaveta e `EstoqueUnidade` como a peça física. A tela de gaveta ganhará uma camada de consulta (`UnidadeDetailDialog`) entre a linha da unidade e o formulário de edição (`UnidadeForm`). Fotos da unidade serão exibidas somente a partir de `unidade.fotos`; fotos já existentes em `item.imagens` permanecem preservadas como referência legada da variante e nunca são usadas como foto de uma unidade.

**Stack:** React 19, TypeScript, Tailwind, componentes UI existentes, Vitest e Testing Library. Não adicionar dependências.

**Especificação:** `docs/superpowers/specs/2026-09-10-estoque-gavetas-fase1-design.md`, auditoria operacional de 2026-09-12 e solicitação do usuário sobre ficha, fotos e organização de unidades.

## Restrições globais

- Trabalhe a partir de `origin/main` no commit que contém a implementação de gavetas (`3cb6725` ou descendente). O `main` local que não contenha `src/features/estoque/gaveta/` é uma cópia desatualizada e não deve ser usado como base da feature.
- Antes de editar, leia `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md` e `CLAUDE.md`; rode `git status --short --branch` e preserve alterações locais de terceiros.
- Não alterar banco, migrations, RLS, RPCs, autenticação, `server.ts`, `src/server/routes/` ou dados reais. Esta fase é UI, estado local e testes.
- Não migrar nem reatribuir automaticamente fotos existentes. Não é possível inferir com segurança a qual unidade física uma foto histórica da variante pertence.
- Não usar `item.imagens[0]` como capa de variante no detalhe de gaveta, nem como fallback de uma unidade.
- Não instalar dependências, não fazer commit, push, merge ou deploy sem autorização explícita.
- A implementação deve continuar responsiva e navegável por teclado; botões e galerias precisam de nomes acessíveis.

---

## Decisões de produto já confirmadas

1. A hierarquia operacional é `Gaveta → Variante → Unidade física`.
2. Variante não é uma peça física e não deve escolher uma foto de capa que pareça pertencer a uma unidade.
3. Selecionar uma unidade significa **consultar a ficha**, não iniciar edição.
4. Edição deve ser uma ação explícita dentro da ficha.
5. As fotos da ficha pertencem exclusivamente a `EstoqueUnidade.fotos`.
6. `Estoque.imagens` deve ser preservado. Nesta fase, quando existir, pode aparecer apenas em uma seção secundária e inequivocamente rotulada como **“Fotos de referência da variante”**; nunca como foto da unidade e nunca como capa da variante.
7. Unidade sem foto própria deve dizer “Sem fotos”; não deve herdar visualmente a foto da variante.

## Critérios de aceite globais

- Um clique/toque em uma linha de unidade abre uma ficha somente de consulta.
- A ficha mostra todas as fotos diretas da unidade e permite ampliar/trocar a foto selecionada sem editar a unidade.
- A ficha distingue fotos da unidade de eventuais fotos legadas da variante.
- O card da variante não mostra foto de capa e não transmite que uma unidade é a imagem representativa do grupo.
- Não há perda, troca ou gravação de fotos durante consulta.
- “Cadastro mínimo” não é mostrado para uma ficha legada que apenas herda dados da variante; estados pendentes informam exatamente o dado ausente.
- A busca e a inclusão de peças não sugerem, por texto ou ordenação, que toda peça não agrupada é automaticamente adequada para aquela gaveta.

## Mapa de arquivos e responsabilidades

| Arquivo | Alteração planejada |
| --- | --- |
| `src/features/estoque/gaveta/UnidadeDetailDialog.tsx` | Novo diálogo de leitura da unidade, galeria, metadados e ação explícita de edição. |
| `src/features/estoque/gaveta/UnidadeDetailDialog.test.tsx` | Testes da ficha, galeria e separação entre mídia própria e mídia de referência. |
| `src/features/estoque/gaveta/UnidadeRow.tsx` | Linha de unidade abre a ficha, remove fallback visual e expõe estados objetivos. |
| `src/features/estoque/gaveta/UnidadeRow.test.tsx` | Atualiza os testes para o contrato visual e de interação correto. |
| `src/features/estoque/gaveta/VarianteCard.tsx` | Remove capa de variante, coordena abertura de ficha e edição explícita. |
| `src/features/estoque/gaveta/VarianteCard.badges.test.tsx` | Mantém cobertura de edição de nome e adiciona contrato de ausência de capa. |
| `src/features/estoque/gaveta/AdicionarPecasGaveta.tsx` | Separa sugestões de itens gerais, muda a cópia e ordena por relevância local. |
| `src/features/estoque/gaveta/AdicionarPecasGaveta.test.tsx` | Novo teste de relevância, busca ampla e cópia honesta. |
| `src/features/estoque/gaveta/buscaGavetas.ts` | Acrescenta função pura de pontuação/razão de sugestão, sem mudar a busca já tolerante. |
| `src/features/estoque/gaveta/buscaGavetas.test.ts` | Testa ordenação e razões de sugestão sem depender de UI. |

## Contratos a preservar

```ts
// Não alterar o formato persistido nem a rota existente.
interface EstoqueUnidade {
  fotos: string[];
  valor: number | null;
  condicao_nota: number | null;
  avaria: boolean;
  avaria_descricao: string | null;
  descricao: string | null;
  vendida_em?: string | null;
}

// Novo contrato de apresentação, local ao domínio gaveta.
interface UnidadeDetailDialogProps {
  aberto: boolean;
  unidade: EstoqueUnidade | null;
  numero: number;
  variante: Pick<Estoque, 'nome' | 'ano' | 'valor' | 'condicao_nota' | 'imagens'>;
  onFechar: () => void;
  onEditar: (unidade: EstoqueUnidade) => void;
}

interface UnidadeRowProps {
  unidade: EstoqueUnidade;
  numero: number;
  nomePadrao: string;
  valorPadrao: number;
  notaPadrao: number | null;
  onAbrirFicha: (unidade: EstoqueUnidade) => void;
}
```

### Task 1: Fixar a base e criar os testes de comportamento que hoje falham

**Arquivos:**

- Criar: `src/features/estoque/gaveta/UnidadeDetailDialog.test.tsx`
- Modificar: `src/features/estoque/gaveta/UnidadeRow.test.tsx`
- Modificar: `src/features/estoque/gaveta/VarianteCard.badges.test.tsx`

**Consome:** `Estoque`, `EstoqueUnidade`, `valorDaUnidade` e `condicaoNotaDaUnidade` já existentes.

**Produz:** testes que impedem o retorno da abertura direta de edição e do fallback de imagem pai → unidade.

- [ ] **Step 1: Confirmar a base sem sobrescrever trabalho existente.**

  Rode:

  ```powershell
  git status --short --branch
  git log -1 --oneline origin/main
  git ls-tree -r --name-only origin/main | rg "src/features/estoque/gaveta/(VarianteCard|UnidadeRow)"
  ```

  Esperado: a base escolhida contém a pasta `gaveta/`; qualquer cópia local sem ela não deve ser atualizada destrutivamente.

- [ ] **Step 2: Reescrever o teste de `UnidadeRow` para o contrato correto.**

  Cobrir estas três situações:

  ```tsx
  it('abre a ficha ao selecionar a unidade, sem disparar edição', () => {
    const abrirFicha = vi.fn();
    render(<UnidadeRow unidade={unidadeEmBranco()} numero={1}
      nomePadrao="Tanque CG 150" valorPadrao={350} notaPadrao={4}
      onAbrirFicha={abrirFicha} />);
    fireEvent.click(screen.getByRole('button', { name: /ver ficha da unidade 1/i }));
    expect(abrirFicha).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }));
  });

  it('não usa foto da variante como foto da unidade', () => {
    render(<UnidadeRow unidade={unidadeEmBranco()} numero={1}
      nomePadrao="Tanque CG 150" valorPadrao={350} notaPadrao={4}
      onAbrirFicha={vi.fn()} />);
    expect(screen.getByText('Sem fotos')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('mostra a primeira foto própria e o total de fotos da unidade', () => {
    render(<UnidadeRow unidade={unidadeEmBranco({ fotos: ['a.jpg', 'b.jpg', 'c.jpg'] })}
      numero={1} nomePadrao="Tanque CG 150" valorPadrao={350}
      notaPadrao={4} onAbrirFicha={vi.fn()} />);
    expect(screen.getByRole('img', { name: /foto da unidade 1/i })).toHaveAttribute('src', 'a.jpg');
    expect(screen.getByText('3 fotos')).toBeTruthy();
  });
  ```

- [ ] **Step 3: Criar o teste inicialmente falho para a ficha.**

  Usar uma unidade com três fotos e uma variante com uma imagem legada. O teste deve exigir:

  ```tsx
  render(<UnidadeDetailDialog aberto unidade={unidadeComTresFotos} numero={2}
    variante={varianteComImagemLegada} onFechar={vi.fn()} onEditar={vi.fn()} />);

  expect(screen.getByRole('heading', { name: /ficha da unidade 2/i })).toBeTruthy();
  expect(screen.getAllByRole('img', { name: /foto da unidade/i })).toHaveLength(3);
  expect(screen.getByText(/fotos de referência da variante/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: /editar unidade/i })).toBeTruthy();
  ```

- [ ] **Step 4: Executar somente os testes novos/falhos.**

  Rode:

  ```powershell
  npm test -- src/features/estoque/gaveta/UnidadeRow.test.tsx src/features/estoque/gaveta/UnidadeDetailDialog.test.tsx
  ```

  Esperado antes da implementação: falha por `onAbrirFicha`/`UnidadeDetailDialog` inexistentes ou pelo contrato antigo.

### Task 2: Criar a ficha de consulta de unidade

**Arquivos:**

- Criar: `src/features/estoque/gaveta/UnidadeDetailDialog.tsx`
- Criar: `src/features/estoque/gaveta/UnidadeDetailDialog.test.tsx` (completo)

**Consome:** `Modal`, `Button`, tokens atuais, `valorDaUnidade`, `condicaoNotaDaUnidade` e os tipos existentes.

**Produz:** `UnidadeDetailDialog`, sem chamadas HTTP e sem mutação de dados.

- [ ] **Step 1: Implementar o diálogo como leitura, não como formulário.**

  O conteúdo deve mostrar, nesta ordem: identificador/nome, preço efetivo, condição, avaria e descrição, origem/nota, galeria e ações. O botão principal da ficha é `Editar unidade`; `Fechar` não salva nada.

  Estrutura mínima:

  ```tsx
  export function UnidadeDetailDialog({ aberto, unidade, numero, variante, onFechar, onEditar }: UnidadeDetailDialogProps) {
    const [fotoAtiva, setFotoAtiva] = useState(0);
    if (!unidade) return null;
    const fotos = unidade.fotos ?? [];
    const valor = valorDaUnidade(unidade, variante.valor);
    const nota = condicaoNotaDaUnidade(unidade, variante.condicao_nota);

    return <Modal aberto={aberto} onFechar={onFechar} titulo={`Ficha da unidade ${numero}`} tamanho="md">{/* leitura */}</Modal>;
  }
  ```

- [ ] **Step 2: Implementar galeria sem dependências novas.**

  - Com fotos diretas: foto principal clicável, miniaturas com `aria-label="Ver foto N da unidade"`, contador `N fotos` e `alt="Foto da unidade N"`.
  - Sem fotos diretas: ícone neutro e texto `Sem fotos desta unidade`.
  - Com `variante.imagens.length > 0`: seção colapsável ou secundária, abaixo da galeria, intitulada `Fotos de referência da variante`; `alt="Foto de referência da variante N"`.
  - Nunca misturar os dois arrays, nunca usar referência como foto principal e nunca permitir remoção/upload nesta tela.

- [ ] **Step 3: Garantir estados de negócio compreensíveis.**

  - Se `unidade.valor` for `null`, mostrar `Usa preço da variante`; não esconder o preço efetivo.
  - Se `condicao_nota` for `null`, mostrar `Usa nota da variante` quando houver nota pai; caso contrário `Sem nota de condição`.
  - Mostrar avaria como `Com avaria` e a descrição quando houver; caso contrário `Sem avaria informada`.
  - Se a unidade não tiver nome próprio, exibir o nome da variante com rótulo `Nome da variante`, sem fingir que é um nome individual.

- [ ] **Step 4: Executar os testes da ficha.**

  Rode:

  ```powershell
  npm test -- src/features/estoque/gaveta/UnidadeDetailDialog.test.tsx
  ```

  Esperado: todos passam, incluindo nenhuma imagem de referência apresentada como foto de unidade.

### Task 3: Separar consulta, edição e identidade visual na lista de variantes

**Arquivos:**

- Modificar: `src/features/estoque/gaveta/UnidadeRow.tsx`
- Modificar: `src/features/estoque/gaveta/VarianteCard.tsx`
- Modificar: `src/features/estoque/gaveta/UnidadeRow.test.tsx`
- Modificar: `src/features/estoque/gaveta/VarianteCard.badges.test.tsx`

**Consome:** `UnidadeDetailDialog` da Task 2 e `UnidadeForm` já existente.

**Produz:** clique abre ficha; edição somente pela ficha; variante sem foto de capa.

- [ ] **Step 1: Trocar a ação de `UnidadeRow`.**

  Remover `fotoPadrao` e `onEditar` da interface. Trocar por `onAbrirFicha`. A linha deve ter um nome acessível que deixe sua ação clara:

  ```tsx
  <button
    type="button"
    aria-label={`Ver ficha da unidade ${numero}: ${nome || nomePadrao}`}
    onClick={() => onAbrirFicha(unidade)}
  >
  ```

  A miniatura vem exclusivamente de `unidade.fotos[0]`. Quando ausente, usar ícone de pacote/placeholder e `Sem fotos`; quando houver mais de uma, mostrar `N fotos` próximo aos metadados.

- [ ] **Step 2: Corrigir a semântica de estado da unidade.**

  Substituir o booleano atual `cadastroMinimo` por estado descritivo, sem alterar persistência:

  ```ts
  const dadosProprios = Boolean(
    unidade.nome || unidade.fotos.length || unidade.avaria || unidade.descricao ||
    unidade.avaria_descricao || unidade.valor != null || unidade.condicao_nota != null
  );
  const dadosHerdados = !dadosProprios;
  const cadastroPendente = dadosProprios && !unidade.nome && unidade.fotos.length === 0;
  ```

  - `dadosHerdados`: rótulo neutro `Dados da variante`; nunca alerta amarelo.
  - `cadastroPendente`: alerta específico `Sem nome e fotos`; não use a frase vaga “Cadastro mínimo”.
  - Avaria continua prioridade visual de alerta.

- [ ] **Step 3: Remover a foto de capa no `VarianteCard`.**

  Remover `const capa = item.imagens[0] ?? null` e o bloco `<img>` de capa. Substituir o espaço por um ícone neutro de variante (`Package`) ou por nenhum thumbnail, conforme o layout ficar mais limpo. Não repassar imagem pai a `UnidadeRow`.

  O card deve resumir somente dados de agrupamento: nome editável, ano, badges, faixa de preço calculada, quantidade e número de unidades com foto/pendência, se esse resumo não poluir a leitura.

- [ ] **Step 4: Controlar os dois modos no `VarianteCard`.**

  Manter dois estados distintos:

  ```ts
  const [unidadeEmFicha, setUnidadeEmFicha] = useState<EstoqueUnidade | null>(null);
  const [unidadeEditando, setUnidadeEditando] = useState<EstoqueUnidade | null>(null);
  ```

  Fluxo obrigatório:

  ```text
  UnidadeRow → setUnidadeEmFicha(unidade)
  Ficha / Editar unidade → fecha ficha → setUnidadeEditando(unidade)
  UnidadeForm / Salvar ou Cancelar → limpa somente o estado de edição
  ```

  Ao salvar, chamar o `refreshData()` existente e fechar ambos os estados. Não duplicar chamadas API nem alterar `UnidadeForm` além do necessário para preservar esse fluxo.

- [ ] **Step 5: Executar a cobertura da interação.**

  Rode:

  ```powershell
  npm test -- src/features/estoque/gaveta/UnidadeRow.test.tsx src/features/estoque/gaveta/VarianteCard.badges.test.tsx src/features/estoque/gaveta/UnidadeDetailDialog.test.tsx
  ```

  Esperado: clique abre ficha; botão interno abre edição; cards não têm imagem de capa de `item.imagens`.

### Task 4: Tornar “Adicionar peças” honesto, relevante e eficiente

**Arquivos:**

- Modificar: `src/features/estoque/gaveta/buscaGavetas.ts`
- Modificar: `src/features/estoque/gaveta/buscaGavetas.test.ts`
- Modificar: `src/features/estoque/gaveta/AdicionarPecasGaveta.tsx`
- Criar: `src/features/estoque/gaveta/AdicionarPecasGaveta.test.tsx`

**Consome:** `Estoque`, dados de categoria/modelo e a busca normalizada `correspondeBuscaEstoque` já existente.

**Produz:** lista inicial priorizada, cópia verdadeira e busca ampla preservada.

- [ ] **Step 1: Criar uma função pura de relevância, sem inventar relação de compatibilidade.**

  Em `buscaGavetas.ts`, criar um contrato explícito:

  ```ts
  export interface SugestaoGaveta {
    item: Estoque;
    pontuacao: number;
    motivos: string[];
  }

  export function sugerirItensParaGaveta(
    candidatos: Estoque[],
    referencia: Estoque[],
    categoriaId: string | null,
  ): SugestaoGaveta[];
  ```

  Regras locais e explicáveis:

  - mesma categoria da gaveta: `+4`, motivo `Mesma categoria da gaveta`;
  - mesmo `categoria_id` de qualquer variante já presente: `+3`, motivo `Categoria já presente`;
  - mesmo `modelo_moto_id` de variante já presente: `+2`, motivo `Modelo já presente`;
  - token normalizado significativo em comum entre nome do candidato e nome da variante: `+1`, motivo `Nome semelhante`;
  - pontuação `0` não é sugestão; continua disponível em “Todos os itens não agrupados”.

  Não usar IA, não inferir compatibilidade mecânica e não esconder itens da busca manual.

- [ ] **Step 2: Testar a função de relevância.**

  Criar fixtures com um tanque da mesma categoria/modelo, uma peça apenas com token semelhante e uma roda sem relação. Exigir:

  ```ts
  expect(sugestoes.map(({ item }) => item.id)).toEqual(['tanque-mesmo-modelo', 'tanque-token']);
  expect(sugestoes[0].motivos).toContain('Mesma categoria da gaveta');
  expect(sugestoes.find(({ item }) => item.id === 'roda')).toBeUndefined();
  ```

- [ ] **Step 3: Reorganizar o modal.**

  - Mudar subtítulo para `Selecione itens não agrupados para esta gaveta.`
  - Com busca vazia: mostrar `Sugestões` (se houver) e depois um botão/área `Todos os itens não agrupados (N)`; evitar renderizar centenas de linhas não relacionadas sem intenção do usuário.
  - Com busca preenchida: usar a busca atual, que já normaliza acento e token, sobre todos os itens não agrupados; apresentar resultado ordenado por relevância, mas sem omitir resultados.
  - Mostrar o motivo da sugestão em texto discreto, não como certeza de compatibilidade.
  - Preservar seleção múltipla, concorrência limitada, refresh único e relato de falhas já implementados.

- [ ] **Step 4: Testar o modal.**

  Cobrir: cópia sem promessa de adequação automática; sugestão antes de item sem relação; busca por `tanque combustivel 150` encontra item apesar de diferença de caixa/acentos; seleção e chamada de `moverEmLote` preservadas.

- [ ] **Step 5: Rodar os testes de busca e modal.**

  Rode:

  ```powershell
  npm test -- src/features/estoque/gaveta/buscaGavetas.test.ts src/features/estoque/gaveta/AdicionarPecasGaveta.test.tsx
  ```

### Task 5: Validação de fluxo real, regressões e handoff

**Arquivos:**

- Modificar somente se necessário pelos testes: arquivos das Tasks 1–4.
- Não criar migration, não alterar contrato HTTP e não modificar dados.

**Consome:** implementação e testes anteriores.

**Produz:** validação que simula o operador, não apenas componentes isolados.

- [ ] **Step 1: Rodar a suíte focada da feature.**

  Rode:

  ```powershell
  npm test -- src/features/estoque/gaveta
  ```

  Se a máquina tiver limitação de memória conhecida, use somente:

  ```powershell
  $env:NODE_OPTIONS='--max-old-space-size=8192'; npm test -- src/features/estoque/gaveta --pool=forks --maxWorkers=1
  ```

- [ ] **Step 2: Executar validação estática e build.**

  Rode:

  ```powershell
  npm run lint
  npm run build
  ```

  Registre erros preexistentes separadamente; não os atribua a esta tarefa sem comparar com a base.

- [ ] **Step 3: Fazer roteiro manual de operador.**

  Em dados de desenvolvimento ou ambiente autorizado, validar:

  1. Abrir uma gaveta com ao menos três variantes e unidades com fotos diferentes.
  2. Conferir que nenhuma variante usa uma foto como capa.
  3. Abrir uma unidade com três fotos, navegar pela galeria e fechar sem nenhuma mutação.
  4. Clicar em `Editar unidade`, remover/voltar sem salvar e confirmar que a ficha ainda mostra os dados originais.
  5. Abrir unidade sem fotos e verificar `Sem fotos desta unidade`, sem imagem herdada.
  6. Conferir unidade legada sem campos próprios: `Dados da variante`, sem alerta incorreto.
  7. Abrir “Adicionar peças”: verificar sugestões explicadas, expandir todos os itens, buscar por nome parcial sem acento e mover duas peças.
  8. Atualizar a tela e confirmar que agrupamento, fotos e quantidades continuam corretos.

- [ ] **Step 4: Revisar o diff com foco em riscos.**

  Rode:

  ```powershell
  git diff --check
  git diff -- src/features/estoque/gaveta
  ```

  Confirme especificamente: nenhuma referência a `fotoPadrao`; nenhuma gravação disparada por abrir ficha; nenhuma alteração em SQL, backend, `.env`, dependências ou dados.

- [ ] **Step 5: Entregar relatório de handoff.**

  Incluir: base/branch usada, arquivos mudados, o que foi herdado, validações reais, resultado do roteiro manual, limitações sobre fotos legadas e a necessidade de revisão Codex antes de deploy.

## Pontos deliberadamente fora de escopo

- Distribuir fotos legadas de uma variante entre unidades físicas.
- Criar migration ou alterar `estoque_unidades`/Storage.
- Mover unidades entre gavetas em lote, desfazer movimentações ou criar histórico de auditoria.
- Regras de preço: hoje `UnidadeForm` exige preço próprio para salvar, embora `valor: null` represente herança. Isso é uma inconsistência a decidir em tarefa separada antes de mudar comportamento financeiro.
- Filtros avançados dentro da gaveta (`sem foto`, `com avaria`, `pendente`) e recolhimento de variantes: recomendados como próxima etapa, após a ficha correta estar em uso.

## Riscos e revisão humana necessária

1. **Mídia legada:** fotos em `Estoque.imagens` podem ter valor comercial ou histórico. A UI não deve escondê-las nem atribuí-las automaticamente a unidades.
2. **Identidade da peça:** renomear variante altera `Estoque.nome`; validar se esse nome é também usado em anúncio, venda ou orçamento antes de qualquer mudança em massa.
3. **Operação diária:** testar em celular real, pois a galeria e o diálogo precisam ser manejáveis com fotos de câmera.
4. **Base divergente:** o executor deve trabalhar numa worktree da `origin/main` atual, não em uma cópia local antiga e suja.

## Cobertura da auditoria

| Achado auditado | Tarefa que cobre |
| --- | --- |
| Clique abre edição, não detalhes | Tasks 1–3 |
| Fotos existem mas parecem ausentes | Tasks 1–3 |
| Foto do pai é usada como capa/fallback | Tasks 1–3 |
| Estado “Cadastro mínimo” confuso | Task 3 |
| Lista de adição dá falsa impressão de relevância | Task 4 |
| Busca e fluxo operacional precisam de validação real | Tasks 4–5 |

