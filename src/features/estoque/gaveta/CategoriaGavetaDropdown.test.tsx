// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CategoriaGavetaDropdown } from './CategoriaGavetaDropdown';

afterEach(cleanup);

const opcoes = [
  { id: '', nome: 'Sem categoria' },
  { id: 'roda', nome: 'Roda dianteira' },
  { id: 'motor', nome: 'Motor completo' },
];

describe('CategoriaGavetaDropdown', () => {
  it('permite digitar para filtrar e selecionar uma categoria', () => {
    const onChange = vi.fn();
    render(<CategoriaGavetaDropdown id="categoria" label="Categoria" value="" options={opcoes} onChange={onChange} />);

    const trigger = screen.getByRole('button', { name: /categoria/i });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    fireEvent.change(screen.getByRole('textbox', { name: /buscar categoria/i }), { target: { value: 'roda' } });

    expect(screen.getByRole('menuitemradio', { name: 'Roda dianteira' })).toBeTruthy();
    expect(screen.queryByRole('menuitemradio', { name: 'Motor completo' })).toBeNull();

    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Roda dianteira' }));
    expect(onChange).toHaveBeenCalledWith('roda');
  });
});
