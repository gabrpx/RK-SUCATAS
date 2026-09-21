// Tremor DonutChart [v1.0.0] — vendorizado de github.com/tremorlabs/tremor
// (copy-paste). Mesma adaptação de tema do AreaChart.tsx: cores só de
// chartColors.ts, sem classes dark: (app não tem tema claro).
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Pie, PieChart as ReChartsDonutChart, ResponsiveContainer, Sector, Tooltip } from 'recharts';

import { AvailableChartColors, type AvailableChartColorsKeys, constructCategoryColors, getColorClassName } from './chartColors';
import { cx } from './cx';

const PieCompat = Pie as React.ComponentType<any>;

const sumNumericArray = (arr: number[]): number => arr.reduce((sum, num) => sum + num, 0);

const parseData = (data: Record<string, any>[], categoryColors: Map<string, AvailableChartColorsKeys>, category: string) =>
  data.map((dataPoint) => ({
    ...dataPoint,
    color: categoryColors.get(dataPoint[category]) || AvailableChartColors[0],
    className: getColorClassName(categoryColors.get(dataPoint[category]) || AvailableChartColors[0], 'fill'),
  }));

const calculateDefaultLabel = (data: any[], valueKey: string): number => sumNumericArray(data.map((dataPoint) => dataPoint[valueKey]));

const parseLabelInput = (labelInput: string | undefined, valueFormatter: (value: number) => string, data: any[], valueKey: string): string =>
  labelInput || valueFormatter(calculateDefaultLabel(data, valueKey));

type TooltipProps = Pick<ChartTooltipProps, 'active' | 'payload'>;

type PayloadItem = {
  category: string;
  value: number;
  color: AvailableChartColorsKeys;
};

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  valueFormatter: (value: number) => string;
}

const ChartTooltip = ({ active, payload, valueFormatter }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={cx('rounded-control border border-border-default bg-surface-raised px-3 py-2 shadow-lg')}>
      <div className="space-y-1">
        {payload.map(({ value, category, color }, index) => (
          <div key={`id-${index}`} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-full', getColorClassName(color, 'bg'))} />
              <p className="text-xs text-text-secondary whitespace-nowrap">{category}</p>
            </div>
            <p className="text-sm font-medium text-text-primary whitespace-nowrap tabular-nums">{valueFormatter(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderInactiveShape = (props: any) => {
  const { cx: cxCoord, cy: cyCoord, innerRadius, outerRadius, startAngle, endAngle, className } = props;

  return (
    <Sector
      cx={cxCoord}
      cy={cyCoord}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      className={className}
      fill=""
      opacity={0.3}
      style={{ outline: 'none' }}
    />
  );
};

type DonutChartVariant = 'donut' | 'pie';

type BaseEventProps = {
  eventType: 'sector';
  categoryClicked: string;
  [key: string]: number | string;
};

type DonutChartEventProps = BaseEventProps | null | undefined;

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[];
  category: string;
  value: string;
  colors?: AvailableChartColorsKeys[];
  variant?: DonutChartVariant;
  valueFormatter?: (value: number) => string;
  label?: string;
  showLabel?: boolean;
  showTooltip?: boolean;
  onValueChange?: (value: DonutChartEventProps) => void;
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void;
  customTooltip?: React.ComponentType<TooltipProps>;
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  (
    {
      data = [],
      value,
      category,
      colors = AvailableChartColors,
      variant = 'donut',
      valueFormatter = (val: number) => val.toString(),
      label,
      showLabel = false,
      showTooltip = true,
      onValueChange,
      tooltipCallback,
      customTooltip,
      className,
      ...other
    },
    forwardedRef,
  ) => {
    const CustomTooltip = customTooltip;
    const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined);
    const isDonut = variant === 'donut';
    const parsedLabelInput = parseLabelInput(label, valueFormatter, data, value);

    const categories = Array.from(new Set(data.map((item) => item[category])));
    const categoryColors = constructCategoryColors(categories, colors);

    const prevActiveRef = React.useRef<boolean | undefined>(undefined);
    const prevCategoryRef = React.useRef<string | undefined>(undefined);

    const handleShapeClick = (shapeData: any, index: number, event: React.MouseEvent) => {
      event.stopPropagation();
      if (!onValueChange) return;

      if (activeIndex === index) {
        setActiveIndex(undefined);
        onValueChange(null);
      } else {
        setActiveIndex(index);
        onValueChange({ eventType: 'sector', categoryClicked: shapeData.payload[category], ...shapeData.payload });
      }
    };

    return (
      <div ref={forwardedRef} className={cx('h-40 w-40', className)} tremor-id="tremor-raw" {...other}>
        <ResponsiveContainer className="size-full">
          <ReChartsDonutChart
            onClick={
              onValueChange && activeIndex !== undefined
                ? () => {
                    setActiveIndex(undefined);
                    onValueChange(null);
                  }
                : undefined
            }
            margin={{ top: 0, left: 0, right: 0, bottom: 0 }}
          >
            {showLabel && isDonut && (
              <text className="fill-text-primary text-sm font-medium" x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                {parsedLabelInput}
              </text>
            )}
            <PieCompat
              className={cx('stroke-surface-card [&_.recharts-pie-sector]:outline-hidden', onValueChange ? 'cursor-pointer' : 'cursor-default')}
              data={parseData(data, categoryColors, category)}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={-270}
              innerRadius={isDonut ? '75%' : '0%'}
              outerRadius="100%"
              stroke=""
              strokeLinejoin="round"
              dataKey={value}
              nameKey={category}
              isAnimationActive={false}
              onClick={handleShapeClick}
              activeIndex={activeIndex}
              inactiveShape={renderInactiveShape}
              style={{ outline: 'none' }}
            />
            {showTooltip && (
              <Tooltip
                wrapperStyle={{ outline: 'none' }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const cleanPayload = payload
                    ? payload.map((item: any) => ({
                        category: item.payload[category],
                        value: item.value,
                        color: categoryColors.get(item.payload[category]) as AvailableChartColorsKeys,
                      }))
                    : [];

                  const payloadCategory: string = cleanPayload[0]?.category;

                  if (tooltipCallback && (active !== prevActiveRef.current || payloadCategory !== prevCategoryRef.current)) {
                    tooltipCallback({ active, payload: cleanPayload });
                    prevActiveRef.current = active;
                    prevCategoryRef.current = payloadCategory;
                  }

                  return showTooltip && active ? (
                    CustomTooltip ? (
                      <CustomTooltip active={active} payload={cleanPayload} />
                    ) : (
                      <ChartTooltip active={active} payload={cleanPayload} valueFormatter={valueFormatter} />
                    )
                  ) : null;
                }}
              />
            )}
          </ReChartsDonutChart>
        </ResponsiveContainer>
      </div>
    );
  },
);

DonutChart.displayName = 'DonutChart';

export { DonutChart, type DonutChartEventProps, type TooltipProps };
