// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';

let contentProps: Record<string, unknown> = {};

vi.mock('radix-ui', () => {
  const PassThrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const Content = ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => {
    contentProps = props;
    return <div>{children}</div>;
  };

  return {
    Dialog: {
      Root: PassThrough,
      Portal: PassThrough,
      Overlay: PassThrough,
      Content,
      Title: PassThrough,
      Description: PassThrough,
      Close: PassThrough,
      Trigger: PassThrough,
    },
    VisuallyHidden: { Root: PassThrough },
  };
});

vi.mock('motion/react', () => ({
  motion: { div: ({ children, ...props }: { children?: ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div> },
}));

import { DialogContent } from './dialog';

afterEach(() => {
  cleanup();
  contentProps = {};
});

describe('DialogContent', () => {
  it('não trata um dropdown em portal como clique fora do diálogo', () => {
    render(<DialogContent open onClose={vi.fn()} title="Detalhes"><p>Conteúdo</p></DialogContent>);

    const alvoDoMenu = document.createElement('div');
    alvoDoMenu.dataset.slot = 'dropdown-menu-content';
    document.body.append(alvoDoMenu);
    const preventDefault = vi.fn();
    const evento = {
      detail: { originalEvent: { target: alvoDoMenu } },
      target: alvoDoMenu,
      preventDefault,
    };

    for (const handler of [contentProps.onPointerDownOutside, contentProps.onInteractOutside]) {
      expect(handler).toEqual(expect.any(Function));
      (handler as (event: typeof evento) => void)(evento);
    }

    expect(preventDefault).toHaveBeenCalledTimes(2);
    alvoDoMenu.remove();
  });
});
