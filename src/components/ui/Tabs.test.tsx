// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Tabs } from './Tabs';

// motion.span usa layoutId pro indicator elástico — sem mockar, o teste de
// jsdom não roda a engine de animação (nem precisa). Mesmo padrão de
// Sheet.test.tsx: motion.tag vira o elemento puro.
vi.mock('motion/react', () => ({
  motion: new Proxy({}, {
    get: (_t, tag: string) => {
      const C = (props: any) => {
        const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, ...rest } = props;
        const Tag = tag as any;
        return <Tag {...rest} />;
      };
      C.displayName = `motion.${tag}`;
      return C;
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('<Tabs>', () => {
  afterEach(() => {
    cleanup();
  });

  it('renderiza labels e o content ativo', () => {
    render(
      <Tabs
        value="a"
        onChange={() => {}}
        items={[
          { key: 'a', label: 'A', content: <div>Conteudo A</div> },
          { key: 'b', label: 'B', content: <div>Conteudo B</div> },
        ]}
      />
    );
    expect(screen.getByText('A')).toBeDefined();
    expect(screen.getByText('Conteudo A')).toBeDefined();
  });

  it('dispara onChange ao clicar em outra tab', () => {
    const onChange = vi.fn();
    render(
      <Tabs
        value="a"
        onChange={onChange}
        items={[
          { key: 'a', label: 'A', content: <div>A</div> },
          { key: 'b', label: 'B', content: <div>B</div> },
        ]}
      />
    );
    fireEvent.click(screen.getByText('B'));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
