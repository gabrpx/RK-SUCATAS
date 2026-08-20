// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueUploadFotos } from './EstoqueUploadFotos';

function criarArquivo(nome: string, tipo: string, tamanhoBytes: number): File {
  return new File([new Uint8Array(tamanhoBytes)], nome, { type: tipo });
}

function inputDeArquivo() {
  return screen.getByLabelText(/Enviar fotos/i).querySelector('input[type="file"]') as HTMLInputElement;
}

describe('EstoqueUploadFotos', () => {
  afterEach(() => cleanup());

  it('seleciona um arquivo válido e chama onArquivosSelecionados', () => {
    const onArquivosSelecionados = vi.fn();
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={onArquivosSelecionados} enviando={false} resumoCompressao={null} />);

    const arquivo = criarArquivo('foto.jpg', 'image/jpeg', 1024);
    fireEvent.change(inputDeArquivo(), { target: { files: [arquivo] } });

    expect(onArquivosSelecionados).toHaveBeenCalledWith([arquivo]);
  });

  it('rejeita tipo de arquivo não aceito sem chamar onArquivosSelecionados', () => {
    const onArquivosSelecionados = vi.fn();
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={onArquivosSelecionados} enviando={false} resumoCompressao={null} />);

    const arquivo = criarArquivo('foto.pdf', 'application/pdf', 1024);
    fireEvent.change(inputDeArquivo(), { target: { files: [arquivo] } });

    expect(onArquivosSelecionados).not.toHaveBeenCalled();
    expect(screen.getByText(/Formato não aceito/)).toBeTruthy();
  });

  it('rejeita arquivo maior que o limite', () => {
    const onArquivosSelecionados = vi.fn();
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={onArquivosSelecionados} enviando={false} resumoCompressao={null} />);

    const arquivo = criarArquivo('foto.jpg', 'image/jpeg', 9 * 1024 * 1024);
    fireEvent.change(inputDeArquivo(), { target: { files: [arquivo] } });

    expect(onArquivosSelecionados).not.toHaveBeenCalled();
    expect(screen.getByText(/Arquivo muito grande/)).toBeTruthy();
  });

  it('mostra "Enviando fotos..." quando enviando=true', () => {
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={() => {}} enviando resumoCompressao={null} />);
    expect(screen.getByText('Enviando fotos...')).toBeTruthy();
  });

  it('clicar em remover chama onRemoverImagem com a url certa', () => {
    const onRemoverImagem = vi.fn();
    render(<EstoqueUploadFotos imagens={['https://x/a.jpg']} onRemoverImagem={onRemoverImagem} onArquivosSelecionados={() => {}} enviando={false} resumoCompressao={null} />);
    fireEvent.click(screen.getByTitle('Remover foto'));
    expect(onRemoverImagem).toHaveBeenCalledWith('https://x/a.jpg');
  });

  it('mostra o resumo de compressão quando presente', () => {
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={() => {}} enviando={false} resumoCompressao="Fotos otimizadas: 4 MB → 1 MB" />);
    expect(screen.getByText('Fotos otimizadas: 4 MB → 1 MB')).toBeTruthy();
  });
});
