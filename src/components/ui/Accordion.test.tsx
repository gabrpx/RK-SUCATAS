// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Accordion } from './Accordion';

describe('<Accordion>', () => {
  afterEach(() => {
    cleanup();
  });

  it('expande item ao clicar', () => {
    render(
      <Accordion
        type="single"
        items={[
          { key: 'a', title: 'Cabeça A', content: <div>Corpo A</div> },
          { key: 'b', title: 'Cabeça B', content: <div>Corpo B</div> },
        ]}
      />
    );
    fireEvent.click(screen.getByText('Cabeça A'));
    expect(screen.getByText('Corpo A')).toBeDefined();
  });
});
