// Tremor AreaChart [v1.0.0] — vendorizado de github.com/tremorlabs/tremor
// (copy-paste, não existe pacote npm nem CLI tipo shadcn pra Vite ainda —
// ver nota de instalação no PR/commit). Adaptado pro tema deste projeto:
//  - cores só vêm de chartColors.ts (tokens de theme.css), nunca da paleta
//    default do Tremor;
//  - removida a legenda com slider (RiArrowLeftSLine/RiArrowRightSLine):
//    nenhum uso atual precisa dela, e ela puxaria @remixicon/react como
//    dependência nova só pra código morto;
//  - removidas as classes dark: — este app não tem tema claro.
/* eslint-disable @typescript-eslint/no-explicit-any */

import React from 'react';
import { Area, CartesianGrid, Dot, Label, AreaChart as RechartsAreaChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AxisDomain } from 'recharts/types/util/types';

import { AvailableChartColors, type AvailableChartColorsKeys, constructCategoryColors, getColorClassName } from './chartColors';
import { cx } from './cx';
import { getYAxisDomain } from './getYAxisDomain';
import { hasOnlyOneValueForKey } from './hasOnlyOneValueForKey';

type TooltipProps = Pick<ChartTooltipProps, 'active' | 'payload' | 'label'>;

type PayloadItem = {
  category: string;
  value: number;
  index: string;
  color: AvailableChartColorsKeys;
  type?: string;
  payload: any;
};

interface ChartTooltipProps {
  active: boolean | undefined;
  payload: PayloadItem[];
  label: string;
  valueFormatter: (value: number) => string;
}

const ChartTooltip = ({ active, payload, label, valueFormatter }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={cx('rounded-control border border-border-default bg-surface-raised px-3 py-2 shadow-lg')}>
      <p className="text-[10px] uppercase tracking-wide text-text-faint mb-1">{label}</p>
      <div className="space-y-1">
        {payload.map(({ value, category, color }, index) => (
          <div key={`id-${index}`} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={cx('h-[3px] w-3.5 shrink-0 rounded-full', getColorClassName(color, 'bg'))} />
              <p className="text-xs text-text-secondary whitespace-nowrap">{category}</p>
            </div>
            <p className="text-sm font-medium text-text-primary whitespace-nowrap tabular-nums">{valueFormatter(value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ActiveDot {
  index?: number;
  dataKey?: string;
}

type BaseEventProps = {
  eventType: 'dot' | 'category';
  categoryClicked: string;
  [key: string]: number | string;
};

type AreaChartEventProps = BaseEventProps | null | undefined;

interface AreaChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[];
  index: string;
  categories: string[];
  colors?: AvailableChartColorsKeys[];
  valueFormatter?: (value: number) => string;
  startEndOnly?: boolean;
  showXAxis?: boolean;
  showYAxis?: boolean;
  showGridLines?: boolean;
  yAxisWidth?: number;
  intervalType?: 'preserveStartEnd' | 'equidistantPreserveStart';
  showTooltip?: boolean;
  autoMinValue?: boolean;
  minValue?: number;
  maxValue?: number;
  allowDecimals?: boolean;
  onValueChange?: (value: AreaChartEventProps) => void;
  tickGap?: number;
  connectNulls?: boolean;
  xAxisLabel?: string;
  yAxisLabel?: string;
  type?: 'default' | 'stacked' | 'percent';
  fill?: 'gradient' | 'solid' | 'none';
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void;
  customTooltip?: React.ComponentType<TooltipProps>;
}

const AreaChart = React.forwardRef<HTMLDivElement, AreaChartProps>((props, ref) => {
  const {
    data = [],
    categories = [],
    index,
    colors = AvailableChartColors,
    valueFormatter = (value: number) => value.toString(),
    startEndOnly = false,
    showXAxis = true,
    showYAxis = true,
    showGridLines = true,
    yAxisWidth = 56,
    intervalType = 'equidistantPreserveStart',
    showTooltip = true,
    autoMinValue = false,
    minValue,
    maxValue,
    allowDecimals = true,
    connectNulls = false,
    className,
    onValueChange,
    tickGap = 5,
    xAxisLabel,
    yAxisLabel,
    type = 'default',
    fill = 'gradient',
    tooltipCallback,
    customTooltip,
    ...other
  } = props;
  const CustomTooltip = customTooltip;
  const paddingValue = (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20;
  const [activeDot, setActiveDot] = React.useState<ActiveDot | undefined>(undefined);
  const [activeLegend, setActiveLegend] = React.useState<string | undefined>(undefined);
  const categoryColors = constructCategoryColors(categories, colors);

  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const hasOnValueChange = !!onValueChange;
  const stacked = type === 'stacked' || type === 'percent';
  const areaId = React.useId();

  const prevActiveRef = React.useRef<boolean | undefined>(undefined);
  const prevLabelRef = React.useRef<string | undefined>(undefined);

  const getFillContent = ({
    fillType,
    activeDot: currentActiveDot,
    activeLegend: currentActiveLegend,
    category,
  }: {
    fillType: AreaChartProps['fill'];
    activeDot: ActiveDot | undefined;
    activeLegend: string | undefined;
    category: string;
  }) => {
    const stopOpacity = currentActiveDot || (currentActiveLegend && currentActiveLegend !== category) ? 0.1 : 0.3;

    switch (fillType) {
      case 'none':
        return <stop stopColor="currentColor" stopOpacity={0} />;
      case 'gradient':
        return (
          <>
            <stop offset="5%" stopColor="currentColor" stopOpacity={stopOpacity} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </>
        );
      case 'solid':
      default:
        return <stop stopColor="currentColor" stopOpacity={stopOpacity} />;
    }
  };

  function valueToPercent(value: number) {
    return `${(value * 100).toFixed(0)}%`;
  }

  function onDotClick(itemData: any, event: React.MouseEvent) {
    event.stopPropagation();

    if (!hasOnValueChange) return;
    if (
      (itemData.index === activeDot?.index && itemData.dataKey === activeDot?.dataKey) ||
      (hasOnlyOneValueForKey(data, itemData.dataKey) && activeLegend && activeLegend === itemData.dataKey)
    ) {
      setActiveLegend(undefined);
      setActiveDot(undefined);
      onValueChange?.(null);
    } else {
      setActiveLegend(itemData.dataKey);
      setActiveDot({ index: itemData.index, dataKey: itemData.dataKey });
      onValueChange?.({ eventType: 'dot', categoryClicked: itemData.dataKey, ...itemData.payload });
    }
  }

  function onCategoryClick(dataKey: string) {
    if (!hasOnValueChange) return;
    if ((dataKey === activeLegend && !activeDot) || (hasOnlyOneValueForKey(data, dataKey) && activeDot && activeDot.dataKey === dataKey)) {
      setActiveLegend(undefined);
      onValueChange?.(null);
    } else {
      setActiveLegend(dataKey);
      onValueChange?.({ eventType: 'category', categoryClicked: dataKey });
    }
    setActiveDot(undefined);
  }

  return (
    <div ref={ref} className={cx('h-80 w-full', className)} tremor-id="tremor-raw" {...other}>
      <ResponsiveContainer>
        <RechartsAreaChart
          data={data}
          onClick={
            hasOnValueChange && (activeLegend || activeDot)
              ? () => {
                  setActiveDot(undefined);
                  setActiveLegend(undefined);
                  onValueChange?.(null);
                }
              : undefined
          }
          margin={{
            bottom: xAxisLabel ? 30 : undefined,
            left: yAxisLabel ? 20 : undefined,
            right: yAxisLabel ? 5 : undefined,
            top: 5,
          }}
          stackOffset={type === 'percent' ? 'expand' : undefined}
        >
          {showGridLines ? <CartesianGrid className={cx('stroke-border-subtle stroke-1')} horizontal={true} vertical={false} /> : null}
          <XAxis
            padding={{ left: paddingValue, right: paddingValue }}
            hide={!showXAxis}
            dataKey={index}
            interval={startEndOnly ? 'preserveStartEnd' : intervalType}
            tick={{ transform: 'translate(0, 6)' }}
            ticks={startEndOnly ? [data[0][index], data[data.length - 1][index]] : undefined}
            fill=""
            stroke=""
            className={cx('text-xs', 'fill-text-faint')}
            tickLine={false}
            axisLine={false}
            minTickGap={tickGap}
          >
            {xAxisLabel && (
              <Label position="insideBottom" offset={-20} className="fill-text-secondary text-sm font-medium">
                {xAxisLabel}
              </Label>
            )}
          </XAxis>
          <YAxis
            width={yAxisWidth}
            hide={!showYAxis}
            axisLine={false}
            tickLine={false}
            type="number"
            domain={yAxisDomain as AxisDomain}
            tick={{ transform: 'translate(-3, 0)' }}
            fill=""
            stroke=""
            className={cx('text-xs', 'fill-text-faint')}
            tickFormatter={type === 'percent' ? valueToPercent : valueFormatter}
            allowDecimals={allowDecimals}
          >
            {yAxisLabel && (
              <Label position="insideLeft" style={{ textAnchor: 'middle' }} angle={-90} offset={-15} className="fill-text-secondary text-sm font-medium">
                {yAxisLabel}
              </Label>
            )}
          </YAxis>
          <Tooltip
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={true}
            animationDuration={100}
            cursor={{ stroke: 'var(--border-default)', strokeWidth: 1 }}
            offset={20}
            position={{ y: 0 }}
            content={({ active, payload, label }) => {
              const tooltipLabel = label == null ? '' : String(label);
              const cleanPayload: TooltipProps['payload'] = payload
                ? payload.map((item: any) => ({
                    category: item.dataKey,
                    value: item.value,
                    index: item.payload[index],
                    color: categoryColors.get(item.dataKey) as AvailableChartColorsKeys,
                    type: item.type,
                    payload: item.payload,
                  }))
                : [];

              if (tooltipCallback && (active !== prevActiveRef.current || label !== prevLabelRef.current)) {
                tooltipCallback({ active, payload: cleanPayload, label: tooltipLabel });
                prevActiveRef.current = active;
                prevLabelRef.current = tooltipLabel;
              }

              return showTooltip && active ? (
                CustomTooltip ? (
                  <CustomTooltip active={active} payload={cleanPayload} label={tooltipLabel} />
                ) : (
                  <ChartTooltip active={active} payload={cleanPayload} label={tooltipLabel} valueFormatter={valueFormatter} />
                )
              ) : null;
            }}
          />

          {categories.map((category) => {
            const categoryId = `${areaId}-${category.replace(/[^a-zA-Z0-9]/g, '')}`;
            return (
              <React.Fragment key={category}>
                <defs>
                  <linearGradient
                    key={category}
                    className={cx(getColorClassName(categoryColors.get(category) as AvailableChartColorsKeys, 'text'))}
                    id={categoryId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    {getFillContent({ fillType: fill, activeDot, activeLegend, category })}
                  </linearGradient>
                </defs>
                <Area
                  className={cx(getColorClassName(categoryColors.get(category) as AvailableChartColorsKeys, 'stroke'))}
                  strokeOpacity={activeDot || (activeLegend && activeLegend !== category) ? 0.3 : 1}
                  activeDot={(dotProps: any) => {
                    const { cx: cxCoord, cy: cyCoord, stroke, strokeLinecap, strokeLinejoin, strokeWidth, dataKey } = dotProps;
                    return (
                      <Dot
                        className={cx('stroke-surface-card', onValueChange ? 'cursor-pointer' : '', getColorClassName(categoryColors.get(dataKey) as AvailableChartColorsKeys, 'fill'))}
                        cx={cxCoord}
                        cy={cyCoord}
                        r={5}
                        fill=""
                        stroke={stroke}
                        strokeLinecap={strokeLinecap}
                        strokeLinejoin={strokeLinejoin}
                        strokeWidth={strokeWidth}
                        onClick={(_, event) => onDotClick(dotProps, event)}
                      />
                    );
                  }}
                  dot={(dotProps: any) => {
                    const { stroke, strokeLinecap, strokeLinejoin, strokeWidth, cx: cxCoord, cy: cyCoord, dataKey, index: dotIndex } = dotProps;

                    if (
                      (hasOnlyOneValueForKey(data, category) && !(activeDot || (activeLegend && activeLegend !== category))) ||
                      (activeDot?.index === dotIndex && activeDot?.dataKey === category)
                    ) {
                      return (
                        <Dot
                          key={dotIndex}
                          cx={cxCoord}
                          cy={cyCoord}
                          r={5}
                          stroke={stroke}
                          fill=""
                          strokeLinecap={strokeLinecap}
                          strokeLinejoin={strokeLinejoin}
                          strokeWidth={strokeWidth}
                          className={cx('stroke-surface-card', onValueChange ? 'cursor-pointer' : '', getColorClassName(categoryColors.get(dataKey) as AvailableChartColorsKeys, 'fill'))}
                        />
                      );
                    }
                    return <React.Fragment key={dotIndex}></React.Fragment>;
                  }}
                  key={category}
                  name={category}
                  type="linear"
                  dataKey={category}
                  stroke=""
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  isAnimationActive={false}
                  connectNulls={connectNulls}
                  stackId={stacked ? 'stack' : undefined}
                  fill={`url(#${categoryId})`}
                />
              </React.Fragment>
            );
          })}
          {/* linhas invisíveis só pra aumentar a área clicável, quando onValueChange existe */}
          {onValueChange
            ? categories.map((category) => (
                <Line
                  className={cx('cursor-pointer')}
                  strokeOpacity={0}
                  key={category}
                  name={category}
                  type="linear"
                  dataKey={category}
                  stroke="transparent"
                  fill="transparent"
                  legendType="none"
                  tooltipType="none"
                  strokeWidth={12}
                  connectNulls={connectNulls}
                  onClick={(lineProps: any, event) => {
                    event.stopPropagation();
                    const { name } = lineProps;
                    onCategoryClick(name);
                  }}
                />
              ))
            : null}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
});

AreaChart.displayName = 'AreaChart';

export { AreaChart, type AreaChartEventProps, type TooltipProps };
