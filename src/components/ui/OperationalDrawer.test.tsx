// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { OperationalDrawer } from './OperationalDrawer';
import { operationalLightTokens } from './operationalTokens';

afterEach(() => cleanup());

function Controlado() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir ficha</button>
      <OperationalDrawer
        open={open}
        onOpenChange={setOpen}
        title="Cliente Ana"
        description="Dados e pendências da cliente"
        footer={<button type="button">Salvar</button>}
      >
        <button type="button">Primeira ação</button>
        <div className="h-[1200px]">Conteúdo longo</div>
      </OperationalDrawer>
    </>
  );
}

describe('OperationalDrawer', () => {
  it('fecha com Escape e devolve o foco ao acionador', async () => {
    render(<Controlado />);
    const trigger = screen.getByRole('button', { name: 'Abrir ficha' });
    trigger.focus();
    fireEvent.click(trigger);

    expect(await screen.findByRole('dialog', { name: 'Cliente Ana' })).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('fecha pelo overlay, descreve o diálogo e mantém conteúdo/rodapé separados', async () => {
    render(<Controlado />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir ficha' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cliente Ana' });
    const descriptionId = dialog.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Dados e pendências da cliente');
    expect(dialog.className).toContain('h-[100dvh]');
    expect(dialog.className).toContain('overflow-hidden');
    expect(dialog.querySelector('[data-operational-drawer-scroll]')?.className).toContain('overflow-y-auto');
    expect(dialog.querySelector('[data-operational-drawer-footer]')?.className).not.toContain('overflow-y-auto');

    fireEvent.pointerDown(screen.getByTestId('operational-drawer-overlay'));
    fireEvent.click(screen.getByTestId('operational-drawer-overlay'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('usa largura wide e reaplica tokens no portal', async () => {
    render(
      <OperationalDrawer open onOpenChange={vi.fn()} title="Ficha" size="wide">
        Conteúdo
      </OperationalDrawer>
    );
    const dialog = await screen.findByRole('dialog', { name: 'Ficha' });
    expect(dialog.className).toContain('max-w-[760px]');
    expect(dialog.style.getPropertyValue('--surface-card')).toBe(operationalLightTokens['--surface-card']);
  });
});
