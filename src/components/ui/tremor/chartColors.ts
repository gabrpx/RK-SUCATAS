// Tremor chartColors — adaptado do original (github.com/tremorlabs/tremor)
// pra usar SÓ os tokens semânticos de src/styles/theme.css, nunca a paleta
// default do Tremor (blue/emerald/violet/...). Como o componente é
// copiado pro repo (não é pacote npm), o mapa de cores é editado direto
// aqui — é assim que o Tremor Raw espera ser customizado.
export type ColorUtility = 'bg' | 'stroke' | 'fill' | 'text';

export const chartColors = {
  accent: {
    bg: 'bg-accent',
    stroke: 'stroke-accent',
    fill: 'fill-accent',
    text: 'text-accent',
  },
  positive: {
    bg: 'bg-positive',
    stroke: 'stroke-positive',
    fill: 'fill-positive',
    text: 'text-positive',
  },
  warning: {
    bg: 'bg-warning',
    stroke: 'stroke-warning',
    fill: 'fill-warning',
    text: 'text-warning',
  },
  negative: {
    bg: 'bg-negative',
    stroke: 'stroke-negative',
    fill: 'fill-negative',
    text: 'text-negative',
  },
  muted: {
    bg: 'bg-text-muted',
    stroke: 'stroke-text-muted',
    fill: 'fill-text-muted',
    text: 'text-text-muted',
  },
} as const satisfies {
  [color: string]: {
    [key in ColorUtility]: string;
  };
};

export type AvailableChartColorsKeys = keyof typeof chartColors;

export const AvailableChartColors: AvailableChartColorsKeys[] = Object.keys(chartColors) as Array<AvailableChartColorsKeys>;

export const constructCategoryColors = (categories: string[], colors: AvailableChartColorsKeys[]): Map<string, AvailableChartColorsKeys> => {
  const categoryColors = new Map<string, AvailableChartColorsKeys>();
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length]);
  });
  return categoryColors;
};

export const getColorClassName = (color: AvailableChartColorsKeys, type: ColorUtility): string => {
  const fallbackColor = {
    bg: 'bg-text-muted',
    stroke: 'stroke-text-muted',
    fill: 'fill-text-muted',
    text: 'text-text-muted',
  };
  return chartColors[color]?.[type] ?? fallbackColor[type];
};
