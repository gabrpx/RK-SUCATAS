export const ORIGENS_CLIENTE = ['whatsapp', 'facebook', 'mercado_livre', 'instagram', 'indicacao', 'balcao'] as const;
const ORIGENS_CLIENTE_LEGADAS = ['redes_sociais', 'outro'] as const;
export const PREFERENCIAS_CONTATO_OPERACIONAIS = ['whatsapp', 'instagram'] as const;

export type OrigemClienteOperacional = (typeof ORIGENS_CLIENTE)[number] | (typeof ORIGENS_CLIENTE_LEGADAS)[number];
export type PreferenciaContatoOperacional = (typeof PREFERENCIAS_CONTATO_OPERACIONAIS)[number];

const UFS = new Set(['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonObject = Record<string, unknown>;

export interface ClienteOperacionalValidado {
  id?: string;
  nome: string;
  telefone: string | null;
  instagram_usuario: string | null;
  documento: string | null;
  data_nascimento: string | null;
  origem: OrigemClienteOperacional;
  preferencia_contato: PreferenciaContatoOperacional;
  tags: string[];
  observacoes: string | null;
  cidade: string;
  estado: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
}

export interface PedidoOperacionalValidado {
  descricao: string;
  cliente_moto_id: string | null;
  modelo_moto_id: string | null;
  moto_modelo_texto: string | null;
  categoria_id: string | null;
  ano_compatibilidade: string | null;
  observacoes: string | null;
  responsavel_id: string;
  prometido_para: string | null;
  idempotency_key: string;
}

export type ResultadoValidacao<T> = { ok: true; valor: T } | { ok: false; erros: string[] };

function objeto(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function texto(value: unknown, limite: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limite) : '';
}

function textoOuNulo(value: unknown, limite: number): string | null {
  return texto(value, limite) || null;
}

function uuidOuNulo(value: unknown): string | null {
  const valueString = texto(value, 60);
  return UUID.test(valueString) ? valueString : null;
}

export function normalizarTelefone(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  const digitos = String(value).replace(/\D/g, '').slice(0, 11);
  return digitos.length === 10 || digitos.length === 11 ? digitos : null;
}

export function normalizarInstagram(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const handle = String(value).trim().replace(/^@+/, '').toLowerCase();
  if (!/^[a-z0-9._]{1,30}$/.test(handle)) return null;
  return handle;
}

export function validarContatoObrigatorio(input: unknown): string[] {
  const dados = objeto(input);
  const telefone = normalizarTelefone(dados.telefone);
  const instagram = normalizarInstagram(dados.instagram_usuario);
  const telefoneInformado = texto(dados.telefone, 40).length > 0;
  const instagramInformado = texto(dados.instagram_usuario, 80).length > 0;
  const preferencia = texto(dados.preferencia_contato, 30);
  const erros: string[] = [];

  if (telefoneInformado && !telefone) erros.push('WhatsApp inválido');
  if (instagramInformado && !instagram) erros.push('Instagram inválido');
  if (!telefone && !instagram) erros.push('Informe WhatsApp ou Instagram');
  if (!PREFERENCIAS_CONTATO_OPERACIONAIS.includes(preferencia as PreferenciaContatoOperacional)) {
    erros.push('Escolha WhatsApp ou Instagram como contato');
  } else if (preferencia === 'whatsapp' && !telefone) {
    erros.push('Informe o WhatsApp escolhido como contato');
  } else if (preferencia === 'instagram' && !instagram) {
    erros.push('Informe o Instagram escolhido como contato');
  }
  return Array.from(new Set(erros));
}

export function validarClienteInput(input: unknown): ResultadoValidacao<ClienteOperacionalValidado> {
  const dados = objeto(input);
  const erros = validarContatoObrigatorio(dados);
  const nome = texto(dados.nome, 160);
  const cidade = texto(dados.cidade, 120);
  const estado = texto(dados.estado, 2).toUpperCase();
  const origem = texto(dados.origem, 40);
  const preferencia = texto(dados.preferencia_contato, 30);
  const id = uuidOuNulo(dados.id);

  if (nome.length < 2) erros.push('Nome deve ter pelo menos 2 caracteres');
  if (!cidade) erros.push('Cidade é obrigatória');
  if (!estado) erros.push('Estado é obrigatório');
  else if (!UFS.has(estado)) erros.push('Estado inválido');
  const origemNovaValida = ORIGENS_CLIENTE.includes(origem as (typeof ORIGENS_CLIENTE)[number]);
  const origemLegadaPreservada = Boolean(id) && ORIGENS_CLIENTE_LEGADAS.includes(origem as (typeof ORIGENS_CLIENTE_LEGADAS)[number]);
  if (!origemNovaValida && !origemLegadaPreservada) erros.push('Origem inválida');
  if (dados.id !== undefined && !id) erros.push('Cliente inválido');

  if (erros.length > 0) return { ok: false, erros: Array.from(new Set(erros)) };

  const tags = Array.isArray(dados.tags)
    ? Array.from(new Set(dados.tags.map((tag) => texto(tag, 40).toLowerCase()).filter(Boolean))).slice(0, 20)
    : [];

  return {
    ok: true,
    valor: {
      ...(id ? { id } : {}),
      nome,
      telefone: normalizarTelefone(dados.telefone),
      instagram_usuario: normalizarInstagram(dados.instagram_usuario),
      documento: texto(dados.documento, 30).replace(/\D/g, '') || null,
      data_nascimento: textoOuNulo(dados.data_nascimento, 10),
      origem: origem as OrigemClienteOperacional,
      preferencia_contato: preferencia as PreferenciaContatoOperacional,
      tags,
      observacoes: textoOuNulo(dados.observacoes, 2000),
      cidade,
      estado,
      cep: texto(dados.cep, 12).replace(/\D/g, '') || null,
      logradouro: textoOuNulo(dados.logradouro, 180),
      numero: textoOuNulo(dados.numero, 30),
      complemento: textoOuNulo(dados.complemento, 120),
      bairro: textoOuNulo(dados.bairro, 120),
    },
  };
}

export function validarPedidoInput(input: unknown): ResultadoValidacao<PedidoOperacionalValidado> {
  const dados = objeto(input);
  const erros: string[] = [];
  const descricao = texto(dados.descricao, 500);
  const clienteMotoId = uuidOuNulo(dados.cliente_moto_id);
  const modeloMotoId = uuidOuNulo(dados.modelo_moto_id);
  const motoTexto = textoOuNulo(dados.moto_modelo_texto, 160);
  const categoriaId = uuidOuNulo(dados.categoria_id);
  const responsavelId = uuidOuNulo(dados.responsavel_id);
  const idempotencyKey = texto(dados.idempotency_key, 120);
  const prometidoPara = textoOuNulo(dados.prometido_para, 40);

  if (!descricao) erros.push('Descrição da peça é obrigatória');
  if (!clienteMotoId && !modeloMotoId && !motoTexto) erros.push('Informe a moto do pedido');
  if (!responsavelId) erros.push('Responsável é obrigatório');
  if (!idempotencyKey || idempotencyKey.length < 8) erros.push('Chave de idempotência é obrigatória');
  if (dados.cliente_moto_id !== undefined && texto(dados.cliente_moto_id, 60) && !clienteMotoId) erros.push('Moto do cliente inválida');
  if (dados.modelo_moto_id !== undefined && texto(dados.modelo_moto_id, 60) && !modeloMotoId) erros.push('Modelo de moto inválido');
  if (dados.categoria_id !== undefined && texto(dados.categoria_id, 60) && !categoriaId) erros.push('Categoria inválida');
  if (prometidoPara && !Number.isFinite(Date.parse(prometidoPara))) erros.push('Data combinada inválida');

  if (erros.length > 0 || !responsavelId) return { ok: false, erros: Array.from(new Set(erros)) };
  return {
    ok: true,
    valor: {
      descricao,
      cliente_moto_id: clienteMotoId,
      modelo_moto_id: modeloMotoId,
      moto_modelo_texto: motoTexto,
      categoria_id: categoriaId,
      ano_compatibilidade: textoOuNulo(dados.ano_compatibilidade, 20),
      observacoes: textoOuNulo(dados.observacoes, 2000),
      responsavel_id: responsavelId,
      prometido_para: prometidoPara,
      idempotency_key: idempotencyKey,
    },
  };
}
