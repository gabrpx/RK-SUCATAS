# Ativos geográficos do Painel de Clientes

`brasil-estados.geo.json` e `municipios-centroides.json` são ativos locais do frontend. O mapa nunca consulta geocodificação, Google Maps ou outro provedor enquanto é usado.

## Origem e atualização

Os dois arquivos são derivados da API de malhas do [IBGE](https://servicodados.ibge.gov.br/api/docs/malhas), em GeoJSON com qualidade `minima`, e da relação oficial de municípios do IBGE. Para atualizá-los, com acesso à rede autorizado:

```powershell
node scripts/gerar-mapa-clientes.mjs
node scripts/gerar-mapa-clientes.mjs --check
```

O gerador busca as 27 UFs e suas malhas municipais, calcula um ponto dentro do maior polígono de cada município e grava o resultado indexado por `UF:nome-normalizado`. Não substitua os centroides por coordenadas aproximadas nem coloque endereço ou CEP de clientes nesse arquivo.
