# Prompt para Claude Code — clipboard de fotos das peças

Copie e cole o bloco abaixo no Claude Code.

```text
Você é o executor principal desta tarefa no repositório RK Sucatas. Implemente uma função profissional para copiar fotos de produtos/peças do estoque para o clipboard, permitindo que o operador cole as imagens diretamente em um chat.

## Objetivo do usuário

Clientes pedem fotos das peças e é improdutivo tirar ou localizar as mesmas imagens repetidamente. Em uma variante ou unidade do estoque deve existir um botão claro para:

1. copiar todas as fotos disponíveis naquele contexto; ou
2. abrir uma seleção para escolher exatamente quais fotos copiar.

Depois, o usuário colará manualmente no chat. O sistema não deve enviar mensagens automaticamente.

## Leitura obrigatória antes de codar

- Leia `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md` e `CLAUDE.md`.
- Execute `git status --short --branch` e preserve alterações válidas.
- Inspecione `src/features/estoque/gaveta/`, especialmente `GavetaDetail.tsx`, `VarianteCard.tsx`, `UnidadeDetailDialog.tsx`, `UnidadeRow.tsx`, `types.ts` e `api.ts`.
- Procure utilitários/componentes existentes antes de criar novos.
- Use a skill `ux-audit` do projeto se ela existir; se o nome disponível for `product-design:audit`, use essa equivalente para revisar o fluxo e os componentes.

## Escopo funcional

### Onde aparecerá

- Adicione o ponto de entrada na ficha da variante (`VarianteCard`) e, quando fizer sentido, na ficha da unidade (`UnidadeDetailDialog`).
- Não substitua o organizador/gaveta por fotos: somente os itens/variantes/unidades devem receber capa, respeitando a regra de produto já existente.
- Reutilize os componentes visuais e tokens laranja do sistema e os componentes Animate UI já presentes; não invente uma aparência paralela.

### Fluxo

- Botão com texto e ícone compreensíveis, por exemplo `Copiar fotos`.
- Ao acionar, abrir um diálogo acessível com duas ações: `Copiar todas` e `Escolher fotos`.
- `Escolher fotos` mostra miniaturas, checkbox/estado selecionado, origem (`unidade` ou `referência da variante`), texto alternativo e quantidade selecionada.
- Permitir confirmar, cancelar e limpar seleção.
- Desabilitar a ação quando não houver fotos e explicar o motivo.
- Após sucesso, mostrar feedback visível e não ambíguo: quantidade copiada e instrução para colar no chat.

### Regra de fotos

- No contexto de uma unidade, usar primeiro as fotos próprias da unidade.
- Se a unidade não tiver foto própria, incluir as fotos legadas da variante somente se elas já forem exibidas como referência naquele detalhe, identificando-as como referência.
- No contexto de uma variante, reunir as fotos disponíveis daquela variante e de suas unidades conforme o modelo de dados existente, sem buscar fotos de outras variantes.
- Preservar ordem estável e remover URLs duplicadas.
- Não gravar base64, não fazer upload, não alterar banco e não modificar a relação das fotos; esta tarefa é somente de cópia.

## Implementação técnica

- Criar um utilitário pequeno e testável para buscar cada URL, transformar em `Blob` e escrever imagens usando `navigator.clipboard.write` e `ClipboardItem`.
- Validar `window.isSecureContext`, existência de `navigator.clipboard.write` e suporte a `ClipboardItem`.
- Tratar `NotAllowedError`, falha de `fetch`, resposta não-imagem, URL inacessível por CORS e clipboard indisponível.
- Não afirmar que múltiplas imagens foram copiadas se o navegador não aceitar múltiplos `ClipboardItem`s. Nesse caso, informar a limitação e oferecer uma alternativa explícita (copiar uma por vez e/ou baixar as selecionadas), sem falha silenciosa.
- Não adicionar dependência nova sem justificar no diff.
- Manter a service role e qualquer segredo fora do navegador.

## TDD e validação

Antes da implementação final, escreva testes para:

- deduplicação e ordem das fotos;
- unidade com fotos próprias;
- unidade sem fotos próprias usando referência legada;
- seleção parcial, copiar todas, cancelar e zero selecionadas;
- sucesso do clipboard;
- clipboard não suportado, permissão negada, fetch falho e resposta inválida;
- feedback de fallback para múltiplas imagens.

Use mocks para `fetch`, `navigator.clipboard` e `ClipboardItem`; não acesse dados reais nos testes. Execute os testes existentes, `npm run lint` e `npm run build`.

## Preview e auditoria

Como esta é uma alteração visual, inicie/abra o preview local e verifique o fluxo com dados reais em desktop e mobile. Teste especialmente:

- botão na variante e na unidade;
- diálogo sem clipping;
- nomes completos e miniaturas;
- navegação por teclado, foco e leitor de tela;
- estado sem fotos e estado de erro;
- colagem efetiva no clipboard em localhost/HTTPS, quando suportada pelo navegador.

Depois rode a skill de UX audit e corrija problemas diretamente ligados a este fluxo. Preserve a identidade laranja, o espaçamento e os padrões dos diálogos existentes.

## Fora de escopo e limites

- Não editar `.env`, segredos, `node_modules`, `dist`, migrations, schema, RLS, `server.ts`, autenticação ou Supabase sem uma necessidade comprovada e explicitamente justificada.
- Não enviar mensagens automaticamente.
- Não remover fotos antigas nem migrar dados.
- Se descobrir um problema arquitetural fora desse escopo, registre-o ao final em vez de expandir a tarefa.

## Entrega obrigatória

- Atualize a patchnote do sistema se o projeto exigir uma entrada para a nova funcionalidade.
- Revise o diff completo e confirme que não levou alterações alheias.
- Faça commit e push para a branch/deploy configurados pelo projeto, pois esta tarefa foi explicitamente autorizada pelo usuário para publicação.
- Ao terminar, explique em linguagem normal:
  1. o que foi feito;
  2. em quais arquivos;
  3. como funciona o copiar todas/selecionar;
  4. quais limitações de navegador/chat foram tratadas;
  5. quais testes, lint, build, auditoria UX e preview foram executados;
  6. hash do commit e destino do push;
  7. qualquer pendência que ainda exija decisão humana.
```
