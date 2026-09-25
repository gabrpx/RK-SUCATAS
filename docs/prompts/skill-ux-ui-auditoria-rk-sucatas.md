# Prompt-base para a skill de UI/UX do RK Sucatas

> Arquivo vivo: adicionar novos aprendizados, dores e decisões aqui antes de transformar este prompt em uma skill definitiva.

Crie uma skill chamada `rk-sucatas-ui-ux` para auditar e melhorar fluxos de estoque, peças, fichas individuais, gavetas, vendas e demais áreas operacionais do RK Sucatas.

## Objetivo

Encontrar problemas de compreensão, fluxo, feedback, estados vazios, edição, navegação, responsividade, acessibilidade e consistência visual antes de propor alterações. A skill deve transformar cada achado em uma recomendação verificável e, quando o escopo autorizar, em implementação usando os componentes existentes do projeto.

## Contexto obrigatório

- Frontend React/Vite/TypeScript/Tailwind; backend Express; dados via API Express e Supabase no servidor.
- O sistema é operacional: velocidade, precisão, rastreabilidade e prevenção de erro têm prioridade sobre decoração.
- Peças podem ter quantidade, fichas físicas individuais, fotos, preço herdado ou próprio, avaria, venda e status incompleto.
- Fluxos de quantidade e fichas devem permitir aumentar, reduzir com segurança, preencher pendências e editar sem fechar o contexto atual.

## Método da skill

1. Ler as instruções do repositório e investigar o estado real antes de sugerir mudanças.
2. Reproduzir o fluxo descrito pelo usuário e registrar o caminho exato, o estado esperado e o estado observado.
3. Rastrear o dado entre UI, estado local, API e resposta persistida; diferenciar bug de produto, bug visual e limitação de dados.
4. Procurar componentes, padrões e testes existentes antes de criar algo novo.
5. Auditar desktop e mobile, teclado/foco, mensagens de erro/sucesso, loading, vazios, confirmação e recuperação.
6. Comparar campos equivalentes entre etapas: identificar digitação duplicada, conferir se o valor da etapa anterior é preservado ou autopreenchido e se a edição manual continua possível.
7. Conferir paridade entre criação e edição para fotos: adicionar, substituir e remover imagem depois do cadastro, distinguindo foto própria da unidade e foto geral de referência.
8. Conferir atualização entre dispositivos: confirmar se gravações feitas em outro aparelho aparecem na tela aberta, quanto tempo levam e como a tela se recupera após perda de conexão.
9. Priorizar correções que removam bloqueios do trabalho. Para cada recomendação, informar impacto, risco, dependências e critério de aceite.
10. Perguntar ao usuário somente quando a decisão mudar regra de negócio ou risco de dados; decisões locais de UI podem seguir o padrão existente.

## Regras de implementação

- Reutilizar componentes prontos e animados já presentes no projeto; não criar primitives visuais do zero.
- Não esconder ações essenciais em menus ambíguos ou portais frágeis dentro de modais sem validar o comportamento.
- Toda alteração de quantidade deve explicar claramente qual ficha/unidade será afetada, atualizar o contexto aberto imediatamente e preservar rolagem/foco.
- Valor, foto e demais dados herdáveis devem aparecer como defaults explícitos, sem impedir substituição pelo usuário.
- Não alterar banco, contratos, permissões ou dados reais sem escopo e aprovação explícitos.
- Validar com testes disponíveis, TypeScript/build e uma reprodução manual do caso original.

## Formato dos resultados

Entregar: resumo executivo; reprodução; causa raiz; severidade/prioridade; proposta; arquivos e componentes envolvidos; critérios de aceite; validações; limitações; perguntas pendentes; e um backlog incremental de melhorias.

## Aprendizados acumulados

- [2026-09-15] Uma peça criada com várias unidades precisa oferecer uma ação explícita para aumentar a quantidade e gerar novas fichas em branco; registrar unidade não pode parar apenas porque não há ficha em branco disponível.
- [2026-09-15] Editar uma unidade deve atualizar o detalhe aberto imediatamente, sem exigir fechar e reabrir.
- [2026-09-15] Fechar modal sobre uma tabela não pode propagar o clique para a linha que estava atrás nem deslocar a rolagem sem foco na origem.
- [2026-09-15] Ficha individual precisa de uma visualização própria com todas as fotos, não apenas a foto de capa.
- [2026-09-25] Dados repetidos em etapas do cadastro devem ser herdados/autopreenchidos da etapa anterior e continuar editáveis; validar esse percurso completo.
- [2026-09-25] A edição de uma unidade existente precisa permitir anexar e remover fotos, com a mesma distinção entre foto própria e foto de referência usada na criação e consulta.
- [2026-09-25] Em estoque usado simultaneamente no celular e computador, verificar propagação de alterações sem recarregar a página e recuperação da sincronização após reconexão.

## Prompt master — feedback imediato após adicionar unidade

Ao implementar qualquer ação de estoque que crie ou altere uma unidade dentro de um detalhe já aberto, preserve o contexto atual e aplique a resposta persistida da API no estado local imediatamente. A nova unidade/ficha deve aparecer no mesmo modal, sem exigir fechar e reabrir. Exiba feedback de sucesso e destaque a pendência de preenchimento quando a unidade nascer em branco. Valide também loading, erro recuperável, contadores do cabeçalho, filtros ativos, rolagem e foco. O critério de aceite é: clicar em “Adicionar unidade” → a quantidade e a ficha nova aparecem no detalhe aberto após a resposta, sem navegação adicional.
