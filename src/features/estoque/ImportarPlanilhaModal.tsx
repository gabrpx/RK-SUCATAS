// Importação de estoque a partir de planilha. Existe pro dia de catalogação
// em massa: se já tem lista parcial em Excel/Sheets, não faz sentido redigitar
// peça por peça no formulário.
//
// Fluxo em três etapas, sempre com confirmação: escolher arquivo → conferir a
// pré-visualização (com o valor já convertido, que é onde erro caro se
// esconde) → importar. Nada vai pro banco antes do último clique.
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, Loader2, Download, ArrowLeft } from 'lucide-react';
import { cn } from '../../utils';
import { Modal } from '../../components/ui/Modal';
import { baixarCsv, gerarCsv } from '../../utils/csv';
import { estoqueApi } from './api';
import { lerPlanilhaEstoque, linhaParaEstoqueInput, gerarCsvModelo } from './planilha';
import type { ResultadoLeitura } from './planilha';
import type { Categoria, ModeloMoto } from '../../types/catalog';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

// Renderizar 3 mil linhas de uma vez trava o celular — o resto continua
// contabilizado no resumo, só não vira DOM.
const MAXIMO_LINHAS_RENDERIZADAS = 150;

interface Progresso {
  atual: number;
  total: number;
  falhas: { linha: number; nome: string; erro: string }[];
}

interface ImportarPlanilhaModalProps {
  aberto: boolean;
  onFechar: () => void;
  categorias: Categoria[];
  modelos: ModeloMoto[];
  criarCategoria: (nome: string, parent_id?: string | null) => Promise<any>;
  /** Chamado ao final pra a lista de estoque recarregar do servidor */
  onImportado: () => void;
}

export function ImportarPlanilhaModal({ aberto, onFechar, categorias, modelos, criarCategoria, onImportado }: ImportarPlanilhaModalProps) {
  const [textoCsv, setTextoCsv] = useState('');
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [leitura, setLeitura] = useState<ResultadoLeitura | null>(null);
  const [criarCategoriasAusentes, setCriarCategoriasAusentes] = useState(false);
  const [progresso, setProgresso] = useState<Progresso | null>(null);
  const [concluido, setConcluido] = useState<Progresso | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const { validas, comErro } = useMemo(() => {
    const linhas = leitura?.linhas ?? [];
    return {
      validas: linhas.filter((l) => l.erros.length === 0),
      comErro: linhas.filter((l) => l.erros.length > 0),
    };
  }, [leitura]);

  const reiniciar = () => {
    setTextoCsv('');
    setNomeArquivo('');
    setLeitura(null);
    setCriarCategoriasAusentes(false);
    setProgresso(null);
    setConcluido(null);
  };

  const fecharTudo = () => {
    if (progresso) return; // importação em andamento: não deixa fechar no meio
    reiniciar();
    onFechar();
  };

  const processarTexto = (texto: string, arquivo = '') => {
    setTextoCsv(texto);
    setNomeArquivo(arquivo);
    setLeitura(lerPlanilhaEstoque(texto, categorias, modelos));
    setConcluido(null);
  };

  const aoEscolherArquivo = async (file: File) => {
    const texto = await file.text();
    processarTexto(texto, file.name);
  };

  const executarImportacao = async () => {
    if (!leitura) return;

    let categoriasAtuais = categorias;
    let linhasParaImportar = validas;

    // Cria as categorias que faltavam e relê a planilha — assim os ids saem
    // resolvidos pela mesma lógica de sempre, sem casar nome na mão aqui.
    if (criarCategoriasAusentes && leitura.categoriasAusentes.length > 0) {
      setProgresso({ atual: 0, total: leitura.categoriasAusentes.length, falhas: [] });
      for (const nome of leitura.categoriasAusentes) {
        try {
          const resultado = await criarCategoria(nome, null);
          if (resultado?.success && resultado.data) categoriasAtuais = [...categoriasAtuais, resultado.data];
        } catch (err) {
          console.error('Falha ao criar categoria da planilha:', nome, err);
        }
      }
      const releitura = lerPlanilhaEstoque(textoCsv, categoriasAtuais, modelos);
      setLeitura(releitura);
      linhasParaImportar = releitura.linhas.filter((l) => l.erros.length === 0);
    }

    const falhas: Progresso['falhas'] = [];
    setProgresso({ atual: 0, total: linhasParaImportar.length, falhas });

    // Sequencial de propósito: reaproveita a validação da rota existente e
    // mantém o código de cada peça na ordem da planilha.
    for (let i = 0; i < linhasParaImportar.length; i++) {
      const linha = linhasParaImportar[i];
      try {
        const resultado = await estoqueApi.criar(linhaParaEstoqueInput(linha));
        if (!resultado.success) throw new Error(resultado.error || 'Erro desconhecido');
      } catch (err: any) {
        falhas.push({ linha: linha.numeroLinha, nome: linha.nome, erro: err.message || 'Falha ao salvar' });
      }
      setProgresso({ atual: i + 1, total: linhasParaImportar.length, falhas: [...falhas] });
    }

    const resumo = { atual: linhasParaImportar.length, total: linhasParaImportar.length, falhas };
    setProgresso(null);
    setConcluido(resumo);
    onImportado();
  };

  const baixarLinhasComErro = () => {
    const linhas: (string | number)[][] = [
      ['Linha', 'Nome', 'Categoria', 'Moto', 'Condição', 'Valor', 'Quantidade', 'Ano', 'Nota', 'Descrição', 'Problema'],
      ...comErro.map((l) => [
        l.numeroLinha,
        l.nome,
        l.categoriaTexto,
        l.modeloTexto,
        l.condicao === 'original' ? 'Original' : 'Paralela',
        String(l.valor).replace('.', ','),
        l.quantidade,
        l.ano ?? '',
        l.notaCadastro === 'com_nota' ? 'Com nota' : l.notaCadastro === 'sem_nota' ? 'Sem nota' : '',
        l.descricao ?? '',
        l.erros.join(' | '),
      ]),
    ];
    baixarCsv('linhas-com-erro.csv', gerarCsv(linhas));
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';

  // ---------------------------------------------------------------- rodapé
  let rodape: ReactNode = null;
  if (concluido) {
    rodape = (
      <button onClick={fecharTudo} className="w-full h-11 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider hover:opacity-90">
        Fechar
      </button>
    );
  } else if (progresso) {
    rodape = (
      <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
        <Loader2 size={16} className="animate-spin" />
        Importando {progresso.atual} de {progresso.total}...
      </div>
    );
  } else if (leitura) {
    rodape = (
      <div className="flex gap-3">
        <button
          onClick={reiniciar}
          className="h-11 px-4 rounded-control border border-border-default text-text-secondary text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-raised flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Trocar arquivo
        </button>
        <button
          onClick={executarImportacao}
          disabled={validas.length === 0 && !(criarCategoriasAusentes && leitura.categoriasAusentes.length > 0)}
          className="flex-1 h-11 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider hover:opacity-90 disabled:opacity-40"
        >
          Importar {validas.length} {validas.length === 1 ? 'peça' : 'peças'}
        </button>
      </div>
    );
  }

  return (
    <Modal
      aberto={aberto}
      onFechar={fecharTudo}
      titulo="Importar planilha"
      subtitulo={nomeArquivo || 'CSV exportado do Excel ou Google Sheets'}
      icone={FileSpreadsheet}
      tamanho="lg"
      rodape={rodape}
    >
      {/* ---------------------------------------------- etapa 3: concluído */}
      {concluido ? (
        <div className="space-y-4 text-center py-4">
          <div className="size-14 rounded-full bg-positive-bg text-positive flex items-center justify-center mx-auto">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <p className="text-2xl font-medium text-text-primary">{concluido.total - concluido.falhas.length}</p>
            <p className="text-sm text-text-faint mt-0.5">peças cadastradas com sucesso</p>
          </div>
          {concluido.falhas.length > 0 && (
            <div className="text-left bg-danger-bg/40 border border-danger/20 rounded-card p-4 space-y-2">
              <p className="text-sm font-medium text-danger">{concluido.falhas.length} não entraram:</p>
              <ul className="text-xs text-text-secondary space-y-1 max-h-40 overflow-y-auto">
                {concluido.falhas.map((f) => (
                  <li key={f.linha}>
                    Linha {f.linha} ({f.nome}): {f.erro}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : !leitura ? (
        /* ------------------------------------------- etapa 1: escolher arquivo */
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => inputArquivoRef.current?.click()}
            className="w-full py-10 rounded-card border-2 border-dashed border-border-default hover:border-accent/50 hover:bg-surface-card transition-colors flex flex-col items-center gap-3 text-text-muted hover:text-accent-soft-fg"
          >
            <Upload size={26} />
            <span className="text-sm font-medium">Escolher arquivo CSV</span>
            <span className="text-xs text-text-faint">Aceita separador ; ou , — do Excel ou do Sheets</span>
          </button>
          <input
            ref={inputArquivoRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) aoEscolherArquivo(file);
              e.target.value = '';
            }}
          />

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border-subtle" />
            <span className="text-[11px] uppercase tracking-wider text-text-faint">ou cole o conteúdo</span>
            <div className="h-px flex-1 bg-border-subtle" />
          </div>

          <textarea
            rows={5}
            placeholder={'Nome;Categoria;Moto;Condição;Valor;Quantidade\nCDI Titan 150;CDI;Titan 150;Original;120,00;1'}
            className={cn(inputClass, 'font-mono text-xs resize-none')}
            onChange={(e) => {
              const texto = e.target.value;
              if (texto.trim().length > 0 && texto.includes('\n')) processarTexto(texto, 'texto colado');
            }}
          />

          <button
            type="button"
            onClick={() => baixarCsv('modelo-estoque.csv', gerarCsvModelo())}
            className="text-xs text-accent-soft-fg hover:underline flex items-center gap-1.5"
          >
            <Download size={13} /> Baixar planilha modelo
          </button>
        </div>
      ) : (
        /* --------------------------------------- etapa 2: conferir e importar */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-card border border-border-subtle rounded-card p-3">
              <p className="text-[20px] font-medium text-positive leading-none">{validas.length}</p>
              <p className="text-[11px] text-text-faint mt-1.5">prontas pra importar</p>
            </div>
            <div className="bg-surface-card border border-border-subtle rounded-card p-3">
              <p className={cn('text-[20px] font-medium leading-none', comErro.length > 0 ? 'text-danger' : 'text-text-faint')}>{comErro.length}</p>
              <p className="text-[11px] text-text-faint mt-1.5">com problema</p>
            </div>
          </div>

          {leitura.colunasFaltando.length > 0 && (
            <div className="bg-danger-bg/40 border border-danger/20 rounded-card p-4">
              <p className="text-sm font-medium text-danger flex items-center gap-2">
                <AlertTriangle size={15} /> Faltam colunas obrigatórias
              </p>
              <p className="text-xs text-text-secondary mt-1.5">
                A planilha precisa ter as colunas <strong>{leitura.colunasFaltando.join(' e ')}</strong>. Baixe a planilha modelo e ajuste os títulos da primeira
                linha.
              </p>
              <button type="button" onClick={() => baixarCsv('modelo-estoque.csv', gerarCsvModelo())} className="text-xs text-danger hover:underline mt-2 flex items-center gap-1.5">
                <Download size={12} /> Baixar planilha modelo
              </button>
            </div>
          )}

          {leitura.categoriasAusentes.length > 0 && (
            <label className="flex items-start gap-3 bg-warning-bg/40 border border-warning/20 rounded-card p-4 cursor-pointer">
              <input
                type="checkbox"
                checked={criarCategoriasAusentes}
                onChange={(e) => setCriarCategoriasAusentes(e.target.checked)}
                className="mt-0.5 size-4 accent-[var(--warning)] shrink-0"
              />
              <span className="min-w-0">
                <span className="text-sm font-medium text-warning block">
                  Criar {leitura.categoriasAusentes.length} {leitura.categoriasAusentes.length === 1 ? 'categoria que não existe' : 'categorias que não existem'}
                </span>
                <span className="text-xs text-text-secondary block mt-1 break-words">{leitura.categoriasAusentes.join(', ')}</span>
                <span className="text-xs text-text-faint block mt-1">Entram como categoria raiz — dá pra reorganizar depois em Configurações.</span>
              </span>
            </label>
          )}

          {comErro.length > 0 && (
            <button
              type="button"
              onClick={baixarLinhasComErro}
              className="w-full text-xs text-text-secondary hover:text-text-primary border border-border-default rounded-control py-2.5 flex items-center justify-center gap-2 hover:bg-surface-raised"
            >
              <Download size={13} /> Baixar as {comErro.length} linhas com problema pra corrigir no Excel
            </button>
          )}

          <div className="border border-border-subtle rounded-card overflow-hidden">
            <div className="md:hidden divide-y divide-border-subtle max-h-72 overflow-y-auto">
              {leitura.linhas.slice(0, MAXIMO_LINHAS_RENDERIZADAS).map((linha) => {
                const temErro = linha.erros.length > 0;
                return (
                  <div key={linha.numeroLinha} className={cn('px-3 py-2.5 text-xs', temErro && 'bg-danger-bg/20')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-text-faint tabular-nums">#{linha.numeroLinha}</span>
                      <span className="text-text-secondary tabular-nums">
                        {formatCurrency(linha.valor)} · {linha.quantidade} un.
                      </span>
                    </div>
                    <p className="text-text-primary mt-0.5">{linha.nome || <span className="text-text-faint italic">sem nome</span>}</p>
                    <p className="text-text-secondary text-[11px] mt-0.5">{linha.categoriaTexto}</p>
                    {(temErro || linha.avisos.length > 0) && (
                      <p className={cn('mt-1 text-[11px]', temErro ? 'text-danger' : 'text-warning')}>
                        {temErro ? linha.erros.join(' · ') : linha.avisos.join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-inset sticky top-0">
                  <tr className="text-left text-text-muted">
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Peça</th>
                    <th className="px-3 py-2 font-semibold">Categoria</th>
                    <th className="px-3 py-2 font-semibold text-right">Valor</th>
                    <th className="px-3 py-2 font-semibold text-right">Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {leitura.linhas.slice(0, MAXIMO_LINHAS_RENDERIZADAS).map((linha) => {
                    const temErro = linha.erros.length > 0;
                    return (
                      <tr key={linha.numeroLinha} className={cn('border-t border-border-subtle/60', temErro && 'bg-danger-bg/20')}>
                        <td className="px-3 py-2 text-text-faint tabular-nums align-top">{linha.numeroLinha}</td>
                        <td className="px-3 py-2 align-top">
                          <span className="text-text-primary">{linha.nome || <span className="text-text-faint italic">sem nome</span>}</span>
                          {(temErro || linha.avisos.length > 0) && (
                            <span className={cn('block mt-0.5 text-[11px]', temErro ? 'text-danger' : 'text-warning')}>
                              {temErro ? linha.erros.join(' · ') : linha.avisos.join(' · ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-text-secondary align-top">{linha.categoriaTexto}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary align-top">{formatCurrency(linha.valor)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-text-secondary align-top">{linha.quantidade}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {leitura.linhas.length > MAXIMO_LINHAS_RENDERIZADAS && (
              <p className="text-[11px] text-text-faint px-3 py-2 border-t border-border-subtle">
                Mostrando as primeiras {MAXIMO_LINHAS_RENDERIZADAS} de {leitura.linhas.length} linhas — a importação considera todas.
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
