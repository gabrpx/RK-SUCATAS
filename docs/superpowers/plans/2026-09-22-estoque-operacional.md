# Estoque operacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** transformar a experiência nova de estoque em operação persistente para cadastro, foto, localização, organização e consulta diária.

**Architecture:** `estoque` e `estoque_unidades` continuam a fonte de verdade. Uma migration nova cria locais, vínculo N:N entre categoria e zona e reserva por unidade; Express valida e React consome somente APIs tipadas. A UI não trata quantidade sintética como unidade física.

**Tech Stack:** React, TypeScript, Tailwind, Motion, Express, Supabase/Postgres, Vitest.

**Spec:** `docs/HANDOFF_CLAUDE_ESTOQUE_PRONTO_PARA_USO_2026-09-22.md`

## Global Constraints

- Referência visual exclusiva: `/tarefas` light; nunca o projeto laranja com barra lateral.
- Frontend não acessa Supabase; reutilizar Express, `estoqueApi`, `EstoqueUploadFotos`, `Combobox` e permissões `estoque.*`.
- Não editar migration já aplicada, executar SQL, alterar dados reais, commitar, enviar ou fazer deploy sem autorização explícita.
- Não substituir as RPCs `registrar_venda`/`cancelar_venda`.

## Review Focus

- Reserva concorrente da mesma unidade devolve conflito sem corromper venda ou estoque.
- Quantidade legada sem ficha persistida não recebe ações de unidade física.
- Falha parcial de foto preserva o cadastro e permite nova tentativa sem duplicação.
- Categoria e zona são N:N e pesquisáveis mesmo com muitos registros.
- Após recarregar, lista, mapa e métricas reproduzem dados da API.

### Task 1: Contrato, migration e rotas de localização

**Files:**
- Create: `supabase/migration_065_localizacao_estoque.sql`
- Modify: `src/features/estoque/types.ts`
- Modify: `src/features/estoque/api.ts`
- Modify: `src/server/routes/estoque.ts`
- Test: `src/server/routes/estoque.test.ts`

**Produces:** `LocalizacaoUnidade`, `RegraCategoriaZona`, rotas de locais e atribuição de localização por unidade.

- [ ] Escrever o teste que falha:

```ts
it('rejeita endereço inexistente ao atribuir localização', async () => {
  const resposta = await request(app).patch('/api/estoque/p1/unidades/u1/localizacao').send({ localizacao_id: 'x' });
  expect(resposta.status).toBe(400);
});
```

- [ ] Rodar `npm test -- src/server/routes/estoque.test.ts`; esperar falha por rota ausente.
- [ ] Antes da migration, confirmar ambiente, backup e autorização; não executar SQL nesta tarefa.
- [ ] Criar a migration nova com `estoque_localizacoes`, `estoque_zona_categorias` e `estoque_reservas`: FKs para unidades/categorias, endereço único por depósito/zona/prateleira/nível/posição, N:N categoria–zona e índice/constraint para uma reserva ativa por unidade.
- [ ] Implementar tipos e rotas: leitura usa `estoque.ver`, alterações usam `estoque.editar`; validar local ativo e categoria existente no servidor.
- [ ] Rodar `npm test -- src/server/routes/estoque.test.ts`; esperar aprovação do caso inválido e de duas categorias na mesma zona.

### Task 2: Individualização segura e adaptador real

**Files:**
- Modify: `src/features/estoque-preview/realInventoryAdapter.ts`
- Modify: `src/features/estoque-preview/inventoryPreviewModel.ts`
- Modify: `src/server/routes/estoque.ts`
- Test: `src/features/estoque-preview/realInventoryAdapter.test.ts`
- Test: `src/server/routes/estoque.test.ts`

**Produces:** flag `individualizada` e promoção de ficha em branco por PATCH.

- [ ] Escrever o teste que falha:

```ts
it('marca quantidade sem ficha persistida como não individualizada', () => {
  expect(adaptarEstoqueReal([itemComQuantidadeMaiorQueFichas], categorias).unidades[0]).toMatchObject({ individualizada: false });
});
```

- [ ] Rodar `npm test -- src/features/estoque-preview/realInventoryAdapter.test.ts`; esperar falha.
- [ ] Implementar: placeholder permanece apenas informativo; reserva, mover, editar e arquivar exigem `id` de `estoque_unidades`. Quando migration 057 estiver ativa, promover a ficha vazia via PATCH, nunca usar `POST /unidades` para duplicar quantidade.
- [ ] Rodar `npm test -- src/features/estoque-preview/realInventoryAdapter.test.ts src/server/routes/estoque.test.ts`; esperar aprovação.

### Task 3: Drawer persistente, fotos e seletor escalável

**Files:**
- Modify: `src/features/estoque-preview/InventoryComposer.tsx`
- Modify: `src/features/estoque-preview/InventoryUnitDrawer.tsx`
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Test: `src/features/estoque-preview/EstoquePreview.test.tsx`
- Test: `src/features/estoque/EstoqueUploadFotos.test.tsx`

**Produces:** cadastro real de peça/unidade e localização, com upload recuperável.

- [ ] Escrever o teste que falha:

```tsx
it('salva peça, unidade e localização retornada pela API', async () => {
  render(<EstoquePreview />);
  await preencherNovaPecaComFotoELocalizacao();
  await user.click(screen.getByRole('button', { name: 'Salvar peça' }));
  expect(estoqueApi.criar).toHaveBeenCalledOnce();
  expect(await screen.findByText('A · P03 · N02 · C04')).toBeVisible();
});
```

- [ ] Rodar `npm test -- src/features/estoque-preview/EstoquePreview.test.tsx`; esperar falha porque ainda usa `setEstoque` e `fotoUrl: null`.
- [ ] Implementar usando categorias/locais reais e `Combobox` pesquisável; chamar `estoqueApi`, `atualizarUnidade` e `uploadImagemEstoque`; bloquear submit duplicado; atualizar a tela pela resposta/revalidação. Falha de upload mantém o ID salvo, identifica o arquivo e permite tentar de novo.
- [ ] Rodar `npm test -- src/features/estoque-preview/EstoquePreview.test.tsx src/features/estoque/EstoqueUploadFotos.test.tsx`; esperar aprovação.

### Task 4: Mapa, reserva, métricas e auditoria de regressão

**Files:**
- Create: `src/features/estoque-preview/locationOrganization.ts`
- Create: `src/features/estoque-preview/inventoryMetrics.ts`
- Modify: `src/features/estoque-preview/EstoquePreview.tsx`
- Modify: `src/server/routes/estoque.ts`
- Test: `src/features/estoque-preview/locationOrganization.test.ts`
- Test: `src/features/estoque-preview/inventoryMetrics.test.ts`
- Test: `src/server/routes/estoque.test.ts`

**Produces:** mapa derivado, reserva segura e métricas reais.

- [ ] Escrever testes que falham:

```ts
it('aceita várias categorias recomendadas por zona', () => {
  expect(construirMapa(locais, regras, unidades).zonas[0].categoriasRecomendadas).toEqual(['Freios', 'Motor']);
});
it('recusa segunda reserva ativa para a mesma unidade', async () => {
  await reservar('u1');
  await expect(reservar('u1')).rejects.toMatchObject({ status: 409 });
});
```

- [ ] Rodar `npm test -- src/features/estoque-preview/locationOrganization.test.ts src/server/routes/estoque.test.ts`; esperar falha.
- [ ] Implementar agrupamento por depósito/zona, busca por código/descrição, aviso de item fora da zona, reserva 409 em conflito, valores disponível/reservado/sem preço e gráfico de eventos persistidos. Sem eventos: estado vazio explícito, nunca dados demonstrativos fixos.
- [ ] Rodar `npm test -- src/features/estoque-preview/locationOrganization.test.ts src/features/estoque-preview/inventoryMetrics.test.ts src/server/routes/estoque.test.ts`; esperar aprovação.
- [ ] Auditar manualmente teclado, foco, Escape, mobile, dropdown longo, rolagem, foto, rede, mapa e lista; registrar achados novos na skill de UX.
- [ ] Executar `npm test -- src/server/routes/estoque.test.ts src/features/estoque-preview && npm run lint && npm run build`; registrar resultados reais e avisos separados.

## Self-review

O plano cobre os bloqueios P0/P1: persistência, localização, muitas categorias, individualização, foto, reserva, métrica e recuperação. SQL é criação de arquivo apenas; aplicação no Supabase continua um checkpoint humano separado.
