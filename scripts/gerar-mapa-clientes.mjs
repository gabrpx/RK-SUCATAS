import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destinoEstados = resolve(raiz, 'src/features/clientes/mapa/brasil-estados.geo.json');
const destinoCentroides = resolve(raiz, 'src/features/clientes/mapa/municipios-centroides.json');
const baseMalhas = 'https://servicodados.ibge.gov.br/api/v3/malhas';
const endpointMunicipios = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';

const UFS = [
  ['11', 'RO'], ['12', 'AC'], ['13', 'AM'], ['14', 'RR'], ['15', 'PA'], ['16', 'AP'], ['17', 'TO'],
  ['21', 'MA'], ['22', 'PI'], ['23', 'CE'], ['24', 'RN'], ['25', 'PB'], ['26', 'PE'], ['27', 'AL'],
  ['28', 'SE'], ['29', 'BA'], ['31', 'MG'], ['32', 'ES'], ['33', 'RJ'], ['35', 'SP'], ['41', 'PR'],
  ['42', 'SC'], ['43', 'RS'], ['50', 'MS'], ['51', 'MT'], ['52', 'GO'], ['53', 'DF'],
];

const UF_POR_CODIGO = new Map(UFS);
const cabecalhos = { accept: 'application/vnd.geo+json, application/json', 'user-agent': 'rk-sucatas-clientes-map-generator' };

function normalizarNome(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function chaveMunicipio(uf, nome) {
  return `${uf}:${normalizarNome(nome)}`;
}

function validarFeatureCollection(valor, origem) {
  if (!valor || valor.type !== 'FeatureCollection' || !Array.isArray(valor.features)) {
    throw new Error(`${origem} não retornou um FeatureCollection GeoJSON válido.`);
  }
  return valor;
}

async function baixarJson(url) {
  const resposta = await fetch(url, { headers: cabecalhos });
  if (!resposta.ok) throw new Error(`Falha ao consultar IBGE (${resposta.status}) em ${url}.`);
  return resposta.json();
}

function areaAnel(anel) {
  let area = 0;
  for (let indice = 0; indice < anel.length - 1; indice += 1) {
    const [x1, y1] = anel[indice];
    const [x2, y2] = anel[indice + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function pontoNoAnel(ponto, anel) {
  const [x, y] = ponto;
  let dentro = false;
  for (let atual = 0, anterior = anel.length - 1; atual < anel.length; anterior = atual, atual += 1) {
    const [xAtual, yAtual] = anel[atual];
    const [xAnterior, yAnterior] = anel[anterior];
    const cruza = (yAtual > y) !== (yAnterior > y)
      && x < ((xAnterior - xAtual) * (y - yAtual)) / (yAnterior - yAtual) + xAtual;
    if (cruza) dentro = !dentro;
  }
  return dentro;
}

function pontoNoPoligono(ponto, poligono) {
  return pontoNoAnel(ponto, poligono[0]) && !poligono.slice(1).some((buraco) => pontoNoAnel(ponto, buraco));
}

function centroideAnel(anel) {
  let acumulado = 0;
  let x = 0;
  let y = 0;
  for (let indice = 0; indice < anel.length - 1; indice += 1) {
    const [x1, y1] = anel[indice];
    const [x2, y2] = anel[indice + 1];
    const cruzamento = x1 * y2 - x2 * y1;
    acumulado += cruzamento;
    x += (x1 + x2) * cruzamento;
    y += (y1 + y2) * cruzamento;
  }
  if (Math.abs(acumulado) < Number.EPSILON) return anel[0];
  return [x / (3 * acumulado), y / (3 * acumulado)];
}

function limitesDoAnel(anel) {
  return anel.reduce((limites, [x, y]) => ({
    minX: Math.min(limites.minX, x), maxX: Math.max(limites.maxX, x), minY: Math.min(limites.minY, y), maxY: Math.max(limites.maxY, y),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
}

function intersecoesHorizontais(anel, y) {
  const valores = [];
  for (let indice = 0; indice < anel.length - 1; indice += 1) {
    const [x1, y1] = anel[indice];
    const [x2, y2] = anel[indice + 1];
    if ((y1 > y) === (y2 > y)) continue;
    valores.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
  }
  return valores.sort((a, b) => a - b);
}

function pontoDeSuperficie(poligono) {
  const exterior = poligono[0];
  const candidato = centroideAnel(exterior);
  if (pontoNoPoligono(candidato, poligono)) return candidato;

  const limites = limitesDoAnel(exterior);
  const ys = [candidato[1]];
  for (let passo = 1; passo < 100; passo += 1) ys.push(limites.minY + ((limites.maxY - limites.minY) * passo) / 100);

  for (const y of ys) {
    const xs = intersecoesHorizontais(exterior, y);
    const candidatos = [];
    for (let indice = 0; indice + 1 < xs.length; indice += 2) candidatos.push([(xs[indice] + xs[indice + 1]) / 2, y]);
    const interno = candidatos
      .filter((ponto) => pontoNoPoligono(ponto, poligono))
      .sort((a, b) => Math.abs(a[0] - candidato[0]) - Math.abs(b[0] - candidato[0]))[0];
    if (interno) return interno;
  }
  throw new Error('Não foi possível calcular um ponto interno para um polígono municipal.');
}

function poligonoPrincipal(geometria) {
  const poligonos = geometria?.type === 'Polygon'
    ? [geometria.coordinates]
    : geometria?.type === 'MultiPolygon'
      ? geometria.coordinates
      : [];
  const principal = poligonos
    .filter((poligono) => Array.isArray(poligono?.[0]) && poligono[0].length >= 4)
    .sort((a, b) => areaAnel(b[0]) - areaAnel(a[0]))[0];
  if (!principal) throw new Error('Geometria municipal ausente ou incompatível.');
  return principal;
}

async function baixarMunicipiosPorUf() {
  const resultados = [];
  for (const [codigo] of UFS) {
    const url = `${baseMalhas}/estados/${codigo}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=minima`;
    resultados.push([codigo, await baixarJson(url)]);
  }
  return resultados;
}

async function gerar() {
  const [estadosBrutos, municipiosBrutos, municipiosPorUf] = await Promise.all([
    baixarJson(`${baseMalhas}/paises/BR?intrarregiao=UF&formato=application/vnd.geo+json&qualidade=minima`),
    baixarJson(endpointMunicipios),
    baixarMunicipiosPorUf(),
  ]);
  const estados = validarFeatureCollection(estadosBrutos, 'Malha de UFs');
  if (!Array.isArray(municipiosBrutos)) throw new Error('Relação de municípios do IBGE inválida.');

  const nomePorCodigo = new Map(municipiosBrutos.map((municipio) => [String(municipio.id), municipio.nome]));
  const centroides = {};
  for (const [codigoUf, bruto] of municipiosPorUf) {
    const uf = UF_POR_CODIGO.get(codigoUf);
    const municipios = validarFeatureCollection(bruto, `Malha municipal ${codigoUf}`);
    for (const feature of municipios.features) {
      const codigoMunicipio = String(feature?.properties?.codarea ?? '');
      const nome = nomePorCodigo.get(codigoMunicipio);
      if (!uf || !nome) throw new Error(`Município sem identificação oficial: ${codigoMunicipio || 'código ausente'}.`);
      const [longitudeBruta, latitudeBruta] = pontoDeSuperficie(poligonoPrincipal(feature.geometry));
      const longitude = Number(longitudeBruta.toFixed(6));
      const latitude = Number(latitudeBruta.toFixed(6));
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) throw new Error(`Coordenada inválida para ${nome}, ${uf}.`);
      centroides[chaveMunicipio(uf, nome)] = { longitude, latitude };
    }
  }

  if (estados.features.length !== 27 || new Set(Object.keys(centroides).map((chave) => chave.split(':')[0])).size !== 27) {
    throw new Error('A geração não encontrou as 27 Unidades da Federação.');
  }
  return { estados, centroides };
}

async function conferirOuGravar(caminho, conteudo, somenteConferir) {
  const serializado = `${JSON.stringify(conteudo)}\n`;
  if (!somenteConferir) {
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, serializado, 'utf8');
    return;
  }
  const atual = await readFile(caminho, 'utf8');
  if (atual !== serializado) throw new Error(`${caminho} está desatualizado. Execute: node scripts/gerar-mapa-clientes.mjs`);
}

const somenteConferir = process.argv.includes('--check');
const { estados, centroides } = await gerar();
await conferirOuGravar(destinoEstados, estados, somenteConferir);
await conferirOuGravar(destinoCentroides, centroides, somenteConferir);
console.log(`Mapa de clientes ${somenteConferir ? 'conferido' : 'gerado'}: ${Object.keys(centroides).length} municípios e ${estados.features.length} UFs.`);
