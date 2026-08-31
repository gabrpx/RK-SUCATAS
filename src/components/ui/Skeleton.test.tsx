// @vitest-environment jsdom
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Skeleton } from './Skeleton';

afterEach(cleanup);

describe('<Skeleton>', () => {
  it('renderiza com className passada', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />);
    expect(container.firstChild).toHaveProperty('className');
    expect((container.firstChild as HTMLElement).className).toContain('h-4');
  });
  it('aplica classe shimmer quando shimmer=true', () => {
    const { container } = render(<Skeleton shimmer />);
    expect((container.firstChild as HTMLElement).className).toContain('animate-shimmer');
  });
});
