export type HorizontalOverflowMetrics = {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
};

export type HorizontalOverflowState = {
  isScrollable: boolean;
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

const LAYOUT_EPSILON = 1;

export function getHorizontalOverflowState({
  scrollLeft,
  scrollWidth,
  clientWidth,
}: HorizontalOverflowMetrics): HorizontalOverflowState {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);
  const isScrollable = maxScrollLeft > LAYOUT_EPSILON;

  return {
    isScrollable,
    canScrollLeft: isScrollable && scrollLeft > LAYOUT_EPSILON,
    canScrollRight:
      isScrollable && scrollLeft < maxScrollLeft - LAYOUT_EPSILON,
  };
}
