# Fila de adição em massa: persistência, velocidade e duplicatas

## Objetivo

Garantir que itens iguais adicionados com graus diferentes formem uma única peça com várias unidades, preservar a fila enquanto o usuário fecha o site ou o aparelho e reduzir o tempo de gravação de lotes de aproximadamente 20 itens.

## Arquitetura

1. **Fila no navegador**
   - Extrair a persistência para um módulo versionado.
   - Usar IndexedDB como armazenamento principal, com `localStorage` como fallback de metadados.
   - Salvar imediatamente após cada alteração da fila; restaurar ao abrir o compositor.
   - Limpar somente após gravação confirmada ou descarte explícito.
   - Não persistir arquivos em `localStorage`; IndexedDB preserva os `File` quando disponível.

2. **Gravação rápida**
   - Manter a unidade lógica por peça, preservando os graus individuais.
   - Processar peças independentes com concorrência limitada, evitando avalanche de requests.
   - Compartilhar cache de upload e promessas de criação de modelo na sessão.
   - Fazer uma única atualização final do estoque.
   - Manter as operações de unidade atômicas no endpoint/RPC já existente.

3. **Duplicatas já existentes**
   - Reutilizar a detecção atual apenas para sugerir candidatos.
   - Não mesclar automaticamente nomes apenas parecidos.
   - Implementar uma operação assistida/transacional que mova unidades, compatibilidades e vínculos necessários para a peça canônica, preserve vendas/histórico e arquive ou remova o registro duplicado somente depois da confirmação.
   - A execução contra dados reais depende de acesso ao ambiente Supabase e confirmação dos pares; não será simulada no código local.

## Arquivos previstos

- `src/features/estoque-preview/bulkQueueStorage.ts`
- `src/features/estoque-preview/BulkInventoryComposer.tsx`
- `src/features/estoque-preview/EstoquePreview.tsx`
- testes do compositor e do armazenamento/concorrência
- API/SQL de fusão assistida somente se o contrato dos dados existentes for confirmado

## Critérios de aceite

- Dois itens com mesmo nome/categoria/modelo e graus diferentes resultam em um único draft e em uma peça com unidades nos graus corretos.
- Fechar e reabrir o compositor restaura a fila sem exigir novo cadastro.
- Descartar ou concluir com sucesso remove a fila persistida.
- Um lote de peças independentes não é gravado serialmente; a concorrência é limitada e falhas não deixam a fila silenciosamente perdida.
- A validação cobre testes afetados, lint, build e revisão de diff.

## Riscos e limites

- Dados reais não serão apagados ou fundidos por heurística sem confirmar os IDs e o ambiente.
- Uploads podem ser interrompidos ao fechar imediatamente após selecionar fotos; a fila continua preservada, mas o usuário poderá precisar selecionar novamente arquivos que o navegador não consiga manter.
- O limite de concorrência deve respeitar rate limits do backend e do Supabase.

## Resultado desta execução

- A auditoria no projeto Supabase encontrou 10 registros duplicados em 8 grupos de igualdade exata.
- A consolidação preservou o registro mais antigo de cada grupo, transferiu as fichas de unidade, somou quantidades, unificou fotos e manteve os graus por unidade.
- A verificação posterior encontrou zero grupos exatos duplicados.
- A proteção permanente entregue nesta etapa fica no compositor de adição em massa: a fila é persistida localmente, a sessão agrupa itens iguais e uma nova inclusão exata já reutiliza a peça real existente.
