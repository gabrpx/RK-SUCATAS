// Dropzone de fotos do Estoque — mesma linguagem visual do file-upload
// (Kokonut UI), mas sem a simulação de progresso por timer do original (que
// nunca reflete o upload de verdade) e aceitando vários arquivos de uma vez
// (o original só aceitava 1). Ver nota "por que precisa de adaptação" na
// Task 3 do plano de componentes animados do Estoque.
import { type DragEvent, type KeyboardEvent, useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Camera, Loader2, UploadCloud, X } from 'lucide-react';
import { cn } from '../../utils';
import { SPRING_MICRO } from '../../components/ui/motion';
import { ImageZoom } from '../../components/ui/image-zoom';
import { useHoverCapable } from '../../components/ui/beui-tooltip';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Margem acima do limite de 5MB do backend — comprimirImagem() encolhe antes
// de enviar, então o que barra aqui é só o caso claramente fora do padrão.
const TAMANHO_MAX_BYTES = 8 * 1024 * 1024;

interface EstoqueUploadFotosProps {
  imagens: string[];
  onRemoverImagem: (url: string) => void;
  onArquivosSelecionados: (files: File[]) => void;
  enviando: boolean;
  resumoCompressao: string | null;
}

export function EstoqueUploadFotos({ imagens, onRemoverImagem, onArquivosSelecionados, enviando, resumoCompressao }: EstoqueUploadFotosProps) {
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  // Sem hover = dispositivo de toque (mesmo mecanismo do resto do app). É onde
  // faz sentido oferecer "Tirar foto" abrindo a câmera direto; no desktop o
  // dropzone de galeria/arquivo continua sendo o único caminho.
  const isTouch = !useHoverCapable();

  const validarEEnviar = useCallback(
    (arquivos: File[]) => {
      setErro(null);
      const invalido = arquivos.find((f) => !TIPOS_ACEITOS.includes(f.type));
      if (invalido) return setErro(`Formato não aceito: ${invalido.name}`);
      const grande = arquivos.find((f) => f.size > TAMANHO_MAX_BYTES);
      if (grande) return setErro(`Arquivo muito grande: ${grande.name}`);
      onArquivosSelecionados(arquivos);
    },
    [onArquivosSelecionados]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setArrastando(false);
      if (enviando) return;
      const arquivos = Array.from(e.dataTransfer.files);
      if (arquivos.length > 0) validarEEnviar(arquivos);
    },
    [enviando, validarEEnviar]
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!enviando) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
        onClick={() => !enviando && inputRef.current?.click()}
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (!enviando) inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-disabled={enviando}
        aria-label="Enviar fotos: clique ou arraste arquivos aqui"
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed py-6 px-4 text-center transition-colors cursor-pointer',
          arrastando ? 'border-accent bg-accent-soft-bg/30' : 'border-border-default hover:border-accent/50',
          enviando && 'pointer-events-none opacity-70'
        )}
      >
        {enviando ? <Loader2 size={22} className="animate-spin text-accent-soft-fg" /> : <UploadCloud size={22} className="text-text-faint" />}
        <p className="text-xs font-semibold text-text-secondary">
          {enviando ? 'Enviando fotos...' : isTouch ? 'Escolher da galeria' : 'Arraste fotos aqui ou clique pra escolher'}
        </p>
        <p className="text-[10.5px] text-text-faint">JPG, PNG, WEBP ou GIF</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TIPOS_ACEITOS.join(',')}
          className="hidden"
          onClick={(event) => event.stopPropagation()}
          onChange={(e) => {
            if (e.target.files?.length) validarEEnviar(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      {/* Só em dispositivo de toque: abre a câmera direto (capture="environment"),
          sem cair na galeria. No desktop não há câmera do dispositivo pra abrir,
          então o botão nem aparece. */}
      {isTouch && (
        <button
          type="button"
          onClick={() => !enviando && cameraRef.current?.click()}
          disabled={enviando}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-control border border-border-default py-3 text-xs font-semibold text-text-secondary transition-colors',
            enviando ? 'pointer-events-none opacity-70' : 'hover:border-accent/50 active:bg-surface-raised'
          )}
        >
          <Camera size={18} className="text-accent-soft-fg" /> Tirar foto
        </button>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) validarEEnviar(Array.from(e.target.files));
          e.target.value = '';
        }}
      />

      <AnimatePresence>
        {erro && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={SPRING_MICRO}
            className="flex items-center gap-1.5 text-[11px] text-danger"
          >
            <AlertTriangle size={12} className="shrink-0" /> {erro}
          </motion.p>
        )}
      </AnimatePresence>

      {resumoCompressao && <p className="text-[11px] text-positive">{resumoCompressao}</p>}

      {imagens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagens.map((url, i) => (
            <div key={url} className="relative size-20 rounded-control overflow-hidden border border-border-default">
              <ImageZoom
                src={url}
                alt={`Foto ${i + 1}`}
                triggerClassName="block w-full h-full"
                className="w-full h-full"
                referrerPolicy="no-referrer"
              />
              {i === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-media-overlay-badge text-white text-[9px] font-semibold uppercase tracking-wide text-center py-0.5">
                  Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoverImagem(url)}
                title="Remover foto"
                className="absolute top-1 right-1 size-6 rounded-full bg-overlay-scrim text-white flex items-center justify-center hover:bg-danger"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
