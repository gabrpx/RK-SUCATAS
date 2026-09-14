// Deriva valores de pré-preenchimento pros atributos de Marca, Número de
// peça e Tipo de veículo do formulário de publicação no Mercado Livre, a
// partir de dados que o sistema já tem (árvore de motos), em vez de confiar
// só no preditor do Mercado Livre — que às vezes vem vazio ou errado. Nunca
// sobrescreve escolha do usuário: EstoquePublicarMlModal só usa este
// resultado pra popular o valor INICIAL de valoresAtributos, que continua
// 100% editável depois. Mesmo padrão de matchModelo.ts/matchCategoria.ts:
// função pura, sem I/O, testada isolada.
import type { AtributoMl, AtributoValorInput, Estoque } from './types';
import type { ModeloMoto } from '../../types/catalog';
import { getAncestorChain } from '../motos/motoTree';

function normalizar(texto: string): string {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function encontrarAtributo(atributos: AtributoMl[], id: string, nomesPossiveis: string[]): AtributoMl | undefined {
  return atributos.find((a) => a.id === id || nomesPossiveis.some((nome) => normalizar(a.name) === normalizar(nome)));
}

// Atributo de texto livre: usa o texto direto. Atributo de lista: só
// preenche se achar, por nome normalizado, um value cujo nome bate
// (contains, não exact — cobre variações tipo "Moto e Quadriciclo" vs
// "Moto/Quadriciclo") — nunca inventa/força um value_id que não existe no
// catálogo real da categoria.
function valorParaAtributo(atributo: AtributoMl, textoDesejado: string, porContains = false): AtributoValorInput | undefined {
  if (atributo.value_type !== 'list') {
    return { id: atributo.id, value_name: textoDesejado };
  }
  const alvo = normalizar(textoDesejado);
  const valorEncontrado = atributo.values?.find((v) => (porContains ? normalizar(v.name).includes(alvo) : normalizar(v.name) === alvo));
  return valorEncontrado ? { id: atributo.id, value_id: valorEncontrado.id, value_name: valorEncontrado.name } : undefined;
}

type ItemParaAutopreenchimento = Pick<Estoque, 'modelo_moto_id'> & { modelo_moto?: Pick<ModeloMoto, 'nome'> | null };

export function derivarAutopreenchimentoAtributos(
  atributosCategoria: AtributoMl[],
  item: ItemParaAutopreenchimento,
  modelos: ModeloMoto[]
): Record<string, AtributoValorInput> {
  const preenchimento: Record<string, AtributoValorInput> = {};

  const atributoMarca = encontrarAtributo(atributosCategoria, 'BRAND', ['marca']);
  if (atributoMarca && item.modelo_moto_id) {
    const cadeia = getAncestorChain(item.modelo_moto_id, modelos);
    const marca = cadeia[0]?.nome;
    if (marca) {
      const valor = valorParaAtributo(atributoMarca, marca);
      if (valor) preenchimento[atributoMarca.id] = valor;
    }
  }

  // PART_NUMBER normalmente é o código do FABRICANTE, não o nome da moto —
  // aqui é usado pra guardar o nome da moto por pedido explícito do usuário
  // (ver docs/proposta-publicacao-mercadolivre.md / brief da Fase 3).
  const atributoNumeroPeca = encontrarAtributo(atributosCategoria, 'PART_NUMBER', ['número de peça', 'numero de peca']);
  if (atributoNumeroPeca && item.modelo_moto?.nome) {
    const valor = valorParaAtributo(atributoNumeroPeca, item.modelo_moto.nome);
    if (valor) preenchimento[atributoNumeroPeca.id] = valor;
  }

  const atributoTipoVeiculo = encontrarAtributo(atributosCategoria, 'VEHICLE_TYPE', ['tipo de veículo', 'tipo de veiculo']);
  if (atributoTipoVeiculo) {
    const valor = valorParaAtributo(atributoTipoVeiculo, 'moto', true);
    if (valor) preenchimento[atributoTipoVeiculo.id] = valor;
  }

  return preenchimento;
}
