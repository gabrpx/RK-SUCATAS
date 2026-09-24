// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EstoqueUploadFotos } from './EstoqueUploadFotos';

afterEach(cleanup);

describe('acessibilidade do envio de fotos do estoque', () => {
  it.each(['Enter', ' '])('abre o seletor de arquivos com a tecla %s', (key) => {
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={vi.fn()} onArquivosSelecionados={vi.fn()} enviando={false} resumoCompressao={null} />);
    const dropzone = screen.getByRole('button', { name: 'Enviar fotos: clique ou arraste arquivos aqui' });
    const seletor = document.querySelector('input[type="file"]') as HTMLInputElement;
    const abrirSeletor = vi.spyOn(seletor, 'click');

    fireEvent.keyDown(dropzone, { key });

    expect(abrirSeletor).toHaveBeenCalledOnce();
  });

  it('não abre o seletor enquanto o envio está em andamento', () => {
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={vi.fn()} onArquivosSelecionados={vi.fn()} enviando resumoCompressao={null} />);
    const dropzone = screen.getByRole('button', { name: 'Enviar fotos: clique ou arraste arquivos aqui' });
    const seletor = document.querySelector('input[type="file"]') as HTMLInputElement;
    const abrirSeletor = vi.spyOn(seletor, 'click');

    fireEvent.keyDown(dropzone, { key: 'Enter' });

    expect(abrirSeletor).not.toHaveBeenCalled();
  });
});
