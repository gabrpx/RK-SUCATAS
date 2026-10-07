# Dados e navegação sem espera nas telas novas

## Objetivo e aceite

- Estoque e Clientes devem mostrar dados reais quando as APIs respondem, sem depender de requisições auxiliares lentas.
- Navegar entre Dashboard, Estoque, Vendas, Clientes, Caixa e Tarefas deve preservar o estado e não desmontar a tela nem exibir o fallback de módulo após o aquecimento inicial.
- Falha de API deve continuar explícita; não substituir dados reais por dados de demonstração.

## Estado encontrado

- O servidor local na porta 3001 responde 200 para estoque, clientes operacionais e tarefas.
- `App.tsx` já mantém abas visitadas montadas, mas a primeira visita ainda carrega módulo e dados.
- `DataContext` consulta 11 endpoints a cada 10 s e admite cargas sobrepostas; só conclui após todos responderem.
- Clientes aguarda o resumo antes de pedir a lista. Estoque aguarda serviços auxiliares antes de exibir os itens.

## Implementação

1. Evitar cargas globais simultâneas e tratar o primeiro resultado de estoque separadamente do resto, preservando permissões e erros.
2. Retirar a dependência sequencial do resumo para carregar a lista de Clientes.
3. Desacoplar o carregamento principal do Estoque das respostas auxiliares.
4. Aquecer as telas novas permitidas em segundo plano após a tela ativa montar, preservando os painéis já visitados e sem bloquear a navegação.
5. Adicionar testes de regressão de espera/erro e validar lint, testes afetados, build, diff e preview 3001.
6. Se o preview embutido continuar expirando no payload grande de estoque, testar compressão HTTP da resposta sem mudar o contrato JSON; confirmar transferência menor e renderização real antes de manter a alteração.

## Riscos e limites

- Primeiro acesso sem cache e sem rede não pode exibir dados reais instantaneamente; mostrar estado de erro/carregamento honesto.
- Pré-montagem consome memória e solicita dados; iniciar após render inicial e respeitar permissão.
- Não modificar schema, autenticação, contratos financeiros, RPCs ou dados reais.
- Revisar o diff de arquivos críticos e confirmar ausência de edição concorrente antes de alterar.

## Validação em 07/10/2026

- Porta 3001 confirmada como o novo sistema. API de estoque com gzip: 200, 106–107 KB; sem gzip: 931 KB, mesmo JSON.
- Preview embutido em 3001: Estoque real sincronizado e itens visíveis; Clientes mostra 45 cadastros; Vendas, Caixa, Tarefas e Dashboard exibiram conteúdo na troca, sem fallback de módulo após aquecimento.
- Quatro arquivos de testes afetados: 38/38 passaram. Build web em diretório temporário: passou; artefato temporário removido.
- Type-check global permanece com 57 linhas de diagnósticos em componentes preexistentes, nenhuma nos arquivos desta alteração.
- Primeiro acesso sem cache ainda depende da rede. O aquecimento começa após a carga inicial, de modo que uma navegação feita antes dele pode mostrar espera.
