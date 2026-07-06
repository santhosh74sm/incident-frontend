import React, { memo } from 'react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    LabelList,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from 'recharts';
import { CHART_THEME, ChartSurface, ChartTooltip, CompactXAxisTick, useCompactChart } from './DashboardPrimitives';
import { CHART_COLORS, STATUS_COLORS } from '../../utils/analytics';

export const IncidentStatusTrendChart = memo(({ data = [], height = 320, idPrefix = 'status-trend' }) => {
    const compactChart = useCompactChart();
    const xAxisProps = compactChart
        ? { height: 68, interval: 0, tickMargin: 12, tick: <CompactXAxisTick maxLength={10} /> }
        : { tick: { fill: CHART_THEME.axis, fontSize: 12 } };

    return (
        <ChartSurface height={height}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: compactChart ? 34 : 0 }}>
                    <defs>
                        <linearGradient id={`${idPrefix}-pending`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS.Pending} stopOpacity={0.18} />
                            <stop offset="95%" stopColor={STATUS_COLORS.Pending} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id={`${idPrefix}-closed`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="5%" stopColor={STATUS_COLORS.Closed} stopOpacity={0.16} />
                            <stop offset="95%" stopColor={STATUS_COLORS.Closed} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} {...xAxisProps} />
                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip
                        cursor={{ stroke: '#cbd5e1', strokeDasharray: '4 4' }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || 'Timeline Date'}
                    />
                    <Area type="monotone" dataKey="pending" stroke={STATUS_COLORS.Pending} fill={`url(#${idPrefix}-pending)`} strokeWidth={3} name="Pending" activeDot={{ r: 6 }} />
                    <Area type="monotone" dataKey="closed" stroke={STATUS_COLORS.Closed} fill={`url(#${idPrefix}-closed)`} strokeWidth={3} name="Closed" activeDot={{ r: 6 }} />
                </AreaChart>
            </ResponsiveContainer>
        </ChartSurface>
    );
});

export const DailyCreationTrendChart = memo(({ data = [], height = 300 }) => {
    const compactChart = useCompactChart();
    const xAxisProps = compactChart
        ? { height: 68, interval: 0, tickMargin: 12, tick: <CompactXAxisTick maxLength={10} /> }
        : { tick: { fill: CHART_THEME.axis, fontSize: 12 } };

    return (
        <ChartSurface height={height}>
            <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: compactChart ? 34 : 0 }} maxBarSize={38}>
                    <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} {...xAxisProps} />
                    <YAxis tick={{ fill: CHART_THEME.axis, fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <ChartTooltip
                        cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate || 'Timeline Date'}
                    />
                    <Bar dataKey="created" fill={CHART_COLORS.neutralPrimary} radius={[8, 8, 0, 0]} name="New Incidents">
                        <LabelList dataKey="created" position="top" fill={CHART_THEME.label} fontSize={12} />
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartSurface>
    );
});
