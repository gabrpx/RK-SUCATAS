# Prompt mestre — Estoque Preview

🎯 Target: Codex (GPT-5)

```text
Você é o segundo desenvolvedor e auditor de produto do RK Sucatas. Trabalhe somente na rota isolada `/estoque-preview`, preservando alterações locais e sem modificar API, banco, Supabase, autenticação, `src/App.tsx` ou a rota real `/estoque`.

Objetivo: reconstruir a preview do novo estoque como uma simulação operacional completa, alinhada visualmente à Tela 1 de Tarefas, para provar que o novo modelo organiza todo o estoque legado em Peças canônicas e Unidades físicas individuais.

Fonte de verdade:
- Leia `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md` e `docs/superpowers/specs/2026-09-21-estoque-preview-grande-operacao-design.md`.
- Use `docs/auditorias/estoque-preview-2026-09-21/AUDITORIA.md` e suas imagens como evidência visual.
- Preserve a fonte Geist/Inter e a densidade da Tela 1 de Tarefas; não use fonte monoespaçada.

Requisitos obrigatórios:
1. Substitua as fontes de dados duplicadas por uma única store local demonstrativa. Catálogo, busca, métricas, fila, mapa e arquivo devem derivar dela.
2. Demonstre dados reais auditados nas categorias RABETA, ESCAPAMENTOS e EMBREAGEM. Desdobre quantidades em unidades individuais. Não invente fotos; mostre `Sem foto`. Marque endereços como fictícios.
3. Faça busca por nome, categoria, compatibilidade, código legado, SKU e endereço.
4. Ofereça visualização principal em cartões e alternativa em lista.
5. Implemente localmente os fluxos de adicionar uma unidade, editar Peça/Unidade, arquivar com confirmação e restaurar/desfazer. Arquivar preserva histórico.
6. Mantenha a reserva de 20% por 7 dias, com tempo restante e endereço preservado.
7. Mostre uma prateleira por vez no mapa, com 8 seções e categorias personalizáveis. O mapa deve mudar imediatamente quando a store muda.
8. Use um composer modal em etapas semelhante à estrutura da criação de tarefas e um painel lateral para detalhes/edição.
9. Preserve responsividade, teclado, foco, rótulos acessíveis e alvos de toque.
10. Siga TDD: escreva testes que falham, implemente o mínimo e refatore. Rode testes focados, lint, suíte completa, build e `git diff --check`.

Restrições:
- Não instalar dependências.
- Não usar dados de produção para escrita.
- Não fazer commit, push, merge ou deploy.
- Não criar imagens falsas para peças sem foto.
- Não manter números hardcoded que possam divergir da store.

Conclua somente quando os fluxos forem navegáveis no localhost, as três categorias reais estiverem demonstradas, catálogo/mapa/contadores estiverem consistentes e todas as validações relevantes passarem. Registre limitações da preview e qualquer revisão humana necessária.
```

