// Máquina de remoção de fundo das fotos, extraída de
// EstoquePublicarMlModal.tsx pra poder ser instanciada UM NÍVEL ACIMA (na
// tela de editar peça): assim o processamento começa quando o toggle
// "Publicar automaticamente no Mercado Livre" é ligado, e as prévias já
// estão prontas quando o formulário abre. Aprovar continua sendo clique
// explícito do usuário — a remoção erra em peça escura/fundo próximo, e
// foto ruim não pode entrar no anúncio sozinha.
//
// 100% client-side (@imgly/background-removal, WASM — ver
// src/utils/removerFundoImagem.ts pro porquê de não haver rota no backend).
import { useCallback, useRef, useState } from 'react';
import { aviso } from '../../components/ui/toast';
import { comprimirImagem } from '../../utils/comprimirImagem';
import { removerFundoImagem } from '../../utils/removerFundoImagem';
import { uploadImagemEstoque } from './api';

export interface PreviewFundo {
  originalUrl: string;
  antesSrc: string;
  depoisBlob: Blob;
  depoisPreviewUrl: string;
}

// Mesmo teto do pool de workers em removerFundoImagem.ts — não faz sentido
// deixar clicar numa 3ª foto se o pool só processa 2 ao mesmo tempo mesmo.
// iniciarTodas não respeita esse teto de propósito: o pool já enfileira o
// excedente sozinho, e a fila é justamente o ganho de disparar cedo.
const MAX_REMOCOES_SIMULTANEAS = 2;

export interface RemocaoFundoFotos {
  processandoUrls: Set<string>;
  previews: PreviewFundo[];
  fotosProcessadas: Record<string, string>;
  aprovandoUrl: string | null;
  podeIniciarMais: boolean;
  iniciar: (originalUrl: string, fonte: File | string) => Promise<void>;
  iniciarTodas: (urls: string[]) => void;
  tentarNovaFoto: (originalUrl: string, arquivo: File) => Promise<void>;
  aprovar: (originalUrl: string) => Promise<string | null>;
  descartar: (originalUrl: string) => void;
  limparTudo: () => void;
}

function revogarSeBlob(url: string) {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url);
}

export function useRemocaoFundoFotos(): RemocaoFundoFotos {
  const [processandoUrls, setProcessandoUrls] = useState<Set<string>>(new Set());
  const [previews, setPreviews] = useState<PreviewFundo[]>([]);
  const [fotosProcessadas, setFotosProcessadas] = useState<Record<string, string>>({});
  const [aprovandoUrl, setAprovandoUrl] = useState<string | null>(null);
  // Espelho síncrono do que já foi disparado — iniciarTodas roda em loop e
  // não pode depender do estado de prévias, que só atualiza no próximo
  // render (dispararia a mesma foto N vezes).
  const jaDisparadas = useRef<Set<string>>(new Set());

  const descartar = useCallback((originalUrl: string) => {
    setPreviews((atual) => {
      const preview = atual.find((p) => p.originalUrl === originalUrl);
      if (preview) {
        revogarSeBlob(preview.antesSrc);
        revogarSeBlob(preview.depoisPreviewUrl);
      }
      return atual.filter((p) => p.originalUrl !== originalUrl);
    });
  }, []);

  const iniciar = useCallback(
    async (originalUrl: string, fonte: File | string) => {
      jaDisparadas.current.add(originalUrl);
      descartar(originalUrl); // nova tentativa substitui a prévia anterior desta mesma foto
      setProcessandoUrls((atual) => new Set(atual).add(originalUrl));
      try {
        const resultado = await removerFundoImagem(fonte);
        if (!resultado.sucesso || !resultado.blob) {
          aviso.falha(null, 'Não foi possível remover o fundo desta foto');
          return;
        }
        const novaPreview: PreviewFundo = {
          originalUrl,
          antesSrc: typeof fonte === 'string' ? fonte : URL.createObjectURL(fonte),
          depoisBlob: resultado.blob,
          depoisPreviewUrl: URL.createObjectURL(resultado.blob),
        };
        setPreviews((atual) => [...atual.filter((p) => p.originalUrl !== originalUrl), novaPreview]);
      } finally {
        setProcessandoUrls((atual) => {
          const proximo = new Set(atual);
          proximo.delete(originalUrl);
          return proximo;
        });
      }
    },
    [descartar]
  );

  const iniciarTodas = useCallback(
    (urls: string[]) => {
      for (const url of urls) {
        if (jaDisparadas.current.has(url)) continue;
        void iniciar(url, url);
      }
    },
    [iniciar]
  );

  // "Tirar outra foto" reaproveita a mesma peça que estava sendo retocada —
  // o usuário está tentando de novo, não anexando uma foto nova solta.
  // Comprime antes (mesmo pipeline do upload normal em EstoqueView.tsx).
  const tentarNovaFoto = useCallback(
    async (originalUrl: string, arquivo: File) => {
      const { arquivo: comprimido } = await comprimirImagem(arquivo);
      jaDisparadas.current.delete(originalUrl);
      await iniciar(originalUrl, comprimido);
    },
    [iniciar]
  );

  const aprovar = useCallback(
    async (originalUrl: string): Promise<string | null> => {
      const preview = previews.find((p) => p.originalUrl === originalUrl);
      if (!preview) return null;
      setAprovandoUrl(originalUrl);
      try {
        const arquivo = new File([preview.depoisBlob], 'fundo-removido.jpg', { type: 'image/jpeg' });
        const resultado = await uploadImagemEstoque(arquivo);
        if (!resultado.success || !resultado.url) {
          aviso.falha(null, 'Não foi possível salvar a foto sem fundo');
          return null;
        }
        setFotosProcessadas((prev) => ({ ...prev, [originalUrl]: resultado.url! }));
        descartar(originalUrl);
        aviso.sucesso('Foto sem fundo aplicada ao anúncio');
        return resultado.url;
      } catch (err) {
        aviso.falha(err, 'Não foi possível salvar a foto sem fundo');
        return null;
      } finally {
        setAprovandoUrl(null);
      }
    },
    [previews, descartar]
  );

  const limparTudo = useCallback(() => {
    setPreviews((atual) => {
      for (const preview of atual) {
        revogarSeBlob(preview.antesSrc);
        revogarSeBlob(preview.depoisPreviewUrl);
      }
      return [];
    });
    setFotosProcessadas({});
    setProcessandoUrls(new Set());
    setAprovandoUrl(null);
    jaDisparadas.current = new Set();
  }, []);

  // Devolve um objeto NOVO a cada render, de propósito — não envolver em
  // useMemo. Cada `set*` acima (mesmo os de limparTudo, que "zera" com
  // `[]`/`{}`/`new Set()`) cria uma instância nova mesmo partindo de um
  // valor logicamente vazio, então memoizar o retorno sobre esses estados
  // nunca alcança um ponto fixo — um consumidor que colocasse este objeto
  // (mesmo memoizado) no array de dependências de um efeito que chama
  // limparTudo() entraria em loop infinito (limparTudo → estado novo →
  // objeto memoizado novo → efeito dispara de novo → limparTudo de novo).
  // Por isso: quem consome este hook nunca deve colocar o objeto retornado
  // no array de dependências de um efeito que o hook mesmo alimenta — só
  // ler os campos/funções fora de deps reativas, ou depender de valores
  // primitivos específicos (ex: `item.id`), nunca do objeto inteiro.
  return {
    processandoUrls,
    previews,
    fotosProcessadas,
    aprovandoUrl,
    podeIniciarMais: processandoUrls.size < MAX_REMOCOES_SIMULTANEAS,
    iniciar,
    iniciarTodas,
    tentarNovaFoto,
    aprovar,
    descartar,
    limparTudo,
  };
}
