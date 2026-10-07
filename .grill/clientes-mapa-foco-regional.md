# Grill: foco regional e legibilidade do mapa de clientes
Date: 2026-10-06

## Intent
Tornar o mapa de clientes útil para operação local, com a Paraíba como foco inicial, sem perder acesso geográfico a clientes de outros estados.

## Constraints
- O foco regional deve enquadrar a Paraíba inteira, sem cortar o contorno.
- Clientes fora do enquadramento continuam acessíveis por indicadores na borda e arraste, nas localizações corretas.
- Estados vizinhos aparecem discretamente como contexto.
- Ao voltar de Brasil inteiro para o foco regional, reenquadrar a Paraíba.
- O tamanho dos pontos pode variar conforme a quantidade de clientes, mas marcadores e tooltips devem manter escala visual coerente durante o zoom.
- Preservar a visão Brasil inteiro como alternativa.

## Key decisions
- Decision: usar a extensão geográfica da Paraíba como enquadramento fixo regional. Reason: leitura local consistente sem depender da distribuição de clientes. Alternative considered: ajustar a câmera automaticamente para todos os clientes.
- Decision: retornar ao enquadramento integral da Paraíba ao alternar para a visão regional. Reason: criar referência previsível. Alternative considered: restaurar pan/zoom manual anterior.
- Decision: preservar variação de tamanho dos pontos por quantidade, com dimensões consistentes entre níveis de zoom. Reason: comunicar concentração sem deixar tooltips e pontos desproporcionais.
- Decision: manter contornos vizinhos em tom discreto. Reason: orientar pontos externos sem competir com a Paraíba.

## Surfaced assumptions
- Pontos fora da Paraíba devem continuar navegáveis na borda do mapa, seguindo a preferência já expressa para o comportamento de mapa de jogo mobile.
- Transições entre foco regional e Brasil devem ser suaves, conforme solicitado anteriormente.

## Open questions
- Nenhuma decisão de produto pendente para implementar este recorte.

## Out of scope
- Alterações em API, banco de dados ou associação de visitas por cliente.
