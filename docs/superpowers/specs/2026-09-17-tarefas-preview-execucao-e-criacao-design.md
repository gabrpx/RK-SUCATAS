# Tarefas Preview — Execução e Criação

## Objetivo

Elevar o drawer de detalhes e o modal de criação de tarefas para fluxos
operacionais claros, sem alterar backend, contratos, banco ou dependências.

## Direção de UX

### Detalhes da tarefa

- Mostrar apenas contexto que pertence à tarefa; não exibir bancada ou corredor
  como texto fixo.
- Dar precedência visual ao estado, prazo e próxima ação.
- Manter uma barra de ação fixa no rodapé do drawer.
- Distinguir tarefas individuais e coletivas por responsáveis e checklist.
- Transformar confirmações em histórico cronológico conciso.

### Criação de tarefa

- Organizar o formulário em: Definir tarefa, Coordenar execução, Preparar
  checklist e Revisar e criar.
- Manter um único controle de responsáveis e um resumo da equipe selecionada.
- Apresentar prioridade e prazo como uma única decisão de SLA.
- Permitir atribuir uma pessoa a cada subtarefa no preview.
- Proteger o descarte de preenchimentos modificados.

## Restrições

- Reutilizar React, Tailwind, Motion e Animate UI já presentes.
- Não instalar dependências.
- Não introduzir regra de negócio nova: título continua sendo o único campo que
  bloqueia a criação, como já ocorre no preview.
- Respeitar `prefers-reduced-motion` para animações novas.

## Critérios de aceite

- O drawer mantém a ação principal acessível após rolagem.
- Textos de localização inexistentes não são exibidos como dados reais.
- O modal não duplica a seleção de responsáveis.
- Checklist coletivo mostra o responsável de cada etapa.
- Fechar um formulário alterado pede confirmação.
- Mudanças de estado usam apenas opacidade e transform, sem reanimar a página.
