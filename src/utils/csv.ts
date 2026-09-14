// Leitor/escritor de CSV sem dependência externa. Escrito à mão porque o
// caso de uso é pequeno e previsível (planilha exportada do Excel/Sheets) e
// não vale puxar uma lib pro bundle do app.
//
// Cobre o que aparece de verdade nesses arquivos: BOM do Excel, campo entre
// aspas com separador ou quebra de linha dentro, aspas escapadas como "".

export type LinhaCsv = string[];

// Excel em pt-BR salva com ';' — Sheets e exportações em inglês usam ','.
// Detecta pela primeira linha (fora de aspas) em vez de assumir.
function detectarSeparador(texto: string): string {
  const primeiraLinha = texto.split(/\r?\n/, 1)[0] || '';
  const candidatos = [';', ',', '\t'];
  let melhor = ';';
  let maiorContagem = -1;

  for (const sep of candidatos) {
    let contagem = 0;
    let dentroDeAspas = false;
    for (let i = 0; i < primeiraLinha.length; i++) {
      const char = primeiraLinha[i];
      if (char === '"') dentroDeAspas = !dentroDeAspas;
      else if (char === sep && !dentroDeAspas) contagem += 1;
    }
    if (contagem > maiorContagem) {
      maiorContagem = contagem;
      melhor = sep;
    }
  }
  return melhor;
}

export function parseCsv(textoBruto: string): LinhaCsv[] {
  // ﻿ é o BOM que o Excel escreve no começo do arquivo; sem remover,
  // o primeiro cabeçalho vira "﻿nome" e nenhuma coluna casa.
  const texto = textoBruto.replace(/^﻿/, '');
  if (!texto.trim()) return [];

  const separador = detectarSeparador(texto);
  const linhas: LinhaCsv[] = [];
  let campoAtual = '';
  let linhaAtual: string[] = [];
  let dentroDeAspas = false;

  const fecharCampo = () => {
    linhaAtual.push(campoAtual);
    campoAtual = '';
  };
  const fecharLinha = () => {
    fecharCampo();
    // Ignora linha totalmente vazia (última quebra do arquivo, linhas soltas
    // no meio da planilha).
    if (linhaAtual.some((c) => c.trim() !== '')) linhas.push(linhaAtual);
    linhaAtual = [];
  };

  for (let i = 0; i < texto.length; i++) {
    const char = texto[i];

    if (dentroDeAspas) {
      if (char === '"') {
        if (texto[i + 1] === '"') {
          campoAtual += '"';
          i += 1;
        } else {
          dentroDeAspas = false;
        }
      } else {
        campoAtual += char;
      }
      continue;
    }

    if (char === '"') {
      dentroDeAspas = true;
    } else if (char === separador) {
      fecharCampo();
    } else if (char === '\n') {
      fecharLinha();
    } else if (char !== '\r') {
      campoAtual += char;
    }
  }

  // Último campo/linha, quando o arquivo não termina em quebra de linha.
  if (campoAtual !== '' || linhaAtual.length > 0) fecharLinha();

  return linhas.map((linha) => linha.map((campo) => campo.trim()));
}

function escaparCampo(valor: string, separador: string): string {
  const precisaAspas = valor.includes(separador) || valor.includes('"') || valor.includes('\n') || valor.includes('\r');
  const escapado = valor.replace(/"/g, '""');
  return precisaAspas ? `"${escapado}"` : escapado;
}

// Separador ';' e BOM porque o destino é o Excel em português — abrir com ','
// jogaria tudo numa coluna só.
export function gerarCsv(linhas: (string | number | null | undefined)[][], separador = ';'): string {
  const corpo = linhas
    .map((linha) => linha.map((campo) => escaparCampo(campo === null || campo === undefined ? '' : String(campo), separador)).join(separador))
    .join('\r\n');
  return '﻿' + corpo;
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
