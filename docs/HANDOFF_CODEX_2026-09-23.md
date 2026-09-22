# Handoff para o Codex — 23/09/2026

> Escrito pelo Claude ao fim da sessão de 22/09/2026. Leia este arquivo
> primeiro, depois `docs/HANDOFF_CLAUDE_ESTOQUE_PRONTO_PARA_USO_2026-09-22.md`
> (seção "LEIA PRIMEIRO" e as duas seções "Revisão do Claude…" / "Reserva com
> cliente cadastrado…") e `PROSSIGA.MD`. As regras do `AGENTS.md` continuam
> valendo.

## Onde está o trabalho

- **Branch:** `wip/estoque-reservas-cliente`, criada a partir da `main` local
  (que estava 9 commits à frente de `origin/main` e com alterações não
  commitadas suas e do Claude).
- O commit desta branch inclui **tudo o que estava pendente na árvore**: o
  trabalho seu de 22/09 (prévia do estoque, rotas de organização, migrations
  065/066, teste do rascunho de Tarefas etc.) e as mudanças do Claude listadas
  abaixo.
- **Não foi feito push para a `main`**, de propósito: o `render.yaml` publica a
  API a partir do GitHub, e o estoque novo ainda não pode ir para produção.
  Não faça merge na `main` nem deploy sem autorização explícita do usuário.
- O repositório local ficou **nessa branch** (não na `main`).

## Estado do banco (Supabase `dfabkkffesulrmmtjzbx`)

| Migration | Estado |
| --- | --- |
| 065 `estoque_organizacao` | **Aplicada** pelo usuário |
| 066 `estoque_reservas_arquivamento` | **Aplicada** pelo usuário, na versão original (sem as correções do Claude). Não edite o arquivo. |
| 067 `estoque_reservas_correcoes` | **Só no repositório. NÃO aplicada.** Testar em homologação antes de pedir aplicação ao usuário. |

### Bug que existe hoje em produção (066 sem 067)

`estoque_reservas.unidade_id` tem `on delete restrict`. Como
`estoque_unidades` apaga em cascata junto com `estoque`, uma peça cuja unidade
**já teve reserva, mesmo liberada**, não pode mais ser excluída
(`violates foreign key constraint estoque_reservas_unidade_id_fkey`). O mesmo
erro aparece ao reduzir a quantidade quando a sincronização tenta apagar uma
ficha em branco com reserva antiga. O risco imediato é baixo porque a UI real
ainda não reservava nada, mas a 067 corrige isso.

### O que a 067 faz

1. FK da reserva vira `on delete cascade`, mais o trigger
   `bloquear_exclusao_unidade_reservada`: uma ficha com reserva **ativa** não sai
   por exclusão direta, por cascata da peça nem pela sincronização.
2. A sincronização ignora reserva vencida que não foi liberada.
3. `set search_path = public` em todas as funções de reserva e arquivamento, e
   mensagem de bloqueio de venda por quantidade mais clara.
4. **Cliente na reserva (pedido do usuário):** `estoque_reservas.cliente_id`
   (FK `clientes`, `on delete set null`) e
   `reservar_unidade_estoque(p_unidade_id, p_responsavel, p_ate, p_cliente_id default null)`.
   - Com cliente e sem nome digitado, `responsavel` recebe o nome do cadastro.
   - Cliente banido recebe `Cliente banido não pode reservar peças`.
   - Sem cliente, o nome livre continua obrigatório (cliente de balcão).
   - A versão de 3 argumentos é removida (`drop function`) para não deixar
     sobrecarga ambígua no PostgREST. Chamadas com 3 argumentos continuam
     funcionando por causa do `default null`.

**Testes feitos:** Postgres 16 local com um esqueleto mínimo do schema, rodando
065 + 066 original + 067 em 16 cenários: venda de unidade reservada bloqueada,
venda sem unidade respeita a reserva, exclusão de ficha e de peça reservada
bloqueada, arquivar unidade reservada bloqueado, liberar + sincronizar, excluir
peça com histórico de reserva, arquivar/restaurar ajustando a quantidade, cliente
cadastrado, cliente banido, cliente inexistente, nome livre, nome vazio,
exclusão do cliente preservando a reserva e existência de uma única versão da
função. **Não foi testada contra o schema real nem contra as
`registrar_venda`/`cancelar_venda` reais.**

## Mudanças de código do Claude (22/09)

- `src/server/routes/estoqueOrganizacao.ts`
  - `validarReservaInput` (exportada e testada): `cliente_id` opcional (UUID);
    exige cliente **ou** nome; vencimento no futuro e em no máximo 30 dias.
  - `POST /unidades/:id/reservas` só envia `p_cliente_id` quando ele existe.
  - `GET /locais` lê `cliente:clientes(id, nome, telefone)`. Se a 067 ainda não
    estiver aplicada (`42703`/`PGRST200`/`PGRST204`), faz a leitura sem cliente
    em vez de derrubar a organização.
- `src/features/estoque/types.ts` e `api.ts`: `EstoqueReserva.cliente_id` e
  `cliente`, `EstoqueReservaInput`;
  `estoqueApi.reservarUnidade(unidadeId, { clienteId, responsavel, reservadaAte })`.
- `src/features/clientes/SeletorCliente.tsx`: props opcionais `clientes`
  (a prévia roda fora do `DataProvider`) e `ariaLabel`. As telas atuais não
  mudaram de comportamento.
- `src/features/estoque-preview/`
  - `inventoryPreviewModel.ts`: `reservarUnidade`, `liberarReservaUnidade`,
    `podeReservar`, `diasRestantesReserva` (conta dias de calendário; antes, 7
    dias apareciam como 8), `DIAS_RESERVA_PADRAO = 7`, `DIAS_RESERVA_MAXIMO = 30`.
  - `realInventoryAdapter.ts`: `reservadaPara` usa o nome do cadastro;
    acrescenta `reservaClienteId` e `reservaTelefone`.
  - `InventoryUnitDrawer.tsx`:
    - modo **Reservar**: `SeletorCliente` e prazo de 1 a 30 dias, com vencimento
      às 18h;
    - bloco **Reserva ativa**: nome, cadastrado ou não, telefone, vencimento e
      **Liberar reserva**;
    - não oferece **Arquivar** enquanto a unidade estiver reservada.
  - `EstoquePreview.tsx`:
    - handlers `reservar`/`liberarReserva` para demo e real; o real chama a API
      e recarrega;
    - carrega `/api/clientes` em modo real e usa 2 clientes fictícios na demo;
    - o drawer lê a unidade atualizada do estado.
- `src/features/patchnotes/data.ts`: entrada 1.7.5.
- Testes novos: rota (5), modelo (3), adaptador (1), tela (2: reservar com
  cliente e liberar; balcão só com nome e prazo inválido).

## Validação

- `npm run lint`: ok.
- `npm test`: **705/705** (117 arquivos).
- `npm run build`: ok (o aviso conhecido de chunk grande continua).
- `git diff --check`: só o aviso conhecido de CRLF nas linhas novas de arquivos
  com CRLF. As quebras de linha originais (CRLF/LF misto) foram preservadas.
- Fluxo reservar → reserva ativa → liberar conferido à mão em
  `http://127.0.0.1:4173/estoque-preview`, em **modo demonstração** (a API não
  estava acessível). O `dist/` local foi atualizado com esse build; ele é
  ignorado pelo git.
- **Atenção:** o shell local do Cowork não iniciou nesta sessão. Lint, testes e
  build rodaram numa cópia do repositório na nuvem, sem `.env`: os testes de
  rota usaram variáveis falsas. Rode tudo de novo localmente antes de qualquer
  outra coisa.

## Próximos passos sugeridos (em ordem)

1. `git status --short --branch`, confirmar que está em
   `wip/estoque-reservas-cliente` e rodar `npm run lint`, `npm test` e
   `npm run build` localmente.
2. Revisar a 067 e testá-la em homologação, com o schema real e as RPCs
   `registrar_venda`/`cancelar_venda`. Depois pedir ao usuário para aplicá-la.
3. Com a 067 aplicada, testar reserva e liberação **reais** pela API (cliente
   cadastrado, balcão, cliente banido, unidade já reservada, venda bloqueada).
4. **Decisão pendente do usuário:** o sinal de 20% não está modelado. A reserva
   guarda cliente, nome e prazo, mas não o valor do sinal. Pergunte antes de
   implementar.
5. Arquivar/restaurar reais na UI (as RPCs e rotas já existem; a UI real ainda
   mostra "não habilitado"), com motivo obrigatório.
6. Rascunho que some em Tarefas: ainda não reproduzido; veja o handoff anterior.
7. Só depois de tudo testado, perguntar ao usuário se pode trocar a rota
   `/estoque`. Não troque por conta própria.
